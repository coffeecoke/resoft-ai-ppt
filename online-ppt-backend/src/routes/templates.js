import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import * as prismaClient from '@prisma/client'

const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

// 目录配置
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates')
const COVERS_DIR = path.join(DATA_DIR, 'covers')
const TEMPLATE_THUMBS_DIR = path.join(DATA_DIR, 'templates', 'thumbnails')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
}

/** 从 templateId 生成递增 ID，从 template_9 开始 */
async function generateTemplateId() {
  const START_FROM = 9
  const all = await prisma.templates.findMany({ select: { id: true } })
  const nums = all
    .map(item => {
      const m = item.id.match(/^template_(\d+)$/)
      return m ? Number(m[1]) : NaN
    })
    .filter(n => !Number.isNaN(n))
  const max = nums.length ? Math.max(...nums, START_FROM - 1) : START_FROM - 1
  return `template_${max + 1}`
}

/** 从幻灯片数组中取第一页缩略图作为封面 */
function getCoverFromSlides(slides) {
  if (Array.isArray(slides) && slides.length > 0 && slides[0].thumbnail) {
    return slides[0].thumbnail
  }
  return ''
}

// ─────────────────────────────────────────────
// POST /templates/create  新建空模板
// ─────────────────────────────────────────────
router.post('/create', async (req, res) => {
  try {
    const { name, category = 'uncategorized', initialLayout = 'blank' } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '模板名称不能为空' })
    }

    ensureDirs()

    const id = await generateTemplateId()

    // 构造初始 slides
    const baseSlide = { id: `slide_${Date.now()}`, elements: [] }
    let slides = [baseSlide]
    if (initialLayout === 'basic') {
      slides = [
        { ...baseSlide, id: `${baseSlide.id}_1`, type: 'cover' },
        { ...baseSlide, id: `${baseSlide.id}_2`, type: 'content' },
        { ...baseSlide, id: `${baseSlide.id}_3`, type: 'end' },
      ]
    }

    const defaultTheme = {
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
      fontColor: '#333',
      fontName: '',
      backgroundColor: '#fff',
      shadow: { h: 3, v: 3, blur: 2, color: '#808080' },
      outline: { width: 2, color: '#525252', style: 'solid' },
    }

    const templateData = {
      title: name,
      width: 1000,
      height: 562.5,
      theme: defaultTheme,
      slides,
    }

    // 写入内容文件
    const contentFilePath = `templates/${id}.json`
    const absFilePath = path.join(DATA_DIR, contentFilePath)
    fs.writeFileSync(absFilePath, JSON.stringify(templateData, null, 2), 'utf-8')

    const cover = getCoverFromSlides(slides)

    // 从请求头提取操作人（如有鉴权中间件注入 req.user）
    const createdBy = req.user?.id || null

    // 写入数据库
    const meta = await prisma.templates.create({
      data: {
        id,
        name,
        cover,
        category,
        origin: 'user',
        status: 'draft',
        slide_count: slides.length,
        content_file_path: contentFilePath,
        created_by: createdBy,
        updated_by: createdBy,
      },
    })

    console.log(`[模板] 新建模板: ${id} - ${name}`)

    res.json({ success: true, data: meta })
  } catch (error) {
    console.error('[模板] 新建模板失败:', error)
    res.status(500).json({ success: false, error: '新建模板失败' })
  }
})

// ─────────────────────────────────────────────
// GET /templates  获取模板列表
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, category, status } = req.query

    const where = {}
    if (category) where.category = category
    if (status) where.status = status

    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const skip = (p - 1) * ps

    const [list, total] = await Promise.all([
      prisma.templates.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip,
        take: ps,
      }),
      prisma.templates.count({ where }),
    ])

    res.json({
      success: true,
      data: { list, total, page: p, pageSize: ps },
    })
  } catch (error) {
    console.error('[模板] 获取列表失败:', error)
    res.status(500).json({ success: false, error: '获取模板列表失败' })
  }
})

// ─────────────────────────────────────────────
// GET /templates/:id  获取模板详情（含完整JSON）
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const meta = await prisma.templates.findUnique({ where: { id } })
    if (!meta) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    // 读取内容文件
    const absFilePath = path.join(DATA_DIR, meta.content_file_path)
    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ success: false, error: '模板文件不存在' })
    }

    const templateData = JSON.parse(fs.readFileSync(absFilePath, 'utf-8'))

    res.json({
      success: true,
      data: { ...meta, templateData },
    })
  } catch (error) {
    console.error('[模板] 获取详情失败:', error)
    res.status(500).json({ success: false, error: '获取模板详情失败' })
  }
})

// ─────────────────────────────────────────────
// PUT /templates/:id  更新模板内容
// ─────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { templateData, autoSave = false } = req.body || {}

    if (!templateData) {
      return res.status(400).json({ success: false, error: '缺少模板数据 templateData' })
    }

    const meta = await prisma.templates.findUnique({ where: { id } })
    if (!meta) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    ensureDirs()

    // 写入内容文件
    const absFilePath = path.join(DATA_DIR, meta.content_file_path)
    fs.writeFileSync(absFilePath, JSON.stringify(templateData, null, 2), 'utf-8')

    // 更新封面和页数
    const cover = getCoverFromSlides(templateData.slides)
    const slideCount = Array.isArray(templateData.slides) ? templateData.slides.length : 0
    const updatedBy = req.user?.id || null

    const updateData = {
      slide_count: slideCount,
      updated_by: updatedBy,
    }
    if (cover) updateData.cover = cover

    await prisma.templates.update({ where: { id }, data: updateData })

    console.log(`[模板] 更新模板: ${id} (autoSave=${autoSave})`)

    res.json({ success: true, data: { updatedAt: new Date().toISOString() } })
  } catch (error) {
    console.error('[模板] 更新模板失败:', error)
    res.status(500).json({ success: false, error: '更新模板失败' })
  }
})

