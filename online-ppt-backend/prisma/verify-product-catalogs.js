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
 * 验证 product_catalogs 数据完整性
 */

async function main() {
  console.log('🔍 验证 product_catalogs 数据完整性')
  console.log('=' .repeat(60))

  try {
    // ========== 1. 查找通用产品 ==========
    console.log('\n📦 1. 检查通用产品...')
    
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })

    if (!generalProduct) {
      console.log('❌ 未找到通用产品，请先运行迁移脚本')
      return
    }

    console.log(`✅ 通用产品: ${generalProduct.name} (${generalProduct.id})`)

    // ========== 2. 统计数据 ==========
    console.log('\n📊 2. 数据统计...')
    
    const allCatalogs = await prisma.product_catalogs.findMany({
      where: { product_id: generalProduct.id },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })

    const level1Catalogs = allCatalogs.filter(c => c.level === 1)
    const level2Catalogs = allCatalogs.filter(c => c.level === 2)

    console.log(`   总数: ${allCatalogs.length}`)
    console.log(`   ├─ 一级目录: ${level1Catalogs.length}`)
    console.log(`   └─ 二级目录: ${level2Catalogs.length}`)

    // ========== 3. 验证层级关系 ==========
    console.log('\n🔗 3. 验证层级关系...')
    
    let hierarchyErrors = 0
    
    for (const level2 of level2Catalogs) {
      const parent = allCatalogs.find(c => c.id === level2.parent_id)
      
      if (!parent) {
        console.error(`   ❌ 二级目录 "${level2.name}" 的父级ID不存在: ${level2.parent_id}`)
        hierarchyErrors++
      } else if (parent.level !== 1) {
        console.error(`   ❌ 二级目录 "${level2.name}" 的父级不是一级目录: ${parent.name}`)
        hierarchyErrors++
      }
    }

    if (hierarchyErrors === 0) {
      console.log('   ✅ 所有二级目录的父级关系正确')
    } else {
      console.log(`   ❌ 发现 ${hierarchyErrors} 个层级关系错误`)
    }

    // ========== 4. 验证唯一性 ==========
    console.log('\n🔑 4. 验证 code 唯一性...')
    
    const codes = allCatalogs.map(c => c.code)
    const uniqueCodes = new Set(codes)
    
    if (codes.length === uniqueCodes.size) {
      console.log(`   ✅ 所有 code 唯一 (共 ${codes.length} 个)`)
    } else {
      console.log(`   ❌ 发现重复的 code (总数: ${codes.length}, 唯一: ${uniqueCodes.size})`)
      
      // 查找重复的 code
      const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index)
      console.log(`   重复的 code: ${[...new Set(duplicates)].join(', ')}`)
    }

    // ========== 5. 打印完整目录结构 ==========
    console.log('\n📂 5. 完整目录结构:')
    console.log('-' .repeat(60))
    
    for (const level1 of level1Catalogs) {
      console.log(`\n📁 ${level1.name} (${level1.code})`)
      console.log(`   描述: ${level1.description}`)
      
      const children = level2Catalogs.filter(c => c.parent_id === level1.id)
      
      for (const child of children) {
        console.log(`   ├─ ${child.name} (${child.code})`)
      }
      
      console.log(`   └─ 共 ${children.length} 个子目录`)
    }

    // ========== 6. 对比源表数据 ==========
    console.log('\n🔄 6. 对比源表 content_categories_ppt...')
    
    const sourceCategories = await prisma.content_categories_ppt.findMany({
      where: { is_active: true }
    })

    console.log(`   源表总数: ${sourceCategories.length}`)
    console.log(`   目标表总数: ${allCatalogs.length}`)
    
    if (sourceCategories.length === allCatalogs.length) {
      console.log('   ✅ 数量一致')
    } else {
      console.log(`   ⚠️  数量不一致，差异: ${Math.abs(sourceCategories.length - allCatalogs.length)}`)
    }

    // 对比 code 列表
    const sourceCodes = new Set(sourceCategories.map(c => c.code))
    const targetCodes = new Set(allCatalogs.map(c => c.code))
    
    const missingInTarget = [...sourceCodes].filter(code => !targetCodes.has(code))
    const extraInTarget = [...targetCodes].filter(code => !sourceCodes.has(code))
    
    if (missingInTarget.length > 0) {
      console.log(`   ❌ 目标表缺失的 code: ${missingInTarget.join(', ')}`)
    }
    
    if (extraInTarget.length > 0) {
      console.log(`   ⚠️  目标表多出的 code: ${extraInTarget.join(', ')}`)
    }
    
    if (missingInTarget.length === 0 && extraInTarget.length === 0) {
      console.log('   ✅ 所有 code 完全匹配')
    }

    // ========== 7. 验证字段完整性 ==========
    console.log('\n📋 7. 验证字段完整性...')
    
    const requiredFields = ['id', 'product_id', 'name', 'code', 'level', 'sort_order', 'is_active']
    let fieldErrors = 0
    
    for (const catalog of allCatalogs) {
      for (const field of requiredFields) {
        if (catalog[field] === null || catalog[field] === undefined) {
          console.error(`   ❌ 目录 "${catalog.name}" 缺失字段: ${field}`)
          fieldErrors++
        }
      }
    }
    
    if (fieldErrors === 0) {
      console.log(`   ✅ 所有必填字段完整`)
    } else {
      console.log(`   ❌ 发现 ${fieldErrors} 个字段错误`)
    }

    // ========== 8. 总结 ==========
    console.log('\n' + '='.repeat(60))
    console.log('📊 验证总结:')
    console.log('   ✅ 通用产品存在')
    console.log(`   ${hierarchyErrors === 0 ? '✅' : '❌'} 层级关系 ${hierarchyErrors === 0 ? '正确' : `有 ${hierarchyErrors} 个错误`}`)
    console.log(`   ${codes.length === uniqueCodes.size ? '✅' : '❌'} code 唯一性 ${codes.length === uniqueCodes.size ? '正确' : '有重复'}`)
    console.log(`   ${sourceCategories.length === allCatalogs.length ? '✅' : '⚠️'} 数据完整性 ${sourceCategories.length === allCatalogs.length ? '一致' : '不一致'}`)
    console.log(`   ${fieldErrors === 0 ? '✅' : '❌'} 字段完整性 ${fieldErrors === 0 ? '正确' : `有 ${fieldErrors} 个错误`}`)
    
    const allPass = hierarchyErrors === 0 && 
                   codes.length === uniqueCodes.size && 
                   sourceCategories.length === allCatalogs.length && 
                   fieldErrors === 0

    if (allPass) {
      console.log('\n🎉 所有验证通过！数据迁移完整且正确')
    } else {
      console.log('\n⚠️  存在问题，请检查上述错误信息')
    }

  } catch (error) {
    console.error('\n❌ 验证失败:', error)
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

