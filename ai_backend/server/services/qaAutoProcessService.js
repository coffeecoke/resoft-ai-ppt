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


class QaAutoProcessService {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.currentTask = null
    this.config = {
      pollingInterval: 5 * 60 * 1000, // 默认5分钟
      maxConcurrent: 1 // 同时处理的转录记录数量
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
    }
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
   * 启动自动跑批
   */
  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ 问答对提取自动跑批服务已在运行中')
      return { success: false, message: '服务已在运行中' }
    }

    logger.info('🚀 启动问答对提取自动跑批服务')
    this.isRunning = true
    this.addLog('info', '🚀 服务已启动')

    // 立即执行一次
    await this.runOnce()

    // 设置定时任务
    this.intervalId = setInterval(() => {
      this.runOnce()
    }, this.config.pollingInterval)

    this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)

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
    
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.addLog('info', '🛑 服务已停止')
    this.statistics.nextRunTime = null

    return { success: true, message: '服务已停止' }
  }

  /**
   * 执行一次自动处理
   */
  async runOnce() {
    const startTime = Date.now()
    this.statistics.lastRunTime = new Date()
    this.statistics.totalRuns++

    try {
      this.addLog('info', '▶️ 开始执行问答对提取自动处理任务')

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
      this.addLog('success', `✅ 问答对提取自动处理任务完成，耗时 ${duration}ms`)

      // 设置下次运行时间
      if (this.isRunning) {
        this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
      }

    } catch (error) {
      this.statistics.failedRuns++
      logger.error('❌ 问答对提取自动处理任务失败:', error)
      this.addLog('error', `❌ 任务失败: ${error.message}`)
    }
  }

  /**
   * 扫描转录记录
   * 查询 dialogue_adjustments 表中有 speaker_roles 字段的记录
   * 然后检查对应的 transcription_id 是否在 concerns 表中存在
   */
  async scanTranscriptions() {
    try {
      // 1. 查询所有转录记录（用于统计总数）
      const total = await prisma.transcriptions.count()

      // 2. 查询所有 dialogue_adjustments 表中有 speaker_roles 字段的记录
      const adjustmentsWithRoles = await prisma.dialogue_adjustments.findMany({
        where: {
          speaker_roles: { not: null }
        },
        select: {
          transcription_id: true
        }
      })

      // 去重：使用 Set 对 transcription_id 去重
      const transcriptionIdsWithRoles = [...new Set(adjustmentsWithRoles.map(item => item.transcription_id))]
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

      // 调用AI提取问答对（使用默认模型和提示词）
      const result = await transcriptionAiService.extractQAPairs(
        sourceDialogues,
        speakerRoles,
        {
          // 不传 modelName 和 promptId，使用默认配置
          onProgress: (current, total) => {
            logger.info(`📊 问答对提取进度: ${current}/${total} (${Math.round(current/total*100)}%)`)
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

