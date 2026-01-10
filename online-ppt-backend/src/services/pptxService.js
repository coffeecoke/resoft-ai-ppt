/**
 * PPTX 解析服务
 * 
 * 使用 pptxtojson 库解析 .pptx 文件，转换为 slides 格式
 * 
 * ⚠️ 重要：此文件逻辑必须与前端 online-ppt-web/src/utils/pptxParser.ts 保持一致
 */

import { parse } from 'pptxtojson/dist/index.js'
import { SVGPathData } from 'svg-pathdata'
import * as cheerio from 'cheerio'
import fs from 'fs/promises'
import { nanoid } from 'nanoid'
import { SHAPE_LIST, SHAPE_PATH_FORMULAS } from '../configs/shapes.ts'

class PPTXService {
  
  /**
   * 解析 PPTX 文件
   * 
   * @param {string} filePath - PPTX 文件路径
   * @param {Object} options - 解析选项
   * @param {boolean} options.fixedViewport - 是否固定 viewport 为 1000（默认：false，与前端一致）
   * @param {Object} options.defaultTheme - 默认主题配置
   * @returns {Promise<Object>} 解析结果 { slides, theme, viewportSize }
   */
  async parsePPTX(filePath, options = {}) {
    const { 
      fixedViewport = false,  // 与前端保持一致，默认 false
      defaultTheme = {
        fontColor: '#333',
        fontName: 'Microsoft Yahei',
        themeColors: ['#5b9bd5', '#70ad47', '#ffc000', '#ed7d31', '#a5a5a5'],
      }
    } = options
    
    try {
      // 读取文件为 Buffer
      const buffer = await fs.readFile(filePath)
      
      // 解析 PPTX
      const json = await parse(buffer)
      
      if (!json || !json.slides) {
        throw new Error('PPTX 文件格式无效或为空')
      }
      
      // 计算缩放比例（与前端逻辑一致）
      let ratio = 96 / 72
      const width = json.size?.width || 960  // 保留容错，但优先使用 json.size.width
      
      let viewportSize = undefined
      if (fixedViewport) {
        ratio = 1000 / width
        viewportSize = 1000
      } else {
        viewportSize = width * ratio
      }
      
      // 构建主题配置（与前端逻辑一致：使用 defaultTheme 并合并 json.themeColors）
      const theme = {
        ...defaultTheme,
        themeColors: json.themeColors || defaultTheme.themeColors,
      }
      
      // 构建形状列表（与前端逻辑一致）
      const shapeList = []
      for (const item of SHAPE_LIST) {
        shapeList.push(...item.children)
      }
      
      // 解析幻灯片
      const slides = []
      for (const item of json.slides) {
        const slide = this.parseSlide(item, ratio, theme, shapeList)
        slides.push(slide)
      }
      
      return {
        slides,
        theme,
        viewportSize
      }
      
    } catch (error) {
      console.error(`[PPTXService] 解析失败: ${filePath}`, error)
      throw new Error(`PPTX 解析失败: ${error.message}`)
    }
  }
  
