/**
 * Sales 页面 PPTX 导出 Hook
 * 
 * 从后端 API 获取完整文档数据并导出为 PPTX 文件
 * 基于 useExport.ts 的 exportPPTX 逻辑改造，移除对编辑器 store 的依赖
 */

import { ref } from 'vue'
import pptxgen from 'pptxgenjs'
import tinycolor from 'tinycolor2'
import { SERVER_URL } from '@/services'
import axios from '@/services/config'
import { ElMessage } from 'element-plus'
import type { PPTElementOutline, PPTElementShadow, PPTElementLink, Slide } from '@/types/slides'
import { getElementRange, getLineElementPath, getTableSubThemeColor } from '@/utils/element'
import { type AST, toAST } from '@/utils/htmlParser'
import { type SvgPoints, toPoints } from '@/utils/svgPathParser'
import { svg2Base64 } from '@/utils/svg2Base64'

const defaultFontSize = 16

// 格式化颜色值为 透明度 + HexString，供pptxgenjs使用
function formatColor(_color: string) {
  if (!_color) {
    return {
      alpha: 0,
      color: '#000000',
    }
  }

  const c = tinycolor(_color)
  const alpha = c.getAlpha()
  const color = alpha === 0 ? '#ffffff' : c.setAlpha(1).toHexString()
  return {
    alpha,
    color,
  }
}

type FormatColor = ReturnType<typeof formatColor>

// 将HTML字符串格式化为pptxgenjs所需的格式
function formatHTML(html: string, ratioPx2Pt: number) {
  const ast = toAST(html)
  let bulletFlag = false
  let indent = 0

  const slices: pptxgen.TextProps[] = []
  const parse = (obj: AST[], baseStyleObj: { [key: string]: string } = {}) => {
    for (const item of obj) {
      const isBlockTag = 'tagName' in item && ['div', 'li', 'p'].includes(item.tagName)

      if (isBlockTag && slices.length) {
        const lastSlice = slices[slices.length - 1]
        if (!lastSlice.options) lastSlice.options = {}
        lastSlice.options.breakLine = true
      }

      const styleObj = { ...baseStyleObj }
      const styleAttr = 'attributes' in item ? item.attributes.find(attr => attr.key === 'style') : null
      if (styleAttr && styleAttr.value) {
        const styleArr = styleAttr.value.split(';')
        for (const styleItem of styleArr) {
          const match = styleItem.match(/([^:]+):\s*(.+)/)
          if (match) {
            const [key, value] = [match[1].trim(), match[2].trim()]
            if (key && value) styleObj[key] = value
          }
        }
      }

      if ('tagName' in item) {
        if (item.tagName === 'em') styleObj['font-style'] = 'italic'
        if (item.tagName === 'strong') styleObj['font-weight'] = 'bold'
        if (item.tagName === 'sup') styleObj['vertical-align'] = 'super'
        if (item.tagName === 'sub') styleObj['vertical-align'] = 'sub'
        if (item.tagName === 'a') {
          const attr = item.attributes.find(attr => attr.key === 'href')
          styleObj['href'] = attr?.value || ''
        }
        if (item.tagName === 'ul') styleObj['list-type'] = 'ul'
        if (item.tagName === 'ol') styleObj['list-type'] = 'ol'
        if (item.tagName === 'li') bulletFlag = true
        if (item.tagName === 'p') {
          if ('attributes' in item) {
            const dataIndentAttr = item.attributes.find(attr => attr.key === 'data-indent')
            if (dataIndentAttr && dataIndentAttr.value) indent = +dataIndentAttr.value
          }
        }
      }

      if ('tagName' in item && item.tagName === 'br') {
        slices.push({ text: '', options: { breakLine: true } })
      }
      else if ('content' in item) {
        const text = item.content.replace(/&nbsp;/g, ' ').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&').replace(/\n/g, '')
        const options: pptxgen.TextPropsOptions = {}

        if (styleObj['font-size']) options.fontSize = parseInt(styleObj['font-size']) / ratioPx2Pt
        if (styleObj['color']) options.color = formatColor(styleObj['color']).color
        if (styleObj['background-color']) options.highlight = formatColor(styleObj['background-color']).color
        if (styleObj['text-decoration-line']) {
          if (styleObj['text-decoration-line'].indexOf('underline') !== -1) {
            options.underline = { color: options.color || '#000000', style: 'sng' }
          }
          if (styleObj['text-decoration-line'].indexOf('line-through') !== -1) {
            options.strike = 'sngStrike'
          }
        }
        if (styleObj['text-decoration']) {
          if (styleObj['text-decoration'].indexOf('underline') !== -1) {
            options.underline = { color: options.color || '#000000', style: 'sng' }
          }
          if (styleObj['text-decoration'].indexOf('line-through') !== -1) {
            options.strike = 'sngStrike'
          }
        }
        if (styleObj['vertical-align']) {
          if (styleObj['vertical-align'] === 'super') options.superscript = true
          if (styleObj['vertical-align'] === 'sub') options.subscript = true
        }
        if (styleObj['text-align']) options.align = styleObj['text-align'] as pptxgen.HAlign
        if (styleObj['font-weight']) options.bold = styleObj['font-weight'] === 'bold'
        if (styleObj['font-style']) options.italic = styleObj['font-style'] === 'italic'
        if (styleObj['font-family']) options.fontFace = styleObj['font-family']
        if (styleObj['href']) options.hyperlink = { url: styleObj['href'] }

        if (bulletFlag && styleObj['list-type'] === 'ol') {
          options.bullet = { type: 'number', indent: (options.fontSize || defaultFontSize) * 1.25 }
          options.paraSpaceBefore = 0.1
          bulletFlag = false
        }
        if (bulletFlag && styleObj['list-type'] === 'ul') {
          options.bullet = { indent: (options.fontSize || defaultFontSize) * 1.25 }
          options.paraSpaceBefore = 0.1
          bulletFlag = false
        }
        if (indent) {
          options.indentLevel = indent
          indent = 0
        }

        slices.push({ text, options })
      }
      else if ('children' in item) parse(item.children, styleObj)
    }
  }
  parse(ast)
  return slices
}

