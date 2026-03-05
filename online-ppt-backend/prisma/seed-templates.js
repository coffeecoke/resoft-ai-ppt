/**
 * 模版数据种子脚本
 * 
 * 将前端 public/mocks/template_*.json 中的8个内置模版数据导入数据库，
 * 并把对应的 JSON 文件复制到后端 data/templates/ 目录。
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

// 前端 mock 文件目录（相对于 online-ppt-backend 向上一级找 online-ppt-web）
const FRONTEND_MOCKS_DIR = path.join(__dirname, '..', '..', 'online-ppt-web', 'public', 'mocks')

// 8个内置模版元信息（与 routes/templates.js 中的 builtinTemplates 保持一致）
const BUILTIN_TEMPLATES = [
  { id: 'template_1', name: '山河映红',   origin: '官方制作',                 category: 'official'  },
  { id: 'template_2', name: '都市蓝调',   origin: '官方制作',                 category: 'official'  },
  { id: 'template_3', name: '智感几何',   origin: '官方制作',                 category: 'official'  },
  { id: 'template_4', name: '柔光莫兰迪', origin: '官方制作',                 category: 'official'  },
  { id: 'template_5', name: '简约绿意',   origin: '社区贡献+官方深度完善优化', category: 'community' },
  { id: 'template_6', name: '暖色复古',   origin: '社区贡献+官方深度完善优化', category: 'community' },
  { id: 'template_7', name: '深邃沉稳',   origin: '社区贡献+官方深度完善优化', category: 'community' },
  { id: 'template_8', name: '浅蓝小清新', origin: '社区贡献+官方深度完善优化', category: 'community' },
]

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
  console.log('[seed-templates] 开始导入内置模版数据...')

  // 确保目标目录存在
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
    console.log(`[seed-templates] 已创建目录: ${TEMPLATES_DIR}`)
  }

  let successCount = 0
  let skipCount = 0

  for (const tpl of BUILTIN_TEMPLATES) {
    const srcFile = path.join(FRONTEND_MOCKS_DIR, `${tpl.id}.json`)
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

    // 封面图路径（文件存在于 data/covers/template_x.webp）
    const cover = `/covers/${tpl.id}.webp`

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
        status: 'published', // 内置模版直接设为已发布
        slide_count: slideCount,
        content_file_path: contentFilePath,
        created_by: null, // 内置模版无创建人
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