  /**
   * 解析单个幻灯片
   * 
   * @param {Object} item - pptxtojson 解析的幻灯片数据
   * @param {number} ratio - 缩放比例
   * @param {Object} theme - 主题配置
   * @param {Array} shapeList - 形状列表（与前端逻辑一致）
   * @returns {Object} 解析后的幻灯片对象
   */
  parseSlide(item, ratio, theme, shapeList) {
    // 解析背景（与前端逻辑一致）
    const { type, value } = item.fill || {}
    let background
    
    if (type === 'image') {
      background = {
        type: 'image',
        image: {
          src: value.picBase64,
          size: 'cover',
        },
      }
    } else if (type === 'gradient') {
      background = {
        type: 'gradient',
          gradient: {
            type: value.path === 'line' ? 'linear' : 'radial',
            colors: (value.colors || []).map(item => ({
              ...item,
              pos: parseInt(item.pos) || 0,  // 与前端逻辑一致，但保留容错
            })),
            rotate: (value.rot || 0) + 90,  // 与前端逻辑一致，但保留容错
          },
      }
    }         else {
          background = {
            type: 'solid',
            color: value || '#fff',  // 与前端逻辑一致
          }
        }
    
    // 创建幻灯片对象
    const slide = {
      id: nanoid(10),
      elements: [],
      background,
      remark: item.note || '',
    }
    
    // 解析元素（与前端逻辑一致：处理 elements 和 layoutElements）
    const parseElements = (elements) => {
      if (!elements || !Array.isArray(elements)) return
      
      const sortedElements = elements.sort((a, b) => (a.order || 0) - (b.order || 0))
      
      for (const el of sortedElements) {
        const originWidth = el.width || 1
        const originHeight = el.height || 1
        const originLeft = el.left
        const originTop = el.top
        
        // 应用缩放
        el.width = (el.width || 0) * ratio
        el.height = (el.height || 0) * ratio
        el.left = (el.left || 0) * ratio
        el.top = (el.top || 0) * ratio
        
        const element = this.parseElement(el, ratio, theme, originWidth, originHeight, originLeft, originTop, parseElements, shapeList)
        if (element) {
          slide.elements.push(element)
        }
      }
    }
    
    // 处理 elements 和 layoutElements（与前端逻辑一致）
    parseElements([...(item.elements || []), ...(item.layoutElements || [])])
    
    return slide
  }
  