type Points = Array<
  | { x: number; y: number; moveTo?: boolean }
  | { x: number; y: number; curve: { type: 'arc'; hR: number; wR: number; stAng: number; swAng: number } }
  | { x: number; y: number; curve: { type: 'quadratic'; x1: number; y1: number } }
  | { x: number; y: number; curve: { type: 'cubic'; x1: number; y1: number; x2: number; y2: number } }
  | { close: true }
>

function formatPoints(points: SvgPoints, scale: { x: number; y: number }, ratioPx2Inch: number): Points {
  return points.map(point => {
    if (point.close !== undefined) return { close: true }
    else if (point.type === 'M') {
      return {
        x: point.x / ratioPx2Inch * scale.x,
        y: point.y / ratioPx2Inch * scale.y,
        moveTo: true,
      }
    }
    else if (point.curve) {
      if (point.curve.type === 'cubic') {
        return {
          x: point.x / ratioPx2Inch * scale.x,
          y: point.y / ratioPx2Inch * scale.y,
          curve: {
            type: 'cubic',
            x1: (point.curve.x1 as number) / ratioPx2Inch * scale.x,
            y1: (point.curve.y1 as number) / ratioPx2Inch * scale.y,
            x2: (point.curve.x2 as number) / ratioPx2Inch * scale.x,
            y2: (point.curve.y2 as number) / ratioPx2Inch * scale.y,
          },
        }
      }
      else if (point.curve.type === 'quadratic') {
        return {
          x: point.x / ratioPx2Inch * scale.x,
          y: point.y / ratioPx2Inch * scale.y,
          curve: {
            type: 'quadratic',
            x1: (point.curve.x1 as number) / ratioPx2Inch * scale.x,
            y1: (point.curve.y1 as number) / ratioPx2Inch * scale.y,
          },
        }
      }
    }
    return {
      x: point.x / ratioPx2Inch * scale.x,
      y: point.y / ratioPx2Inch * scale.y,
    }
  })
}

