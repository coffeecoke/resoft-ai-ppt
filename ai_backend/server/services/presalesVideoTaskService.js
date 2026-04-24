/**
 * 售前视频生成主任务：Coze 上传与工作流信息落库
 *
 * analysis_content 回调成功时，内容除入库外会写入本地 .md（目录见 PRESALES_VIDEO_ANALYSIS_MD_DIR），文件名为录音显示名安全化 + .md（original_file_name / name），成功落盘路径写入 reserve_3（最长 500 字符，超出截断）
 * video_create 成功回调可选 body.playlist_url / playlistUrl：播放列表（如 m3u8）等写入 reserve_5（最长 500，超出截断）；同时 upsert psv_video_info：id=execute_id；title=转录名去路径与常见后缀；url 与 reserve_5 同值（有 playlist 时）；cover 与 url 同源路径但最后一档改为 cover.jpg（如 …/index.m3u8 → …/cover.jpg，由完整 playlist 串计算）。无 playlist 时 url 仍走 buildPresalesVideoPublicPlayUrl(主视频)，cover 同规则由主视频 URL 推导。
 */

const fs = require('fs/promises')
const path = require('path')
const prisma = require('../utils/prisma')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const mergedDialogueService = require('./transcriptionMergedDialogueService')


/** 流水线状态（与库中 pipeline_status 一致） */
const PipelineStatus = {
  /** 已推送角色确认卡片，对方尚未在外链页保存 */
  ROLE_CONFIRMING: '角色确认中',
  /** 用户在外链页保存说话人后 */
  SPEAKER_CONFIRMED: '角色已确认',
  PUSH_DIALOGUE: '推送对话',
  SUBMIT_WORKFLOW: '提交工作流',
  ANALYZING: '分析中',
  ANALYSIS_DONE: '分析完成',
  ANALYSIS_FAILED: '分析失败',
  PUSH_ANALYSIS_FILE: '推送分析文件',
  VIDEO_DONE: '视频生成',
  VIDEO_FAILED: '视频生成失败'
}

async function getByTranscriptionId(transcriptionId) {
  return prisma.presales_video_tasks.findUnique({
    where: { transcription_id: transcriptionId }
  })
}

/**
 * 无则创建主任务；有则返回
 */
async function getOrCreateTask(transcriptionId) {
  const existing = await getByTranscriptionId(transcriptionId)
  if (existing) return existing
  const id = uuidv4()
  return prisma.presales_video_tasks.create({
    data: {
      id,
      transcription_id: transcriptionId,
      pipeline_status: PipelineStatus.PUSH_DIALOGUE
    }
  })
}

async function saveAfterLocalTxt(transcriptionId, { localPath, lastError = null }) {
  await getOrCreateTask(transcriptionId)
  return prisma.presales_video_tasks.update({
    where: { transcription_id: transcriptionId },
    data: {
      local_dialogue_txt_path: localPath,
      pipeline_status: PipelineStatus.PUSH_DIALOGUE,
      last_error: lastError
    }
  })
}

async function saveAfterCozeUpload(transcriptionId, { cozeFileId, cozeFileName, localPath, lastError = null }) {
  await getOrCreateTask(transcriptionId)
  const data = { last_error: lastError }
  if (localPath) data.local_dialogue_txt_path = localPath
  if (cozeFileId) {
    data.coze_file_id = cozeFileId
    data.coze_file_name = cozeFileName
    data.pipeline_status = PipelineStatus.SUBMIT_WORKFLOW
  } else {
    data.pipeline_status = PipelineStatus.PUSH_DIALOGUE
  }
  return prisma.presales_video_tasks.update({
    where: { transcription_id: transcriptionId },
    data
  })
}

/** executeId 有值则进入「分析中」并写入；仅 lastError 则只记错（工作流失败时） */
async function saveAfterSubmitWorkflow(transcriptionId, { executeId = null, lastError = undefined } = {}) {
  await getOrCreateTask(transcriptionId)
  const data = {}
  if (lastError !== undefined) data.last_error = lastError
  if (executeId) {
    data.execute_id = executeId
    data.pipeline_status = PipelineStatus.ANALYZING
  }
  if (Object.keys(data).length === 0) return getByTranscriptionId(transcriptionId)
  return prisma.presales_video_tasks.update({
    where: { transcription_id: transcriptionId },
    data
  })
}

