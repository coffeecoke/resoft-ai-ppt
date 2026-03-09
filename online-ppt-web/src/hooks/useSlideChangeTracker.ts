import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { throttle } from 'lodash'
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
    if (import.meta.env.DEV && count > 0) {
      console.log(`[变更追踪] 标记了 ${count} 个没有缩略图的幻灯片`)
    }
  }

  // 用于在 stopTracking 时停止 watch 与节流，避免内存泄漏
  let stopWatch: (() => void) | null = null
  let throttledRunTrack: ReturnType<typeof throttle<(...args: any[]) => void>> | null = null

  /**
   * 监听幻灯片变化
   * 当幻灯片数组发生变化时，自动标记变更（节流回调以减轻内存与 CPU 压力）
   */
  const startTracking = (checkMissingThumbnails = true) => {
    let hasCheckedMissing = false
    // 先停止之前的 watch（若存在），避免重复注册
    if (stopWatch) {
      stopWatch()
      stopWatch = null
    }
    if (throttledRunTrack) {
      throttledRunTrack.cancel()
      throttledRunTrack = null
    }

    throttledRunTrack = throttle((newSlides: Slide[], oldSlides: Slide[] | undefined) => {
      // 首次加载数据时（从空数组变为有数据）
      if ((!oldSlides || oldSlides.length === 0) && newSlides.length > 0) {
        if (checkMissingThumbnails && !hasCheckedMissing) {
          markSlidesWithoutThumbnail()
          hasCheckedMissing = true
        }
        createSnapshot()
        return
      }

      if (oldSlides && oldSlides.length > 0) {
        const snapshotIds = new Set(lastSnapshot.value.keys())
        const newSlideIds: string[] = []

        newSlides.forEach(slide => {
          if (!snapshotIds.has(slide.id)) {
            markSlideChanged(slide.id)
            newSlideIds.push(slide.id)
          } else {
            const currentContent = JSON.stringify(slide.elements)
            const snapshotContent = lastSnapshot.value.get(slide.id)
            if (snapshotContent && snapshotContent !== currentContent) {
              markSlideChanged(slide.id)
            }
          }
        })
      }
    }, 1500, { leading: true, trailing: true })

    stopWatch = watch(
      () => slides.value,
      (newSlides, oldSlides) => {
        throttledRunTrack?.(newSlides, oldSlides)
      },
      { deep: true, immediate: true }
    )
  }

  /**
   * 停止追踪（停止 watch 并清空状态，避免内存泄漏）
   */
  const stopTracking = () => {
    if (stopWatch) {
      stopWatch()
      stopWatch = null
    }
    if (throttledRunTrack) {
      throttledRunTrack.cancel()
      throttledRunTrack = null
    }
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

