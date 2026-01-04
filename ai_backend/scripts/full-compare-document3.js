const path = require('path')
const fs = require('fs')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function fullCompare() {
  console.log('=== 完整对比 document_3 提取结果 ===\n')
  
  // 读取merged文件
  const mergedFile = path.join(__dirname, '../output/document_3_test_merged.txt')
  const mergedContent = fs.readFileSync(mergedFile, 'utf-8')
  const mergedLines = mergedContent.split('\n').filter(line => !line.startsWith('=') && line.trim())
  
  // 从数据库查询所有页
  const dbRows = await prisma.slide_merged_contents.findMany({
    where: { document_id: 'document_3' },
    orderBy: { slide_order: 'asc' }
  })
  
  console.log(`Merged文件总行数: ${mergedLines.length}`)
  console.log(`数据库记录数: ${dbRows.length}\n`)
  
  let matchCount = 0
  let mismatchCount = 0
  
  for (let i = 0; i < Math.min(10, dbRows.length); i++) { // 测试前10页
    const dbRow = dbRows[i]
    const mergedLine = mergedLines[i + 2] // 跳过表头和分隔线
    
    if (!mergedLine) {
      console.log(`⚠️ 第${i+1}页：merged文件中无对应行`)
      continue
    }
    
    const mergedText = mergedLine.split('\t')[2]
    const dbText = dbRow.merged_content
    
    const first100Match = mergedText.substring(0, 100) === dbText.substring(0, 100)
    const lengthMatch = Math.abs(mergedText.length - dbText.length) < 5
    
    if (first100Match && lengthMatch) {
      matchCount++
      console.log(`✅ 第${i+1}页匹配 (长度: merged=${mergedText.length}, db=${dbText.length})`)
    } else {
      mismatchCount++
      console.log(`❌ 第${i+1}页不匹配`)
      console.log(`   长度: merged=${mergedText.length}, db=${dbText.length}`)
      console.log(`   merged前50: ${mergedText.substring(0, 50)}`)
      console.log(`   db前50: ${dbText.substring(0, 50)}`)
    }
  }
  
  console.log(`\n=== 统计 ===`)
  console.log(`匹配: ${matchCount}`)
  console.log(`不匹配: ${mismatchCount}`)
  console.log(`匹配率: ${(matchCount / (matchCount + mismatchCount) * 100).toFixed(1)}%`)
  
  await prisma.$disconnect()
}

fullCompare().catch(console.error)