async function updatePipelineStatus(transcriptionId, pipelineStatus, extra = {}) {
  const data = { pipeline_status: pipelineStatus, ...extra }
  if (extra.last_error === undefined) delete data.last_error
  return prisma.presales_video_tasks.update({
    where: { transcription_id: transcriptionId },
    data
  })
}

/** video_address / last_error 等列 VarChar(2000)；reserve_3 / reserve_5 VarChar(500) */
const VIDEO_ADDRESS_MAX_LEN = 2000
const LAST_ERROR_MAX_LEN = 2000
const RESERVE3_MAX_LEN = 500
const RESERVE5_MAX_LEN = 500
/** psv_video_info 与库表 VarChar 一致 */
const PSV_VIDEO_INFO_ID_MAX = 64
const PSV_VIDEO_INFO_URL_MAX = 512
const PSV_VIDEO_INFO_TITLE_MAX = 255

function clipPsvVideoInfoId(executeId) {
  const s = String(executeId).trim()
  if (s.length <= PSV_VIDEO_INFO_ID_MAX) return s
  logger.warn(
    `[presales-video-task] psv_video_info.id（execute_id）超过 ${PSV_VIDEO_INFO_ID_MAX} 字符已截断`
  )
  return s.slice(0, PSV_VIDEO_INFO_ID_MAX)
}

function clipPsvVideoInfoUrl(val) {
  if (val == null) return ''
  let s = String(val)
  if (s.length <= PSV_VIDEO_INFO_URL_MAX) return s
  logger.warn(`[presales-video-task] psv_video_info.url 超过 ${PSV_VIDEO_INFO_URL_MAX} 字符已截断`)
  s = s.slice(0, PSV_VIDEO_INFO_URL_MAX)
  // 避免截断在百分号编码中间（% 或 %X 半截），导致后续解析/展示异常
  for (;;) {
    if (s.endsWith('%')) {
      s = s.slice(0, -1)
      continue
    }
    if (s.length >= 2 && /^%[0-9A-Fa-f]$/i.test(s.slice(-2))) {
      s = s.slice(0, -2)
      continue
    }
    break
  }
  return s
}

function clipPsvVideoInfoTitle(val) {
  const s = val != null ? String(val) : ''
  if (s.length <= PSV_VIDEO_INFO_TITLE_MAX) return s
  return s.slice(0, PSV_VIDEO_INFO_TITLE_MAX)
}

/**
 * 与 reserve_5 / playlist 同形态地址：最后一档文件名改为 cover.jpg；保留 ?query #hash
 * 例 …/path/index.m3u8 → …/path/cover.jpg；http(s) 无路径时补 /cover.jpg
 */
function coverUrlByReplacingLastPathSegmentWithCoverJpg(raw) {
  const s = raw != null ? String(raw).trim() : ''
  if (!s) return null
  let hash = ''
  let base = s
  const hashIdx = base.indexOf('#')
  if (hashIdx !== -1) {
    hash = base.slice(hashIdx)
    base = base.slice(0, hashIdx)
  }
  let query = ''
  const qIdx = base.indexOf('?')
  if (qIdx !== -1) {
    query = base.slice(qIdx)
    base = base.slice(0, qIdx)
  }

  if (/^https?:\/\//i.test(base)) {
    const proto = base.indexOf('//')
    const pathStart = proto === -1 ? -1 : base.indexOf('/', proto + 2)
    if (pathStart === -1) {
      return `${base}/cover.jpg${query}${hash}`
    }
    const origin = base.slice(0, pathStart)
    const pathPart = base.slice(pathStart)
    const lastSlash = pathPart.lastIndexOf('/')
    const newPath =
      lastSlash <= 0 ? '/cover.jpg' : `${pathPart.slice(0, lastSlash + 1)}cover.jpg`
    return `${origin}${newPath}${query}${hash}`
  }

  const lastSlash = base.lastIndexOf('/')
  const newPath =
    lastSlash === -1 ? 'cover.jpg' : `${base.slice(0, lastSlash + 1)}cover.jpg`
  return `${newPath}${query}${hash}`
}

