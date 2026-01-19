import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'

/**
 * 幻灯片变更追踪 Hook
 * 用于追踪哪些幻灯片被修改过，以便在保存时只生成修改过的幻灯片的预览图
 */
export default () => {
  const slidesStore = useSlidesStore()
  const { slides } = storeToRefs(slidesStore)

  // 存储变更的幻灯片 ID
  const changedSlideIds = ref<Set<string>>(new Set())

  // 上次快照（用于对比变更）
  const lastSnapshot = ref<Map<string, string>>(new Map())

  /**
   * 标记幻灯片为已修改
   */
  const markSlideChanged = (slideId: string) => {
    changedSlideIds.value.add(slideId)
  }

  /**
   * 标记多个幻灯片为已修改
   */
  const markSlidesChanged = (slideIds: string[]) => {
    slideIds.forEach(id => changedSlideIds.value.add(id))
  }

  /**
   * 获取所有变更的幻灯片 ID
   */
  const getChangedSlideIds = (): string[] => {
    return Array.from(changedSlideIds.value)
  }

  /**
   * 获取所有变更的幻灯片对象
   */
  const getChangedSlides = (): Slide[] => {
    const changedIds = getChangedSlideIds()
    return slides.value.filter(slide => changedIds.includes(slide.id))
  }

  /**
   * 清空变更记录
   */
  const clearChangedSlides = () => {
    changedSlideIds.value.clear()
  }

  /**
   * 检查幻灯片是否被修改
   */
  const isSlideChanged = (slideId: string): boolean => {
    return changedSlideIds.value.has(slideId)
  }

  /**
   * 创建幻灯片快照（用于对比）
   */
  const createSnapshot = () => {
    const snapshot = new Map<string, string>()
    slides.value.forEach(slide => {
      // 将幻灯片序列化为字符串，用于对比
      snapshot.set(slide.id, JSON.stringify(slide.elements))
    })
    lastSnapshot.value = snapshot
  }

  /**
   * 对比并标记变更的幻灯片
   */
  const detectChanges = () => {
    slides.value.forEach(slide => {
      const currentContent = JSON.stringify(slide.elements)
      const lastContent = lastSnapshot.value.get(slide.id)
      
      if (lastContent && lastContent !== currentContent) {
        markSlideChanged(slide.id)
      }
    })
  }

  /**
   * 检查并标记没有预览图的幻灯片
   */
  const markSlidesWithoutThumbnail = () => {
    let count = 0
    slides.value.forEach(slide => {
      // 如果幻灯片没有 thumbnail 字段，标记为需要生成
      if (!slide.thumbnail) {
        markSlideChanged(slide.id)
        count++
      }
    })
    if (count > 0) {
      console.log(`[变更追踪] 标记了 ${count} 个没有缩略图的幻灯片`)
    }
  }

  /**
   * 监听幻灯片变化
   * 当幻灯片数组发生变化时，自动标记变更
   */
  const startTracking = (checkMissingThumbnails = true) => {
    let hasCheckedMissing = false

    // 监听幻灯片变化
    watch(
      () => slides.value,
      (newSlides, oldSlides) => {
        console.log(`[变更追踪] watch 触发 - 新:${newSlides.length}个, 旧:${oldSlides?.length || 0}个`)

        // 首次加载数据时（从空数组变为有数据）
        if ((!oldSlides || oldSlides.length === 0) && newSlides.length > 0) {
          console.log(`[变更追踪] 首次加载 ${newSlides.length} 个幻灯片`)
          // 检查缺失的预览图（只检查一次）
          if (checkMissingThumbnails && !hasCheckedMissing) {
            markSlidesWithoutThumbnail()
            hasCheckedMissing = true
            console.log(`[变更追踪] 当前变更列表:`, Array.from(changedSlideIds.value))
          }
          createSnapshot()
          return
        }

        // 如果已经有数据，正常处理变更
        if (oldSlides && oldSlides.length > 0) {
          // 使用快照中的 ID 集合（代表上次保存时的状态）
          const snapshotIds = new Set(lastSnapshot.value.keys())
          const newSlideIds: string[] = []

          newSlides.forEach(slide => {
            if (!snapshotIds.has(slide.id)) {
              // 新增的幻灯片（新建或复制）- 快照中没有这个 ID
              markSlideChanged(slide.id)
              newSlideIds.push(slide.id)
              console.log(`[变更追踪] 检测到新增幻灯片: ${slide.id}`)
            } else {
              // 使用快照对比内容变更（对比"上次保存"和"当前内容"）
              const currentContent = JSON.stringify(slide.elements)
              const snapshotContent = lastSnapshot.value.get(slide.id)

              if (snapshotContent && snapshotContent !== currentContent) {
                markSlideChanged(slide.id)
                console.log(`[变更追踪] 检测到内容变更: ${slide.id}`)
              }
            }
          })

          if (newSlideIds.length > 0) {
            console.log(`[变更追踪] 共新增 ${newSlideIds.length} 个幻灯片，当前变更列表:`, Array.from(changedSlideIds.value))
          }

          // ⚠️ 不再自动更新快照
          // 快照只在保存时手动更新，这样可以用于对比"上次保存"和"当前内容"
        }
      },
      { deep: true, immediate: true }
    )
  }

  /**
   * 停止追踪
   */
  const stopTracking = () => {
    clearChangedSlides()
    lastSnapshot.value.clear()
  }

  /**
   * 重置追踪器（清空变更记录并重新创建快照）
   */
  const resetTracker = () => {
    clearChangedSlides()
    createSnapshot()
  }

  return {
    changedSlideIds,
    markSlideChanged,
    markSlidesChanged,
    getChangedSlideIds,
    getChangedSlides,
    clearChangedSlides,
    isSlideChanged,
    startTracking,
    stopTracking,
    resetTracker,
    createSnapshot,
    detectChanges,
    markSlidesWithoutThumbnail,
  }
}

