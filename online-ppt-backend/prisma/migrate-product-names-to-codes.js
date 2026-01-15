/**
 * 数据迁移脚本：将 documents.product JSON 字段中的 name 转换为 code
 * 
 * 用途：
 * - 将现有 documents 表中 product 字段存储的 name 数组转换为 code 数组
 * - 确保数据一致性，统一使用 code 作为产品标识
 * 
 * 使用方法：
 * node prisma/migrate-product-names-to-codes.js
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
const envPath = path.join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

const prisma = new PrismaClient()

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始迁移：将 documents.product 中的 name 转换为 code\n')

  try {
    // 1. 查询所有产品，建立 name -> code 映射
    console.log('📋 步骤 1: 查询产品列表，建立 name -> code 映射...')
    const products = await prisma.products.findMany({
      where: { is_active: true },
      select: { id: true, name: true, code: true }
    })

    // 建立映射表
    const nameToCodeMap = new Map()
    const codeToNameMap = new Map()
    
    products.forEach(product => {
      if (product.name && product.code) {
        nameToCodeMap.set(product.name, product.code)
        codeToNameMap.set(product.code, product.name)
      }
    })

    console.log(`✅ 找到 ${products.length} 个产品`)
    console.log(`   - 有 code 的产品: ${nameToCodeMap.size} 个`)
    console.log('')

    // 2. 查询所有 documents，检查 product 字段
    console.log('📋 步骤 2: 查询所有 documents...')
    const documents = await prisma.documents.findMany({
      select: {
        id: true,
        name: true,
        product: true
      }
    })

    console.log(`✅ 找到 ${documents.length} 个文档`)
    console.log('')

    // 3. 统计需要迁移的文档
    let needMigrationCount = 0
    let alreadyCodeCount = 0
    let emptyProductCount = 0
    const migrationList = []

    documents.forEach(doc => {
      if (!doc.product) {
        emptyProductCount++
        return
      }

      // 解析 product 字段（可能是数组或单个值）
      const productArray = Array.isArray(doc.product) 
        ? doc.product 
        : (doc.product ? [doc.product] : [])

      if (productArray.length === 0) {
        emptyProductCount++
        return
      }

      // 检查是否已经是 code（通过检查是否在 codeToNameMap 中）
      const isCode = productArray.every(p => codeToNameMap.has(p))
      
      if (isCode) {
        alreadyCodeCount++
      } else {
        // 需要迁移：包含 name 值
        needMigrationCount++
        migrationList.push({
          id: doc.id,
          name: doc.name,
          oldProduct: productArray,
          newProduct: productArray.map(p => {
            // 如果是 name，转换为 code；如果已经是 code，保持不变
            return nameToCodeMap.get(p) || p
          }).filter(Boolean)  // 过滤掉无法转换的值
        })
      }
    })

    console.log('📊 统计结果:')
    console.log(`   - 需要迁移的文档: ${needMigrationCount} 个`)
    console.log(`   - 已经是 code 的文档: ${alreadyCodeCount} 个`)
    console.log(`   - product 为空的文档: ${emptyProductCount} 个`)
    console.log('')

    // 4. 执行迁移
    if (needMigrationCount === 0) {
      console.log('✅ 所有文档的 product 字段已经是 code，无需迁移')
      return
    }

    console.log('📋 步骤 3: 开始迁移...')
    let successCount = 0
    let failCount = 0
    const failedDocs = []

    for (const item of migrationList) {
      try {
        await prisma.documents.update({
          where: { id: item.id },
          data: {
            product: item.newProduct.length > 0 ? item.newProduct : null
          }
        })
        successCount++
        
        if (successCount % 10 === 0) {
          console.log(`   ✅ 已迁移 ${successCount}/${needMigrationCount} 个文档...`)
        }
      } catch (error) {
        failCount++
        failedDocs.push({
          id: item.id,
          name: item.name,
          error: error.message
        })
        console.error(`   ❌ 迁移失败: ${item.name} (${item.id})`, error.message)
      }
    }

    console.log('')
    console.log('📊 迁移结果:')
    console.log(`   ✅ 成功: ${successCount} 个`)
    console.log(`   ❌ 失败: ${failCount} 个`)

    if (failedDocs.length > 0) {
      console.log('')
      console.log('❌ 失败的文档:')
      failedDocs.forEach(doc => {
        console.log(`   - ${doc.name} (${doc.id}): ${doc.error}`)
      })
    }

    // 5. 显示迁移示例
    if (migrationList.length > 0) {
      console.log('')
      console.log('📝 迁移示例（前 5 个）:')
      migrationList.slice(0, 5).forEach(item => {
        console.log(`   - ${item.name}:`)
        console.log(`     旧值: ${JSON.stringify(item.oldProduct)}`)
        console.log(`     新值: ${JSON.stringify(item.newProduct)}`)
      })
    }

    console.log('')
    console.log('✅ 迁移完成！')

  } catch (error) {
    console.error('❌ 迁移失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 执行迁移
main()
  .catch((error) => {
    console.error('❌ 迁移脚本执行失败:', error)
    process.exit(1)
  })

