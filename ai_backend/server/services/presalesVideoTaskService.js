/**
 * 售前视频生成主任务：Coze 上传与工作流信息落库
 *
 * analysis_content 回调成功时，内容除入库外会写入本地 .md（目录见 PRESALES_VIDEO_ANALYSIS_MD_DIR），文件名为录音显示名安全化 + .md（original_file_name / name），成功落盘路径写入 reserve_3（最长 500 字符，超出截断）
 */

const fs = require('fs/promises')
const path = require('path')
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const mergedDialogueService = require('./transcriptionMergedDialogueService')

const prisma = new PrismaClient()

/** 流水线状态（与库中 pipeline_status 一致） */
const PipelineStatus = {
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

/** video_address / last_error 等列 VarChar(2000)；reserve_3 VarChar(500) */
const VIDEO_ADDRESS_MAX_LEN = 2000
const LAST_ERROR_MAX_LEN = 2000
const RESERVE3_MAX_LEN = 500

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
 * @returns {Promise<{ ok: boolean, task?: object, code?: string, message?: string, truncated?: boolean, analysisMarkdownPath?: string|null, analysisMarkdownWriteError?: string|null }>}
 */
async function applyWorkflowCallback(callbackType, executeId, payloadText, outcome = 'success') {
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
    const text = normalizeAnalysisContent(payloadText)
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
    const updated = await prisma.presales_video_tasks.update({
      where: { id: task.id },
      data: {
        pipeline_status: PipelineStatus.VIDEO_DONE,
        video_address: text,
        last_error: null
      }
    })
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
  toApiShape
}
