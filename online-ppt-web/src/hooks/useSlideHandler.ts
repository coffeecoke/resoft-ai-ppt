import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { nanoid } from 'nanoid'
import { useMainStore, useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'
import { copyText, readClipboard } from '@/utils/clipboard'
import { encrypt } from '@/utils/crypto'
import { createElementIdMap } from '@/utils/element'
import { KEYS } from '@/configs/hotkey'
import message from '@/utils/message'
import usePasteTextClipboardData from '@/hooks/usePasteTextClipboardData'
import useHistorySnapshot from '@/hooks/useHistorySnapshot'
import useAddSlidesOrElements from '@/hooks/useAddSlidesOrElements'
import { deleteThumbnailsBatch } from '@/services/thumbnailService'
import { useRoute } from 'vue-router'
import { insertDocumentSlide, deleteDocumentSlides } from '@/services/documentService'

export default () => {
  const route = useRoute()
  const mainStore = useMainStore()
  const slidesStore = useSlidesStore()
  const { selectedSlidesIndex: _selectedSlidesIndex, activeElementIdList } = storeToRefs(mainStore)
  const { currentSlide, slides, theme, slideIndex } = storeToRefs(slidesStore)

  const selectedSlidesIndex = computed(() => [..._selectedSlidesIndex.value, slideIndex.value])
  const selectedSlides = computed(() => slides.value.filter((item, index) => selectedSlidesIndex.value.includes(index)))
  const selectedSlidesId = computed(() => selectedSlides.value.map(item => item.id))

  const { pasteTextClipboardData } = usePasteTextClipboardData()
  const { addSlidesFromData } = useAddSlidesOrElements()
  const { addHistorySnapshot } = useHistorySnapshot()

  // 重置幻灯片
  const resetSlides = () => {
    const emptySlide: Slide = {
      id: nanoid(10),
      elements: [],
      background: {
        type: 'solid',
        color: theme.value.backgroundColor,
      },
    }
    slidesStore.updateSlideIndex(0)
    mainStore.setActiveElementIdList([])
    slidesStore.setSlides([emptySlide])
  }

  /**
   * 移动页面焦点
   * @param command 移动页面焦点命令：上移、下移
   */
  const updateSlideIndex = (command: string) => {
    if (command === KEYS.UP && slideIndex.value > 0) {
      if (activeElementIdList.value.length) mainStore.setActiveElementIdList([])
      slidesStore.updateSlideIndex(slideIndex.value - 1)
    }
    else if (command === KEYS.DOWN && slideIndex.value < slides.value.length - 1) {
      if (activeElementIdList.value.length) mainStore.setActiveElementIdList([])
      slidesStore.updateSlideIndex(slideIndex.value + 1)
    }
  }

  // 将当前页面数据加密后复制到剪贴板
  const copySlide = () => {
    const text = encrypt(JSON.stringify({
      type: 'slides',
      data: selectedSlides.value,
    }))

    copyText(text).then(() => {
      mainStore.setThumbnailsFocus(true)
    })
  }

  // 尝试将剪贴板页面数据解密后添加到下一页（粘贴）
  const pasteSlide = () => {
    readClipboard().then(text => {
      pasteTextClipboardData(text, { onlySlide: true })
    }).catch(err => message.warning(err))
  }

  // 创建一页空白页并添加到下一页
  // 获取当前文档 ID（仅 document 模式有值）
  const documentId = computed(() => route.query.documentId as string | undefined)

  // 插入页面后立即持久化到后端
  const persistInsert = (slide: Slide, index: number) => {
    const docId = documentId.value
    if (!docId) return
    insertDocumentSlide(docId, slide, index).catch(err => {
      console.warn('[useSlideHandler] 插入页面持久化失败:', err)
    })
  }

  const createSlide = () => {
    const emptySlide: Slide = {
      id: nanoid(10),
      elements: [],
      background: {
        type: 'solid',
        color: theme.value.backgroundColor,
      },
    }
    mainStore.setActiveElementIdList([])
    slidesStore.addSlide(emptySlide)
    addHistorySnapshot()
    // 立即持久化：新页插在 slideIndex+1
    persistInsert(emptySlide, slidesStore.slideIndex)
  }

  // 根据模板创建新页面
  const createSlideByTemplate = (slide: Slide) => {
    const { groupIdMap, elIdMap } = createElementIdMap(slide.elements)

    for (const element of slide.elements) {
      element.id = elIdMap[element.id]
      if (element.groupId) element.groupId = groupIdMap[element.groupId]
    }
    const newSlide = {
      ...slide,
      id: nanoid(10),
    }
    mainStore.setActiveElementIdList([])
    slidesStore.addSlide(newSlide)
    addHistorySnapshot()
    persistInsert(newSlide, slidesStore.slideIndex)
  }

  // 将当前页复制一份到下一页
  const copyAndPasteSlide = () => {
    const slide = JSON.parse(JSON.stringify(currentSlide.value))
    addSlidesFromData([slide])
    // addSlidesFromData 内部会重新生成 id，取最新插入的页面做持久化
    const newSlide = slidesStore.slides[slidesStore.slideIndex]
    persistInsert(newSlide, slidesStore.slideIndex)
  }

  // 删除当前页，若将删除全部页面，则执行重置幻灯片操作
  const deleteSlide = async (targetSlidesId = selectedSlidesId.value) => {
    const docId = documentId.value

    // 删除幻灯片缩略图（异步，不阻塞）
    if (docId && targetSlidesId.length > 0) {
      deleteThumbnailsBatch(docId, targetSlidesId).catch(err => {
        console.warn('[删除幻灯片] 删除缩略图异常:', err)
      })
      // 立即持久化删除页面
      deleteDocumentSlides(docId, targetSlidesId).catch(err => {
        console.warn('[useSlideHandler] 删除页面持久化失败:', err)
      })
    }

    if (slides.value.length === targetSlidesId.length) resetSlides()
    else slidesStore.deleteSlide(targetSlidesId)

    mainStore.updateSelectedSlidesIndex([])
    addHistorySnapshot()
  }

  // 将当前页复制后删除（剪切）
  // 由于复制操作会导致多选状态消失，所以需要提前将需要删除的页面ID进行缓存
  const cutSlide = () => {
    const targetSlidesId = [...selectedSlidesId.value]
    copySlide()
    deleteSlide(targetSlidesId)
  }

  // 选中全部幻灯片
  const selectAllSlide = () => {
    const newSelectedSlidesIndex = Array.from(Array(slides.value.length), (item, index) => index)
    mainStore.setActiveElementIdList([])
    mainStore.updateSelectedSlidesIndex(newSelectedSlidesIndex)
  }

  // 拖拽调整幻灯片顺序同步数据
  const sortSlides = (newIndex: number, oldIndex: number) => {
    if (oldIndex === newIndex) return
  
    const _slides: Slide[] = JSON.parse(JSON.stringify(slides.value))

    const movingSlide = _slides[oldIndex]
    const movingSlideSection = movingSlide.sectionTag
    if (movingSlideSection) {
      const movingSlideSectionNext = _slides[oldIndex + 1]
      delete movingSlide.sectionTag
      if (movingSlideSectionNext && !movingSlideSectionNext.sectionTag) {
        movingSlideSectionNext.sectionTag = movingSlideSection
      }
    }
    if (newIndex === 0) {
      const firstSection = _slides[0].sectionTag
      if (firstSection) {
        delete _slides[0].sectionTag
        movingSlide.sectionTag = firstSection
      }
    }

    const _slide = _slides[oldIndex]
    _slides.splice(oldIndex, 1)
    _slides.splice(newIndex, 0, _slide)
    slidesStore.setSlides(_slides)
    slidesStore.updateSlideIndex(newIndex)
  }

  const isEmptySlide = computed(() => {
    if (slides.value.length > 1) return false
    if (slides.value[0].elements.length > 0) return false
    return true
  })

  return {
    resetSlides,
    updateSlideIndex,
    copySlide,
    pasteSlide,
    createSlide,
    createSlideByTemplate,
    copyAndPasteSlide,
    deleteSlide,
    cutSlide,
    selectAllSlide,
    sortSlides,
    isEmptySlide,
  }
}