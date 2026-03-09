import * as prismaClient from '@prisma/client'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

const list = await prisma.templates.findMany({ orderBy: { created_at: 'asc' } })
console.log(`\n共 ${list.length} 个模版：\n`)
console.table(list.map(t => ({
  id: t.id,
  name: t.name,
  status: t.status,
  slide_count: t.slide_count,
  category: t.category,
  content_file_path: t.content_file_path,
})))
await prisma.$disconnect()
