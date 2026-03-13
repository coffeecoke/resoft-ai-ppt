/**
 * 幻灯片缩略图懒加载 Hook
 *
 * 策略：IntersectionObserver
 * - 每个缩略图项挂载后，通过 observe() 监听是否进入视口
 * - 进入视口时将其 index 加入 visibleSet，触发 ThumbnailSlide 渲染
 * - 离开视口时仍保留在 visibleSet（已渲染的不回收），避免重复渲染开销
 * - 这种方式 DOM 节点始终全量存在（支持拖拽排序），只是内容按需渲染
 */
import { ref, onUnmounted } from 'vue'

const INITIAL_LOAD = 12 // 初始直接渲染前 N 个，保证首屏无闪烁
const ROOT_MARGIN = '200px' // 提前 200px 预加载，滑动更流畅

export default () => {
  // 已渲染的 index 集合（只增不减）
  const visibleSet = ref<Set<number>>(new Set())

  // 初始化：前 INITIAL_LOAD 个直接标为可见
  for (let i = 0; i < INITIAL_LOAD; i++) visibleSet.value.add(i)

  let observer: IntersectionObserver | null = null

  /**
   * 判断某个 index 是否应该渲染
   */
  const isVisible = (index: number) => visibleSet.value.has(index)

  /**
   * 注册一个缩略图 DOM 节点，开始监听它是否进入视口
   * 在 Thumbnails/index.vue 的 @vue:mounted 或 :ref 回调里调用
   */
  const observe = (el: HTMLElement, index: number) => {
    if (!el) return
    // 已渲染的不重复注册
    if (visibleSet.value.has(index)) return

    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = Number((entry.target as HTMLElement).dataset.thumbIndex)
              if (!isNaN(idx)) {
                visibleSet.value = new Set([...visibleSet.value, idx])
              }
              // 进入视口后不再需要监听
              observer?.unobserve(entry.target)
            }
          })
        },
        { rootMargin: ROOT_MARGIN }
      )
    }

    el.dataset.thumbIndex = String(index)
    observer.observe(el)
  }

  /**
   * 取消监听某个节点（slide 删除时调用，避免内存泄漏）
   */
  const unobserve = (el: HTMLElement) => {
    if (observer && el) observer.unobserve(el)
  }

  onUnmounted(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return {
    isVisible,
    observe,
    unobserve,
  }
}
