import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const router = Router()

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

// 目录与文件路径配置
// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates')
const COVERS_DIR = path.join(DATA_DIR, 'covers')
const TEMPLATE_THUMBS_DIR = path.join(DATA_DIR, 'templates', 'thumbnails')
const INDEX_FILE = path.join(DATA_DIR, 'template-index.json')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true })
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
}

function readIndex() {
  try {
    // 如果索引文件不存在，尝试根据已有模板文件初始化一份默认索引
    if (!fs.existsSync(INDEX_FILE)) {
      ensureDirs()

      // 默认内置模板元信息（与前端 slidesStore.templates 对齐）
      const builtinTemplates = [
        { id: 'template_1', name: '山河映红', origin: '官方制作', category: 'official' },
        { id: 'template_2', name: '都市蓝调', origin: '官方制作', category: 'official' },
        { id: 'template_3', name: '智感几何', origin: '官方制作', category: 'official' },
        { id: 'template_4', name: '柔光莫兰迪', origin: '官方制作', category: 'official' },
        { id: 'template_5', name: '简约绿意', origin: '社区贡献+官方深度完善优化', category: 'community' },
        { id: 'template_6', name: '暖色复古', origin: '社区贡献+官方深度完善优化', category: 'community' },
        { id: 'template_7', name: '深邃沉稳', origin: '社区贡献+官方深度完善优化', category: 'community' },
        { id: 'template_8', name: '浅蓝小清新', origin: '社区贡献+官方深度完善优化', category: 'community' },
      ]

      const now = new Date().toISOString()
      const indexList = builtinTemplates.map(item => {
        // 计算每个模板的页面数量（如果对应的 JSON 文件存在）
        const tplFile = path.join(TEMPLATES_DIR, `${item.id}.json`)
        let slideCount = 0
        if (fs.existsSync(tplFile)) {
          try {
            const content = fs.readFileSync(tplFile, 'utf-8')
            const json = JSON.parse(content)
            if (Array.isArray(json.slides)) {
              slideCount = json.slides.length
            }
          } catch (e) {
            console.warn(`[模板] 读取模板文件失败: ${tplFile}`, e)
          }
        }

        return {
          id: item.id,
          name: item.name,
          // 后端内部使用的封面路径，前端会拼上 SERVER_URL
          cover: `/covers/${item.id}.webp`,
          category: item.category,
          origin: item.origin,
          status: 'published',
          slideCount,
          createdAt: now,
          updatedAt: now,
        }
      })

      writeIndex(indexList)
      return indexList
    }

    const content = fs.readFileSync(INDEX_FILE, 'utf-8')
    if (!content.trim()) return []
    return JSON.parse(content)
  } catch (error) {
    console.error('[模板] 读取索引失败:', error)
    return []
  }
}

function writeIndex(list) {
  ensureDirs()
  fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function generateTemplateId(indexList) {
  const START_FROM = 9 // 前端已有 template_1 ~ template_8
  const nums = indexList
    .map(item => {
      if (!item.id || typeof item.id !== 'string') return NaN
      const m = item.id.match(/^template_(\d+)$/)
      return m ? Number(m[1]) : NaN
    })
    .filter(n => !Number.isNaN(n))

  const max = nums.length ? Math.max(...nums, START_FROM - 1) : START_FROM - 1
  return `template_${max + 1}`
}

// 从幻灯片数据中获取封面图（使用第一页的缩略图）
function getCoverFromSlides(slides) {
  if (slides && slides.length > 0) {
    const firstSlide = slides[0]
    if (firstSlide.thumbnail) {
      return firstSlide.thumbnail
    }
  }
  return '' // 如果没有缩略图，返回空字符串
}

// 创建空模板
router.post('/create', (req, res) => {
  try {
    const { name, category = 'uncategorized', initialLayout = 'blank' } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '模板名称不能为空' })
    }

    ensureDirs()

    const indexList = readIndex()
    const id = generateTemplateId(indexList)

    // 构造初始 slides：至少一页空白页，避免前端无页面无法渲染
    const baseSlide = {
      id: `slide_${Date.now()}`,
      elements: [],
    }

    // 默认一页空白页；后续如需更多布局可在此扩展
    let slides = [baseSlide]

    // 预留：basic 布局示例（封面 / 内容 / 结束），当前简单复制空白页并设置类型
    if (initialLayout === 'basic') {
      slides = [
        { ...baseSlide, id: `${baseSlide.id}_1`, type: 'cover' },
        { ...baseSlide, id: `${baseSlide.id}_2`, type: 'content' },
        { ...baseSlide, id: `${baseSlide.id}_3`, type: 'end' },
      ]
    }

    // 使用完整的默认 theme，与前端 slidesStore 默认值对齐
    const defaultTheme = {
      themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
      fontColor: '#333',
      fontName: '',
      backgroundColor: '#fff',
      shadow: {
        h: 3,
        v: 3,
        blur: 2,
        color: '#808080',
      },
      outline: {
        width: 2,
        color: '#525252',
        style: 'solid',
      },
    }

    const templateData = {
      title: name,
      width: 1000,
      height: 562.5,
      theme: defaultTheme,
      slides,
    }

    // 写入模板文件
    const filename = path.join(TEMPLATES_DIR, `${id}.json`)
    fs.writeFileSync(filename, JSON.stringify(templateData, null, 2), 'utf-8')

    const now = new Date().toISOString()
    
    // 自动从第一页缩略图获取封面
    const cover = getCoverFromSlides(templateData.slides)

    const meta = {
      id,
      name,
      cover, // 封面图URL（自动从第一页缩略图获取）
      category,
      origin: 'user',
      status: 'draft',
      slideCount: templateData.slides.length,
      createdAt: now,
      updatedAt: now,
    }

    indexList.push(meta)
    writeIndex(indexList)

    console.log(`[模板] 新建模板: ${id} - ${name}`)

    res.json({
      success: true,
      data: meta,
    })
  } catch (error) {
    console.error('[模板] 新建模板失败:', error)
    res.status(500).json({ success: false, error: '新建模板失败' })
  }
})

