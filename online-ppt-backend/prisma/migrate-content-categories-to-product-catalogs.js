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
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

/**
 * 数据迁移脚本：content_categories_ppt → product_catalogs
 * 
 * 任务：
 * 1. 创建或获取"通用产品"(用于存放通用分类标准)
 * 2. 将 content_categories_ppt 的数据迁移到 product_catalogs
 * 3. 保持层级关系和所有字段映射
 */

async function main() {
  console.log('🚀 开始数据迁移：content_categories_ppt → product_catalogs')
  console.log('=' .repeat(60))

  try {
    // ========== 步骤 1: 创建或获取"通用产品" ==========
    console.log('\n📦 步骤 1: 检查/创建"通用产品"...')
    
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    let generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })

    if (!generalProduct) {
      generalProduct = await prisma.products.create({
        data: {
          id: randomUUID(),
          name: '通用PPT内容分类',
          code: GENERAL_PRODUCT_CODE,
          description: '通用的PPT内容分类标准，适用于所有产品的内容分析',
          category: 'system',
          tags: ['通用', 'PPT分类', '内容分析'],
          sort_order: 0,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      console.log(`✅ 创建通用产品: ${generalProduct.name} (${generalProduct.id})`)
    } else {
      console.log(`✅ 使用现有通用产品: ${generalProduct.name} (${generalProduct.id})`)
    }

    // ========== 步骤 2: 获取源数据 ==========
    console.log('\n📋 步骤 2: 读取 content_categories_ppt 数据...')
    
    const sourceCategories = await prisma.content_categories_ppt.findMany({
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })

    console.log(`📊 共找到 ${sourceCategories.length} 条分类数据`)
    
    // 统计一二级分类数量
    const level1Count = sourceCategories.filter(c => c.level === 1).length
    const level2Count = sourceCategories.filter(c => c.level === 2).length
    console.log(`   ├─ 一级分类: ${level1Count} 条`)
    console.log(`   └─ 二级分类: ${level2Count} 条`)

    if (sourceCategories.length === 0) {
      console.log('⚠️  源表为空，无需迁移')
      return
    }

    // ========== 步骤 3: 检查目标表是否已有数据 ==========
    console.log('\n🔍 步骤 3: 检查目标表 product_catalogs...')
    
    const existingCatalogs = await prisma.product_catalogs.findMany({
      where: { product_id: generalProduct.id }
    })

    if (existingCatalogs.length > 0) {
      console.log(`⚠️  目标表已有 ${existingCatalogs.length} 条数据（产品ID: ${generalProduct.id}）`)
      console.log('❓ 是否需要清空目标表再迁移？')
      console.log('   提示: 如需清空，请手动执行以下命令:')
      console.log(`   await prisma.product_catalogs.deleteMany({ where: { product_id: '${generalProduct.id}' } })`)
      console.log('\n⏭️  跳过迁移（如需迁移，请先清空目标数据）')
      return
    }

    // ========== 步骤 4: 执行数据迁移 ==========
    console.log('\n📤 步骤 4: 开始迁移数据...')
    
    // ID映射表（旧ID -> 新ID）
    const idMapping = new Map()
    
    // 先迁移一级分类（没有 parent_id）
    console.log('\n  🔹 迁移一级分类...')
    const level1Categories = sourceCategories.filter(c => c.level === 1)
    
    for (const category of level1Categories) {
      const newId = randomUUID()
      idMapping.set(category.id, newId)
      
      await prisma.product_catalogs.create({
        data: {
          id: newId,
          product_id: generalProduct.id,
          parent_id: null,
          name: category.name,
          code: category.code,
          description: category.description,
          sort_order: category.sort_order,
          level: category.level,
          is_active: category.is_active,
          created_at: category.created_at || new Date(),
          updated_at: category.updated_at || new Date()
        }
      })
      
      console.log(`     ✅ ${category.name} (${category.code})`)
    }

    // 再迁移二级分类（有 parent_id）
    console.log('\n  🔹 迁移二级分类...')
    const level2Categories = sourceCategories.filter(c => c.level === 2)
    
    for (const category of level2Categories) {
      const newId = randomUUID()
      idMapping.set(category.id, newId)
      
      // 映射父级ID
      const newParentId = idMapping.get(category.parent_id)
      
      if (!newParentId) {
        console.warn(`     ⚠️  找不到父级ID映射: ${category.parent_id} (${category.name})`)
        continue
      }
      
      await prisma.product_catalogs.create({
        data: {
          id: newId,
          product_id: generalProduct.id,
          parent_id: newParentId,
          name: category.name,
          code: category.code,
          description: category.description,
          sort_order: category.sort_order,
          level: category.level,
          is_active: category.is_active,
          created_at: category.created_at || new Date(),
          updated_at: category.updated_at || new Date()
        }
      })
      
      console.log(`     ✅ ${category.name} (${category.code})`)
    }

    // ========== 步骤 5: 验证迁移结果 ==========
    console.log('\n✅ 步骤 5: 验证迁移结果...')
    
    const migratedCatalogs = await prisma.product_catalogs.findMany({
      where: { product_id: generalProduct.id },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })

    const migratedLevel1 = migratedCatalogs.filter(c => c.level === 1).length
    const migratedLevel2 = migratedCatalogs.filter(c => c.level === 2).length
    
    console.log(`📊 迁移结果统计:`)
    console.log(`   ├─ 源表总数: ${sourceCategories.length}`)
    console.log(`   ├─ 目标表总数: ${migratedCatalogs.length}`)
    console.log(`   ├─ 一级分类: ${level1Count} → ${migratedLevel1}`)
    console.log(`   └─ 二级分类: ${level2Count} → ${migratedLevel2}`)
    
    if (migratedCatalogs.length === sourceCategories.length) {
      console.log('\n🎉 数据迁移成功！所有数据已从 content_categories_ppt 迁移到 product_catalogs')
    } else {
      console.warn('\n⚠️  迁移数量不一致，请检查日志')
    }

    // ========== 步骤 6: 输出后续操作建议 ==========
    console.log('\n📌 后续操作建议:')
    console.log('   1. 运行验证脚本: node prisma/verify-product-catalogs.js')
    console.log('   2. 更新 ai_backend 代码，将 content_categories_ppt 改为 product_catalogs')
    console.log('   3. 测试 AI 分析功能是否正常')
    console.log('   4. 确认无误后，可考虑删除 content_categories_ppt 表')
    console.log(`   5. 通用产品ID: ${generalProduct.id} (请记录此ID)`)

  } catch (error) {
    console.error('\n❌ 迁移失败:', error)
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