  /**
   * 解析元素（与前端逻辑保持一致）
   * 
   * @param {Object} el - 元素数据
   * @param {number} ratio - 缩放比例
   * @param {Object} theme - 主题配置
   * @param {number} originWidth - 原始宽度
   * @param {number} originHeight - 原始高度
   * @param {number} originLeft - 原始左边距
   * @param {number} originTop - 原始上边距
   * @param {Function} parseElements - 递归解析函数（用于 group 和 diagram）
   * @param {Array} shapeList - 形状列表（与前端逻辑一致）
   * @returns {Object|null} 解析后的元素对象
   */
  parseElement(el, ratio, theme, originWidth, originHeight, originLeft, originTop, parseElements, shapeList) {
    if (el.type === 'text') {
      const textEl = {
        type: 'text',
        id: nanoid(10),
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        rotate: el.rotate || 0,
        defaultFontName: theme.fontName,
        defaultColor: theme.fontColor,
        content: this.fixTextContentStyles(this.convertFontSizePtToPx(el.content || '', ratio)),
        lineHeight: 1,
        outline: {
          color: el.borderColor || '#000',  // 与前端逻辑一致，但保留默认值（后端需要容错）
          width: parseFloat((el.borderWidth * ratio || 0).toFixed(2)),
          style: el.borderType || 'solid'  // 与前端逻辑一致，但保留默认值（后端需要容错）
        },
        fill: el.fill?.type === 'color' ? el.fill.value : '',
        vertical: el.isVertical || false,
        name: el.name || '',
      }
      
      // 根据 name 推断 textType（识别标题、副标题等，与前端逻辑一致）
      if (el.name) {
        const nameLower = el.name.toLowerCase()
        // 英文标题：Title 1, Title 2, etc.
        // 中文标题：标题 1, 标题 2, etc.
        if ((nameLower.includes('title') || el.name.includes('标题')) && 
            !nameLower.includes('subtitle') && !el.name.includes('副标题')) {
          textEl.textType = 'title'
        } 
        // 英文副标题：Subtitle
        // 中文副标题：副标题
        else if (nameLower.includes('subtitle') || el.name.includes('副标题')) {
          textEl.textType = 'subtitle'
        } 
        // 英文正文：Content Placeholder, Text Placeholder
        // 中文正文：内容占位符, 文本占位符
        else if (nameLower.includes('content') || nameLower.includes('text') || 
                 el.name.includes('内容') || el.name.includes('文本')) {
          textEl.textType = 'content'
        }
      }
      
      if (el.shadow) {
        textEl.shadow = {
          h: el.shadow.h * ratio,
          v: el.shadow.v * ratio,
          blur: el.shadow.blur * ratio,
          color: el.shadow.color,
        }
      }
      
      return textEl
    }
    
    if (el.type === 'image') {
      const element = {
        type: 'image',
        id: nanoid(10),
        src: el.src || el.picBase64 || '',
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        fixedRatio: true,
        rotate: el.rotate || 0,
        flipH: el.isFlipH || false,
        flipV: el.isFlipV || false,
      }
      
      if (el.borderWidth) {
        element.outline = {
          color: el.borderColor || '#000',
          width: parseFloat((el.borderWidth * ratio).toFixed(2)),
          style: el.borderType || 'solid'
        }
      }
      
      // 处理图片裁剪（与前端逻辑一致）
      const clipShapeTypes = ['roundRect', 'ellipse', 'triangle', 'rhombus', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'parallelogram', 'trapezoid']
      if (el.rect) {
        element.clip = {
          shape: (el.geom && clipShapeTypes.includes(el.geom)) ? el.geom : 'rect',
          range: [
            [el.rect.l || 0, el.rect.t || 0],
            [100 - (el.rect.r || 0), 100 - (el.rect.b || 0)],
          ]
        }
      } else if (el.geom && clipShapeTypes.includes(el.geom)) {
        element.clip = {
          shape: el.geom,
          range: [[0, 0], [100, 100]]
        }
      }
      
      return element
    }
    
    if (el.type === 'math' && el.picBase64) {
      return {
        type: 'image',
        id: nanoid(10),
        src: el.picBase64,
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        fixedRatio: true,
        rotate: 0,
      }
    }
    
    if (el.type === 'audio') {
      return {
        type: 'audio',
        id: nanoid(10),
        src: el.blob,
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        rotate: 0,
        fixedRatio: false,
        color: theme.themeColors[0],
        loop: false,
        autoplay: false,
      }
    }
    
    if (el.type === 'video') {
      return {
        type: 'video',
        id: nanoid(10),
        src: el.blob || el.src,
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        rotate: 0,
        autoplay: false,
      }
    }
    
    if (el.type === 'shape') {
      // 处理线条类型（与前端逻辑一致）
      if (el.shapType === 'line' || /Connector/.test(el.shapType)) {
        return this.parseLineElement(el, ratio, theme.themeColors[0])
      }
      
      // 处理普通形状（与前端逻辑一致：使用 shapeList 查找预定义形状）
      const shape = shapeList.find(item => item.pptxShapeType === el.shapType)
      
      const vAlignMap = {
        'mid': 'middle',
        'down': 'bottom',
        'up': 'top',
      }
      
      const gradient = el.fill?.type === 'gradient' ? {
        type: el.fill.value.path === 'line' ? 'linear' : 'radial',
        colors: (el.fill.value.colors || []).map(item => ({
          ...item,
          pos: parseInt(item.pos) || 0,
        })),
        rotate: el.fill.value.rot || 0,
      } : undefined
      
      const pattern = el.fill?.type === 'image' ? el.fill.value.picBase64 : undefined
      const fill = el.fill?.type === 'color' ? el.fill.value : ''
      
      const element = {
        type: 'shape',
        id: nanoid(10),
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        viewBox: [200, 200],
        path: 'M 0 0 L 200 0 L 200 200 L 0 200 Z',
        fill,
        ...(gradient ? { gradient } : {}),
        ...(pattern ? { pattern } : {}),
        fixedRatio: false,
        rotate: el.rotate || 0,
        outline: {
          color: el.borderColor || '#000',
          width: el.borderWidth ? parseFloat((el.borderWidth * ratio).toFixed(2)) : 0,
          style: el.borderType || 'solid'
        },
        text: {
          content: this.fixTextContentStyles(this.convertFontSizePtToPx(el.content || '', ratio)),
          defaultFontName: theme.fontName,
          defaultColor: theme.fontColor,
          align: vAlignMap[el.vAlign] || 'middle',
        },
        flipH: el.isFlipH || false,
        flipV: el.isFlipV || false,
        name: el.name || '',
      }
      
      if (el.shadow) {
        element.shadow = {
          h: el.shadow.h * ratio,
          v: el.shadow.v * ratio,
          blur: el.shadow.blur * ratio,
          color: el.shadow.color,
        }
      }
      
      // 处理形状路径（与前端逻辑一致：优先使用 shapeList 中的预定义形状）
      if (shape) {
        element.path = shape.path
        element.viewBox = shape.viewBox
        
        if (shape.pathFormula) {
          element.pathFormula = shape.pathFormula
          element.viewBox = [el.width, el.height]
          
          const pathFormula = SHAPE_PATH_FORMULAS[shape.pathFormula]
          if (pathFormula && 'editable' in pathFormula && pathFormula.editable) {
            element.path = pathFormula.formula(el.width, el.height, pathFormula.defaultValue)
            element.keypoints = pathFormula.defaultValue
          } else if (pathFormula) {
            element.path = pathFormula.formula(el.width, el.height)
          }
        }
      } else if (el.path && el.path.indexOf('NaN') === -1) {
        const { maxX, maxY } = this.getSvgPathRange(el.path)
        element.path = el.path
        if ((maxX / maxY) > (originWidth / originHeight)) {
          element.viewBox = [maxX, maxX * originHeight / originWidth]
        } else {
          element.viewBox = [maxY * originWidth / originHeight, maxY]
        }
      }
      
      if (el.shapType === 'custom') {
        if (el.path && el.path.indexOf('NaN') !== -1) {
          if (element.width === 0) element.width = 0.1
          if (element.height === 0) element.height = 0.1
          element.path = el.path.replace(/NaN/g, '0')
        } else if (el.path) {
          element.special = true
          element.path = el.path
        }
        if (element.path) {
          const { maxX, maxY } = this.getSvgPathRange(element.path)
          if ((maxX / maxY) > (originWidth / originHeight)) {
            element.viewBox = [maxX, maxX * originHeight / originWidth]
          } else {
            element.viewBox = [maxY * originWidth / originHeight, maxY]
          }
        }
      }
      
      return element.path ? element : null
    }
    
    if (el.type === 'table') {
      // 表格解析逻辑（与前端逻辑一致：内联在 parseElement 中）
      const row = el.data?.length || 0
      const col = el.data?.[0]?.length || 0
      
      if (row === 0 || col === 0) return null
      
      const style = {
        fontname: theme.fontName,
        color: theme.fontColor,
      }
      
      const data = []
      for (let i = 0; i < row; i++) {
        const rowCells = []
        for (let j = 0; j < col; j++) {
          const cellData = el.data[i][j]
          if (!cellData) continue
          
          // 使用 cheerio 解析 HTML（替代前端的 document.createElement）
          const $ = cheerio.load(cellData.text || '')
          const p = $('p').first()
          const align = p.attr('style')?.match(/text-align:\s*(\w+)/)?.[1] || 'left'
          
          const span = $('span').first()
          const spanStyle = span.attr('style') || ''
          const fontsize = spanStyle.match(/font-size:\s*([\d.]+)px/)?.[1] 
            ? `${(parseFloat(spanStyle.match(/font-size:\s*([\d.]+)px/)[1]) * ratio).toFixed(1)}px`
            : ''
          const fontname = spanStyle.match(/font-family:\s*([^;]+)/)?.[1]?.trim() || ''
          const color = spanStyle.match(/color:\s*([^;]+)/)?.[1]?.trim() || cellData.fontColor || ''
          
          rowCells.push({
            id: nanoid(10),
            colspan: cellData.colSpan || 1,
            rowspan: cellData.rowSpan || 1,
            text: $.text() || '',
            style: {
              ...style,
              align: ['left', 'right', 'center'].includes(align) ? align : 'left',
              fontsize,
              fontname,
              color,
              bold: cellData.fontBold || false,
              backcolor: cellData.fillColor || '',
            },
          })
        }
        data.push(rowCells)
      }
      
      const allWidth = (el.colWidths || []).reduce((a, b) => a + b, 0)
      const colWidths = (el.colWidths || []).map(item => allWidth > 0 ? item / allWidth : 1 / col)  // 与前端逻辑一致，但保留容错
      
      const firstCell = el.data[0]?.[0]
      const border = firstCell?.borders?.top ||
        firstCell?.borders?.bottom ||
        el.borders?.top ||
        el.borders?.bottom ||
        firstCell?.borders?.left ||
        firstCell?.borders?.right ||
        el.borders?.left ||
        el.borders?.right
      const borderWidth = border?.borderWidth || 0
      const borderStyle = border?.borderType || 'solid'
      const borderColor = border?.borderColor || '#eeece1'
      
      return {
        type: 'table',
        id: nanoid(10),
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        colWidths,
        rotate: 0,
        data,
        outline: {
          width: parseFloat((borderWidth * ratio || 2).toFixed(2)),
          style: borderStyle,
          color: borderColor,
        },
        cellMinHeight: el.rowHeights?.[0] ? el.rowHeights[0] * ratio : 36,
      }
    }
    
    if (el.type === 'chart') {
      // 图表解析逻辑（与前端逻辑一致：内联在 parseElement 中）
      let labels = []
      let legends = []
      let series = []
      
      if (el.chartType === 'scatterChart' || el.chartType === 'bubbleChart') {
        labels = (el.data?.[0] || []).map((item, index) => `坐标${index + 1}`)
        legends = ['X', 'Y']
        series = el.data || []
      } else {
        const data = el.data || []
        if (data.length > 0 && data[0].xlabels) {
          labels = Object.values(data[0].xlabels)
          legends = data.map(item => item.key)
          series = data.map(item => (item.values || []).map(v => v.y))
        }
      }
      
      const options = {}
      
      let chartType = 'bar'
      
      switch (el.chartType) {
        case 'barChart':
        case 'bar3DChart':
          chartType = 'bar'
          if (el.barDir === 'bar') chartType = 'column'
          if (el.grouping === 'stacked' || el.grouping === 'percentStacked') options.stack = true
          break
        case 'lineChart':
        case 'line3DChart':
          if (el.grouping === 'stacked' || el.grouping === 'percentStacked') options.stack = true
          chartType = 'line'
          break
        case 'areaChart':
        case 'area3DChart':
          if (el.grouping === 'stacked' || el.grouping === 'percentStacked') options.stack = true
          chartType = 'area'
          break
        case 'scatterChart':
        case 'bubbleChart':
          chartType = 'scatter'
          break
        case 'pieChart':
        case 'pie3DChart':
          chartType = 'pie'
          break
        case 'radarChart':
          chartType = 'radar'
          break
        case 'doughnutChart':
          chartType = 'ring'
          break
        default:
      }
      
      return {
        type: 'chart',
        id: nanoid(10),
        chartType: chartType,
        width: el.width,
        height: el.height,
        left: el.left,
        top: el.top,
        rotate: 0,
        themeColors: (el.colors && el.colors.length > 0) ? el.colors : theme.themeColors,
        textColor: theme.fontColor,
        data: {
          labels,
          legends,
          series,
        },
        options,
      }
    }
    
    if (el.type === 'group') {
      // 递归解析组内元素（与前端逻辑一致）
      // 注意：group 元素不返回，而是直接通过 parseElements 递归解析
      let elements = (el.elements || []).map(_el => {
        let left = _el.left + originLeft
        let top = _el.top + originTop
        
        if (el.rotate) {
          const { x, y } = this.calculateRotatedPosition(originLeft, originTop, originWidth, originHeight, _el.left, _el.top, el.rotate)
          left = x
          top = y
        }
        
        const element = {
          ..._el,
          left,
          top,
        }
        if (el.isFlipH && 'isFlipH' in element) element.isFlipH = true
        if (el.isFlipV && 'isFlipV' in element) element.isFlipV = true
        
        return element
      })
      
      if (el.isFlipH) elements = this.flipGroupElements(elements, 'y')
      if (el.isFlipV) elements = this.flipGroupElements(elements, 'x')
      
      // 递归解析组内元素（直接调用 parseElements，不返回）
      parseElements(elements)
      return null // group 不返回元素，元素已通过 parseElements 添加到 slide
    }
    
    if (el.type === 'diagram') {
      // 递归解析图表元素（与前端逻辑一致）
      // 注意：diagram 元素不返回，而是直接通过 parseElements 递归解析
      const elements = (el.elements || []).map(_el => ({
        ..._el,
        left: _el.left + originLeft,
        top: _el.top + originTop,
      }))
      
      // 递归解析图表元素（直接调用 parseElements，不返回）
      parseElements(elements)
      return null // diagram 不返回元素，元素已通过 parseElements 添加到 slide
    }
    
    // 未知类型，返回 null（跳过）
    return null
  }
  
