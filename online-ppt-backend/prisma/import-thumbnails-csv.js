/**
 * 从 CSV 导入缩略图数据到 thumbnails 表
 * 用法: node prisma/import-thumbnails-csv.js <csv文件路径>
 * 示例: node prisma/import-thumbnails-csv.js "C:\Users\18601\Downloads\thumbnails_2026-02-07_210357.csv"
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 优先从 backend 目录加载 .env
const envPath = path.join(__dirname, '..', '.env')
dotenv.config({ path: envPath })
const envPathRoot = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPathRoot })

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
  const headers = parseCsvRow(lines[0])
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

function parseBool(v) {
  if (v === '' || v === null || v === undefined) return false
  return v === '1' || String(v).toLowerCase() === 'true'
}

function parseDate(v) {
  if (v === '' || v === null || v === undefined) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function parseIntSafe(v, def = 0) {
  if (v === '' || v === null || v === undefined) return def
  const n = parseInt(v, 10)
  return isNaN(n) ? def : n
}

function parseFloatSafe(v) {
  if (v === '' || v === null || v === undefined) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function rowToThumbnail(row, existingDocIds) {
  const document_id = (row.document_id || '').trim()
  if (!existingDocIds.has(document_id)) return null
  const generated_at = parseDate(row.generated_at)
  const analyzed_at = parseDate(row.analyzed_at) || null
  const page_type = (row.page_type || '').trim() || null
  const page_type_confidence = parseFloatSafe(row.page_type_confidence)
  const size = row.size === '' || row.size == null ? null : parseIntSafe(row.size, null)
  if (size !== null && isNaN(size)) return null

  return {
    id: (row.id || '').trim(),
    document_id,
    slide_id: (row.slide_id || '').trim(),
    slide_index: parseIntSafe(row.slide_index, 0),
    url: (row.url || '').trim(),
    width: parseIntSafe(row.width, 800),
    height: parseIntSafe(row.height, 450),
    size: size,
    format: (row.format || 'jpeg').trim(),
    has_text: parseBool(row.has_text),
    has_image: parseBool(row.has_image),
    element_count: parseIntSafe(row.element_count, 0),
    generated_at: generated_at || new Date(),
    analyzed_at: analyzed_at,
    page_type: page_type,
    page_type_confidence: page_type_confidence
  }
}

async function main() {
  const csvPath = process.argv[2] || path.join(__dirname, 'thumbnails_2026-02-07_210357.csv')
  const resolvedPath = path.isAbsolute(csvPath) ? csvPath : path.resolve(process.cwd(), csvPath)

  if (!fs.existsSync(resolvedPath)) {
    console.error('❌ 文件不存在:', resolvedPath)
    console.log('用法: node prisma/import-thumbnails-csv.js <csv文件路径>')
    process.exit(1)
  }

  console.log('📂 读取 CSV:', resolvedPath)
  const content = fs.readFileSync(resolvedPath, 'utf8')
  const { headers, rows } = parseCsv(content)
  console.log('📊 解析到', rows.length, '行')

  const documentIdsInCsv = [...new Set(rows.map((r) => (r.document_id || '').trim()).filter(Boolean))]
  const existingDocs = await prisma.documents.findMany({
    where: { id: { in: documentIdsInCsv } },
    select: { id: true }
  })
  const existingDocIds = new Set(existingDocs.map((d) => d.id))
  const missingDocIds = documentIdsInCsv.filter((id) => !existingDocIds.has(id))
  if (missingDocIds.length > 0) {
    console.log('⚠️  以下 document_id 在 documents 表中不存在，将跳过对应行:', missingDocIds.join(', '))
  }

  const toInsert = []
  for (const row of rows) {
    const rec = rowToThumbnail(row, existingDocIds)
    if (rec && rec.id && rec.document_id && rec.slide_id) toInsert.push(rec)
  }

  console.log('✅ 可导入条数:', toInsert.length, '(仅 document 已存在的记录)')
  if (toInsert.length === 0) {
    console.log('无数据可导入，请先确保 documents 表中有对应的 document_id。')
    return
  }

  let imported = 0
  let skipped = 0
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE)
    const result = await prisma.thumbnails.createMany({
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