function getShadowOption(shadow: PPTElementShadow, ratioPx2Pt: number): pptxgen.ShadowProps {
  const c = formatColor(shadow.color)
  const { h, v } = shadow

  let offset = 4
  let angle = 45

  if (h === 0 && v === 0) {
    offset = 4
    angle = 45
  }
  else if (h === 0) {
    if (v > 0) { offset = v; angle = 90 }
    else { offset = -v; angle = 270 }
  }
  else if (v === 0) {
    if (h > 0) { offset = h; angle = 1 }
    else { offset = -h; angle = 180 }
  }
  else if (h > 0 && v > 0) { offset = Math.max(h, v); angle = 45 }
  else if (h > 0 && v < 0) { offset = Math.max(h, -v); angle = 315 }
  else if (h < 0 && v > 0) { offset = Math.max(-h, v); angle = 135 }
  else if (h < 0 && v < 0) { offset = Math.max(-h, -v); angle = 225 }

  return {
    type: 'outer',
    color: c.color.replace('#', ''),
    opacity: c.alpha,
    blur: shadow.blur / ratioPx2Pt,
    offset,
    angle,
  }
}

const dashTypeMap = {
  'solid': 'solid',
  'dashed': 'dash',
  'dotted': 'sysDot',
}

function getOutlineOption(outline: PPTElementOutline, ratioPx2Pt: number): pptxgen.ShapeLineProps {
  const c = formatColor(outline?.color || '#000000')
  return {
    color: c.color,
    transparency: (1 - c.alpha) * 100,
    width: (outline.width || 1) / ratioPx2Pt,
    dashType: outline.style ? dashTypeMap[outline.style] as 'solid' | 'dash' | 'sysDot' : 'solid',
  }
}

function getLinkOption(link: PPTElementLink, allSlides: Slide[]): pptxgen.HyperlinkProps | null {
  const { type, target } = link
  if (type === 'web') return { url: target }
  if (type === 'slide') {
    const index = allSlides.findIndex(slide => slide.id === target)
    if (index !== -1) return { slide: index + 1 }
  }
  return null
}

function isBase64Image(url: string) {
  return /^data:image\/[^;]+;base64,/.test(url)
}

function isSVGImage(url: string) {
  return /^data:image\/svg\+xml;base64,/.test(url) || /\.svg$/.test(url)
}

