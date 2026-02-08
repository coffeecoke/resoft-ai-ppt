/**
 * 从 CSV 导入数据到 slide_merged_contents 表（无需安装额外包）
 * 用法: node prisma/import-slide-merged-contents-csv.js <csv文件路径>
 * 请先将 xlsx 用 Excel 另存为 CSV（如“CSV UTF-8”），再执行本脚本。
 * 示例: node prisma/import-slide-merged-contents-csv.js "C:\Users\18601\Downloads\slide_merged_contents.csv"
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()

const BATCH_SIZE = 100

function parseCsvRow(line) {
  const parts = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || (c === '\r' && !inQuotes)) {
      parts.push(current.trim())
      current = ''
      if (c === '\r') break
    } else {
      current += c
    }
  }
  parts.push(current.trim())
  return parts
}

function parseCsv(content) {
  const lines = content.split(/\n/).filter((l) => l.length > 0)
  if (lines.length < 2) return { headers: [], rows: [] }
  const headers = parseCsvRow(lines[0]).map((h) => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvRow(lines[i])
    const row = {}
    headers.forEach((h, j) => {
      row[h] = parts[j] !== undefined ? parts[j] : ''
    })
    rows.push(row)
  }
  return { headers, rows }
}

function parseIntSafe(v, def = 0) {
  if (v === '' || v === null || v === undefined) return def
  const n = parseInt(String(v).trim(), 10)
  return isNaN(n) ? def : n
}

function parseDate(v) {
  if (v === '' || v === null || v === undefined) return null
  const d = new Date(String(v).trim())
  return isNaN(d.getTime()) ? null : d
}

function rowToRecord(row) {
  const id = (row.id || '').trim()
  const document_id = (row.document_id || '').trim()
  const slide_id = (row.slide_id || '').trim()
  if (!id || !document_id || !slide_id) return null

  const merged_content = (row.merged_content || '').trim()
  const content_length = parseIntSafe(row.content_length, merged_content.length)
  const slide_order = parseIntSafe(row.slide_order, 0)
  const file_name = (row.file_name || '').trim() || ''
  const extract_method = (row.extract_method || 'auto').trim() || 'auto'
  const created_at = parseDate(row.created_at) || new Date()
  const updated_at = parseDate(row.updated_at) || new Date()

  return {
    id,
    document_id,
    slide_id,
    merged_content: merged_content || '',
    content_length,
    slide_order,
    file_name,
    extract_method,
    created_at,
    updated_at
  }
}

async function main() {
  const csvPath = process.argv[2]
  if (!csvPath) {
    console.error('❌ 请传入 CSV 文件路径')
    console.log('用法: node prisma/import-slide-merged-contents-csv.js <csv文件路径>')
    console.log('请先将 xlsx 用 Excel 另存为 CSV（如 CSV UTF-8），再执行。')
    process.exit(1)
  }

  const resolvedPath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath)
  if (!fs.existsSync(resolvedPath)) {
    console.error('❌ 文件不存在:', resolvedPath)
    process.exit(1)
  }

  console.log('📂 读取 CSV:', resolvedPath)
  const content = fs.readFileSync(resolvedPath, 'utf8')
  const { headers, rows } = parseCsv(content)
  console.log('📊 表头:', headers.join(', '))
  console.log('📊 解析到', rows.length, '行')

  const toInsert = []
  for (const row of rows) {
    const rec = rowToRecord(row)
    if (rec) toInsert.push(rec)
  }

  console.log('✅ 可导入条数:', toInsert.length)
  if (toInsert.length === 0) {
    console.log('无有效数据（需包含 id, document_id, slide_id）')
    return
  }

  let imported = 0
  let skipped = 0
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const result = await prisma.slide_merged_contents.createMany({
      data: batch,
      skipDuplicates: true
    })
    imported += result.count
    skipped += batch.length - result.count
  }

  console.log('🎉 导入完成: 新增', imported, '条, 跳过重复', skipped, '条')
}

main()
  .catch((e) => {
    console.error('❌ 导入失败:', e)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