/**
 * 写入 psv_video_info 时的对外访问基址（无尾部 /）。
 * 优先整段：PRESALES_VIDEO_PSV_INFO_BASE_URL，例 http://127.0.0.1:9010
 * 否则：PRESALES_VIDEO_PSV_INFO_HOST + 可选 PRESALES_VIDEO_PSV_INFO_PORT + PRESALES_VIDEO_PSV_INFO_SCHEME（默认 http）
 */
function getPsvVideoInfoPublicOrigin() {
  const base = process.env.PRESALES_VIDEO_PSV_INFO_BASE_URL
  if (base != null && String(base).trim() !== '') {
    return String(base).trim().replace(/\/+$/, '')
  }
  const host = process.env.PRESALES_VIDEO_PSV_INFO_HOST
  if (host == null || !String(host).trim()) return null
  let scheme = process.env.PRESALES_VIDEO_PSV_INFO_SCHEME
  scheme = scheme != null && String(scheme).trim() !== '' ? String(scheme).trim().replace(/:+$/, '') : 'http'
  if (!scheme) scheme = 'http'
  const portRaw = process.env.PRESALES_VIDEO_PSV_INFO_PORT
  const port = portRaw != null && String(portRaw).trim() !== '' ? String(portRaw).trim() : ''
  const hostTrim = String(host).trim()
  const portPart = port ? `:${port}` : ''
  return `${scheme}://${hostTrim}${portPart}`.replace(/\/+$/, '')
}

/**
 * 从回调里的完整 URL 或相对路径得到「路径 + 查询 + 哈希」，用于与对外基址拼接。
 * http(s) 不用 URL.pathname：pathname 会把百分号编码解码成 Unicode，再入库/截断时易与回调原文不一致或出现乱码；
 * 这里按原串截取，保留回调中的编码（含中文直写或 %E5%xx 形式）。
 */
function extractPathFromPsvSourceUrl(raw) {
  const s = raw != null ? String(raw).trim() : ''
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) {
    const proto = s.indexOf('//')
    if (proto === -1) return s.startsWith('/') ? s : `/${s}`
    const pathStart = s.indexOf('/', proto + 2)
    if (pathStart === -1) return '/'
    return s.slice(pathStart)
  }
  return s.startsWith('/') ? s : `/${s}`
}

/**
 * 生成对外可访问的播放地址：有基址则「基址 + 路径」；否则沿用原文。
 * @param {string|null|undefined} urlRaw 回调或库中的 playlist / 主视频 URL 或路径
 * @param {string|null|undefined} [originOverride] 非空时优先作为对外基址（如企微 PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL）
 */
function buildPresalesVideoPublicPlayUrl(urlRaw, originOverride) {
  const raw = urlRaw != null ? String(urlRaw).trim() : ''
  if (!raw) return ''
  let origin = null
  if (originOverride != null && String(originOverride).trim() !== '') {
    origin = String(originOverride).trim().replace(/\/+$/, '')
  } else {
    origin = getPsvVideoInfoPublicOrigin()
  }
  if (!origin) return raw
  const pathPart = extractPathFromPsvSourceUrl(raw)
  if (!pathPart) return ''
  return `${origin}${pathPart}`
}

/**
 * video_create 成功：同步售前视频元数据表（供播放端等查询）
 * 有 playlist：url 与 reserve_5 一致（clipReserve5）；cover 由完整 playlist 将末段换为 cover.jpg
 * 无 playlist：url 仍用对外基址 + 主视频；cover 由主视频 URL 同规则推导（可能为 …/cover.jpg）
 */
