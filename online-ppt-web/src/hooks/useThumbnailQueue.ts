/**
 * 缩略图队列生成 Hooks
 * 与后端队列配合,实现异步生成和进度推送
 */
import { ref, onUnmounted } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { toJpeg } from 'html-to-image'
import axios from 'axios'

interface QueueTask {
  taskId: string
  documentId: string
  slideIds: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: { total: number; completed: number; failed: number }
  error?: string
}

interface ThumbnailQueueOptions {
  onProgress?: (progress: { total: number; completed: number; failed: number }) => void
  onCompleted?: () => void
  onError?: (error: string) => void
}

export function useThumbnailQueue(options: ThumbnailQueueOptions = {}) {
  const currentTask = ref<QueueTask | null>(null)
  const ws = ref<WebSocket | null>(null)
  const showProgressModal = ref(false)
  const showMiniProgress = ref(false)

  /**
   * 创建生成任务
   * @param showModal - 是否显示模态框（默认false，显示迷你进度条）
   */
  async function createTask(documentId: string, slideIds: string[], showModal = false): Promise<string> {
    const taskId = uuidv4()

    // 1. 调用后端创建任务
    try {
      const response = await axios.post('/api/thumbnail-tasks', {
        documentId,
        slideIds,
        taskId
      })

      if (!response.data.success) {
        throw new Error(response.data.message || '创建任务失败')
      }

      // 2. 建立WebSocket连接
      connectWebSocket(taskId)

      // 3. 显示进度提示（模态框或迷你进度条）
      currentTask.value = {
        taskId,
        documentId,
        slideIds,
        status: 'processing',
        progress: { total: slideIds.length, completed: 0, failed: 0 }
      }

      // 根据参数决定显示方式
      if (showModal) {
        showProgressModal.value = true
      } else {
        showMiniProgress.value = true
      }

      // 4. 开始前端生成并上传
      await processSlides(taskId, documentId, slideIds)

      return taskId
    } catch (error: any) {
      console.error('[ThumbnailQueue] 创建任务失败:', error)
      throw error
    }
  }

  /**
   * 处理slides生成
   */
  async function processSlides(taskId: string, documentId: string, slideIds: string[]) {
    const concurrency = 5 // 每批5个并发

    for (let i = 0; i < slideIds.length; i += concurrency) {
      const chunk = slideIds.slice(i, i + concurrency)
      await Promise.all(chunk.map(slideId =>
        generateAndUploadSlide(taskId, documentId, slideId)
      ))
    }
  }

  /**
   * 生成单个slide并上传
   */
  async function generateAndUploadSlide(
    taskId: string,
    documentId: string,
    slideId: string
  ): Promise<{ success: boolean; slideId: string }> {
    try {
      // 查找slide元素
      const element = findSlideElement(slideId)

      if (!element) {
        console.warn(`[ThumbnailQueue] 找不到slide元素: ${slideId}`)
        return { success: false, slideId }
      }

      // 生成dataURL
      const dataUrl = await toJpeg(element, {
        quality: 0.8,
        canvasWidth: 800,
        canvasHeight: 450,
        fontEmbedCSS: '',
        pixelRatio: 1
      })

      // 将dataURL转换为Blob
      const blob = await fetch(dataUrl).then(res => res.blob())

      // 上传到后端
      const formData = new FormData()
      formData.append('file', blob, `${slideId}.jpg`)
      formData.append('taskId', taskId)
      formData.append('documentId', documentId)
      formData.append('slideId', slideId)

      await axios.post('/api/thumbnails/upload-from-queue', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      // 更新进度
      updateProgress(true)

      return { success: true, slideId }
    } catch (error: any) {
      console.error(`[ThumbnailQueue] 生成失败: ${slideId}`, error)

      // 更新进度
      updateProgress(false)

      return { success: false, slideId }
    }
  }

  /**
   * 更新本地进度（前端生成时使用）
   */
  function updateProgress(success: boolean) {
    if (!currentTask.value) return

    if (success) {
      currentTask.value.progress.completed++
    } else {
      currentTask.value.progress.failed++
    }

    // 触发进度回调
    if (options.onProgress) {
      options.onProgress(currentTask.value.progress)
    }

    // 检查是否全部完成
    const { total, completed, failed } = currentTask.value.progress
    if (completed + failed >= total) {
      currentTask.value.status = failed > 0 ? 'failed' : 'completed'

      if (failed === 0 && options.onCompleted) {
        options.onCompleted()
      } else if (failed > 0 && options.onError) {
        options.onError(`${failed} 个缩略图生成失败`)
      }

      setTimeout(() => {
        closeTask()
      }, 2000)
    }
  }

  /**
   * 查找slide元素
   * 复用现有的查找逻辑
   */
  function findSlideElement(slideId: string): HTMLElement | null {
    // 策略1: 通过data-slide-id属性查找
    let element = document.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement

    if (element) return element

    // 策略2: 在缩略图列表中查找
    element = document.querySelector(`.thumbnail-list [data-slide-id="${slideId}"]`) as HTMLElement

    if (element) return element

    // 策略3: 遍历所有.thumbnail-slide元素
    const thumbnailSlides = document.querySelectorAll('.thumbnail-slide')
    for (const slide of thumbnailSlides) {
      if (slide.getAttribute('data-slide-id') === slideId) {
        return slide as HTMLElement
      }
    }

    console.warn(`[ThumbnailQueue] 未找到slide元素: ${slideId}`)
    return null
  }

  /**
   * 连接WebSocket
   */
  function connectWebSocket(taskId: string) {
    // 开发环境下，WebSocket 通过 Vite 代理到后端
    // 生产环境下，使用当前 host
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = location.host
    const wsUrl = `${protocol}//${host}/ws/thumbnail-progress?taskId=${taskId}`

    console.log(`[WebSocket] 连接地址: ${wsUrl}`)
    ws.value = new WebSocket(wsUrl)

    ws.value.onopen = () => {
      console.log(`[WebSocket] 已连接: ${taskId}`)
    }

    ws.value.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (currentTask.value) {
          currentTask.value.progress = {
            total: data.total || currentTask.value.progress.total,
            completed: data.completed || 0,
            failed: data.failed || 0
          }
          currentTask.value.status = data.status

          // 触发进度回调
          if (options.onProgress) {
            options.onProgress(currentTask.value.progress)
          }

          // 完成后关闭连接
          if (data.status === 'completed') {
            if (options.onCompleted) {
              options.onCompleted()
            }

            // 迷你进度条完成后自动隐藏（1秒），模态框需要用户手动关闭（2秒后可关闭）
            const autoCloseDelay = showMiniProgress.value ? 1000 : 2000
            setTimeout(() => {
              if (showMiniProgress.value) {
                // 迷你进度条自动完全关闭
                closeTask()
              } else {
                // 模态框只关闭 WebSocket，保留显示让用户手动关闭
                if (ws.value) {
                  ws.value.close()
                  ws.value = null
                }
              }
            }, autoCloseDelay)
          }

          // 失败处理
          if (data.status === 'failed') {
            if (options.onError) {
              options.onError(data.error || '生成失败')
            }

            setTimeout(() => {
              closeTask()
            }, 3000)
          }
        }
      } catch (error) {
        console.error('[WebSocket] 消息解析失败:', error)
      }
    }

    ws.value.onerror = (error) => {
      console.error('[WebSocket] 连接错误:', error)
    }

    ws.value.onclose = () => {
      console.log('[WebSocket] 连接关闭')
    }
  }

  /**
   * 关闭任务
   */
  function closeTask() {
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    showProgressModal.value = false
    showMiniProgress.value = false
    currentTask.value = null
  }

  /**
   * 最小化进度条(切换到mini进度条)
   */
  function minimizeProgress() {
    showProgressModal.value = false
    showMiniProgress.value = true
  }

  /**
   * 展开进度条(切换到模态框)
   */
  function expandProgress() {
    showProgressModal.value = true
    showMiniProgress.value = false
  }

  /**
   * 计算进度百分比
   */
  function progressPercentage(): number {
    if (!currentTask.value) return 0

    const { total, completed } = currentTask.value.progress
    return total > 0 ? Math.floor((completed / total) * 100) : 0
  }

  // 清理
  onUnmounted(() => {
    closeTask()
  })

  return {
    // 状态
    currentTask,
    showProgressModal,
    showMiniProgress,

    // 方法
    createTask,
    closeTask,
    minimizeProgress,
    expandProgress,

    // 工具方法
    progressPercentage
  }
}

export default useThumbnailQueue
