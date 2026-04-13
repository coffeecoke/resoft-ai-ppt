/**
 * 企业微信智能机器人 WebSocket 配置（与 saler-agent 对齐）
 */

const DEFAULT_WS_URL = 'wss://openws.work.weixin.qq.com'
const DEFAULT_HEARTBEAT_INTERVAL = 30000
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10
const DEFAULT_RECONNECT_BASE_DELAY = 1000
const DEFAULT_RECONNECT_MAX_DELAY = 30000
const DEFAULT_LOG_LEVEL = 'info'

function loadWeComBotConfig() {
  const required = ['WECOM_BOT_ID', 'WECOM_BOT_SECRET']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
  return {
    botId: process.env.WECOM_BOT_ID,
    secret: process.env.WECOM_BOT_SECRET,
    wsUrl: process.env.WECOM_WS_URL || DEFAULT_WS_URL,
    heartbeatInterval: parseInt(process.env.WECOM_HEARTBEAT_INTERVAL || '', 10) || DEFAULT_HEARTBEAT_INTERVAL,
    maxReconnectAttempts: parseInt(process.env.WECOM_MAX_RECONNECT_ATTEMPTS || '', 10) || DEFAULT_MAX_RECONNECT_ATTEMPTS,
    reconnectBaseDelay: parseInt(process.env.WECOM_RECONNECT_BASE_DELAY || '', 10) || DEFAULT_RECONNECT_BASE_DELAY,
    reconnectMaxDelay: parseInt(process.env.WECOM_RECONNECT_MAX_DELAY || '', 10) || DEFAULT_RECONNECT_MAX_DELAY,
    logLevel: process.env.WECOM_LOG_LEVEL || DEFAULT_LOG_LEVEL
  }
}

/**
 * INTERNAL_API_TOKENS JSON 数组: [{"appId":"node1","secret":"xxx"}]
 * 用于主动发消息接口鉴权（与 saler-agent sendApi 一致）
 */
function loadInternalApiTokens() {
  const tokensStr = process.env.INTERNAL_API_TOKENS
  if (!tokensStr) return null
  try {
    const tokens = JSON.parse(tokensStr)
    if (!Array.isArray(tokens) || tokens.length === 0) {
      console.warn('[wecom-bot] INTERNAL_API_TOKENS 为空数组，主动发消息接口未启用')
      return null
    }
    for (const token of tokens) {
      if (!String(token.appId || '').trim() || !String(token.secret || '').trim()) {
        throw new Error('Each token must have non-empty appId and secret')
      }
    }
    return tokens
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Invalid INTERNAL_API_TOKENS: ${msg}`)
  }
}

function validateWeComBotConfig(config) {
  if (!config.botId || String(config.botId).trim() === '') {
    throw new Error('botId is required')
  }
  if (!config.secret || String(config.secret).trim() === '') {
    throw new Error('secret is required')
  }
  return true
}

function isWeComBotConfigured() {
  const id = process.env.WECOM_BOT_ID
  const sec = process.env.WECOM_BOT_SECRET
  return Boolean(id && String(id).trim() && sec && String(sec).trim())
}

/**
 * 为 true 时不启动智能机器人 WebSocket（不连 wss://openws…），其它 HTTP 能力不受影响。
 * 取值：1 / true / yes / on（不区分大小写）；兼容别名 WECOM_DISABLE_BOT_WS。
 */
function isWeComBotWsStartupDisabled() {
  const primary = String(process.env.WECOM_BOT_WS_DISABLED || '').trim().toLowerCase()
  const alias = String(process.env.WECOM_DISABLE_BOT_WS || '').trim().toLowerCase()
  const v = primary || alias
  return ['1', 'true', 'yes', 'on'].includes(v)
}

module.exports = {
  loadWeComBotConfig,
  loadInternalApiTokens,
  validateWeComBotConfig,
  isWeComBotConfigured,
  isWeComBotWsStartupDisabled
}
