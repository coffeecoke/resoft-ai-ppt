const path = require('path')
const fs = require('fs')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function compareDocument3() {
  console.log('=== 对比 document_3 提取结果 ===\n')
  
  // 读取 merged 文件
  const mergedFile = path.join(__dirname, '../output/document_3_test_merged.txt')
  const mergedContent = fs.readFileSync(mergedFile, 'utf-8')
  const mergedLines = mergedContent.split('\n').filter(line => !line.startsWith('=') && line.trim())
  
  // 从数据库查询第6页（line 7，包含大表格）
  const dbRow = await prisma.slide_merged_contents.findFirst({
    where: { 
      document_id: 'document_3',
      slide_order: 6
    }
  })
  
  // 找到merged文件第6页
  const mergedLine = mergedLines[6] // 第7行（索引6）
  const mergedText = mergedLine ? mergedLine.split('\t')[2] : null
  
  console.log('--- Merged 文件第6页（前300字符）---')
  console.log(mergedText ? mergedText.substring(0, 300) : '未找到')
  console.log(`\n内容长度: ${mergedText ? mergedText.length : 0}`)
  
  console.log('\n--- 数据库第6页（前300字符）---')
  console.log(dbRow ? dbRow.merged_content.substring(0, 300) : '未找到')
  console.log(`内容长度: ${dbRow ? dbRow.content_length : 0}`)
  
  console.log('\n--- 对比结果 ---')
  
  if (mergedText && dbRow) {
    const merged300 = mergedText.substring(0, 300)
    const db300 = dbRow.merged_content.substring(0, 300)
    
    console.log('前300字符是否完全一致:', merged300 === db300)
    console.log('长度差异:', Math.abs(mergedText.length - dbRow.content_length))
    console.log('包含表格开头（"100%"）:', dbRow.merged_content.includes('100%'))
    console.log('包含表格内容（"RESOFT"）:', dbRow.merged_content.includes('RESOFT'))
    console.log('包含HTML标签:', dbRow.merged_content.includes('<'))
    
    if (merged300 !== db300) {
      console.log('\n⚠️ 内容不一致！')
      console.log('\nMerged 前100字符:', mergedText.substring(0, 100))
      console.log('\n数据库前100字符:', dbRow.merged_content.substring(0, 100))
    }
  }

  await prisma.$disconnect()
  process.exit(0)
}

compareDocument3().catch(console.error)

