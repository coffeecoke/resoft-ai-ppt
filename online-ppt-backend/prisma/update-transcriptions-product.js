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

async function main() {
  try {
    // 1. 找到"一表通"产品
    const ybtProduct = await prisma.products.findFirst({
      where: { code: 'YBT' }
    })

    if (!ybtProduct) {
      console.log('❌ 未找到"一表通"产品（code: YBT），请先运行 seed-products.js')
      return
    }

    console.log('✅ 找到一表通产品:', ybtProduct.id, ybtProduct.name, ybtProduct.code)

    // 2. 更新所有 transcriptions 记录（直接更新全部）
    const result = await prisma.transcriptions.updateMany({
      data: {
        product_id: ybtProduct.id,
        product_code: ybtProduct.code,
        product_name: ybtProduct.name
      }
    })

    console.log(`✅ 已更新 ${result.count} 条 transcriptions 记录`)
    console.log(`   - product_id: ${ybtProduct.id}`)
    console.log(`   - product_code: ${ybtProduct.code}`)
    console.log(`   - product_name: ${ybtProduct.name}`)

  } catch (error) {
    console.error('❌ 更新失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
