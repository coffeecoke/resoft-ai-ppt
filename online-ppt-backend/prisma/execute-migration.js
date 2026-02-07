// 执行迁移 SQL 添加缺失字段
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()

async function executeMigration() {
  try {
    console.log('开始执行迁移 SQL...\n')

    // 检查字段是否存在
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'concerns'
    `
    
    const columnNames = Array.isArray(columns) ? columns.map(c => c.COLUMN_NAME) : []
    console.log('当前字段:', columnNames.join(', '))

    // 添加 category_id 字段
    if (!columnNames.includes('category_id')) {
      console.log('\n添加 category_id 字段...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE concerns 
        ADD COLUMN category_id VARCHAR(50) NULL
      `)
      console.log('✅ category_id 字段已添加')
    } else {
      console.log('✅ category_id 字段已存在')
    }

    // 添加 intent_code 字段
    if (!columnNames.includes('intent_code')) {
      console.log('\n添加 intent_code 字段...')
      await prisma.$executeRawUnsafe(`
        ALTER TABLE concerns 
        ADD COLUMN intent_code VARCHAR(10) NULL
      `)
      console.log('✅ intent_code 字段已添加')
    } else {
      console.log('✅ intent_code 字段已存在')
    }

    // 创建索引
    console.log('\n创建索引...')
    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_category_id ON concerns(category_id)
      `)
      console.log('✅ idx_category_id 索引已创建')
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log('✅ idx_category_id 索引已存在')
      } else {
        throw error
      }
    }

    try {
      await prisma.$executeRawUnsafe(`
        CREATE INDEX idx_intent_code ON concerns(intent_code)
      `)
      console.log('✅ idx_intent_code 索引已创建')
    } catch (error) {
      if (error.message.includes('Duplicate key name')) {
        console.log('✅ idx_intent_code 索引已存在')
      } else {
        throw error
      }
    }

    // 添加外键约束
    console.log('\n添加外键约束...')
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE concerns 
        ADD CONSTRAINT concerns_category_id_fkey 
        FOREIGN KEY (category_id) REFERENCES concern_categories(id) 
        ON DELETE SET NULL ON UPDATE CASCADE
      `)
      console.log('✅ 外键约束已添加')
    } catch (error) {
      if (error.message.includes('Duplicate') || 
          error.message.includes('already exists') ||
          error.code === 'P2010') {
        console.log('✅ 外键约束已存在')
      } else {
        throw error
      }
    }

    console.log('\n✨ 迁移执行完成！')

  } catch (error) {
    console.error('❌ 执行失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

executeMigration()

