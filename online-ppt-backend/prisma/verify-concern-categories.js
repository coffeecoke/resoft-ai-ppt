// 验证问答对分类数据
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()

async function verifyData() {
  console.log('开始验证问答对分类数据...\n')

  try {
    // 1. 统计总数
    const total = await prisma.concern_categories.count()
    console.log(`✅ 总记录数: ${total}`)

    // 2. 按层级统计
    const levels = await prisma.concern_categories.count({ where: { level: 1 } })
    const categories = await prisma.concern_categories.count({ where: { level: 2 } })
    const intents = await prisma.concern_categories.count({ where: { level: 3 } })
    console.log(`\n📊 按层级统计:`)
    console.log(`   - 分类层面 (level=1): ${levels} 条`)
    console.log(`   - 分类类别 (level=2): ${categories} 条`)
    console.log(`   - 问题性质 (level=3): ${intents} 条`)

    // 3. 按类型统计
    const levelType = await prisma.concern_categories.count({ where: { type: 'level' } })
    const categoryType = await prisma.concern_categories.count({ where: { type: 'category' } })
    const intentType = await prisma.concern_categories.count({ where: { type: 'intent' } })
    console.log(`\n📊 按类型统计:`)
    console.log(`   - level类型: ${levelType} 条`)
    console.log(`   - category类型: ${categoryType} 条`)
    console.log(`   - intent类型: ${intentType} 条`)

    // 4. 显示所有分类层面
    console.log(`\n📋 分类层面列表:`)
    const levelList = await prisma.concern_categories.findMany({
      where: { level: 1 },
      orderBy: { sort_order: 'asc' }
    })
    levelList.forEach(item => {
      console.log(`   ${item.code}. ${item.name}`)
    })

    // 5. 显示每个层面下的类别
    console.log(`\n📋 分类类别列表:`)
    for (const level of levelList) {
      const children = await prisma.concern_categories.findMany({
        where: { parent_code: level.code, level: 2 },
        orderBy: { sort_order: 'asc' }
      })
      if (children.length > 0) {
        console.log(`\n   ${level.code} ${level.name}:`)
        children.forEach(child => {
          console.log(`     ${child.code} ${child.name}`)
        })
      }
    }

    // 6. 显示问题性质
    console.log(`\n📋 问题性质列表:`)
    const intentList = await prisma.concern_categories.findMany({
      where: { level: 3 },
      orderBy: { sort_order: 'asc' }
    })
    intentList.forEach(item => {
      console.log(`   ${item.code} ${item.name}`)
    })

    // 7. 验证层级关系
    console.log(`\n🔍 验证层级关系:`)
    const allCategories = await prisma.concern_categories.findMany({
      where: { level: 2 }
    })
    let validCount = 0
    let invalidCount = 0
    for (const cat of allCategories) {
      if (cat.parent_code) {
        const parent = await prisma.concern_categories.findUnique({
          where: { code: cat.parent_code }
        })
        if (parent) {
          validCount++
        } else {
          console.log(`   ❌ ${cat.code} 的父级 ${cat.parent_code} 不存在`)
          invalidCount++
        }
      }
    }
    console.log(`   ✅ 有效层级关系: ${validCount}`)
    if (invalidCount > 0) {
      console.log(`   ❌ 无效层级关系: ${invalidCount}`)
    } else {
      console.log(`   ✅ 所有层级关系都有效`)
    }

    // 8. 检查关键字段
    console.log(`\n🔍 检查数据完整性:`)
    const allItems = await prisma.concern_categories.findMany()
    const missingDesc = allItems.filter(item => !item.description).length
    const missingKeywords = allItems.filter(item => !item.keywords).length
    console.log(`   - 缺少描述: ${missingDesc} 条`)
    console.log(`   - 缺少关键词: ${missingKeywords} 条`)

    console.log(`\n✨ 验证完成！`)

  } catch (error) {
    console.error('❌ 验证失败:', error)
    throw error
  }
}

verifyData()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ 验证失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