  /**
   * 解析线条元素（与前端逻辑一致）
   */
  parseLineElement(el, ratio, themeColor) {
    let start = [0, 0]
    let end = [0, 0]
    
    if (!el.isFlipV && !el.isFlipH) { // 右下
      start = [0, 0]
      end = [el.width, el.height]
    } else if (el.isFlipV && el.isFlipH) { // 左上
      start = [el.width, el.height]
      end = [0, 0]
    } else if (el.isFlipV && !el.isFlipH) { // 右上
      start = [0, el.height]
      end = [el.width, 0]
    } else { // 左下
      start = [el.width, 0]
      end = [0, el.height]
    }
    
      const data = {
      type: 'line',
      id: nanoid(10),
      width: parseFloat(((el.borderWidth || 1) * ratio).toFixed(2)),
      left: el.left,
      top: el.top,
      start,
      end,
      style: el.borderType || 'solid',  // 与前端逻辑一致，但保留默认值（后端需要容错）
      color: el.borderColor || themeColor,  // 与前端逻辑一致，但保留默认值（后端需要容错）
      points: ['', /straightConnector/.test(el.shapType) ? 'arrow' : '']
    }
    
    if (el.rotate) {
      const rotated = this.rotateLine(data, el.rotate)
      data.start = rotated.start
      data.end = rotated.end
      data.left = data.left + rotated.offset[0]
      data.top = data.top + rotated.offset[1]
    }
    
    if (/bentConnector/.test(el.shapType)) {
      data.broken2 = [
        Math.abs(data.start[0] - data.end[0]) / 2,
        Math.abs(data.start[1] - data.end[1]) / 2,
      ]
    }
    
    if (/curvedConnector/.test(el.shapType)) {
      const cubic = [
        Math.abs(data.start[0] - data.end[0]) / 2,
        Math.abs(data.start[1] - data.end[1]) / 2,
      ]
      data.cubic = [cubic, cubic]
    }
    
    return data
  }
  
