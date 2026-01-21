/**
 * 缩略图生成任务路由
 * POST /api/thumbnail-tasks - 创建任务
 * GET  /api/thumbnail-tasks/:taskId - 查询任务状态
 * GET  /api/thumbnail-tasks/stats - 获取队列统计
 */
import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import thumbnailQueue from '../services/thumbnailQueue.js'

const router = Router()

/**
 * 创建缩略图生成任务
 */
router.post('/', async (req, res) => {
  try {
    const { documentId, slideIds, taskId } = req.body

    // 验证必需参数
    if (!documentId) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: documentId'
      })
    }

    if (!slideIds || !Array.isArray(slideIds) || slideIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '缺少必需参数: slideIds (必须是非空数组)'
      })
    }

    // 生成或使用提供的taskId
    const finalTaskId = taskId || uuidv4()

    // 从token中获取用户ID（假设有认证中间件）
    const userId = req.user?.userId || null

    // 添加任务到队列
    const task = await thumbnailQueue.addTask({
      taskId: finalTaskId,
      documentId,
      slideIds,
      userId
    })

    res.json({
      success: true,
      taskId: finalTaskId,
      message: '任务创建成功',
      task: {
        id: task.id,
        document_id: task.document_id,
        total_count: task.total_count,
        status: task.status
      }
    })
  } catch (error) {
    console.error('[ThumbnailTasks] 创建任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '创建任务失败'
    })
  }
})

/**
 * 查询任务状态
 */
router.get('/:taskId', (req, res) => {
  try {
    const { taskId } = req.params

    const task = thumbnailQueue.getTaskStatus(taskId)

    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      })
    }

    res.json({
      success: true,
      task: {
        id: task.id,
        document_id: task.document_id,
        total_count: task.total_count,
        completed_count: task.completed_count,
        failed_count: task.failed_count,
        status: task.status,
        created_at: task.created_at,
        finished_at: task.finished_at,
        error_message: task.error_message
      }
    })
  } catch (error) {
    console.error('[ThumbnailTasks] 查询任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '查询任务失败'
    })
  }
})

/**
 * 获取队列统计信息
 */
router.get('/stats/queue', (req, res) => {
  try {
    const stats = thumbnailQueue.getStats()

    res.json({
      success: true,
      stats: {
        queue_length: stats.queue_length,
        processing_count: stats.processing_count,
        active_connections: stats.active_connections
      }
    })
  } catch (error) {
    console.error('[ThumbnailTasks] 获取统计信息失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取统计信息失败'
    })
  }
})

export default router
