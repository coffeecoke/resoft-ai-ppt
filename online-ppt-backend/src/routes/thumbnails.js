import { Router } from 'express'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { thumbnailService } from '../services/thumbnailService.js'
import { documentModel } from '../models/documentModel.js'
import thumbnailQueue from '../services/thumbnailQueue.js'

const router = Router()

// 加载环境变量
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const SNAPSHOTS_DIR = path.join(DATA_DIR, 'snapshots')

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })
}

// 配置 multer 文件上传（使用临时目录，后续再移动到正确位置）
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 先保存到临时目录
    const tempDir = path.join(SNAPSHOTS_DIR, 'temp')
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }
    cb(null, tempDir)
  },
  filename: (req, file, cb) => {
    // 使用随机文件名，后续再重命名
    const randomName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    cb(null, randomName)
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

    // 将文件从临时目录移动到正确的位置
    const targetDir = path.join(SNAPSHOTS_DIR, documentId)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const targetFilename = `${slideId}.jpg`
    const targetPath = path.join(targetDir, targetFilename)

    // 移动文件
    fs.renameSync(file.path, targetPath)
    console.log(`[预览图] 文件已移动: ${file.path} -> ${targetPath}`)

    // 生成访问 URL
    const thumbnailUrl = `/snapshots/${documentId}/${targetFilename}`
    console.log(`[预览图] 文件URL: ${thumbnailUrl}`)
    
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
        viewCount: result.viewCount, // 🆕 添加阅读次数
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

/**
 * 批量删除缩略图（删除多个幻灯片时使用）
 * DELETE /api/thumbnails/batch
 * Body: { documentId, slideIds: string[] }
 */
router.delete('/batch', async (req, res) => {
  try {
    const { documentId, slideIds } = req.body

    if (!documentId || !Array.isArray(slideIds) || slideIds.length === 0) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    console.log(`[缩略图] 收到批量删除请求: documentId=${documentId}, slideIds=${slideIds.join(', ')}`)

    const results = []

    for (const slideId of slideIds) {
      try {
        // 1. 删除数据库记录
        const thumbnailId = `thumb_${documentId}_${slideId}`
        await thumbnailService.delete(thumbnailId)

        // 2. 删除文件系统中的图片文件
        const targetPath = path.join(SNAPSHOTS_DIR, documentId, `${slideId}.jpg`)
        if (fs.existsSync(targetPath)) {
          fs.unlinkSync(targetPath)
        }

        results.push({ slideId, success: true })
        console.log(`[缩略图] 已删除: ${slideId}`)
      } catch (error) {
        results.push({ slideId, success: false, error: error.message })
        console.error(`[缩略图] 删除失败: ${slideId}`, error)
      }
    }

    // 3. 批量更新文档 JSON 文件
    const docPath = path.join(DOCUMENTS_DIR, `${documentId}.json`)
    if (fs.existsSync(docPath)) {
      try {
        const docContent = fs.readFileSync(docPath, 'utf-8')
        const docData = JSON.parse(docContent)

        for (const slideId of slideIds) {
          const slideIndex = docData.slides.findIndex(s => s.id === slideId)
          if (slideIndex !== -1) {
            delete docData.slides[slideIndex].thumbnail
            delete docData.slides[slideIndex].thumbnailUpdatedAt
          }
        }

        fs.writeFileSync(docPath, JSON.stringify(docData, null, 2), 'utf-8')
        console.log(`[缩略图] 已批量更新文档JSON文件`)
      } catch (error) {
        console.warn('[缩略图] 更新文档文件失败:', error)
      }
    }

    const successCount = results.filter(r => r.success).length

    res.json({
      success: true,
      message: `成功删除 ${successCount}/${slideIds.length} 个缩略图`,
      results
    })
  } catch (error) {
    console.error('[缩略图] 批量删除失败:', error)
    res.status(500).json({ success: false, error: '批量删除失败: ' + error.message })
  }
})

/**
 * 删除指定幻灯片的缩略图
 * DELETE /api/thumbnails/:documentId/:slideId
 * 注意：这个路由要放在最后，避免和其他路由冲突
 */
router.delete('/:documentId/:slideId', async (req, res) => {
  try {
    const { documentId, slideId } = req.params

    console.log(`[缩略图] 收到删除请求: documentId=${documentId}, slideId=${slideId}`)

    // 1. 删除数据库记录
    const thumbnailId = `thumb_${documentId}_${slideId}`
    await thumbnailService.delete(thumbnailId)
    console.log(`[缩略图] 已删除数据库记录: ${thumbnailId}`)

    // 2. 删除文件系统中的图片文件
    const targetPath = path.join(SNAPSHOTS_DIR, documentId, `${slideId}.jpg`)
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath)
      console.log(`[缩略图] 已删除图片文件: ${targetPath}`)
    } else {
      console.log(`[缩略图] 图片文件不存在，跳过: ${targetPath}`)
    }

    // 3. 更新文档 JSON 文件（移除 thumbnail 字段）
    const docPath = path.join(DOCUMENTS_DIR, `${documentId}.json`)
    if (fs.existsSync(docPath)) {
      try {
        const docContent = fs.readFileSync(docPath, 'utf-8')
        const docData = JSON.parse(docContent)
        const slideIndex = docData.slides.findIndex(s => s.id === slideId)
        if (slideIndex !== -1) {
          delete docData.slides[slideIndex].thumbnail
          delete docData.slides[slideIndex].thumbnailUpdatedAt
          fs.writeFileSync(docPath, JSON.stringify(docData, null, 2), 'utf-8')
          console.log(`[缩略图] 已更新文档JSON文件: slideIndex=${slideIndex}`)
        }
      } catch (error) {
        console.warn('[缩略图] 更新文档文件失败:', error)
      }
    }

    res.json({
      success: true,
      message: '缩略图删除成功'
    })
  } catch (error) {
    console.error('[缩略图] 删除失败:', error)
    res.status(500).json({ success: false, error: '删除失败: ' + error.message })
  }
})

