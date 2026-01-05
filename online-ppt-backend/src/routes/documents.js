import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { documentService } from '../services/documentService.js'
import { thumbnailService } from '../services/thumbnailService.js'

const router = Router()

// 目录与文件路径配置
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const COVERS_DIR = path.join(DATA_DIR, 'covers')
const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true })
  if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
}

function readIndex() {
  try {
    ensureDirs()
    
    if (!fs.existsSync(INDEX_FILE)) {
      // 文档索引文件不存在，创建空数组
      writeIndex([])
      return []
    }

    const content = fs.readFileSync(INDEX_FILE, 'utf-8')
    if (!content.trim()) return []
    return JSON.parse(content)
  } catch (error) {
    console.error('[文档] 读取索引失败:', error)
    return []
  }
}

function writeIndex(list) {
  ensureDirs()
  fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2), 'utf-8')
}

function generateDocumentId(indexList) {
  const nums = indexList
    .map(item => {
      if (!item.id || typeof item.id !== 'string') return NaN
      const m = item.id.match(/^document_(\d+)$/)
      return m ? Number(m[1]) : NaN
    })
    .filter(n => !Number.isNaN(n))

  const max = nums.length ? Math.max(...nums, 0) : 0
  return `document_${max + 1}`
}

// 从幻灯片数据中获取封面图（使用第一页的缩略图）
function getCoverFromSlides(slides) {
  if (slides && slides.length > 0) {
    const firstSlide = slides[0]
    if (firstSlide.thumbnail) {
      return typeof firstSlide.thumbnail === 'string' 
        ? firstSlide.thumbnail 
        : firstSlide.thumbnail.url
    }
  }
  return '' // 如果没有缩略图，返回空字符串
}

// 计算文件大小（字节）
function getFileSize(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath)
      return stats.size
    }
  } catch (error) {
    console.warn(`[文档] 获取文件大小失败: ${filePath}`, error)
  }
  return 0
}

// 创建文档
router.post('/create', async (req, res) => {
  try {
    const { 
      name, 
      sourceDocumentId, 
      category = 'uncategorized',
      // 新增业务字段
      customerName,
      product,
      industry,
      audience,
      language,
      // 基于PPTX创建时的初始slides
      initialSlides,
      // 文档标签：public=公版, practical=实战
      tag = 'public',
    } = req.body || {}

    console.log(`[文档] 收到创建文档请求: ${name}`)
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '文档名称不能为空' })
    }

    // 检查initialSlides数据大小
    if (initialSlides) {
      const slidesSize = JSON.stringify(initialSlides).length
      const sizeInMB = (slidesSize / (1024 * 1024)).toFixed(2)
      console.log(`[文档] initialSlides数据大小: ${sizeInMB}MB, 页数: ${initialSlides.length}`)
      
      if (slidesSize > 50 * 1024 * 1024) { // 50MB
        console.warn(`[文档] 警告：initialSlides数据过大 (${sizeInMB}MB)`)
      }
    }

    // 查找源文档名称（如果存在）
    let sourceDocumentName = undefined
    if (sourceDocumentId) {
      try {
        const sourceDoc = await documentService.getById(sourceDocumentId)
        sourceDocumentName = sourceDoc?.name
      } catch (error) {
        console.warn(`[文档] 查找源文档失败: ${sourceDocumentId}`, error)
      }
    }

    console.log(`[文档] 调用documentService.create...`)
    const meta = await documentService.create({
      name,
      sourceDocumentId,
      sourceDocumentName,
      category,
      customerName,
      product,
      industry,
      audience,
      language,
      initialSlides,
      tag
    })

    const creationType = initialSlides ? `基于PPTX(${initialSlides.length}页)` : sourceDocumentId ? `基于: ${sourceDocumentId}` : '空白'
    console.log(`[文档] 新建文档成功: ${meta.id} - ${name} (${creationType})`)

    res.json({
      success: true,
      data: meta,
    })
  } catch (error) {
    console.error('[文档] 新建文档失败:', error)
    console.error('[文档] 错误堆栈:', error.stack)
    res.status(500).json({ success: false, error: error.message || '新建文档失败' })
  }
})

