const { WSClient, generateReqId } = require('@wecom/aibot-node-sdk')
const { loadWeComBotConfig, validateWeComBotConfig } = require('./config')
const { getLogger, initLogger } = require('./logger')

class WeComBotClient {
  constructor(configOverride) {
    const base = loadWeComBotConfig()
    this.config = configOverride ? { ...base, ...configOverride } : base
    validateWeComBotConfig(this.config)
    initLogger({ logLevel: this.config.logLevel })
    this.logger = getLogger()
    this.wsClient = null
    this.state = 'disconnected'
    this.messageHandlers = new Map()
    this.eventHandlers = new Map()
    this.connectionHandlers = new Map()
  }

  connect() {
    if (this.state === 'connected' || this.state === 'authenticated') {
      this.logger.warn('WeCom bot: already connected')
      return
    }
    this.setState('connecting')
    this.logger.info('WeCom bot: connecting WebSocket...')

    this.wsClient = new WSClient({
      botId: this.config.botId,
      secret: this.config.secret,
      wsUrl: this.config.wsUrl,
      heartbeatInterval: this.config.heartbeatInterval,
      maxReconnectAttempts: this.config.maxReconnectAttempts,
      reconnectInterval: this.config.reconnectBaseDelay,
      reconnectMaxDelay: this.config.reconnectMaxDelay
    })

    this.setupEventListeners()
    this.wsClient.connect()
  }

  setupEventListeners() {
    if (!this.wsClient) return

    this.wsClient.on('connected', () => {
      this.logger.info('WeCom bot: WebSocket opened')
    })

    this.wsClient.on('authenticated', () => {
      this.logger.info('WeCom bot: authenticated')
      this.setState('authenticated')
      this.triggerConnectionHandler('authenticated')
    })

    this.wsClient.on('disconnected', (reason) => {
      this.logger.info(`WeCom bot: closed: ${reason}`)
      this.setState('disconnected')
      this.triggerConnectionHandler('disconnected', reason)
    })

    this.wsClient.on('error', (error) => {
      this.logger.error('WeCom bot: WebSocket error:', error)
      this.triggerConnectionHandler('error', error)
    })

    this.wsClient.on('reconnecting', (attempt) => {
      this.logger.info(`WeCom bot: reconnecting attempt ${attempt}`)
      this.setState('reconnecting')
      this.triggerConnectionHandler('reconnecting', attempt)
    })

    const messageTypes = ['text', 'image', 'voice', 'file', 'mixed', 'video', 'stream', 'location']
    for (const msgType of messageTypes) {
      this.wsClient.on(`message.${msgType}`, (frame) => {
        const handler = this.messageHandlers.get(msgType)
        if (handler) {
          const data = this.parseMessageData(frame, msgType)
          Promise.resolve(handler(data, frame)).catch((err) => {
            this.logger.error(`onMessage(${msgType}) error:`, err)
          })
        }
      })
    }

    this.wsClient.on('event.enter_chat', (frame) => {
      const handler = this.eventHandlers.get('enter_chat')
      if (handler) handler(this.parseEventData(frame, 'enter_chat'))
    })

    this.wsClient.on('event.template_card_event', (frame) => {
      const handler = this.eventHandlers.get('template_card_event')
      if (handler) handler(this.parseEventData(frame, 'template_card_event'))
    })

    this.wsClient.on('event.feedback_event', (frame) => {
      const handler = this.eventHandlers.get('feedback_event')
      if (handler) handler(this.parseEventData(frame, 'feedback_event'))
    })

    this.wsClient.on('event.disconnected_event', (frame) => {
      this.logger.info('WeCom bot: disconnected_event (kicked by new connection)')
      const handler = this.eventHandlers.get('disconnected_event')
      if (handler) handler(this.parseEventData(frame, 'disconnected_event'))
      const body = frame.body || {}
      const reason = (body.event && body.event.reason) || 'kicked_by_new_connection'
      this.setState('disconnected')
      this.triggerConnectionHandler('disconnected', reason)
    })
  }

