/**
 * 售前分析 · 视频生成：合并对话列表、推送对话、报告与视频对接（第三方 URL 由环境变量配置）
 *
 * 环境变量：
 * - PRESALES_VIDEO_DIALOGUE_LOCAL_DIR       合并对话 txt 落地目录（默认 uploads_data/presales_video_dialogue）
 * - PRESALES_VIDEO_COZE_FILE_UPLOAD_URL     推送对话：multipart 仅字段 file → 返回 file_id、file_name（不落会议分析）
 * - PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL 提交工作流：JSON { fileId, fileName } → execute_id（body 可空，缺省读 presales_video_tasks）
 * - PRESALES_VIDEO_COZE_TOKEN               可选，Coze 上传/会议分析请求带 Authorization: Bearer <token>
 * - PRESALES_VIDEO_REPORT_FETCH_URL    获取报告：请求第三方 GET（可选，与本地库二选一逻辑见下）
 * - PRESALES_VIDEO_REPORT_ASYNC_URL    推送报告：异步任务 POST 完整 URL（如 …/async），Body { name, execute_id, filePaths }（优先于下方旧推送）
 * - PRESALES_VIDEO_REPORT_ASYNC_TOKEN  可选，异步任务请求 Authorization: Bearer
 * - PRESALES_VIDEO_REPORT_ASYNC_PROMPT 可选，异步任务 Body 中 prompt 默认值覆盖（默认文案：根据报告内容，生成视频，使用默认主题）
 * - PRESALES_VIDEO_REPORT_PUSH_URL     未配置 ASYNC_URL 时：旧版推送本地售前分析 JSON POST（可选）
 * - PRESALES_VIDEO_FETCH_URL           获取视频 GET（可选，query: transcriptionId）
 * - WECOM_CORP_ID / WECOM_APPCHAT_SECRET  推送视频：企业微信「应用群发会话」appchat 建群+发 Markdown（自建应用 Secret，非智能机器人）
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

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { v4: uuidv4 } = require('uuid')
const mergedDialogueService = require('../services/transcriptionMergedDialogueService')
const presalesAnalysisService = require('../services/presalesAnalysisService')
const presalesVideoTaskService = require('../services/presalesVideoTaskService')
const presalesVideoSpeakerLink = require('../services/presalesVideoSpeakerLink')
const { getWeComBotClient } = require('../services/wecomBotService')
const presalesVideoWecomPushService = require('../services/presalesVideoWecomPushService')
const logger = require('../utils/logger')

const router = express.Router()
const prisma = new PrismaClient()

/** 推送报告（异步）第三方 Body 字段 prompt 的默认文案 */
const PRESALES_VIDEO_ASYNC_DEFAULT_PROMPT = '根据报告内容，生成视频，使用默认主题'

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
function pickWorkflowCallbackPayload(body) {
  if (!body || typeof body !== 'object') return null
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
    if (v != null && String(v) !== '') return v
  }
  if (body.data != null && typeof body.data === 'string' && String(body.data) !== '') {
    return body.data
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

/**
 * POST /api/presales-video/workflow-callback
 * 工作流完成后回调：按 execute_id 更新 presales_video_tasks
 * Body: {
 *   type: 'analysis_content' | 'video_create',
 *   outcome?: 'success' | 'fail'（或 callback_outcome；缺省 success）,
 *   id 或 execute_id,
 *   success: 文本/路径 content|text|url|path|...
 *   fail: 建议 error|message|msg|reason|...，或与 success 相同字段携带说明
 * }
 */
router.post('/workflow-callback', async (req, res) => {
  try {
    const expectedSecret = process.env.PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET
    if (expectedSecret && String(expectedSecret).trim()) {
      const given =
        req.headers['x-presales-video-callback-secret'] ||
        req.query.secret ||
        (req.body && req.body.secret)
      if (String(given || '') !== String(expectedSecret).trim()) {
        return res.status(401).json({ success: false, error: 'callback 鉴权失败' })
      }
    }

    const body = req.body && typeof req.body === 'object' ? req.body : {}
    const typeRaw = body.type || body.callback_type
    const executeId = body.id ?? body.execute_id ?? body.executeId
    const outcomeNorm = normalizeCallbackOutcome(body)
    if (outcomeNorm == null) {
      return res.status(400).json({
        success: false,
        error: 'outcome 必须为 success 或 fail（可用 body.outcome 或 callback_outcome）'
      })
    }

    const payloadText =
      outcomeNorm === 'fail'
        ? pickCallbackErrorMessage(body) ?? pickWorkflowCallbackPayload(body)
        : pickWorkflowCallbackPayload(body)

    if (typeRaw == null || String(typeRaw).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少 type（analysis_content / video_create）' })
    }
    if (executeId == null || String(executeId).trim() === '') {
      return res.status(400).json({ success: false, error: '缺少 id（execute_id）' })
    }

    const typeNorm = String(typeRaw).trim()
    const result = await presalesVideoTaskService.applyWorkflowCallback(
      typeNorm,
      executeId,
      payloadText,
      outcomeNorm
    )

    if (!result.ok) {
      const status = result.code === 'NOT_FOUND' ? 404 : 400
      return res.status(status).json({
        success: false,
        error: result.message,
        code: result.code
      })
    }

    if (result.truncated) {
      logger.warn('[presales-video] workflow-callback video_address 超过 2000 字符已截断')
    }

    logger.info(
      `[presales-video] workflow-callback 已处理 type=${typeNorm} execute_id=${String(executeId).slice(0, 80)}`
    )

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
    logger.error('[presales-video] workflow-callback 失败:', error)
    return res.status(500).json({ success: false, error: error.message || '回调处理失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions
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

    const whereParts = []
    if (Object.keys(nameWhere).length > 0) whereParts.push(nameWhere)
    if (Object.keys(createdAtFilter).length > 0) {
      whereParts.push({ created_at: createdAtFilter })
    }
    if (taskWhere) whereParts.push(taskWhere)
    const where = whereParts.length === 0 ? {} : whereParts.length === 1 ? whereParts[0] : { AND: whereParts }

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

    const listOut = list.map((t) => ({
      id: t.id,
      name: t.name,
      originalFileName: t.original_file_name,
      customerName: t.customer_name,
      createdAt: t.created_at,
      hasPresalesReport: (t.presales_analysis_results && t.presales_analysis_results.length > 0) || false,
      videoTask: presalesVideoTaskService.toApiShape(taskByTid.get(t.id))
    }))

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
 * Coze：Body 可选 { fileId, fileName }；缺省时从 presales_video_tasks 读取。转发 JSON 含 meetingName=转录音频文件名（original_file_name / name），fileName 仍为上传 txt 名。
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
        fileId: String(fileId).trim(),
        fileName,
        meetingName
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

      const name = path.basename(filePaths)
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
 * POST /api/presales-video/transcriptions/:id/push-video
 * Body: { userIds: "userid1,userid2" } 或 { members: ["id1","id2"] }
 * 使用企业微信应用 API 创建 appchat，向群内推送：交流报备摘要（按客户名匹配）+ 视频信息（video_address）
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
    if (
      userIds == null ||
      (typeof userIds === 'string' && !String(userIds).trim()) ||
      (Array.isArray(userIds) && userIds.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        error:
          '请提供 userIds：企业微信成员 userid，逗号分隔，至少 2 人（须在该自建应用可见范围内）'
      })
    }
    const result = await presalesVideoWecomPushService.pushPresalesVideoToWecomAppChat({
      prisma,
      transcriptionId: id,
      userIdsRaw: userIds
    })
    try {
      const stamp = `wecom_appchat:${result.chatid}@${new Date().toISOString()}`
      await prisma.presales_video_tasks.updateMany({
        where: { transcription_id: id },
        data: { reserve_4: stamp.slice(0, 500) }
      })
    } catch (e) {
      logger.warn('[presales-video] push-video 回写 reserve_4 失败:', e.message)
    }
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
 * 向 transcriptions.created_by（企微 userid）发 Markdown，内含角色确认外链（需机器人 WS 已连接 + 环境变量）
 */
router.post('/transcriptions/:id/notify-role-confirm', async (req, res) => {
  const { id } = req.params
  try {
    const tr = await prisma.transcriptions.findUnique({ where: { id } })
    if (!tr) {
      return res.status(404).json({ success: false, error: '转录不存在' })
    }
    const wxUser = tr.created_by && String(tr.created_by).trim()
    if (!wxUser) {
      return res.status(400).json({
        success: false,
        error: '该转录无 created_by（企微 userid），无法定向推送。请使用企微机器人上传的转录。'
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
    const bot = getWeComBotClient()
    if (!bot || !bot.isConnected()) {
      return res.status(503).json({
        success: false,
        error: '企业微信机器人未连接（WebSocket 未认证），无法推送消息'
      })
    }
    const md = `**售前视频 · 说话人确认**\n\n请打开链接核对对话并修正说话人（可批量改同一标签），保存后即可在后台继续「推送对话」等流程。\n\n[点此打开角色确认页面](${pageUrl})`
    const taskId = `pvsc_${id.replace(/-/g, '').slice(0, 24)}_${Date.now()}`
    try {
      await bot.sendTextNoticeCard(wxUser, {
        pageUrl,
        taskId,
        title: '说话人角色确认',
        desc: '请完成核对后再推送对话',
        subTitle: '点击本卡片或「打开确认页面」进入网页（需与服务器网络互通）'
      })
      logger.info(
        `[presales-video] 已推送角色确认模板卡片 transcription=${id} -> ${wxUser} taskId=${taskId}`
      )
    } catch (cardErr) {
      logger.warn(
        `[presales-video] 模板卡片发送失败，降级为 Markdown: ${cardErr.message || cardErr}`
      )
      await bot.sendMsg(wxUser, md, 'text')
      logger.info(`[presales-video] 已推送角色确认 Markdown transcription=${id} -> ${wxUser}`)
    }
    res.json({
      success: true,
      data: {
        transcriptionId: id,
        wecomUserId: wxUser,
        dialogueSource: resolved.source,
        dialogueCount: resolved.dialogues.length
      }
    })
  } catch (error) {
    logger.error('[presales-video] notify-role-confirm 失败:', error)
    res.status(500).json({ success: false, error: error.message || '推送失败' })
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
    res.json({
      success: true,
      data: { adjustmentId: row.id, transcriptionId: v.transcriptionId }
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

module.exports = router
