/**
 * 售前视频生成主任务：Coze 上传与工作流信息落库
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { v4: uuidv4 } = require('uuid')

const prisma = new PrismaClient()

/** 流水线状态（与库中 pipeline_status 一致） */
const PipelineStatus = {
  PUSH_DIALOGUE: '推送对话',
  SUBMIT_WORKFLOW: '提交工作流',
  ANALYZING: '分析中',
  ANALYSIS_DONE: '分析完成',
  PUSH_ANALYSIS_FILE: '推送分析文件',
  VIDEO_DONE: '视频生成'
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
    reserve1: row.reserve_1,
    reserve2: row.reserve_2,
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
  getOrCreateTask,
  saveAfterLocalTxt,
  saveAfterCozeUpload,
  saveAfterSubmitWorkflow,
  updatePipelineStatus,
  toApiShape
}