  parseMessageData(frame, msgType) {
    const body = frame.body || {}
    const from = body.from || {}
    return {
      msgType,
      content: JSON.stringify(body),
      userId: from.userid,
      fromUserName: from.name,
      chatId: body.chatid,
      msgId: body.msgid,
      createTime: body.create_time
    }
  }

  parseEventData(frame, eventType) {
    const body = frame.body || {}
    const from = body.from || {}
    return {
      eventType,
      userId: from.userid,
      chatId: body.chatid,
      eventData: body
    }
  }

  on(event, handler) {
    this.connectionHandlers.set(event, handler)
  }

  triggerConnectionHandler(event, ...args) {
    const handler = this.connectionHandlers.get(event)
    if (handler) handler(...args)
  }

  onMessage(msgType, handler) {
    this.messageHandlers.set(msgType, handler)
  }

  onEvent(eventType, handler) {
    this.eventHandlers.set(eventType, handler)
  }

  async replyText(frame, content) {
    if (!this.wsClient) throw new Error('Client not connected')
    const streamId = generateReqId('stream')
    await this.wsClient.replyStream(frame, streamId, content, true)
  }

  async replyStream(frame, streamId, content, finish) {
    if (!this.wsClient) throw new Error('Client not connected')
    await this.wsClient.replyStream(frame, streamId, content, finish)
  }

  async sendMsg(userId, content, msgType = 'text') {
    if (!this.wsClient) throw new Error('Client not connected')
    const actualMsgType = msgType === 'text' ? 'markdown' : msgType
    const body = {
      chatid: userId,
      to_userid: userId,
      chat_type: 1,
      msgtype: actualMsgType,
      ...(actualMsgType === 'markdown' ? { markdown: { content } } : {})
    }
    await this.wsClient.sendMessage(userId, body)
  }

  /**
   * 主动推送「文本通知」模板卡片（带跳转链接），比纯 Markdown 链接更像「卡片」
   * @param {string} userId 单聊对方 userid
   * @param {{ pageUrl: string, taskId: string, title?: string, desc?: string, subTitle?: string }} opts
   */
  async sendTextNoticeCard(userId, opts) {
    if (!this.wsClient) throw new Error('Client not connected')
    const { pageUrl, taskId, title, desc, subTitle } = opts
    if (!pageUrl || !taskId) throw new Error('pageUrl and taskId required')
    const template_card = {
      card_type: 'text_notice',
      task_id: String(taskId).slice(0, 128),
      main_title: {
        title: title || '说话人角色确认',
        desc: desc || '售前视频流程'
      },
      sub_title_text:
        subTitle || '请核对对话并修正说话人；点击卡片或下方按钮打开页面。',
      jump_list: [{ type: 1, title: '打开确认页面', url: pageUrl }],
      card_action: { type: 1, url: pageUrl }
    }
    const body = {
      chatid: userId,
      to_userid: userId,
      chat_type: 1,
      msgtype: 'template_card',
      template_card
    }
    await this.wsClient.sendMessage(userId, body)
  }

  async sendGroupMsg(groupId, content) {
    if (!this.wsClient) throw new Error('Client not connected')
    const body = {
      chatid: groupId,
      chat_type: 2,
      msgtype: 'markdown',
      markdown: { content }
    }
    await this.wsClient.sendMessage(groupId, body)
  }

  async downloadFile(url, aesKey) {
    if (!this.wsClient) throw new Error('Client not connected')
    return this.wsClient.downloadFile(url, aesKey)
  }

  disconnect() {
    if (this.wsClient) {
      this.wsClient.disconnect()
      this.wsClient = null
    }
    this.setState('disconnected')
    this.logger.info('WeCom bot: disconnected')
  }

  getState() {
    return this.state
  }

  isConnected() {
    return this.state === 'authenticated' || this.state === 'connected'
  }

  setState(state) {
    this.state = state
    this.logger.debug(`WeCom bot state: ${state}`)
  }
}

module.exports = { WeComBotClient }
