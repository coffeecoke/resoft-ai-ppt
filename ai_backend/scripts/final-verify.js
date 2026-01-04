const path = require('path')
const fs = require('fs')
const { PrismaClient } = require(path.join(__dirname, '../../online-ppt-backend/node_modules/.prisma/client'))

const prisma = new PrismaClient()

async function finalVerify() {
  console.log('=== 最终验证：document_3 提取完整性 ===\n')
  
  const mergedFile = path.join(__dirname, '../output/document_3_test_merged.txt')
  const mergedContent = fs.readFileSync(mergedFile, 'utf-8')
  const mergedLines = mergedContent.split('\n').filter(line => line.trim() && !line.startsWith('='))
  
  const dbRows = await prisma.slide_merged_contents.findMany({
    where: { document_id: 'document_3' },
    orderBy: { slide_order: 'asc' }
  })
  
  console.log(`✓ Merged文件数据行数: ${mergedLines.length - 1}`) // 减去表头
  console.log(`✓ 数据库记录数: ${dbRows.length}\n`)
  
  let matchCount = 0
  let closeMatchCount = 0
  let mismatchCount = 0
  
  for (let i = 0; i < Math.min(48, dbRows.length); i++) {
    const dbRow = dbRows[i]
    const mergedLine = mergedLines[i + 1] // 跳过表头
    
    if (!mergedLine) {
      console.log(`❌ 第${i+1}页：merged文件中无对应行`)
      mismatchCount++
      continue
    }
    
    const mergedText = mergedLine.split('\t')[2]
    const dbText = dbRow.merged_content
    
    if (!mergedText || !dbText) {
      console.log(`❌ 第${i+1}页：数据为空`)
      mismatchCount++
      continue
    }
    
    const first100Match = mergedText.substring(0, 100) === dbText.substring(0, 100)
    const lengthDiff = Math.abs(mergedText.length - dbText.length)
    
    if (first100Match && lengthDiff === 0) {
      matchCount++
    } else if (first100Match && lengthDiff < 5) {
      closeMatchCount++
      console.log(`⚠️  第${i+1}页：接近匹配（长度差异${lengthDiff}）`)
    } else {
      mismatchCount++
      console.log(`❌ 第${i+1}页：不匹配`)
      console.log(`   长度: merged=${mergedText.length}, db=${dbText.length}`)
      console.log(`   merged前50: ${mergedText.substring(0, 50)}`)
      console.log(`   db前50: ${dbText.substring(0, 50)}`)
    }
  }
  
  console.log(`\n=== 最终统计 ===`)
  console.log(`✅ 完全匹配: ${matchCount}`)
  console.log(`⚠️  接近匹配: ${closeMatchCount}`)
  console.log(`❌ 不匹配: ${mismatchCount}`)
  console.log(`总匹配率: ${((matchCount + closeMatchCount) / (matchCount + closeMatchCount + mismatchCount) * 100).toFixed(1)}%`)
  
  if (matchCount + closeMatchCount === 48 && mismatchCount === 0) {
    console.log('\n🎉 恭喜！所有页面提取完全正确！')
  } else {
    console.log('\n⚠️  存在不匹配的页面，需要进一步检查。')
  }
  
  await prisma.$disconnect()
}

finalVerify().catch(console.error)

