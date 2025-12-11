/**
 * 槽位提取服务
 * 
 * 从PPT模板JSON中提取所有文本槽位，用于方案D（模板填充）
 */

/**
 * 从HTML内容中提取纯文本
 * @param {string} htmlContent - HTML格式的文本内容
 * @returns {string} 纯文本
 */
function extractPlainText(htmlContent) {
  if (!htmlContent) return ''
  
  // 移除HTML标签，保留文本
  return htmlContent
    .replace(/<[^>]+>/g, '')  // 移除HTML标签
    .replace(/&nbsp;/g, ' ')   // 替换空格实体
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * 从单个元素中提取文本信息
 * @param {Object} element - PPT元素
 * @param {number} pageIndex - 页面索引
 * @param {string} pageType - 页面类型
 * @returns {Object|null} 槽位信息
 */
function extractSlotFromElement(element, pageIndex, pageType) {
  let content = null
  let textType = null
  
  // 文本元素
  if (element.type === 'text') {
    content = element.content
    textType = element.textType || 'content'
  }
  // 带文本的形状元素
  else if (element.type === 'shape' && element.text && element.text.content) {
    content = element.text.content
    textType = element.text.type || 'content'
  }
  
  if (!content) return null
  
  const plainText = extractPlainText(content)
  if (!plainText) return null
  
  return {
    id: element.id,
    pageIndex,
    pageType,
    elementType: element.type,
    textType,
    currentText: plainText,
    position: {
      left: element.left,
      top: element.top,
      width: element.width,
      height: element.height
    }
  }
}

/**
 * 从模板中提取所有文本槽位
 * @param {Array} slides - PPT模板的slides数组
 * @returns {Object} 包含槽位列表和结构摘要
 */
export function extractSlots(slides) {
  const slots = []
  const structure = []
  
  slides.forEach((slide, pageIndex) => {
    const pageType = slide.type || 'unknown'
    const pageSlots = []
    
    // 遍历页面中的所有元素
    if (slide.elements && Array.isArray(slide.elements)) {
      // 按位置排序（从上到下，从左到右）
      const sortedElements = [...slide.elements].sort((a, b) => {
        const aIndex = a.top * 2 + a.left
        const bIndex = b.top * 2 + b.left
        return aIndex - bIndex
      })
      
      sortedElements.forEach(element => {
        const slot = extractSlotFromElement(element, pageIndex, pageType)
        if (slot) {
          slots.push(slot)
          pageSlots.push({
            id: slot.id,
            textType: slot.textType,
            currentText: slot.currentText
          })
        }
      })
    }
    
    // 记录页面结构
    structure.push({
      pageIndex,
      pageType,
      slotCount: pageSlots.length,
      slots: pageSlots
    })
  })
  
  return {
    totalPages: slides.length,
    totalSlots: slots.length,
    structure,
    slots
  }
}

/**
 * 生成用于AI提示的结构描述
 * @param {Object} extractedData - extractSlots的返回值
 * @returns {string} 结构描述文本
 */
export function generateStructurePrompt(extractedData) {
  const { structure } = extractedData
  
  const lines = ['【模板结构】']
  
  structure.forEach(page => {
    const pageTypeName = getPageTypeName(page.pageType)
    lines.push(`\n第${page.pageIndex + 1}页（${pageTypeName}）：`)
    
    if (page.slots.length === 0) {
      lines.push('  - 无文本槽位')
    } else {
      page.slots.forEach((slot, idx) => {
        const typeName = getTextTypeName(slot.textType)
        lines.push(`  - slot_${slot.id}（${typeName}）: "${truncateText(slot.currentText, 20)}"`)
      })
    }
  })
  
  return lines.join('\n')
}

/**
 * 获取页面类型的中文名称
 */
function getPageTypeName(type) {
  const names = {
    'cover': '封面',
    'contents': '目录',
    'transition': '过渡页',
    'content': '内容页',
    'end': '结束页',
    'text_image': '图文页',
    'comparison': '对比页',
    'timeline': '时间线页',
    'statistics': '数据统计页',
    'quote': '引用页',
    'unknown': '未知类型'
  }
  return names[type] || type
}

/**
 * 获取文本类型的中文名称
 */
function getTextTypeName(type) {
  const names = {
    'title': '标题',
    'subtitle': '副标题',
    'content': '正文',
    'item': '列表项',
    'itemTitle': '列表项标题',
    'itemNumber': '项目编号',
    'partNumber': '节编号',
    'header': '页眉',
    'footer': '页脚',
    'notes': '注释',
    // 扩展类型
    'leftTitle': '左侧标题',
    'leftItem': '左侧内容',
    'rightTitle': '右侧标题',
    'rightItem': '右侧内容',
    'timeLabel': '时间标签',
    'statValue': '统计数值',
    'statLabel': '数值说明',
    'quote': '引用内容',
    'author': '作者',
    'authorTitle': '作者头衔'
  }
  return names[type] || type
}

/**
 * 截断文本
 */
function truncateText(text, maxLength) {
  if (!text) return ''
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

/**
 * 将AI生成的内容填充回模板
 * @param {Array} slides - 原始模板slides
 * @param {Object} contentMap - AI生成的内容映射 { slot_id: "新内容" }
 * @returns {Array} 填充后的slides
 */
export function fillTemplate(slides, contentMap) {
  // 深拷贝模板
  const filledSlides = JSON.parse(JSON.stringify(slides))
  
  filledSlides.forEach(slide => {
    if (!slide.elements) return
    
    slide.elements.forEach(element => {
      const newContent = contentMap[element.id]
      if (newContent === undefined) return
      
      // 文本元素
      if (element.type === 'text' && element.content) {
        element.content = replaceTextContent(element.content, newContent)
      }
      // 带文本的形状元素
      else if (element.type === 'shape' && element.text && element.text.content) {
        element.text.content = replaceTextContent(element.text.content, newContent)
      }
    })
  })
  
  return filledSlides
}

/**
 * 替换HTML内容中的文本，保留样式
 * @param {string} htmlContent - 原始HTML内容
 * @param {string} newText - 新的纯文本
 * @returns {string} 替换后的HTML
 */
function replaceTextContent(htmlContent, newText) {
  if (!htmlContent || !newText) return htmlContent
  
  // 使用正则匹配并替换文本内容，保留HTML结构
  // 简单实现：找到第一个文本节点位置，替换整个内容
  
  // 策略：保留第一个<p>标签的样式，替换其中的文本
  const pMatch = htmlContent.match(/<p[^>]*>/)
  const spanMatch = htmlContent.match(/<span[^>]*>/)
  
  if (pMatch && spanMatch) {
    // 有完整的<p><span>结构，提取样式并重建
    const pTag = pMatch[0]
    const spanTag = spanMatch[0]
    return `${pTag}${spanTag}${escapeHtml(newText)}</span></p>`
  } else if (pMatch) {
    // 只有<p>标签
    const pTag = pMatch[0]
    return `${pTag}${escapeHtml(newText)}</p>`
  } else {
    // 没有标签，直接返回文本
    return escapeHtml(newText)
  }
}

/**
 * HTML转义
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default {
  extractSlots,
  generateStructurePrompt,
  fillTemplate
}
