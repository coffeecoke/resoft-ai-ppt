/**
 * 售前视频 · 企微「角色确认」外链 token（HMAC 签名，无状态）
 */
const crypto = require('crypto')
const { getAiBackendStaticPathPrefix } = require('../utils/aiBackendPublicPath')

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000

function getSecret() {
  const s = process.env.PRESALES_VIDEO_SPEAKER_LINK_SECRET
  if (s && String(s).trim().length >= 16) return String(s).trim()
  return null
}

function signSpeakerConfirmToken(transcriptionId, ttlMs = DEFAULT_TTL_MS) {
  const secret = getSecret()
  if (!secret) throw new Error('未配置 PRESALES_VIDEO_SPEAKER_LINK_SECRET（至少 16 字符）')
  const exp = Date.now() + ttlMs
  const payload = { typ: 'pv_speaker', tid: String(transcriptionId), exp }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

function verifySpeakerConfirmToken(token) {
  const secret = getSecret()
  if (!secret || !token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [body, sig] = parts
  const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url')
  if (expected !== sig) return null
  let payload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!payload || payload.typ !== 'pv_speaker' || !payload.tid) return null
  if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null
  return { transcriptionId: String(payload.tid) }
}

function buildSpeakerConfirmPageUrl(token) {
  const base = process.env.PRESALES_VIDEO_PUBLIC_BASE_URL
  if (!base || !String(base).trim()) {
    throw new Error('未配置 PRESALES_VIDEO_PUBLIC_BASE_URL（外网可访问的 ai_backend 根地址，无末尾斜杠）')
  }
  const root = String(base).trim().replace(/\/$/, '')
  const pfx = getAiBackendStaticPathPrefix()
  const pagePath = `${pfx}/pages/presales-video-speaker-confirm.html`
  return `${root}${pagePath}?token=${encodeURIComponent(token)}`
}

module.exports = {
  signSpeakerConfirmToken,
  verifySpeakerConfirmToken,
  buildSpeakerConfirmPageUrl,
  getSecret
}
