/**
 * 售前视频 · 服务端自动流水线（方案 B）
 * 通过回环 HTTP 调用现有 /api/presales-video/* 接口，定时轮询 + 工作流回调/外链保存后唤醒。
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const presalesVideoTaskService = require('./presalesVideoTaskService')

const prisma = new PrismaClient()
const { PipelineStatus } = presalesVideoTaskService

const locks = new Set()

function getInternalBaseUrl() {
  const fromEnv = process.env.PRESALES_VIDEO_PIPELINE_INTERNAL_BASE_URL
  if (fromEnv && String(fromEnv).trim()) {
    return String(fromEnv).trim().replace(/\/$/, '')
  }
  const port = process.env.PORT || 3000
  return `http://127.0.0.1:${port}`
}

async function internalPost(path, bodyObj) {
  const url = `${getInternalBaseUrl()}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyObj != null ? bodyObj : {})
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // ignore
  }
  return { ok: res.ok, status: res.status, json, text }
}

function pickErr(r) {
  if (r.json && r.json.error) return String(r.json.error)
  if (r.json && r.json.message) return String(r.json.message)
  if (r.text && r.text.length < 800) return r.text
  return `HTTP ${r.status}`
}

function isSpeakerConfirmed(pipelineStatus) {
  const p = String(pipelineStatus || '')
  return p === PipelineStatus.SPEAKER_CONFIRMED || p === '已确认'
}

async function failRun(runId, message) {
  const msg = String(message || '未知错误').slice(0, 1900)
  await prisma.presales_video_pipeline_runs.update({
    where: { id: runId },
    data: { run_status: 'failed', last_error: msg, phase: 'failed' }
  })
  logger.warn(`[presales-video-pipeline] run=${runId} failed: ${msg}`)
}

async function completeRun(runId) {
  await prisma.presales_video_pipeline_runs.update({
    where: { id: runId },
    data: { run_status: 'completed', phase: 'done', last_error: null }
  })
  logger.info(`[presales-video-pipeline] run=${runId} completed`)
}

async function loadTask(transcriptionId) {
  try {
    return await presalesVideoTaskService.getByTranscriptionId(transcriptionId)
  } catch (e) {
    logger.warn('[presales-video-pipeline] loadTask:', e.message)
    return null
  }
}

/**
 * 推进一步；返回 true 表示可能还有后续，调用方可继续循环。
 */
async function advanceOneStep(run) {
  const { id: runId, transcription_id: tid, phase, wecom_user_id: wx, push_video_user_ids: pvUsers } = run

  if (run.run_status !== 'active') return false

  if (phase === 'init') {
    if (run.skip_role_confirm) {
      await prisma.presales_video_pipeline_runs.update({
        where: { id: runId },
        data: { phase: 'push_dialogue' }
      })
      return true
    }
    const r = await internalPost(`/api/presales-video/transcriptions/${tid}/notify-role-confirm`, {
      wecomUserId: wx
    })
    if (!r.ok || !r.json || r.json.success !== true) {
      await failRun(runId, pickErr(r))
      return false
    }
    await prisma.presales_video_pipeline_runs.update({
      where: { id: runId },
      data: { phase: 'wait_speaker' }
    })
    return false
  }

  if (phase === 'wait_speaker') {
    const task = await loadTask(tid)
    const ps = task?.pipeline_status || ''
    if (!isSpeakerConfirmed(ps)) return false
    await prisma.presales_video_pipeline_runs.update({
      where: { id: runId },
      data: { phase: 'push_dialogue' }
    })
    return true
  }

  if (phase === 'push_dialogue') {
    const r = await internalPost(`/api/presales-video/transcriptions/${tid}/push-dialogue`, {})
    if (!r.ok || !r.json || r.json.success !== true) {
      await failRun(runId, `推送对话: ${pickErr(r)}`)
      return false
    }
    const data = r.json.data || {}
    if (data.uploadSkipped) {
      await failRun(runId, '未配置 Coze 文件上传或已跳过上传，无法自动提交工作流')
      return false
    }
    await prisma.presales_video_pipeline_runs.update({
      where: { id: runId },
      data: { phase: 'submit_workflow' }
    })
    return true
  }

  if (phase === 'submit_workflow') {
    const r = await internalPost(`/api/presales-video/transcriptions/${tid}/submit-workflow`, {})
    if (!r.ok || !r.json || r.json.success !== true) {
      await failRun(runId, `提交工作流: ${pickErr(r)}`)
      return false
    }
    await prisma.presales_video_pipeline_runs.update({
      where: { id: runId },
      data: { phase: 'wait_analysis' }
    })
    return false
  }

  if (phase === 'wait_analysis') {
    const task = await loadTask(tid)
    const ps = task?.pipeline_status || ''
    if (ps === PipelineStatus.ANALYSIS_FAILED) {
      await failRun(runId, task?.last_error ? `分析失败: ${task.last_error}` : '分析失败')
      return false
    }
    if (ps === PipelineStatus.ANALYSIS_DONE) {
      const r3 = task?.reserve_3 != null ? String(task.reserve_3).trim() : ''
      if (!r3) {
        await failRun(runId, '分析已完成但缺少 reserve_3（.md 路径），无法推送报告')
        return false
      }
      await prisma.presales_video_pipeline_runs.update({
        where: { id: runId },
        data: { phase: 'push_report' }
      })
      return true
    }
    return false
  }

  if (phase === 'push_report') {
    const r = await internalPost(`/api/presales-video/transcriptions/${tid}/push-report`, {})
    const success = r.ok && r.json && r.json.success === true
    if (!success) {
      await failRun(runId, `推送报告: ${pickErr(r)}`)
      return false
    }
    await prisma.presales_video_pipeline_runs.update({
      where: { id: runId },
      data: { phase: 'wait_video' }
    })
    return false
  }

  if (phase === 'wait_video') {
    const task = await loadTask(tid)
    const ps = task?.pipeline_status || ''
    if (ps === PipelineStatus.VIDEO_FAILED) {
      await failRun(runId, task?.last_error ? `视频失败: ${task.last_error}` : '视频生成失败')
      return false
    }
    if (ps === PipelineStatus.VIDEO_DONE) {
      const addr = task?.video_address != null ? String(task.video_address).trim() : ''
      if (!addr) {
        await failRun(runId, '流水线为视频生成但 video_address 为空')
        return false
      }
      await prisma.presales_video_pipeline_runs.update({
        where: { id: runId },
        data: { phase: 'push_video' }
      })
      return true
    }
    return false
  }

  if (phase === 'push_video') {
    const userIds = pvUsers != null ? String(pvUsers).trim() : ''
    if (!userIds) {
      await failRun(runId, '缺少 push_video_user_ids')
      return false
    }
    const r = await internalPost(`/api/presales-video/transcriptions/${tid}/push-video`, {
      userIds
    })
    if (!r.ok || !r.json || r.json.success !== true) {
      await failRun(runId, `推送视频: ${pickErr(r)}`)
      return false
    }
    await completeRun(runId)
    return false
  }

  return false
}

