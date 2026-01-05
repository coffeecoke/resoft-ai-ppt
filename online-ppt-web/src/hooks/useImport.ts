import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'
import { decrypt } from '@/utils/crypto'
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
        const { slides } = JSON.parse(reader.result as string)
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

  // 导入pptist文件
  const importSpecificFile = (files: FileList | File[], cover = false) => {
    const file = files[0]

    const reader = new FileReader()
    reader.addEventListener('load', () => {
      try {
        const { slides } = JSON.parse(decrypt(reader.result as string))
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