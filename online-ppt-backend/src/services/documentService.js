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
import fs from 'fs'

const DATA_DIR = path.join(__dirname, '..', '..', 'data')
const DOCUMENTS_DIR = path.join(DATA_DIR, 'documents')
const INDEX_FILE = path.join(DATA_DIR, 'document-index.json')

const USE_DATABASE = process.env.USE_DATABASE === 'true'
const DUAL_WRITE = process.env.DUAL_WRITE === 'true'

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

  generateDocumentId(indexList) {
    const nums = indexList
      .map(item => {
        if (!item.id || typeof item.id !== 'string') return NaN
        const m = item.id.match(/^document_(\d+)$/)
        return m ? Number(m[1]) : NaN
      })
      .filter(n => !Number.isNaN(n))

    const max = nums.length ? Math.max(...nums, 0) : 0
    return `document_${max + 1}`
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
      if (query.sourceDocumentId) filter.sourceDocumentId = query.sourceDocumentId
      
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
    
    // 生成ID
    let id = data.id
    if (!id) {
      // 统一从数据库或JSON获取最大ID
      let maxNum = 0
      if (USE_DATABASE || DUAL_WRITE) {
        try {
          const allDocs = await documentModel.findAll()
          const nums = allDocs
            .map(doc => {
              const m = doc.id.match(/^document_(\d+)$/)
              return m ? Number(m[1]) : NaN
            })
            .filter(n => !Number.isNaN(n))
          maxNum = nums.length ? Math.max(...nums, 0) : 0
        } catch (error) {
          console.warn('[文档服务] 从数据库获取ID失败,使用JSON:', error)
        }
      }
      
      if (maxNum === 0) {
        const indexList = jsonOps.readIndex()
        const nums = indexList
          .map(item => {
            if (!item.id || typeof item.id !== 'string') return NaN
            const m = item.id.match(/^document_(\d+)$/)
            return m ? Number(m[1]) : NaN
          })
          .filter(n => !Number.isNaN(n))
        maxNum = nums.length ? Math.max(...nums, 0) : 0
      }
      
      id = `document_${maxNum + 1}`
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
      if (data.slides || data.theme) {
        const contentPath = path.join(DOCUMENTS_DIR, `${id}.json`)
        if (fs.existsSync(contentPath)) {
          const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
          if (data.slides) content.slides = data.slides
          if (data.theme) content.theme = data.theme
          fs.writeFileSync(contentPath, JSON.stringify(content, null, 2), 'utf-8')
          
          updatedMeta.slideCount = content.slides.length
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

  // 更新最后打开时间
  async updateLastOpenedAt(id) {
    return await this.update(id, { lastOpenedAt: new Date().toISOString() })
  }
}

