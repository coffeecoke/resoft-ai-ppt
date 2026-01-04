const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../../online-ppt-backend/data/documents/document_3.json')
const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

// 查找第6页（索引5）的第18个元素
const slide = json.slides[5]
const element18 = slide.elements[17] // 索引17

console.log('=== 元素18完整内容 ===\n')
console.log('type:', element18.type)
console.log('id:', element18.id)
console.log('\ncontent字段（前800字符）:')
console.log(element18.content.substring(0, 800))

// 测试我们的extractTextFromSpan函数
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

const extractedText = extractTextFromSpan(element18.content)
console.log('\n--- 提取的文本数组 ---')
extractedText.forEach((text, i) => {
  console.log(`[${i + 1}] ${text}`)
})

console.log('\n--- 拼接结果（前300字符）---')
console.log(extractedText.join(' ').substring(0, 300))

