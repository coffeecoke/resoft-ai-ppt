/**
 * 问答对提取自动跑批处理服务
 * 
 * 负责：
 * 1. 定时扫描已标记角色但未进行问答对提取的转录记录
 * 2. 自动调用问答对提取接口
 * 3. 记录处理日志
 */

const prisma = require('../utils/prisma')
const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')
const transcriptionService = require('./transcriptionService')
const transcriptionAiService = require('./transcriptionAiService')
const audioScanService = require('./audioScanService')


class QaAutoProcessService {
  constructor() {
    this.isRunning = false
    this.intervalId = null // 兼容旧字段
    this.nextLoopTimer = null
    this.heartbeatTimer = null
    this.currentTask = null
    this.config = {
      scanDirectory: '', // 扫描目录（仅处理该目录下音频对应的转录记录）
      pollingInterval: 5 * 60 * 1000, // 默认5分钟
      maxConcurrent: 1, // 同时处理的转录记录数量
      autoStartEnabled: false // 持久化：true 时服务重启后自动恢复跑批
    }
    this.statistics = {
      totalTranscriptions: 0,
      withRoleJudgment: 0,
      extractedQAPairs: 0,
      pendingExtractions: 0,
      processingExtractions: 0,
      lastRunTime: null,
      nextRunTime: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0
    }
    this.logs = [] // 最近100条日志
    this.maxLogs = 100
    this.processingQueue = new Set() // 正在处理的转录记录ID
    this.runOnceInProgress = false // 防止定时任务与手动触发重叠执行
    
    // 加载配置
    this.loadConfig()
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/qaAutoProcessConfig.json')
      const configData = await fs.readFile(configPath, 'utf-8')
      const loadedConfig = JSON.parse(configData)
      this.config = { ...this.config, ...loadedConfig }
      logger.info(`✅ 问答对提取自动跑批配置已加载: ${configPath}`)
    } catch (error) {
      logger.warn(`⚠️ 未找到问答对提取自动跑批配置文件，使用默认配置`)
      // 从音频扫描配置中读取目录
      try {
        const scanConfig = await audioScanService.getConfig()
        if (scanConfig.scanDirectory) {
          this.config.scanDirectory = scanConfig.scanDirectory
        }
      } catch (err) {
        logger.warn(`⚠️ 读取音频扫描配置失败`)
      }
    }
  }

  /**
   * 获取扫描目录范围内的转录记录ID集合
   */
  async getScopedTranscriptionIds() {
    if (!this.config.scanDirectory) {
      return null
    }

    const files = await audioScanService.scanAudioFiles(this.config.scanDirectory)
    const filesWithStatus = await audioScanService.checkFilesStatus(files)

    return new Set(
      filesWithStatus
        .filter(f => f.transcribed && f.transcriptionId)
        .map(f => f.transcriptionId)
    )
  }

  /**
   * 保存配置
   */
  async saveConfig() {
    try {
      const configPath = path.join(__dirname, '../config/qaAutoProcessConfig.json')
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2))
      logger.success(`✅ 问答对提取自动跑批配置已保存`)
    } catch (error) {
      logger.error(`❌ 保存问答对提取自动跑批配置失败:`, error)
    }
  }

  /**
   * 清除定时调度（setInterval / setTimeout）
   */
  _clearSchedule() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.nextLoopTimer) {
      clearTimeout(this.nextLoopTimer)
      this.nextLoopTimer = null
    }
  }

  _stopTaskHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  _startTaskHeartbeat() {
    this._stopTaskHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      if (!this.currentTask) return
      const startedAt = new Date(this.currentTask.startedAt).getTime()
      const mins = Math.max(1, Math.round((Date.now() - startedAt) / 60000))
      this.addLog('info', `⏳ 仍在提取问答对: ${this.currentTask.name}（已运行约 ${mins} 分钟）`)
    }, 3 * 60 * 1000)
  }

  /**
   * 上一轮 runOnce 结束后再等待 pollingInterval，避免长任务期间反复「跳过」
   */
  _scheduleNextLoop() {
    this._clearSchedule()
    if (!this.isRunning) return

    this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
    this.nextLoopTimer = setTimeout(async () => {
      if (!this.isRunning) return
      try {
        await this.runOnce()
      } catch (error) {
        logger.error('问答对提取跑批定时执行失败:', error)
      } finally {
        if (this.isRunning) {
          this._scheduleNextLoop()
        }
      }
    }, this.config.pollingInterval)
  }

  /**
   * 服务启动后：若上次为「运行中」则自动恢复（应对进程重启 / node --watch）
   */
  async resumeIfNeeded() {
    await this.loadConfig()

    if (!this.config.autoStartEnabled) {
      return { resumed: false }
    }

    if (String(process.env.QA_AUTO_PROCESS_AUTO_RESUME || '').trim().toLowerCase() === 'false') {
      logger.info('问答对提取跑批自动恢复已禁用 (QA_AUTO_PROCESS_AUTO_RESUME=false)')
      return { resumed: false, reason: 'disabled_by_env' }
    }

    if (this.isRunning) {
      return { resumed: false, reason: 'already_running' }
    }

    logger.info('🔄 问答对提取跑批：检测到上次为运行状态，服务重启后自动恢复...')
    const result = await this.start({ resumed: true })
    return { resumed: true, ...result }
  }

  /**
   * 启动自动跑批
   */
  async start(options = {}) {
    if (this.isRunning) {
      logger.warn('⚠️ 问答对提取自动跑批服务已在运行中')
      return { success: false, message: '服务已在运行中' }
    }

    logger.info('🚀 启动问答对提取自动跑批服务')
    this.isRunning = true
    this.config.autoStartEnabled = true
    await this.saveConfig()
    this.addLog('info', options.resumed ? '🔄 服务重启后自动恢复跑批' : '🚀 服务已启动')

    this._clearSchedule()
    this.runOnce()
      .catch((error) => {
        logger.error('问答对提取跑批首次执行失败:', error)
      })
      .finally(() => {
        if (this.isRunning) {
          this._scheduleNextLoop()
        }
      })

    return { success: true, message: '服务启动成功' }
  }

  /**
   * 停止自动跑批
   */
  async stop() {
    if (!this.isRunning) {
      logger.warn('⚠️ 问答对提取自动跑批服务未运行')
      return { success: false, message: '服务未运行' }
    }

    logger.info('🛑 停止问答对提取自动跑批服务')
    this.isRunning = false
    this.config.autoStartEnabled = false
    await this.saveConfig()

    this._clearSchedule()
    this._stopTaskHeartbeat()
    this.currentTask = null

    this.addLog('info', '🛑 服务已停止')
    this.statistics.nextRunTime = null

    return { success: true, message: '服务已停止' }
  }

  /**
   * 执行一次自动处理
   */
  async runOnce() {
    if (this.runOnceInProgress) {
      const hint = this.currentTask?.name ? `，当前: ${this.currentTask.name}` : ''
      logger.info(`[问答对提取跑批] 任务进行中，忽略重复触发${hint}`)
      return { skipped: true }
    }

    this.runOnceInProgress = true
    const startTime = Date.now()
    this.statistics.lastRunTime = new Date()
    this.statistics.totalRuns++

    try {
      this.addLog('info', '▶️ 开始执行问答对提取自动处理任务')

      if (!this.config.scanDirectory) {
        throw new Error('未配置扫描目录')
      }

      this.addLog('info', `📁 扫描目录: ${this.config.scanDirectory}`)

      // 1. 扫描待处理的转录记录
      const scanResult = await this.scanTranscriptions()
      
      this.addLog('info', `📊 扫描结果: 总数=${scanResult.total}, 已标记角色=${scanResult.withRoleJudgment}, 待提取=${scanResult.pending}`)

      // 更新统计信息
      this.statistics.totalTranscriptions = scanResult.total
      this.statistics.withRoleJudgment = scanResult.withRoleJudgment
      this.statistics.pendingExtractions = scanResult.pending
      this.statistics.processingExtractions = this.processingQueue.size

      // 2. 处理待提取的转录记录
      if (scanResult.pendingTranscriptions.length > 0) {
        // 分批处理，控制并发数
        const batches = []
        for (let i = 0; i < scanResult.pendingTranscriptions.length; i += this.config.maxConcurrent) {
          batches.push(scanResult.pendingTranscriptions.slice(i, i + this.config.maxConcurrent))
        }
        
        this.addLog('info', `📦 共 ${scanResult.pendingTranscriptions.length} 个待提取记录，分 ${batches.length} 批处理（每批最多 ${this.config.maxConcurrent} 个）`)
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          if (!this.isRunning) {
            this.addLog('warning', '⚠️ 服务已停止，中断处理')
            break
          }
          
          const batch = batches[batchIndex]
          this.addLog('info', `📋 开始处理第 ${batchIndex + 1}/${batches.length} 批（${batch.length} 个记录）`)
          
          // 并发处理当前批次
          await Promise.all(batch.map(transcription => this.processTranscription(transcription)))
          
          this.addLog('info', `✅ 第 ${batchIndex + 1}/${batches.length} 批处理完成`)
        }
      } else {
        this.addLog('info', '✅ 没有待提取问答对的转录记录')
      }

      this.statistics.successfulRuns++
      const duration = Date.now() - startTime
      this.addLog('success', `✅ 问答对提取自动处理任务完成，耗时 ${Math.round(duration / 1000)} 秒`)

      if (this.isRunning && !this.nextLoopTimer) {
        this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
      }

    } catch (error) {
      this.statistics.failedRuns++
      logger.error('❌ 问答对提取自动处理任务失败:', error)
      this.addLog('error', `❌ 任务失败: ${error.message}`)
    } finally {
      this.runOnceInProgress = false
    }
  }

  /**
   * 扫描转录记录
   * 查询 dialogue_adjustments 表中有 speaker_roles 字段的记录
   * 然后检查对应的 transcription_id 是否在 concerns 表中存在
   */
  async scanTranscriptions() {
    try {
      const scopedIds = await this.getScopedTranscriptionIds()
      const isInScope = (id) => !scopedIds || scopedIds.has(id)

      // 1. 统计扫描目录范围内的转录记录总数
      const total = scopedIds ? scopedIds.size : await prisma.transcriptions.count()

      // 2. 查询所有 dialogue_adjustments 表中有 speaker_roles 字段的记录
      const adjustmentsWithRoles = await prisma.dialogue_adjustments.findMany({
        where: {
          speaker_roles: { not: null }
        },
        select: {
          transcription_id: true
        }
      })

      // 去重：使用 Set 对 transcription_id 去重，并限定在扫描目录范围内
      const transcriptionIdsWithRoles = [...new Set(
        adjustmentsWithRoles
          .map(item => item.transcription_id)
          .filter(isInScope)
      )]
      const withRoleJudgment = transcriptionIdsWithRoles.length

      // 3. 获取所有已提取问答对的 transcription_id 列表
      const extractedConcerns = await prisma.concerns.findMany({
        where: {
          transcription_id: { not: null }
        },
        select: {
          transcription_id: true
        }
      })

      // 去重：使用 Set 对 transcription_id 去重
      const extractedIdsSet = new Set(extractedConcerns.map(item => item.transcription_id))

      // 4. 找出待处理的转录记录（有 speaker_roles 但没有问答对提取记录）
      const pendingTranscriptionIds = transcriptionIdsWithRoles.filter(
        id => !extractedIdsSet.has(id) && !this.processingQueue.has(id)
      )

      // 5. 查询待处理的转录记录详情
      const pendingTranscriptions = pendingTranscriptionIds.length > 0
        ? await prisma.transcriptions.findMany({
            where: {
              id: { in: pendingTranscriptionIds }
            },
            select: {
              id: true,
              name: true
            }
          })
        : []

      return {
        total,
        withRoleJudgment,
        pending: pendingTranscriptions.length,
        pendingTranscriptions
      }
    } catch (error) {
      logger.error('扫描转录记录失败:', error)
      throw error
    }
  }

  /**
   * 处理单个转录记录
   */
  async processTranscription(transcription) {
    const { id, name } = transcription

    if (this.processingQueue.has(id)) {
      logger.info(`⏭️ 跳过正在处理的转录记录: ${name}`)
      return
    }

    this.processingQueue.add(id)
    this.statistics.processingExtractions = this.processingQueue.size
    this.currentTask = { id, name, startedAt: new Date().toISOString() }
    this._startTaskHeartbeat()

    try {
      this.addLog('info', `❓ 开始提取问答对: ${name}`)

      // 获取转录记录
      const transcription = await prisma.transcriptions.findUnique({
        where: { id }
      })
      
      if (!transcription) {
        throw new Error('转录记录不存在')
      }

      // 确定要分析的对话内容（优先使用最后一次合并完成后的内容：再次合并 > AI修正 > 第一次合并 > 原始对话）
      let sourceDialogues = []
      
      // 1. 最优先：再次合并后的对话（note1='再次合并对话'）
      const reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          note1: '再次合并对话'
        },
        orderBy: { created_at: 'desc' }
      })
      
      if (reMergeAdjustment && reMergeAdjustment.adjusted_dialogues) {
        sourceDialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
          ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
          : reMergeAdjustment.adjusted_dialogues
      }
      
      // 2. 其次：AI修正后的对话（note1='AI错别字修正'）
      if (!sourceDialogues || sourceDialogues.length === 0) {
        const aiCorrectionAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: 'AI错别字修正'
          },
          orderBy: { created_at: 'desc' }
        })
        
        if (aiCorrectionAdjustment && aiCorrectionAdjustment.adjusted_dialogues) {
          sourceDialogues = typeof aiCorrectionAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(aiCorrectionAdjustment.adjusted_dialogues)
            : aiCorrectionAdjustment.adjusted_dialogues
        }
      }
      
      // 3. 再次：第一次合并后的对话（note1='合并相邻同一说话人的对话'）
      if (!sourceDialogues || sourceDialogues.length === 0) {
        const mergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: id,
            note1: '合并相邻同一说话人的对话'
          },
          orderBy: { created_at: 'desc' }
        })
        
        if (mergeAdjustment && mergeAdjustment.adjusted_dialogues) {
          sourceDialogues = typeof mergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(mergeAdjustment.adjusted_dialogues)
            : mergeAdjustment.adjusted_dialogues
        }
      }
      
      // 4. 最后：原始对话（从 transcriptions 表）
      if (!sourceDialogues || sourceDialogues.length === 0) {
        sourceDialogues = transcription.dialogues || []
        if (typeof sourceDialogues === 'string') {
          try {
            sourceDialogues = JSON.parse(sourceDialogues)
          } catch (e) {
            sourceDialogues = []
          }
        }
      }

      if (!sourceDialogues || sourceDialogues.length === 0) {
        throw new Error('对话内容为空')
      }

      // 获取角色信息（从任何包含 speaker_roles 的记录，不限于 note1='角色判断'）
      // 因为扫描逻辑查询的是所有有 speaker_roles 的记录
      const roleAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: id,
          speaker_roles: { not: null }
        },
        orderBy: { created_at: 'desc' }
      })

      let speakerRoles = {}
      if (roleAdjustment && roleAdjustment.speaker_roles) {
        speakerRoles = typeof roleAdjustment.speaker_roles === 'string'
          ? JSON.parse(roleAdjustment.speaker_roles)
          : roleAdjustment.speaker_roles
      }

      if (!speakerRoles || Object.keys(speakerRoles).length === 0) {
        throw new Error('未找到角色信息')
      }

      this.addLog('info', `📊 共 ${sourceDialogues.length} 条对话，准备调用 AI 提取问答对`)

      // 调用AI提取问答对（使用默认模型和提示词）
      let lastLoggedProgress = -1
      const result = await transcriptionAiService.extractQAPairs(
        sourceDialogues,
        speakerRoles,
        {
          onExtractStart: ({ totalDialogues, totalChars, totalBatches, modelName }) => {
            const msg = `🤖 模型=${modelName} | ${totalDialogues}条对话 | ${totalChars}字 | 分${totalBatches}批`
            this.addLog('info', msg)
            logger.info(`[问答对跑批] ${name} → ${msg}`)
          },
          onBatchProgress: ({ phase, batchIndex, totalBatches, dialogueCount, batchChars, qaPairCount, processingTimeMs, error, reason }) => {
            const batchNo = batchIndex + 1
            if (phase === 'start') {
              const msg = `🔄 AI 第 ${batchNo}/${totalBatches} 批开始（${dialogueCount}条对话，${batchChars}字）`
              this.addLog('info', msg)
              logger.info(`[问答对跑批] ${name} → ${msg}`)
            } else if (phase === 'done') {
              const sec = Math.round((processingTimeMs || 0) / 1000)
              const msg = `✅ AI 第 ${batchNo}/${totalBatches} 批完成，提取 ${qaPairCount} 个问答对（${sec}秒）`
              this.addLog('success', msg)
              logger.success(`[问答对跑批] ${name} → ${msg}`)
            } else if (phase === 'skip') {
              const msg = `⏭️ AI 第 ${batchNo}/${totalBatches} 批跳过（${reason || '无需提取'}）`
              this.addLog('info', msg)
              logger.info(`[问答对跑批] ${name} → ${msg}`)
            } else if (phase === 'error') {
              const msg = `❌ AI 第 ${batchNo}/${totalBatches} 批失败: ${error}`
              this.addLog('error', msg)
              logger.error(`[问答对跑批] ${name} → ${msg}`)
            }
          },
          onProgress: (current, total) => {
            const pct = total > 0 ? Math.round((current / total) * 100) : 0
            const bucket = Math.floor(pct / 10) * 10
            if (bucket !== lastLoggedProgress && bucket > 0) {
              lastLoggedProgress = bucket
              logger.info(`[问答对跑批] ${name} → 对话进度 ${current}/${total} (${pct}%)`)
            }
          }
        }
      )

      if (!result.success || !result.qaPairs || result.qaPairs.length === 0) {
        this.addLog('warning', `⚠️ 未提取到问答对: ${name}`)
        return
      }

      // 保存到 concerns 表
      const { v4: uuidv4 } = require('uuid')
      
      for (let i = 0; i < result.qaPairs.length; i++) {
        const qaPair = result.qaPairs[i]
        
        await prisma.concerns.create({
          data: {
            id: uuidv4(),
            transcription_id: id,
            question: qaPair.question || '',
            answer: qaPair.answer || '',
            time_range: qaPair.time_range || qaPair.time_range1 || null,
            time_range1: qaPair.time_range1 || qaPair.time_range || null,
            time_range2: qaPair.time_range2 || null,
            question_speaker: qaPair.question_speaker || null,
            answer_speaker: qaPair.answer_speaker || null
          }
        })
      }

      this.addLog('success', `✅ 问答对提取成功: ${name} (提取了 ${result.qaPairs.length} 个问答对)`)
      logger.info(`✅ 问答对提取成功: ${name} - 提取了 ${result.qaPairs.length} 个问答对`)

    } catch (error) {
      logger.error(`❌ 处理转录记录失败: ${name}`, error)
      this.addLog('error', `❌ 处理失败: ${name} - ${error.message}`)
    } finally {
      if (this.currentTask?.id === id) {
        this.currentTask = null
        this._stopTaskHeartbeat()
      }
      this.processingQueue.delete(id)
      this.statistics.processingExtractions = this.processingQueue.size
    }
  }

  /**
   * 添加日志
   */
  addLog(level, message, data = {}) {
    const log = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data
    }
    
    this.logs.unshift(log)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }
    
    // 输出到控制台
    if (level === 'error') {
      logger.error(`[问答对提取跑批] ${message}`)
    } else if (level === 'warning') {
      logger.warn(`[问答对提取跑批] ${message}`)
    } else if (level === 'success') {
      logger.success(`[问答对提取跑批] ${message}`)
    } else {
      logger.info(`[问答对提取跑批] ${message}`)
    }
  }

  /**
   * 获取日志
   */
  getLogs(limit = 100) {
    return this.logs.slice(0, limit)
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = []
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      config: this.config,
      statistics: this.statistics,
      processingCount: this.processingQueue.size
    }
  }

  /**
   * 获取配置
   */
  getConfig() {
    return this.config
  }

  /**
   * 更新配置
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    await this.saveConfig()
    
    // 如果正在运行，重启以应用新配置
    if (this.isRunning) {
      await this.stop()
      await this.start()
    }
    
    return this.config
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    // 重新扫描以更新统计数据
    try {
      const scanResult = await this.scanTranscriptions()
      this.statistics.totalTranscriptions = scanResult.total
      this.statistics.withRoleJudgment = scanResult.withRoleJudgment
      this.statistics.pendingExtractions = scanResult.pending
      this.statistics.processingExtractions = this.processingQueue.size
    } catch (error) {
      logger.error('更新统计数据失败:', error)
    }

    return this.statistics
  }
}

module.exports = new QaAutoProcessService()