// 获取文档列表
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      category,
      status,
      sourceDocumentId,
      sortBy = 'updatedAt',
      order = 'desc',
      keyword,
    } = req.query

    let list = await documentService.getAll({ category, status, sourceDocumentId })

    // 搜索（关键词匹配名称）
    let filtered = list
    if (keyword && typeof keyword === 'string') {
      const k = keyword.toLowerCase()
      filtered = filtered.filter(item => {
        const name = (item.name || '').toLowerCase()
        return name.includes(k)
      })
    }

    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      if (sortBy === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // 分页
    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const start = (p - 1) * ps
    const end = start + ps
    const pageList = filtered.slice(start, end)

    // 检查并修复封面：如果cover为空或地址不正确，从缩略图获取第一张
    for (const doc of pageList) {
      // 如果cover为空、不存在或格式不正确，尝试从缩略图获取
      if (!doc.cover || doc.cover.trim() === '' || !doc.cover.startsWith('/snapshots/')) {
        try {
          const thumbnailResult = await thumbnailService.getByDocumentId(doc.id)
          if (thumbnailResult.thumbnails && thumbnailResult.thumbnails.length > 0) {
            // 按 slideIndex 排序，取第一张（slideIndex = 0）
            const firstThumbnail = thumbnailResult.thumbnails.find(t => t.slideIndex === 0) || thumbnailResult.thumbnails[0]
            if (firstThumbnail && firstThumbnail.url) {
              doc.cover = firstThumbnail.url
              // 同时更新数据库中的cover字段（异步，不阻塞响应）
              documentService.update(doc.id, { cover: firstThumbnail.url }).catch(err => {
                console.warn(`[文档] 更新封面失败: ${doc.id}`, err.message)
              })
            }
          }
        } catch (error) {
          console.warn(`[文档] 获取缩略图失败: ${doc.id}`, error.message)
        }
      }
    }

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
    console.error('[文档] 获取列表失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取文档列表失败' })
  }
})

// 获取文档详情（包含完整JSON）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const doc = await documentService.getById(id)
    
    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 更新最后打开时间
    await documentService.updateLastOpenedAt(id)

    // 分离元信息和内容数据
    const { title, width, height, theme, slides, ...meta } = doc
    const documentData = { title, width, height, theme, slides }

    res.json({
      success: true,
      data: {
        ...meta,
        documentData,
        lastOpenedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[文档] 获取详情失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取文档详情失败' })
  }
})

// 更新文档内容
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    // 兼容两种字段名：documentData 或 data
    const { documentData, data, autoSave = false } = req.body || {}

    const docData = documentData || data
    if (!docData) {
      return res.status(400).json({ success: false, error: '缺少文档数据 documentData 或 data' })
    }

    // 自动从第一页缩略图更新封面
    const cover = getCoverFromSlides(docData.slides)

    // 更新文档
    await documentService.update(id, {
      cover,
      slides: docData.slides,
      theme: docData.theme,
      title: docData.title,
      width: docData.width,
      height: docData.height
    })

    const updated = await documentService.getById(id)
    const now = updated.updatedAt || new Date().toISOString()

    console.log(`[文档] 更新文档: ${id} (autoSave=${autoSave})`)

    res.json({
      success: true,
      data: {
        updatedAt: now,
      },
    })
  } catch (error) {
    console.error('[文档] 更新文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '更新文档失败' })
  }
})

// 发布文档（draft -> published）
// 注意：文档发布不需要检查页面类型标注（与模板发布不同）
router.post('/:id/publish', async (req, res) => {
  try {
    const { id } = req.params
    
    // 获取文档的第一张缩略图作为封面
    let cover = ''
    try {
      const thumbnailResult = await thumbnailService.getByDocumentId(id)
      if (thumbnailResult.thumbnails && thumbnailResult.thumbnails.length > 0) {
        // 按 slideIndex 排序，取第一张（slideIndex = 0）
        const firstThumbnail = thumbnailResult.thumbnails.find(t => t.slideIndex === 0) || thumbnailResult.thumbnails[0]
        if (firstThumbnail && firstThumbnail.url) {
          cover = firstThumbnail.url
        }
      }
    } catch (thumbError) {
      console.warn(`[文档] 获取缩略图失败: ${id}`, thumbError.message)
      // 如果从数据库获取缩略图失败，尝试从文档内容中获取
      try {
        const doc = await documentService.getById(id)
        if (doc && doc.slides && doc.slides.length > 0) {
          cover = getCoverFromSlides(doc.slides)
        }
      } catch (docError) {
        console.warn(`[文档] 从文档内容获取封面失败: ${id}`, docError.message)
      }
    }
    
    // 更新状态和封面
    const updateData = { status: 'published' }
    if (cover) {
      updateData.cover = cover
    }
    const updated = await documentService.update(id, updateData)

    console.log(`[文档] 发布文档: ${id}${cover ? ` (封面: ${cover})` : ''}`)

    res.json({
      success: true,
      data: {
        id,
        status: 'published',
        cover: cover || updated.cover,
        updatedAt: updated.updatedAt || new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[文档] 发布文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '发布文档失败' })
  }
})

// 删除文档
// draft -> 物理删除
// published -> 软删除（改为 archived）
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // 先获取文档信息
    const doc = await documentService.getById(id)
    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const status = doc.status || 'draft'

    // 草稿（draft）：物理删除
    if (status === 'draft') {
      // 注意：缩略图会通过数据库级联删除自动删除，无需手动处理
      await documentService.delete(id)

      console.log(`[文档] 物理删除文档: ${id}`)

      res.json({
        success: true,
        data: {
          id,
          deleted: true,
        },
      })
    } else {
      // 已发布（published）：软删除（改为 archived）
      const updated = await documentService.updateStatus(id, 'archived')

      console.log(`[文档] 软删除文档(归档): ${id}`)

      res.json({
        success: true,
        data: {
          id,
          status: 'archived',
          updatedAt: updated.updatedAt || new Date().toISOString(),
        },
      })
    }
  } catch (error) {
    console.error('[文档] 删除文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '删除文档失败' })
  }
})

