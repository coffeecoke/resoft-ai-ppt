/**
 * 缩略图生成队列服务
 * 使用内存队列管理生成任务，通过 WebSocket 推送进度
 */
import * as prismaClient from '@prisma/client'

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

class ThumbnailQueue {
  constructor() {
    // 待处理任务队列
    this.queue = []

    // 正在处理的任务 Map<taskId, taskData>
    this.processing = new Map()

    // WebSocket 连接 Map<taskId, ws>
    this.wsConnections = new Map()

    // 固定并发数
    this.concurrency = 5

    // 单次最多生成页数
    this.maxPagePerTask = 100

    // 单页超时时间（毫秒）
    this.singlePageTimeout = 30000

    // 上传等待器 Map<slideId, {resolve, reject}>
    this.uploadWaiters = new Map()
  }

  /**
   * 添加任务到队列
   * @param {Object} taskData - 任务数据
   * @param {string} taskData.taskId - 任务ID
   * @param {string} taskData.documentId - 文档ID
   * @param {string[]} taskData.slideIds - 幻灯片ID列表
   * @param {string} taskData.userId - 用户ID
   * @returns {Promise<Object>} 任务对象
   */
  async addTask(taskData) {
    const { taskId, documentId, slideIds, userId } = taskData

    // 验证页数限制
    if (slideIds.length > this.maxPagePerTask) {
      throw new Error(`超过单次生成上限${this.maxPagePerTask}页，当前${slideIds.length}页`)
    }

    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })

    if (!document) {
      throw new Error('文档不存在')
    }

    // 创建任务对象（内存中，不存数据库）
    const task = {
      id: taskId,
      document_id: documentId,
      user_id: userId,
      slide_ids: slideIds,
      total_count: slideIds.length,
      completed_count: 0,
      failed_count: 0,
      status: 'pending',
      created_at: new Date(),
      results: [] // 存储每个slide的结果
    }

    this.queue.push(task)

    // 触发队列处理
    this.processQueue()

    return task
  }

  /**
   * 队列处理逻辑
   */
  async processQueue() {
    while (this.queue.length > 0 && this.processing.size < this.concurrency) {
      const task = this.queue.shift()
      this.processing.set(task.id, task)

      // 异步处理单个任务（不阻塞队列）
      this.processTask(task).finally(() => {
        this.processing.delete(task.id)
        this.processQueue() // 继续处理下一个
      })
    }
  }

  /**
   * 处理单个任务
   * @param {Object} task - 任务对象
   */
  async processTask(task) {
    const { id: taskId, slide_ids } = task

    try {
      // 更新状态为处理中
      task.status = 'processing'
      this.notifyProgress(taskId, {
        status: 'processing',
        total: slide_ids.length,
        completed: 0,
        failed: 0
      })

      // 批量处理slides（每批5个并发）
      const concurrency = 5
      const results = []

      for (let i = 0; i < slide_ids.length; i += concurrency) {
        const chunk = slide_ids.slice(i, i + concurrency)
        const chunkResults = await Promise.all(
          chunk.map(slideId => this.processSlide(taskId, slideId))
        )
        results.push(...chunkResults)
      }

      // 统计结果
      const completed = results.filter(r => r.success).length
      const failed = results.filter(r => !r.success).length

      task.completed_count = completed
      task.failed_count = failed
      task.status = 'completed'
      task.finished_at = new Date()

      // WebSocket通知完成
      this.notifyProgress(taskId, {
        status: 'completed',
        total: slide_ids.length,
        completed,
        failed
      })

      // 更新文档封面（使用第一页缩略图）
      await this.updateDocumentCover(task.document_id)

    } catch (error) {
      console.error(`[ThumbnailQueue] 任务处理失败: ${taskId}`, error)
      task.status = 'failed'
      task.error_message = error.message
      task.finished_at = new Date()

      this.notifyProgress(taskId, {
        status: 'failed',
        error: error.message
      })
    }
  }

  /**
   * 处理单个slide
   * @param {string} taskId - 任务ID
   * @param {string} slideId - 幻灯片ID
   * @param {number} retries - 重试次数
   * @returns {Promise<Object>} 处理结果
   */
  async processSlide(taskId, slideId, retries = 3) {
    try {
      // 等待前端上传完成或超时
      const result = await this.waitForUpload(taskId, slideId, this.singlePageTimeout)

      if (result.success) {
        // 更新任务进度
        const task = this.processing.get(taskId)
        if (task) {
          task.completed_count++
          task.results.push({ slideId, success: true })

          // 推送进度
          this.notifyProgress(taskId, {
            status: 'processing',
            total: task.total_count,
            completed: task.completed_count,
            failed: task.failed_count
          })
        }

        return { success: true, slideId }
      } else {
        throw new Error('上传失败')
      }
    } catch (error) {
      console.error(`[ThumbnailQueue] 处理slide失败: ${slideId}`, error)

      if (retries > 0) {
        // 自动重试
        console.log(`[ThumbnailQueue] 重试 slide: ${slideId}, 剩余次数: ${retries - 1}`)
        await this.sleep(1000) // 等待1秒后重试
        return this.processSlide(taskId, slideId, retries - 1)
      } else {
        // 重试失败后静默处理
        const task = this.processing.get(taskId)
        if (task) {
          task.failed_count++
          task.results.push({ slideId, success: false, error: error.message })
        }

        return { success: false, slideId }
      }
    }
  }

  /**
   * 等待前端上传
   * @param {string} taskId - 任务ID
   * @param {string} slideId - 幻灯片ID
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<Object>} 上传结果
   */
  async waitForUpload(taskId, slideId, timeout) {
    const key = `${taskId}_${slideId}`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.uploadWaiters.delete(key)
        reject(new Error(`上传超时: ${slideId}`))
      }, timeout)

      this.uploadWaiters.set(key, {
        resolve: (result) => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        }
      })
    })
  }

  /**
   * 标记上传完成（由上传接口调用）
   * @param {string} taskId - 任务ID
   * @param {string} slideId - 幻灯片ID
   * @param {Object} result - 上传结果
   */
  markUploadComplete(taskId, slideId, result) {
    const key = `${taskId}_${slideId}`
    const waiter = this.uploadWaiters.get(key)

    if (waiter) {
      waiter.resolve(result)
      this.uploadWaiters.delete(key)
    } else {
      console.warn(`[ThumbnailQueue] 未找到上传等待器: ${key}`)
    }
  }

  /**
   * 更新文档封面（使用第一页缩略图）
   * @param {string} documentId - 文档ID
   */
  async updateDocumentCover(documentId) {
    try {
      // 查询第一页缩略图
      const firstThumbnail = await prisma.thumbnails.findFirst({
        where: {
          document_id: documentId,
          slide_index: 0
        },
        orderBy: { generated_at: 'desc' }
      })

      if (firstThumbnail) {
        // 更新文档封面
        await prisma.documents.update({
          where: { id: documentId },
          data: { cover: firstThumbnail.url }
        })

        console.log(`[ThumbnailQueue] 更新文档封面: ${documentId}`)
      }
    } catch (error) {
      console.error(`[ThumbnailQueue] 更新文档封面失败: ${documentId}`, error)
    }
  }

  /**
   * WebSocket通知进度
   * @param {string} taskId - 任务ID
   * @param {Object} progressData - 进度数据
   */
  notifyProgress(taskId, progressData) {
    const ws = this.wsConnections.get(taskId)

    if (ws && ws.readyState === 1) { // WebSocket.OPEN = 1
      ws.send(JSON.stringify(progressData))
    }
  }

  /**
   * 注册WebSocket连接
   * @param {string} taskId - 任务ID
   * @param {WebSocket} ws - WebSocket连接
   */
  registerWebSocket(taskId, ws) {
    this.wsConnections.set(taskId, ws)
    console.log(`[ThumbnailQueue] 注册WebSocket: ${taskId}`)
  }

  /**
   * 注销WebSocket连接
   * @param {string} taskId - 任务ID
   */
  unregisterWebSocket(taskId) {
    this.wsConnections.delete(taskId)
    console.log(`[ThumbnailQueue] 注销WebSocket: ${taskId}`)
  }

  /**
   * 获取任务状态
   * @param {string} taskId - 任务ID
   * @returns {Object|null} 任务对象
   */
  getTaskStatus(taskId) {
    // 先在处理中查找
    let task = this.processing.get(taskId)

    // 再在队列中查找
    if (!task) {
      task = this.queue.find(t => t.id === taskId)
    }

    return task || null
  }

  /**
   * 获取队列统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      queue_length: this.queue.length,
      processing_count: this.processing.size,
      active_connections: this.wsConnections.size
    }
  }

  /**
   * 休眠指定毫秒
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 导出单例
const thumbnailQueue = new ThumbnailQueue()

export default thumbnailQueue
