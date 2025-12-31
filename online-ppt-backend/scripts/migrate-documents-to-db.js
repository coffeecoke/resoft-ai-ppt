import pkg from '@prisma/client'
const { PrismaClient } = pkg
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
  console.log('✅ 已加载 .env 文件')
} else {
  console.warn('⚠️  .env 文件不存在，尝试从环境变量读取')
}

// 检查 DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL 环境变量未设置')
  console.error('请创建 .env 文件并设置 DATABASE_URL，例如：')
  console.error('DATABASE_URL="mysql://aippt_user:123456@localhost:3306/aippt_db"')
  process.exit(1)
}

console.log('📊 数据库连接:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'))

// 初始化 Prisma Client
// 注意：Prisma 7.2.0 需要 adapter，但 MySQL adapter 尚未发布
// 临时解决方案：使用环境变量 DATABASE_URL，Prisma 会自动处理
// 如果仍然报错，建议降级到 Prisma 6.x
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

const DATA_DIR = path.join(__dirname, '..', 'data')

async function migrate() {
  console.log('🚀 开始迁移文档数据到数据库...\n')
  
  // 读取 document-index.json
  const indexPath = path.join(DATA_DIR, 'document-index.json')
  
  if (!fs.existsSync(indexPath)) {
    console.error('❌ document-index.json 文件不存在')
    process.exit(1)
  }
  
  const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  console.log(`📄 找到 ${indexData.length} 个文档需要迁移\n`)
  
  let successCount = 0
  let errorCount = 0
  let thumbnailTotalCount = 0
  
  for (let i = 0; i < indexData.length; i++) {
    const doc = indexData[i]
    console.log(`[${i + 1}/${indexData.length}] 处理文档: ${doc.id} - ${doc.name}`)
    
    try {
      // 检查是否已存在
      const existing = await prisma.document.findUnique({
        where: { id: doc.id }
      })
      
      if (existing) {
        console.log(`  ⚠️  文档已存在，跳过`)
        continue
      }
      
      // 确保内容文件存在
      const contentFilePath = `documents/${doc.id}.json`
      const contentPath = path.join(DATA_DIR, contentFilePath)
      
      if (!fs.existsSync(contentPath)) {
        console.warn(`  ⚠️  内容文件不存在: ${contentFilePath}`)
        errorCount++
        continue
      }
      
      // 插入到数据库
      // 注意：thumbnailIndexPath, thumbnailCount, thumbnailsLastUpdated 不在 schema 中，已移除
      await prisma.document.create({
        data: {
          id: doc.id,
          name: doc.name,
          cover: doc.cover || null,
          category: doc.category || 'uncategorized',
          status: doc.status || 'draft',
          tag: doc.tag || 'public',
          contentFilePath,
          slideCount: doc.slideCount || 0,
          fileSize: BigInt(doc.fileSize || 0),
          customerName: doc.customerName || null,
          product: doc.product || null,
          industry: doc.industry || null,
          audience: doc.audience || null,
          language: doc.language || null,
          sourceDocumentId: doc.sourceDocumentId || null,
          sourceDocumentName: doc.sourceDocumentName || null,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
          lastOpenedAt: doc.lastOpenedAt ? new Date(doc.lastOpenedAt) : null
        }
      })
      
      console.log(`  ✅ 文档迁移成功`)
      successCount++
      
      // 迁移该文档的缩略图
      const thumbnailIndexPath = path.join(DATA_DIR, 'thumbnails', `${doc.id}.json`)
      if (fs.existsSync(thumbnailIndexPath)) {
        try {
          const thumbnailData = JSON.parse(fs.readFileSync(thumbnailIndexPath, 'utf-8'))
          let thumbnailSuccessCount = 0
          
          for (const thumb of thumbnailData.thumbnails || []) {
            try {
              // 检查是否已存在
              const existingThumb = await prisma.thumbnail.findUnique({
                where: { id: thumb.id }
              })
              
              if (existingThumb) {
                continue
              }
              
              await prisma.thumbnail.create({
                data: {
                  id: thumb.id,
                  documentId: doc.id,
                  slideId: thumb.slideId,
                  slideIndex: thumb.slideIndex,
                  url: thumb.url,
                  width: thumb.width || 800,
                  height: thumb.height || 450,
                  size: thumb.size || 0,
                  format: thumb.format || 'jpeg',
                  hasText: thumb.metadata?.hasText || false,
                  hasImage: thumb.metadata?.hasImage || false,
                  elementCount: thumb.metadata?.elementCount || 0,
                  generatedAt: thumb.generatedAt ? new Date(thumb.generatedAt) : new Date()
                }
              })
              
              thumbnailSuccessCount++
            } catch (thumbError) {
              console.warn(`    ⚠️  缩略图 ${thumb.id} 迁移失败:`, thumbError.message)
            }
          }
          
          if (thumbnailSuccessCount > 0) {
            console.log(`  ✅ 缩略图: ${thumbnailSuccessCount} 个`)
            thumbnailTotalCount += thumbnailSuccessCount
          }
        } catch (thumbFileError) {
          console.warn(`  ⚠️  读取缩略图索引失败:`, thumbFileError.message)
        }
      }
      
    } catch (error) {
      console.error(`  ❌ 失败:`, error.message)
      errorCount++
    }
  }
  
  console.log('\n' + '='.repeat(50))
  console.log('📊 迁移统计:')
  console.log(`  文档成功: ${successCount} 个`)
  console.log(`  文档失败: ${errorCount} 个`)
  console.log(`  缩略图总数: ${thumbnailTotalCount} 个`)
  console.log('='.repeat(50))
  
  await prisma.$disconnect()
}

migrate()
  .catch((error) => {
    console.error('迁移失败:', error)
    process.exit(1)
  })

