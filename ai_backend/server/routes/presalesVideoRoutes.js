/**
 * 售前分析 · 视频生成：合并对话列表、推送对话、报告与视频对接（第三方 URL 由环境变量配置）
 *
 * 环境变量：
 * - PRESALES_VIDEO_DIALOGUE_LOCAL_DIR       合并对话 txt 落地目录（默认 uploads_data/presales_video_dialogue）
 * - PRESALES_VIDEO_COZE_FILE_UPLOAD_URL     推送对话：multipart 仅字段 file → 返回 file_id、file_name（不落会议分析）
 * - PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL 提交工作流：JSON { fileId, fileName } → execute_id（body 可空，缺省读 presales_video_tasks）
 * - PRESALES_VIDEO_COZE_TOKEN               可选，Coze 上传/会议分析请求带 Authorization: Bearer <token>
 * - PRESALES_VIDEO_REPORT_FETCH_URL    获取报告：请求第三方 GET（可选，与本地库二选一逻辑见下）
 * - PRESALES_VIDEO_REPORT_PUSH_URL     推送报告 JSON POST（可选）
 * - PRESALES_VIDEO_FETCH_URL           获取视频 GET（可选，query: transcriptionId）
 * - PRESALES_VIDEO_WORKFLOW_SUBMIT_URL 提交工作流 JSON POST（可选）
 * - PRESALES_VIDEO_WORKFLOW_SUBMIT_TOKEN 可选，Bearer Token 鉴权
 * - PRESALES_VIDEO_WORKFLOW_CALLBACK_SECRET 可选，工作流回调鉴权；请求需带 Header X-Presales-Video-Callback-Secret 或 query ?secret=
 */

const express = require('express')
const FormData = require('form-data')
const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')
const { URL } = require('url')

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const mergedDialogueService = require('../services/transcriptionMergedDialogueService')
const presalesAnalysisService = require('../services/presalesAnalysisService')
const presalesVideoTaskService = require('../services/presalesVideoTaskService')
const logger = require('../utils/logger')

const router = express.Router()
const prisma = new PrismaClient()

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

/**
 * POST /api/presales-video/workflow-callback
 * 工作流完成后回调：按 execute_id 更新 presales_video_tasks
 * Body: { type: 'analysis_content' | 'video_create', id 或 execute_id, 文本/路径: content|text|url|path|... }
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
    const payloadText = pickWorkflowCallbackPayload(body)

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
      payloadText
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

    return res.json({
      success: true,
      data: {
        videoTask: presalesVideoTaskService.toApiShape(result.task)
      }
    })
  } catch (error) {
    logger.error('[presales-video] workflow-callback 失败:', error)
    return res.status(500).json({ success: false, error: error.message || '回调处理失败' })
  }
})

/**
 * GET /api/presales-video/transcriptions
 * Query: page, pageSize, name — 名称关键词，匹配 name / original_file_name / customer_name（模糊）
 */
router.get('/transcriptions', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))
    const skip = (page - 1) * pageSize
    const nameKw = req.query.name != null ? String(req.query.name).trim() : ''

    const idList = await mergedDialogueService.listTranscriptionIdsWithMergeStep()
    if (idList.length === 0) {
      return res.json({
        success: true,
        data: { list: [], total: 0, page, pageSize, totalPages: 0, nameQuery: nameKw }
      })
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

    const ordered = await prisma.transcriptions.findMany({
      where: {
        id: { in: idList },
        ...nameWhere
      },
      orderBy: { created_at: 'desc' },
      select: { id: true }
    })
    const orderedIds = ordered.map((t) => t.id)
    const total = orderedIds.length
    const pageIds = orderedIds.slice(skip, skip + pageSize)

    const rows = await prisma.transcriptions.findMany({
      where: { id: { in: pageIds } },
      include: {
        presales_analysis_results: {
          where: { status: 'completed' },
          orderBy: { created_at: 'desc' },
          take: 1
        }
      }
    })
    const map = new Map(rows.map((r) => [r.id, r]))
    const list = pageIds.map((pid) => map.get(pid)).filter(Boolean)

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
      hasPresalesReport: t.presales_analysis_results.length > 0,
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
        nameQuery: nameKw
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
 * Coze：Body 可选 { fileId, fileName }；缺省时从 presales_video_tasks 读取上次推送落库值。
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
      const meetingPayload = {
        fileId: String(fileId).trim(),
        fileName,
        meetingName: fileName
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
 * 将本地售前分析结果 JSON POST 到 PRESALES_VIDEO_REPORT_PUSH_URL
 */
router.post('/transcriptions/:id/push-report', async (req, res) => {
  try {
    const { id } = req.params
    const pushUrl = process.env.PRESALES_VIDEO_REPORT_PUSH_URL
    if (!pushUrl || !String(pushUrl).trim()) {
      return res.status(400).json({
        success: false,
        error: '未配置环境变量 PRESALES_VIDEO_REPORT_PUSH_URL'
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

module.exports = router
