/**
 * 企业微信智能机器人长连接：与 ai_backend 同进程启动（原 saler-agent 能力）
 */
const { WeComBotClient } = require('../wecomBot/WeComBotClient')
const { registerDefaultMessageHandlers } = require('../wecomBot/defaultMessageHandlers')
const { isWeComBotConfigured, loadInternalApiTokens } = require('../wecomBot/config')
const { getLogger } = require('../wecomBot/logger')

let client = null
/** @type {ReturnType<typeof setTimeout> | null} */
let kickedReconnectTimer = null

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
      const r = String(reason || 'unknown')
      log.warn(`[wecom-bot] WebSocket 断开 reason=${r}`)
      // 企微侧：同一 botId 仅允许一条长连接；别处新连上会踢掉本连接，需自行再连
      const kicked =
        r.includes('kicked') ||
        r.includes('Kicked') ||
        r.includes('New connection') ||
        r.includes('new connection')
      if (kicked) {
        if (kickedReconnectTimer) clearTimeout(kickedReconnectTimer)
        const delayMs = Math.max(
          3000,
          parseInt(process.env.WECOM_KICKED_RECONNECT_DELAY_MS || '8000', 10) || 8000
        )
        kickedReconnectTimer = setTimeout(() => {
          kickedReconnectTimer = null
          try {
            const c = getWeComBotClient()
            if (!c) return
            const st = c.getState()
            if (st === 'disconnected') {
              log.info(`[wecom-bot] 被新连接挤下线后尝试重连（延迟 ${delayMs}ms）…`)
              c.connect()
            }
          } catch (e) {
            log.error('[wecom-bot] kicked 后重连失败:', e)
          }
        }, delayMs)
      }
    })
    client.connect()
    log.info('[wecom-bot] WebSocket 长连接已启动（落盘: UPLOAD_BASE_DIR/wecom_bot/received）')
  } catch (e) {
    console.error('[wecom-bot] 启动失败:', e)
    client = null
  }
}

function stopWeComBot() {
  if (kickedReconnectTimer) {
    clearTimeout(kickedReconnectTimer)
    kickedReconnectTimer = null
  }
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
