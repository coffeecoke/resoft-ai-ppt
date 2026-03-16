/**
 * 缩略图任务管理服务（方案A：直接接收模式）
 * 不再等待前端上传，上传接口收到后直接调 reportUpload 推进度
 */
import * as prismaClient from '@prisma/client'

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

class ThumbnailQueue {
  constructor() {
    // 任务 Map<taskId, taskData>
    this.tasks = new Map()

    // WebSocket 连接 Map<taskId, ws>
    this.wsConnections = new Map()

    // 单次最多生成页数
    this.maxPagePerTask = 100
  }

  /**
   * 登记任务（不再主动等待，只记录元信息）
   */
  async addTask(taskData) {
    const { taskId, documentId, slideIds, userId } = taskData

    if (slideIds.length > this.maxPagePerTask) {
      throw new Error(`超过单次生成上限${this.maxPagePerTask}页，当前${slideIds.length}页`)
    }

    const document = await prisma.documents.findUnique({ where: { id: documentId } })
    if (!document) throw new Error('文档不存在')

    const task = {
      id: taskId,
      document_id: documentId,
      user_id: userId,
      slide_ids: slideIds,
      total_count: slideIds.length,
      completed_count: 0,
      failed_count: 0,
      status: 'processing',
      created_at: new Date(),
    }

    this.tasks.set(taskId, task)

    // 通知前端任务已就绪
    this.notifyProgress(taskId, {
      status: 'processing',
      total: slideIds.length,
      completed: 0,
      failed: 0,
    })

    return task
  }

  /**
   * 上传接口收到一张图后调此方法更新进度并推 WebSocket
   */
  reportUpload(taskId, slideId, success) {
    const task = this.tasks.get(taskId)
    if (!task) return

    if (success) {
      task.completed_count++
    } else {
      task.failed_count++
    }

    const { total_count, completed_count, failed_count } = task
    const done = completed_count + failed_count >= total_count

    if (done) {
      task.status = failed_count > 0 ? 'completed_with_errors' : 'completed'
      task.finished_at = new Date()
    }

    this.notifyProgress(taskId, {
      status: done ? task.status : 'processing',
      total: total_count,
      completed: completed_count,
      failed: failed_count,
    })

    // 全部完成后更新文档封面，延迟清理任务
    if (done) {
      this.updateDocumentCover(task.document_id)
      setTimeout(() => this.tasks.delete(taskId), 60000)
    }
  }

  /**
   * 更新文档封面（使用第一页缩略图）
   */
  async updateDocumentCover(documentId) {
    try {
      const firstThumbnail = await prisma.thumbnails.findFirst({
        where: { document_id: documentId, slide_index: 0 },
        orderBy: { generated_at: 'desc' },
      })
      if (firstThumbnail) {
        await prisma.documents.update({
          where: { id: documentId },
          data: { cover: firstThumbnail.url },
        })
        console.log(`[ThumbnailQueue] 更新文档封面: ${documentId}`)
      }
    } catch (error) {
      console.error(`[ThumbnailQueue] 更新文档封面失败: ${documentId}`, error)
    }
  }

  /**
   * WebSocket 推进度
   */
  notifyProgress(taskId, progressData) {
    const ws = this.wsConnections.get(taskId)
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(progressData))
    }
  }

  registerWebSocket(taskId, ws) {
    this.wsConnections.set(taskId, ws)
    console.log(`[ThumbnailQueue] 注册WebSocket: ${taskId}`)
  }

  unregisterWebSocket(taskId) {
    this.wsConnections.delete(taskId)
    console.log(`[ThumbnailQueue] 注销WebSocket: ${taskId}`)
  }

  getTaskStatus(taskId) {
    return this.tasks.get(taskId) || null
  }

  getStats() {
    return {
      task_count: this.tasks.size,
      active_connections: this.wsConnections.size,
    }
  }
}

const thumbnailQueue = new ThumbnailQueue()
export default thumbnailQueue
