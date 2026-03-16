/**
 * 缩略图队列生成 Hooks
 * 与后端队列配合,实现异步生成和进度推送
 *
 * 截图策略：离屏渲染
 * - 每个 slide 在截图时临时挂载到屏幕外的隐藏容器（position:fixed; left:-9999px）
 * - 截完后立即销毁容器，不常驻 DOM，内存占用极低
 * - 完全不依赖左侧缩略图列表的 DOM，支持虚拟滚动
 */
import { createApp, defineComponent, h, onUnmounted } from 'vue'
import { createPinia } from 'pinia'
import { v4 as uuidv4 } from 'uuid'
import { toJpeg } from 'html-to-image'
import axios from '@/services/config'
import { useThumbnailProgressStore, useSlidesStore } from '@/store'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import type { Slide } from '@/types/slides'

export interface QueueTask {
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
  /** 并发截图数量，默认 2，图片多时建议设为 1 */
  concurrency?: number
  /** 是否跳过已有 thumbnail 的页面，默认 true */
  skipExisting?: boolean
}

export function useThumbnailQueue(options: ThumbnailQueueOptions = {}) {
  const progressStore = useThumbnailProgressStore()
  const slidesStore = useSlidesStore()
  let ws: WebSocket | null = null

  const concurrency = options.concurrency ?? 2
  const skipExisting = options.skipExisting ?? false

  /**
   * 创建生成任务
   * 策略：先截图 → 再创建后端任务 → 立即上传
   * 避免后端等待截图时超时（原来先创建任务再截图，截图慢会导致30s超时）
   * @param showModal - 是否显示模态框（默认false，显示迷你进度条）
   */
  async function createTask(documentId: string, slideIds: string[], showModal = false): Promise<string> {
    const taskId = uuidv4()

    // 过滤已有缩略图的页面
    const filteredIds = skipExisting
      ? slideIds.filter(id => {
          const slide = slidesStore.slides.find(s => s.id === id)
          return !slide || !(slide as any).thumbnail
        })
      : slideIds

    if (filteredIds.length === 0) {
      if (import.meta.env.DEV) console.log('[ThumbnailQueue] 所有页面已有缩略图，跳过')
      return taskId
    }

    // 显示进度 UI（截图阶段就开始）
    progressStore.setTask({
      taskId,
      documentId,
      slideIds: filteredIds,
      status: 'processing',
      progress: { total: filteredIds.length, completed: 0, failed: 0 }
    })
    if (showModal) {
      progressStore.setShowProgressModal(true)
    } else {
      progressStore.setShowMiniProgress(true)
    }

    try {
      // 创建后端任务（只登记，不等待）
      const response = await axios.post('/api/thumbnail-tasks', {
        documentId,
        slideIds: filteredIds,
        taskId
      })

      if (!response.success) {
        throw new Error(response.message || '创建任务失败')
      }

      connectWebSocket(taskId)

      // 流水线：截完一张立即上传，边截边传，进度均匀增长
      await captureAndUpload(taskId, documentId, filteredIds)

      return taskId
    } catch (error: any) {
      console.error('[ThumbnailQueue] 任务失败:', error)
      progressStore.clearTask()
      throw error
    }
  }

  /**
   * 流水线：按并发数分批，每批截图完立即上传，不缓存所有 blob
   */
  async function captureAndUpload(taskId: string, documentId: string, slideIds: string[]) {
    for (let i = 0; i < slideIds.length; i += concurrency) {
      const chunk = slideIds.slice(i, i + concurrency)
      // 当前批次：并发截图，截完立即上传
      await Promise.all(chunk.map(async (slideId) => {
        const blob = await captureSlideToBlob(slideId)
        if (blob) {
          await uploadBlob(taskId, documentId, slideId, blob)
        } else {
          updateProgress(false)
        }
      }))
    }
  }

  /**
   * 离屏渲染：把 slide 数据挂到屏幕外容器截图
   * position:fixed + left:-9999px 保证元素有完整布局但用户看不到
   */
  async function renderSlideOffscreen(slide: Slide, viewportRatio: number): Promise<HTMLElement> {
    return new Promise((resolve) => {
      const WIDTH = 1000
      const HEIGHT = Math.round(WIDTH * viewportRatio)

      const container = document.createElement('div')
      container.style.cssText = `
        position: fixed;
        left: -9999px;
        top: 0;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        pointer-events: none;
        z-index: -1;
      `
      document.body.appendChild(container)

      // 用 pinia 实例共享 store 数据给离屏组件
      const pinia = createPinia()

      const OffscreenComp = defineComponent({
        setup() {
          return () => h(ThumbnailSlide, {
            slide,
            size: WIDTH,
            visible: true,
          })
        }
      })

      const app = createApp(OffscreenComp)
      app.use(pinia)

      // 同步主 store 数据到离屏 pinia（viewportRatio/viewportSize/theme）
      const offscreenSlidesStore = useSlidesStore(pinia)
      offscreenSlidesStore.$patch({
        viewportRatio: slidesStore.viewportRatio,
        viewportSize: slidesStore.viewportSize,
        theme: slidesStore.theme,
      })

      app.mount(container)

      // 等待一帧确保 DOM 渲染完毕，再等待所有图片加载完成
      requestAnimationFrame(async () => {
        const el = container.querySelector('[data-slide-id]') as HTMLElement
        const target = el || container

        // 等待容器内所有 <img> 加载完毕，避免截图时图片还未渲染
        const imgs = Array.from(target.querySelectorAll('img')) as HTMLImageElement[]
        await Promise.all(
          imgs
            .filter(img => !img.complete)
            .map(img => new Promise<void>(res => {
              img.onload = () => res()
              img.onerror = () => res() // 加载失败也继续，不卡住
            }))
        )

        resolve(target)
        target.__offscreen_container__ = container
        target.__offscreen_app__ = app
      })
    })
  }

  /**
   * 截图单个 slide，返回 Blob（失败返回 null）
   */
  async function captureSlideToBlob(slideId: string): Promise<Blob | null> {
    let container: HTMLElement | null = null
    let app: ReturnType<typeof createApp> | null = null

    try {
      const slide = slidesStore.slides.find(s => s.id === slideId)
      if (!slide) {
        console.warn(`[ThumbnailQueue] 找不到 slide 数据: ${slideId}`)
        return null
      }

      // 优先复用已在 DOM 中的元素，但必须是已渲染内容（visible=true）
      // 左侧缩略图懒加载时 visible=false 的节点内部是占位符，不能复用
      let element = document.querySelector(`[data-slide-id="${slideId}"]`) as HTMLElement | null
      if (element && element.querySelector('.placeholder')) {
        element = null
      }

      if (!element) {
        element = await renderSlideOffscreen(slide, slidesStore.viewportRatio)
        container = (element as any).__offscreen_container__ || null
        app = (element as any).__offscreen_app__ || null
      }

      const dataUrl = await toJpeg(element, {
        quality: 0.8,
        canvasWidth: 800,
        canvasHeight: Math.round(800 * slidesStore.viewportRatio),
        fontEmbedCSS: '',
        pixelRatio: 1,
      })

      return await fetch(dataUrl).then(res => res.blob())
    } catch (error: any) {
      console.error(`[ThumbnailQueue] 截图失败: ${slideId}`, error)
      return null
    } finally {
      if (app) app.unmount()
      if (container && container.parentNode) container.parentNode.removeChild(container)
    }
  }

  /**
   * 上传单个 Blob 到后端
   */
  async function uploadBlob(
    taskId: string,
    documentId: string,
    slideId: string,
    blob: Blob
  ): Promise<void> {
    const formData = new FormData()
    formData.append('file', blob, `${slideId}.jpg`)
    formData.append('taskId', taskId)
    formData.append('documentId', documentId)
    formData.append('slideId', slideId)

    try {
      await axios.post('/api/thumbnails/upload-from-queue', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      updateProgress(true)
    } catch (error: any) {
      console.error(`[ThumbnailQueue] 上传失败: ${slideId}`, error)
      updateProgress(false)
    }
  }

  /**
   * 更新本地进度
   */
  function updateProgress(success: boolean) {
    const task = progressStore.currentTask
    if (!task) return

    const updated = {
      ...task,
      progress: { ...task.progress }
    }
    if (success) updated.progress.completed++
    else updated.progress.failed++

    if (options.onProgress) {
      options.onProgress(updated.progress)
    }

    const { total, completed, failed } = updated.progress
    if (completed + failed >= total) {
      updated.status = failed > 0 ? 'failed' : 'completed'
      progressStore.setTask(updated)

      if (failed === 0 && options.onCompleted) {
        options.onCompleted()
      } else if (failed > 0 && options.onError) {
        options.onError(`${failed} 个缩略图生成失败`)
      }

      setTimeout(() => closeTask(), 2000)
    } else {
      progressStore.setTask(updated)
    }
  }

  /**
   * 连接WebSocket
   */
  function connectWebSocket(taskId: string) {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = location.host
    const wsUrl = `${protocol}//${host}/ws/thumbnail-progress?taskId=${taskId}`

    if (import.meta.env.DEV) console.log(`[WebSocket] 连接地址: ${wsUrl}`)
    ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      if (import.meta.env.DEV) console.log(`[WebSocket] 已连接: ${taskId}`)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        const task = progressStore.currentTask
        if (task) {
          const updated = {
            ...task,
            progress: {
              total: data.total || task.progress.total,
              completed: data.completed || 0,
              failed: data.failed || 0,
            },
            status: data.status as QueueTask['status'],
          }
          progressStore.setTask(updated)

          if (options.onProgress) options.onProgress(updated.progress)

          if (data.status === 'completed') {
            if (options.onCompleted) options.onCompleted()
            const autoCloseDelay = progressStore.showMiniProgress ? 1000 : 2000
            setTimeout(() => {
              if (progressStore.showMiniProgress) {
                closeTask()
              } else {
                if (ws) { ws.close(); ws = null }
              }
            }, autoCloseDelay)
          }

          if (data.status === 'failed') {
            if (options.onError) options.onError(data.error || '生成失败')
            setTimeout(() => closeTask(), 3000)
          }
        }
      } catch (error) {
        console.error('[WebSocket] 消息解析失败:', error)
      }
    }

    ws.onerror = (error) => console.error('[WebSocket] 连接错误:', error)
    ws.onclose = () => { if (import.meta.env.DEV) console.log('[WebSocket] 连接关闭') }
  }

  /**
   * 关闭任务
   */
  function closeTask() {
    if (ws) { ws.close(); ws = null }
    progressStore.clearTask()
  }

  /**
   * 最小化进度条
   */
  function minimizeProgress() {
    progressStore.setShowMiniProgress(true)
  }

  /**
   * 展开进度条
   */
  function expandProgress() {
    progressStore.setShowProgressModal(true)
  }

  /**
   * 计算进度百分比
   */
  function progressPercentage(): number {
    const task = progressStore.currentTask
    if (!task) return 0
    const { total, completed } = task.progress
    return total > 0 ? Math.floor((completed / total) * 100) : 0
  }

  onUnmounted(() => closeTask())

  return {
    // 状态（从 store 读取，全局共享）
    currentTask: progressStore,
    showProgressModal: progressStore,
    showMiniProgress: progressStore,

    // 方法
    createTask,
    closeTask,
    minimizeProgress,
    expandProgress,
    progressPercentage
  }
}