async function upsertPsvVideoInfoOnVideoCreate(executeId, transcriptionId, mainVideoUrl, playlistUrl) {
  const id = clipPsvVideoInfoId(executeId)
  const pl = playlistUrl != null && String(playlistUrl).trim() !== '' ? String(playlistUrl).trim() : ''
  const main = mainVideoUrl != null && String(mainVideoUrl).trim() !== '' ? String(mainVideoUrl).trim() : ''

  let title = ''
  try {
    const trRow = await prisma.transcriptions.findUnique({
      where: { id: transcriptionId },
      select: { original_file_name: true, name: true }
    })
    const o = trRow?.original_file_name != null ? String(trRow.original_file_name).trim() : ''
    const n = trRow?.name != null ? String(trRow.name).trim() : ''
    title = o || n || ''
  } catch (e) {
    logger.warn('[presales-video-task] psv_video_info 读取转录录音名失败:', e.message)
  }
  if (!title) title = id || '售前视频'
  const titleDb = clipPsvVideoInfoTitle(mergedDialogueService.stripWorkflowCozeParam(title))

  const reserve5Same = pl ? clipReserve5(pl) : null
  const urlRawForPublicFallback = pl || main
  const url = reserve5Same
    ? clipPsvVideoInfoUrl(reserve5Same)
    : clipPsvVideoInfoUrl(buildPresalesVideoPublicPlayUrl(urlRawForPublicFallback))

  const coverSource = pl || main
  const coverRaw = coverSource ? coverUrlByReplacingLastPathSegmentWithCoverJpg(coverSource) : null
  const cover = coverRaw ? clipPsvVideoInfoUrl(coverRaw) : null

  await prisma.psv_video_info.upsert({
    where: { id },
    create: {
      id,
      title: titleDb,
      url,
      cover: cover || null
    },
    update: {
      title: titleDb,
      url,
      cover: cover || null,
      updated_at: new Date()
    }
  })
}

function clipLastError(val) {
  if (val == null) return null
  const s = String(val)
  if (s.length <= LAST_ERROR_MAX_LEN) return s
  return s.slice(0, LAST_ERROR_MAX_LEN)
}

/** 入库 reserve_3：与 schema VarChar(500) 一致 */
function clipReserve3Path(val) {
  if (val == null || String(val).trim() === '') return null
  const s = String(val)
  if (s.length <= RESERVE3_MAX_LEN) return s
  logger.warn(
    `[presales-video-task] reserve_3 路径超过 ${RESERVE3_MAX_LEN} 字符已截断（完整路径见本次 analysisMarkdownPath 或日志）`
  )
  return s.slice(0, RESERVE3_MAX_LEN)
}

/** 入库 reserve_5（播放列表 URL 等）：与 schema VarChar(500) 一致 */
function clipReserve5(val) {
  if (val == null || String(val).trim() === '') return null
  const s = String(val)
  if (s.length <= RESERVE5_MAX_LEN) return s
  logger.warn(`[presales-video-task] reserve_5（playlist_url）超过 ${RESERVE5_MAX_LEN} 字符已截断`)
  return s.slice(0, RESERVE5_MAX_LEN)
}

function clipVideoAddress(val) {
  if (val == null) return { text: null, truncated: false }
  const s = String(val)
  if (s.length <= VIDEO_ADDRESS_MAX_LEN) return { text: s, truncated: false }
  return { text: s.slice(0, VIDEO_ADDRESS_MAX_LEN), truncated: true }
}

function normalizeAnalysisContent(val) {
  if (val == null) return null
  return String(val)
}

/**
 * 将正文里误存成的「字面量 \n / \t」（反斜杠 + 字母）还原为真实换行/制表。
 * 常见于回调体被二次 JSON 编码；不处理时整篇在编辑器里会变成一行，且无法按行折行。
 * 仅在字面量 \\n 明显多于真实换行时处理，降低误伤含「\\n」说明文字的概率。
 */
function normalizeLiteralEscapedNewlines(text) {
  if (text == null) return text
  const s = String(text)
  if (s.length === 0 || !s.includes('\\n')) return s
  const literalCount = (s.match(/\\n/g) || []).length
  const realNewlines = (s.match(/\n/g) || []).length
  if (literalCount < 2) return s
  const shouldUnescape =
    (realNewlines <= 2 && literalCount >= realNewlines + 1) ||
    literalCount > realNewlines * 3 ||
    (literalCount >= 8 && realNewlines * 4 < literalCount)
  if (!shouldUnescape) return s
  let out = s.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  if (out.includes('\\n')) {
    out = out.replace(/\\\\n/g, '\n')
  }
  logger.info(
    `[presales-video-task] 字面量换行已规范化 len=${s.length} literalSlashN=${literalCount} realNL=${realNewlines}`
  )
  return out
}

