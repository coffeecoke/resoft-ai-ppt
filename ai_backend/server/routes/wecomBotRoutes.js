/**
 * 企业微信机器人：状态查询 + 主动发消息（与主服务同一 PORT，需 INTERNAL_API_TOKENS）
 */
const express = require('express')
const { getWeComBotClient, getInternalApiTokensSafe } = require('../services/wecomBotService')
const { isWeComBotWsStartupDisabled } = require('../wecomBot/config')
const { getLogger } = require('../wecomBot/logger')

const router = express.Router()
const log = getLogger()

function previewSendBody(content, max = 160) {
  const t = String(content || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

function authenticate(req, tokens) {
  const appId = req.headers['x-app-id']
  const auth = req.headers.authorization || ''
  const secret = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!appId || !secret) return null
  const token = tokens.find((t) => t.appId === appId && t.secret === secret)
  return token ? appId : null
}

router.get('/status', (req, res) => {
  const c = getWeComBotClient()
  const tokens = getInternalApiTokensSafe()
  const wsStartupDisabled = isWeComBotWsStartupDisabled()
  res.json({
    enabled: Boolean(c),
    wsStartupDisabled,
    wsState: c ? c.getState() : null,
    wsAuthenticated: c ? c.isConnected() : false,
    sendApiEnabled: Boolean(tokens && tokens.length)
  })
})

/** 与 saler-agent GET /api/send/health 响应字段对齐 */
router.get('/send/health', (req, res) => {
  const c = getWeComBotClient()
  res.json({
    ok: true,
    wsAuthenticated: c ? c.isConnected() : false
  })
})

function requireSendAuth(req, res, next) {
  const tokens = getInternalApiTokensSafe()
  if (!tokens || tokens.length === 0) {
    return res.status(503).json({
      error: 'send_api_disabled',
      hint: '配置环境变量 INTERNAL_API_TOKENS（JSON 数组）后可用'
    })
  }
  const appId = authenticate(req, tokens)
  if (!appId) {
    return res.status(401).json({
      error: 'unauthorized',
      hint: '需要 Header: X-App-Id 与 Authorization: Bearer <secret>'
    })
  }
  req.wecomAppId = appId
  next()
}

router.post('/send/user', requireSendAuth, async (req, res) => {
  const bot = getWeComBotClient()
  if (!bot || !bot.isConnected()) {
    return res.status(503).json({ error: 'websocket_not_ready', hint: '等待 WebSocket 认证完成' })
  }
  try {
    const { userId, content, msgType } = req.body || {}
    if (!String(userId || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ error: 'userId and content required' })
    }
    const uid = String(userId).trim()
    const body = String(content).trim()
    const mt = msgType || 'text'
    log.info(
      `[wecom-bot][send][user] callerAppId=${req.wecomAppId} targetUserId=${uid} msgType=${mt} preview=${previewSendBody(body)}`
    )
    await bot.sendMsg(uid, body, mt)
    res.json({ ok: true, appId: req.wecomAppId })
  } catch (e) {
    log.error('[wecom-bot][send][user] 失败', e)
    res.status(500).json({ error: 'send_failed', message: e.message })
  }
})

router.post('/send/group', requireSendAuth, async (req, res) => {
  const bot = getWeComBotClient()
  if (!bot || !bot.isConnected()) {
    return res.status(503).json({ error: 'websocket_not_ready', hint: '等待 WebSocket 认证完成' })
  }
  try {
    const { chatId, content } = req.body || {}
    if (!String(chatId || '').trim() || !String(content || '').trim()) {
      return res.status(400).json({ error: 'chatId and content required' })
    }
    const cid = String(chatId).trim()
    const body = String(content).trim()
    log.info(
      `[wecom-bot][send][group] callerAppId=${req.wecomAppId} targetChatId=${cid} preview=${previewSendBody(body)}`
    )
    await bot.sendGroupMsg(cid, body)
    res.json({ ok: true, appId: req.wecomAppId })
  } catch (e) {
    log.error('[wecom-bot][send][group] 失败', e)
    res.status(500).json({ error: 'send_failed', message: e.message })
  }
})

module.exports = router