async function processRunOnce(runId) {
  if (locks.has(runId)) return
  locks.add(runId)
  try {
    for (let i = 0; i < 20; i++) {
      const run = await prisma.presales_video_pipeline_runs.findUnique({ where: { id: runId } })
      if (!run || run.run_status !== 'active') return
      const more = await advanceOneStep(run)
      if (!more) return
    }
    logger.warn(`[presales-video-pipeline] run=${runId} 单轮步数过多，下轮定时器继续`)
  } catch (e) {
    logger.error('[presales-video-pipeline] processRunOnce:', e)
    try {
      await failRun(runId, e.message || String(e))
    } catch (e2) {
      /* ignore */
    }
  } finally {
    locks.delete(runId)
  }
}

async function notifyTranscriptionUpdated(transcriptionId) {
  if (!transcriptionId) return
  const runs = await prisma.presales_video_pipeline_runs.findMany({
    where: { transcription_id: String(transcriptionId), run_status: 'active' },
    select: { id: true }
  })
  for (const r of runs) {
    await processRunOnce(r.id)
  }
}

async function processActiveRuns() {
  const rows = await prisma.presales_video_pipeline_runs.findMany({
    where: { run_status: 'active' },
    select: { id: true },
    take: 50,
    orderBy: { updated_at: 'asc' }
  })
  for (const r of rows) {
    await processRunOnce(r.id)
  }
}

/**
 * @param {{ transcriptionId: string, wecomUserId?: string, pushVideoUserIds?: string, skipRoleConfirm?: boolean }} opts
 */
async function startPipelineRun(opts) {
  const transcriptionId = opts.transcriptionId != null ? String(opts.transcriptionId).trim() : ''
  if (!transcriptionId) throw new Error('缺少 transcriptionId')

  const tr = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!tr) throw new Error('转录不存在')
  if (String(tr.status || '') !== 'completed') throw new Error('转录须为已完成（completed）')

  const defaultPush = process.env.PRESALES_VIDEO_PIPELINE_DEFAULT_PUSH_VIDEO_USERIDS
  const pvUsers =
    (opts.pushVideoUserIds != null && String(opts.pushVideoUserIds).trim()) ||
    (defaultPush != null && String(defaultPush).trim()) ||
    ''
  if (!pvUsers) {
    throw new Error('请传入 pushVideoUserIds，或配置环境变量 PRESALES_VIDEO_PIPELINE_DEFAULT_PUSH_VIDEO_USERIDS')
  }

  const skipRoleConfirm = Boolean(opts.skipRoleConfirm)
  let wx = opts.wecomUserId != null && String(opts.wecomUserId).trim() ? String(opts.wecomUserId).trim() : ''
  if (!skipRoleConfirm && !wx) {
    wx = tr.created_by != null && String(tr.created_by).trim() ? String(tr.created_by).trim() : ''
  }
  if (!skipRoleConfirm && !wx) {
    throw new Error('未指定 wecomUserId 且转录无 created_by，无法发送角色确认')
  }

  await prisma.presales_video_pipeline_runs.updateMany({
    where: { transcription_id: transcriptionId, run_status: 'active' },
    data: {
      run_status: 'failed',
      last_error: '已被新启动的服务端流水线取代',
      phase: 'superseded'
    }
  })

  const id = uuidv4()
  await prisma.presales_video_pipeline_runs.create({
    data: {
      id,
      transcription_id: transcriptionId,
      run_status: 'active',
      phase: 'init',
      wecom_user_id: wx || null,
      push_video_user_ids: pvUsers,
      skip_role_confirm: skipRoleConfirm
    }
  })

  await processRunOnce(id)
  return prisma.presales_video_pipeline_runs.findUnique({ where: { id } })
}

async function getRunsForTranscription(transcriptionId, limit = 10) {
  return prisma.presales_video_pipeline_runs.findMany({
    where: { transcription_id: String(transcriptionId) },
    orderBy: { updated_at: 'desc' },
    take: limit
  })
}

module.exports = {
  startPipelineRun,
  processActiveRuns,
  processRunOnce,
  notifyTranscriptionUpdated,
  getRunsForTranscription
}
