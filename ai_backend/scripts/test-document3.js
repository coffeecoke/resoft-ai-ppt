/**
 * 测试提取 document_3.json
 */

const { DocumentTextExtractor } = require('./DocumentTextExtractor')
const path = require('path')

async function testDocument3() {
  console.log('='.repeat(60))
  console.log('测试提取 document_3.json')
  console.log('='.repeat(60))
  
  try {
    const extractor = new DocumentTextExtractor()
    
    // 使用绝对路径
    const inputFile = 'E:\\ppt文件\\产品PPT\\产品PPT\\document_3.json'
    const outputFile = path.join(__dirname, 'output', 'document_3_test.txt')
    const outputMergedFile = path.join(__dirname, 'output', 'document_3_test_merged.txt')
    
    console.log(`\n输入文件: ${inputFile}`)
    console.log(`输出文件: ${outputFile}`)
    console.log(`拼接版输出: ${outputMergedFile}\n`)
    
    // 运行提取
    await extractor.run(inputFile, outputFile)
    
    console.log('\n✅ 提取成功！')
    console.log('\n查看结果：')
    console.log(`  详细版: ${outputFile}`)
    console.log(`  拼接版: ${outputMergedFile}`)
    
  } catch (error) {
    console.error('\n❌ 提取失败:', error.message)
    console.error('错误详情:', error)
    process.exit(1)
  }
}

// 运行测试
testDocument3()

