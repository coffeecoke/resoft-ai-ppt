// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()

/**
 * 将 content_categories_ppt 表的数据迁移到 product_catalogs 表
 * 
 * 注意：product_catalogs 表有 product_id 字段（必填）
 * 如果所有产品共用同一套目录，需要先确认如何处理 product_id
 */
async function main() {
  console.log('🔄 开始迁移 content_categories_ppt 数据到 product_catalogs...')

  try {
    // 1. 使用原生 SQL 读取 content_categories_ppt 表的所有数据（因为 schema 中已经删除定义）
    const sourceData = await prisma.$queryRaw`
      SELECT * FROM content_categories_ppt
      ORDER BY level ASC, sort_order ASC
    `

    console.log(`📊 找到 ${sourceData.length} 条数据需要迁移`)

    if (sourceData.length === 0) {
      console.log('⚠️  source_categories_ppt 表中没有数据，无需迁移')
      return
    }

    // 2. 检查 product_catalogs 表是否已有数据
    const existingCount = await prisma.product_catalogs.count()
    if (existingCount > 0) {
      console.log(`⚠️  product_catalogs 表中已有 ${existingCount} 条数据`)
      console.log('❓ 是否要清空现有数据？(当前脚本会跳过此步骤，请手动确认)')
      // 如果需要清空，取消下面的注释
      // await prisma.product_catalogs.deleteMany({})
    }

    // 3. 由于所有产品共用同一套目录结构，product_id 设为 null
    console.log(`✅ 所有产品共用目录结构，product_id 设为 null`)

    // 4. 开始迁移数据
    let migratedCount = 0
    const idMapping = new Map() // 用于映射旧的 id 到新的 id

    // 先迁移一级目录（level = 1）
    for (const item of sourceData) {
      if (item.level === 1) {
        try {
          const newId = item.id // 保持相同的 ID
          idMapping.set(item.id, newId)

          await prisma.product_catalogs.create({
            data: {
              id: newId,
              product_id: null, // 所有产品共用目录，设为 null
              parent_id: null, // 一级目录没有父节点
              name: item.name,
              code: item.code,
              level: item.level,
              description: item.description,
              sort_order: item.sort_order,
              is_active: item.is_active,
              created_at: item.created_at,
              updated_at: item.updated_at || new Date()
            }
          })

          console.log(`  ✅ 迁移一级目录: ${item.name} (${item.code})`)
          migratedCount++
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`  ⚠️  跳过（已存在）: ${item.name} (${item.code})`)
          } else {
            console.error(`  ❌ 迁移失败: ${item.name}`, error.message)
          }
        }
      }
    }

    // 再迁移二级目录（level = 2）
    for (const item of sourceData) {
      if (item.level === 2 && item.parent_id) {
        try {
          const newId = item.id // 保持相同的 ID
          const newParentId = idMapping.get(item.parent_id)

          if (!newParentId) {
            console.error(`  ❌ 找不到父节点: ${item.name} (parent_id: ${item.parent_id})`)
            continue
          }

          await prisma.product_catalogs.create({
            data: {
              id: newId,
              product_id: null, // 所有产品共用目录，设为 null
              parent_id: newParentId,
              name: item.name,
              code: item.code,
              level: item.level,
              description: item.description,
              sort_order: item.sort_order,
              is_active: item.is_active,
              created_at: item.created_at,
              updated_at: item.updated_at || new Date()
            }
          })

          console.log(`  ✅ 迁移二级目录: ${item.name} (${item.code})`)
          migratedCount++
        } catch (error) {
          if (error.code === 'P2002') {
            console.log(`  ⚠️  跳过（已存在）: ${item.name} (${item.code})`)
          } else {
            console.error(`  ❌ 迁移失败: ${item.name}`, error.message)
          }
        }
      }
    }

    console.log(`\n🎉 数据迁移完成！`)
    console.log(`📊 统计: 成功迁移 ${migratedCount} 条数据`)
    console.log(`\n⚠️  下一步：`)
    console.log(`   1. 验证数据是否正确`)
    console.log(`   2. 如果确认无误，可以删除 content_categories_ppt 表的定义`)
    console.log(`   3. 运行 prisma migrate dev 生成迁移文件`)

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