  /**
   * 旋转线条元素（与前端逻辑一致）
   */
  rotateLine(line, angleDeg) {
    const { start, end } = line
    
    const angleRad = angleDeg * Math.PI / 180
    
    const midX = (start[0] + end[0]) / 2
    const midY = (start[1] + end[1]) / 2
    
    const startTransX = start[0] - midX
    const startTransY = start[1] - midY
    const endTransX = end[0] - midX
    const endTransY = end[1] - midY
    
    const cosA = Math.cos(angleRad)
    const sinA = Math.sin(angleRad)
    
    const startRotX = startTransX * cosA - startTransY * sinA
    const startRotY = startTransX * sinA + startTransY * cosA
    
    const endRotX = endTransX * cosA - endTransY * sinA
    const endRotY = endTransX * sinA + endTransY * cosA
    
    const startNewX = startRotX + midX
    const startNewY = startRotY + midY
    const endNewX = endRotX + midX
    const endNewY = endRotY + midY
    
    const beforeMinX = Math.min(start[0], end[0])
    const beforeMinY = Math.min(start[1], end[1])
    
    const afterMinX = Math.min(startNewX, endNewX)
    const afterMinY = Math.min(startNewY, endNewY)
    
    const startAdjustedX = startNewX - afterMinX
    const startAdjustedY = startNewY - afterMinY
    const endAdjustedX = endNewX - afterMinX
    const endAdjustedY = endNewY - afterMinY
    
    const startAdjusted = [startAdjustedX, startAdjustedY]
    const endAdjusted = [endAdjustedX, endAdjustedY]
    const offset = [afterMinX - beforeMinX, afterMinY - beforeMinY]
    
    return {
      start: startAdjusted,
      end: endAdjusted,
      offset,
    }
  }
  
