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
 * 清理并重新填充产品目录数据
 * 
 * 步骤：
 * 1. 清空 product_id 为 null 的通用分类数据
 * 2. 重新运行 seed-content-categories-ppt.js 填充数据
 */

async function main() {
  console.log('🧹 开始清理重复的分类数据...')
  console.log('='.repeat(60))

  try {
    // 步骤 1: 统计现有数据
    const existingCount = await prisma.product_catalogs.count({
      where: {
        product_id: null
      }
    })
    
    console.log(`\n📊 当前通用分类数据: ${existingCount} 条`)
    
    if (existingCount === 0) {
      console.log('✅ 没有需要清理的数据')
      return
    }

    // 步骤 2: 清空 product_id 为 null 的数据（通用分类）
    console.log('\n🗑️  正在清空通用分类数据...')
    const deleteResult = await prisma.product_catalogs.deleteMany({
      where: {
        product_id: null
      }
    })
    
    console.log(`✅ 已删除 ${deleteResult.count} 条数据`)

    // 步骤 3: 验证清理结果
    const remainingCount = await prisma.product_catalogs.count({
      where: {
        product_id: null
      }
    })
    
    console.log(`\n📊 清理后剩余通用分类数据: ${remainingCount} 条`)
    
    if (remainingCount === 0) {
      console.log('\n✅ 清理完成！')
      console.log('\n📌 下一步：运行以下命令重新填充数据：')
      console.log('   node prisma/seed-content-categories-ppt.js')
    } else {
      console.warn(`\n⚠️  仍有 ${remainingCount} 条数据未清理，请检查`)
    }

  } catch (error) {
    console.error('\n❌ 清理失败:', error)
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

