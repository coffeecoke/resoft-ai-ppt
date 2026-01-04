const path = require('path')
const fs = require('fs')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function compareWithMerged() {
  console.log('=== 对比数据库提取结果与 merged 文件 ===\n')
  
  // 读取 merged 文件（第5页，包含表格）
  const mergedFile = path.join(__dirname, '../output/2026-01-03/document_9_2026-01-03T03-22-38_merged.txt')
  const mergedContent = fs.readFileSync(mergedFile, 'utf-8')
  const mergedLines = mergedContent.split('\n').filter(line => !line.startsWith('=') && line.trim())
  
  // 找到第5页（包含表格的那一页）
  const page5Line = mergedLines.find(line => line.includes('金数 规范制定 统筹管理'))
  const mergedPage5Text = page5Line ? page5Line.split('\t')[2] : null
  
  // 从数据库查询第5页
  const dbRow = await prisma.slide_merged_contents.findFirst({
    where: { 
      document_id: 'document_9',
      slide_order: 5
    }
  })
  
  console.log('--- Merged 文件第5页（前300字符）---')
  console.log(mergedPage5Text ? mergedPage5Text.substring(0, 300) : '未找到')
  console.log('\n--- 数据库第5页（前300字符）---')
  console.log(dbRow ? dbRow.merged_content.substring(0, 300) : '未找到')
  console.log('\n--- 对比结果 ---')
  
  if (mergedPage5Text && dbRow) {
    // 简单对比前100个字符
    const merged100 = mergedPage5Text.substring(0, 100)
    const db100 = dbRow.merged_content.substring(0, 100)
    
    console.log('前100字符是否一致:', merged100 === db100)
    console.log('包含表格内容（"金数 规范制定"）:', dbRow.merged_content.includes('金数 规范制定'))
    console.log('包含HTML标签:', dbRow.merged_content.includes('<'))
  }

  await prisma.$disconnect()
  process.exit(0)
}

compareWithMerged().catch(console.error)

