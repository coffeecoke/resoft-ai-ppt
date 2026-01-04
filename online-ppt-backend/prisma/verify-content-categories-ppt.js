// 验证产品目录数据（原 content_categories_ppt 验证脚本）
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

async function verify() {
  console.log('🔍 开始验证产品目录数据...\n')

  try {
    // 1. 统计一级目录数量
    const level1Count = await prisma.product_catalogs.count({
      where: { level: 1 }
    })
    console.log(`✅ 一级目录数量: ${level1Count} 个`)

    // 2. 统计二级目录数量
    const level2Count = await prisma.product_catalogs.count({
      where: { level: 2 }
    })
    console.log(`✅ 二级目录数量: ${level2Count} 个`)

    // 3. 检查是否有孤立的二级目录（parent_id 无效）
    const orphaned = await prisma.product_catalogs.findMany({
      where: {
        level: 2,
        parent_id: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        parent_id: true
      }
    })

    let orphanedCount = 0
    for (const item of orphaned) {
      const parent = await prisma.product_catalogs.findUnique({
        where: { id: item.parent_id }
      })
      if (!parent) {
        orphanedCount++
        console.log(`⚠️  发现孤立的二级目录: ${item.name} (parent_id: ${item.parent_id})`)
      }
    }

    if (orphanedCount === 0) {
      console.log(`✅ 所有二级目录都有有效的父目录`)
    }

    // 4. 检查是否有重复的 code
    const allCategories = await prisma.product_catalogs.findMany({
      select: { code: true, name: true }
    })

    const codeMap = new Map()
    let duplicateCount = 0
    for (const cat of allCategories) {
      if (codeMap.has(cat.code)) {
        duplicateCount++
        console.log(`⚠️  发现重复的 code: ${cat.code} (${cat.name})`)
      } else {
        codeMap.set(cat.code, cat.name)
      }
    }

    if (duplicateCount === 0) {
      console.log(`✅ 所有目录编码都是唯一的`)
    }

    // 5. 显示完整的目录树
    console.log(`\n📊 目录树结构:`)
    const level1Categories = await prisma.product_catalogs.findMany({
      where: { level: 1 },
      orderBy: { sort_order: 'asc' }
    })

    for (const level1 of level1Categories) {
      const level2Categories = await prisma.product_catalogs.findMany({
        where: {
          level: 2,
          parent_id: level1.id
        },
        orderBy: { sort_order: 'asc' }
      })
      
      console.log(`\n  📁 ${level1.name} (${level1.code})`)
      for (const level2 of level2Categories) {
        console.log(`    └─ ${level2.name} (${level2.code})`)
      }
    }

    // 6. 检查判断标准是否完整
    const categoriesWithoutDescription = await prisma.product_catalogs.count({
      where: {
        description: null
      }
    })

    if (categoriesWithoutDescription === 0) {
      console.log(`\n✅ 所有目录都有判断标准`)
    } else {
      console.log(`\n⚠️  有 ${categoriesWithoutDescription} 个目录缺少判断标准`)
    }

    // 7. 统计总结
    console.log(`\n📈 数据统计总结:`)
    console.log(`   - 一级目录: ${level1Count} 个`)
    console.log(`   - 二级目录: ${level2Count} 个`)
    console.log(`   - 总目录数: ${level1Count + level2Count} 个`)
    console.log(`   - 孤立目录: ${orphanedCount} 个`)
    console.log(`   - 重复编码: ${duplicateCount} 个`)
    console.log(`   - 缺少描述: ${categoriesWithoutDescription} 个`)

    if (level1Count === 6 && level2Count === 22 && orphanedCount === 0 && duplicateCount === 0 && categoriesWithoutDescription === 0) {
      console.log(`\n🎉 数据验证通过！所有数据完整且正确。`)
    } else {
      console.log(`\n⚠️  数据验证发现问题，请检查上述警告。`)
    }

  } catch (error) {
    console.error('❌ 验证失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

verify()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