/** 文件名片段：去掉路径非法字符 */
function safeFilenamePart(s) {
  if (s == null || String(s).trim() === '') return 'unknown'
  return String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120)
}

function getAnalysisMarkdownDir() {
  const fromEnv = process.env.PRESALES_VIDEO_ANALYSIS_MD_DIR
  if (fromEnv && String(fromEnv).trim()) {
    return path.resolve(String(fromEnv).trim())
  }
  return path.resolve(path.join(__dirname, '../../uploads_data/presales_video_analysis_md'))
}

/**
 * 将分析正文落盘为 .md（与入库并行语义：失败只打日志，不抛错）
 * @param {string|null|undefined} recordingDisplayName 录音显示名：original_file_name 或 name；有则 md 文件名为其安全化 + .md
 * @returns {Promise<{ absolutePath: string|null, writeError: string|null }>}
 */
async function writeAnalysisContentMarkdownFile(
  transcriptionId,
  executeId,
  rawText,
  recordingDisplayName = null
) {
  const body = normalizeAnalysisContent(rawText)
  if (!body || !body.trim()) {
    return { absolutePath: null, writeError: null }
  }
  const dir = getAnalysisMarkdownDir()
  const hasRecordingName = recordingDisplayName != null && String(recordingDisplayName).trim() !== ''
  const fileName = hasRecordingName
    ? mergedDialogueService.buildSafeMarkdownFilename(recordingDisplayName)
    : `${safeFilenamePart(transcriptionId)}_${safeFilenamePart(executeId)}.md`
  if (!hasRecordingName) {
    logger.warn(
      '[presales-video-task] 无录音文件名，analysis md 文件名回退为 transcriptionId_executeId.md'
    )
  }
  const absolutePath = path.join(dir, fileName)
  try {
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(absolutePath, body, 'utf8')
    logger.info(
      `[presales-video-task] analysis_content 已写入 md transcription=${transcriptionId} path=${absolutePath}`
    )
    return { absolutePath, writeError: null }
  } catch (e) {
    const msg = (e && e.message) || String(e)
    logger.error('[presales-video-task] analysis_content 写 md 失败:', msg)
    return { absolutePath: null, writeError: msg }
  }
}

async function getByExecuteId(executeId) {
  if (executeId == null || String(executeId).trim() === '') return null
  return prisma.presales_video_tasks.findFirst({
    where: { execute_id: String(executeId).trim() }
  })
}

/**
 * 工作流异步回调：按 execute_id 更新流水线状态与备用字段
 * @param {'analysis_content'|'video_create'} callbackType
 * @param {string|null} payloadText 分析文本或视频路径（success 时）；fail 时可作错误说明
 * @param {'success'|'fail'} outcome 成功或失败；缺省为 success（兼容旧回调）
 * @param {{ playlistUrl?: string|null }} [options] video_create 成功时：可选 playlist_url，写入 reserve_5
 * @returns {Promise<{ ok: boolean, task?: object, code?: string, message?: string, truncated?: boolean, analysisMarkdownPath?: string|null, analysisMarkdownWriteError?: string|null }>}
 */
/**
 * 按 lead_code/lead_id/lead_name/customer_name 统计 communication_reports 次数，
 * 并取 最早一条 与 最新一条（按 created_at asc）的 report_date/main_content
 */