export function useExportPPT(documentId: string) {
  const exporting = ref(false)

  // 从后端获取完整文档数据
  async function fetchCompleteDocument() {
    try {
      // axios 拦截器已经返回了 response.data，所以 response 就是 { success: true, data: {...} }
      const response = await axios.get(`${SERVER_URL}/documents/${documentId}`) as {
        success: boolean
        data?: {
          documentData: any
          [key: string]: any
        }
        error?: string
      }
      
      if (!response || !response.success || !response.data) {
        throw new Error(response?.error || '获取文档数据失败')
      }
      
      // response.data 包含 metadata 的所有字段（通过...meta展开）和 documentData 字段
      const { documentData, ...restData } = response.data
      return {
        metadata: restData,
        documentData: documentData
      }
    } catch (error: any) {
      console.error('[导出PPTX] 获取文档数据失败:', error)
      throw new Error(error.message || '获取文档数据失败')
    }
  }

  // 导出PPTX文件
  // documentDataOverride: 可选，外部传入的文档数据（用于批量导出合并后的数据）
  async function exportPPTX(slideIndexes: number[] = [], documentDataOverride?: any) {
    exporting.value = true
    try {
      // 获取完整文档数据
      let metadata, documentData
      
      if (documentDataOverride) {
        // 使用外部传入的数据（批量导出场景）
        documentData = documentDataOverride
        metadata = { name: documentData.title || '批量导出' }
      } else {
        // 从后端获取数据（正常单文档导出场景）
        const result = await fetchCompleteDocument()
        metadata = result.metadata
        documentData = result.documentData
      }
      
      const { title, width, height, theme, slides } = documentData
      
      console.log('[导出PPTX] 文档数据:', {
        title,
        width,
        height,
        slideCount: slides?.length,
        firstSlide: slides?.[0],
      })

      // 筛选要导出的幻灯片
      const slidesToExport = slideIndexes.length > 0
        ? slideIndexes.map(i => slides[i]).filter(Boolean)
        : slides

      if (slidesToExport.length === 0) {
        throw new Error('没有可导出的幻灯片')
      }

      // 计算导出参数（替代 store 中的值）
      const viewportRatio = height / width
      const viewportSize = width || 960
      const ratioPx2Inch = 96 * (viewportSize / 960)
      const ratioPx2Pt = 96 / 72 * (viewportSize / 960)
      const documentTitle = title || metadata.name || 'presentation'

      // 创建 PPTX
      const pptx = new pptxgen()

      // 设置布局
      if (viewportRatio === 0.625) pptx.layout = 'LAYOUT_16x10'
      else if (viewportRatio === 0.75) pptx.layout = 'LAYOUT_4x3'
      else if (viewportRatio === 0.70710678) {
        pptx.defineLayout({ name: 'A3', width: 10, height: 7.0710678 })
        pptx.layout = 'A3'
      }
      else if (viewportRatio === 1.41421356) {
        pptx.defineLayout({ name: 'A3_V', width: 10, height: 14.1421356 })
        pptx.layout = 'A3_V'
      }
      else pptx.layout = 'LAYOUT_16x9'

      // 遍历幻灯片
      for (const slide of slidesToExport) {
        const pptxSlide = pptx.addSlide()

        // 背景处理
        if (slide.background) {
          const background = slide.background
          if (background.type === 'image' && background.image) {
            if (isSVGImage(background.image.src)) {
              pptxSlide.addImage({
                data: background.image.src,
                x: 0,
                y: 0,
                w: viewportSize / ratioPx2Inch,
                h: viewportSize * viewportRatio / ratioPx2Inch,
              })
            }
            else if (isBase64Image(background.image.src)) {
              pptxSlide.background = { data: background.image.src }
            }
            else {
              pptxSlide.background = { path: background.image.src }
            }
          }
          else if (background.type === 'solid' && background.color) {
            const c = formatColor(background.color)
            pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 }
          }
          else if (background.type === 'gradient' && background.gradient) {
            const colors = background.gradient.colors
            const color1 = colors[0].color
            const color2 = colors[colors.length - 1].color
            const color = tinycolor.mix(color1, color2).toHexString()
            const c = formatColor(color)
            pptxSlide.background = { color: c.color, transparency: (1 - c.alpha) * 100 }
          }
        }

        // 备注
        if (slide.remark) {
          const doc = new DOMParser().parseFromString(slide.remark, 'text/html')
          const pList = doc.body.querySelectorAll('p')
          const text: string[] = []
          for (const p of pList) {
            const textContent = p.textContent
            text.push(textContent || '')
          }
          pptxSlide.addNotes(text.join('\n'))
        }

        if (!slide.elements) continue

        // 处理元素
        for (const el of slide.elements) {
          if (el.type === 'text') {
            console.log('[导出PPTX] 文本元素:', {
              id: el.id,
              content: el.content?.substring(0, 100),
              defaultColor: el.defaultColor,
              fill: el.fill,
            })
            
            const textProps = formatHTML(el.content, ratioPx2Pt)
            const options: pptxgen.TextPropsOptions = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
              fontSize: defaultFontSize / ratioPx2Pt,
              fontFace: '微软雅黑',
              color: '#000000',
              valign: 'top',
              margin: 10 / ratioPx2Pt,
              paraSpaceBefore: 5 / ratioPx2Pt,
              lineSpacingMultiple: 1.5 / 1.25,
              autoFit: true,
            }
            if (el.rotate) options.rotate = el.rotate
            if (el.wordSpace) options.charSpacing = el.wordSpace / ratioPx2Pt
            if (el.lineHeight) options.lineSpacingMultiple = el.lineHeight / 1.25
            if (el.fill) {
              const c = formatColor(el.fill)
              const opacity = el.opacity === undefined ? 1 : el.opacity
              options.fill = { color: c.color, transparency: (1 - c.alpha * opacity) * 100 }
            }
            if (el.defaultColor) options.color = formatColor(el.defaultColor).color
            if (el.defaultFontName) options.fontFace = el.defaultFontName
            if (el.shadow) options.shadow = getShadowOption(el.shadow, ratioPx2Pt)
            if (el.outline?.width) options.line = getOutlineOption(el.outline, ratioPx2Pt)
            if (el.opacity !== undefined) options.transparency = (1 - el.opacity) * 100
            if (el.paragraphSpace !== undefined) options.paraSpaceBefore = el.paragraphSpace / ratioPx2Pt
            if (el.vertical) options.vert = 'eaVert'

            pptxSlide.addText(textProps, options)
          }

          else if (el.type === 'image') {
            const options: pptxgen.ImageProps = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
            }
            if (isBase64Image(el.src)) options.data = el.src
            else options.path = el.src

            if (el.flipH) options.flipH = el.flipH
            if (el.flipV) options.flipV = el.flipV
            if (el.rotate) options.rotate = el.rotate
            if (el.link) {
              const linkOption = getLinkOption(el.link, slides)
              if (linkOption) options.hyperlink = linkOption
            }
            if (el.filters?.opacity) options.transparency = 100 - parseInt(el.filters?.opacity)
            if (el.clip) {
              if (el.clip.shape === 'ellipse') options.rounding = true

              const [start, end] = el.clip.range
              const [startX, startY] = start
              const [endX, endY] = end

              const originW = el.width / ((endX - startX) / ratioPx2Inch)
              const originH = el.height / ((endY - startY) / ratioPx2Inch)

              options.w = originW / ratioPx2Inch
              options.h = originH / ratioPx2Inch

              options.sizing = {
                type: 'crop',
                x: startX / ratioPx2Inch * originW / ratioPx2Inch,
                y: startY / ratioPx2Inch * originH / ratioPx2Inch,
                w: (endX - startX) / ratioPx2Inch * originW / ratioPx2Inch,
                h: (endY - startY) / ratioPx2Inch * originH / ratioPx2Inch,
              }
            }

            pptxSlide.addImage(options)
          }

          else if (el.type === 'shape') {
            if (el.special) {
              // 特殊形状需要从 DOM 获取 SVG，在 Sales 页面中不可用，跳过
              const svgRef = document.querySelector(`.thumbnail-list .base-element-${el.id} svg`) as HTMLElement
              if (svgRef && svgRef.clientWidth >= 1 && svgRef.clientHeight >= 1) {
                try {
                  const base64SVG = svg2Base64(svgRef)
                  const options: pptxgen.ImageProps = {
                    data: base64SVG,
                    x: el.left / ratioPx2Inch,
                    y: el.top / ratioPx2Inch,
                    w: el.width / ratioPx2Inch,
                    h: el.height / ratioPx2Inch,
                  }
                  if (el.rotate) options.rotate = el.rotate
                  if (el.flipH) options.flipH = el.flipH
                  if (el.flipV) options.flipV = el.flipV
                  if (el.link) {
                    const linkOption = getLinkOption(el.link, slides)
                    if (linkOption) options.hyperlink = linkOption
                  }
                  pptxSlide.addImage(options)
                } catch (error) {
                  console.warn(`[导出PPTX] 特殊形状 ${el.id} 导出失败:`, error)
                }
              }
            }
            else {
              const scale = {
                x: el.width / el.viewBox[0],
                y: el.height / el.viewBox[1],
              }
              const points = formatPoints(toPoints(el.path), scale, ratioPx2Inch)

              let fillColor = formatColor(el.fill)
              if (el.gradient) {
                const colors = el.gradient.colors
                const color1 = colors[0].color
                const color2 = colors[colors.length - 1].color
                const color = tinycolor.mix(color1, color2).toHexString()
                fillColor = formatColor(color)
              }
              if (el.pattern) fillColor = formatColor('#00000000')
              const opacity = el.opacity === undefined ? 1 : el.opacity

              const options: pptxgen.ShapeProps = {
                x: el.left / ratioPx2Inch,
                y: el.top / ratioPx2Inch,
                w: el.width / ratioPx2Inch,
                h: el.height / ratioPx2Inch,
                fill: { color: fillColor.color, transparency: (1 - fillColor.alpha * opacity) * 100 },
                points,
              }
              if (el.flipH) options.flipH = el.flipH
              if (el.flipV) options.flipV = el.flipV
              if (el.shadow) options.shadow = getShadowOption(el.shadow, ratioPx2Pt)
              if (el.outline?.width) options.line = getOutlineOption(el.outline, ratioPx2Pt)
              if (el.rotate) options.rotate = el.rotate
              if (el.link) {
                const linkOption = getLinkOption(el.link, slides)
                if (linkOption) options.hyperlink = linkOption
              }

              pptxSlide.addShape('custGeom' as pptxgen.ShapeType, options)
            }
            if (el.text) {
              const textProps = formatHTML(el.text.content, ratioPx2Pt)
              const options: pptxgen.TextPropsOptions = {
                x: el.left / ratioPx2Inch,
                y: el.top / ratioPx2Inch,
                w: el.width / ratioPx2Inch,
                h: el.height / ratioPx2Inch,
                fontSize: defaultFontSize / ratioPx2Pt,
                fontFace: '微软雅黑',
                color: '#000000',
                paraSpaceBefore: 5 / ratioPx2Pt,
                valign: el.text.align,
              }
              if (el.rotate) options.rotate = el.rotate
              if (el.text.defaultColor) options.color = formatColor(el.text.defaultColor).color
              if (el.text.defaultFontName) options.fontFace = el.text.defaultFontName

              pptxSlide.addText(textProps, options)
            }
            if (el.pattern) {
              const options: pptxgen.ImageProps = {
                x: el.left / ratioPx2Inch,
                y: el.top / ratioPx2Inch,
                w: el.width / ratioPx2Inch,
                h: el.height / ratioPx2Inch,
              }
              if (isBase64Image(el.pattern)) options.data = el.pattern
              else options.path = el.pattern

              if (el.flipH) options.flipH = el.flipH
              if (el.flipV) options.flipV = el.flipV
              if (el.rotate) options.rotate = el.rotate
              if (el.link) {
                const linkOption = getLinkOption(el.link, slides)
                if (linkOption) options.hyperlink = linkOption
              }

              pptxSlide.addImage(options)
            }
          }

          else if (el.type === 'line') {
            const path = getLineElementPath(el)
            const points = formatPoints(toPoints(path), { x: 1, y: 1 }, ratioPx2Inch)
            const { minX, maxX, minY, maxY } = getElementRange(el)
            const c = formatColor(el.color)

            const options: pptxgen.ShapeProps = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: (maxX - minX) / ratioPx2Inch,
              h: (maxY - minY) / ratioPx2Inch,
              line: {
                color: c.color,
                transparency: (1 - c.alpha) * 100,
                width: el.width / ratioPx2Pt,
                dashType: dashTypeMap[el.style] as 'solid' | 'dash' | 'sysDot',
                beginArrowType: el.points[0] ? 'arrow' : 'none',
                endArrowType: el.points[1] ? 'arrow' : 'none',
              },
              points,
            }
            if (el.shadow) options.shadow = getShadowOption(el.shadow, ratioPx2Pt)

            pptxSlide.addShape('custGeom' as pptxgen.ShapeType, options)
          }

          else if (el.type === 'chart') {
            const chartData = []
            for (let i = 0; i < el.data.series.length; i++) {
              const item = el.data.series[i]
              chartData.push({
                name: `系列${i + 1}`,
                labels: el.data.labels,
                values: item,
              })
            }

            let chartColors: string[] = []
            if (el.themeColors.length === 10) chartColors = el.themeColors.map(color => formatColor(color).color)
            else if (el.themeColors.length === 1) chartColors = tinycolor(el.themeColors[0]).analogous(10).map(color => formatColor(color.toHexString()).color)
            else {
              const len = el.themeColors.length
              const supplement = tinycolor(el.themeColors[len - 1]).analogous(10 + 1 - len).map(color => color.toHexString())
              chartColors = [...el.themeColors.slice(0, len - 1), ...supplement].map(color => formatColor(color).color)
            }

            const options: pptxgen.IChartOpts = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
              chartColors: (el.chartType === 'pie' || el.chartType === 'ring') ? chartColors : chartColors.slice(0, el.data.series.length),
            }

            const textColor = formatColor(el.textColor || '#000000').color
            options.catAxisLabelColor = textColor
            options.valAxisLabelColor = textColor

            const fontSize = 14 / ratioPx2Pt
            options.catAxisLabelFontSize = fontSize
            options.valAxisLabelFontSize = fontSize

            if (el.fill || el.outline) {
              const plotArea: pptxgen.IChartPropsFillLine = {}
              if (el.fill) plotArea.fill = { color: formatColor(el.fill).color }
              if (el.outline) {
                plotArea.border = {
                  pt: el.outline.width! / ratioPx2Pt,
                  color: formatColor(el.outline.color!).color,
                }
              }
              options.plotArea = plotArea
            }

            if ((el.data.series.length > 1 && el.chartType !== 'scatter') || el.chartType === 'pie' || el.chartType === 'ring') {
              options.showLegend = true
              options.legendPos = 'b'
              options.legendColor = textColor
              options.legendFontSize = fontSize
            }

            let type = pptx.ChartType.bar
            if (el.chartType === 'bar') {
              type = pptx.ChartType.bar
              options.barDir = 'col'
              if (el.options?.stack) options.barGrouping = 'stacked'
            }
            else if (el.chartType === 'column') {
              type = pptx.ChartType.bar
              options.barDir = 'bar'
              if (el.options?.stack) options.barGrouping = 'stacked'
            }
            else if (el.chartType === 'line') {
              type = pptx.ChartType.line
              if (el.options?.lineSmooth) options.lineSmooth = true
            }
            else if (el.chartType === 'area') type = pptx.ChartType.area
            else if (el.chartType === 'radar') type = pptx.ChartType.radar
            else if (el.chartType === 'scatter') {
              type = pptx.ChartType.scatter
              options.lineSize = 0
            }
            else if (el.chartType === 'pie') type = pptx.ChartType.pie
            else if (el.chartType === 'ring') {
              type = pptx.ChartType.doughnut
              options.holeSize = 60
            }

            pptxSlide.addChart(type, chartData, options)
          }

          else if (el.type === 'table') {
            const hiddenCells: string[] = []
            for (let i = 0; i < el.data.length; i++) {
              const rowData = el.data[i]
              for (let j = 0; j < rowData.length; j++) {
                const cell = rowData[j]
                if (cell.colspan > 1 || cell.rowspan > 1) {
                  for (let row = i; row < i + cell.rowspan; row++) {
                    for (let col = row === i ? j + 1 : j; col < j + cell.colspan; col++) hiddenCells.push(`${row}_${col}`)
                  }
                }
              }
            }

            const tableData = []
            const theme = el.theme
            let themeColor: FormatColor | null = null
            let subThemeColors: FormatColor[] = []
            if (theme) {
              themeColor = formatColor(theme.color)
              subThemeColors = getTableSubThemeColor(theme.color).map(item => formatColor(item))
            }

            for (let i = 0; i < el.data.length; i++) {
              const row = el.data[i]
              const _row = []

              for (let j = 0; j < row.length; j++) {
                const cell = row[j]
                const cellOptions: pptxgen.TableCellProps = {
                  colspan: cell.colspan,
                  rowspan: cell.rowspan,
                  bold: cell.style?.bold || false,
                  italic: cell.style?.em || false,
                  underline: { style: cell.style?.underline ? 'sng' : 'none' },
                  align: cell.style?.align || 'left',
                  valign: 'middle',
                  fontFace: cell.style?.fontname || '微软雅黑',
                  fontSize: (cell.style?.fontsize ? parseInt(cell.style?.fontsize) : 14) / ratioPx2Pt,
                }
                if (theme && themeColor) {
                  let c: FormatColor
                  if (i % 2 === 0) c = subThemeColors[1]
                  else c = subThemeColors[0]

                  if (theme.rowHeader && i === 0) c = themeColor
                  else if (theme.rowFooter && i === el.data.length - 1) c = themeColor
                  else if (theme.colHeader && j === 0) c = themeColor
                  else if (theme.colFooter && j === row.length - 1) c = themeColor

                  cellOptions.fill = { color: c.color, transparency: (1 - c.alpha) * 100 }
                }
                if (cell.style?.backcolor) {
                  const c = formatColor(cell.style.backcolor)
                  cellOptions.fill = { color: c.color, transparency: (1 - c.alpha) * 100 }
                }
                if (cell.style?.color) cellOptions.color = formatColor(cell.style.color).color

                if (!hiddenCells.includes(`${i}_${j}`)) {
                  _row.push({
                    text: cell.text,
                    options: cellOptions,
                  })
                }
              }
              if (_row.length) tableData.push(_row)
            }

            const options: pptxgen.TableProps = {
              x: el.left / ratioPx2Inch,
              y: el.top / ratioPx2Inch,
              w: el.width / ratioPx2Inch,
              h: el.height / ratioPx2Inch,
              colW: el.colWidths.map(item => el.width * item / ratioPx2Inch),
            }
            if (el.theme) options.fill = { color: '#ffffff' }
            if (el.outline.width && el.outline.color) {
              options.border = {
                type: el.outline.style === 'solid' ? 'solid' : 'dash',
                pt: el.outline.width / ratioPx2Pt,
                color: formatColor(el.outline.color).color,
              }
            }

            pptxSlide.addTable(tableData, options)
          }

          else if (el.type === 'latex') {
            // LaTeX 元素需要从 DOM 获取 SVG，在 Sales 页面中不可用，跳过
            const svgRef = document.querySelector(`.thumbnail-list .base-element-${el.id} svg`) as HTMLElement
            if (svgRef) {
              try {
                const base64SVG = svg2Base64(svgRef)
                const options: pptxgen.ImageProps = {
                  data: base64SVG,
                  x: el.left / ratioPx2Inch,
                  y: el.top / ratioPx2Inch,
                  w: el.width / ratioPx2Inch,
                  h: el.height / ratioPx2Inch,
                }
                if (el.link) {
                  const linkOption = getLinkOption(el.link, slides)
                  if (linkOption) options.hyperlink = linkOption
                }
                pptxSlide.addImage(options)
              } catch (error) {
                console.warn(`[导出PPTX] LaTeX 元素 ${el.id} 导出失败:`, error)
              }
            }
          }

          // 音视频元素默认忽略（ignoreMedia = true）
        }
      }

      // 写入文件
      await pptx.writeFile({ fileName: `${documentTitle}.pptx` })
      return true
    } catch (error: any) {
      console.error('[导出PPTX] 导出失败:', error)
      throw error
    } finally {
      exporting.value = false
    }
  }

  return { exportPPTX, exporting }
}

