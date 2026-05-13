/**
 * 售前分析 · 视频生成：合并对话列表、推送对话、报告与视频对接（第三方 URL 由环境变量配置）
 *
 * 环境变量：
 * - PRESALES_VIDEO_DIALOGUE_LOCAL_DIR       合并对话 txt 落地目录（默认 uploads_data/presales_video_dialogue）
 * - PRESALES_VIDEO_COZE_FILE_UPLOAD_URL     推送对话：multipart 仅字段 file → 返回 file_id、file_name（不落会议分析）
 * - PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL 提交工作流：JSON { fileId, fileName, meetingName } → execute_id（body 可空，缺省读 presales_video_tasks；三者均去掉路径与常见文件后缀再转发）
 * - PRESALES_VIDEO_COZE_TOKEN               可选，Coze 上传/会议分析请求带 Authorization: Bearer <token>
 * - PRESALES_VIDEO_REPORT_FETCH_URL    获取报告：请求第三方 GET（可选，与本地库二选一逻辑见下）
 * - PRESALES_VIDEO_REPORT_ASYNC_URL    推送报告：异步任务 POST 完整 URL（如 …/async），Body { name, execute_id, filePaths }（优先于下方旧推送）
 * - PRESALES_VIDEO_REPORT_ASYNC_TOKEN  可选，异步任务请求 Authorization: Bearer
 * - PRESALES_VIDEO_REPORT_ASYNC_PROMPT 可选，异步任务 Body 中 prompt 默认值覆盖（默认文案：根据报告内容，生成视频，使用默认主题）
 * - PRESALES_VIDEO_SUBTITLE_VIDEO_ASYNC_URL 可选；音频时长 < PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC（默认 600s）且本 URL、合并 txt 路径、音频路径齐全时 POST { audio_path, txt_path, name, execute_id }，否则仍走 REPORT_ASYNC_URL
 * - PRESALES_VIDEO_SUBTITLE_VIDEO_ASYNC_TOKEN 可选；缺省时短音频分支复用 PRESALES_VIDEO_REPORT_ASYNC_TOKEN
 * - PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC 可选；整数秒，短音频走字幕接口的时长上界（不含等于），默认 600；非法或超出 86400 则回退默认
 * - PRESALES_VIDEO_REPORT_PUSH_URL     未配置 ASYNC_URL 时：旧版推送本地售前分析 JSON POST（可选）
 * - PRESALES_VIDEO_FETCH_URL           获取视频 GET（可选，query: transcriptionId）
 * - WECOM_CORP_ID / WECOM_APPCHAT_SECRET / WECOM_AGENT_ID  推送视频：appchat 建群；说话人角色确认：自建应用 message/send textcard；超时提醒：同应用 markdown（接收人须在应用可见范围）
 * - PRESALES_VIDEO_WORKFLOW_SUBMIT_URL 提交工作流 JSON POST（可选）
 * - PRESALES_VIDEO_WORKFLOW_SUBMIT_TOKEN 可选，Bearer Token 鉴权
 * - PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET 可选，工作流回调鉴权；请求需带 Header X-Presales-Video-Callback-Secret 或 query ?secret=
 * - PRESALES_VIDEO_ANALYSIS_MD_DIR 可选，analysis_content 成功回调时除入库外写入 .md 的目录（默认 uploads_data/presales_video_analysis_md）
 */

const express = require('express')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')

const { v4: uuidv4 } = require('uuid')
const mergedDialogueService = require('../services/transcriptionMergedDialogueService')
const presalesAnalysisService = require('../services/presalesAnalysisService')
const presalesVideoTaskService = require('../services/presalesVideoTaskService')
const presalesVideoSpeakerLink = require('../services/presalesVideoSpeakerLink')
const wecomAppChatApi = require('../services/wecomAppChatApi')
const presalesVideoWecomPushService = require('../services/presalesVideoWecomPushService')
const presalesVideoPipelineOrchestrator = require('../services/presalesVideoPipelineOrchestrator')
const logger = require('../utils/logger')
const { getAiBackendStaticPathPrefix } = require('../utils/aiBackendPublicPath')

const router = express.Router()
const prisma = require('../utils/prisma')

/** 推送报告（异步）第三方 Body 字段 prompt 的默认文案 */
const PRESALES_VIDEO_ASYNC_DEFAULT_PROMPT = '根据报告内容，生成视频，使用默认主题'

/** 未配置 PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC 时的默认分界（秒）：≥ 此值走 REPORT_ASYNC_URL */
const PRESALES_VIDEO_REPORT_DURATION_SPLIT_DEFAULT_SEC = 10 * 60
const PRESALES_VIDEO_REPORT_DURATION_SPLIT_MAX_SEC = 86400

/**
 * 读环境变量：短音频（走字幕视频）为 duration < 返回值；≥ 返回值走原 REPORT_ASYNC_URL
 */
function getReportDurationSplitSec() {
  const raw = process.env.PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC
  if (raw == null || String(raw).trim() === '') {
    return PRESALES_VIDEO_REPORT_DURATION_SPLIT_DEFAULT_SEC
  }
  const n = parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n) || n < 1) {
    return PRESALES_VIDEO_REPORT_DURATION_SPLIT_DEFAULT_SEC
  }
  if (n > PRESALES_VIDEO_REPORT_DURATION_SPLIT_MAX_SEC) {
    return PRESALES_VIDEO_REPORT_DURATION_SPLIT_MAX_SEC
  }
  return n
}

/**
 * 管理端「推送视频」弹窗：播放地址不再用 psv_video_info.url，而用语义固定页 + query id = 库表主键 id。
 * 环境变量 PRESALES_VIDEO_WECOM_ADMIN_PLAY_URL_TEMPLATE 须含字面量 {id}（可配 &is_debug=true 等）。
 */
function buildPsvWecomAdminPlayUrl(psvId) {
  const raw = psvId != null ? String(psvId).trim() : ''
  if (!raw) return null
  const idEnc = encodeURIComponent(raw)
  const fromEnv = process.env.PRESALES_VIDEO_WECOM_ADMIN_PLAY_URL_TEMPLATE
  const template =
    fromEnv != null && String(fromEnv).trim() !== ''
      ? String(fromEnv).trim()
      : 'http://smartsale.resoftcss.com.cn:8899/presales/wecom/play?id={id}&is_debug=true'
  if (template.includes('{id}')) {
    return template.replace(/\{id\}/g, idEnc)
  }
  const joiner = template.includes('?') ? '&' : '?'
  return `${template}${joiner}id=${idEnc}&is_debug=true`
}

/** 列表查询：YYYY-MM-DD → 服务器本地时区当日 00:00:00.000 */
function parseListDateFrom(s) {
  if (s == null || String(s).trim() === '') return null
  const t = String(s).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, m, d] = t.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

/** 列表查询：YYYY-MM-DD → 服务器本地时区当日 23:59:59.999 */
function parseListDateTo(s) {
  if (s == null || String(s).trim() === '') return null
  const t = String(s).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
  const [y, m, d] = t.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 59, 999)
}

/** 角色确认卡片展示：优先原始上传文件名，否则转录名称 */
function transcriptionAudioDisplayName(tr) {
  const orig =
    tr.original_file_name != null && String(tr.original_file_name).trim()
      ? String(tr.original_file_name).trim()
      : ''
  if (orig) return orig
  const n = tr.name != null && String(tr.name).trim() ? String(tr.name).trim() : ''
  return n
}

/** 音频展示名去掉扩展名（用于 subtitle-video 的 name） */
function audioDisplayNameWithoutExt(tr, fallbackId) {
  const disp = transcriptionAudioDisplayName(tr)
  if (!disp) return fallbackId || ''
  const pe = path.parse(disp)
  if (pe.ext) return (pe.name && pe.name.trim()) || fallbackId || ''
  return disp
}

/** 企微模板卡主标题不宜过长 */
function truncateForWecomCardTitle(s, maxLen = 48) {
  if (!s) return ''
  if (s.length <= maxLen) return s
  return `${s.slice(0, maxLen - 1)}…`
}

async function getVideoTaskShape(transcriptionId) {
  try {
    const row = await presalesVideoTaskService.getByTranscriptionId(transcriptionId)
    return presalesVideoTaskService.toApiShape(row)
  } catch (e) {
    logger.warn('[presales-video] 读取 presales_video_tasks 失败:', e.message)
    return null
  }
}

function httpRequestJson(method, urlString, jsonBody = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const isHttps = u.protocol === 'https:'
    const lib = isHttps ? https : http
    const bodyStr = jsonBody != null ? JSON.stringify(jsonBody) : ''
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        ...extraHeaders,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr, 'utf8') } : {})
      }
    }
    const req = lib.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, headers: res.headers, body })
      })
    })
    req.on('error', reject)
    if (bodyStr) req.write(bodyStr, 'utf8')
    req.end()
  })
}

