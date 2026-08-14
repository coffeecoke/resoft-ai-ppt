/**
 * 售前视频生成页 · 删除整条转录及其流水线衍生数据。
 * 不删：CRM 源文件、concerns、报备/场次/产品、crm_report_file 行。
 * 会把对应 crm_video_batch 的 log_sync_status 重置为 pending，便于重新转录后再次关联报备。
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

const CRM_VIDEO_SYNC_TYPE = 'crm_video_batch'

function crmVideoBatchId(crmId) {
  return `crm_video_${String(crmId)}`
}

function parseSyncParams(raw) {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...raw }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * 删除转录后，把同一 CRM 文件的视频跑批状态打回 pending。
 * 只重置：本条转录 ID、源文件完整路径、或全库唯一文件名 对应的日志。
 * 若日志仍指向另一条存活转录，不重置（避免误伤未删除的正式记录）。
 */
async function resetCrmVideoBatchAfterPurge(tr) {
  const tid = String((tr && tr.id) || '').trim()
  const audioPath = String((tr && tr.audio_file_path) || '').trim()
  const fileName = String((tr && tr.original_file_name) || '').trim()

  const batchIds = new Set()
  if (audioPath) {
    const byPath = await prisma.crm_report_file.findMany({
      where: { local_file_path: audioPath },
      select: { id: true }
    })
    for (const f of byPath) batchIds.add(crmVideoBatchId(f.id))
  }
  if (fileName) {
    const byName = await prisma.crm_report_file.findMany({
      where: { original_file_name: fileName },
      select: { id: true },
      take: 2
    })
    if (byName.length === 1) {
      batchIds.add(crmVideoBatchId(byName[0].id))
    }
  }

  const logOr = []
  if (batchIds.size > 0) logOr.push({ batch_id: { in: [...batchIds] } })
  if (tid) {
    logOr.push({
      sync_params: {
        path: ['transcription_id'],
        equals: tid
      }
    })
  }
  if (logOr.length === 0) return 0

  let rows = []
  try {
    rows = await prisma.log_sync_status.findMany({
      where: { sync_type: CRM_VIDEO_SYNC_TYPE, OR: logOr }
    })
  } catch (e) {
    logger.warn(`[presales-video-purge] 按 JSON 查跑批日志失败，改按 batch_id: ${e && e.message}`)
    if (batchIds.size === 0) return 0
    rows = await prisma.log_sync_status.findMany({
      where: { sync_type: CRM_VIDEO_SYNC_TYPE, batch_id: { in: [...batchIds] } }
    })
  }

  let resetCount = 0
  for (const row of rows) {
    const params = parseSyncParams(row.sync_params)
    const oldTid = String(params.transcription_id || '').trim()
    if (oldTid && oldTid !== tid) {
      const live = await prisma.transcriptions.findUnique({
        where: { id: oldTid },
        select: { id: true }
      })
      if (live) {
        logger.info(
          `[presales-video-purge] 跳过重置 ${row.batch_id}：仍指向存活转录 ${oldTid}`
        )
        continue
      }
    }
    delete params.transcription_id
    await prisma.log_sync_status.update({
      where: { batch_id: row.batch_id },
      data: {
        status: 'pending',
        sync_params: params,
        error_message: null,
        end_time: null
      }
    })
    resetCount += 1
  }
  return resetCount
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

  let crmVideoBatchReset = 0
  try {
    crmVideoBatchReset = await resetCrmVideoBatchAfterPurge(tr)
  } catch (e) {
    logger.warn(`[presales-video-purge] 重置 crm_video_batch 失败 transcription=${id}:`, e && e.message)
  }

  logger.info(
    `[presales-video-purge] 已删除转录 transcription=${id} files=${deletedFiles.length} skipped=${skippedFiles.length} pipelineSuperseded=${pipelineRunsSuperseded} psv=${psvResult.psvDeleted} crmBatchReset=${crmVideoBatchReset}`
  )

  return {
    transcriptionId: id,
    deletedFiles,
    skippedFiles,
    pipelineRunsSuperseded,
    psvVideoInfoDeleted: psvResult.psvDeleted,
    psvWatchHistoryDeleted: psvResult.watchDeleted,
    crmVideoBatchReset
  }
}

module.exports = {
  purgeTranscription,
  resetCrmVideoBatchAfterPurge,
  isCrmSourcePath,
  loadCrmLocalPathSet
}
