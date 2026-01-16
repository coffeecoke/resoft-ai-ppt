/**
 * WebSocket 服务 - 缩略图生成进度推送
 * 路径: /ws/thumbnail-progress?taskId=<taskId>
 */
import thumbnailQueue from '../../services/thumbnailQueue.js'
import { WebSocketServer } from 'ws'

/**
 * 设置 WebSocket 服务
 * @param {http.Server} server - HTTP 服务器实例
 */
function setupThumbnailProgressWS(server) {
  const wss = new WebSocketServer({
    server,
    path: '/ws/thumbnail-progress'
  })

  wss.on('connection', (ws, req) => {
    // 从 query 中获取 taskId
    const url = new URL(req.url, 'http://localhost')
    const taskId = url.searchParams.get('taskId')

    if (!taskId) {
      ws.close(1008, 'Missing taskId')
      return
    }

    console.log(`[WebSocket] 客户端连接: taskId=${taskId}`)

    // 注册连接到队列
    thumbnailQueue.registerWebSocket(taskId, ws)

    // 发送初始状态
    const task = thumbnailQueue.getTaskStatus(taskId)
    if (task) {
      ws.send(JSON.stringify({
        status: task.status,
        total: task.total_count,
        completed: task.completed_count,
        failed: task.failed_count,
        message: '已连接到进度推送服务'
      }))
    } else {
      ws.send(JSON.stringify({
        status: 'not_found',
        message: '任务不存在或已完成'
      }))
    }

    // 监听消息
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data)
        console.log(`[WebSocket] 收到消息: taskId=${taskId}`, message)

        // 可以处理客户端发来的消息，如取消任务等
        if (message.action === 'cancel') {
          // TODO: 实现取消任务逻辑
          ws.send(JSON.stringify({
            status: 'cancel_not_supported',
            message: '暂不支持取消任务'
          }))
        }
      } catch (error) {
        console.error(`[WebSocket] 消息处理失败: taskId=${taskId}`, error)
      }
    })

    // 监听关闭
    ws.on('close', (code, reason) => {
      console.log(`[WebSocket] 客户端断开: taskId=${taskId}, code=${code}, reason=${reason || '无'}`)
      thumbnailQueue.unregisterWebSocket(taskId)
    })

    // 监听错误
    ws.on('error', (error) => {
      console.error(`[WebSocket] 连接错误: taskId=${taskId}`, error)
      thumbnailQueue.unregisterWebSocket(taskId)
    })

    // 发送心跳（保持连接）
    const heartbeatInterval = setInterval(() => {
      if (ws.readyState === 1) { // WebSocket.OPEN = 1
        ws.ping()
      } else {
        clearInterval(heartbeatInterval)
      }
    }, 30000) // 每30秒发送一次心跳

    // 清理心跳定时器
    ws.on('close', () => {
      clearInterval(heartbeatInterval)
    })
  })

  console.log('[WebSocket] 缩略图进度推送服务已启动: /ws/thumbnail-progress')
}

export { setupThumbnailProgressWS }
