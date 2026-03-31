// 首先加载环境变量
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import { documentModel } from '../models/documentModel.js'
import { thumbnailModel } from '../models/thumbnailModel.js'
import { generateDocumentId } from '../utils/idGenerator.js'
import fs from 'fs'

// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

const USE_DATABASE = process.env.USE_DATABASE === 'true'
const DUAL_WRITE = process.env.DUAL_WRITE === 'true'

async function syncThumbnailIndicesAfterSlideChange(documentId, slides) {
  try {
    const ids = slides?.map(s => s.id).filter(Boolean) || []
    if (ids.length === 0) return
    await thumbnailModel.syncSlideIndicesFromSlideIds(documentId, ids)
  } catch (e) {
    console.warn('[文档服务] 同步缩略图 slide_index 失败:', documentId, e?.message || e)
  }
}

// 确保目录存在
function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(DOCUMENTS_DIR)) fs.mkdirSync(DOCUMENTS_DIR, { recursive: true })
}

// JSON文件操作(原有逻辑)
const jsonOps = {
  readIndex() {
    try {
      ensureDirs()
      
      if (!fs.existsSync(INDEX_FILE)) {
        writeIndex([])
        return []
      }

      const content = fs.readFileSync(INDEX_FILE, 'utf-8')
      if (!content.trim()) return []
      return JSON.parse(content)
    } catch (error) {
      console.error('[文档服务] 读取索引失败:', error)
      return []
    }
  },

  writeIndex(list) {
    ensureDirs()
    fs.writeFileSync(INDEX_FILE, JSON.stringify(list, null, 2), 'utf-8')
  },

  // 已废弃：使用统一的 generateDocumentId 工具函数
  // 保留此方法以兼容旧代码，但实际不再使用
  generateDocumentId(indexList) {
    return generateDocumentId()
  },

  getCoverFromSlides(slides) {
    if (slides && slides.length > 0) {
      const firstSlide = slides[0]
      if (firstSlide.thumbnail) {
        return typeof firstSlide.thumbnail === 'string' 
          ? firstSlide.thumbnail 
          : firstSlide.thumbnail.url
      }
    }
    return ''
  },

  getFileSize(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath)
        return stats.size
      }
    } catch (error) {
      console.warn(`[文档服务] 获取文件大小失败: ${filePath}`, error)
    }
    return 0
  },

  async findById(id) {
    const indexList = this.readIndex()
    const meta = indexList.find(item => item.id === id)
    if (!meta) return null

    const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(contentPath)) {
      return meta
    }

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    return { ...meta, ...content }
  }
}

