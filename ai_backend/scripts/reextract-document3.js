const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const path = require('path')

const extractor = new DocumentTextExtractor()

const inputFile = path.join(__dirname, '../../online-ppt-backend/data/documents/document_3.json')
const outputFile = path.join(__dirname, '../output/document_3_reextract.txt')
const mergedFile = path.join(__dirname, '../output/document_3_reextract_merged.txt')

console.log('开始提取document_3...')
extractor.extractText(inputFile, outputFile)
  .then(() => {
    console.log('\n提取完成！')
    console.log('详细输出:', outputFile)
    console.log('合并输出:', mergedFile)
  })
  .catch(err => {
    console.error('提取失败:', err)
  })

