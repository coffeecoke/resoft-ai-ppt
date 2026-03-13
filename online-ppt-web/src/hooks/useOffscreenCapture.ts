/**
 * 离屏截图工具
 *
 * 将 slide 数据渲染到屏幕外的隐藏容器，截图后立即销毁，不常驻 DOM。
 * 使用场景：
 * - 模板发布时为带 type 标注的页面批量截图
 * - 任何需要截图但不依赖左侧缩略图列表 DOM 的场景
 */
import { createApp, defineComponent, h } from 'vue'
import { createPinia } from 'pinia'
import { toJpeg } from 'html-to-image'
import { useSlidesStore } from '@/store'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import type { Slide } from '@/types/slides'

interface CaptureOptions {
  quality?: number
  width?: number
}

/**
 * 对单个 slide 离屏截图，返回 base64 dataUrl
 * 优先复用已在 DOM 中的元素；找不到时创建离屏容器
 */
export async function captureSlideToJpeg(
  slide: Slide,
  viewportRatio: number,
  viewportSize: number,
  theme: any,
  opts: CaptureOptions = {}
): Promise<string> {
  const { quality = 0.8, width = 800 } = opts
  const height = Math.round(width * viewportRatio)

  // 优先复用已有 DOM 元素
  const existing = document.querySelector(`[data-slide-id="${slide.id}"]`) as HTMLElement | null
  if (existing) {
    return toJpeg(existing, { quality, canvasWidth: width, canvasHeight: height, fontEmbedCSS: '', pixelRatio: 1 })
  }

  // 离屏渲染
  const container = document.createElement('div')
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${viewportSize}px;
    height: ${Math.round(viewportSize * viewportRatio)}px;
    overflow: hidden;
    pointer-events: none;
    z-index: -1;
  `
  document.body.appendChild(container)

  const pinia = createPinia()
  const OffscreenComp = defineComponent({
    setup() {
      return () => h(ThumbnailSlide, { slide, size: viewportSize, visible: true })
    }
  })

  const app = createApp(OffscreenComp)
  app.use(pinia)

  // 同步主 store 数据给离屏实例
  const offscreenStore = useSlidesStore(pinia)
  offscreenStore.$patch({ viewportRatio, viewportSize, theme })

  app.mount(container)

  try {
    await new Promise(resolve => requestAnimationFrame(resolve))
    const el = (container.querySelector('[data-slide-id]') as HTMLElement) || container
    return await toJpeg(el, { quality, canvasWidth: width, canvasHeight: height, fontEmbedCSS: '', pixelRatio: 1 })
  } finally {
    app.unmount()
    if (container.parentNode) container.parentNode.removeChild(container)
  }
}
