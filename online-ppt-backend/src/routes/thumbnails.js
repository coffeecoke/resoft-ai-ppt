import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { thumbnailService } from '../services/thumbnailService.js'
import { documentModel } from '../models/documentModel.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots')

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
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
    
    console.log(`[预览图] 收到上传请求: documentId=${documentId}, slideId=${slideId}`)
    
    if (!file) {
      return res.status(400).json({ success: false, error: '没有上传文件' })
    }

    if (!documentId || !slideId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    // 生成访问 URL
    const thumbnailUrl = `/snapshots/${documentId}/${file.filename}`
    console.log(`[预览图] 文件已保存: ${file.path}, URL: ${thumbnailUrl}`)
    
    // 获取文档信息
    const doc = await documentModel.findById(documentId)
    if (!doc) {
      console.error(`[预览图] 文档不存在: ${documentId}`)
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 找到对应的 slide
    const slide = doc.slides?.find(s => s.id === slideId)
    if (!slide) {
      console.error(`[预览图] 幻灯片不存在: ${slideId}`)
      return res.status(404).json({ success: false, error: '幻灯片不存在' })
    }

    // 更新文档 JSON 中的 thumbnail 字段（保留兼容性）
    const docPath = path.join(DOCUMENTS_DIR, `${documentId}.json`)
    if (fs.existsSync(docPath)) {
      try {
        const docContent = fs.readFileSync(docPath, 'utf-8')
        const docData = JSON.parse(docContent)
        const slideIndex = docData.slides.findIndex(s => s.id === slideId)
        if (slideIndex !== -1) {
          docData.slides[slideIndex].thumbnail = thumbnailUrl
          docData.slides[slideIndex].thumbnailUpdatedAt = new Date().toISOString()
          fs.writeFileSync(docPath, JSON.stringify(docData, null, 2), 'utf-8')
          console.log(`[预览图] 已更新文档JSON文件: slideIndex=${slideIndex}`)
        }
      } catch (error) {
        console.warn('[预览图] 更新文档文件失败:', error)
      }
    }

    // 保存到数据库
    const thumbnailId = `thumb_${documentId}_${slideId}`
    const slideIndex = doc.slides.findIndex(s => s.id === slideId)
    
    console.log(`[预览图] 准备写入数据库: thumbnailId=${thumbnailId}, slideIndex=${slideIndex}`)
    
    const dbResult = await thumbnailService.upsert({
      id: thumbnailId,
      documentId,
      slideId,
      slideIndex,
      url: thumbnailUrl,
      width: 800,
      height: Math.round(800 * ((doc.height || 562.5) / (doc.width || 1000))),
      size: file.size,
      format: file.mimetype.split('/')[1],
      metadata: {
        hasText: slide.elements?.some(el => el.type === 'text') || false,
        hasImage: slide.elements?.some(el => el.type === 'image') || false,
        elementCount: slide.elements?.length || 0
      }
    })

    console.log(`[预览图] 数据库写入成功: ${documentId}/${slideId}, dbResult:`, dbResult ? '成功' : '失败')

    res.json({ 
      success: true, 
      thumbnailUrl,
      message: '预览图上传成功' 
    })
  } catch (error) {
    console.error('[预览图] 上传失败:', error)
    console.error('[预览图] 错误堆栈:', error.stack)
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
    
    const result = await thumbnailService.getAll({ documentId, limit, offset })
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[预览图] 获取列表失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取预览图列表失败' })
  }
})

/**
 * 获取单个预览图的详细信息（包含溯源信息）
 * GET /api/thumbnails/:thumbnailId
 */
router.get('/:thumbnailId', async (req, res) => {
  try {
    const { thumbnailId } = req.params
    
    const result = await thumbnailService.getById(thumbnailId)
    
    if (!result) {
      return res.status(404).json({ success: false, error: '预览图不存在' })
    }
    
    // 获取原始幻灯片信息（从文档文件）
    const doc = await documentModel.findById(result.thumbnail.documentId)
    if (doc && doc.slides) {
      const slide = doc.slides.find(s => s.id === result.thumbnail.slideId)
      if (slide) {
        result.source.slide = {
          id: slide.id,
          index: result.thumbnail.slideIndex,
          elements: slide.elements?.map(el => ({
            type: el.type,
            id: el.id
          })) || []
        }
      }
    }
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[预览图] 获取详情失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取预览图详情失败' })
  }
})

/**
 * 按文档获取预览图列表
 * GET /api/thumbnails/document/:documentId
 */
router.get('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    
    const result = await thumbnailService.getByDocumentId(documentId)
    
    res.json({
      success: true,
      data: {
        documentId: result.documentId,
        documentTitle: result.documentTitle,
        total: result.thumbnails.length,
        thumbnails: result.thumbnails,
        lastUpdated: result.lastUpdated
      }
    })
  } catch (error) {
    console.error('[预览图] 获取文档预览图失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取文档预览图失败' })
  }
})

/**
 * 重建预览图索引（从文档文件同步到数据库）
 * POST /api/thumbnails/rebuild-index
 */
router.post('/rebuild-index', async (req, res) => {
  try {
    const files = fs.readdirSync(DOCUMENTS_DIR)
    let totalThumbnails = 0
    const documentStats = []
    
    // 遍历所有文档
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      
      const documentId = file.replace('.json', '')
      const docPath = path.join(DOCUMENTS_DIR, file)
      const content = fs.readFileSync(docPath, 'utf-8')
      const docData = JSON.parse(content)
      
      let thumbnailCount = 0
      
      // 遍历文档中的所有幻灯片，同步到数据库
      for (let index = 0; index < docData.slides.length; index++) {
        const slide = docData.slides[index]
        if (slide.thumbnail) {
          const thumbUrl = typeof slide.thumbnail === 'string' 
            ? slide.thumbnail 
            : slide.thumbnail.url
          
          const thumbnailId = `thumb_${documentId}_${slide.id}`
          
          try {
            await thumbnailService.upsert({
              id: thumbnailId,
              documentId,
              slideId: slide.id,
              slideIndex: index,
              url: thumbUrl,
              width: 800,
              height: Math.round(800 * ((docData.height || 562.5) / (docData.width || 1000))),
              size: 0,
              format: 'jpeg',
              generatedAt: slide.thumbnailUpdatedAt || new Date().toISOString(),
              metadata: {
                hasText: slide.elements?.some(el => el.type === 'text') || false,
                hasImage: slide.elements?.some(el => el.type === 'image') || false,
                elementCount: slide.elements?.length || 0
              }
            })
            thumbnailCount++
          } catch (error) {
            console.warn(`[预览图] 同步缩略图失败: ${thumbnailId}`, error.message)
          }
        }
      }
      
      if (thumbnailCount > 0) {
        totalThumbnails += thumbnailCount
        documentStats.push({
          documentId,
          documentTitle: docData.title || '未命名文档',
          thumbnailCount
        })
      }
    }
    
    console.log(`[预览图] 索引重建成功，共 ${totalThumbnails} 个预览图，涉及 ${documentStats.length} 个文档`)
    
    res.json({
      success: true,
      data: {
        total: totalThumbnails,
        documentCount: documentStats.length,
        documents: documentStats,
        message: '索引重建成功（已同步到数据库）'
      }
    })
  } catch (error) {
    console.error('[预览图] 重建索引失败:', error)
    res.status(500).json({ success: false, error: error.message || '重建索引失败' })
  }
})

export default router








