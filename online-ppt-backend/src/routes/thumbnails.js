import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots')
const THUMBNAILS_DIR = path.join(DATA_DIR, 'thumbnails')
const THUMBNAILS_INDEX_FILE = path.join(THUMBNAILS_DIR, 'index.json')

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
  if (!fs.existsSync(THUMBNAILS_DIR)) fs.mkdirSync(THUMBNAILS_DIR, { recursive: true })
}

// 读取预览图索引
function readThumbnailIndex() {
  try {
    ensureDirs()
    
    if (!fs.existsSync(THUMBNAILS_INDEX_FILE)) {
      const emptyIndex = {
        lastUpdated: new Date().toISOString(),
        thumbnails: []
      }
      fs.writeFileSync(THUMBNAILS_INDEX_FILE, JSON.stringify(emptyIndex, null, 2), 'utf-8')
      return emptyIndex
    }

    const content = fs.readFileSync(THUMBNAILS_INDEX_FILE, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('[预览图] 读取索引失败:', error)
    return { lastUpdated: new Date().toISOString(), thumbnails: [] }
  }
}

// 写入预览图索引
function writeThumbnailIndex(indexData) {
  ensureDirs()
  fs.writeFileSync(THUMBNAILS_INDEX_FILE, JSON.stringify(indexData, null, 2), 'utf-8')
}

// 配置 multer 文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { documentId } = req.body
    if (!documentId) {
      return cb(new Error('缺少 documentId 参数'))
    }
    
    const dir = path.join(SNAPSHOTS_DIR, documentId)
    
    // 确保目录存在
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    const { slideId } = req.body
    if (!slideId) {
      return cb(new Error('缺少 slideId 参数'))
    }
    
    // 使用 slideId 作为文件名
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, `${slideId}${ext}`)
  }
})

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 限制 5MB
  fileFilter: (req, file, cb) => {
    // 只允许图片文件
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传图片文件'))
    }
  }
})

/**
 * 上传预览图
 * POST /api/thumbnails/upload
 */
router.post('/upload', upload.single('thumbnail'), async (req, res) => {
  try {
    const { documentId, slideId } = req.body
    const file = req.file
    
    if (!file) {
      return res.status(400).json({ success: false, error: '没有上传文件' })
    }

    if (!documentId || !slideId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    // 生成访问 URL
    const thumbnailUrl = `/snapshots/${documentId}/${file.filename}`
    
    // 更新文档 JSON，添加预览图 URL
    const docPath = path.join(DOCUMENTS_DIR, `${documentId}.json`)
    if (fs.existsSync(docPath)) {
      try {
        const docContent = fs.readFileSync(docPath, 'utf-8')
        const docData = JSON.parse(docContent)
        
        // 找到对应的 slide 并更新 thumbnail 字段
        const slide = docData.slides.find(s => s.id === slideId)
        if (slide) {
          slide.thumbnail = thumbnailUrl
          slide.thumbnailUpdatedAt = new Date().toISOString()
          
          // 保存更新后的文档
          fs.writeFileSync(docPath, JSON.stringify(docData, null, 2), 'utf-8')
        }

        // 更新预览图索引
        const indexData = readThumbnailIndex()
        const thumbnailId = `thumb_${documentId}_${slideId}`
        
        // 查找是否已存在
        const existingIndex = indexData.thumbnails.findIndex(t => t.id === thumbnailId)
        
        const thumbnailMeta = {
          id: thumbnailId,
          documentId,
          documentTitle: docData.title || '未命名文档',
          slideId,
          slideIndex: docData.slides.findIndex(s => s.id === slideId),
          url: thumbnailUrl,
          width: 800,
          height: Math.round(800 * (docData.height / docData.width)),
          size: file.size,
          format: file.mimetype.split('/')[1],
          generatedAt: new Date().toISOString(),
          metadata: {
            hasText: slide.elements.some(el => el.type === 'text'),
            hasImage: slide.elements.some(el => el.type === 'image'),
            elementCount: slide.elements.length
          }
        }

        if (existingIndex !== -1) {
          // 更新现有记录
          indexData.thumbnails[existingIndex] = thumbnailMeta
        } else {
          // 添加新记录
          indexData.thumbnails.push(thumbnailMeta)
        }

        indexData.lastUpdated = new Date().toISOString()
        writeThumbnailIndex(indexData)

        console.log(`[预览图] 上传成功: ${documentId}/${slideId}`)

        res.json({ 
          success: true, 
          thumbnailUrl,
          message: '预览图上传成功' 
        })
      } catch (error) {
        console.error('[预览图] 更新文档失败:', error)
        res.status(500).json({ success: false, error: '更新文档失败' })
      }
    } else {
      res.status(404).json({ success: false, error: '文档不存在' })
    }
  } catch (error) {
    console.error('[预览图] 上传失败:', error)
    res.status(500).json({ success: false, error: '上传失败: ' + error.message })
  }
})

/**
 * 获取预览图列表
 * GET /api/thumbnails
 * 查询参数：documentId, limit, offset
 */
router.get('/', async (req, res) => {
  try {
    const { documentId, limit = 100, offset = 0 } = req.query
    
    const indexData = readThumbnailIndex()
    let thumbnails = indexData.thumbnails || []
    
    // 按文档 ID 筛选
    if (documentId) {
      thumbnails = thumbnails.filter(t => t.documentId === documentId)
    }
    
    // 分页
    const total = thumbnails.length
    const paginatedThumbnails = thumbnails.slice(
      parseInt(offset), 
      parseInt(offset) + parseInt(limit)
    )
    
    res.json({
      success: true,
      data: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        thumbnails: paginatedThumbnails,
        lastUpdated: indexData.lastUpdated
      }
    })
  } catch (error) {
    console.error('[预览图] 获取列表失败:', error)
    res.status(500).json({ success: false, error: '获取预览图列表失败' })
  }
})

