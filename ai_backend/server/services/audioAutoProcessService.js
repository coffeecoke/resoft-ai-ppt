/**
 * 音频自动跑批处理服务
 * 
 * 负责：
 * 1. 定时扫描配置的音频目录
 * 2. 识别未转录的音频文件
 * 3. 自动调用讯飞API转录
 * 4. 记录处理日志
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')
const audioScanService = require('./audioScanService')
const transcriptionService = require('./transcriptionService') // ✅ 导入转录服务
const transcriptionAiService = require('./transcriptionAiService') // ✅ 导入AI修正服务

const prisma = new PrismaClient()

class AudioAutoProcessService {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.currentTask = null
    this.config = {
      scanDirectory: '', // 扫描目录
      pollingInterval: 5 * 60 * 1000, // 默认5分钟
      maxConcurrent: 1, // 同时处理的音频数量
      enableAiCorrection: true, // ✅ 是否启用AI错别字修正（默认true，音频跑批自动执行错别字修正）
      supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'wma', 'ogg']
    }
    this.statistics = {
      totalAudios: 0,
      transcribedAudios: 0,
      pendingAudios: 0,
      processingAudios: 0,
      lastRunTime: null,
      nextRunTime: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0
    }
    this.logs = [] // 最近100条日志
    this.maxLogs = 100
    this.processingQueue = new Set() // 正在处理的音频文件路径
    
    // 加载配置
    this.loadConfig()
  }

  /**
   * 加载配置
   */
  async loadConfig() {
    try {
      const configPath = path.join(__dirname, '../config/audioAutoProcessConfig.json')
      const configData = await fs.readFile(configPath, 'utf-8')
      const loadedConfig = JSON.parse(configData)
      this.config = { ...this.config, ...loadedConfig }
      logger.info(`✅ 音频自动跑批配置已加载: ${configPath}`)
    } catch (error) {
      logger.warn(`⚠️ 未找到音频自动跑批配置文件，使用默认配置`)
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
   * 保存配置
   */
  async saveConfig() {
    try {
      const configPath = path.join(__dirname, '../config/audioAutoProcessConfig.json')
      await fs.writeFile(configPath, JSON.stringify(this.config, null, 2))
      logger.success(`✅ 音频自动跑批配置已保存`)
    } catch (error) {
      logger.error(`❌ 保存音频自动跑批配置失败:`, error)
    }
  }

  /**
   * 启动自动跑批
   */
  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ 音频自动跑批服务已在运行中')
      return { success: false, message: '服务已在运行中' }
    }

    logger.info('🚀 启动音频自动跑批服务')
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
      logger.warn('⚠️ 音频自动跑批服务未运行')
      return { success: false, message: '服务未运行' }
    }

    logger.info('🛑 停止音频自动跑批服务')
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
      this.addLog('info', '▶️ 开始执行音频自动处理任务')

      // 1. 扫描音频文件
      const scanResult = await this.scanAudioFiles()
      
      this.addLog('info', `📊 扫描结果: 总数=${scanResult.total}, 已转录=${scanResult.transcribed}, 待转录=${scanResult.pending}`)

      // 更新统计信息
      this.statistics.totalAudios = scanResult.total
      this.statistics.transcribedAudios = scanResult.transcribed
      this.statistics.pendingAudios = scanResult.pending
      this.statistics.processingAudios = this.processingQueue.size

      // 2. 处理待转录的音频
      if (scanResult.pendingFiles.length > 0) {
        const toProcess = scanResult.pendingFiles.slice(0, this.config.maxConcurrent)
        
        for (const audioFile of toProcess) {
          await this.processAudioFile(audioFile)
        }
      } else {
        this.addLog('info', '✅ 没有待转录的音频文件')
      }

      this.statistics.successfulRuns++
      const duration = Date.now() - startTime
      this.addLog('success', `✅ 音频自动处理任务完成，耗时 ${duration}ms`)

      // 设置下次运行时间
      if (this.isRunning) {
        this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
      }

    } catch (error) {
      this.statistics.failedRuns++
      logger.error('❌ 音频自动处理任务失败:', error)
      this.addLog('error', `❌ 任务失败: ${error.message}`)
    }
  }

  /**
   * 扫描音频文件
   */
  async scanAudioFiles() {
    if (!this.config.scanDirectory) {
      throw new Error('未配置扫描目录')
    }

    // 使用 audioScanService 扫描
    const files = await audioScanService.scanAudioFiles(this.config.scanDirectory)
    
    // ✅ 批量检查转录状态（与"目录扫描"功能保持一致）
    const filesWithStatus = await audioScanService.checkFilesStatus(files)
    
    // 统计
    const total = filesWithStatus.length
    const transcribed = filesWithStatus.filter(f => f.transcribed).length
    const pending = filesWithStatus.filter(f => !f.transcribed && !this.processingQueue.has(f.filePath)).length
    const pendingFiles = filesWithStatus.filter(f => !f.transcribed && !this.processingQueue.has(f.filePath))

    return {
      total,
      transcribed,
      pending,
      pendingFiles
    }
  }

  /**
   * 处理单个音频文件
   */
  async processAudioFile(audioFile) {
    const { filePath, fileName } = audioFile

    if (this.processingQueue.has(filePath)) {
      logger.info(`⏭️ 跳过正在处理的音频: ${fileName}`)
      return
    }

    this.processingQueue.add(filePath)
    this.statistics.processingAudios = this.processingQueue.size

    try {
      this.addLog('info', `🎤 开始转录: ${fileName}`)

      // 调用转录服务
      const transcribeResult = await this.transcribeAudio(filePath, fileName)

      if (transcribeResult.success) {
        // 保存到数据库
        const stats = await fs.stat(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        
        const savedTranscription = await transcriptionService.saveTranscription({
          name: fileName,
          originalFileName: fileName,
          audioFilePath: filePath,
          audioFileSize: stats.size,
          audioFormat: ext,
          audioDuration: transcribeResult.data.audioDuration || null,
          resultFilePath: null,
          dialogues: transcribeResult.data.dialogues || [],
          fullText: transcribeResult.data.fullText || null,
          speakerCount: transcribeResult.data.speakerCount || 0,
          customerName: null,
          sessionId: null,
          productId: null
        });
        
        this.addLog('success', `✅ 转录成功: ${fileName}`)
        
        // ✅ 转录完成后自动合并同一说话人的对话
        try {
          this.addLog('info', `🔄 开始合并同一说话人的对话: ${fileName}`)
          const mergeResult = await transcriptionService.mergeDialogues(savedTranscription.id)
          this.addLog('success', `✅ 合并完成: ${fileName} (合并前: ${mergeResult.originalCount} 条，合并后: ${mergeResult.mergedCount} 条)`)
          logger.info(`✅ 自动合并完成: ${fileName} - ${mergeResult.originalCount} 条 → ${mergeResult.mergedCount} 条`)
          
          // ✅ 如果配置了启用AI错别字修正，则执行AI修正
          if (this.config.enableAiCorrection) {
            try {
              this.addLog('info', `🤖 开始AI错别字修正: ${fileName}`)
              
              // 获取转录记录（包含合并后的对话）
              const transcription = await transcriptionService.getTranscriptionById(savedTranscription.id)
              let dialogues = transcription.dialogues
              
              // 解析对话内容
              if (typeof dialogues === 'string') {
                dialogues = JSON.parse(dialogues)
              }
              
              // 优先使用合并后的对话（mergeAdjustment 是合并记录）
              if (transcription.mergeAdjustment && transcription.mergeAdjustment.adjusted_dialogues) {
                if (typeof transcription.mergeAdjustment.adjusted_dialogues === 'string') {
                  dialogues = JSON.parse(transcription.mergeAdjustment.adjusted_dialogues)
                } else {
                  dialogues = transcription.mergeAdjustment.adjusted_dialogues
                }
              } else if (transcription.adjustment && transcription.adjustment.note1 === '合并相邻同一说话人的对话') {
                // 如果 mergeAdjustment 不存在，尝试从 adjustment 获取
                if (typeof transcription.adjustment.adjusted_dialogues === 'string') {
                  dialogues = JSON.parse(transcription.adjustment.adjusted_dialogues)
                } else {
                  dialogues = transcription.adjustment.adjusted_dialogues
                }
              }
              
              if (!dialogues || dialogues.length === 0) {
                throw new Error('没有对话内容可以修正')
              }
              
              // 调用AI修正
              const correctionResult = await transcriptionAiService.correctTyposAndRoles(dialogues, {
                onProgress: (current, total) => {
                  logger.info(`📊 AI修正进度: ${current}/${total} (${Math.round(current/total*100)}%)`)
                }
              })
              
              // 合并修正结果
              const correctedDialogues = transcriptionAiService.mergeCorrections(
                dialogues,
                correctionResult.data.dialogues
              )
              
              // 生成修正后的完整文本
              const correctedFullText = correctedDialogues.map(d => {
                const timeRange = d.timeRange || ''
                const speaker = d.speaker || '未知说话人'
                const text = d.text || d.correctedText || ''
                return timeRange ? `[${timeRange}] 【${speaker}】\n${text}` : `【${speaker}】\n${text}`
              }).join('\n\n')
              
              // 保存AI修正结果到数据库
              const { v4: uuidv4 } = require('uuid')
              const speakers = [...new Set(correctedDialogues.map(d => d.speaker))]
              
              await prisma.dialogue_adjustments.create({
                data: {
                  id: uuidv4(),
                  transcription_id: savedTranscription.id,
                  name: transcription.name,
                  original_file_name: transcription.original_file_name,
                  audio_file_path: transcription.audio_file_path,
                  audio_file_size: transcription.audio_file_size,
                  audio_format: transcription.audio_format,
                  audio_duration: transcription.audio_duration,
                  adjusted_dialogues: JSON.stringify(correctedDialogues),
                  full_text: correctedFullText,
                  xfyun_order_id: transcription.xfyun_order_id,
                  speaker_count: speakers.length,
                  has_role_separation: transcription.has_role_separation,
                  session_id: transcription.session_id,
                  product_id: transcription.product_id,
                  customer_name: transcription.customer_name,
                  note1: 'AI错别字修正',
                  note2: `修正了 ${correctionResult.data.summary?.correctedCount || 0} 条对话，共 ${correctedDialogues.length} 条（基于 ${dialogues.length} 条对话）`
                }
              })
              
              this.addLog('success', `✅ AI错别字修正完成: ${fileName} (修正了 ${correctionResult.data.summary?.correctedCount || 0} 条对话)`)
              logger.info(`✅ AI错别字修正完成: ${fileName} - 修正了 ${correctionResult.data.summary?.correctedCount || 0} 条对话`)
            } catch (correctionError) {
              // AI修正失败不影响转录成功的状态，只记录错误日志
              logger.error(`⚠️ AI错别字修正失败: ${fileName}`, correctionError)
              this.addLog('error', `⚠️ AI错别字修正失败: ${fileName} - ${correctionError.message}`)
            }
          }
        } catch (mergeError) {
          // 合并失败不影响转录成功的状态，只记录错误日志
          logger.error(`⚠️ 自动合并失败: ${fileName}`, mergeError)
          this.addLog('error', `⚠️ 合并失败: ${fileName} - ${mergeError.message}`)
        }
      } else {
        this.addLog('error', `❌ 转录失败: ${fileName} - ${transcribeResult.error}`)
      }

    } catch (error) {
      logger.error(`❌ 处理音频失败: ${fileName}`, error)
      this.addLog('error', `❌ 处理失败: ${fileName} - ${error.message}`)
    } finally {
      this.processingQueue.delete(filePath)
      this.statistics.processingAudios = this.processingQueue.size
    }
  }

  /**
   * 调用转录服务转录音频
   */
  async transcribeAudio(audioPath, audioName) {
    try {
      logger.info(`🎤 开始转录: ${audioName}`);
      
      // ✅ 直接调用 transcriptionService
      const result = await transcriptionService.transcribeAudio(audioPath);
      
      logger.success(`✅ 转录成功: ${audioName}`);
      return { success: true, data: result };
      
    } catch (error) {
      logger.error(`❌ 转录失败: ${audioName}`, error);
      return { success: false, error: error.message };
    }
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
    
    // ✅ 立即执行一次扫描以更新统计数据
    if (newConfig.scanDirectory) {
      logger.info('📂 扫描目录已更新，立即执行一次扫描')
      // 异步执行，不阻塞配置保存响应
      this.runOnce().catch(err => {
        logger.error('更新配置后扫描失败:', err)
      })
    }
    
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
    // ✅ 查询当前配置目录下的音频文件中已做AI错别字修正的数量
    let correctedCount = 0;
    try {
      // 1. 如果没有配置扫描目录，返回0
      if (!this.config.scanDirectory) {
        return {
          ...this.statistics,
          correctedDialogues: 0
        };
      }
      
      // 2. 扫描配置目录下的音频文件
      const files = await audioScanService.scanAudioFiles(this.config.scanDirectory);
      const filesWithStatus = await audioScanService.checkFilesStatus(files);
      
      // 3. 获取所有已转录的文件ID
      const transcriptionIds = filesWithStatus
        .filter(f => f.transcribed && f.transcriptionId)
        .map(f => f.transcriptionId);
      
      if (transcriptionIds.length === 0) {
        return {
          ...this.statistics,
          correctedDialogues: 0
        };
      }
      
      // 4. 查询这些转录记录中已做AI错别字修正的数量
      const corrections = await prisma.dialogue_adjustments.findMany({
        where: {
          transcription_id: {
            in: transcriptionIds
          },
          note1: 'AI错别字修正'
        },
        select: {
          transcription_id: true
        }
      });
      
      // 去重：每个转录记录只统计一次
      const uniqueTranscriptionIds = [...new Set(corrections.map(c => c.transcription_id))];
      correctedCount = uniqueTranscriptionIds.length;
    } catch (error) {
      logger.warn('查询AI错别字修正统计失败:', error.message);
      // 查询失败不影响其他统计，继续返回
    }
    
    return {
      ...this.statistics,
      correctedDialogues: correctedCount // ✅ 当前配置目录下已做AI错别字修正的文件数量
    };
  }

  /**
   * 获取日志
   */
  getLogs() {
    return this.logs
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = []
    logger.info('🗑️ 音频跑批日志已清空')
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

    this.logs.unshift(log) // 新日志在前

    // 保持最多 maxLogs 条日志
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }
  }
}

// 单例模式
const audioAutoProcessService = new AudioAutoProcessService()

module.exports = audioAutoProcessService

