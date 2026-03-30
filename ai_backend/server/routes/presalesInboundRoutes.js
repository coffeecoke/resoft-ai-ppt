/**
 * 售前报备外部接入：JSON/文本报备 + 远程音频路径 → 入库 + 转录
 *
 * POST /api/presales-inbound/report-and-transcribe
 * 若配置了 PRESALES_INBOUND_API_SECRET：Header 需带 X-Presales-Inbound-Secret 或 Authorization: Bearer
 * 未配置密钥：不鉴权（仅联调，生产请配置）
 */
const express = require('express')
const presalesInboundService = require('../services/presalesInboundService')

const router = express.Router()

let warnedOpenEndpoint = false

function requireInboundSecret(req, res, next) {
  const secret = process.env.PRESALES_INBOUND_API_SECRET
    ? String(process.env.PRESALES_INBOUND_API_SECRET).trim()
    : ''
  /** 未配置密钥时不校验，便于先联调；生产环境请务必设置 PRESALES_INBOUND_API_SECRET */
  if (!secret) {
    if (!warnedOpenEndpoint) {
      warnedOpenEndpoint = true
      console.warn(
        '[presales-inbound] PRESALES_INBOUND_API_SECRET 未配置，接口不鉴权（仅联调用，生产请配置密钥）'
      )
    }
    return next()
  }
  const fromHeader = req.headers['x-presales-inbound-secret']
  const auth = req.headers.authorization || ''
  const bearer = auth.replace(/^Bearer\s+/i, '').trim()
  const token = (fromHeader && String(fromHeader).trim()) || bearer
  if (token !== secret) {
    return res.status(401).json({ success: false, error: '鉴权失败' })
  }
  next()
}

function normalizeReportBody(body) {
  let report = body.report ?? body.reportJson ?? body.reportText
  if (report == null) {
    return { error: '缺少报备内容：请传 report、reportJson 或 reportText' }
  }
  if (typeof report === 'string') {
    const t = report.trim()
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        report = JSON.parse(t)
      } catch {
        /* 非合法 JSON 时仍按交流报备文本解析 */
      }
    }
  }
  return { report }
}

router.post('/report-and-transcribe', requireInboundSecret, async (req, res) => {
  try {
    const { audioRemotePath, originalFileName, createdBy } = req.body || {}
    const norm = normalizeReportBody(req.body || {})
    if (norm.error) {
      return res.status(400).json({ success: false, error: norm.error })
    }
    if (audioRemotePath == null || String(audioRemotePath).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少 audioRemotePath' })
    }

    const data = await presalesInboundService.runReportAndTranscribe({
      reportPayload: norm.report,
      audioRemotePath: String(audioRemotePath).trim(),
      originalFileName: originalFileName != null ? String(originalFileName) : undefined,
      createdBy: createdBy != null ? String(createdBy) : undefined
    })

    res.json({
      success: true,
      data,
      message: '报备已入库并完成转录'
    })
  } catch (err) {
    const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500
    res.status(status).json({
      success: false,
      error: err.message || String(err)
    })
  }
})

module.exports = router
