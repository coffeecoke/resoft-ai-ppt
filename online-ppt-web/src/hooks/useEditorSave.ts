import { ref, computed, watch, onUnmounted } from 'vue'
import { throttle } from 'lodash'
import { useRoute } from 'vue-router'
import { useSlidesStore } from '@/store'
import axios from '@/services/config'
import { SERVER_URL } from '@/services'
import { getDocument } from '@/services/documentService'
import useSlideChangeTracker from './useSlideChangeTracker'
import useThumbnailQueue from './useThumbnailQueue'

export type EditMode = 'template' | 'document' | 'normal'

export interface EditorData {
  title: string
  width: number
  height: number
  theme: any
  slides: any[]
}

/**
 * 统一编辑器保存 Hook
 * 
 * 功能：
 * 1. 通过URL参数自动识别编辑模式（template/document/normal）
 * 2. 统一的保存函数，根据模式调用不同接口
 * 3. 自动保存机制（30秒，仅在template/document模式生效）
 * 4. 保存状态管理（saving、lastSaveTime、hasUnsavedChanges）
 */
export function useEditorSave() {
  const route = useRoute()
  const slidesStore = useSlidesStore()

  // 识别编辑模式
  const editMode = computed<EditMode>(() => {
    if (route.query.templateId) return 'template'
    if (route.query.documentId) return 'document'
    return 'normal'
  })

  const currentId = computed(() => {
    return (route.query.templateId || route.query.documentId) as string | undefined
  })

  // 幻灯片变更追踪
  const {
    getChangedSlides,
    clearChangedSlides,
    startTracking,
    stopTracking,
    detectChanges,
    createSnapshot,
  } = useSlideChangeTracker()

  // 缩略图队列生成器
  const {
    createTask,
    currentTask,
    showProgressModal,
    showMiniProgress,
    minimizeProgress,
    expandProgress,
  } = useThumbnailQueue({
    onProgress: (progress) => {
      if (import.meta.env.DEV) console.log('[useEditorSave] 缩略图生成进度:', progress)
    },
    onCompleted: () => {
      if (import.meta.env.DEV) console.log('[useEditorSave] 缩略图生成完成')
    },
    onError: (error) => {
      console.error('[useEditorSave] 缩略图生成失败:', error)
    }
  })

  // 生成状态(兼容旧代码)
  const generatingThumbnails = ref(false)
  const thumbnailProgress = ref({ current: 0, total: 0 })

  /**
   * 判断文档是否已发布
   * 如果 metadata 不存在（刷新页面后），会尝试重新加载
   */
  const isPublished = async (): Promise<boolean> => {
    // 如果 metadata 不存在，尝试从后端加载
    if (!slidesStore.metadata && currentId.value) {
      if (import.meta.env.DEV) console.log('[useEditorSave] metadata 不存在，尝试重新加载')
      try {
        const resp = await getDocument(currentId.value)
        slidesStore.setMetadata(resp.metadata)
        if (import.meta.env.DEV) console.log('[useEditorSave] 已重新加载文档状态:', resp.metadata.status)
      } catch (error) {
        console.error('[useEditorSave] 获取文档状态失败:', error)
        return false  // 出错时按草稿处理
      }
    }

    return slidesStore.metadata?.status === 'published'
  }

  /**
   * 异步生成缩略图(使用新队列系统)
   * @param documentId - 文档ID
   * @param slides - 要生成的slides数组
   * @param showModal - 是否显示模态框（默认false，自动保存时使用迷你进度条）
   */
  const generateThumbnailsAsync = async (documentId: string, slides: any[], showModal = false) => {
    if (!slides || slides.length === 0) {
      if (import.meta.env.DEV) console.log('[useEditorSave] 没有需要生成的缩略图')
      return
    }

    try {
      generatingThumbnails.value = true
      thumbnailProgress.value = { current: 0, total: slides.length }

      const slideIds = slides.map(s => s.id)
      if (import.meta.env.DEV) console.log(`[useEditorSave] 启动缩略图生成任务: ${slideIds.length} 个slides (${showModal ? '模态框' : '迷你进度条'})`)

      await createTask(documentId, slideIds, showModal)

      if (import.meta.env.DEV) console.log('[useEditorSave] 缩略图生成任务已创建')
    } catch (error: any) {
      console.error('[useEditorSave] 创建缩略图生成任务失败:', error)
      throw error
    } finally {
      generatingThumbnails.value = false
    }
  }

  // 获取当前编辑的数据
  const getEditorData = (): EditorData => {
    const defaultTitle = editMode.value === 'template' ? '未命名模板' : '未命名文档'
    return {
      title: slidesStore.title || defaultTitle,
      width: 1000,
      height: 562.5,
      theme: slidesStore.theme,
      slides: slidesStore.slides,
    }
  }

  // 保存状态
  const saving = ref(false)
  const lastSaveTime = ref<number>(0)
  const hasUnsavedChanges = ref(false)

  // 统一保存函数
  const save = async (autoSave = false, generateCover = false) => {
    const mode = editMode.value
    const id = currentId.value

    if (mode === 'normal' || !id) {
      console.warn('[useEditorSave] 普通编辑模式或缺少ID，无法保存')
      return
    }

    if (saving.value) return

    saving.value = true
    try {
      const data = getEditorData()
      
      let url = ''
      let requestBody: any = {
        autoSave,
      }

      if (mode === 'template') {
        url = `${SERVER_URL}/templates/${id}`
        // 兼容后端接口：如果后端支持data字段，优先使用；否则使用templateData
        requestBody.templateData = data
        requestBody.data = data
      } else if (mode === 'document') {
        url = `${SERVER_URL}/documents/${id}`
        // 兼容后端接口：如果后端支持data字段，优先使用；否则使用documentData
        requestBody.documentData = data
        requestBody.data = data
      }

      const resp = await axios.put(url, requestBody)

      if (!resp?.success) {
        throw new Error(resp?.error || '保存失败')
      }

      // 【新增】手动保存时智能生成第一页缩略图作为封面
      // 注意：必须在 hasUnsavedChanges 设置为 false 之前检查
      const hadUnsavedChanges = hasUnsavedChanges.value

      lastSaveTime.value = Date.now()
      hasUnsavedChanges.value = false

      if (generateCover && id) {
        const slides = slidesStore.slides
        if (slides.length > 0) {
          const firstSlide = slides[0]
          const changedSlides = getChangedSlides()

          // 智能判断生成条件：
          // 1. 第一页没有缩略图（首次生成）
          // 2. 第一页在变更列表中（明确检测到变更）
          // 3. 有未保存的变更（用户修改了内容，即使变更追踪没检测到）
          const noThumbnail = !firstSlide.thumbnail
          const firstSlideChanged = changedSlides.some(s => s.id === firstSlide.id)
          const hasChanges = hadUnsavedChanges

          const needGenerate = noThumbnail || firstSlideChanged || hasChanges

          if (needGenerate) {
            // 检查是否已有生成任务在进行中（避免与发布时的生成任务冲突）
            if (generatingThumbnails.value) {
              if (import.meta.env.DEV) console.log('[useEditorSave] 已有缩略图生成任务在进行中，跳过保存时的封面生成')
            } else {
              const modeName = mode === 'template' ? '模板' : '文档'
              const reason = noThumbnail ? '无缩略图' : firstSlideChanged ? '检测到变更' : '有未保存变更'
              if (import.meta.env.DEV) console.log(`[useEditorSave] 手动保存${modeName}，生成第一页缩略图作为封面 (原因: ${reason})`)
              // 异步生成，不阻塞保存流程，使用迷你进度条
              generateThumbnailsAsync(id, [firstSlide], false)
            }
          } else {
            if (import.meta.env.DEV) console.log('[useEditorSave] 第一页未变更且已有缩略图，跳过封面生成')
          }
        }
      }

      // 【新增】已发布文档：保存时生成变更页面的缩略图
      if (await isPublished() && mode === 'document') {
        const changedSlides = getChangedSlides()
        if (changedSlides.length > 0 && !generatingThumbnails.value) {
          if (import.meta.env.DEV) console.log(`[useEditorSave] 已发布文档，保存时生成 ${changedSlides.length} 个变更页面的缩略图`)
          // 使用迷你进度条，不影响编辑体验
          generateThumbnailsAsync(id, changedSlides, false)
        }
      }

      // 保存成功后，清空变更记录并更新快照
      clearChangedSlides()
      createSnapshot()  // 【修复】更新快照，以便下次能检测到新的变更
      
      return resp
    } catch (error) {
      const modeName = mode === 'template' ? '模板' : '文档'
      console.error(`[useEditorSave] 保存${modeName}失败:`, error)
      throw error
    } finally {
      saving.value = false
    }
  }

  // 自动保存（30秒）
  const autoSave = async () => {
    if (editMode.value === 'normal') return
    if (saving.value || !hasUnsavedChanges.value) return
    
    try {
      await save(true)
    } catch (error) {
      // 自动保存失败不提示用户，只记录日志
      console.warn('[useEditorSave] 自动保存失败:', error)
    }
  }

  // 启动自动保存定时器（仅在template/document模式）
  let timer: NodeJS.Timeout | null = null
  
  const startAutoSave = () => {
    if (editMode.value !== 'normal' && !timer) {
      timer = setInterval(autoSave, 30000)
    }
  }

  const stopAutoSave = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // 监听编辑模式变化，启动/停止自动保存和变更追踪
  watch(editMode, (newMode) => {
    if (newMode === 'normal') {
      stopAutoSave()
      stopTracking()
    } else {
      startAutoSave()
      // 启动变更追踪（文档和模版模式都需要，用于智能生成封面）
      startTracking()
    }
  }, { immediate: true })

  // 标记有变更
  const markAsChanged = () => {
    if (editMode.value !== 'normal') {
      hasUnsavedChanges.value = true
    }
  }

  // 监听 slides 变化，自动标记为有变更（节流避免频繁触发导致内存压力）
  const throttledMarkAsChanged = throttle(() => {
    markAsChanged()
  }, 2000, { leading: true, trailing: true })
  watch(
    () => slidesStore.slides,
    () => {
      throttledMarkAsChanged()
    },
    { deep: true }
  )

  // 清理
  onUnmounted(() => {
    throttledMarkAsChanged.cancel()
    stopAutoSave()
    stopTracking()
  })

  /**
   * 生成预览图（用于发布时调用）
   * 策略：只生成缺少缩略图的页面
   */
  const generateThumbnailsForPublish = async () => {
    const mode = editMode.value
    const id = currentId.value

    if (mode !== 'document' || !id) {
      console.warn('[useEditorSave] 只有文档模式才能生成预览图')
      return
    }

    if (import.meta.env.DEV) console.log('[useEditorSave] 开始检测需要生成预览图的幻灯片...')

    // 只检测缺少缩略图的幻灯片
    const slidesWithoutThumbnail = slidesStore.slides.filter(slide => !slide.thumbnail)

    if (slidesWithoutThumbnail.length > 0) {
      const published = await isPublished()
      const statusText = published ? '已发布文档' : '首次发布'
      if (import.meta.env.DEV) {
        console.log(`[useEditorSave] ${statusText}，生成 ${slidesWithoutThumbnail.length} 个缺少缩略图的幻灯片`)
        console.log(`  缺少缩略图的幻灯片 ID: [${slidesWithoutThumbnail.map(s => s.id).join(', ')}]`)
      }

      // 异步生成预览图，不阻塞发布流程
      // 发布时使用模态框，因为这是主动操作，用户会等待结果
      await generateThumbnailsAsync(id, slidesWithoutThumbnail, true)

      // 清空变更记录并更新快照
      clearChangedSlides()
      createSnapshot()  // 【修复】更新快照，以便下次能检测到新的变更

      if (import.meta.env.DEV) console.log('[useEditorSave] 预览图生成任务已创建')
    } else {
      if (import.meta.env.DEV) console.log('[useEditorSave] ✅ 所有幻灯片都有预览图，跳过生成')
    }
  }

  return {
    editMode,
    currentId,
    saving,
    lastSaveTime,
    hasUnsavedChanges,
    save,
    markAsChanged,
    generatingThumbnails,
    thumbnailProgress,
    generateThumbnailsForPublish,
    // 新增: 进度UI相关
    currentTask,
    showProgressModal,
    showMiniProgress,
    minimizeProgress,
    expandProgress,
  }
}