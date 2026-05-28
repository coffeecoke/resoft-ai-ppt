#!/usr/bin/env node
/**
 * 重建 scraping_infos 表（表被误删时执行）
 * 在 online-ppt-backend 根目录执行：node prisma/recreate-scraping-infos.js
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import 'dotenv/config'

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, 'migrations', 'recreate_scraping_infos.sql')
const fullSql = readFileSync(sqlPath, 'utf-8')

// 拆成单条语句执行（MySQL 驱动一次一条）
const statements = fullSql
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'))

const prisma = new PrismaClient()

async function main() {
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt + ';')
  }
  console.log('scraping_infos 表已重新创建完成。')
}

main()
  .catch(e => {
    console.error('执行失败:', e.message)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