async function buildFrequencySection(transcriptionId) {
  try {
    const tr = await prisma.transcriptions.findUnique({
      where: { id: String(transcriptionId || '') },
      select: { report_id: true, session_id: true, customer_name: true }
    })
    if (!tr) return null

    // 先按 transcriptions.report_id 找到当前报备
    let currentReport = null
    const rid = String(tr.report_id || tr.session_id || '').trim()
    if (rid) {
      currentReport = await prisma.communication_reports.findUnique({ where: { id: rid } })
    }

    // 无法精确关联则靠客户名兜底
    if (!currentReport && tr.customer_name) {
      currentReport = await prisma.communication_reports.findFirst({
        where: { customer_name: String(tr.customer_name).trim() },
        orderBy: { created_at: 'desc' }
      })
    }
    if (!currentReport) return null

    // 同线索的所有报备（按时间升序）
    const keyWhere = currentReport.lead_code
      ? { lead_code: String(currentReport.lead_code).trim() }
      : currentReport.lead_id
        ? { lead_id: String(currentReport.lead_id).trim() }
        : currentReport.lead_name
          ? { lead_name: String(currentReport.lead_name).trim() }
          : { customer_name: String(currentReport.customer_name).trim() }

    const allReports = await prisma.communication_reports.findMany({
      where: keyWhere,
      orderBy: { created_at: 'asc' },
      select: { id: true, report_date: true, main_content: true, created_at: true }
    })

    const total = allReports.length
    const first = allReports[0] || null

    function pickDateFromReport(r) {
      if (!r) return null
      // 优先 report_date
      if (r.report_date) {
        const d = new Date(r.report_date)
        if (!Number.isNaN(d.getTime())) return d
      }
      // 从 main_content 里尝试提取日期（简单正则）
      if (r.main_content) {
        const m = String(r.main_content).match(/(\d{4})[年\-\/](\d{1,2})[月\-\/](\d{1,2})/)
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      }
      return null
    }

    function formatYmd(d) {
      if (!d || Number.isNaN(d.getTime())) return null
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
    }

    const currentDate = pickDateFromReport(currentReport)
    const firstDate = pickDateFromReport(first)

    const lines = ['', '### 交流频次与时间']
    lines.push(`- 线索交流次数：第${total}次`)
    if (currentDate) lines.push(`- 本次交流时间：${formatYmd(currentDate)}`)
    if (total > 1 && first && firstDate) {
      lines.push(`- 首次交流时间：${formatYmd(firstDate)}`)
    }
    lines.push('')
    return lines.join('\n')
  } catch (e) {
    logger.warn('[presales-video-task] buildFrequencySection 失败:', e && e.message)
    return null
  }
}

/**
 * 将频次段插入到"## 概述"章节的末尾（即下一个 ## 章节之前）
 * 找不到概述章节时追加到正文末尾
 */