function httpRequestGet(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const isHttps = u.protocol === 'https:'
    const lib = isHttps ? https : http
    const opts = {
      method: 'GET',
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search}`
    }
    const req = lib.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        resolve({ status: res.statusCode, headers: res.headers, body })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function appendQuery(baseUrl, transcriptionId) {
  const u = new URL(baseUrl)
  u.searchParams.set('transcriptionId', transcriptionId)
  return u.toString()
}

async function upsertRoleJudgmentAdjustment(transcriptionId, dialogues, speakerRolesInput) {
  const transcription = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!transcription) throw new Error('转录不存在')
  if (!Array.isArray(dialogues) || dialogues.length === 0) {
    throw new Error('dialogues 须为非空数组')
  }
  const fullText = dialogues
    .map((d) => d.text || d.correctedText || d.originalText || '')
    .join('\n')
  const speakers = [
    ...new Set(
      dialogues.map((d) => String(d.speaker || '').trim()).filter(Boolean)
    )
  ]
  let speakerRolesStr = null
  if (speakerRolesInput !== undefined && speakerRolesInput !== null) {
    speakerRolesStr =
      typeof speakerRolesInput === 'string'
        ? speakerRolesInput
        : JSON.stringify(speakerRolesInput)
  }
  const existing = await prisma.dialogue_adjustments.findFirst({
    where: { transcription_id: transcriptionId, note1: '角色判断' },
    orderBy: { created_at: 'desc' }
  })
  if (existing) {
    return prisma.dialogue_adjustments.update({
      where: { id: existing.id },
      data: {
        adjusted_dialogues: JSON.stringify(dialogues),
        full_text: fullText,
        speaker_count: speakers.length,
        ...(speakerRolesStr != null ? { speaker_roles: speakerRolesStr } : {}),
        note2: `企微用户已确认说话人（更新）共 ${dialogues.length} 条`
      }
    })
  }
  return prisma.dialogue_adjustments.create({
    data: {
      id: uuidv4(),
      transcription_id: transcriptionId,
      name: transcription.name,
      original_file_name: transcription.original_file_name,
      audio_file_path: transcription.audio_file_path,
      audio_file_size: transcription.audio_file_size,
      audio_format: transcription.audio_format,
      audio_duration: transcription.audio_duration,
      adjusted_dialogues: JSON.stringify(dialogues),
      full_text: fullText,
      xfyun_order_id: transcription.xfyun_order_id,
      speaker_count: speakers.length,
      has_role_separation: transcription.has_role_separation,
      speaker_roles: speakerRolesStr,
      session_id: transcription.session_id,
      product_id: transcription.product_id,
      customer_name: transcription.customer_name,
      note1: '角色判断',
      note2: `企微用户已确认说话人，共 ${dialogues.length} 条`
    }
  })
}

function cozeAuthHeaders() {
  const token = process.env.PRESALES_VIDEO_COZE_TOKEN
  if (token && String(token).trim()) {
    return { Authorization: `Bearer ${String(token).trim()}` }
  }
  return {}
}

/** 从对象上按路径取第一个非空值（支持 a.b） */
function pickDeep(obj, keys) {
  if (!obj || typeof obj !== 'object') return null
  for (const key of keys) {
    if (key.includes('.')) {
      const parts = key.split('.')
      let cur = obj
      for (const p of parts) {
        cur = cur?.[p]
      }
      if (cur != null && cur !== '') return cur
    } else if (obj[key] != null && obj[key] !== '') {
      return obj[key]
    }
  }
  return null
}

/**
 * 解析 file-upload 响应，兼容 { data: {...} } 与 file_id / fileId
 */
function parseCozeFileUploadResponse(parsed) {
  if (!parsed || typeof parsed !== 'object') return { fileId: null, fileName: null }
  const data = parsed.data != null && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
    ? parsed.data
    : parsed
  const fileId = pickDeep(data, ['file_id', 'fileId', 'id'])
  const fileName = pickDeep(data, ['file_name', 'fileName', 'name'])
  return {
    fileId: fileId != null ? String(fileId) : null,
    fileName: fileName != null ? String(fileName) : null
  }
}

/**
 * 解析 meeting-analysis 响应中的 execute_id
 */
function parseCozeExecuteId(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  const data = parsed.data != null && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
    ? parsed.data
    : parsed
  const id = pickDeep(data, ['execute_id', 'executeId'])
    || pickDeep(parsed, ['execute_id', 'executeId'])
  return id != null ? String(id) : null
}

function httpRequestFormWithHeaders(urlString, form, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const isHttps = u.protocol === 'https:'
    const lib = isHttps ? https : http
    const headers = { ...form.getHeaders(), ...extraHeaders }
    const opts = {
      method: 'POST',
      hostname: u.hostname,
      port: u.port || (isHttps ? 443 : 80),
      path: `${u.pathname}${u.search}`,
      headers
    }
    const req = lib.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, headers: res.headers, body })
      })
    })
    req.on('error', reject)
    form.pipe(req)
  })
}

/** 长响应体写入日志（避免单次过大） */
function logResponseBody(tag, body, maxLen = 16000) {
  const s = body == null ? '' : String(body)
  if (s.length <= maxLen) {
    logger.info(`${tag}${s}`)
  } else {
    logger.info(`${tag}${s.slice(0, maxLen)}…(总长 ${s.length} 字符，日志已截断)`)
  }
}

/** 工作流回调体中「文本或地址」字段，兼容多种命名 */
function extractWorkflowPayload(candidate) {
  if (candidate == null) return null

  // 先处理对象形态（回调直接给对象）
  if (typeof candidate === 'object') {
    const outObj = candidate.Output ?? candidate.output
    if (outObj != null) {
      const fromOutput = extractWorkflowPayload(outObj)
      if (fromOutput != null && String(fromOutput) !== '') return fromOutput
    }
    if (candidate.data != null && String(candidate.data) !== '') return candidate.data
    if (candidate.content != null && String(candidate.content) !== '') return candidate.content
    return null
  }

  // 字符串形态：可能是纯 markdown，也可能是 JSON 字符串（甚至嵌套 JSON）
  const s = String(candidate)
  if (s.trim() === '') return null
  try {
    const parsed = JSON.parse(s)
    const fromParsed = extractWorkflowPayload(parsed)
    if (fromParsed != null && String(fromParsed) !== '') return fromParsed
  } catch {}
  return s
}

function pickWorkflowCallbackPayload(body) {
  if (!body || typeof body !== 'object') return null

  // 兼容 Coze 返回：{"node_status":"{}","Output":"{\"content_type\":1,\"data\":\"...\"}"}
  const fromTopOutput = extractWorkflowPayload(body.Output ?? body.output)
  if (fromTopOutput != null && String(fromTopOutput) !== '') return fromTopOutput

  const keys = [
    'content',
    'text',
    'result',
    'url',
    'path',
    'video_url',
    'videoUrl',
    'video_path',
    'videoPath',
    'address',
    'payload',
    'value'
  ]
  for (const k of keys) {
    const v = body[k]
    const extracted = extractWorkflowPayload(v)
    if (extracted != null && String(extracted) !== '') return extracted
  }
  const fromData = extractWorkflowPayload(body.data)
  if (fromData != null && String(fromData) !== '') {
    return fromData
  }
  return null
}

/** 回调结果：success 成功 / fail 失败；缺省按 success（兼容旧集成） */
function normalizeCallbackOutcome(body) {
  if (!body || typeof body !== 'object') return 'success'
  const raw = body.outcome ?? body.callback_outcome
  if (raw == null || String(raw).trim() === '') return 'success'
  const s = String(raw).trim().toLowerCase()
  if (s === 'success' || s === 'fail') return s
  return null
}

/** fail 时优先取错误说明字段 */
function pickCallbackErrorMessage(body) {
  if (!body || typeof body !== 'object') return null
  const keys = [
    'error',
    'message',
    'msg',
    'reason',
    'detail',
    'description',
    'last_error',
    'lastError',
    'error_message',
    'errorMessage'
  ]
  for (const k of keys) {
    const v = body[k]
    if (v != null && String(v) !== '') return String(v)
  }
  return null
}

/** 回调日志用大文本时只打长度 + 短前缀，避免 analysis 全文刷日志 */
function workflowCallbackPayloadLogSummary(payloadText, maxPreview = 160) {
  if (payloadText == null) return { len: 0, empty: true, preview: null }
  const s = String(payloadText)
  const len = s.length
  if (len === 0) return { len: 0, empty: true, preview: null }
  const preview = len <= maxPreview ? s : `${s.slice(0, maxPreview)}…`
  return { len, empty: false, preview }
}

function workflowCallbackClientMeta(req) {
  const forwarded = req.headers['x-forwarded-for']
  const xff = forwarded != null && String(forwarded).trim() ? String(forwarded).split(',')[0].trim() : ''
  const ip = xff || req.ip || (req.socket && req.socket.remoteAddress) || ''
  return { ip, userAgent: req.headers['user-agent'] != null ? String(req.headers['user-agent']).slice(0, 200) : '' }
}

/** 日志用：递归脱敏名为 secret 的字段（含 body / query 嵌套） */
function workflowCallbackRedactSecrets(value) {
  if (value == null) return value
  if (Array.isArray(value)) return value.map((x) => workflowCallbackRedactSecrets(x))
  if (typeof value !== 'object') return value
  const out = {}
  for (const k of Object.keys(value)) {
    const lk = String(k).toLowerCase()
    if (lk === 'secret') {
      const v = value[k]
      out[k] = v != null && String(v).trim() !== '' ? '***' : v
    } else {
      out[k] = workflowCallbackRedactSecrets(value[k])
    }
  }
  return out
}

/** 回调全文日志：headers 全量；Authorization / Cookie / 回调密钥头脱敏 */
function workflowCallbackHeadersForLog(req) {
  const h = req.headers || {}
  const out = {}
  for (const k of Object.keys(h)) {
    const lk = k.toLowerCase()
    if (
      lk === 'x-presales-video-callback-secret' ||
      lk === 'authorization' ||
      lk === 'cookie'
    ) {
      const v = h[k]
      out[k] = v != null && String(v).trim() !== '' ? '***' : h[k]
    } else {
      out[k] = h[k]
    }
  }
  return out
}

/** 供「回调全文」日志：与本次请求相关的全部可还原信息 */
function workflowCallbackFullSnapshot(req, reqMeta) {
  const query =
    req.query && typeof req.query === 'object'
      ? workflowCallbackRedactSecrets(Object.assign({}, req.query))
      : {}
  let bodySnap
  if (req.body && typeof req.body === 'object') {
    bodySnap = workflowCallbackRedactSecrets(req.body)
  } else if (req.body !== undefined) {
    bodySnap = req.body
  } else {
    bodySnap = null
  }
  return {
    ip: reqMeta.ip,
    method: req.method,
    originalUrl: req.originalUrl,
    query,
    headers: workflowCallbackHeadersForLog(req),
    body: bodySnap
  }
}

/**
 * POST /api/presales-video/workflow-callback
 * 工作流完成后回调：按 execute_id 更新 presales_video_tasks
 * Body: {
 *   type: 'analysis_content' | 'video_create',
 *   outcome?: 'success' | 'fail'（或 callback_outcome；缺省 success）,
 *   id 或 execute_id,
 *   success: 文本/路径 content|text|url|path|...
 *   fail: 建议 error|message|msg|reason|...，或与 success 相同字段携带说明
 *   video_create 成功时可选: playlist_url 或 playlistUrl → 落库 reserve_5（播放列表 / 切片地址）
 *   video_create 成功时可选: duration 或 video_duration（秒，数值）→ 落库 psv_video_info.duration
 * }
 */
router.post('/workflow-callback', async (req, res) => {
  const reqMeta = workflowCallbackClientMeta(req)
  try {
    const expectedSecret = process.env.PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET
    if (expectedSecret && String(expectedSecret).trim()) {
      const fromHeader = Boolean(req.headers['x-presales-video-callback-secret'])
      const fromQuery = req.query && req.query.secret != null && String(req.query.secret) !== ''
      const fromBody = req.body && req.body.secret != null && String(req.body.secret) !== ''
      const given =
        req.headers['x-presales-video-callback-secret'] ||
        req.query.secret ||
        (req.body && req.body.secret)
      if (String(given || '') !== String(expectedSecret).trim()) {
        logger.warn(
          `[presales-video] workflow-callback 鉴权失败 ip=${reqMeta.ip} secret来源 header=${fromHeader} query=${fromQuery} body=${fromBody}（不记录密钥内容）`
        )
        try {
          const snap = workflowCallbackFullSnapshot(req, reqMeta)
          logger.info(`回调全文-------------------====\n${JSON.stringify(snap, null, 2)}`)
        } catch (e) {
          logger.warn('[presales-video] workflow-callback 回调全文日志序列化失败:', e && e.message)
        }
        return res.status(401).json({ success: false, error: 'callback 鉴权失败' })
      }
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    try {
      const snap = workflowCallbackFullSnapshot(req, reqMeta)
      logger.info(`回调全文-------------------====\n${JSON.stringify(snap, null, 2)}`)
    } catch (e) {
      logger.warn('[presales-video] workflow-callback 回调全文日志序列化失败:', e && e.message)
    }

    const typeRaw = body.type || body.callback_type
    const executeId = body.id ?? body.execute_id ?? body.executeId
    const outcomeNorm = normalizeCallbackOutcome(body)
    if (outcomeNorm == null) {
      const rawOut = body.outcome ?? body.callback_outcome
      logger.warn(
        `[presales-video] workflow-callback 参数错误 outcome 非法 ip=${reqMeta.ip} raw=${JSON.stringify(rawOut)} type=${JSON.stringify(typeRaw)} execute_id_len=${executeId != null ? String(executeId).length : 0}`
      )
      return res.status(400).json({
        success: false,
        error: 'outcome 必须为 success 或 fail（可用 body.outcome 或 callback_outcome）'
      })
    }

    const payloadText =
      outcomeNorm === 'fail'
        ? pickCallbackErrorMessage(body) ?? pickWorkflowCallbackPayload(body)
        : pickWorkflowCallbackPayload(body)

    const playlistUrlRaw = body.playlist_url ?? body.playlistUrl
    const playlistUrl =
      playlistUrlRaw != null && String(playlistUrlRaw).trim() !== ''
        ? String(playlistUrlRaw).trim()
        : null

    const durationRaw = body.duration ?? body.video_duration
    const durationForPsv =
      durationRaw != null && String(durationRaw).trim() !== '' ? durationRaw : null

    if (typeRaw == null || String(typeRaw).trim() === '') {
      logger.warn(
        `[presales-video] workflow-callback 参数错误 缺少 type ip=${reqMeta.ip} outcome=${outcomeNorm} execute_id=${executeId != null ? String(executeId).slice(0, 80) : '(空)'}`
      )
      return res.status(400).json({ success: false, error: '缺少 type（analysis_content / video_create）' })
    }
    if (executeId == null || String(executeId).trim() === '') {
      logger.warn(
        `[presales-video] workflow-callback 参数错误 缺少 execute_id ip=${reqMeta.ip} type=${String(typeRaw).trim()} outcome=${outcomeNorm}`
      )
      return res.status(400).json({ success: false, error: '缺少 id（execute_id）' })
    }

    const typeNorm = String(typeRaw).trim()
    const execStr = String(executeId).trim()
    const paySum = workflowCallbackPayloadLogSummary(payloadText)
    const playlistSum = workflowCallbackPayloadLogSummary(playlistUrl, 120)
    logger.info(
      `[presales-video] workflow-callback 收到 ip=${reqMeta.ip} ua=${JSON.stringify((reqMeta.userAgent || '').slice(0, 120))} type=${typeNorm} outcome=${outcomeNorm} execute_id_len=${execStr.length} execute_id_head=${JSON.stringify(execStr.slice(0, 64))} payload_len=${paySum.len} payload_empty=${paySum.empty} payload_preview=${paySum.preview != null ? JSON.stringify(paySum.preview) : 'null'} playlist_url_present=${Boolean(playlistUrl)} playlist_url_len=${playlistSum.len} duration_present=${durationForPsv != null}`
    )

    const result = await presalesVideoTaskService.applyWorkflowCallback(
      typeNorm,
      executeId,
      payloadText,
      outcomeNorm,
      { playlistUrl, duration: durationForPsv }
    )

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400
      logger.warn(
        `[presales-video] workflow-callback 业务未受理 http=${status} code=${result.code} msg=${result.message} type=${typeNorm} outcome=${outcomeNorm} execute_id_head=${JSON.stringify(execStr.slice(0, 64))}`
      )
      return res.status(status).json({
        success: false,
        error: result.message,
        code: result.code
      })
    }

    if (result.truncated) {
      logger.warn('[presales-video] workflow-callback video_address 超过 2000 字符已截断')
    }

    const task = result.task
    const tid = task && task.transcription_id ? String(task.transcription_id) : ''
    const ps = task && task.pipeline_status != null ? String(task.pipeline_status) : ''
    if (typeNorm === 'analysis_content' && outcomeNorm === 'success') {
      const acLen = task && task.analysis_content != null ? String(task.analysis_content).length : 0
      const r3 = task && task.reserve_3 != null ? String(task.reserve_3) : ''
      logger.info(
        `[presales-video] workflow-callback 已落库 analysis_content success transcription_id=${tid} pipeline_status=${JSON.stringify(ps)} analysis_content_len=${acLen} reserve_3_len=${r3.length} md_path=${result.analysisMarkdownPath != null ? JSON.stringify(String(result.analysisMarkdownPath)) : 'null'} md_write_error=${result.analysisMarkdownWriteError != null ? JSON.stringify(String(result.analysisMarkdownWriteError)) : 'null'}`
      )
    } else if (typeNorm === 'analysis_content' && outcomeNorm === 'fail') {
      const le = task && task.last_error != null ? String(task.last_error) : ''
      logger.info(
        `[presales-video] workflow-callback 已落库 analysis_content fail transcription_id=${tid} pipeline_status=${JSON.stringify(ps)} last_error=${JSON.stringify(le.slice(0, 500))}`
      )
    } else if (typeNorm === 'video_create' && outcomeNorm === 'success') {
      const va = task && task.video_address != null ? String(task.video_address) : ''
      const r5 = task && task.reserve_5 != null ? String(task.reserve_5) : ''
      logger.info(
        `[presales-video] workflow-callback 已落库 video_create success transcription_id=${tid} pipeline_status=${JSON.stringify(ps)} video_address_len=${va.length} video_address_head=${JSON.stringify(va.slice(0, 120))} reserve_5_written=${Boolean(playlistUrl)} reserve_5_len=${r5.length} reserve_5_head=${r5 ? JSON.stringify(r5.slice(0, 120)) : 'null'}`
      )
    } else if (typeNorm === 'video_create' && outcomeNorm === 'fail') {
      const le = task && task.last_error != null ? String(task.last_error) : ''
      logger.info(
        `[presales-video] workflow-callback 已落库 video_create fail transcription_id=${tid} pipeline_status=${JSON.stringify(ps)} last_error=${JSON.stringify(le.slice(0, 500))}`
      )
    } else {
      logger.info(
        `[presales-video] workflow-callback 已落库 type=${typeNorm} outcome=${outcomeNorm} transcription_id=${tid} pipeline_status=${JSON.stringify(ps)}`
      )
    }

    if (result.task && result.task.transcription_id) {
      const tidCb = String(result.task.transcription_id)
      setImmediate(() => {
        presalesVideoPipelineOrchestrator.notifyTranscriptionUpdated(tidCb).catch((e) => {
          logger.warn('[presales-video] pipeline notify (workflow-callback):', e.message || e)
        })
      })
    }

    const dataOut = {
      videoTask: presalesVideoTaskService.toApiShape(result.task)
    }
    if (result.analysisMarkdownPath) {
      dataOut.analysisMarkdownPath = result.analysisMarkdownPath
    }
    if (result.analysisMarkdownWriteError) {
      dataOut.analysisMarkdownWriteError = result.analysisMarkdownWriteError
    }

    return res.json({
      success: true,
      data: dataOut
    })
  } catch (error) {
    logger.error(
      `[presales-video] workflow-callback 异常 ip=${reqMeta.ip} message=${error && error.message}`,
      error
    )
    return res.status(500).json({ success: false, error: error.message || '回调处理失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions
 * 仅列出转录状态为 completed（已完成）的记录，不含待处理/上传中/转录中/失败等。
 * Query: page, pageSize, name, dateFrom, dateTo, pipelineStatus
 * pipelineStatus: 空或 all=不限；__none__=无 presales_video_tasks；其它值=流水线状态精确匹配（如 分析中）
 */
router.get('/transcriptions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))
    const skip = (page - 1) * pageSize
    const nameKw = req.query.name != null ? String(req.query.name).trim() : ''

    const dateFromRaw = req.query.dateFrom != null ? String(req.query.dateFrom).trim() : ''
    const dateToRaw = req.query.dateTo != null ? String(req.query.dateTo).trim() : ''
    const fromD = dateFromRaw ? parseListDateFrom(dateFromRaw) : null
    const toD = dateToRaw ? parseListDateTo(dateToRaw) : null
    if (dateFromRaw && !fromD) {
      return res.status(400).json({ success: false, error: 'dateFrom 须为 YYYY-MM-DD' })
    }
    if (dateToRaw && !toD) {
      return res.status(400).json({ success: false, error: 'dateTo 须为 YYYY-MM-DD' })
    }
    if (fromD && toD && fromD > toD) {
      return res.status(400).json({ success: false, error: '开始日期不能晚于结束日期' })
    }

    const nameWhere =
      nameKw.length > 0
        ? {
            OR: [
              { name: { contains: nameKw } },
              { original_file_name: { contains: nameKw } },
              { customer_name: { contains: nameKw } }
            ]
          }
        : {}

    const createdAtFilter = {}
    if (fromD) createdAtFilter.gte = fromD
    if (toD) createdAtFilter.lte = toD

    const pipelineRaw =
      req.query.pipelineStatus != null ? String(req.query.pipelineStatus).trim() : ''
    let taskWhere = null
    if (pipelineRaw && pipelineRaw !== 'all') {
      if (pipelineRaw === '__none__') {
        taskWhere = { presales_video_tasks: { is: null } }
      } else {
        taskWhere = {
          presales_video_tasks: { is: { pipeline_status: pipelineRaw } }
        }
      }
    }

    const whereParts = [{ status: 'completed' }]
    if (Object.keys(nameWhere).length > 0) whereParts.push(nameWhere)
    if (Object.keys(createdAtFilter).length > 0) {
      whereParts.push({ created_at: createdAtFilter })
    }
    if (taskWhere) whereParts.push(taskWhere)
    const where = whereParts.length === 1 ? whereParts[0] : { AND: whereParts }

    const total = await prisma.transcriptions.count({ where })

    const list = await prisma.transcriptions.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip,
      take: pageSize,
      include: {
        presales_analysis_results: {
          where: { status: 'completed' },
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    })

    const pageIds = list.map((t) => t.id)

    let taskByTid = new Map()
    try {
      const tasks = await prisma.presales_video_tasks.findMany({
        where: { transcription_id: { in: pageIds } }
      })
      taskByTid = new Map(tasks.map((tk) => [tk.transcription_id, tk]))
    } catch (e) {
      logger.warn('[presales-video] 列表关联主任务失败（表是否已建？）:', e.message)
    }

    /** psv_video_info.id 与 presales_video_tasks.execute_id 对应 */
    let psvByExecuteId = new Map()
    try {
      const execIds = [...taskByTid.values()]
        .map((tk) => (tk && tk.execute_id ? String(tk.execute_id).trim() : ''))
        .filter(Boolean)
      const uniqueExec = [...new Set(execIds)]
      if (uniqueExec.length) {
        const psvRows = await prisma.psv_video_info.findMany({
          where: { id: { in: uniqueExec } }
        })
        psvByExecuteId = new Map(psvRows.map((r) => [r.id, r]))
      }
    } catch (e) {
      logger.warn('[presales-video] 列表关联 psv_video_info 失败:', e.message)
    }

    const listOut = list.map((t) => {
      const taskRow = taskByTid.get(t.id)
      const baseVt = presalesVideoTaskService.toApiShape(taskRow)
      let videoTask = baseVt
      if (baseVt && baseVt.executeId) {
        const psv = psvByExecuteId.get(String(baseVt.executeId).trim())
        if (psv && psv.id) {
          const playUrl = buildPsvWecomAdminPlayUrl(psv.id)
          if (playUrl) {
            videoTask = {
              ...baseVt,
              psvVideoInfoUrl: playUrl,
              psvVideoInfoTitle: psv.title != null ? String(psv.title) : null
            }
          }
        }
      }
      return {
        id: t.id,
        name: t.name,
        originalFileName: t.original_file_name,
        customerName: t.customer_name,
        /** 音频时长（秒），库字段 audio_duration */
        audioDuration: t.audio_duration != null ? Number(t.audio_duration) : null,
        createdBy: t.created_by != null && String(t.created_by).trim() ? String(t.created_by).trim() : null,
        createdAt: t.created_at,
        hasPresalesReport: (t.presales_analysis_results && t.presales_analysis_results.length > 0) || false,
        videoTask
      }
    })

    res.json({
      success: true,
      data: {
        list: listOut,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
        nameQuery: nameKw,
        dateFrom: dateFromRaw || '',
        dateTo: dateToRaw || '',
        pipelineStatus: pipelineRaw || 'all'
      }
    })
  } catch (error) {
    logger.error('[presales-video] 列表失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取列表失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/psv-video-info
 * 读取 psv_video_info（主键 id = presales_video_tasks.execute_id），供推送视频弹窗展示播放 URL。
 * 返回的 url 为企微 H5 播放页（buildPsvWecomAdminPlayUrl），不再使用库字段 psv_video_info.url。
 */
router.get('/transcriptions/:id/psv-video-info', async (req, res) => {
  try {
    const { id } = req.params
    const task = await presalesVideoTaskService.getByTranscriptionId(id)
    if (!task || !task.execute_id || !String(task.execute_id).trim()) {
      return res.json({
        success: true,
        data: {
          url: null,
          title: null,
          psvId: null,
          executeId: null,
          message: '无主任务记录或尚无 execute_id（请先提交工作流并等待回调）'
        }
      })
    }
    const execId = String(task.execute_id).trim()
    const row = await prisma.psv_video_info.findUnique({ where: { id: execId } })
    if (!row) {
      return res.json({
        success: true,
        data: {
          url: null,
          title: null,
          psvId: null,
          executeId: execId,
          message: '未找到 psv_video_info（可能尚未 video_create 回调写入）'
        }
      })
    }
    const psvPk = row.id != null ? String(row.id).trim() : ''
    const playUrl = psvPk ? buildPsvWecomAdminPlayUrl(psvPk) : null
    res.json({
      success: true,
      data: {
        url: playUrl,
        title: row.title != null ? String(row.title) : null,
        psvId: psvPk || null,
        executeId: execId
      }
    })
  } catch (error) {
    logger.error('[presales-video] psv-video-info 失败:', error)
    res.status(500).json({ success: false, error: error.message || '读取失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/push-dialogue-preview
 * 仅生成与「推送对话」相同的合并 txt 内容供前端预览/下载，不落盘、不上传。
 */
router.get('/transcriptions/:id/push-dialogue-preview', async (req, res) => {
  try {
    const { id } = req.params
    const resolved = await mergedDialogueService.resolveMergedDialoguesForTranscription(id)
    if (!resolved || !resolved.dialogues.length) {
      return res.status(404).json({
        success: false,
        error: '未找到可用的合并/转写对话内容'
      })
    }
    const { transcription, dialogues, source } = resolved
    const displayName =
      transcription.original_file_name || transcription.name || `transcription_${id}`
    const fileName = mergedDialogueService.buildSafeTxtFilename(displayName)
    const txt = mergedDialogueService.buildMergedDialogueTxt(transcription, dialogues)
    const speakers = mergedDialogueService.uniqueSpeakers(dialogues)
    res.json({
      success: true,
      data: {
        txt,
        txtFileName: fileName,
        dialogueSource: source,
        speakers
      }
    })
  } catch (error) {
    logger.error('[presales-video] 推送对话预览失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取预览失败' })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/push-dialogue
 * 始终先合并对话并写入本地 txt，再尝试 Coze file-upload（可配置 URL；连不上时本地文件已存在）。
 */
router.post('/transcriptions/:id/push-dialogue', async (req, res) => {
  const { id } = req.params
  let absPath = null
  let fileName = null
  let source = null
  let speakers = null

  try {
    const uploadUrlRaw = process.env.PRESALES_VIDEO_COZE_FILE_UPLOAD_URL
    const uploadUrl = uploadUrlRaw && String(uploadUrlRaw).trim() ? String(uploadUrlRaw).trim() : ''

    const localDir = process.env.PRESALES_VIDEO_DIALOGUE_LOCAL_DIR
      ? process.env.PRESALES_VIDEO_DIALOGUE_LOCAL_DIR
      : path.join(__dirname, '../../uploads_data/presales_video_dialogue')

    const resolved = await mergedDialogueService.resolveMergedDialoguesForTranscription(id)
    if (!resolved || !resolved.dialogues.length) {
      return res.status(404).json({
        success: false,
        error: '未找到可用的合并/转写对话内容'
      })
    }

    const { transcription, dialogues, source: src } = resolved
    source = src
    const displayName =
      transcription.original_file_name ||
      transcription.name ||
      `transcription_${id}`
    fileName = mergedDialogueService.buildSafeTxtFilename(displayName)
    const txt = mergedDialogueService.buildMergedDialogueTxt(transcription, dialogues)
    speakers = mergedDialogueService.uniqueSpeakers(dialogues)

    absPath = await mergedDialogueService.writeDialogueFile(localDir, fileName, txt)
    logger.info(
      `[presales-video] 推送对话 本地 txt 已写入 transcription=${id} path=${absPath} dialogueSource=${source}`
    )

    try {
      await presalesVideoTaskService.saveAfterLocalTxt(id, { localPath: absPath, lastError: null })
    } catch (dbErr) {
      logger.error('[presales-video] presales_video_tasks 落库失败(本地txt):', dbErr)
    }

    const baseData = {
      localPath: absPath,
      txtFileName: fileName,
      dialogueSource: source,
      speakers
    }

    if (!uploadUrl) {
      logger.warn('[presales-video] 未配置 PRESALES_VIDEO_COZE_FILE_UPLOAD_URL，已仅保存本地 txt')
      return res.json({
        success: true,
        data: {
          ...baseData,
          uploadSkipped: true,
          uploadMessage: '未配置 PRESALES_VIDEO_COZE_FILE_UPLOAD_URL，已跳过上传',
          videoTask: await getVideoTaskShape(id)
        }
      })
    }

    let uploadRes
    try {
      const auth = cozeAuthHeaders()
      const form = new FormData()
      form.append('file', fs.createReadStream(absPath), { filename: fileName })
      uploadRes = await httpRequestFormWithHeaders(uploadUrl, form, auth)
    } catch (netErr) {
      logger.error('[presales-video] Coze 上传网络/连接异常:', netErr)
      const errMsg = String(netErr.message || netErr).slice(0, 1900)
      try {
        await presalesVideoTaskService.saveAfterLocalTxt(id, { localPath: absPath, lastError: errMsg })
      } catch (dbErr) {
        logger.error('[presales-video] 主任务表写入失败:', dbErr)
      }
      return res.status(502).json({
        success: false,
        error: `上传请求失败（本地 txt 已保存）：${netErr.message || String(netErr)}`,
        data: {
          ...baseData,
          step: 'file-upload',
          networkError: netErr.message || String(netErr),
          videoTask: await getVideoTaskShape(id)
        }
      })
    }

    let uploadParsed = null
    try {
      uploadParsed = JSON.parse(uploadRes.body)
    } catch {
      uploadParsed = null
    }

    logger.info(`[presales-video] ===== 推送对话(文件上传) transcription=${id} =====`)
    logger.info(`[presales-video] file-upload URL: ${uploadUrl}`)
    logResponseBody('[presales-video] Coze file-upload 响应原文: ', uploadRes.body)
    logger.info(
      `[presales-video] Coze file-upload HTTP ${uploadRes.status} 解析 JSON: ${JSON.stringify(uploadParsed)}`
    )

    if (uploadRes.status < 200 || uploadRes.status >= 300) {
      logger.warn(`[presales-video] Coze 上传失败 transcription=${id} http=${uploadRes.status}`)
      try {
        await presalesVideoTaskService.saveAfterLocalTxt(id, {
          localPath: absPath,
          lastError: `上传HTTP ${uploadRes.status}`.slice(0, 1900)
        })
      } catch (dbErr) {
        logger.error('[presales-video] 主任务表写入失败:', dbErr)
      }
      return res.status(502).json({
        success: false,
        error: `文件上传失败（HTTP ${uploadRes.status}），本地 txt 已保存`,
        data: {
          ...baseData,
          step: 'file-upload',
          remoteStatus: uploadRes.status,
          remoteBody: uploadRes.body.length > 6000 ? uploadRes.body.slice(0, 6000) + '…' : uploadRes.body,
          videoTask: await getVideoTaskShape(id)
        }
      })
    }

    let { fileId, fileName: cozeFileName } = parseCozeFileUploadResponse(uploadParsed)
    logger.info(
      `[presales-video] Coze file-upload 提取 fileId=${fileId} cozeFileName=${cozeFileName}`
    )

    if (!fileId) {
      logger.warn(`[presales-video] Coze 上传响应无 file_id transcription=${id} body=${uploadRes.body.slice(0, 500)}`)
      try {
        await presalesVideoTaskService.saveAfterLocalTxt(id, {
          localPath: absPath,
          lastError: 'HTTP成功但未解析到 file_id'
        })
      } catch (dbErr) {
        logger.error('[presales-video] 主任务表写入失败:', dbErr)
      }
      return res.status(502).json({
        success: false,
        error: '已收到 HTTP 成功但未解析到 file_id（本地 txt 已保存），请检查接口返回 JSON',
        data: {
          ...baseData,
          step: 'file-upload',
          uploadParsed,
          remoteBody: uploadRes.body.length > 6000 ? uploadRes.body.slice(0, 6000) + '…' : uploadRes.body,
          videoTask: await getVideoTaskShape(id)
        }
      })
    }
    if (!cozeFileName) {
      cozeFileName = fileName
      logger.info(`[presales-video] Coze 未返回 file_name，沿用本地 txt 名: ${fileName}`)
    }

    logger.info(
      `[presales-video] 推送对话(上传成功) transcription=${id} fileId=${fileId} cozeFileName=${cozeFileName}`
    )

    try {
      await presalesVideoTaskService.saveAfterCozeUpload(id, {
        cozeFileId: fileId,
        cozeFileName,
        localPath: absPath,
        lastError: null
      })
    } catch (dbErr) {
      logger.error('[presales-video] presales_video_tasks 落库失败(Coze上传成功):', dbErr)
    }

    res.json({
      success: true,
      data: {
        ...baseData,
        cozeFileId: fileId,
        cozeFileName,
        uploadStatus: uploadRes.status,
        uploadParsed,
        uploadRawBody:
          uploadRes.body.length > 8000 ? uploadRes.body.slice(0, 8000) + '…' : uploadRes.body,
        videoTask: await getVideoTaskShape(id)
      }
    })
  } catch (error) {
    logger.error('[presales-video] 推送对话失败:', error)
    if (absPath) {
      try {
        await presalesVideoTaskService.saveAfterLocalTxt(id, {
          localPath: absPath,
          lastError: String(error.message || error).slice(0, 1900)
        })
      } catch (dbErr) {
        logger.error('[presales-video] 主任务表写入失败:', dbErr)
      }
    }
    res.status(500).json({
      success: false,
      error: error.message || '推送对话失败',
      data:
        absPath != null
          ? {
              localPath: absPath,
              txtFileName: fileName,
              dialogueSource: source,
              speakers,
              partialSave: true,
              videoTask: await getVideoTaskShape(id)
            }
          : undefined
    })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/submit-workflow
 * Coze：Body 可选 { fileId, fileName }；缺省时从 presales_video_tasks 读取。转发 Coze 的 JSON 含 fileId、fileName、meetingName，三者均经 stripWorkflowCozeParam（无路径、无常见后缀）。
 * 通用：PRESALES_VIDEO_WORKFLOW_SUBMIT_URL。
 */
router.post('/transcriptions/:id/submit-workflow', async (req, res) => {
  try {
    const { id } = req.params
    const cozeAnalysisUrl = process.env.PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL

    if (cozeAnalysisUrl && String(cozeAnalysisUrl).trim()) {
      let taskRow = null
      try {
        taskRow = await presalesVideoTaskService.getByTranscriptionId(id)
      } catch (e) {
        logger.warn('[presales-video] 读取 presales_video_tasks:', e.message)
      }

      let fileId = req.body?.fileId ?? req.body?.file_id ?? taskRow?.coze_file_id
      let fileName = req.body?.fileName ?? req.body?.file_name ?? taskRow?.coze_file_name

      if (!fileId || !String(fileId).trim()) {
        return res.status(400).json({
          success: false,
          error:
            '缺少 fileId：请先「推送对话」完成 Coze 上传（已写入 presales_video_tasks），或在请求体传入 fileId',
          data: { videoTask: await getVideoTaskShape(id) }
        })
      }
      if (!fileName || !String(fileName).trim()) {
        return res.status(400).json({
          success: false,
          error: '缺少 fileName：请先完成推送上传或在请求体传入 fileName',
          data: { videoTask: await getVideoTaskShape(id) }
        })
      }

      fileName = String(fileName).trim()

      let meetingName = fileName
      try {
        const trCoze = await prisma.transcriptions.findUnique({
          where: { id },
          select: { original_file_name: true, name: true }
        })
        const fromOriginal =
          trCoze?.original_file_name != null ? String(trCoze.original_file_name).trim() : ''
        const fromName = trCoze?.name != null ? String(trCoze.name).trim() : ''
        if (fromOriginal) meetingName = fromOriginal
        else if (fromName) meetingName = fromName
      } catch (e) {
        logger.warn('[presales-video] 读取转录文件名用于 meetingName:', e.message)
      }

      const meetingPayload = {
        fileId: mergedDialogueService.stripWorkflowCozeParam(String(fileId).trim()),
        fileName: mergedDialogueService.stripWorkflowCozeParam(fileName),
        meetingName: mergedDialogueService.stripWorkflowCozeParam(meetingName)
      }

      const auth = cozeAuthHeaders()
      logger.info(`[presales-video] ===== 提交工作流(Coze meeting-analysis) transcription=${id} =====`)
      logger.info(`[presales-video] meeting-analysis URL: ${cozeAnalysisUrl.trim()}`)
      logger.info(`[presales-video] 请求体: ${JSON.stringify(meetingPayload)}`)

      let analysisRes
      try {
        analysisRes = await httpRequestJson(
          'POST',
          cozeAnalysisUrl.trim(),
          meetingPayload,
          auth
        )
      } catch (netErr) {
        const msg = (netErr && netErr.message) || String(netErr)
        logger.error(`[presales-video] Coze meeting-analysis 网络错误 transcription=${id}:`, msg)
        try {
          await presalesVideoTaskService.saveAfterSubmitWorkflow(id, {
            lastError: `会议分析请求失败: ${msg}`.slice(0, 1900)
          })
        } catch (dbErr) {
          logger.error('[presales-video] 主任务表写入失败:', dbErr)
        }
        return res.status(502).json({
          success: false,
          error: `会议分析网络错误: ${msg}`,
          data: {
            step: 'meeting-analysis',
            videoTask: await getVideoTaskShape(id)
          }
        })
      }

      let analysisParsed = null
      try {
        analysisParsed = JSON.parse(analysisRes.body)
      } catch {
        analysisParsed = null
      }

      logResponseBody('[presales-video] Coze meeting-analysis 响应原文: ', analysisRes.body)
      logger.info(
        `[presales-video] Coze meeting-analysis HTTP ${analysisRes.status} 解析 JSON: ${JSON.stringify(analysisParsed)}`
      )

      const executeId = parseCozeExecuteId(analysisParsed)
      logger.info(`[presales-video] Coze meeting-analysis 提取 executeId=${executeId}`)

      if (analysisRes.status < 200 || analysisRes.status >= 300) {
        logger.warn(`[presales-video] Coze 会议分析失败 transcription=${id} http=${analysisRes.status}`)
        const errBrief = `会议分析 HTTP ${analysisRes.status}`.slice(0, 1900)
        try {
          await presalesVideoTaskService.saveAfterSubmitWorkflow(id, { lastError: errBrief })
        } catch (dbErr) {
          logger.error('[presales-video] 主任务表写入失败:', dbErr)
        }
        return res.status(502).json({
          success: false,
          error: `提交会议分析失败（HTTP ${analysisRes.status}）`,
          data: {
            step: 'meeting-analysis',
            meetingPayload,
            remoteStatus: analysisRes.status,
            remoteBody:
              analysisRes.body.length > 8000
                ? analysisRes.body.slice(0, 8000) + '…'
                : analysisRes.body,
            analysisParsed,
            videoTask: await getVideoTaskShape(id)
          }
        })
      }

      if (!executeId) {
        logger.warn(`[presales-video] 会议分析响应无 execute_id transcription=${id}`)
        try {
          await presalesVideoTaskService.saveAfterSubmitWorkflow(id, {
            lastError: 'HTTP成功但未解析到 execute_id'
          })
        } catch (dbErr) {
          logger.error('[presales-video] 主任务表写入失败:', dbErr)
        }
        return res.status(502).json({
          success: false,
          error: '会议分析成功但未解析到 execute_id，请检查返回 JSON',
          data: {
            step: 'meeting-analysis',
            meetingPayload,
            analysisParsed,
            remoteBody:
              analysisRes.body.length > 8000
                ? analysisRes.body.slice(0, 8000) + '…'
                : analysisRes.body,
            videoTask: await getVideoTaskShape(id)
          }
        })
      }

      logger.info(
        `[presales-video] 提交工作流(Coze)成功 transcription=${id} executeId=${executeId}`
      )

      try {
        await presalesVideoTaskService.saveAfterSubmitWorkflow(id, {
          executeId,
          lastError: null
        })
      } catch (dbErr) {
        logger.error('[presales-video] presales_video_tasks 落库失败(execute_id):', dbErr)
      }

      return res.json({
        success: true,
        data: {
          mode: 'coze_meeting_analysis',
          executeId,
          meetingPayload,
          analysisStatus: analysisRes.status,
          analysisParsed,
          analysisRawBody:
            analysisRes.body.length > 8000
              ? analysisRes.body.slice(0, 8000) + '…'
              : analysisRes.body,
          videoTask: await getVideoTaskShape(id)
        }
      })
    }

    const submitUrl = process.env.PRESALES_VIDEO_WORKFLOW_SUBMIT_URL
    if (!submitUrl || !String(submitUrl).trim()) {
      return res.status(400).json({
        success: false,
        error:
          '请配置 PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL（Coze 会议分析）或 PRESALES_VIDEO_WORKFLOW_SUBMIT_URL（通用工作流）'
      })
    }

    const resolved = await mergedDialogueService.resolveMergedDialoguesForTranscription(id)
    if (!resolved || !resolved.dialogues.length) {
      return res.status(404).json({
        success: false,
        error: '未找到可用的合并/转写对话内容'
      })
    }

    const { transcription, dialogues, source } = resolved
    const displayName =
      transcription.original_file_name ||
      transcription.name ||
      `transcription_${id}`

    const speakers = mergedDialogueService.uniqueSpeakers(dialogues)

    const reportRow = await prisma.presales_analysis_results.findFirst({
      where: { transcription_id: id, status: 'completed' },
      select: { id: true }
    })

    const payload = {
      transcriptionId: id,
      fileName: displayName,
      speakers,
      dialogueSource: source,
      dialogueCount: dialogues.length,
      customerName: transcription.customer_name || null,
      createdAt: transcription.created_at,
      hasPresalesReport: !!reportRow
    }

    const extraHeaders = {}
    const token = process.env.PRESALES_VIDEO_WORKFLOW_SUBMIT_TOKEN
    if (token && String(token).trim()) {
      extraHeaders.Authorization = `Bearer ${token.trim()}`
    }

    logger.info(`[presales-video] ===== 提交工作流(通用) transcription=${id} =====`)
    logger.info(`[presales-video] 通用工作流 URL: ${submitUrl.trim()}`)
    logger.info(`[presales-video] 请求体: ${JSON.stringify(payload)}`)

    const remote = await httpRequestJson('POST', submitUrl.trim(), payload, extraHeaders)

    let remoteJson = null
    try {
      remoteJson = JSON.parse(remote.body)
    } catch {
      // 非 JSON
    }

    logResponseBody('[presales-video] 通用工作流 响应原文: ', remote.body)
    logger.info(
      `[presales-video] 通用工作流 HTTP ${remote.status} 解析 JSON: ${JSON.stringify(remoteJson)}`
    )

    const ok = remote.status >= 200 && remote.status < 300
    try {
      if (ok) {
        await presalesVideoTaskService.saveAfterSubmitWorkflow(id, { lastError: null })
      } else {
        await presalesVideoTaskService.saveAfterSubmitWorkflow(id, {
          lastError: `通用工作流 HTTP ${remote.status}`.slice(0, 1900)
        })
      }
    } catch (dbErr) {
      logger.error('[presales-video] 通用工作流主任务落库失败:', dbErr)
    }

    res.json({
      success: ok,
      data: {
        mode: 'generic_workflow',
        requestPayload: payload,
        remoteStatus: remote.status,
        remoteBody: remote.body.length > 8000 ? remote.body.slice(0, 8000) + '…' : remote.body,
        remoteJson,
        videoTask: await getVideoTaskShape(id)
      }
    })
  } catch (error) {
    logger.error('[presales-video] 提交工作流失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '提交工作流失败',
      data: { videoTask: await getVideoTaskShape(req.params.id) }
    })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/report
 * 若配置了 PRESALES_VIDEO_REPORT_FETCH_URL 则转发 GET；否则返回本地售前分析结果
 */
router.get('/transcriptions/:id/report', async (req, res) => {
  try {
    const { id } = req.params
    const fetchUrl = process.env.PRESALES_VIDEO_REPORT_FETCH_URL

    if (fetchUrl && String(fetchUrl).trim()) {
      const url = appendQuery(fetchUrl.trim(), id)
      const remote = await httpRequestGet(url)
      res.status(remote.status >= 200 && remote.status < 300 ? 200 : remote.status).json({
        success: remote.status >= 200 && remote.status < 300,
        data: {
          source: 'remote',
          status: remote.status,
          contentType: remote.headers['content-type'],
          body: remote.body.toString('utf8')
        }
      })
      return
    }

    const local = await presalesAnalysisService.getAnalysisResult(id)
    if (!local) {
      return res.status(404).json({
        success: false,
        error: '本地无售前分析结果，请先在「售前交流综合分析」中分析，或配置 PRESALES_VIDEO_REPORT_FETCH_URL'
      })
    }

    res.json({
      success: true,
      data: {
        source: 'local',
        ...local
      }
    })
  } catch (error) {
    logger.error('[presales-video] 获取报告失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取报告失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/analysis-for-push
 * 推送报告前编辑用：返回分析正文（优先 md 文件，否则库中 analysis_content）
 */
router.get('/transcriptions/:id/analysis-for-push', async (req, res) => {
  try {
    const { id } = req.params
    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    if (!tr) {
      return res.status(404).json({ success: false, error: '转录不存在' })
    }
    const r = await presalesVideoTaskService.readAnalysisForPushEdit(id)
    if (!r.ok) {
      const code = r.code || 'ERR'
      const status =
        code === 'NO_TASK' ? 404 : code === 'EMPTY' ? 400 : code === 'READ_ERR' ? 500 : 400
      return res.status(status).json({ success: false, error: r.message, code })
    }
    res.json({
      success: true,
      data: {
        content: r.content,
        readFromFile: r.readFromFile,
        reserve3: r.reserve3
      }
    })
  } catch (error) {
    logger.error('[presales-video] 读取推送用分析正文失败:', error)
    res.status(500).json({ success: false, error: error.message || '读取失败' })
  }
})

/**
 * PUT /api/presales-video/transcriptions/:id/analysis-for-push
 * Body: { content: string } — 落盘 md（与回调同目录规则）并更新 presales_video_tasks.analysis_content / reserve_3
 */
router.put('/transcriptions/:id/analysis-for-push', async (req, res) => {
  try {
    const { id } = req.params
    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    if (!tr) {
      return res.status(404).json({ success: false, error: '转录不存在' })
    }
    const body = req.body || {}
    const content = body.content != null ? String(body.content) : ''
    const r = await presalesVideoTaskService.saveAnalysisForPushEdit(id, content)
    if (!r.ok) {
      const code = r.code || 'ERR'
      const status =
        code === 'NO_TASK' ? 404 : code === 'EMPTY' ? 400 : code === 'WRITE_FAIL' ? 500 : 400
      return res.status(status).json({ success: false, error: r.message, code })
    }
    res.json({
      success: true,
      data: {
        reserve3: r.reserve3,
        videoTask: await getVideoTaskShape(id)
      }
    })
  } catch (error) {
    logger.error('[presales-video] 保存推送用分析正文失败:', error)
    res.status(500).json({ success: false, error: error.message || '保存失败' })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/push-report
 * 优先：PRESALES_VIDEO_REPORT_ASYNC_URL — POST 异步任务 { name, execute_id, filePaths, prompt }（prompt 默认见代码常量，可被 body.prompt 或 env 覆盖）
 * 否则：PRESALES_VIDEO_REPORT_PUSH_URL — 旧版 POST 本地售前分析 JSON
 */
router.post('/transcriptions/:id/push-report', async (req, res) => {
  try {
    const { id } = req.params
    const asyncUrlRaw = process.env.PRESALES_VIDEO_REPORT_ASYNC_URL
    if (asyncUrlRaw && String(asyncUrlRaw).trim()) {
      let taskRow = null
      try {
        taskRow = await presalesVideoTaskService.getByTranscriptionId(id)
      } catch (e) {
        logger.warn('[presales-video] push-report 读取 presales_video_tasks:', e.message)
      }

      const filePaths = taskRow?.reserve_3 != null ? String(taskRow.reserve_3).trim() : ''
      const executeId = taskRow?.execute_id != null ? String(taskRow.execute_id).trim() : ''

      if (!filePaths) {
        return res.status(400).json({
          success: false,
          error:
            '缺少 md 路径（reserve_3）：请先完成 analysis_content 回调并成功落盘 .md，或确认库中 reserve_3 已写入'
        })
      }
      if (!executeId) {
        return res.status(400).json({
          success: false,
          error: '缺少 execute_id：请先「提交工作流」并确保 presales_video_tasks.execute_id 已落库'
        })
      }

      const tr = await prisma.transcriptions.findUnique({ where: { id } })
      if (!tr) {
        return res.status(404).json({ success: false, error: '转录不存在' })
      }

      const durationSec =
        tr.audio_duration != null ? Number(tr.audio_duration) : NaN
      const durationOk = !Number.isNaN(durationSec) && durationSec >= 0
      const subtitleUrlRaw = process.env.PRESALES_VIDEO_SUBTITLE_VIDEO_ASYNC_URL
      const subtitleUrl =
        subtitleUrlRaw && String(subtitleUrlRaw).trim()
          ? String(subtitleUrlRaw).trim()
          : ''
      const localTxt =
        taskRow?.local_dialogue_txt_path != null
          ? String(taskRow.local_dialogue_txt_path).trim()
          : ''
      const audioPath =
        tr.audio_file_path != null ? String(tr.audio_file_path).trim() : ''

      const splitSec = getReportDurationSplitSec()

      const useSubtitleVideo =
        durationOk &&
        durationSec < splitSec &&
        Boolean(subtitleUrl) &&
        Boolean(localTxt) &&
        Boolean(audioPath)

      if (durationOk && durationSec < splitSec && !useSubtitleVideo) {
        logger.warn(
          `[presales-video] push-report 短音频(${durationSec}s)但走原 report async：subtitleUrl=${Boolean(
            subtitleUrl
          )} localTxt=${Boolean(localTxt)} audioPath=${Boolean(audioPath)} transcription=${id}`
        )
      }

      if (useSubtitleVideo) {
        const nameNoExt = audioDisplayNameWithoutExt(tr, id)
        const subPayload = {
          audio_path: audioPath,
          txt_path: localTxt,
          name: nameNoExt || id,
          execute_id: executeId
        }
        const subHeaders = {}
        const subTokRaw =
          process.env.PRESALES_VIDEO_SUBTITLE_VIDEO_ASYNC_TOKEN ||
          process.env.PRESALES_VIDEO_REPORT_ASYNC_TOKEN
        if (subTokRaw && String(subTokRaw).trim()) {
          subHeaders.Authorization = `Bearer ${String(subTokRaw).trim()}`
        }
        logger.info(
          `[presales-video] 推送字幕视频(短音频 duration<${splitSec}s) POST ${subtitleUrl} transcription=${id} durationSec=${durationSec}`
        )
        const remoteSub = await httpRequestJson('POST', subtitleUrl, subPayload, subHeaders)
        let remoteSubJson = null
        try {
          remoteSubJson = JSON.parse(remoteSub.body)
        } catch {
          // ignore
        }
        return res.json({
          success: remoteSub.status >= 200 && remoteSub.status < 300,
          data: {
            mode: 'subtitle_video_async',
            requestPayload: subPayload,
            remoteStatus: remoteSub.status,
            remoteBody:
              remoteSub.body.length > 4000
                ? remoteSub.body.slice(0, 4000) + '…'
                : remoteSub.body,
            remoteJson: remoteSubJson
          }
        })
      }

      const fileBase = path.basename(filePaths)
      const parsedName = path.parse(fileBase)
      const name =
        parsedName.ext !== '' && parsedName.ext.toLowerCase() === '.md'
          ? parsedName.name
          : fileBase
      const bodyPrompt =
        req.body && req.body.prompt != null && String(req.body.prompt).trim() !== ''
          ? String(req.body.prompt).trim()
          : null
      const envPrompt =
        process.env.PRESALES_VIDEO_REPORT_ASYNC_PROMPT != null &&
        String(process.env.PRESALES_VIDEO_REPORT_ASYNC_PROMPT).trim() !== ''
          ? String(process.env.PRESALES_VIDEO_REPORT_ASYNC_PROMPT).trim()
          : null
      const prompt = bodyPrompt || envPrompt || PRESALES_VIDEO_ASYNC_DEFAULT_PROMPT

      const payload = {
        name,
        execute_id: executeId,
        filePaths,
        prompt
      }

      const asyncHeaders = {}
      const asyncToken = process.env.PRESALES_VIDEO_REPORT_ASYNC_TOKEN
      if (asyncToken && String(asyncToken).trim()) {
        asyncHeaders.Authorization = `Bearer ${String(asyncToken).trim()}`
      }

      const asyncUrl = String(asyncUrlRaw).trim()
      logger.info(
        `[presales-video] 推送报告(异步) POST ${asyncUrl} transcription=${id} name=${name} execute_id=${executeId.slice(0, 60)}`
      )

      const remote = await httpRequestJson('POST', asyncUrl, payload, asyncHeaders)
      let remoteJson = null
      try {
        remoteJson = JSON.parse(remote.body)
      } catch {
        // ignore
      }

      return res.json({
        success: remote.status >= 200 && remote.status < 300,
        data: {
          mode: 'async_task',
          requestPayload: payload,
          remoteStatus: remote.status,
          remoteBody: remote.body.length > 4000 ? remote.body.slice(0, 4000) + '…' : remote.body,
          remoteJson
        }
      })
    }

    const pushUrl = process.env.PRESALES_VIDEO_REPORT_PUSH_URL
    if (!pushUrl || !String(pushUrl).trim()) {
      return res.status(400).json({
        success: false,
        error:
          '请配置 PRESALES_VIDEO_REPORT_ASYNC_URL（异步任务推送）或 PRESALES_VIDEO_REPORT_PUSH_URL（旧版 JSON 推送）'
      })
    }

    const local = await presalesAnalysisService.getAnalysisResult(id)
    if (!local) {
      return res.status(404).json({
        success: false,
        error: '本地无售前分析结果，无法推送'
      })
    }

    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    const fileNameBase =
      (tr?.original_file_name || tr?.name || id).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    const payload = {
      transcriptionId: id,
      fileName: `${fileNameBase}_售前分析报告.json`,
      report: local.analysisResult,
      meta: {
        modelName: local.modelName,
        promptCode: local.promptCode,
        createdAt: local.createdAt
      }
    }

    const remote = await httpRequestJson('POST', pushUrl.trim(), payload)
    let remoteJson = null
    try {
      remoteJson = JSON.parse(remote.body)
    } catch {
      // ignore
    }

    res.json({
      success: remote.status >= 200 && remote.status < 300,
      data: {
        remoteStatus: remote.status,
        remoteBody: remote.body.length > 4000 ? remote.body.slice(0, 4000) + '…' : remote.body,
        remoteJson
      }
    })
  } catch (error) {
    logger.error('[presales-video] 推送报告失败:', error)
    res.status(500).json({ success: false, error: error.message || '推送报告失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/push-video-users
 * 预览推送视频成员（自动规则：created_by 上级链 + 固定成员 + 报备 our_participants（中文名经 org_user.user_name→userid）+ rxkf01，再应用 env 排除）
 */
router.get('/transcriptions/:id/push-video-users', async (req, res) => {
  const { id } = req.params
  try {
    const result = await presalesVideoWecomPushService.resolvePushVideoUserIds({
      prisma,
      transcriptionId: id,
      userIdsRaw: null
    })
    res.json({
      success: true,
      data: {
        source: result.source,
        userIds: result.userIds,
        userCount: result.userIds.length,
        excludedUserIds: result.excludedUserIds || [],
        fixedMembers: result.fixedMembers || []
      }
    })
  } catch (error) {
    logger.error('[presales-video] push-video-users 预览失败:', error)
    const msg = error.message || '获取推送成员失败'
    const clientErr = msg.includes('不存在') || msg.includes('未配置')
    res.status(clientErr ? 400 : 500).json({ success: false, error: msg })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/push-content-preview
 * 返回即将发往群内的两段 Markdown（线索首条 + 报备摘要），供弹窗编辑；不含视频文本卡片。
 * 另返回 splitSec / audioDurationSec / isShortAudio；短音频时尝试附带 reportAnalysisMarkdown（与「推送报告」编辑同源）。
 */
router.get('/transcriptions/:id/push-content-preview', async (req, res) => {
  const { id } = req.params
  try {
    const data = await presalesVideoWecomPushService.getPresalesVideoPushMarkdownPreview({
      prisma,
      transcriptionId: id
    })
    const tr = await prisma.transcriptions.findUnique({
      where: { id },
      select: { audio_duration: true }
    })
    const splitSec = getReportDurationSplitSec()
    const durationSec = tr?.audio_duration != null ? Number(tr.audio_duration) : NaN
    const durationOk = !Number.isNaN(durationSec) && durationSec >= 0
    const isShortAudio = durationOk && durationSec < splitSec

    let reportAnalysisMarkdown = null
    let reportAnalysisLoadError = null
    if (isShortAudio) {
      const ar = await presalesVideoTaskService.readAnalysisForPushEdit(id)
      if (ar.ok) {
        reportAnalysisMarkdown = ar.content != null ? String(ar.content) : ''
      } else {
        reportAnalysisLoadError = ar.message || '无法加载分析报告'
      }
    }

    res.json({
      success: true,
      data: {
        ...data,
        splitSec,
        audioDurationSec: durationOk ? durationSec : null,
        isShortAudio,
        reportAnalysisMarkdown,
        reportAnalysisLoadError
      }
    })
  } catch (error) {
    logger.error('[presales-video] push-content-preview 失败:', error)
    const msg = error.message || '获取预览失败'
    const clientErr = msg.includes('不存在')
    res.status(clientErr ? 400 : 500).json({ success: false, error: msg })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/push-video
 * Body: { userIds: "userid1,userid2" } 或 { members: ["id1","id2"] }（可选）
 *       cardTitle | card_title：可选，企微文本卡片 title；不传则沿用转录音频文件名（去后缀）或「售前视频」。
 * 未传 userIds 时：自动按 created_by 上级链 + 固定成员 + 匹配到的报备 our_participants（姓名→org_user.user_id）+ rxkf01。
 * 传入 userIds 时：以 Body 名单为准，不再并入固定成员/rxkf01（你可从预览里删掉固定成员）；仍应用 env PRESALES_VIDEO_GROUP_EXCLUDE_USERIDS。
 * chatName | group_name | groupName：可选，仅在新创建群发会话时使用该名称；不传则自动「线索/客户名或文件名-售前分析」。
 * clueMarkdown / reportMarkdown：可选；若传入则以传入为准（与弹窗预览编辑一致）；不传则服务端按报备自动生成。
 * reportAnalysisMarkdown：可选；音频时长 < PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC（默认 600s）时，在报备摘要之后<strong>再单独发一条或多条</strong>企微 Markdown（与「推送报告」正文同源）；未传时服务端短音频仍会尝试从 md/库读取。
 * 使用企业微信应用 API 创建/复用 appchat，向群内推送：报备 main_content + 售前视频文本卡片。
 */
router.post('/transcriptions/:id/push-video', async (req, res) => {
  const { id } = req.params
  try {
    const body = req.body || {}
    const userIds =
      body.userIds != null
        ? body.userIds
        : body.members != null
          ? body.members
          : body.userList != null
            ? body.userList
            : null
    const cardTitle =
      body.cardTitle != null && String(body.cardTitle).trim()
        ? String(body.cardTitle).trim()
        : body.card_title != null && String(body.card_title).trim()
          ? String(body.card_title).trim()
          : null
    const chatName =
      body.chatName != null && String(body.chatName).trim()
        ? String(body.chatName).trim()
        : body.groupName != null && String(body.groupName).trim()
          ? String(body.groupName).trim()
          : body.group_name != null && String(body.group_name).trim()
            ? String(body.group_name).trim()
            : null
    const pushCtx = {
      prisma,
      transcriptionId: id,
      userIdsRaw: userIds == null ? null : userIds,
      cardTitle,
      chatName
    }
    if (Object.prototype.hasOwnProperty.call(body, 'clueMarkdown')) {
      pushCtx.clueMarkdown = body.clueMarkdown
    }
    if (Object.prototype.hasOwnProperty.call(body, 'reportMarkdown')) {
      pushCtx.reportMarkdown = body.reportMarkdown
    }
    if (Object.prototype.hasOwnProperty.call(body, 'reportAnalysisMarkdown')) {
      pushCtx.reportAnalysisMarkdown = body.reportAnalysisMarkdown
    }
    const result = await presalesVideoWecomPushService.pushPresalesVideoToWecomAppChat(pushCtx)
    // reserve_4（wecom_appchat:{chatid}@时间）已在 push 服务内、发卡片前写入，供模板 {chatId} 解析
    logger.info(
      `[presales-video] push-video 成功 transcription=${id} chatid=${result.chatid} users=${result.userCount}`
    )
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('[presales-video] push-video 失败:', error)
    const msg = error.message || '推送视频失败'
    const clientErr =
      msg.includes('至少') ||
      msg.includes('未配置') ||
      msg.includes('群主') ||
      msg.includes('userid') ||
      msg.includes('不存在')
    res.status(clientErr ? 400 : 500).json({ success: false, error: msg })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/push-video-card-to-rxkf
 * Body 可选：cardTitle | card_title（与 push-video 一致）。
 * 不建群、不调报备/线索外部接口：写入 reserve_4（伪 chatId：前缀 old + 8 位随机数字），卡片模板 {chatId} 从此解析；仅向 rxkf01（或 PRESALES_VIDEO_RXKF_USERID）单发文本卡片（自建应用 message/send）。
 */
router.post('/transcriptions/:id/push-video-card-to-rxkf', async (req, res) => {
  const { id } = req.params
  try {
    const body = req.body || {}
    const cardTitle =
      body.cardTitle != null && String(body.cardTitle).trim()
        ? String(body.cardTitle).trim()
        : body.card_title != null && String(body.card_title).trim()
          ? String(body.card_title).trim()
          : null
    const result = await presalesVideoWecomPushService.sendPresalesVideoCardToRxkfOnly({
      prisma,
      transcriptionId: id,
      cardTitle
    })
    logger.info(
      `[presales-video] push-video-card-to-rxkf 成功 transcription=${id} touser=${result.touser}`
    )
    res.json({ success: true, data: result })
  } catch (error) {
    logger.error('[presales-video] push-video-card-to-rxkf 失败:', error)
    const msg = error.message || '发送失败'
    const clientErr =
      msg.includes('未配置') ||
      msg.includes('不存在') ||
      msg.includes('无可用') ||
      msg.includes('不是合法') ||
      msg.includes('本地路径') ||
      msg.includes('execute_id') ||
      msg.includes('无法生成')
    res.status(clientErr ? 400 : 500).json({ success: false, error: msg })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/video
 * 请求第三方 PRESALES_VIDEO_FETCH_URL?transcriptionId=
 */
router.get('/transcriptions/:id/video', async (req, res) => {
  try {
    const { id } = req.params
    const base = process.env.PRESALES_VIDEO_FETCH_URL
    if (!base || !String(base).trim()) {
      return res.status(400).json({
        success: false,
        error: '未配置环境变量 PRESALES_VIDEO_FETCH_URL'
      })
    }

    const url = appendQuery(base.trim(), id)
    const remote = await httpRequestGet(url)

    const ct = remote.headers['content-type'] || ''
    if (ct.includes('application/json') || remote.body.length < 4 * 1024 * 1024) {
      const text = remote.body.toString('utf8')
      let parsed = null
      try {
        parsed = JSON.parse(text)
      } catch {
        // ignore
      }
      return res.status(remote.status >= 200 && remote.status < 300 ? 200 : remote.status).json({
        success: remote.status >= 200 && remote.status < 300,
        data: {
          status: remote.status,
          contentType: ct,
          json: parsed,
          text: parsed ? undefined : text
        }
      })
    }

    res.setHeader('Content-Type', ct || 'application/octet-stream')
    res.status(remote.status)
    return res.send(remote.body)
  } catch (error) {
    logger.error('[presales-video] 获取视频失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取视频失败' })
  }
})

/**
 * POST /api/presales-video/transcriptions/:id/notify-role-confirm
 * Body 可选：{ wecomUserId } 接收人企微 userid；缺省时用 transcriptions.created_by。
 * 自建应用 message/send：textcard（失败则 markdown），内含角色确认外链（需 WECOM_CORP_ID、WECOM_APPCHAT_SECRET、WECOM_AGENT_ID，接收人须在应用可见范围）
 */
router.post('/transcriptions/:id/notify-role-confirm', async (req, res) => {
  const { id } = req.params
  try {
    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    if (!tr) {
      return res.status(404).json({ success: false, error: '转录不存在' })
    }
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const fromBody =
      body.wecomUserId != null && String(body.wecomUserId).trim()
        ? String(body.wecomUserId).trim()
        : ''
    const fromCreated = tr.created_by != null && String(tr.created_by).trim() ? String(tr.created_by).trim() : ''
    const wxUser = fromBody || fromCreated
    if (!wxUser) {
      return res.status(400).json({
        success: false,
        error: '请指定接收人企微 userid（弹窗中填写），或确保该转录有 created_by'
      })
    }
    const resolved = await mergedDialogueService.resolveMergedDialoguesForTranscription(id)
    if (!resolved || !resolved.dialogues || resolved.dialogues.length === 0) {
      return res.status(400).json({
        success: false,
        error: '当前无可用合并/原始对话内容，无法发起角色确认'
      })
    }
    const token = presalesVideoSpeakerLink.signSpeakerConfirmToken(id)
    const pageUrl = presalesVideoSpeakerLink.buildSpeakerConfirmPageUrl(token)
    if (!wecomAppChatApi.isApplicationMessageConfigured()) {
      return res.status(503).json({
        success: false,
        error:
          '角色确认由自建应用推送：请配置 WECOM_CORP_ID、WECOM_APPCHAT_SECRET（该应用 Secret）、WECOM_AGENT_ID，并确保接收人在应用可见范围内'
      })
    }
    const audioName = transcriptionAudioDisplayName(tr)
    const roleConfirmTitle = audioName
      ? `说话人角色确认 · ${truncateForWecomCardTitle(audioName)}`
      : '说话人角色确认'
    const mdAudio = audioName ? `\n\n音频：${audioName}` : ''
    const md = `**售前视频 · 说话人确认**${mdAudio}\n\n请打开链接核对对话并修正说话人（可批量改同一标签），保存后即可在后台继续「推送对话」等流程。\n\n[点此打开角色确认页面](${pageUrl})`
    const textcardDesc = '<div class="normal">你好请点击卡片进入网页确认说话人。</div>'
    try {
      await wecomAppChatApi.sendApplicationTextCardToUser(wxUser, {
        title: roleConfirmTitle,
        description: textcardDesc,
        url: pageUrl,
        btntxt: '打开确认'
      })
      logger.info(`[presales-video] 已推送角色确认 textcard（自建应用） transcription=${id} -> ${wxUser}`)
    } catch (cardErr) {
      logger.warn(
        `[presales-video] textcard 发送失败，降级为 markdown: ${cardErr.message || cardErr}`
      )
      await wecomAppChatApi.sendApplicationMarkdownToUser(wxUser, md)
      logger.info(`[presales-video] 已推送角色确认 markdown（自建应用） transcription=${id} -> ${wxUser}`)
    }
    try {
      await presalesVideoTaskService.getOrCreateTask(id)
      await presalesVideoTaskService.updatePipelineStatus(
        id,
        presalesVideoTaskService.PipelineStatus.ROLE_CONFIRMING
      )
      await prisma.presales_video_tasks.update({
        where: { transcription_id: id },
        data: {
          role_confirm_wecom_userid: wxUser,
          role_confirm_card_sent_at: new Date(),
          role_confirm_reminder_sent_at: null
        }
      })
    } catch (pipeErr) {
      logger.warn(
        `[presales-video] 推送角色确认卡片后更新流水线状态失败 transcription=${id}:`,
        pipeErr.message || pipeErr
      )
    }
    res.json({
      success: true,
      data: {
        transcriptionId: id,
        wecomUserId: wxUser,
        dialogueSource: resolved.source,
        dialogueCount: resolved.dialogues.length,
        pipelineStatus: presalesVideoTaskService.PipelineStatus.ROLE_CONFIRMING
      }
    })
  } catch (error) {
    logger.error('[presales-video] notify-role-confirm 失败:', error)
    res.status(500).json({ success: false, error: error.message || '推送失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions/:id/speaker-confirm-link
 * 管理端「查看信息」：签发与企微角色确认外链相同的 token，用于打开同一套说话人确认页（GET/PUT /public/speaker-confirm）
 * 依赖环境变量 PRESALES_VIDEO_SPEAKER_LINK_SECRET（与发卡片一致）
 */
router.get('/transcriptions/:id/speaker-confirm-link', async (req, res) => {
  try {
    const id = req.params.id != null ? String(req.params.id).trim() : ''
    if (!id) {
      return res.status(400).json({ success: false, error: '缺少 transcription id' })
    }
    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    if (!tr) {
      return res.status(404).json({ success: false, error: '转录不存在' })
    }
    let token
    try {
      token = presalesVideoSpeakerLink.signSpeakerConfirmToken(tr.id)
    } catch (e) {
      const msg = (e && e.message) || String(e)
      return res.status(503).json({
        success: false,
        error: msg.includes('PRESALES_VIDEO_SPEAKER_LINK_SECRET')
          ? msg
          : `无法签发沟通信息链接：${msg}（需配置 PRESALES_VIDEO_SPEAKER_LINK_SECRET，与角色确认卡片一致）`
      })
    }
    const pfx = getAiBackendStaticPathPrefix()
    const pagePath = `${pfx}/pages/presales-video-speaker-confirm.html?token=${encodeURIComponent(token)}&pv=8`
    return res.json({
      success: true,
      data: {
        transcriptionId: tr.id,
        token,
        pagePath
      }
    })
  } catch (error) {
    logger.error('[presales-video] speaker-confirm-link 失败:', error)
    res.status(500).json({ success: false, error: error.message || '签发链接失败' })
  }
})

/**
 * GET /api/presales-video/public/speaker-confirm-page.js
 * 角色确认页脚本：由接口返回 application/javascript，避免企微 WebView 请求 /js/ 静态路径时拿到 HTML（Unexpected token '<'）
 */
router.get('/public/speaker-confirm-page.js', (req, res) => {
  const jsPath = path.join(__dirname, '../../frontend/js/pages/presales-video-speaker-confirm.js')
  res.type('application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.sendFile(jsPath, (err) => {
    if (err) {
      logger.error('[presales-video] speaker-confirm-page.js 读取失败:', err)
      if (!res.headersSent) res.status(500).type('text/plain').send('// load error')
    }
  })
})

/**
 * GET /api/presales-video/public/speaker-confirm?token=
 * 外链加载对话（无需登录）
 */
router.get('/public/speaker-confirm', async (req, res) => {
  try {
    const token = req.query.token != null ? String(req.query.token) : ''
    const v = presalesVideoSpeakerLink.verifySpeakerConfirmToken(token)
    if (!v) {
      return res.status(401).json({ success: false, error: '链接无效或已过期' })
    }
    const resolved = await mergedDialogueService.resolveMergedDialoguesForTranscription(
      v.transcriptionId
    )
    if (!resolved || !resolved.dialogues || resolved.dialogues.length === 0) {
      return res.status(404).json({ success: false, error: '暂无对话内容' })
    }
    const tr = resolved.transcription
    let speakerRoles = null
    if (tr.speaker_roles) {
      try {
        speakerRoles =
          typeof tr.speaker_roles === 'string' ? JSON.parse(tr.speaker_roles) : tr.speaker_roles
      } catch {
        speakerRoles = null
      }
    }
    const roleAdj = await prisma.dialogue_adjustments.findFirst({
      where: { transcription_id: v.transcriptionId, note1: '角色判断' },
      orderBy: { created_at: 'desc' }
    })
    if (roleAdj && roleAdj.speaker_roles) {
      try {
        speakerRoles =
          typeof roleAdj.speaker_roles === 'string'
            ? JSON.parse(roleAdj.speaker_roles)
            : roleAdj.speaker_roles
      } catch {
        /* keep */
      }
    }
    res.json({
      success: true,
      data: {
        transcriptionId: v.transcriptionId,
        name: tr.name,
        originalFileName: tr.original_file_name,
        dialogueSource: resolved.source,
        dialogues: resolved.dialogues,
        speakerRoles
      }
    })
  } catch (error) {
    logger.error('[presales-video] public speaker-confirm GET 失败:', error)
    res.status(500).json({ success: false, error: error.message || '加载失败' })
  }
})

/**
 * PUT /api/presales-video/public/speaker-confirm
 * Body: { token, dialogues, speaker_roles? }
 */
router.put('/public/speaker-confirm', async (req, res) => {
  try {
    const token = req.body && req.body.token != null ? String(req.body.token) : ''
    const v = presalesVideoSpeakerLink.verifySpeakerConfirmToken(token)
    if (!v) {
      return res.status(401).json({ success: false, error: '链接无效或已过期' })
    }
    const dialogues = req.body && req.body.dialogues
    const speaker_roles = req.body && req.body.speaker_roles
    const row = await upsertRoleJudgmentAdjustment(v.transcriptionId, dialogues, speaker_roles)
    logger.info(
      `[presales-video] 外链保存角色确认 transcription=${v.transcriptionId} adjustment=${row.id}`
    )
    try {
      await presalesVideoTaskService.getOrCreateTask(v.transcriptionId)
      await presalesVideoTaskService.updatePipelineStatus(
        v.transcriptionId,
        presalesVideoTaskService.PipelineStatus.SPEAKER_CONFIRMED
      )
      await prisma.presales_video_tasks.updateMany({
        where: { transcription_id: v.transcriptionId },
        data: {
          role_confirm_wecom_userid: null,
          role_confirm_card_sent_at: null,
          role_confirm_reminder_sent_at: null
        }
      })
    } catch (pipeErr) {
      logger.warn(
        `[presales-video] 外链保存后更新流水线状态失败 transcription=${v.transcriptionId}:`,
        pipeErr.message || pipeErr
      )
    }
    res.json({
      success: true,
      data: { adjustmentId: row.id, transcriptionId: v.transcriptionId }
    })
    const tidNotify = v.transcriptionId
    setImmediate(() => {
      presalesVideoPipelineOrchestrator.notifyTranscriptionUpdated(tidNotify).catch((e) => {
        logger.warn('[presales-video] pipeline notify (speaker-confirm):', e.message || e)
      })
    })
  } catch (error) {
    logger.error('[presales-video] public speaker-confirm PUT 失败:', error)
    const msg = error.message || '保存失败'
    let status = 500
    if (msg === '转录不存在') status = 404
    else if (msg.includes('须为') || msg.includes('非空')) status = 400
    res.status(status).json({ success: false, error: msg })
  }
})

/**
 * POST /api/presales-video/pipeline-runs/start
 * 服务端自动流水线（不依赖页面打开）：角色确认 → 推送对话 → 提交工作流 →（等回调）→ 推送报告 →（等视频回调）→ 推送视频
 * Body: { transcriptionId, wecomUserId?, pushVideoUserIds?, skipRoleConfirm? }
 * pushVideoUserIds 可缺省若已配置 PRESALES_VIDEO_PIPELINE_DEFAULT_PUSH_VIDEO_USERIDS
 */
router.post('/pipeline-runs/start', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const run = await presalesVideoPipelineOrchestrator.startPipelineRun({
      transcriptionId: body.transcriptionId,
      wecomUserId: body.wecomUserId,
      pushVideoUserIds: body.pushVideoUserIds,
      skipRoleConfirm: Boolean(body.skipRoleConfirm)
    })
    res.json({ success: true, data: { run } })
  } catch (error) {
    logger.error('[presales-video] pipeline-runs/start:', error)
    res.status(400).json({ success: false, error: error.message || '启动失败' })
  }
})

/**
 * GET /api/presales-video/pipeline-runs/by-transcription/:transcriptionId
 * 最近若干条流水线记录（含 phase、run_status、last_error）
 */
router.get('/pipeline-runs/by-transcription/:transcriptionId', async (req, res) => {
  try {
    const list = await presalesVideoPipelineOrchestrator.getRunsForTranscription(
      req.params.transcriptionId,
      15
    )
    res.json({ success: true, data: { list } })
  } catch (error) {
    logger.error('[presales-video] pipeline-runs list:', error)
    res.status(500).json({ success: false, error: error.message || '查询失败' })
  }
})

module.exports = router
