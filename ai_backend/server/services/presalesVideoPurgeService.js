/**
 * 售前视频生成页 · 删除整条转录及其流水线衍生数据。
 * 不删：CRM 源文件、log_sync_status、concerns、报备/场次/产品、crm_report_file 行。
 */

const fs = require('fs/promises')
const path = require('path')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')

function normPath(p) {
  if (p == null || String(p).trim() === '') return ''
  return path.normalize(String(p).trim())
}

async function loadCrmLocalPathSet() {
  const rows = await prisma.crm_report_file.findMany({
    where: { local_file_path: { not: null } },
    select: { local_file_path: true }
  })
  const set = new Set()
  for (const r of rows) {
    const n = normPath(r.local_file_path)
    if (n) set.add(n)
  }
  return set
}

function isCrmSourcePath(filePath, crmPathSet) {
  const n = normPath(filePath)
  if (!n) return false
  return crmPathSet.has(n)
}

async function safeUnlink(filePath, crmPathSet, deletedFiles, skippedFiles) {
  const n = normPath(filePath)
  if (!n) return
  if (isCrmSourcePath(n, crmPathSet)) {
    skippedFiles.push(n)
    return
  }
  try {
    await fs.unlink(n)
    deletedFiles.push(n)
  } catch (e) {
    if (e && e.code === 'ENOENT') return
    logger.warn(`[presales-video-purge] 删除文件失败 path=${n}: ${e && e.message}`)
  }
}

async function supersedeActivePipelineRuns(transcriptionId) {
  const r = await prisma.presales_video_pipeline_runs.updateMany({
    where: { transcription_id: transcriptionId, run_status: 'active' },
    data: {
      run_status: 'failed',
      phase: 'superseded',
      last_error: '转录已删除，流水线已终止'
    }
  })
  return r.count
}

async function deletePsvVideoByExecuteId(executeId) {
  const id = executeId != null ? String(executeId).trim() : ''
  if (!id) return { psvDeleted: false, watchDeleted: 0 }
  const wh = await prisma.psv_watch_history.deleteMany({ where: { video_id: id } })
  try {
    await prisma.psv_video_info.delete({ where: { id } })
    return { psvDeleted: true, watchDeleted: wh.count }
  } catch (e) {
    if (e && e.code === 'P2025') {
      return { psvDeleted: false, watchDeleted: wh.count }
    }
    throw e
  }
}

/**
 * @param {string} transcriptionId
 * @returns {Promise<{ transcriptionId: string, deletedFiles: string[], skippedFiles: string[], pipelineRunsSuperseded: number, psvVideoInfoDeleted: boolean }>}
 */
async function purgeTranscription(transcriptionId) {
  const id = transcriptionId != null ? String(transcriptionId).trim() : ''
  if (!id) throw new Error('缺少 transcriptionId')

  const tr = await prisma.transcriptions.findUnique({ where: { id } })
  if (!tr) throw new Error('转录不存在')
  if (String(tr.status || '') !== 'completed') {
    throw new Error('仅允许删除转录状态为「已完成」的记录')
  }

  const crmPathSet = await loadCrmLocalPathSet()
  const deletedFiles = []
  const skippedFiles = []

  let task = null
  try {
    task = await prisma.presales_video_tasks.findUnique({ where: { transcription_id: id } })
  } catch (e) {
    logger.warn('[presales-video-purge] 读取 presales_video_tasks 失败:', e.message)
  }

  const pipelineRunsSuperseded = await supersedeActivePipelineRuns(id)

  const pathsToTry = []
  if (task) {
    if (task.local_dialogue_txt_path) pathsToTry.push(task.local_dialogue_txt_path)
    if (task.reserve_3) pathsToTry.push(task.reserve_3)
  }
  if (tr.result_file_path) pathsToTry.push(tr.result_file_path)
  if (tr.audio_file_path) pathsToTry.push(tr.audio_file_path)

  const seen = new Set()
  for (const p of pathsToTry) {
    const n = normPath(p)
    if (!n || seen.has(n)) continue
    seen.add(n)
    await safeUnlink(n, crmPathSet, deletedFiles, skippedFiles)
  }

  let psvResult = { psvDeleted: false, watchDeleted: 0 }
  if (task && task.execute_id) {
    try {
      psvResult = await deletePsvVideoByExecuteId(task.execute_id)
    } catch (e) {
      logger.warn(`[presales-video-purge] 删除 psv_video_info 失败 transcription=${id}:`, e.message)
    }
  }

  await prisma.transcriptions.delete({ where: { id } })

  logger.info(
    `[presales-video-purge] 已删除转录 transcription=${id} files=${deletedFiles.length} skipped=${skippedFiles.length} pipelineSuperseded=${pipelineRunsSuperseded} psv=${psvResult.psvDeleted}`
  )

  return {
    transcriptionId: id,
    deletedFiles,
    skippedFiles,
    pipelineRunsSuperseded,
    psvVideoInfoDeleted: psvResult.psvDeleted,
    psvWatchHistoryDeleted: psvResult.watchDeleted
  }
}

module.exports = {
  purgeTranscription,
  isCrmSourcePath,
  loadCrmLocalPathSet
}
