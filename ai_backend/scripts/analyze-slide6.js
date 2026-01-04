const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../../online-ppt-backend/data/documents/document_3.json')
const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

// 查找第6页（索引5）
const slide = json.slides[5]

console.log('=== 第6页结构分析 ===\n')
console.log(`slide_id: ${slide.id}`)
console.log(`元素数量: ${slide.elements.length}\n`)

// 分析每个元素
slide.elements.forEach((element, index) => {
  console.log(`--- 元素 ${index + 1} ---`)
  console.log(`type: ${element.type}`)
  console.log(`id: ${element.id}`)
  
  if (element.type === 'text') {
    if (element.content) {
      console.log(`有 content 字段，长度: ${element.content.length}`)
      console.log(`content 前100字符:`, element.content.substring(0, 100))
    }
    if (element.text) {
      console.log(`有 text 字段，类型: ${typeof element.text}`)
      if (typeof element.text === 'object') {
        console.log(`text.content 存在: ${!!element.text.content}`)
        if (element.text.content) {
          console.log(`text.content 前100字符:`, element.text.content.substring(0, 100))
        }
      }
    }
  }
  
  if (element.type === 'table') {
    console.log(`表格，行数: ${element.data.length}`)
    if (element.data.length > 0) {
      console.log(`第一行单元格数: ${element.data[0].length}`)
      if (element.data[0][0]) {
        console.log(`第一个单元格:`, element.data[0][0])
      }
    }
  }
  
  console.log('')
})

