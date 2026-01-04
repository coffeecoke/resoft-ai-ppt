/**
 * 测试脚本：测试文档提取功能
 * 
 * 用法：
 * node scripts/test-document-extract.js [document_id]
 * 
 * 示例：
 * node scripts/test-document-extract.js document_1
 */

const documentService = require('../server/services/documentService')

async function testExtract() {
  const documentId = process.argv[2] || 'document_1'
  
  console.log('='.repeat(60))
  console.log('测试文档提取功能')
  console.log('='.repeat(60))
  console.log(`文档ID: ${documentId}`)
  console.log('')

  try {
    // 1. 检查文档是否存在
    console.log('步骤 1: 检查文档是否存在...')
    const exists = await documentService.checkDocumentExists(documentId)
    
    if (!exists) {
      console.error(`❌ 文档不存在: ${documentId}`)
      process.exit(1)
    }
    console.log('✅ 文档存在')
    console.log('')

    // 2. 检查提取状态
    console.log('步骤 2: 检查提取状态...')
    const status = await documentService.checkExtractStatus(documentId)
    console.log(`  - 是否已提取: ${status.isExtracted ? '是' : '否'}`)
    console.log(`  - 已提取数量: ${status.count}`)
    if (status.lastExtractedAt) {
      console.log(`  - 最后提取时间: ${status.lastExtractedAt}`)
    }
    console.log('')

    // 3. 执行提取（如果已提取，则跳过；除非使用 --force 参数）
    const force = process.argv.includes('--force')
    
    if (status.isExtracted && !force) {
      console.log('⚠️  文档已提取，跳过提取。如需重新提取，请使用 --force 参数')
      console.log('')
      console.log('='.repeat(60))
      process.exit(0)
    }

    console.log(`步骤 3: 开始提取文档${force ? '（强制）' : ''}...`)
    const result = await documentService.extractAndSave(documentId, 'manual', force)
    
    console.log('')
    console.log('✅ 提取完成！')
    console.log('='.repeat(60))
    console.log('提取结果:')
    console.log(`  - 文档ID: ${result.document_id}`)
    console.log(`  - 文档名称: ${result.document_name}`)
    console.log(`  - 总页数: ${result.total_slides}`)
    console.log(`  - 成功提取: ${result.extracted_count} 页`)
    console.log(`  - 跳过: ${result.failed_count} 页`)
    console.log(`  - 状态: ${result.status}`)
    console.log(`  - 说明: ${result.message}`)
    console.log('='.repeat(60))

  } catch (error) {
    console.error('')
    console.error('❌ 提取失败:', error.message)
    console.error('='.repeat(60))
    if (process.env.DEBUG) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

// 运行测试
testExtract().then(() => {
  console.log('\n测试完成，进程即将退出...')
  process.exit(0)
}).catch((error) => {
  console.error('\n测试失败:', error)
  process.exit(1)
})

