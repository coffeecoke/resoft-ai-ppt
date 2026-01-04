const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '../../online-ppt-backend/data/documents/document_9.json')
const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'))

// 查找第一个表格元素
for (const slide of json.slides) {
  for (const element of slide.elements) {
    if (element.type === 'table' && element.data) {
      console.log('找到表格元素！')
      console.log('表格第一行第一个单元格：')
      const firstCell = element.data[0][0]
      console.log('cell 结构:', JSON.stringify(firstCell, null, 2))
      
      if (firstCell.text) {
        console.log('\ncell.text 类型:', typeof firstCell.text)
        console.log('cell.text 内容（前200字符）:')
        if (typeof firstCell.text === 'string') {
          console.log(firstCell.text.substring(0, 200))
        } else {
          console.log(JSON.stringify(firstCell.text).substring(0, 200))
        }
      }
      
      process.exit(0)
    }
  }
}

console.log('未找到表格元素')

