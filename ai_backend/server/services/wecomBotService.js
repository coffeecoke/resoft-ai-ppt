/**
 * 企业微信智能机器人长连接：与 ai_backend 同进程启动（原 saler-agent 能力）
 */
const { WeComBotClient } = require('../wecomBot/WeComBotClient')
const { registerDefaultMessageHandlers } = require('../wecomBot/defaultMessageHandlers')
const { isWeComBotConfigured, loadInternalApiTokens } = require('../wecomBot/config')
const { getLogger } = require('../wecomBot/logger')

let client = null

function getWeComBotClient() {
  return client
}

function getInternalApiTokensSafe() {
  try {
    return loadInternalApiTokens()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[wecom-bot] INTERNAL_API_TOKENS 无效:', msg)
    return null
  }
}

function startWeComBot() {
  if (!isWeComBotConfigured()) {
    console.info('[wecom-bot] 未配置 WECOM_BOT_ID / WECOM_BOT_SECRET，跳过智能机器人长连接')
    return
  }
  if (client) {
    console.warn('[wecom-bot] 客户端已存在，跳过重复启动')
    return
  }
  try {
    const log = getLogger()
    client = new WeComBotClient()
    registerDefaultMessageHandlers(client)
    client.on('authenticated', () => {
      const id = String(process.env.WECOM_BOT_ID || '')
      const masked = id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
      log.info(`[wecom-bot] WebSocket 已认证，可接收用户消息 botId=${masked}`)
    })
    client.on('disconnected', (reason) => {
      log.warn(`[wecom-bot] WebSocket 断开 reason=${reason || 'unknown'}`)
    })
    client.connect()
    log.info('[wecom-bot] WebSocket 长连接已启动（落盘: UPLOAD_BASE_DIR/wecom_bot/received）')
  } catch (e) {
    console.error('[wecom-bot] 启动失败:', e)
    client = null
  }
}

function stopWeComBot() {
  if (client) {
    try {
      client.disconnect()
    } catch (e) {
      console.error('[wecom-bot] disconnect error:', e)
    }
    client = null
  }
}

module.exports = {
  getWeComBotClient,
  startWeComBot,
  stopWeComBot,
  getInternalApiTokensSafe
}
