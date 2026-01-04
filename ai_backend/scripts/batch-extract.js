/**
 * 批量文档文本提取脚本
 * 批量处理 documents 目录下的所有 JSON 文件
 */

const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const fs = require('fs').promises
const path = require('path')

/**
 * 批量提取文档文本
 */
async function batchExtract() {
  try {
    console.log('='.repeat(60))
    console.log('批量文档文本提取工具')
    console.log('='.repeat(60))
    
    const extractor = new DocumentTextExtractor()
    
    // 配置路径
    const documentsDir = path.join(__dirname, '../online-ppt-backend/data/documents')
    const outputDir = path.join(__dirname, 'output')
    
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true })
    
    // 读取所有 JSON 文件
    console.log(`\n正在扫描目录: ${documentsDir}`)
    const files = await fs.readdir(documentsDir)
    const jsonFiles = files.filter(f => f.startsWith('document_') && f.endsWith('.json'))
    
    console.log(`找到 ${jsonFiles.length} 个文档文件`)
    
    if (jsonFiles.length === 0) {
      console.log('没有找到需要处理的文件')
      return
    }
    
    // 统计信息
    let successCount = 0
    let failedCount = 0
    const failedFiles = []
    
    // 逐个处理文件
    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i]
      console.log(`\n[${i + 1}/${jsonFiles.length}] 处理: ${file}`)
      console.log('-'.repeat(60))
      
      const inputFile = path.join(documentsDir, file)
      const outputFile = path.join(outputDir, file.replace('.json', '.txt'))
      
      try {
        await extractor.run(inputFile, outputFile)
        successCount++
      } catch (error) {
        console.error(`❌ 处理失败: ${error.message}`)
        failedCount++
        failedFiles.push({ file, error: error.message })
      }
    }
    
    // 输出汇总信息
    console.log('\n' + '='.repeat(60))
    console.log('批量处理汇总')
    console.log('='.repeat(60))
    console.log(`✓ 成功: ${successCount} 个文件`)
    console.log(`✗ 失败: ${failedCount} 个文件`)
    console.log(`总计: ${jsonFiles.length} 个文件`)
    
    if (failedFiles.length > 0) {
      console.log('\n失败文件列表:')
      failedFiles.forEach(({ file, error }) => {
        console.log(`  - ${file}: ${error}`)
      })
    }
    
    console.log('\n✓ 批量处理完成!')
    console.log(`输出目录: ${outputDir}`)
    
  } catch (error) {
    console.error('❌ 批量处理过程中出错:', error.message)
    process.exit(1)
  }
}

// 运行批量提取
batchExtract()