// ─────────────────────────────────────────────
// POST /templates/:id/publish  发布模板
// ─────────────────────────────────────────────
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params

    const meta = await prisma.templates.findUnique({ where: { id } })
    if (!meta) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const absFilePath = path.join(DATA_DIR, meta.content_file_path)
    if (!fs.existsSync(absFilePath)) {
      return res.status(404).json({ success: false, error: '模板文件不存在' })
    }

    const templateData = JSON.parse(fs.readFileSync(absFilePath, 'utf-8'))
    const slides = templateData.slides || []

    // 至少需要有一个已标注类型的页面
    const typedCount = slides.filter(s => s.type && s.type !== '').length
    if (typedCount === 0) {
      return res.status(400).json({
        success: false,
        error: '发布失败：所有页面均未标注类型，请至少标注一个页面后再发布',
      })
    }

    const skippedCount = slides.length - typedCount
    const updatedBy = req.user?.id || null

    await prisma.templates.update({
      where: { id },
      data: { status: 'published', updated_by: updatedBy },
    })

    console.log(`[模板] 发布模板: ${id}`)

    res.json({
      success: true,
      data: { id, status: 'published', updatedAt: new Date().toISOString(), skippedCount },
    })
  } catch (error) {
    console.error('[模板] 发布模板失败:', error)
    res.status(500).json({ success: false, error: '发布模板失败' })
  }
})

// ─────────────────────────────────────────────
// DELETE /templates/:id  删除模板
// draft → 物理删除；published → 软删除(archived)
// ─────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const meta = await prisma.templates.findUnique({ where: { id } })
    if (!meta) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    if (meta.status === 'draft') {
      // 物理删除文件
      const absFilePath = path.join(DATA_DIR, meta.content_file_path)
      if (fs.existsSync(absFilePath)) fs.unlinkSync(absFilePath)

      // 从数据库删除
      await prisma.templates.delete({ where: { id } })

      console.log(`[模板] 物理删除模板: ${id}`)
      res.json({ success: true, data: { id, deleted: true } })
    } else {
      // 软删除（归档）
      const updatedBy = req.user?.id || null
      await prisma.templates.update({
        where: { id },
        data: { status: 'archived', updated_by: updatedBy },
      })

      console.log(`[模板] 软删除模板(归档): ${id}`)
      res.json({
        success: true,
        data: { id, status: 'archived', updatedAt: new Date().toISOString() },
      })
    }
  } catch (error) {
    console.error('[模板] 删除模板失败:', error)
    res.status(500).json({ success: false, error: '删除模板失败' })
  }
})

// ─────────────────────────────────────────────
// POST /templates/:id/thumbnails/:slideId  上传缩略图
// ─────────────────────────────────────────────
router.post('/:id/thumbnails/:slideId', async (req, res) => {
  try {
    const { id, slideId } = req.params
    const { imageData } = req.body || {}

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 imageData 字段' })
    }

    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return res.status(400).json({ success: false, error: 'imageData 格式无效' })
    }

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const buffer = Buffer.from(matches[2], 'base64')

    // 写入缩略图文件
    const thumbDir = path.join(TEMPLATE_THUMBS_DIR, id)
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true })

    const filename = `${slideId}.${ext}`
    fs.writeFileSync(path.join(thumbDir, filename), buffer)

    const thumbnailUrl = `/templates/thumbnails/${id}/${filename}`

    // 更新内容文件中对应 slide 的 thumbnail 字段
    const meta = await prisma.templates.findUnique({ where: { id } })
    if (meta) {
      const absFilePath = path.join(DATA_DIR, meta.content_file_path)
      if (fs.existsSync(absFilePath)) {
        try {
          const templateData = JSON.parse(fs.readFileSync(absFilePath, 'utf-8'))
          if (Array.isArray(templateData.slides)) {
            const idx = templateData.slides.findIndex(s => s.id === slideId)
            if (idx !== -1) {
              templateData.slides[idx].thumbnail = thumbnailUrl
              fs.writeFileSync(absFilePath, JSON.stringify(templateData, null, 2), 'utf-8')

              // 如果是第一页，同步更新数据库封面
              if (idx === 0) {
                const updatedBy = req.user?.id || null
                await prisma.templates.update({
                  where: { id },
                  data: { cover: thumbnailUrl, updated_by: updatedBy },
                })
              }
            }
          }
        } catch (e) {
          console.warn(`[模板缩略图] 更新模板JSON失败: ${id}`, e)
        }
      }
    }

    console.log(`[模板缩略图] 已保存: ${id}/${slideId} -> ${thumbnailUrl}`)
    res.json({ success: true, thumbnailUrl })
  } catch (error) {
    console.error('[模板缩略图] 上传失败:', error)
    res.status(500).json({ success: false, error: '上传失败: ' + error.message })
  }
})

export default router
