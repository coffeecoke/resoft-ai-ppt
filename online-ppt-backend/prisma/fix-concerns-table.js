// 修复 concerns 表，添加缺失的字段
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import mysql from 'mysql2/promise'

async function fixTable() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'aippt_db'
  })

  try {
    console.log('开始修复 concerns 表...\n')

    // 检查字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'concerns'
    `, [process.env.DB_NAME || 'aippt_db'])
    
    const columnNames = columns.map(c => c.COLUMN_NAME)
    console.log('当前字段:', columnNames.join(', '))

    // 添加 category_id 字段
    if (!columnNames.includes('category_id')) {
      console.log('\n添加 category_id 字段...')
      await connection.execute(`
        ALTER TABLE concerns 
        ADD COLUMN category_id VARCHAR(50) NULL,
        ADD INDEX idx_category_id (category_id)
      `)
      console.log('✅ category_id 字段已添加')
    } else {
      console.log('✅ category_id 字段已存在')
    }

    // 添加 intent_code 字段
    if (!columnNames.includes('intent_code')) {
      console.log('\n添加 intent_code 字段...')
      await connection.execute(`
        ALTER TABLE concerns 
        ADD COLUMN intent_code VARCHAR(10) NULL,
        ADD INDEX idx_intent_code (intent_code)
      `)
      console.log('✅ intent_code 字段已添加')
    } else {
      console.log('✅ intent_code 字段已存在')
    }

    // 添加外键约束（如果 concern_categories 表存在）
    try {
      const [fkCheck] = await connection.execute(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = ? 
          AND TABLE_NAME = 'concerns' 
          AND COLUMN_NAME = 'category_id'
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [process.env.DB_NAME || 'aippt_db'])

      if (fkCheck.length === 0) {
        console.log('\n添加外键约束...')
        await connection.execute(`
          ALTER TABLE concerns 
          ADD CONSTRAINT concerns_category_id_fkey 
          FOREIGN KEY (category_id) REFERENCES concern_categories(id) 
          ON DELETE SET NULL ON UPDATE CASCADE
        `)
        console.log('✅ 外键约束已添加')
      } else {
        console.log('✅ 外键约束已存在')
      }
    } catch (error) {
      console.log('⚠️ 外键约束添加失败（可能已存在）:', error.message)
    }

    console.log('\n✨ concerns 表修复完成！')

  } catch (error) {
    console.error('❌ 修复失败:', error)
    throw error
  } finally {
    await connection.end()
  }
}

fixTable()

