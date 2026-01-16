import { ref, computed, watch, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useSlidesStore } from '@/store'
import axios from '@/services/config'
import { SERVER_URL } from '@/services'
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
      console.log('[useEditorSave] 缩略图生成进度:', progress)
    },
    onCompleted: () => {
      console.log('[useEditorSave] 缩略图生成完成')
    },
    onError: (error) => {
      console.error('[useEditorSave] 缩略图生成失败:', error)
    }
  })

  // 生成状态(兼容旧代码)
  const generatingThumbnails = ref(false)
  const thumbnailProgress = ref({ current: 0, total: 0 })

  /**
   * 异步生成缩略图(使用新队列系统)
   * @param documentId - 文档ID
   * @param slides - 要生成的slides数组
   */
  const generateThumbnailsAsync = async (documentId: string, slides: any[]) => {
    if (!slides || slides.length === 0) {
      console.log('[useEditorSave] 没有需要生成的缩略图')
      return
    }

    try {
      generatingThumbnails.value = true
      thumbnailProgress.value = { current: 0, total: slides.length }

      const slideIds = slides.map(s => s.id)
      console.log(`[useEditorSave] 启动缩略图生成任务: ${slideIds.length} 个slides`)

      await createTask(documentId, slideIds)

      console.log('[useEditorSave] 缩略图生成任务已创建')
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
              console.log('[useEditorSave] 已有缩略图生成任务在进行中，跳过保存时的封面生成')
            } else {
              const modeName = mode === 'template' ? '模板' : '文档'
              const reason = noThumbnail ? '无缩略图' : firstSlideChanged ? '检测到变更' : '有未保存变更'
              console.log(`[useEditorSave] 手动保存${modeName}，生成第一页缩略图作为封面 (原因: ${reason})`)
              // 异步生成，不阻塞保存流程
              generateThumbnailsAsync(id, [firstSlide])
            }
          } else {
            console.log('[useEditorSave] 第一页未变更且已有缩略图，跳过封面生成')
          }
        }
      }
      
      // 保存成功后，清空变更记录
      clearChangedSlides()
      
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

  // 监听 slides 变化，自动标记为有变更
  watch(
    () => slidesStore.slides,
    () => {
      markAsChanged()
    },
    { deep: true }
  )

  // 清理
  onUnmounted(() => {
    stopAutoSave()
    stopTracking()
  })

  /**
   * 生成预览图（用于发布时调用）
   * 只生成内容变更页面和缺少缩略图的页面
   *
   * 策略：
   * 1. 重新检测变更（因为保存操作会清空变更记录）
   * 2. 生成缺少缩略图的页面
   * 3. 合并去重后生成
   */
  const generateThumbnailsForPublish = async () => {
    const mode = editMode.value
    const id = currentId.value

    if (mode !== 'document' || !id) {
      console.warn('[useEditorSave] 只有文档模式才能生成预览图')
      return
    }

    console.log('[useEditorSave] 开始检测需要生成预览图的幻灯片...')

    // ⚠️ 重要：发布前重新检测变更
    // 因为保存操作会清空变更记录，所以这里需要重新对比快照
    console.log('[useEditorSave] 步骤1: 重新检测内容变更...')
    detectChanges()

    // 获取检测到的变更幻灯片
    const changedSlides = getChangedSlides()
    console.log(`[useEditorSave] 检测到 ${changedSlides.length} 个内容变更的幻灯片`)
    if (changedSlides.length > 0) {
      console.log(`  变更的幻灯片 ID: [${changedSlides.map(s => s.id).join(', ')}]`)
    }

    // 获取所有没有缩略图的幻灯片
    console.log('[useEditorSave] 步骤2: 检测缺少缩略图的幻灯片...')
    const slidesWithoutThumbnail = slidesStore.slides.filter(slide => !slide.thumbnail)
    console.log(`[useEditorSave] 检测到 ${slidesWithoutThumbnail.length} 个缺少缩略图的幻灯片`)
    if (slidesWithoutThumbnail.length > 0) {
      console.log(`  缺少缩略图的幻灯片 ID: [${slidesWithoutThumbnail.map(s => s.id).join(', ')}]`)
    }

    // 合并两个列表（去重）
    const slidesToGenerate = new Map<string, any>()
    changedSlides.forEach(slide => slidesToGenerate.set(slide.id, slide))
    slidesWithoutThumbnail.forEach(slide => slidesToGenerate.set(slide.id, slide))

    const finalSlides = Array.from(slidesToGenerate.values())

    if (finalSlides.length > 0) {
      console.log(`[useEditorSave] ✅ 最终需要生成 ${finalSlides.length} 个幻灯片的预览图`)
      console.log(`  最终列表: [${finalSlides.map(s => s.id).join(', ')}]`)

      // 异步生成预览图，不阻塞发布流程
      await generateThumbnailsAsync(id, finalSlides)

      // 生成完成后，更新快照并清空变更记录
      createSnapshot()
      clearChangedSlides()

      console.log('[useEditorSave] 预览图生成任务已创建，快照已更新')
    } else {
      console.log('[useEditorSave] ✅ 所有幻灯片都有预览图且无变更，跳过预览图生成')
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