/**
 * 获取单个预览图的详细信息（包含溯源信息）
 * GET /api/thumbnails/:thumbnailId
 */
router.get('/:thumbnailId', async (req, res) => {
  try {
    const { thumbnailId } = req.params
    
    const indexData = readThumbnailIndex()
    const thumbnail = indexData.thumbnails.find(t => t.id === thumbnailId)
    
    if (!thumbnail) {
      return res.status(404).json({ success: false, error: '预览图不存在' })
    }
    
    // 获取原始文档信息（溯源）
    const docPath = path.join(DOCUMENTS_DIR, `${thumbnail.documentId}.json`)
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ success: false, error: '原始文档不存在' })
    }

    const docContent = fs.readFileSync(docPath, 'utf-8')
    const docData = JSON.parse(docContent)
    
    // 获取原始幻灯片信息
    const slide = docData.slides.find(s => s.id === thumbnail.slideId)
    
    res.json({
      success: true,
      data: {
        thumbnail,
        source: {
          document: {
            id: thumbnail.documentId,
            title: docData.title,
            width: docData.width,
            height: docData.height,
            totalSlides: docData.slides.length
          },
          slide: {
            id: slide.id,
            index: thumbnail.slideIndex,
            elements: slide.elements.map(el => ({
              type: el.type,
              id: el.id
            }))
          }
        }
      }
    })
  } catch (error) {
    console.error('[预览图] 获取详情失败:', error)
    res.status(500).json({ success: false, error: '获取预览图详情失败' })
  }
})

/**
 * 按文档获取预览图列表
 * GET /api/thumbnails/document/:documentId
 */
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    
    const indexData = readThumbnailIndex()
    const thumbnails = indexData.thumbnails
      .filter(t => t.documentId === documentId)
      .sort((a, b) => a.slideIndex - b.slideIndex)
    
    res.json({
      success: true,
      data: {
        documentId,
        total: thumbnails.length,
        thumbnails
      }
    })
  } catch (error) {
    console.error('[预览图] 获取文档预览图失败:', error)
    res.status(500).json({ success: false, error: '获取文档预览图失败' })
  }
})

/**
 * 重建预览图索引
 * POST /api/thumbnails/rebuild-index
 */
router.post('/rebuild-index', async (req, res) => {
  try {
    const files = fs.readdirSync(DOCUMENTS_DIR)
    const thumbnails = []
    
    // 遍历所有文档
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      
      const documentId = file.replace('.json', '')
      const docPath = path.join(DOCUMENTS_DIR, file)
      const content = fs.readFileSync(docPath, 'utf-8')
      const docData = JSON.parse(content)
      
      // 遍历文档中的所有幻灯片
      docData.slides.forEach((slide, index) => {
        if (slide.thumbnail) {
          const thumbUrl = typeof slide.thumbnail === 'string' 
            ? slide.thumbnail 
            : slide.thumbnail.url
          
          thumbnails.push({
            id: `thumb_${documentId}_${slide.id}`,
            documentId,
            documentTitle: docData.title,
            slideId: slide.id,
            slideIndex: index,
            url: thumbUrl,
            width: 800,
            height: Math.round(800 * (docData.height / docData.width)),
            size: 0,
            format: 'jpeg',
            generatedAt: slide.thumbnailUpdatedAt || new Date().toISOString(),
            metadata: {
              hasText: slide.elements.some(el => el.type === 'text'),
              hasImage: slide.elements.some(el => el.type === 'image'),
              elementCount: slide.elements.length
            }
          })
        }
      })
    }
    
    // 保存索引文件
    const indexData = {
      lastUpdated: new Date().toISOString(),
      thumbnails
    }
    
    writeThumbnailIndex(indexData)
    
    console.log(`[预览图] 索引重建成功，共 ${thumbnails.length} 个预览图`)
    
    res.json({
      success: true,
      data: {
        total: thumbnails.length,
        message: '索引重建成功'
      }
    })
  } catch (error) {
    console.error('[预览图] 重建索引失败:', error)
    res.status(500).json({ success: false, error: '重建索引失败' })
  }
})

export default router




