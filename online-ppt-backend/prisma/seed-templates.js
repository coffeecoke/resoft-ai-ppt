/**
 * 模版数据种子脚本
 *
 * 从模版源根目录（默认 D:\pre-sales-file-data）读取 template-index.json 作为模版列表索引，
 * 从该目录下的 templates 子目录读取 template_*.json 并导入数据库，同时复制到后端 data/templates/ 目录。
 *
 * 运行方式：
 *   cd online-ppt-backend
 *   node prisma/seed-templates.js
 */

import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const prisma = new PrismaClient()

// 目录配置
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates')

// 模版源根目录：优先环境变量 TEMPLATE_SOURCE_DIR，否则默认 D:\pre-sales-file-data
const TEMPLATE_SOURCE_DIR = process.env.TEMPLATE_SOURCE_DIR || 'D:\\pre-sales-file-data'
const TEMPLATE_INDEX_FILE = path.join(TEMPLATE_SOURCE_DIR, 'template-index.json')
// 模版 JSON 源文件所在子目录（D:\pre-sales-file-data\templates）
const TEMPLATE_SOURCE_TEMPLATES_DIR = path.join(TEMPLATE_SOURCE_DIR, 'templates')

/**
 * 从 template-index.json 读取模版列表，每项需包含 id、name，可选 origin、category、cover、status
 */
function loadTemplateIndex() {
  if (!fs.existsSync(TEMPLATE_INDEX_FILE)) {
    throw new Error(`模版索引文件不存在: ${TEMPLATE_INDEX_FILE}`)
  }
  const raw = fs.readFileSync(TEMPLATE_INDEX_FILE, 'utf-8')
  let list
  try {
    list = JSON.parse(raw)
  } catch (e) {
    throw new Error(`模版索引 JSON 解析失败: ${TEMPLATE_INDEX_FILE} - ${e.message}`)
  }
  if (!Array.isArray(list)) {
    throw new Error(`模版索引格式错误: 应为数组，当前为 ${typeof list}`)
  }
  return list.map((item) => ({
    id: item.id,
    name: item.name || item.id,
    origin: item.origin ?? '官方制作',
    category: item.category || 'official',
    cover: item.cover,
    status: item.status || 'published',
  }))
}

/**
 * 从 JSON 内容中统计 slides 数量
 */
function countSlides(jsonContent) {
  try {
    const data = JSON.parse(jsonContent)
    return Array.isArray(data.slides) ? data.slides.length : 0
  } catch {
    return 0
  }
}

async function main() {
  console.log('[seed-templates] 读取模版索引:', TEMPLATE_INDEX_FILE)
  const templateList = loadTemplateIndex()
  console.log(`[seed-templates] 索引中共 ${templateList.length} 个模版，开始导入...`)

  // 确保目标目录存在
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
    console.log(`[seed-templates] 已创建目录: ${TEMPLATES_DIR}`)
  }

  let successCount = 0
  let skipCount = 0

  for (const tpl of templateList) {
    const srcFile = path.join(TEMPLATE_SOURCE_TEMPLATES_DIR, `${tpl.id}.json`)
    const destFile = path.join(TEMPLATES_DIR, `${tpl.id}.json`)
    const contentFilePath = `templates/${tpl.id}.json` // 相对于 DATA_DIR 的路径

    // 检查源文件是否存在
    if (!fs.existsSync(srcFile)) {
      console.warn(`[seed-templates] ⚠️  源文件不存在，跳过: ${srcFile}`)
      skipCount++
      continue
    }

    // 读取源文件内容
    const jsonContent = fs.readFileSync(srcFile, 'utf-8')
    const slideCount = countSlides(jsonContent)

    // 复制文件到后端 data/templates/
    fs.copyFileSync(srcFile, destFile)
    console.log(`[seed-templates] 已复制文件: ${tpl.id}.json (${slideCount} 页)`)

    // 封面：索引中有则用索引值，否则用默认 /covers/{id}.webp
    const cover = tpl.cover && typeof tpl.cover === 'string' ? tpl.cover : `/covers/${tpl.id}.webp`

    // 写入数据库（存在则跳过，不覆盖）
    const existing = await prisma.templates.findUnique({ where: { id: tpl.id } })
    if (existing) {
      console.log(`[seed-templates] ⏭️  已存在，跳过: ${tpl.id} (${tpl.name})`)
      skipCount++
      continue
    }

    await prisma.templates.create({
      data: {
        id: tpl.id,
        name: tpl.name,
        cover,
        category: tpl.category,
        origin: tpl.origin,
        status: tpl.status,
        slide_count: slideCount,
        content_file_path: contentFilePath,
        created_by: null,
        updated_by: null,
      },
    })

    console.log(`[seed-templates] ✅ 已导入: ${tpl.id} - ${tpl.name}`)
    successCount++
  }

  console.log(`\n[seed-templates] 完成！成功导入 ${successCount} 个，跳过 ${skipCount} 个`)
}

main()
  .catch((e) => {
    console.error('[seed-templates] 导入失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