  /**
   * 翻转组元素（与前端逻辑一致）
   */
  flipGroupElements(elements, axis) {
    const minX = Math.min(...elements.map(el => el.left))
    const maxX = Math.max(...elements.map(el => el.left + el.width))
    const minY = Math.min(...elements.map(el => el.top))
    const maxY = Math.max(...elements.map(el => el.top + el.height))
    
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    
    return elements.map(element => {
      const newElement = { ...element }
      
      if (axis === 'y') newElement.left = 2 * centerX - element.left - element.width
      if (axis === 'x') newElement.top = 2 * centerY - element.top - element.height
      
      return newElement
    })
  }
  
  /**
   * 计算旋转后的位置（与前端逻辑一致）
   */
  calculateRotatedPosition(x, y, w, h, ox, oy, k) {
    const radians = k * (Math.PI / 180)
    
    const containerCenterX = x + w / 2
    const containerCenterY = y + h / 2
    
    const relativeX = ox - w / 2
    const relativeY = oy - h / 2
    
    const rotatedX = relativeX * Math.cos(radians) + relativeY * Math.sin(radians)
    const rotatedY = -relativeX * Math.sin(radians) + relativeY * Math.cos(radians)
    
    const graphicX = containerCenterX + rotatedX
    const graphicY = containerCenterY + rotatedY
    
    return { x: graphicX, y: graphicY }
  }
  
