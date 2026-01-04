/**
 * 文档文本提取器测试脚本
 * 用于验证提取功能是否正常工作
 */

const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const path = require('path')

/**
 * 测试用例
 */
async function runTests() {
  console.log('='.repeat(60))
  console.log('文档文本提取器 - 测试套件')
  console.log('='.repeat(60))
  
  const testCases = [
    {
      name: '测试 1: 标准 JSON 格式 (document_1.json)',
      input: '../online-ppt-backend/data/documents/document_1.json',
      output: './output/test_document_1.txt',
      description: '测试标准格式的 JSON 文档'
    },
    {
      name: '测试 2: 其他文档格式 (document_4.json)',
      input: '../online-ppt-backend/data/documents/document_4.json',
      output: './output/test_document_4.txt',
      description: '测试不同结构的 JSON 文档'
    },
    {
      name: '测试 3: 另一个文档 (document_7.json)',
      input: '../online-ppt-backend/data/documents/document_7.json',
      output: './output/test_document_7.txt',
      description: '测试第三个文档'
    }
  ]
  
  const extractor = new DocumentTextExtractor()
  let passedTests = 0
  let failedTests = 0
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\n[${i + 1}/${testCases.length}] ${testCase.name}`)
    console.log(`描述: ${testCase.description}`)
    console.log('-'.repeat(60))
    
    try {
      const inputFile = path.join(__dirname, testCase.input)
      const outputFile = path.join(__dirname, testCase.output)
      
      await extractor.run(inputFile, outputFile)
      
      console.log('✓ 测试通过')
      passedTests++
      
    } catch (error) {
      console.error('✗ 测试失败:', error.message)
      failedTests++
    }
  }
  
  // 输出测试汇总
  console.log('\n' + '='.repeat(60))
  console.log('测试汇总')
  console.log('='.repeat(60))
  console.log(`✓ 通过: ${passedTests}/${testCases.length}`)
  console.log(`✗ 失败: ${failedTests}/${testCases.length}`)
  
  if (failedTests === 0) {
    console.log('\n🎉 所有测试通过!')
  } else {
    console.log('\n⚠️  部分测试失败，请检查错误信息')
  }
}

// 运行测试
runTests()

