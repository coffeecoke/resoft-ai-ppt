const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../../online-ppt-backend/data/documents/document_3.json')
const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

// 复制documentService中的提取函数
function extractTextFromSpan(htmlText) {
  const results = []
  const spanPattern = /<span[^>]*>([^<]*)<\/span>/g
  const regex = new RegExp(spanPattern)
  let match

  while ((match = regex.exec(htmlText)) !== null) {
    let text = match[1]
    text = text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
    if (text.trim()) {
      results.push(text.trim())
    }
  }
  return results
}

function extractTextFromSlide(slide) {
  if (!slide || !slide.elements || !Array.isArray(slide.elements)) {
    return ''
  }

  const texts = []

  for (const element of slide.elements) {
    if (!element) continue

    const elementType = element.type || 'unknown'

    // 处理表格元素（优先处理，避免与通用文本处理冲突）
    if (elementType === 'table' && element.data) {
      for (const row of element.data) {
        if (!Array.isArray(row)) continue
        
        for (const cell of row) {
          if (!cell) continue
          
          let cellText = ''
          
          // text 可能是字符串或对象
          if (typeof cell.text === 'string') {
            cellText = cell.text
          } else if (typeof cell.text === 'object' && cell.text.content) {
            cellText = cell.text.content
          }
          
          // 表格单元格的text通常是纯文本，直接添加
          if (cellText && cellText.trim() && cellText.trim() !== ' ') {
            texts.push(cellText.trim())
          }
        }
      }
      continue // 表格处理完毕
    }

    // 处理图表元素（标题和描述通常是纯文本）
    if (elementType === 'chart') {
      if (element.title) {
        texts.push(element.title)
      }
      if (element.description) {
        texts.push(element.description)
      }
      continue // 图表处理完毕，跳过后续通用文本处理
    }

    // 处理其他所有元素（text, shape, image等）- 尝试提取文本内容
    let textContent = ''

    // 方式1: 检查是否有 text 对象（结构1: element.text.content）
    if (element.text) {
      if (typeof element.text === 'object' && element.text.content) {
        textContent = element.text.content
      } else if (typeof element.text === 'string') {
        textContent = element.text
      }
    }
    // 方式2: 检查是否直接有 content 字段（结构2: element.content）
    else if (element.content) {
      textContent = element.content
    }

    // 从 HTML 内容中提取 <span> 标签内的文本
    if (textContent) {
      const extractedTexts = extractTextFromSpan(textContent)
      texts.push(...extractedTexts)
    }
  }

  // 合并所有文本，用空格分隔
  return texts.filter(t => t && t.trim()).join(' ')
}

// 测试第6页（索引5）
const slide = json.slides[5]
const result = extractTextFromSlide(slide)

console.log('=== 测试提取第6页 ===\n')
console.log('提取结果长度:', result.length)
console.log('\n提取结果（前400字符）:')
console.log(result.substring(0, 400))
console.log('\n完整内容:')
console.log(result)