export const documentService = {
  // 获取所有文档
  async getAll(query = {}) {
    if (USE_DATABASE) {
      const filter = {}
      if (query.category) filter.category = query.category
      if (query.status) filter.status = query.status
      if (query.tag) filter.tag = query.tag
      if (query.sourceDocumentId) filter.source_document_id = query.sourceDocumentId
      if (query.createdBy) filter.created_by = query.createdBy

      return await documentModel.findAll(filter)
    } else {
      return jsonOps.readIndex()
    }
  },

  // 获取文档详情
  async getById(id) {
    if (USE_DATABASE) {
      return await documentModel.findById(id)
    } else {
      return await jsonOps.findById(id)
    }
  },

  // 创建文档
  async create(data) {
    let result
    
    // 生成ID：使用统一的ID生成器（时间戳 + 随机字符串）
    let id = data.id
    if (!id) {
      id = generateDocumentId()
    }

    // 准备文档内容数据
    let documentData = null
    if (data.initialSlides && Array.isArray(data.initialSlides) && data.initialSlides.length > 0) {
      const defaultTheme = {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
        shadow: { h: 3, v: 3, blur: 2, color: '#808080' },
        outline: { width: 2, color: '#525252', style: 'solid' }
      }
      documentData = {
        title: data.name,
        width: 1000,
        height: 562.5,
        theme: defaultTheme,
        slides: data.initialSlides
      }
    } else if (data.sourceDocumentId) {
      const sourceFile = path.join(DOCUMENTS_DIR, `${data.sourceDocumentId}.json`)
      if (fs.existsSync(sourceFile)) {
        documentData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'))
        documentData.title = data.name
      }
    }

    if (!documentData) {
      const defaultTheme = {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
        shadow: { h: 3, v: 3, blur: 2, color: '#808080' },
        outline: { width: 2, color: '#525252', style: 'solid' }
      }
      documentData = {
        title: data.name,
        width: 1000,
        height: 562.5,
        theme: defaultTheme,
        slides: [{ id: `slide_${Date.now()}`, elements: [] }]
      }
    }

    // 获取封面
    const cover = jsonOps.getCoverFromSlides(documentData.slides)

    // 准备创建数据
    const createData = {
      id,
      name: data.name,
      sourceDocumentId: data.sourceDocumentId,
      sourceDocumentName: data.sourceDocumentName,
      category: data.category || 'uncategorized',
      status: data.status || 'draft',
      tag: data.tag || 'public',
      customerName: data.customerName,
      product: data.product,
      industry: data.industry,
      audience: data.audience,
      language: data.language,
      cover,
      theme: documentData.theme,
      slides: documentData.slides,
      width: documentData.width,
      height: documentData.height
    }

    // 写入数据库
    if (USE_DATABASE || DUAL_WRITE) {
      result = await documentModel.create(createData)
    }

    // 写入JSON(备份或主存储)
    if (!USE_DATABASE || DUAL_WRITE) {
      const indexList = jsonOps.readIndex()
      const now = new Date().toISOString()
      const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
      
      // 写入内容文件
      fs.writeFileSync(contentPath, JSON.stringify(documentData, null, 2), 'utf-8')
      
      const meta = {
        id,
        name: data.name,
        cover,
        sourceDocumentId: data.sourceDocumentId || undefined,
        sourceDocumentName: data.sourceDocumentName || undefined,
        category: data.category || 'uncategorized',
        status: data.status || 'draft',
        tag: data.tag || 'public',
        slideCount: documentData.slides.length,
        fileSize: jsonOps.getFileSize(contentPath),
        createdAt: now,
        updatedAt: now,
        customerName: data.customerName || undefined,
        product: data.product || undefined,
        industry: data.industry || undefined,
        audience: data.audience || undefined,
        language: data.language || undefined
      }
      
      indexList.push(meta)
      jsonOps.writeIndex(indexList)
      
      if (!result) result = meta
    }

    return result
  },

  // 更新文档
  async update(id, data) {
    let result

    if (USE_DATABASE || DUAL_WRITE) {
      result = await documentModel.update(id, data)
    }

    if (!USE_DATABASE || DUAL_WRITE) {
      // JSON更新逻辑
      const indexList = jsonOps.readIndex()
      const metaIndex = indexList.findIndex(item => item.id === id)
      if (metaIndex === -1) {
        throw new Error('文档不存在')
      }

      const meta = indexList[metaIndex]
      const updatedMeta = {
        ...meta,
        ...data,
        updatedAt: new Date().toISOString()
      }

      // 如果有内容更新
      if (data.slides || data.theme || data.width || data.height) {
        const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
        if (fs.existsSync(contentPath)) {
          const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
          if (data.slides) content.slides = data.slides
          if (data.theme) content.theme = data.theme
          if (data.width !== undefined) content.width = data.width
          if (data.height !== undefined) content.height = data.height
          fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')
          
          if (data.slides) {
            updatedMeta.slideCount = content.slides.length
          }
          updatedMeta.fileSize = jsonOps.getFileSize(contentPath)
        }
      }

      indexList[metaIndex] = updatedMeta
      jsonOps.writeIndex(indexList)
      
      if (!result) result = updatedMeta
    }

    return result
  },

  // 删除文档
  async delete(id) {
    if (USE_DATABASE || DUAL_WRITE) {
      await documentModel.delete(id)
    }

    if (!USE_DATABASE || DUAL_WRITE) {
      // JSON删除逻辑
      const indexList = jsonOps.readIndex()
      const metaIndex = indexList.findIndex(item => item.id === id)
      if (metaIndex === -1) {
        throw new Error('文档不存在')
      }

      const meta = indexList[metaIndex]
      const status = meta.status || 'draft'

      if (status === 'draft') {
        const documentFile = path.join(DOCUMENTS_DIR, `${id}.json`)
        if (fs.existsSync(documentFile)) {
          fs.unlinkSync(documentFile)
        }
        indexList.splice(metaIndex, 1)
        jsonOps.writeIndex(indexList)
      } else {
        // 软删除
        indexList[metaIndex] = {
          ...meta,
          status: 'archived',
          updatedAt: new Date().toISOString()
        }
        jsonOps.writeIndex(indexList)
      }
    }
  },

  // 更新状态
  async updateStatus(id, status) {
    return await this.update(id, { status })
  },

  /**
   * 增量更新：只替换指定 slideId 的页面，不重写整个文档
   * @param {string} id - 文档ID
   * @param {Array<{id: string, [key: string]: any}>} patchSlides - 变更的页面数组
   */
  async updateSlides(id, patchSlides) {
    if (USE_DATABASE || DUAL_WRITE) {
      return await documentModel.updateSlides(id, patchSlides)
    }

    // JSON 模式：读取文件，按 id 精准替换
    const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const patchMap = new Map(patchSlides.map(s => [s.id, s]))

    content.slides = content.slides.map(slide =>
      patchMap.has(slide.id) ? patchMap.get(slide.id) : slide
    )

    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')

    // 更新索引中的 updatedAt
    const indexList = jsonOps.readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex !== -1) {
      indexList[metaIndex].updatedAt = new Date().toISOString()
      jsonOps.writeIndex(indexList)
    }

    return indexList[metaIndex] || { id, updatedAt: new Date().toISOString() }
  },

  // 更新最后打开时间
  async updateLastOpenedAt(id) {
    return await this.update(id, { last_opened_at: new Date().toISOString() })
  },

  // 插入页面（按 index 位置插入）
  async insertSlide(id, slide, index) {
    if (USE_DATABASE || DUAL_WRITE) {
      return await documentModel.insertSlide(id, slide, index)
    }

    const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const insertAt = Math.max(0, Math.min(index, content.slides.length))
    content.slides.splice(insertAt, 0, slide)
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')

    await syncThumbnailIndicesAfterSlideChange(id, content.slides)

    const indexList = jsonOps.readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex !== -1) {
      indexList[metaIndex].updatedAt = new Date().toISOString()
      indexList[metaIndex].slideCount = content.slides.length
      jsonOps.writeIndex(indexList)
    }
    return indexList[metaIndex] || { id, updatedAt: new Date().toISOString() }
  },

  // 删除指定页面（支持批量）
  async deleteSlide(id, slideIds) {
    const ids = Array.isArray(slideIds) ? slideIds : [slideIds]

    if (USE_DATABASE || DUAL_WRITE) {
      return await documentModel.deleteSlide(id, ids)
    }

    const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    content.slides = content.slides.filter(s => !ids.includes(s.id))
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')

    await syncThumbnailIndicesAfterSlideChange(id, content.slides)

    const indexList = jsonOps.readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex !== -1) {
      indexList[metaIndex].updatedAt = new Date().toISOString()
      indexList[metaIndex].slideCount = content.slides.length
      jsonOps.writeIndex(indexList)
    }
    return indexList[metaIndex] || { id, updatedAt: new Date().toISOString() }
  },

  // 重新排序页面
  async reorderSlides(id, slideIds) {
    if (USE_DATABASE || DUAL_WRITE) {
      return await documentModel.reorderSlides(id, slideIds)
    }

    const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const slideMap = new Map(content.slides.map(s => [s.id, s]))
    const reordered = slideIds.map(sid => slideMap.get(sid)).filter(Boolean)
    const remaining = content.slides.filter(s => !slideIds.includes(s.id))
    content.slides = [...reordered, ...remaining]
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')

    await syncThumbnailIndicesAfterSlideChange(id, content.slides)

    const indexList = jsonOps.readIndex()
    const metaIndex = indexList.findIndex(item => item.id === id)
    if (metaIndex !== -1) {
      indexList[metaIndex].updatedAt = new Date().toISOString()
      jsonOps.writeIndex(indexList)
    }
    return indexList[metaIndex] || { id, updatedAt: new Date().toISOString() }
  },
}

