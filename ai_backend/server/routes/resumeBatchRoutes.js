/**
 * 批量简历拆解：HTTP 封装，逻辑见 server/services/resumeBatchScanService.js
 */

const express = require('express')
const {
  resolveAndValidateRoot,
  runResumeBatchScan,
} = require('../services/resumeBatchScanService')

const router = express.Router()

const jobs = new Map()
let activeJobId = null

function newJobId () {
  return `rb_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function appendLog (job, line) {
  const ts = new Date().toTimeString().slice(0, 8)
  job.logs.push(`[${ts}] ${line}`)
  if (job.logs.length > 500) job.logs.splice(0, job.logs.length - 500)
}

async function runWorker (jobId, rootResolved, scanOptions = {}) {
  const job = jobs.get(jobId)
  if (!job) return
  job.status = 'running'
  job.startedAt = new Date().toISOString()

  try {
    const { results } = await runResumeBatchScan(
      rootResolved,
      {
        onLine: (line) => appendLog(job, line),
        onProgress: (p) => {
          job.percent = p.percent
          job.unitIndex = p.unitIndex
          job.totalUnits = p.totalUnits
          job.currentFolder = p.currentFolder || ''
        },
      },
      scanOptions,
    )
    job.results = results
    job.percent = 100
    job.status = 'completed'
    job.message = '全部完成'
  } catch (e) {
    job.status = 'failed'
    job.error = e.message
    appendLog(job, '任务异常: ' + e.message)
  } finally {
    job.finishedAt = new Date().toISOString()
    activeJobId = null
  }
}

router.post('/jobs', express.json(), (req, res) => {
  try {
    if (activeJobId) {
      return res.status(409).json({
        success: false,
        error: '已有批量任务在执行，请等待完成后再试',
        data: { activeJobId },
      })
    }
    const rootPath = (req.body && req.body.rootPath) || ''
    const recursiveUnits = !!(req.body && req.body.recursiveUnits)
    const abs = resolveAndValidateRoot(rootPath)
    const id = newJobId()
    const job = {
      id,
      status: 'queued',
      percent: 0,
      message: '排队中',
      logs: [],
      results: [],
      error: null,
      rootPath: abs,
      totalUnits: 0,
      unitIndex: 0,
      currentFolder: '',
      startedAt: null,
      finishedAt: null,
    }
    jobs.set(id, job)
    activeJobId = id
    setImmediate(() => {
      runWorker(id, abs, { recursiveUnits }).catch((e) => {
        const j = jobs.get(id)
        if (j) {
          j.status = 'failed'
          j.error = e.message
          appendLog(j, '未捕获异常: ' + e.message)
          j.finishedAt = new Date().toISOString()
        }
        activeJobId = null
      })
    })
    return res.json({ success: true, data: { jobId: id } })
  } catch (e) {
    return res.status(400).json({ success: false, error: e.message })
  }
})

router.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id)
  if (!job) return res.status(404).json({ success: false, error: '任务不存在' })
  return res.json({ success: true, data: job })
})

module.exports = router
