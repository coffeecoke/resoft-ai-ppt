/**
 * 自动跑批处理服务
 * 
 * 负责：
 * 1. 定时扫描未提取的PPT文档
 * 2. 检查JSON文件是否存在
 * 3. 自动提取文本内容
 * 4. 自动调用AI分类
 * 5. 记录处理日志
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')
const documentService = require('./documentService')
const pptAnalysisService = require('./pptAnalysisService')

const prisma = new PrismaClient()

class AutoProcessService {
  constructor() {
    this.isRunning = false
    this.intervalId = null
    this.currentTask = null
    this.config = {
      pollingInterval: 5 * 60 * 1000, // 默认5分钟
      enableAutoExtract: true,
      enableAutoAnalysis: true,
      maxConcurrent: 1 // 同时处理的文档数量
    }
    this.statistics = {
      totalDocuments: 0,
      extractedDocuments: 0,
      analyzedDocuments: 0,
      pendingDocuments: 0,
      lastRunTime: null,
      nextRunTime: null,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0
    }
    this.logs = [] // 最近100条日志
    this.maxLogs = 100
  }

  /**
   * 启动自动跑批
   */
  async start() {
    if (this.isRunning) {
      throw new Error('自动跑批已在运行中')
    }

    this.isRunning = true
    logger.info('🚀 启动自动跑批服务')
    this.addLog('info', '启动自动跑批服务', { interval: this.config.pollingInterval })

    // 立即执行一次
    await this.runOnce()

    // 启动定时任务
    this.intervalId = setInterval(async () => {
      await this.runOnce()
    }, this.config.pollingInterval)

    this.updateNextRunTime()
    return this.getStatus()
  }

  /**
   * 停止自动跑批
   */
  stop() {
    if (!this.isRunning) {
      throw new Error('自动跑批未运行')
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    logger.info('⏸️ 停止自动跑批服务')
    this.addLog('info', '停止自动跑批服务')

    return this.getStatus()
  }

  /**
   * 执行一次完整的处理流程
   */
  async runOnce() {
    if (this.currentTask) {
      logger.warn('⚠️ 上一个任务尚未完成，跳过本次执行')
      this.addLog('warning', '跳过本次执行：上一个任务尚未完成')
      return
    }

    const startTime = Date.now()
    this.statistics.lastRunTime = new Date()
    this.statistics.totalRuns++

    logger.info('▶️ 开始执行自动处理任务')
    this.addLog('info', '开始执行自动处理任务')

    try {
      // 1. 扫描所有文档
      const documents = await this.scanDocuments()
      this.statistics.totalDocuments = documents.total
      this.statistics.extractedDocuments = documents.extracted
      this.statistics.analyzedDocuments = documents.analyzed
      this.statistics.pendingDocuments = documents.pending.length

      logger.info(`📊 扫描结果: 总数=${documents.total}, 已提取=${documents.extracted}, 已分析=${documents.analyzed}, 待处理=${documents.pending.length}`)
      this.addLog('info', '扫描完成', {
        total: documents.total,
        pending: documents.pending.length
      })

      // 2. 处理待提取的文档
      if (this.config.enableAutoExtract && documents.pending.length > 0) {
        for (const doc of documents.pending) {
          if (!this.isRunning) break // 如果被停止则退出

          this.currentTask = {
            type: 'extract',
            documentId: doc.id,
            documentName: doc.name,
            startTime: new Date()
          }

          try {
            await this.processDocument(doc)
          } catch (error) {
            logger.error(`❌ 处理文档失败 [${doc.name}]:`, error.message)
            this.addLog('error', `处理文档失败: ${doc.name}`, { error: error.message })
          }

          this.currentTask = null
        }
      }

      this.statistics.successfulRuns++
      const duration = Date.now() - startTime
      logger.success(`✅ 自动处理任务完成，耗时 ${duration}ms`)
      this.addLog('success', '自动处理任务完成', { duration })

    } catch (error) {
      this.statistics.failedRuns++
      logger.error('❌ 自动处理任务失败:', error.message)
      this.addLog('error', '自动处理任务失败', { error: error.message })
    } finally {
      this.currentTask = null
      this.updateNextRunTime()
    }
  }

  /**
   * 扫描所有文档
   * @returns {Promise<Object>} 文档统计信息
   */
  async scanDocuments() {
    // 获取所有文档
    const allDocuments = await prisma.documents.findMany({
      select: {
        id: true,
        name: true,
        content_file_path: true,
        slide_count: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })

    const total = allDocuments.length
    
    // ✅ 修正：通过 slide_merged_contents 表判断是否已提取
    const extractedDocs = await prisma.slide_merged_contents.groupBy({
      by: ['document_id']
    })
    const extracted = extractedDocs.length
    
    // 统计已分析的文档（thumbnails表中有page_type的文档）
    const analyzedDocs = await prisma.thumbnails.groupBy({
      by: ['document_id'],
      where: {
        page_type: { not: null }
      }
    })
    const analyzed = analyzedDocs.length

    // 构建已提取文档ID集合，方便快速查找
    const extractedDocIds = new Set(extractedDocs.map(d => d.document_id))

    // 待处理的文档：未提取 且 JSON文件存在
    const pending = []
    for (const doc of allDocuments) {
      if (!extractedDocIds.has(doc.id)) { // 未在 slide_merged_contents 表中
        // 检查JSON文件是否存在
        const jsonExists = await this.checkJsonExists(doc)
        if (jsonExists) {
          pending.push({
            id: doc.id,
            name: doc.name,
            content_file_path: doc.content_file_path,
            slide_count: doc.slide_count
          })
        }
      }
    }

    return {
      total,
      extracted,
      analyzed,
      pending
    }
  }

  /**
   * 检查文档的JSON文件是否存在
   * @param {Object} document - 文档对象
   * @returns {Promise<boolean>} 是否存在
   */
  async checkJsonExists(document) {
    try {
      // 根据content_file_path推断JSON文件路径
      const filePath = document.content_file_path
      if (!filePath) {
        logger.warn(`⚠️ 文档 [${document.name}] 没有 content_file_path`)
        return false
      }

      // ✅ 使用与 documentService 相同的路径逻辑
      // ai_backend 和 online-ppt-backend 是同级目录
      const projectRoot = path.join(process.cwd(), '..', 'online-ppt-backend')
      
      // 数据库中存储的路径格式可能是：
      // 1. "documents/document_1.json" (旧格式，需要加 data/ 前缀)
      // 2. "data/documents/document_1.json" (新格式，直接使用)
      let normalizedPath = filePath
      if (!filePath.startsWith('data/') && !filePath.startsWith('data\\')) {
        // 旧格式，添加 data/ 前缀
        normalizedPath = path.join('data', filePath)
      }
      
      const fullPath = path.join(projectRoot, normalizedPath)

      logger.info(`🔍 检查文档 [${document.name}] 的JSON文件...`)
      logger.info(`   document_id: ${document.id}`)
      logger.info(`   content_file_path: ${filePath}`)
      logger.info(`   完整路径: ${fullPath}`)

      try {
        await fs.access(fullPath)
        logger.success(`✅ 找到JSON文件: ${fullPath}`)
        return true
      } catch {
        logger.warn(`⚠️ 文档 [${document.name}] JSON文件不存在: ${fullPath}`)
        return false
      }
    } catch (error) {
      logger.error(`检查JSON文件失败 [${document.name}]:`, error.message)
      return false
    }
  }

  /**
   * 处理单个文档（提取+分析）
   * @param {Object} document - 文档对象
   */
  async processDocument(document) {
    logger.info(`\n📄 开始处理文档: ${document.name}`)
    this.addLog('info', `开始处理文档: ${document.name}`, { documentId: document.id })

    try {
      // 1. 提取文本（如果启用）
      if (this.config.enableAutoExtract && !document.is_extracted) {
        logger.info('📝 正在提取文本...')
        this.addLog('info', `正在提取文本: ${document.name}`)

        // 调用文档服务的提取方法
        // 注意：这里需要确保documentService有extractDocument方法
        // 如果没有，需要调用实际的提取API或方法
        try {
          // 假设有一个批量提取的方法
          const extractResult = await this.extractDocumentText(document.id)
          
          if (extractResult.success) {
            logger.success(`✅ 文本提取完成: ${extractResult.extractedCount} 页`)
            this.addLog('success', `文本提取完成: ${document.name}`, { 
              pages: extractResult.extractedCount 
            })
          } else {
            throw new Error(extractResult.error || '提取失败')
          }
        } catch (extractError) {
          throw new Error(`文本提取失败: ${extractError.message}`)
        }
      }

      // 2. AI分析（如果启用）
      if (this.config.enableAutoAnalysis) {
        logger.info('🤖 正在进行AI分析...')
        this.addLog('info', `正在进行AI分析: ${document.name}`)

        try {
          const analysisResult = await pptAnalysisService.analyzeDocument(
            document.id,
            null, // 不传参数，使用配置的默认模型
            (current, total, result) => {
              // 进度回调
              logger.info(`  分析进度: ${current}/${total}`)
            }
          )

          logger.success(`✅ AI分析完成: 成功=${analysisResult.success}, 失败=${analysisResult.failed}`)
          this.addLog('success', `AI分析完成: ${document.name}`, {
            success: analysisResult.success,
            failed: analysisResult.failed
          })
        } catch (analysisError) {
          throw new Error(`AI分析失败: ${analysisError.message}`)
        }
      }

      logger.success(`✅ 文档处理完成: ${document.name}`)
      this.addLog('success', `文档处理完成: ${document.name}`)

    } catch (error) {
      logger.error(`❌ 文档处理失败 [${document.name}]:`, error.message)
      this.addLog('error', `文档处理失败: ${document.name}`, { error: error.message })
      throw error
    }
  }

  /**
   * 提取文档文本
   * 调用 documentService.extractAndSave 进行实际提取
   */
  async extractDocumentText(documentId) {
    try {
      logger.info(`📝 开始提取文档文本 [${documentId}]`)
      
      // ✅ 调用 documentService 的提取方法
      const result = await documentService.extractAndSave(documentId, 'auto', false)
      
      logger.success(`✅ 文档提取成功: ${result.success_count} 页`)
      
      return {
        success: true,
        extractedCount: result.success_count,
        message: `成功提取 ${result.success_count} 页`
      }
    } catch (error) {
      logger.error(`❌ 提取文档文本失败 [${documentId}]:`, error.message)
      return {
        success: false,
        extractedCount: 0,
        error: error.message
      }
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig) {
    const oldInterval = this.config.pollingInterval

    this.config = {
      ...this.config,
      ...newConfig
    }

    // 如果轮询间隔改变且服务正在运行，需要重启定时器
    if (this.isRunning && oldInterval !== this.config.pollingInterval) {
      this.stop()
      this.start()
    }

    this.addLog('info', '配置已更新', newConfig)
    return this.config
  }

  /**
   * 获取当前配置
   */
  getConfig() {
    return { ...this.config }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      currentTask: this.currentTask,
      statistics: { ...this.statistics },
      config: { ...this.config }
    }
  }

  /**
   * 获取日志
   */
  getLogs(limit = 50) {
    return this.logs.slice(-limit).reverse()
  }

  /**
   * 添加日志
   */
  addLog(level, message, details = {}) {
    const log = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      details,
      timestamp: new Date()
    }

    this.logs.push(log)

    // 保持日志数量在限制内
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    return log
  }

  /**
   * 清空日志
   */
  clearLogs() {
    this.logs = []
  }

  /**
   * 更新下次运行时间
   */
  updateNextRunTime() {
    if (this.isRunning) {
      this.statistics.nextRunTime = new Date(Date.now() + this.config.pollingInterval)
    } else {
      this.statistics.nextRunTime = null
    }
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    // 实时查询最新的统计数据
    const stats = await this.scanDocuments()
    
    return {
      ...this.statistics,
      totalDocuments: stats.total,
      extractedDocuments: stats.extracted,
      analyzedDocuments: stats.analyzed,
      pendingDocuments: stats.pending.length
    }
  }
}

// 导出单例
module.exports = new AutoProcessService()