  /**
   * 获取 SVG 路径范围（与前端逻辑一致）
   */
  getSvgPathRange(path) {
    try {
      const pathData = new SVGPathData(path)
      const xList = []
      const yList = []
      for (const item of pathData.commands) {
        const x = ('x' in item) ? item.x : 0
        const y = ('y' in item) ? item.y : 0
        xList.push(x)
        yList.push(y)
      }
      return {
        minX: Math.min(...xList),
        minY: Math.min(...yList),
        maxX: Math.max(...xList),
        maxY: Math.max(...yList),
      }
    } catch {
      return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
      }
    }
  }
  
  /**
   * 修复文本内容中的样式问题（与前端逻辑一致）
   * 1. 移除导致文字透明的 color: transparent
   * 2. 修复不完整的文字渐变效果
   */
  fixTextContentStyles(html) {
    if (!html) return html
    
    // 移除 color: transparent（这会导致文字完全不可见）
    html = html.replace(/color:\s*transparent;?/gi, '')
    
    // 修复文字渐变：如果有 background: linear-gradient 但没有 background-clip
    // 说明这是 pptxtojson 解析错误，应该提取渐变的主色作为文字颜色
    html = html.replace(
      /background:\s*linear-gradient\([^)]+#([0-9a-f]{6})[^)]*\)/gi,
      (match, firstColor) => {
        // 提取渐变中的第一个颜色作为文字颜色
        return `color: #${firstColor}`
      }
    )
    
    return html
  }
  
  /**
   * 将 pt 字体大小转换为 px（与前端逻辑一致）
   */
  convertFontSizePtToPx(html, ratio) {
    if (!html) return ''
    return html.replace(/font-size:\s*([\d.]+)pt/g, (match, p1) => {
      return `font-size: ${(parseFloat(p1) * ratio).toFixed(1)}px`
    })
  }
}

export default new PPTXService()
