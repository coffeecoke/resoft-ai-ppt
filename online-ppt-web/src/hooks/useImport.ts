import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { decrypt } from '@/utils/crypto'
import { unzipSync, strFromU8 } from 'fflate'
import { parsePPTXToSlides } from '@/utils/pptxParser'
import useAddSlidesOrElements from '@/hooks/useAddSlidesOrElements'
import useSlideHandler from '@/hooks/useSlideHandler'
import useHistorySnapshot from './useHistorySnapshot'
import message from '@/utils/message'
import type { Slide } from '@/types/slides'

export default () => {
  const slidesStore = useSlidesStore()
  const { theme } = storeToRefs(useSlidesStore())

  const { addHistorySnapshot } = useHistorySnapshot()
  const { addSlidesFromData } = useAddSlidesOrElements()
  const { isEmptySlide } = useSlideHandler()

  const exporting = ref(false)

  // 导入JSON文件
  const importJSON = (files: FileList | File[], cover = false) => {
    const file = files[0]

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      try {
        let { slides } = JSON.parse(reader.result as string)
        // 清除旧缩略图引用，避免发布时误判"已有缩略图"而跳过生成
        slides = slides.map(({ thumbnail: _t, thumbnailUpdatedAt: _ta, ...rest }: any) => rest as Slide)
        if (cover) {
          slidesStore.updateSlideIndex(0)
          slidesStore.setSlides(slides)
          addHistorySnapshot()
        }
        else if (isEmptySlide.value) {
          slidesStore.setSlides(slides)
          addHistorySnapshot()
        }
        else addSlidesFromData(slides)
      }
      catch {
        message.error('无法正确读取 / 解析该文件')
      }
    })
    reader.readAsText(file)
  }

  // 将 pptist://images/xxx 引用还原为 base64 data URL
  const resolveImageRef = (ref: string, unzipped: Record<string, Uint8Array>): string => {
    if (!ref.startsWith('pptist://')) return ref
    const path = ref.replace('pptist://', '')
    const bytes = unzipped[path]
    // ZIP 中找不到对应文件时返回空字符串，避免把 pptist:// 协议头写入 src（浏览器无法渲染）
    if (!bytes) return ''
    const ext = path.split('.').pop() || 'png'
    const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
    // 分块处理避免大图片时 btoa 崩溃（逐字符拼接会产生大量中间字符串）
    const chunkSize = 8192
    let binary = ''
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }
    return `data:${mime};base64,${btoa(binary)}`
  }

  // 还原 slides 中所有图片引用为 base64
  const restoreImages = (slides: Slide[], unzipped: Record<string, Uint8Array>): Slide[] => {
    return slides.map(slide => {
      if (slide.background?.type === 'image' && slide.background.image?.src) {
        slide.background.image.src = resolveImageRef(slide.background.image.src, unzipped)
      }
      if (slide.elements) {
        for (const el of slide.elements) {
          if (el.type === 'image' && el.src) (el as any).src = resolveImageRef(el.src, unzipped)
          if ((el as any).pattern) (el as any).pattern = resolveImageRef((el as any).pattern, unzipped)
          if (el.type === 'video' && (el as any).poster) (el as any).poster = resolveImageRef((el as any).poster, unzipped)
        }
      }
      return slide
    })
  }

  // 导入pptist文件
  const importSpecificFile = (files: FileList | File[], cover = false) => {
    const file = files[0]

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      try {
        const buffer = reader.result as ArrayBuffer
        const bytes = new Uint8Array(buffer)

        // 格式检测：ZIP 文件前2字节为 PK（0x50 0x4B）
        const isNewFormat = bytes[0] === 0x50 && bytes[1] === 0x4B

        let slides: Slide[]

        if (isNewFormat) {
          // 新格式：ZIP 包，解包后还原图片引用
          const unzipped = unzipSync(bytes)
          const manifest = JSON.parse(strFromU8(unzipped['manifest.json']))
          slides = restoreImages(manifest.slides, unzipped)
        }
        else {
          // 旧格式：AES 加密文本（向后兼容）
          const text = new TextDecoder().decode(bytes)
          slides = JSON.parse(decrypt(text)).slides
        }

        // 清除旧缩略图引用，避免发布时误判"已有缩略图"而跳过生成
        slides = slides.map(({ thumbnail: _t, thumbnailUpdatedAt: _ta, ...rest }: any) => rest as Slide)

        if (cover) {
          slidesStore.updateSlideIndex(0)
          slidesStore.setSlides(slides)
          addHistorySnapshot()
        }
        else if (isEmptySlide.value) {
          slidesStore.setSlides(slides)
          addHistorySnapshot()
        }
        else addSlidesFromData(slides)
      }
      catch {
        message.error('无法正确读取 / 解析该文件')
      }
    })
    reader.readAsArrayBuffer(file)
  }

  // 导入PPTX文件
  const importPPTXFile = async (files: FileList | File[], options?: { cover?: boolean; fixedViewport?: boolean }) => {
    const defaultOptions = {
      cover: false,
      fixedViewport: false, 
    }
    const { cover, fixedViewport } = { ...defaultOptions, ...options }

    const file = files[0]
    if (!file) return

    exporting.value = true

    try {
      // 调用独立的解析函数
      const { slides, theme: parsedTheme, viewportSize } = await parsePPTXToSlides(file, {
        fixedViewport,
        defaultTheme: {
          fontName: theme.value.fontName,
          fontColor: theme.value.fontColor,
          themeColors: theme.value.themeColors,
        }
      })

      // 应用到编辑器store（原有逻辑）
      if (viewportSize) slidesStore.setViewportSize(viewportSize)
      slidesStore.setTheme(parsedTheme)
      
      // 🆕 设置文档标题（从文件名提取，去除.pptx后缀）
      const fileName = file.name.replace(/\.pptx$/i, '')
      slidesStore.setTitle(fileName)

      // 应用到编辑器（根据不同的cover选项）
      if (cover) {
        slidesStore.updateSlideIndex(0)
        slidesStore.setSlides(slides)
        addHistorySnapshot()
      }
      else if (isEmptySlide.value) {
        slidesStore.setSlides(slides)
        addHistorySnapshot()
      }
      else {
        addSlidesFromData(slides)
      }
    } catch (error) {
      console.error('[导入PPTX] 解析失败:', error)
      message.error('无法正确读取 / 解析该文件')
    } finally {
      exporting.value = false
    }
  }

  return {
    importSpecificFile,
    importJSON,
    importPPTXFile,
    exporting,
  }
}