// 复制文档
router.post('/:id/duplicate', async (req, res) => {
  try {
    const { id } = req.params
    const sourceDoc = await documentService.getById(id)
    
    if (!sourceDoc) {
      return res.status(404).json({ success: false, error: '源文档不存在' })
    }

    // 准备复制数据
    const newName = `${sourceDoc.name} - 副本`
    const newDocumentData = {
      ...sourceDoc,
      title: newName
    }

    // 创建新文档
    const newMeta = await documentService.create({
      name: newName,
      sourceDocumentId: id,
      sourceDocumentName: sourceDoc.name,
      category: sourceDoc.category || 'uncategorized',
      customerName: sourceDoc.customerName,
      product: sourceDoc.product,
      industry: sourceDoc.industry,
      audience: sourceDoc.audience,
      language: sourceDoc.language,
      tag: sourceDoc.tag || 'public',
      initialSlides: newDocumentData.slides,
      theme: newDocumentData.theme,
      width: newDocumentData.width,
      height: newDocumentData.height
    })

    console.log(`[文档] 复制文档: ${id} -> ${newMeta.id}`)

    res.json({
      success: true,
      data: {
        id: newMeta.id,
        name: newMeta.name,
        sourceId: id,
      },
    })
  } catch (error) {
    console.error('[文档] 复制文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '复制文档失败' })
  }
})

// 重命名文档
// 修改文档基础信息（原重命名接口）
router.patch('/:id/metadata', async (req, res) => {
  try {
    const { id } = req.params
    const { name, customerName, product, industry, audience, language } = req.body || {}

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '文档名称不能为空' })
    }

    // 准备更新数据
    const updateData = { name, title: name }
    
    // 更新业务字段（只有传了才更新，支持清空）
    if (customerName !== undefined) {
      updateData.customerName = customerName || undefined
    }
    if (product !== undefined) {
      updateData.product = (Array.isArray(product) && product.length > 0) ? product : undefined
    }
    if (industry !== undefined) {
      updateData.industry = (Array.isArray(industry) && industry.length > 0) ? industry : undefined
    }
    if (audience !== undefined) {
      updateData.audience = (Array.isArray(audience) && audience.length > 0) ? audience : undefined
    }
    if (language !== undefined) {
      updateData.language = language || undefined
    }

    const updated = await documentService.update(id, updateData)

    console.log(`[文档] 修改基础信息: ${id} -> ${name}`)

    res.json({
      success: true,
      data: {
        id,
        name,
        updatedAt: updated.updatedAt || new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[文档] 修改基础信息失败:', error)
    res.status(500).json({ success: false, error: error.message || '修改基础信息失败' })
  }
})

// 保留旧接口以兼容（重定向到新接口）
router.patch('/:id/rename', async (req, res) => {
  const { id } = req.params
  const { name } = req.body || {}
  
  // 直接调用 metadata 接口逻辑
  try {
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: '文档名称不能为空' })
    }

    const updated = await documentService.update(id, { name, title: name })

    res.json({
      success: true,
      data: {
        id,
        name,
        updatedAt: updated.updatedAt || new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[文档] 重命名失败:', error)
    res.status(500).json({ success: false, error: error.message || '重命名失败' })
  }
})

/**
 * 记录文档阅读
 * POST /api/documents/:id/view
 */
router.post('/:id/view', async (req, res) => {
  try {
    const { id } = req.params
    
    // 使用Prisma直接更新view_count
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
    await prisma.documents.update({
      where: { id },
      data: {
        view_count: {
          increment: 1
        },
        last_opened_at: new Date()
      }
    })
    
    await prisma.$disconnect()
    
    res.json({ success: true, message: '阅读记录成功' })
  } catch (error) {
    console.error('[文档] 记录阅读失败:', error)
    res.status(500).json({ success: false, error: error.message || '记录阅读失败' })
  }
})

export default router