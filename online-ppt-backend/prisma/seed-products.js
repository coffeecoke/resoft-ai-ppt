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
 * 产品初始化数据
 * 基于前端 salesData.ts 中的产品统计数据
 */
const productsData = [
  {
    name: '一表通',
    code: 'YBT',
    description: '一表通报送平台（NUPS-GRDC），提供统一的监管报送解决方案',
    category: '监管合规',
    tags: ['监管报送', '数据上报', '合规'],
    sortOrder: 1
  },
  {
    name: '1104',
    code: '1104',
    description: '1104监管报送系统，支持银行业监管统计报送',
    category: '监管合规',
    tags: ['1104报送', '监管统计', '银行业'],
    sortOrder: 2
  },
  {
    name: '受益所有人',
    code: 'SYSZR',
    description: '受益所有人识别管理系统，满足反洗钱监管要求',
    category: '监管合规',
    tags: ['受益所有人', '反洗钱', 'KYC'],
    sortOrder: 3
  },
  {
    name: '反洗钱',
    code: 'FXQ',
    description: '反洗钱监测分析系统，提供全方位反洗钱解决方案',
    category: '监管合规',
    tags: ['反洗钱', 'AML', '风险监测'],
    sortOrder: 4
  },
  {
    name: '金数',
    code: 'JS',
    description: '金融数据治理平台，提供数据质量管理和数据治理解决方案',
    category: '数据治理',
    tags: ['数据治理', '数据质量', '金融数据'],
    sortOrder: 5
  },
  {
    name: '金数数据质量',
    code: 'JS_QUALITY',
    description: '金融数据质量管理系统，专注于数据质量监控和提升',
    category: '数据治理',
    tags: ['数据质量', '质量监控', '数据校验'],
    sortOrder: 6
  },
  {
    name: '监管集市',
    code: 'JGJS',
    description: '监管数据集市，提供统一的监管数据服务平台',
    category: '数据服务',
    tags: ['数据集市', '监管数据', '数据服务'],
    sortOrder: 7
  },
  {
    name: '征信',
    code: 'ZX',
    description: '征信数据管理系统，提供征信数据采集、查询、报送服务',
    category: '征信服务',
    tags: ['征信', '信用报告', '数据报送'],
    sortOrder: 8
  },
  {
    name: '票据',
    code: 'PJ',
    description: '电子票据管理系统，支持票据全生命周期管理',
    category: '金融票据',
    tags: ['电子票据', '票据管理', '供应链金融'],
    sortOrder: 9
  },
  {
    name: '支付',
    code: 'ZF',
    description: '支付清算系统，提供安全、高效的支付解决方案',
    category: '支付清算',
    tags: ['支付', '清算', '资金管理'],
    sortOrder: 10
  }
]

async function main() {
  console.log('🌱 开始初始化产品数据...')

  try {
    // 清空现有数据（可选，根据需求决定）
    // await prisma.products.deleteMany({})

    let createdCount = 0
    let skippedCount = 0

    for (const product of productsData) {
      try {
        const productId = randomUUID()
        
        await prisma.products.create({
          data: {
            id: productId,
            name: product.name,
            code: product.code,
            description: product.description,
            category: product.category,
            tags: product.tags,
            sort_order: product.sortOrder,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date()
          }
        })

        console.log(`✅ 创建产品: ${product.name} (${product.code})`)
        createdCount++
      } catch (error) {
        if (error.code === 'P2002') {
          console.log(`⚠️  跳过（已存在）: ${product.name} (${product.code})`)
          skippedCount++
        } else {
          console.error(`❌ 创建失败: ${product.name}`, error.message)
        }
      }
    }

    console.log(`\n🎉 产品数据初始化完成！`)
    console.log(`📊 统计: 成功创建 ${createdCount} 个产品，跳过 ${skippedCount} 个`)

  } catch (error) {
    console.error('❌ 初始化失败:', error)
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

