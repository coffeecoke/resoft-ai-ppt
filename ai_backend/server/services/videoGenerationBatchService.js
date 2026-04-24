const fs = require('fs').promises
const path = require('path')
const prisma = require('../utils/prisma')
const logger = require('../utils/logger')
const transcriptionService = require('./transcriptionService')
const presalesVideoPipelineOrchestrator = require('./presalesVideoPipelineOrchestrator')

const SYNC_TYPE = 'crm_video_batch'

class VideoGenerationBatchService {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.currentTask = null
    this.config = {
      pollingInterval: 5 * 60 * 1000,
      maxConcurrent: 1,
      scanLimit: 50,
      scanWindowHours: 72,
      autoContinueAfterRoleConfirm: true
    }
    this.statistics = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunTime: null,
      nextRunTime: null,
      pendingRecords: 0,
      processingRecords: 0,
      completedRecords: 0
    }
    this.logs = []
    this.maxLogs = 200
    this.processingIds = new Set()
    this.statusColumnChecked = false
    this.hasCrmStatusColumn = false
    this.configPath = path.join(__dirname, '../config/videoGenerationBatchConfig.json')
    this.loadConfig()
  }

  async loadConfig() {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.config = { ...this.config, ...parsed }
    } catch {
      this.addLog('warning', '未找到视频跑批配置文件，使用默认配置')
    }
  }

  async saveConfig() {
    await fs.mkdir(path.dirname(this.configPath), { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
  }

  addLog(level, message, data = {}) {
    this.logs.unshift({
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    })
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      config: this.config,
      statistics: this.statistics,
      processingCount: this.processingIds.size
    }
  }

  getConfig() {
    return this.config
  }

  getLogs(limit = 100) {
    return this.logs.slice(0, Math.max(1, limit))
  }

  clearLogs() {
    this.logs = []
  }

  async updateConfig(newConfig) {
    const next = { ...this.config }
    if (newConfig.pollingInterval != null) next.pollingInterval = Number(newConfig.pollingInterval)
    if (newConfig.maxConcurrent != null) next.maxConcurrent = Number(newConfig.maxConcurrent)
    if (newConfig.scanLimit != null) next.scanLimit = Number(newConfig.scanLimit)
    if (newConfig.scanWindowHours != null) next.scanWindowHours = Number(newConfig.scanWindowHours)
    if (newConfig.autoContinueAfterRoleConfirm != null) {
      const raw = newConfig.autoContinueAfterRoleConfirm
      if (typeof raw === 'boolean') {
        next.autoContinueAfterRoleConfirm = raw
      } else if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase()
        if (v === 'true' || v === '1') next.autoContinueAfterRoleConfirm = true
        else if (v === 'false' || v === '0') next.autoContinueAfterRoleConfirm = false
        else throw new Error('自动继续开关必须是 true/false')
      } else {
        next.autoContinueAfterRoleConfirm = Boolean(raw)
      }
    }
    if (!Number.isFinite(next.pollingInterval) || next.pollingInterval < 60000) {
      throw new Error('轮询间隔必须 >= 60000ms')
    }
    if (!Number.isFinite(next.maxConcurrent) || next.maxConcurrent < 1 || next.maxConcurrent > 5) {
      throw new Error('最大并发必须在 1-5')
    }
    if (!Number.isFinite(next.scanLimit) || next.scanLimit < 1 || next.scanLimit > 500) {
      throw new Error('单次扫描数量必须在 1-500')
    }
    if (!Number.isFinite(next.scanWindowHours) || next.scanWindowHours < 0 || next.scanWindowHours > 720) {
      throw new Error('扫描时间窗口(小时)必须在 0-720，0 表示不限制')
    }
    if (typeof next.autoContinueAfterRoleConfirm !== 'boolean') {
      throw new Error('自动继续开关必须是布尔值')
    }
    this.config = next
    await this.saveConfig()
    if (this.isRunning) {
      await this.stop()
      await this.start()
    }
    return this.config
  }

  async start() {
    if (this.isRunning) return this.getStatus()
    this.isRunning = true
    this.addLog('info', '视频生成跑批已启动')
    await this.runOnce()
    this.intervalId = setInterval(() => {
      this.runOnce().catch((err) => {
        logger.error('[video-batch] 定时执行失败:', err)
      })
    }, this.config.pollingInterval)
    this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
    return this.getStatus()
  }

  async stop() {
    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.statistics.nextRunTime = null
    this.addLog('info', '视频生成跑批已停止')
    return this.getStatus()
  }

  async getStatistics() {
    const pending = await this.countPendingRecords()
    const completed = await prisma.log_sync_status.count({
      where: { sync_type: SYNC_TYPE, status: { in: ['confirming', 'completed'] } }
    })
    return {
      ...this.statistics,
      pendingRecords: pending,
      completedRecords: completed,
      processingRecords: this.processingIds.size
    }
  }

  async countPendingRecords() {
    const records = await this.getCandidateRecords()
    return records.length
  }

  async getCandidateRecords() {
    const hours = Number(this.config.scanWindowHours || 0)
    const createdFilter =
      hours > 0
        ? { gte: new Date(Date.now() - hours * 60 * 60 * 1000) }
        : undefined
    const rows = await prisma.crm_report_file.findMany({
      where: {
        local_file_path: { not: null },
        from_user: { not: null },
        ...(createdFilter ? { created_at: createdFilter } : {})
      },
      orderBy: { created_at: 'asc' },
      take: this.config.scanLimit
    })
    if (rows.length === 0) return []
    const batchIds = rows.map((r) => this.batchIdByCrmId(r.id))
    const states = await prisma.log_sync_status.findMany({
      where: { sync_type: SYNC_TYPE, batch_id: { in: batchIds } },
      select: { batch_id: true, status: true }
    })
    const stateMap = new Map(states.map((s) => [s.batch_id, String(s.status || '')]))
    return rows.filter((r) => {
      const key = this.batchIdByCrmId(r.id)
      const st = stateMap.get(key)
      return !st || st === 'failed' || st === 'pending'
    })
  }

  batchIdByCrmId(crmId) {
    return `crm_video_${String(crmId)}`
  }

  async upsertSyncStatus(crmRow, status, extra = {}) {
    const batchId = this.batchIdByCrmId(crmRow.id)
    const syncParams = {
      crm_report_file_id: String(crmRow.id),
      report_id: crmRow.report_id || null,
      from_user: crmRow.from_user || null,
      local_file_path: crmRow.local_file_path || null,
      ...extra
    }
    await prisma.log_sync_status.upsert({
      where: { batch_id: batchId },
      create: {
        sync_type: SYNC_TYPE,
        batch_id: batchId,
        sync_params: syncParams,
        start_time: new Date(),
        status,
        end_time: status === 'failed' || status === 'confirming' || status === 'completed' ? new Date() : null
      },
      update: {
        status,
        sync_params: syncParams,
        end_time: status === 'failed' || status === 'confirming' || status === 'completed' ? new Date() : null,
        error_message: extra.error_message ? String(extra.error_message).slice(0, 1000) : null
      }
    })
  }

  async updateCrmRowStatusIfPossible(crmId, status) {
    if (this.statusColumnChecked && !this.hasCrmStatusColumn) return
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE crm_report_file SET process_status = ? WHERE id = ?',
        String(status),
        String(crmId)
      )
      this.hasCrmStatusColumn = true
      this.statusColumnChecked = true
    } catch (e) {
      this.statusColumnChecked = true
      this.hasCrmStatusColumn = false
      const msg = String((e && e.message) || '')
      if (msg.toLowerCase().includes('unknown column')) {
        this.addLog('warning', 'crm_report_file 未发现 process_status 字段，状态仅写入 log_sync_status')
        return
      }
      throw e
    }
  }

  async processOne(crmRow) {
    const crmId = String(crmRow.id)
    const fromUser = String(crmRow.from_user || '').trim()
    const localPath = String(crmRow.local_file_path || '').trim()
    if (!fromUser) throw new Error('crm_report_file.from_user 为空')
    if (!localPath) throw new Error('crm_report_file.local_file_path 为空')
    await fs.access(localPath)

    this.currentTask = {
      type: 'video_batch',
      crmId,
      reportId: crmRow.report_id || null,
      fromUser,
      startTime: new Date().toISOString()
    }
    this.addLog('info', `开始处理 CRM 文件 ${crmId}`, { reportId: crmRow.report_id, fromUser })
    await this.upsertSyncStatus(crmRow, 'running')

    const baseName = path.basename(localPath)
    const transcribed = await transcriptionService.transcribeAudio(localPath)
    const stat = await fs.stat(localPath)
    const transcription = await transcriptionService.saveTranscription({
      name: baseName,
      originalFileName: crmRow.original_file_name || baseName,
      audioFilePath: localPath,
      audioFileSize: transcribed.audioFileSize != null ? transcribed.audioFileSize : stat.size,
      audioFormat: path.extname(localPath).replace('.', '') || 'mp3',
      audioDuration: transcribed.audioDuration || null,
      resultFilePath: null,
      dialogues: transcribed.dialogues || [],
      fullText: transcribed.fullText || null,
      speakerCount: transcribed.speakerCount || 0,
      customerName: null,
      // report_id 来自 communication_reports.id，不能写入 transcriptions.session_id（外键指向 sessions.id）
          // session_id 继续保留给 sessions；报备关联改写到 transcriptions.report_id
      sessionId: null,
          reportId: crmRow.report_id ? String(crmRow.report_id).slice(0, 50) : null,
      createdBy: fromUser
    })

    if (this.config.autoContinueAfterRoleConfirm) {
      await presalesVideoPipelineOrchestrator.startPipelineRun({
        transcriptionId: transcription.id,
        wecomUserId: fromUser,
        skipRoleConfirm: false
      })
    } else {
      const notifyResult = await this.notifyRoleConfirmOnly(transcription.id, fromUser)
      this.addLog('info', `已发送角色确认（关闭自动后续） ${crmId}`, {
        transcriptionId: transcription.id,
        wecomUserId: fromUser,
        notifyStatus: notifyResult.status
      })
    }

    await this.upsertSyncStatus(crmRow, 'confirming', {
      transcription_id: transcription.id
    })
    await this.updateCrmRowStatusIfPossible(crmRow.id, '确认中')

    this.addLog('success', `处理完成并进入确认中 ${crmId}`, {
      transcriptionId: transcription.id,
      fromUser
    })
  }

  async runOnce() {
    this.statistics.totalRuns += 1
    this.statistics.lastRunTime = new Date()
    this.currentTask = null
    try {
      const records = await this.getCandidateRecords()
      this.statistics.pendingRecords = records.length
      if (records.length === 0) {
        this.addLog('info', '未发现待处理的 CRM 视频记录')
        this.statistics.successfulRuns += 1
        return
      }
      const queue = records.filter((r) => !this.processingIds.has(String(r.id)))
      const chunks = []
      for (let i = 0; i < queue.length; i += this.config.maxConcurrent) {
        chunks.push(queue.slice(i, i + this.config.maxConcurrent))
      }
      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(async (row) => {
            const key = String(row.id)
            this.processingIds.add(key)
            try {
              await this.processOne(row)
            } catch (e) {
              await this.upsertSyncStatus(row, 'failed', { error_message: e.message || String(e) })
              this.addLog('error', `处理失败 ${key}: ${e.message || e}`)
            } finally {
              this.processingIds.delete(key)
            }
          })
        )
      }
      this.statistics.successfulRuns += 1
    } catch (error) {
      this.statistics.failedRuns += 1
      this.addLog('error', `视频跑批执行失败: ${error.message || error}`)
      logger.error('[video-batch] runOnce:', error)
    } finally {
      if (this.isRunning) {
        this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
      }
      this.currentTask = null
    }
  }

  getInternalBaseUrl() {
    const fromEnv = process.env.PRESALES_VIDEO_PIPELINE_INTERNAL_BASE_URL
    if (fromEnv && String(fromEnv).trim()) {
      return String(fromEnv).trim().replace(/\/$/, '')
    }
    const port = process.env.PORT || 3000
    return `http://127.0.0.1:${port}`
  }

  async notifyRoleConfirmOnly(transcriptionId, wecomUserId) {
    const url = `${this.getInternalBaseUrl()}/api/presales-video/transcriptions/${encodeURIComponent(
      String(transcriptionId)
    )}/notify-role-confirm`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wecomUserId })
    })
    const text = await res.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      // ignore
    }
    if (!res.ok || !json || json.success !== true) {
      const msg =
        (json && (json.error || json.message)) ||
        (text && text.length < 800 ? text : `HTTP ${res.status}`)
      throw new Error(`发送角色确认失败: ${msg}`)
    }
    return { status: res.status, data: json.data || null }
  }
}

module.exports = new VideoGenerationBatchService()