// 获取模板列表
router.get('/', (req, res) => {
  try {
    const { page = 1, pageSize = 20, category, status } = req.query

    const list = readIndex()

    let filtered = list
    if (category && typeof category === 'string') {
      filtered = filtered.filter(item => item.category === category)
    }
    if (status && typeof status === 'string') {
      filtered = filtered.filter(item => item.status === status)
    }

    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const start = (p - 1) * ps
    const end = start + ps

    const pageList = filtered.slice(start, end)

    res.json({
      success: true,
      data: {
        list: pageList,
        total: filtered.length,
        page: p,
        pageSize: ps,
      },
    })
  } catch (error) {
    console.error('[模板] 获取列表失败:', error)
    res.status(500).json({ success: false, error: '获取模板列表失败' })
  }
})

// 获取模板详情（包含完整JSON）
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const meta = indexList.find(item => item.id === id)
    if (!meta) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const filename = path.join(TEMPLATES_DIR, `${id}.json`)
    if (!fs.existsSync(filename)) {
      return res.status(404).json({ success: false, error: '模板文件不存在' })
    }

    const content = fs.readFileSync(filename, 'utf-8')
    const templateData = JSON.parse(content)

    res.json({
      success: true,
      data: {
        ...meta,
        templateData,
      },
    })
  } catch (error) {
    console.error('[模板] 获取详情失败:', error)
    res.status(500).json({ success: false, error: '获取模板详情失败' })
  }
})

// 更新模板内容（自动保存/手动保存）
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params
    const { templateData, autoSave = false } = req.body || {}

    if (!templateData) {
      return res.status(400).json({ success: false, error: '缺少模板数据 templateData' })
    }

    ensureDirs()

    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    // 写入模板文件
    const filename = path.join(TEMPLATES_DIR, `${id}.json`)
    fs.writeFileSync(filename, JSON.stringify(templateData, null, 2), 'utf-8')

    // 自动从第一页缩略图更新封面
    const cover = getCoverFromSlides(templateData.slides)

    const now = new Date().toISOString()
    indexList[metaIndex] = {
      ...indexList[metaIndex],
      cover, // 每次更新都同步封面
      slideCount: Array.isArray(templateData.slides) ? templateData.slides.length : 0,
      updatedAt: now,
    }
    writeIndex(indexList)

    console.log(`[模板] 更新模板: ${id} (autoSave=${autoSave})`)

    res.json({
      success: true,
      data: {
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('[模板] 更新模板失败:', error)
    res.status(500).json({ success: false, error: '更新模板失败' })
  }
})

// 发布模板（draft -> published）
router.post('/:id/publish', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    // 读取模板数据，检查是否有页面未标注类型
    const filename = path.join(TEMPLATES_DIR, `${id}.json`)
    if (!fs.existsSync(filename)) {
      return res.status(404).json({ success: false, error: '模板文件不存在' })
    }

    const content = fs.readFileSync(filename, 'utf-8')
    const templateData = JSON.parse(content)
    const slides = templateData.slides || []

    // 统计未标注的页面数量（不再阻止发布，仅记录）
    let skippedCount = 0
    slides.forEach(slide => {
      if (!slide.type || slide.type === '') {
        skippedCount++
      }
    })

    // 至少需要有一个已标注的页面
    if (skippedCount === slides.length) {
      return res.status(400).json({
        success: false,
        error: '发布失败：所有页面均未标注类型，请至少标注一个页面后再发布',
      })
    }

    const now = new Date().toISOString()
    indexList[metaIndex] = {
      ...indexList[metaIndex],
      status: 'published',
      updatedAt: now,
    }
    writeIndex(indexList)

    console.log(`[模板] 发布模板: ${id}`)

    res.json({
      success: true,
      data: {
        id,
        status: 'published',
        updatedAt: now,
        skippedCount,
      },
    })
  } catch (error) {
    console.error('[模板] 发布模板失败:', error)
    res.status(500).json({ success: false, error: '发布模板失败' })
  }
})

