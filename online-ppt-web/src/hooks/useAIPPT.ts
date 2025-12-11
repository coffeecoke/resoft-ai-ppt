import { ref } from 'vue'
import { nanoid } from 'nanoid'
import type { ImageClipDataRange, PPTElement, PPTImageElement, PPTShapeElement, PPTTextElement, Slide, TextType } from '@/types/slides'
import type { AIPPTSlide } from '@/types/AIPPT'
import { useSlidesStore } from '@/store'
import useAddSlidesOrElements from './useAddSlidesOrElements'
import useSlideHandler from './useSlideHandler'

interface ImgPoolItem {
  id: string
  src: string
  width: number
  height: number
}

export default () => {
  const slidesStore = useSlidesStore()
  const { addSlidesFromData } = useAddSlidesOrElements()
  const { isEmptySlide } = useSlideHandler()

  const imgPool = ref<ImgPoolItem[]>([])
  const transitionIndex = ref(0)
  const transitionTemplate = ref<Slide | null>(null)

  const checkTextType = (el: PPTElement, type: TextType) => {
    return (el.type === 'text' && el.textType === type) || (el.type === 'shape' && el.text && el.text.type === type)
  }
  
  const getUseableTemplates = (templates: Slide[], n: number, type: TextType) => {
    if (n === 1) {
      const list = templates.filter(slide => {
        const items = slide.elements.filter(el => checkTextType(el, type))
        const titles = slide.elements.filter(el => checkTextType(el, 'title'))
        const texts = slide.elements.filter(el => checkTextType(el, 'content'))
  
        return !items.length && titles.length === 1 && texts.length === 1
      })
  
      if (list.length) return list
    }
  
    let target: Slide | null = null
  
    const list = templates.filter(slide => {
      const len = slide.elements.filter(el => checkTextType(el, type)).length
      return len >= n
    })
    if (list.length === 0) {
      const sorted = templates.sort((a, b) => {
        const aLen = a.elements.filter(el => checkTextType(el, type)).length
        const bLen = b.elements.filter(el => checkTextType(el, type)).length
        return aLen - bLen
      })
      target = sorted[sorted.length - 1]
    }
    else {
      target = list.reduce((closest, current) => {
        const currentLen = current.elements.filter(el => checkTextType(el, type)).length
        const closestLen = closest.elements.filter(el => checkTextType(el, type)).length
        return (currentLen - n) <= (closestLen - n) ? current : closest
      })
    }
  
    return templates.filter(slide => {
      const len = slide.elements.filter(el => checkTextType(el, type)).length
      const targetLen = target!.elements.filter(el => checkTextType(el, type)).length
      return len === targetLen
    })
  }
  
  const getAdaptedFontsize = ({
    text,
    fontSize,
    fontFamily,
    width,
    height,
    lineHeight,
    maxLine,
  }: {
    text: string
    fontSize: number
    fontFamily: string
    width: number
    height: number
    lineHeight: number
    maxLine: number
  }) => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
  
    let newFontSize = fontSize
    const minFontSize = 10
  
    while (newFontSize >= minFontSize) {
      context.font = `${newFontSize}px ${fontFamily}`
      const textWidth = context.measureText(text).width
      const line = Math.ceil(textWidth / width)

      if (maxLine > 1 && height) {
        const heightOfLine = Math.max(newFontSize, 16) * (newFontSize < 15 ? 1.2 : lineHeight) * 1.2
        const totalHeight = line * heightOfLine
        if (totalHeight <= height) return newFontSize
      }
      if (line <= maxLine) return newFontSize

      const step = newFontSize <= 22 ? 1 : 2
      newFontSize = newFontSize - step
    }
  
    return minFontSize
  }
  
  const getFontInfo = (htmlString: string) => {
    const fontSizeRegex = /font-size:\s*(\d+(?:\.\d+)?)\s*px/i
    const fontFamilyRegex = /font-family:\s*['"]?([^'";]+)['"]?\s*(?=;|>|$)/i
  
    const defaultInfo = {
      fontSize: 16,
      fontFamily: 'Microsoft Yahei',
    }
  
    const fontSizeMatch = htmlString.match(fontSizeRegex)
    const fontFamilyMatch = htmlString.match(fontFamilyRegex)
  
    return {
      fontSize: fontSizeMatch ? (+fontSizeMatch[1].trim()) : defaultInfo.fontSize,
      fontFamily: fontFamilyMatch ? fontFamilyMatch[1].trim() : defaultInfo.fontFamily,
    }
  }
  
  const getNewTextElement = ({
    el,
    text,
    maxLine,
    longestText,
    digitPadding,
  }: {
    el: PPTTextElement | PPTShapeElement
    text: string
    maxLine: number
    longestText?: string
    digitPadding?: boolean
  }): PPTTextElement | PPTShapeElement => {
    const padding = 10
    const width = el.width - padding * 2 - 2
    const height = el.height - padding * 2 - 2
    const lineHeight = el.type === 'text' ? (el.lineHeight || 1.5) : 1.2
    let content = el.type === 'text' ? el.content : el.text!.content
  
    const fontInfo = getFontInfo(content)
    const size = getAdaptedFontsize({
      text: longestText || text,
      fontSize: fontInfo.fontSize,
      fontFamily: fontInfo.fontFamily,
      width,
      height,
      lineHeight,
      maxLine,
    })
  
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
  
    const treeWalker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
  
    const firstTextNode = treeWalker.nextNode()
    if (firstTextNode) {
      if (digitPadding && firstTextNode.textContent && firstTextNode.textContent.length === 2 && text.length === 1) {
        firstTextNode.textContent = '0' + text
      }
      else firstTextNode.textContent = text

      let node
      while ((node = treeWalker.nextNode())) {
        node.parentNode?.removeChild(node)
      }
    }
  
    if (doc.body.innerHTML.indexOf('font-size') === -1) {
      const p = doc.querySelector('p')
      if (p) p.style.fontSize = '16px'
    }
  
    content = doc.body.innerHTML.replace(/font-size:(.+?)px/g, `font-size: ${size}px`)
  
    return el.type === 'text' ? { ...el, content, lineHeight: size < 15 ? 1.2 : el.lineHeight } : { ...el, text: { ...el.text!, content } }
  }

  const getUseableImage = (el: PPTImageElement): ImgPoolItem | null => {
    let img: ImgPoolItem | null = null
  
    let imgs = []
  
    if (el.width === el.height) imgs = imgPool.value.filter(img => img.width === img.height)
    else if (el.width > el.height) imgs = imgPool.value.filter(img => img.width > img.height)
    else imgs = imgPool.value.filter(img => img.width <= img.height)
    if (!imgs.length) imgs = imgPool.value
  
    img = imgs[Math.floor(Math.random() * imgs.length)]
    imgPool.value = imgPool.value.filter(item => item.id !== img!.id)
  
    return img
  }
  
  const getNewImgElement = (el: PPTImageElement): PPTImageElement => {
    const img = getUseableImage(el)
    if (!img) return el
  
    let scale = 1
    let w = el.width
    let h = el.height
    let range: ImageClipDataRange = [[0, 0], [0, 0]]
    const radio = el.width / el.height
    if (img.width / img.height >= radio) {
      scale = img.height / el.height
      w = img.width / scale
      const diff = (w - el.width) / 2 / w * 100
      range = [[diff, 0], [100 - diff, 100]]
    }
    else {
      scale = img.width / el.width
      h = img.height / scale
      const diff = (h - el.height) / 2 / h * 100
      range = [[0, diff], [100, 100 - diff]]
    }
    const clipShape = (el.clip && el.clip.shape) ? el.clip.shape : 'rect'
    const clip = { range, shape: clipShape }
    const src = img.src
  
    return { ...el, src, clip }
  }
  
  const getMdContent = (content: string) => {
    const regex = /```markdown([^```]*)```/
    const match = content.match(regex)
    if (match) return match[1].trim()
    return content.replace('```markdown', '').replace('```', '')
  }
  
  const getJSONContent = (content: string) => {
    const regex = /```json([^```]*)```/
    const match = content.match(regex)
    if (match) return match[1].trim()
    return content.replace('```json', '').replace('```', '')
  }

  const presetImgPool = (imgs: ImgPoolItem[]) => {
    imgPool.value = imgs
  }

  const AIPPT = (templateSlides: Slide[], _AISlides: AIPPTSlide[], imgs?: ImgPoolItem[]) => {
    slidesStore.updateSlideIndex(slidesStore.slides.length - 1)

    if (imgs) imgPool.value = imgs

    const AISlides: AIPPTSlide[] = []
    for (const template of _AISlides) {
      if (template.type === 'content') {
        const items = template.data.items
        if (items.length === 5 || items.length === 6) {
          const items1 = items.slice(0, 3)
          const items2 = items.slice(3)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 3 })
        }
        else if (items.length === 7 || items.length === 8) {
          const items1 = items.slice(0, 4)
          const items2 = items.slice(4)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 4 })
        }
        else if (items.length === 9 || items.length === 10) {
          const items1 = items.slice(0, 3)
          const items2 = items.slice(3, 6)
          const items3 = items.slice(6)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 3 })
          AISlides.push({ ...template, data: { ...template.data, items: items3 }, offset: 6 })
        }
        else if (items.length > 10) {
          const items1 = items.slice(0, 4)
          const items2 = items.slice(4, 8)
          const items3 = items.slice(8)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 4 })
          AISlides.push({ ...template, data: { ...template.data, items: items3 }, offset: 8 })
        }
        else {
          AISlides.push(template)
        }
      }
      else if (template.type === 'contents') {
        const items = template.data.items
        if (items.length === 11) {
          const items1 = items.slice(0, 6)
          const items2 = items.slice(6)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 6 })
        }
        else if (items.length > 11) {
          const items1 = items.slice(0, 10)
          const items2 = items.slice(10)
          AISlides.push({ ...template, data: { ...template.data, items: items1 } })
          AISlides.push({ ...template, data: { ...template.data, items: items2 }, offset: 10 })
        }
        else {
          AISlides.push(template)
        }
      }
      else AISlides.push(template)
    }

    // 基础类型模板
    const coverTemplates = templateSlides.filter(slide => slide.type === 'cover')
    const contentsTemplates = templateSlides.filter(slide => slide.type === 'contents')
    const transitionTemplates = templateSlides.filter(slide => slide.type === 'transition')
    const contentTemplates = templateSlides.filter(slide => slide.type === 'content')
    const endTemplates = templateSlides.filter(slide => slide.type === 'end')
    
    // 扩展类型模板（方案A）- 如果没有专门模板则降级到 content
    const textImageTemplates = templateSlides.filter(slide => slide.type === 'text_image')
    const comparisonTemplates = templateSlides.filter(slide => slide.type === 'comparison')
    const timelineTemplates = templateSlides.filter(slide => slide.type === 'timeline')
    const statisticsTemplates = templateSlides.filter(slide => slide.type === 'statistics')
    const quoteTemplates = templateSlides.filter(slide => slide.type === 'quote')

    if (!transitionTemplate.value) {
      const _transitionTemplate = transitionTemplates[Math.floor(Math.random() * transitionTemplates.length)]
      transitionTemplate.value = _transitionTemplate
    }

    const slides = []
    
    for (const item of AISlides) {
      if (item.type === 'cover') {
        const coverTemplate = coverTemplates[Math.floor(Math.random() * coverTemplates.length)]
        const elements = coverTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          if (checkTextType(el, 'content') && item.data.text) {
            return getNewTextElement({ el, text: item.data.text, maxLine: 3 })
          }
          return el
        })
        slides.push({
          ...coverTemplate,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'contents') {
        const _contentsTemplates = getUseableTemplates(contentsTemplates, item.data.items.length, 'item')
        const contentsTemplate = _contentsTemplates[Math.floor(Math.random() * _contentsTemplates.length)]

        const sortedNumberItems = contentsTemplate.elements.filter(el => checkTextType(el, 'itemNumber'))
        const sortedNumberItemIds = sortedNumberItems.sort((a, b) => {
          if (sortedNumberItems.length > 6) {
            let aContent = ''
            let bContent = ''
            if (a.type === 'text') aContent = a.content
            if (a.type === 'shape') aContent = a.text!.content
            if (b.type === 'text') bContent = b.content
            if (b.type === 'shape') bContent = b.text!.content

            if (aContent && bContent) {
              const aIndex = parseInt(aContent)
              const bIndex = parseInt(bContent)

              return aIndex - bIndex
            }
          }
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedItems = contentsTemplate.elements.filter(el => checkTextType(el, 'item'))
        const sortedItemIds = sortedItems.sort((a, b) => {
          if (sortedItems.length > 6) {
            const aItemNumber = sortedNumberItems.find(item => item.groupId === a.groupId)
            const bItemNumber = sortedNumberItems.find(item => item.groupId === b.groupId)

            if (aItemNumber && bItemNumber) {
              let aContent = ''
              let bContent = ''
              if (aItemNumber.type === 'text') aContent = aItemNumber.content
              if (aItemNumber.type === 'shape') aContent = aItemNumber.text!.content
              if (bItemNumber.type === 'text') bContent = bItemNumber.content
              if (bItemNumber.type === 'shape') bContent = bItemNumber.text!.content
  
              if (aContent && bContent) {
                const aIndex = parseInt(aContent)
                const bIndex = parseInt(bContent)
  
                return aIndex - bIndex
              }
            }
          }

          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const longestText = item.data.items.reduce((longest, current) => current.length > longest.length ? current : longest, '')

        const unusedElIds: string[] = []
        const unusedGroupIds: string[] = []
        const elements = contentsTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'item')) {
            const index = sortedItemIds.findIndex(id => id === el.id)
            const itemTitle = item.data.items[index]
            if (itemTitle) return getNewTextElement({ el, text: itemTitle, maxLine: 1, longestText })

            unusedElIds.push(el.id)
            if (el.groupId) unusedGroupIds.push(el.groupId)
          }
          if (checkTextType(el, 'itemNumber')) {
            const index = sortedNumberItemIds.findIndex(id => id === el.id)
            const offset = item.offset || 0
            return getNewTextElement({ el, text: index + offset + 1 + '', maxLine: 1, digitPadding: true })
          }
          return el
        }).filter(el => !unusedElIds.includes(el.id) && !(el.groupId && unusedGroupIds.includes(el.groupId)))
        slides.push({
          ...contentsTemplate,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'transition') {
        transitionIndex.value = transitionIndex.value + 1
        const elements = transitionTemplate.value.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          if (checkTextType(el, 'content') && item.data.text) {
            return getNewTextElement({ el, text: item.data.text, maxLine: 3 })
          }
          if (checkTextType(el, 'partNumber')) {
            return getNewTextElement({ el, text: transitionIndex.value + '', maxLine: 1, digitPadding: true })
          }
          return el
        })
        slides.push({
          ...transitionTemplate.value,
          id: nanoid(10),
          elements,
        })
      }
      else if (item.type === 'content') {
        const _contentTemplates = getUseableTemplates(contentTemplates, item.data.items.length, 'item')
        const contentTemplate = _contentTemplates[Math.floor(Math.random() * _contentTemplates.length)]

        const sortedTitleItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'itemTitle')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedTextItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'item')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedNumberItemIds = contentTemplate.elements.filter(el => checkTextType(el, 'itemNumber')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const itemTitles = []
        const itemTexts = []

        for (const _item of item.data.items) {
          if (_item.title) itemTitles.push(_item.title)
          if (_item.text) itemTexts.push(_item.text)
        }
        const longestTitle = itemTitles.reduce((longest, current) => current.length > longest.length ? current : longest, '')
        const longestText = itemTexts.reduce((longest, current) => current.length > longest.length ? current : longest, '')

        const elements = contentTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (item.data.items.length === 1) {
            const contentItem = item.data.items[0]
            if (checkTextType(el, 'content') && contentItem.text) {
              return getNewTextElement({ el, text: contentItem.text, maxLine: 6 })
            }
          }
          else {
            if (checkTextType(el, 'itemTitle')) {
              const index = sortedTitleItemIds.findIndex(id => id === el.id)
              const contentItem = item.data.items[index]
              if (contentItem && contentItem.title) {
                return getNewTextElement({ el, text: contentItem.title, longestText: longestTitle, maxLine: 1 })
              }
            }
            if (checkTextType(el, 'item')) {
              const index = sortedTextItemIds.findIndex(id => id === el.id)
              const contentItem = item.data.items[index]
              if (contentItem && contentItem.text) {
                return getNewTextElement({ el, text: contentItem.text, longestText, maxLine: 4 })
              }
            }
            if (checkTextType(el, 'itemNumber')) {
              const index = sortedNumberItemIds.findIndex(id => id === el.id)
              const offset = item.offset || 0
              return getNewTextElement({ el, text: index + offset + 1 + '', maxLine: 1, digitPadding: true })
            }
          }
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          return el
        })
        slides.push({
          ...contentTemplate,
          id: nanoid(10),
          elements,
        })
      }
      // ============ 方案A扩展类型处理 ============
      
      else if (item.type === 'text_image') {
        // 图文页：优先使用专门模板，否则降级到 content 模板
        const templates = textImageTemplates.length > 0 ? textImageTemplates : contentTemplates
        const template = templates[Math.floor(Math.random() * templates.length)]
        
        const elements = template.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          if (checkTextType(el, 'content') && item.data.text) {
            return getNewTextElement({ el, text: item.data.text, maxLine: 6 })
          }
          return el
        })
        slides.push({
          ...template,
          id: nanoid(10),
          elements,
        })
      }
      
      else if (item.type === 'comparison') {
        // 对比页：优先使用专门模板，否则降级到 content 模板
        const templates = comparisonTemplates.length > 0 ? comparisonTemplates : contentTemplates
        const template = templates[Math.floor(Math.random() * templates.length)]
        
        // 检查是否有专用的对比类型文本元素
        const hasComparisonTextTypes = template.elements.some(el => 
          checkTextType(el, 'leftTitle') || checkTextType(el, 'rightTitle')
        )
        
        // 将对比数据转换为 items 格式以兼容 content 模板（降级用）
        const comparisonItems = [
          { title: item.data.leftTitle, text: item.data.leftItems.join('；') },
          { title: item.data.rightTitle, text: item.data.rightItems.join('；') }
        ]
        
        // 降级用：按位置排序的 itemTitle 和 item
        const sortedTitleItemIds = template.elements.filter(el => checkTextType(el, 'itemTitle')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedTextItemIds = template.elements.filter(el => checkTextType(el, 'item')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)
        
        // 专用类型：按位置排序的 leftItem 和 rightItem
        const sortedLeftItemIds = template.elements.filter(el => checkTextType(el, 'leftItem')).sort((a, b) => {
          const aIndex = a.top
          const bIndex = b.top
          return aIndex - bIndex
        }).map(el => el.id)
        
        const sortedRightItemIds = template.elements.filter(el => checkTextType(el, 'rightItem')).sort((a, b) => {
          const aIndex = a.top
          const bIndex = b.top
          return aIndex - bIndex
        }).map(el => el.id)
        
        const elements = template.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          
          // 页面标题
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          
          // === 专用类型匹配 ===
          if (hasComparisonTextTypes) {
            // 左侧标题
            if (checkTextType(el, 'leftTitle') && item.data.leftTitle) {
              return getNewTextElement({ el, text: item.data.leftTitle, maxLine: 1 })
            }
            // 右侧标题
            if (checkTextType(el, 'rightTitle') && item.data.rightTitle) {
              return getNewTextElement({ el, text: item.data.rightTitle, maxLine: 1 })
            }
            // 左侧内容项
            if (checkTextType(el, 'leftItem')) {
              const index = sortedLeftItemIds.findIndex(id => id === el.id)
              const leftItem = item.data.leftItems[index]
              if (leftItem) {
                return getNewTextElement({ el, text: leftItem, maxLine: 2 })
              }
            }
            // 右侧内容项
            if (checkTextType(el, 'rightItem')) {
              const index = sortedRightItemIds.findIndex(id => id === el.id)
              const rightItem = item.data.rightItems[index]
              if (rightItem) {
                return getNewTextElement({ el, text: rightItem, maxLine: 2 })
              }
            }
          }
          
          // === 降级匹配（使用 itemTitle/item）===
          if (checkTextType(el, 'itemTitle')) {
            const index = sortedTitleItemIds.findIndex(id => id === el.id)
            const compItem = comparisonItems[index]
            if (compItem && compItem.title) {
              return getNewTextElement({ el, text: compItem.title, maxLine: 1 })
            }
          }
          if (checkTextType(el, 'item')) {
            const index = sortedTextItemIds.findIndex(id => id === el.id)
            const compItem = comparisonItems[index]
            if (compItem && compItem.text) {
              return getNewTextElement({ el, text: compItem.text, maxLine: 4 })
            }
          }
          return el
        })
        slides.push({
          ...template,
          id: nanoid(10),
          elements,
        })
      }
      
      else if (item.type === 'timeline') {
        // 时间线页：优先使用专门模板，否则降级到 content 模板
        const templates = timelineTemplates.length > 0 ? timelineTemplates : contentTemplates
        
        // 检查是否有专用的时间线类型文本元素
        const hasTimelineTextTypes = templates.some(t => 
          t.elements.some(el => checkTextType(el, 'timeLabel'))
        )
        
        const _templates = getUseableTemplates(templates, item.data.items.length, hasTimelineTextTypes ? 'timeLabel' : 'item')
        const template = _templates[Math.floor(Math.random() * _templates.length)]
        
        // 将时间线数据转换为 items 格式
        const timelineItems = item.data.items.map(i => ({
          title: i.time,
          text: i.event
        }))
        
        // 专用类型：timeLabel
        const sortedTimeLabelIds = template.elements.filter(el => checkTextType(el, 'timeLabel')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)
        
        // 降级用：itemTitle
        const sortedTitleItemIds = template.elements.filter(el => checkTextType(el, 'itemTitle')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedTextItemIds = template.elements.filter(el => checkTextType(el, 'item')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)
        
        const sortedNumberItemIds = template.elements.filter(el => checkTextType(el, 'itemNumber')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const longestTitle = timelineItems.reduce((longest, current) => current.title.length > longest.length ? current.title : longest, '')
        const longestText = timelineItems.reduce((longest, current) => current.text.length > longest.length ? current.text : longest, '')
        
        const elements = template.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          
          // 页面标题
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          
          // === 专用类型匹配：timeLabel ===
          if (checkTextType(el, 'timeLabel')) {
            const index = sortedTimeLabelIds.findIndex(id => id === el.id)
            const tlItem = timelineItems[index]
            if (tlItem && tlItem.title) {
              return getNewTextElement({ el, text: tlItem.title, longestText: longestTitle, maxLine: 1 })
            }
          }
          
          // === 降级匹配：itemTitle ===
          if (checkTextType(el, 'itemTitle')) {
            const index = sortedTitleItemIds.findIndex(id => id === el.id)
            const tlItem = timelineItems[index]
            if (tlItem && tlItem.title) {
              return getNewTextElement({ el, text: tlItem.title, longestText: longestTitle, maxLine: 1 })
            }
          }
          
          // 事件描述
          if (checkTextType(el, 'item')) {
            const index = sortedTextItemIds.findIndex(id => id === el.id)
            const tlItem = timelineItems[index]
            if (tlItem && tlItem.text) {
              return getNewTextElement({ el, text: tlItem.text, longestText, maxLine: 4 })
            }
          }
          if (checkTextType(el, 'itemNumber')) {
            const index = sortedNumberItemIds.findIndex(id => id === el.id)
            return getNewTextElement({ el, text: index + 1 + '', maxLine: 1, digitPadding: true })
          }
          return el
        })
        slides.push({
          ...template,
          id: nanoid(10),
          elements,
        })
      }
      
      else if (item.type === 'statistics') {
        // 数据统计页：优先使用专门模板，否则降级到 content 模板
        const templates = statisticsTemplates.length > 0 ? statisticsTemplates : contentTemplates
        
        // 检查是否有专用的统计类型文本元素
        const hasStatisticsTextTypes = templates.some(t => 
          t.elements.some(el => checkTextType(el, 'statValue'))
        )
        
        const _templates = getUseableTemplates(templates, item.data.items.length, hasStatisticsTextTypes ? 'statValue' : 'item')
        const template = _templates[Math.floor(Math.random() * _templates.length)]
        
        // 将统计数据转换为 items 格式
        const statItems = item.data.items.map(i => ({
          title: i.value,   // 数值作为标题（更醒目）
          text: i.label     // 说明作为内容
        }))
        
        // 专用类型：statValue 和 statLabel
        const sortedStatValueIds = template.elements.filter(el => checkTextType(el, 'statValue')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)
        
        const sortedStatLabelIds = template.elements.filter(el => checkTextType(el, 'statLabel')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)
        
        // 降级用：itemTitle 和 item
        const sortedTitleItemIds = template.elements.filter(el => checkTextType(el, 'itemTitle')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const sortedTextItemIds = template.elements.filter(el => checkTextType(el, 'item')).sort((a, b) => {
          const aIndex = a.left + a.top * 2
          const bIndex = b.left + b.top * 2
          return aIndex - bIndex
        }).map(el => el.id)

        const longestTitle = statItems.reduce((longest, current) => current.title.length > longest.length ? current.title : longest, '')
        const longestText = statItems.reduce((longest, current) => current.text.length > longest.length ? current.text : longest, '')
        
        const elements = template.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          
          // 页面标题
          if (checkTextType(el, 'title') && item.data.title) {
            return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
          }
          
          // === 专用类型匹配：statValue ===
          if (checkTextType(el, 'statValue')) {
            const index = sortedStatValueIds.findIndex(id => id === el.id)
            const statItem = statItems[index]
            if (statItem && statItem.title) {
              return getNewTextElement({ el, text: statItem.title, longestText: longestTitle, maxLine: 1 })
            }
          }
          
          // === 专用类型匹配：statLabel ===
          if (checkTextType(el, 'statLabel')) {
            const index = sortedStatLabelIds.findIndex(id => id === el.id)
            const statItem = statItems[index]
            if (statItem && statItem.text) {
              return getNewTextElement({ el, text: statItem.text, longestText, maxLine: 2 })
            }
          }
          
          // === 降级匹配：itemTitle ===
          if (checkTextType(el, 'itemTitle')) {
            const index = sortedTitleItemIds.findIndex(id => id === el.id)
            const statItem = statItems[index]
            if (statItem && statItem.title) {
              return getNewTextElement({ el, text: statItem.title, longestText: longestTitle, maxLine: 1 })
            }
          }
          
          // === 降级匹配：item ===
          if (checkTextType(el, 'item')) {
            const index = sortedTextItemIds.findIndex(id => id === el.id)
            const statItem = statItems[index]
            if (statItem && statItem.text) {
              return getNewTextElement({ el, text: statItem.text, longestText, maxLine: 2 })
            }
          }
          return el
        })
        slides.push({
          ...template,
          id: nanoid(10),
          elements,
        })
      }
      
      else if (item.type === 'quote') {
        // 引用页：优先使用专门模板，否则降级到 transition 模板（因为结构相似）
        const templates = quoteTemplates.length > 0 ? quoteTemplates : transitionTemplates
        const template = templates[Math.floor(Math.random() * templates.length)]
        
        // 检查是否有专用的引用类型文本元素
        const hasQuoteTextTypes = template.elements.some(el => checkTextType(el, 'quote'))
        
        const elements = template.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          if (el.type !== 'text' && el.type !== 'shape') return el
          
          // === 专用类型匹配 ===
          if (hasQuoteTextTypes) {
            // 引用内容
            if (checkTextType(el, 'quote') && item.data.quote) {
              return getNewTextElement({ el, text: `"${item.data.quote}"`, maxLine: 4 })
            }
            // 作者名
            if (checkTextType(el, 'author') && item.data.author) {
              return getNewTextElement({ el, text: item.data.author, maxLine: 1 })
            }
            // 作者头衔
            if (checkTextType(el, 'authorTitle') && item.data.title) {
              return getNewTextElement({ el, text: item.data.title, maxLine: 1 })
            }
          }
          
          // === 降级匹配 ===
          // quote 内容映射到 title（主要内容）
          if (checkTextType(el, 'title') && item.data.quote) {
            return getNewTextElement({ el, text: `"${item.data.quote}"`, maxLine: 3 })
          }
          // author + title 映射到 content（次要内容）
          if (checkTextType(el, 'content')) {
            const authorText = [item.data.author, item.data.title].filter(Boolean).join(' · ')
            if (authorText) {
              return getNewTextElement({ el, text: `—— ${authorText}`, maxLine: 1 })
            }
          }
          return el
        })
        slides.push({
          ...template,
          id: nanoid(10),
          elements,
        })
      }
      
      // ============ 结束页处理 ============
      
      else if (item.type === 'end') {
        const endTemplate = endTemplates[Math.floor(Math.random() * endTemplates.length)]
        const elements = endTemplate.elements.map(el => {
          if (el.type === 'image' && el.imageType && imgPool.value.length) return getNewImgElement(el)
          return el
        })
        slides.push({
          ...endTemplate,
          id: nanoid(10),
          elements,
        })
      }
    }
    if (isEmptySlide.value) slidesStore.setSlides(slides)
    else addSlidesFromData(slides)
  }

  return {
    presetImgPool,
    AIPPT,
    getMdContent,
    getJSONContent,
  }
}