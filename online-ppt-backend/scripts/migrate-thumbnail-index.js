/**
 * 缩略图索引迁移脚本
 * 将全局索引文件 thumbnails/index.json 拆分为每个文档独立的索引文件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'data')
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails')
const OLD_INDEX_FILE = path.join(THUMBNAILS_DIR, 'index.json')
const MAIN_INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

console.log('========================================')
console.log('缩略图索引迁移脚本')
console.log('========================================\n')

// 检查旧索引文件是否存在
if (!fs.existsSync(OLD_INDEX_FILE)) {
  console.log('❌ 旧索引文件不存在:', OLD_INDEX_FILE)
  console.log('迁移终止。')
  process.exit(1)
}

// 读取旧索引文件
console.log('📖 读取旧索引文件...')
const oldIndexContent = fs.readFileSync(OLD_INDEX_FILE, 'utf-8')
const oldIndex = JSON.parse(oldIndexContent)

console.log(`   找到 ${oldIndex.thumbnails.length} 个缩略图记录\n`)

// 按文档ID分组
console.log('📦 按文档ID分组缩略图...')
const groupedByDocument = {}

oldIndex.thumbnails.forEach(thumbnail => {
  const docId = thumbnail.documentId
  
  if (!groupedByDocument[docId]) {
    groupedByDocument[docId] = {
      documentId: docId,
      documentTitle: thumbnail.documentTitle || '未命名文档',
      thumbnails: []
    }
  }
  
  // 移除 documentId 和 documentTitle 字段（这些信息在文档级别）
  const { documentId, documentTitle, ...thumbnailData } = thumbnail
  groupedByDocument[docId].thumbnails.push(thumbnailData)
})

const documentIds = Object.keys(groupedByDocument)
console.log(`   共涉及 ${documentIds.length} 个文档\n`)

// 为每个文档创建独立的索引文件
console.log('💾 创建独立索引文件...')
let successCount = 0
let errorCount = 0

documentIds.forEach(docId => {
  try {
    const docIndexPath = path.join(THUMBNAILS_DIR, `${docId}.json`)
    const docIndexData = {
      ...groupedByDocument[docId],
      lastUpdated: new Date().toISOString()
    }
    
    fs.writeFileSync(docIndexPath, JSON.stringify(docIndexData, null, 2), 'utf-8')
    console.log(`   ✅ ${docId}.json - ${docIndexData.thumbnails.length} 个缩略图`)
    successCount++
  } catch (error) {
    console.error(`   ❌ ${docId}.json - 失败:`, error.message)
    errorCount++
  }
})

console.log('')

// 更新主表索引
console.log('📝 更新主表索引...')
if (fs.existsSync(MAIN_INDEX_FILE)) {
  try {
    const mainIndexContent = fs.readFileSync(MAIN_INDEX_FILE, 'utf-8')
    const mainIndex = JSON.parse(mainIndexContent)
    
    let updatedCount = 0
    mainIndex.forEach(doc => {
      if (groupedByDocument[doc.id]) {
        doc.thumbnailIndexPath = `thumbnails/${doc.id}.json`
        doc.thumbnailCount = groupedByDocument[doc.id].thumbnails.length
        doc.thumbnailsLastUpdated = new Date().toISOString()
        updatedCount++
      }
    })
    
    fs.writeFileSync(MAIN_INDEX_FILE, JSON.stringify(mainIndex, null, 2), 'utf-8')
    console.log(`   ✅ 更新了 ${updatedCount} 个文档的主表记录\n`)
  } catch (error) {
    console.error('   ❌ 更新主表失败:', error.message, '\n')
  }
} else {
  console.log('   ⚠️  主表文件不存在，跳过更新\n')
}

// 备份旧索引文件
console.log('💼 备份旧索引文件...')
const backupPath = path.join(THUMBNAILS_DIR, `index.json.backup.${Date.now()}`)
try {
  fs.copyFileSync(OLD_INDEX_FILE, backupPath)
  console.log(`   ✅ 备份到: ${backupPath}\n`)
} catch (error) {
  console.error('   ❌ 备份失败:', error.message, '\n')
}

// 总结
console.log('========================================')
console.log('迁移完成')
console.log('========================================')
console.log(`✅ 成功: ${successCount} 个文档`)
console.log(`❌ 失败: ${errorCount} 个文档`)
console.log(`📦 总缩略图数: ${oldIndex.thumbnails.length}`)
console.log('')
console.log('⚠️  注意: 旧索引文件已备份，但未删除')
console.log('   请手动验证迁移结果后删除旧文件:')
console.log(`   ${OLD_INDEX_FILE}`)
console.log('========================================')