// 删除模板
// 对于 draft 状态的模板：物理删除（真正删除文件）
// 对于 published 状态的模板：软删除（改为 archived，保留数据）
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params
    const indexList = readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex === -1) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    const meta = indexList[metaIndex]
    const status = meta.status || 'draft'

    // 如果是草稿（draft），物理删除：删除文件并从索引中移除
    if (status === 'draft') {
      // 删除模板 JSON 文件
      const templateFile = path.join(TEMPLATES_DIR, `${id}.json`)
      if (fs.existsSync(templateFile)) {
        fs.unlinkSync(templateFile)
      }

      // 从索引中移除
      indexList.splice(metaIndex, 1)
      writeIndex(indexList)

      console.log(`[模板] 物理删除模板: ${id}`)

      res.json({
        success: true,
        data: {
          id,
          deleted: true,
        },
      })
    } else {
      // 如果是已发布的模板，软删除（改为 archived）
      const now = new Date().toISOString()
      indexList[metaIndex] = {
        ...indexList[metaIndex],
        status: 'archived',
        updatedAt: now,
      }
      writeIndex(indexList)

      console.log(`[模板] 软删除模板(归档): ${id}`)

      res.json({
        success: true,
        data: {
          id,
          status: 'archived',
          updatedAt: now,
        },
      })
    }
  } catch (error) {
    console.error('[模板] 删除模板失败:', error)
    res.status(500).json({ success: false, error: '删除模板失败' })
  }
})

// 上传模板页缩略图（base64 JSON 方式）
// POST /templates/:id/thumbnails/:slideId
// Body: { imageData: 'data:image/jpeg;base64,...' }
router.post('/:id/thumbnails/:slideId', (req, res) => {
  try {
    const { id, slideId } = req.params
    const { imageData } = req.body || {}

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ success: false, error: '缺少 imageData 字段' })
    }

    // 解析 base64 数据
    const matches = imageData.match(/^data:image\/(\w+);base64,(.+)$/)
    if (!matches) {
      return res.status(400).json({ success: false, error: 'imageData 格式无效' })
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')

    // 确保目标目录存在
    const thumbDir = path.join(TEMPLATE_THUMBS_DIR, id)
    if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true })

    // 写入文件
    const filename = `${slideId}.${ext}`
    const filePath = path.join(thumbDir, filename)
    fs.writeFileSync(filePath, buffer)

    // 生成访问 URL
    const thumbnailUrl = `/templates/thumbnails/${id}/${filename}`

    // 更新模板 JSON 中对应 slide 的 thumbnail 字段
    const templateFile = path.join(TEMPLATES_DIR, `${id}.json`)
    if (fs.existsSync(templateFile)) {
      try {
        const templateData = JSON.parse(fs.readFileSync(templateFile, 'utf-8'))
        if (Array.isArray(templateData.slides)) {
          const slideIdx = templateData.slides.findIndex(s => s.id === slideId)
          if (slideIdx !== -1) {
            templateData.slides[slideIdx].thumbnail = thumbnailUrl
            fs.writeFileSync(templateFile, JSON.stringify(templateData, null, 2), 'utf-8')
          }
        }
      } catch (e) {
        console.warn(`[模板缩略图] 更新模板JSON失败: ${id}`, e)
      }
    }

    // 更新索引中的 cover（取第一个有 thumbnail 的页面）
    const indexList = readIndex()
    const metaIdx = indexList.findIndex(item => item.id === id)
    if (metaIdx !== -1) {
      const templateFile2 = path.join(TEMPLATES_DIR, `${id}.json`)
      if (fs.existsSync(templateFile2)) {
        try {
          const templateData2 = JSON.parse(fs.readFileSync(templateFile2, 'utf-8'))
          const cover = getCoverFromSlides(templateData2.slides)
          if (cover) {
            indexList[metaIdx].cover = cover
            indexList[metaIdx].updatedAt = new Date().toISOString()
            writeIndex(indexList)
          }
        } catch (e) {
          console.warn(`[模板缩略图] 更新索引封面失败: ${id}`, e)
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