/**
 * 从队列上传缩略图（由前端队列生成任务调用）
 * POST /api/thumbnails/upload-from-queue
 */
router.post('/upload-from-queue', upload.single('file'), async (req, res) => {
  try {
    const { documentId, slideId, taskId } = req.body
    const file = req.file

    console.log(`[缩略图队列] 收到上传请求: documentId=${documentId}, slideId=${slideId}, taskId=${taskId}`)

    if (!file) {
      return res.status(400).json({ success: false, error: '没有上传文件' })
    }

    if (!documentId || !slideId || !taskId) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    // 将文件从临时目录移动到正确的位置
    const targetDir = path.join(SNAPSHOTS_DIR, documentId)
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const targetFilename = `${slideId}.jpg`
    const targetPath = path.join(targetDir, targetFilename)

    // 移动文件
    fs.renameSync(file.path, targetPath)
    console.log(`[缩略图队列] 文件已移动: ${file.path} -> ${targetPath}`)

    // 生成访问 URL
    const thumbnailUrl = `/snapshots/${documentId}/${targetFilename}`
    console.log(`[缩略图队列] 文件URL: ${thumbnailUrl}`)

    // 获取文档信息
    const doc = await documentModel.findById(documentId)
    if (!doc) {
      console.error(`[缩略图队列] 文档不存在: ${documentId}`)

      // 通知队列上传失败
      thumbnailQueue.markUploadComplete(taskId, slideId, { success: false, error: '文档不存在' })

      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 找到对应的 slide
    const slide = doc.slides?.find(s => s.id === slideId)
    if (!slide) {
      console.error(`[缩略图队列] 幻灯片不存在: ${slideId}`)

      // 通知队列上传失败
      thumbnailQueue.markUploadComplete(taskId, slideId, { success: false, error: '幻灯片不存在' })

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
          console.log(`[缩略图队列] 已更新文档JSON文件: slideIndex=${slideIndex}`)
        }
      } catch (error) {
        console.warn('[缩略图队列] 更新文档文件失败:', error)
      }
    }

    // 保存到数据库
    const thumbnailId = `thumb_${documentId}_${slideId}`
    const slideIndex = doc.slides.findIndex(s => s.id === slideId)

    console.log(`[缩略图队列] 准备写入数据库: thumbnailId=${thumbnailId}, slideIndex=${slideIndex}`)

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

    console.log(`[缩略图队列] 数据库写入成功: ${documentId}/${slideId}`)

    // 通知队列上传完成
    thumbnailQueue.markUploadComplete(taskId, slideId, {
      success: true,
      url: thumbnailUrl,
      slideId
    })

    res.json({
      success: true,
      thumbnailUrl,
      message: '缩略图上传成功'
    })
  } catch (error) {
    console.error('[缩略图队列] 上传失败:', error)
    console.error('[缩略图队列] 错误堆栈:', error.stack)

    // 通知队列上传失败
    const { taskId, slideId } = req.body
    if (taskId && slideId) {
      thumbnailQueue.markUploadComplete(taskId, slideId, {
        success: false,
        error: error.message
      })
    }

    res.status(500).json({ success: false, error: '上传失败: ' + error.message })
  }
})

export default router