function injectFrequencySectionAfterSummary(content, frequencyMd) {
  if (!frequencyMd) return content
  const s = String(content || '')
  // 找含"概述"字样的任意级别标题行（兼容 ## 一、 概述 / ##概述 / ### **概述** 等格式）
  const summaryRe = /^(#{1,4}[^\n]*概述)/im
  const match = summaryRe.exec(s)
  if (!match) {
    return s.trimEnd() + '\n' + frequencyMd
  }
  // 找概述后面下一个同级（或更高）标题的位置
  const headLevel = (match[0].match(/^#+/) || ['##'])[0].length
  const afterSummary = s.slice(match.index + match[0].length)
  const nextHeadRe = new RegExp(`^#{1,${headLevel}}\\s`, 'm')
  const nextMatch = nextHeadRe.exec(afterSummary)
  if (!nextMatch) {
    return s.trimEnd() + '\n' + frequencyMd
  }
  const insertAt = match.index + match[0].length + nextMatch.index
  return s.slice(0, insertAt).trimEnd() + '\n' + frequencyMd + '\n' + s.slice(insertAt)
}

async function applyWorkflowCallback(callbackType, executeId, payloadText, outcome = 'success', options = {}) {
  const task = await getByExecuteId(executeId)
  if (!task) {
    return { ok: false, code: 'NOT_FOUND', message: '未找到与 execute_id 匹配的主任务记录' }
  }

  const isFail = outcome === 'fail'

  if (callbackType === 'analysis_content') {
    if (isFail) {
      const err = clipLastError(payloadText) || '分析失败'
      const updated = await prisma.presales_video_tasks.update({
        where: { id: task.id },
        data: {
          pipeline_status: PipelineStatus.ANALYSIS_FAILED,
          last_error: err,
          reserve_3: null
        }
      })
      return { ok: true, task: updated, truncated: false }
    }
    const rawText = normalizeLiteralEscapedNewlines(normalizeAnalysisContent(payloadText))
    const frequencyMd = await buildFrequencySection(task.transcription_id)
    const text = injectFrequencySectionAfterSummary(rawText, frequencyMd)
    const execKey = String(executeId).trim()

    let recordingDisplayName = null
    try {
      const trRow = await prisma.transcriptions.findUnique({
        where: { id: task.transcription_id },
        select: { original_file_name: true, name: true }
      })
      const o = trRow?.original_file_name != null ? String(trRow.original_file_name).trim() : ''
      const n = trRow?.name != null ? String(trRow.name).trim() : ''
      recordingDisplayName = o || n || null
    } catch (e) {
      logger.warn('[presales-video-task] 读取转录录音文件名失败:', e.message)
    }

    const { absolutePath, writeError } = await writeAnalysisContentMarkdownFile(
      task.transcription_id,
      execKey,
      text,
      recordingDisplayName
    )
    const reserve3Value = absolutePath ? clipReserve3Path(absolutePath) : null
    const updated = await prisma.presales_video_tasks.update({
      where: { id: task.id },
      data: {
        pipeline_status: PipelineStatus.ANALYSIS_DONE,
        analysis_content: text,
        last_error: null,
        reserve_3: reserve3Value
      }
    })
    return {
      ok: true,
      task: updated,
      truncated: false,
      analysisMarkdownPath: absolutePath,
      analysisMarkdownWriteError: writeError || undefined
    }
  }

  if (callbackType === 'video_create') {
    if (isFail) {
      const err = clipLastError(payloadText) || '视频生成失败'
      const updated = await prisma.presales_video_tasks.update({
        where: { id: task.id },
        data: {
          pipeline_status: PipelineStatus.VIDEO_FAILED,
          last_error: err
        }
      })
      return { ok: true, task: updated, truncated: false }
    }
    const { text, truncated } = clipVideoAddress(payloadText)
    const data = {
      pipeline_status: PipelineStatus.VIDEO_DONE,
      video_address: text,
      last_error: null
    }
    const pl = options.playlistUrl
    if (pl != null && String(pl).trim() !== '') {
      data.reserve_5 = clipReserve5(pl)
    }
    const updated = await prisma.presales_video_tasks.update({
      where: { id: task.id },
      data
    })
    try {
      await upsertPsvVideoInfoOnVideoCreate(
        executeId,
        task.transcription_id,
        text,
        options.playlistUrl
      )
    } catch (e) {
      logger.warn(
        '[presales-video-task] video_create 同步 psv_video_info 失败（主任务已更新）:',
        e && e.message
      )
    }
    return { ok: true, task: updated, truncated }
  }

  return {
    ok: false,
    code: 'INVALID_TYPE',
    message: 'type 必须为 analysis_content 或 video_create'
  }
}

function toApiShape(row) {
  if (!row) return null
  return {
    mainTaskId: row.id,
    transcriptionId: row.transcription_id,
    cozeFileId: row.coze_file_id,
    cozeFileName: row.coze_file_name,
    localDialogueTxtPath: row.local_dialogue_txt_path,
    executeId: row.execute_id,
    pipelineStatus: row.pipeline_status,
    analysisContent: row.analysis_content,
    videoAddress: row.video_address,
    reserve3: row.reserve_3,
    reserve4: row.reserve_4,
    reserve5: row.reserve_5,
    lastError: row.last_error,
    updatedAt: row.updated_at
  }
}

/** 解析后的 md 绝对路径须落在分析目录下，防止路径穿越 */
function resolveAnalysisMdPathUnderDir(reserve3Raw) {
  const r = reserve3Raw != null ? String(reserve3Raw).trim() : ''
  if (!r) return null
  const mdDir = getAnalysisMarkdownDir()
  const candidate = path.isAbsolute(r) ? path.resolve(r) : path.resolve(mdDir, r)
  const dir = path.resolve(mdDir)
  const base = dir.endsWith(path.sep) ? dir : dir + path.sep
  if (candidate === dir) return null
  if (!candidate.startsWith(base)) return null
  return candidate
}

/**
 * 供推送前预览/编辑：优先读 reserve_3 对应 md；不存在则读库中 analysis_content
 * @returns {Promise<{ ok: true, content: string, readFromFile: boolean, reserve3: string|null } | { ok: false, code: string, message: string }>}
 */
async function readAnalysisForPushEdit(transcriptionId) {
  const task = await getByTranscriptionId(transcriptionId)
  if (!task) {
    return { ok: false, code: 'NO_TASK', message: '无主任务记录' }
  }
  const resolved = resolveAnalysisMdPathUnderDir(task.reserve_3)
  if (resolved) {
    try {
      const rawFile = await fs.readFile(resolved, 'utf8')
      const content = normalizeLiteralEscapedNewlines(rawFile)
      return {
        ok: true,
        content,
        readFromFile: true,
        reserve3: task.reserve_3 != null ? String(task.reserve_3).trim() : null
      }
    } catch (e) {
      if (e && e.code !== 'ENOENT') {
        return { ok: false, code: 'READ_ERR', message: (e && e.message) || '读取 md 失败' }
      }
    }
  }
  const ac = normalizeLiteralEscapedNewlines(normalizeAnalysisContent(task.analysis_content))
  if (ac && ac.trim()) {
    return {
      ok: true,
      content: ac,
      readFromFile: false,
      reserve3: task.reserve_3 != null ? String(task.reserve_3).trim() : null
    }
  }
  return { ok: false, code: 'EMPTY', message: '暂无分析正文或 md 文件，请先完成分析回调' }
}

/**
 * 保存编辑后的分析正文：写入允许目录下的 md，并同步 analysis_content / reserve_3
 * @returns {Promise<{ ok: true, reserve3: string|null } | { ok: false, code: string, message: string }>}
 */
async function saveAnalysisForPushEdit(transcriptionId, rawBody) {
  const text = normalizeLiteralEscapedNewlines(normalizeAnalysisContent(rawBody))
  if (!text || !text.trim()) {
    return { ok: false, code: 'EMPTY', message: '正文不能为空' }
  }
  const task = await getByTranscriptionId(transcriptionId)
  if (!task) {
    return { ok: false, code: 'NO_TASK', message: '无主任务记录' }
  }

  let targetPath = resolveAnalysisMdPathUnderDir(task.reserve_3)

  if (!targetPath) {
    const execKey = task.execute_id != null ? String(task.execute_id).trim() : 'manual'
    let recordingDisplayName = null
    try {
      const trRow = await prisma.transcriptions.findUnique({
        where: { id: transcriptionId },
        select: { original_file_name: true, name: true }
      })
      const o = trRow?.original_file_name != null ? String(trRow.original_file_name).trim() : ''
      const n = trRow?.name != null ? String(trRow.name).trim() : ''
      recordingDisplayName = o || n || null
    } catch (e) {
      logger.warn('[presales-video-task] saveAnalysisForPushEdit 读取转录文件名失败:', e.message)
    }
    const { absolutePath, writeError } = await writeAnalysisContentMarkdownFile(
      transcriptionId,
      execKey,
      text,
      recordingDisplayName
    )
    if (writeError || !absolutePath) {
      return { ok: false, code: 'WRITE_FAIL', message: writeError || '无法写入 md 文件' }
    }
    targetPath = absolutePath
  } else {
    try {
      await fs.mkdir(path.dirname(targetPath), { recursive: true })
      await fs.writeFile(targetPath, text, 'utf8')
    } catch (e) {
      return { ok: false, code: 'WRITE_FAIL', message: (e && e.message) || '写入 md 失败' }
    }
  }

  const reserve3Value = clipReserve3Path(targetPath)
  await prisma.presales_video_tasks.update({
    where: { transcription_id: transcriptionId },
    data: {
      analysis_content: text,
      reserve_3: reserve3Value
    }
  })
  return { ok: true, reserve3: reserve3Value }
}

module.exports = {
  PipelineStatus,
  getByTranscriptionId,
  getByExecuteId,
  getOrCreateTask,
  saveAfterLocalTxt,
  saveAfterCozeUpload,
  saveAfterSubmitWorkflow,
  updatePipelineStatus,
  applyWorkflowCallback,
  toApiShape,
  buildPresalesVideoPublicPlayUrl,
  readAnalysisForPushEdit,
  saveAnalysisForPushEdit,
  /** 与 psv_video_info.id 入库规则一致（最长 64），企微卡片 {id} 须用此值才能对上库 */
  clipExecuteIdForPsvVideoInfo: clipPsvVideoInfoId
}
