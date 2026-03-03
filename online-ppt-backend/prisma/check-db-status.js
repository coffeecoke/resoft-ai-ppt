// 检查数据库状态
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

async function checkStatus() {
  try {
    // 检查 concern_categories 表是否存在
    const categories = await prisma.concern_categories.findMany({ take: 1 })
    console.log('✅ concern_categories 表已存在')
    console.log(`   当前记录数: ${await prisma.concern_categories.count()}`)
    
    // 检查 concerns 表的新字段
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'concerns'
      AND COLUMN_NAME IN ('category_id', 'intent_code')
    `
    const columnNames = Array.isArray(columns) ? columns.map(c => c.COLUMN_NAME || c.COLUMN_NAME) : []
    console.log('\n✅ concerns 表结构:')
    console.log(`   - category_id: ${columnNames.includes('category_id') ? '存在' : '不存在'}`)
    console.log(`   - intent_code: ${columnNames.includes('intent_code') ? '存在' : '不存在'}`)
    
    // 检查迁移表
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at 
      FROM _prisma_migrations 
      ORDER BY finished_at DESC 
      LIMIT 10
    `
    console.log('\n📋 最近的迁移记录:')
    migrations.forEach(m => {
      console.log(`   - ${m.migration_name} (${m.finished_at})`)
    })
    
  } catch (error) {
    if (error.code === 'P2021' || error.message.includes('does not exist')) {
      console.log('❌ concern_categories 表不存在')
    } else {
      console.error('❌ 检查失败:', error.message)
    }
  } finally {
    await prisma.$disconnect()
  }
}

checkStatus()

