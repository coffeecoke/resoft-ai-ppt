// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import { generateDocumentId } from '../utils/idGenerator.js'
import { thumbnailModel } from './thumbnailModel.js'
import fs from 'fs'
import prisma from '../lib/prisma.js'
// 优先使用环境变量 DATA_DIR，如果没有则使用默认相对路径
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')

// 将 BigInt 转换为 Number（用于 JSON 序列化）
// 同时将数据库字段（下划线）转换为前端字段（驼峰）
function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'bigint') {
    return Number(obj)
  }
  
  // ✅ Date 对象会被 JSON.stringify 自动转为 ISO 字符串，无需特殊处理
  if (obj instanceof Date) {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }
  
  if (typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      // 转换字段名：下划线 -> 驼峰
      let newKey = key
      if (key === 'customer_name') newKey = 'customerName'
      else if (key === 'product_id') newKey = 'productId'
      else if (key === 'session_id') newKey = 'sessionId'
      else if (key === 'source_document_id') newKey = 'sourceDocumentId'
      else if (key === 'source_document_name') newKey = 'sourceDocumentName'
      else if (key === 'content_file_path') newKey = 'contentFilePath'
      else if (key === 'slide_count') newKey = 'slideCount'
      else if (key === 'file_size') newKey = 'fileSize'
      else if (key === 'created_at') newKey = 'createdAt'
      else if (key === 'updated_at') newKey = 'updatedAt'
      else if (key === 'last_opened_at') newKey = 'lastOpenedAt'
      else if (key === 'view_count') newKey = 'viewCount'
      else if (key === 'created_by') newKey = 'createdBy'
      
      result[newKey] = serializeBigInt(value)
    }
    return result
  }
  
  return obj
}

export const documentModel = {
  // 获取所有文档(只查元信息)
  async findAll(filter = {}) {
    const docs = await prisma.documents.findMany({
      where: filter,
      orderBy: { created_at: 'desc' }
    })
    // 转换 BigInt 字段
    return serializeBigInt(docs)
  },
  
  // 获取文档详情(元信息 + 内容)
  async findById(id) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) return null
    
    // 转换 BigInt 字段
    const serializedDoc = serializeBigInt(doc)
    
    // 读取内容文件
    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (!fs.existsSync(contentPath)) {
      console.warn(`[文档模型] 内容文件不存在: ${contentPath}`)
      return serializedDoc
    }
    
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    
    return { ...serializedDoc, ...content }
  },
  
  // 创建文档
  async create(data) {
    try {
      const id = data.id || generateDocumentId()
      const contentFilePath = `documents/${id}.json`
      
      // 写入内容文件
      const contentData = {
        title: data.name,
        width: data.width || 1000,
        height: data.height || 562.5,
        theme: data.theme,
        slides: data.slides || []
      }
      
      console.log(`[文档模型] 创建文档 ${id}, slides数量: ${contentData.slides.length}`)
      
      const contentPath = path.join(DATA_DIR, contentFilePath)
      // 确保目录存在
      const contentDir = path.dirname(contentPath)
      if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true })
      }
      
      // 写入文件前检查数据大小
      const jsonStr = JSON.stringify(contentData, null, 2)
      const sizeInMB = (jsonStr.length / (1024 * 1024)).toFixed(2)
      console.log(`[文档模型] 内容文件大小: ${sizeInMB}MB`)
      
      if (jsonStr.length > 50 * 1024 * 1024) { // 50MB
        console.warn(`[文档模型] 警告：内容文件过大 (${sizeInMB}MB)，可能导致性能问题`)
      }
      
      fs.writeFileSync(contentPath, jsonStr)
      
      // 写入数据库
      console.log(`[文档模型] 写入数据库记录...`)
      const created = await prisma.documents.create({
        data: {
          id,
          name: data.name,
          cover: data.cover || undefined,
          content_file_path: contentFilePath,
          slide_count: contentData.slides.length,
          file_size: BigInt(fs.statSync(contentPath).size),
          category: data.category || 'uncategorized',
          status: data.status || 'draft',
          tag: data.tag || 'public',
          customer_name: data.customerName,
          product: data.product,
          industry: data.industry,
          audience: data.audience,
          audience_names: data.audienceNames, // 🆕 交流对象人员姓名
          language: data.language,
          source_document_id: data.sourceDocumentId,
          source_document_name: data.sourceDocumentName,
          created_by: data.createdBy || undefined,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      
      console.log(`[文档模型] 文档创建成功: ${id}`)
      // 转换 BigInt 字段
      return serializeBigInt(created)
    } catch (error) {
      console.error('[文档模型] 创建文档失败:', error)
      throw error
    }
  },
  
  // 更新文档
  async update(id, data) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')
    
    // 字段名映射：驼峰 -> 下划线
    const updateData = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.cover !== undefined) updateData.cover = data.cover
    if (data.category !== undefined) updateData.category = data.category
    if (data.status !== undefined) updateData.status = data.status
    if (data.tag !== undefined) updateData.tag = data.tag
    if (data.customerName !== undefined) updateData.customer_name = data.customerName
    if (data.product !== undefined) updateData.product = data.product
    if (data.industry !== undefined) updateData.industry = data.industry
    if (data.audience !== undefined) updateData.audience = data.audience
    if (data.audienceNames !== undefined) updateData.audience_names = data.audienceNames // 🆕 交流对象人员姓名
    if (data.language !== undefined) updateData.language = data.language
    if (data.productId !== undefined) updateData.product_id = data.productId
    if (data.sessionId !== undefined) updateData.session_id = data.sessionId
    if (data.sourceDocumentId !== undefined) updateData.source_document_id = data.sourceDocumentId
    if (data.sourceDocumentName !== undefined) updateData.source_document_name = data.sourceDocumentName
    if (data.last_opened_at !== undefined) updateData.last_opened_at = data.last_opened_at
    
    // 更新时间戳
    updateData.updated_at = new Date()
    
    const updated = await prisma.documents.update({
      where: { id },
      data: updateData
    })
    
    // 如果有内容更新,更新文件
    if (data.slides || data.theme || data.title || data.width || data.height) {
      const contentPath = path.join(DATA_DIR, doc.content_file_path)
      if (fs.existsSync(contentPath)) {
        const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
        
        if (data.slides) content.slides = data.slides
        if (data.theme) content.theme = data.theme
        if (data.title) content.title = data.title
        if (data.width) content.width = data.width
        if (data.height) content.height = data.height
        
        fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))
        
        // 更新文件大小和幻灯片数量
        await prisma.documents.update({
          where: { id },
          data: {
            file_size: BigInt(fs.statSync(contentPath).size),
            slide_count: content.slides ? content.slides.length : doc.slide_count
          }
        })
      }
    }
    
    // 转换 BigInt 字段
    return serializeBigInt(updated)
  },
  
  /**
   * 增量更新：只替换指定 slideId 的页面数据，不重写整个 slides 数组
   * @param {string} id - 文档ID
   * @param {Array<{id: string, [key: string]: any}>} patchSlides - 需要更新的页面数组（每项必须含 id 字段）
   */
  async updateSlides(id, patchSlides) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')

    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const patchMap = new Map(patchSlides.map(s => [s.id, s]))

    // 按 slideId 精准替换，保留其余页不变
    content.slides = content.slides.map(slide =>
      patchMap.has(slide.id) ? patchMap.get(slide.id) : slide
    )

    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))

    const updated = await prisma.documents.update({
      where: { id },
      data: {
        updated_at: new Date(),
        file_size: BigInt(fs.statSync(contentPath).size),
      }
    })

    return serializeBigInt(updated)
  },

  // 插入页面（按 index 位置插入）
  async insertSlide(id, slide, index) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')

    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const insertAt = Math.max(0, Math.min(index, content.slides.length))
    content.slides.splice(insertAt, 0, slide)

    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))

    const updated = await prisma.documents.update({
      where: { id },
      data: { updated_at: new Date(), file_size: BigInt(fs.statSync(contentPath).size) }
    })
    try {
      await thumbnailModel.syncSlideIndicesFromSlideIds(
        id,
        content.slides.map(s => s.id)
      )
    } catch (e) {
      console.warn('[documentModel] 同步缩略图 slide_index 失败:', id, e?.message || e)
    }
    return serializeBigInt(updated)
  },

  // 删除指定页面
  async deleteSlide(id, slideId) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')

    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const before = content.slides.length
    content.slides = content.slides.filter(s => !slideId.includes(s.id))

    if (content.slides.length === before) throw new Error('未找到要删除的页面')

    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))

    const updated = await prisma.documents.update({
      where: { id },
      data: { updated_at: new Date(), file_size: BigInt(fs.statSync(contentPath).size) }
    })
    try {
      await thumbnailModel.syncSlideIndicesFromSlideIds(
        id,
        content.slides.map(s => s.id)
      )
    } catch (e) {
      console.warn('[documentModel] 同步缩略图 slide_index 失败:', id, e?.message || e)
    }
    return serializeBigInt(updated)
  },

  // 重新排序页面
  async reorderSlides(id, slideIds) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')

    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (!fs.existsSync(contentPath)) throw new Error('文档内容文件不存在')

    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    const slideMap = new Map(content.slides.map(s => [s.id, s]))

    // 按新顺序重组，未在 slideIds 中的页面追加到末尾
    const reordered = slideIds.map(sid => slideMap.get(sid)).filter(Boolean)
    const remaining = content.slides.filter(s => !slideIds.includes(s.id))
    content.slides = [...reordered, ...remaining]

    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))

    const updated = await prisma.documents.update({
      where: { id },
      data: { updated_at: new Date(), file_size: BigInt(fs.statSync(contentPath).size) }
    })
    try {
      await thumbnailModel.syncSlideIndicesFromSlideIds(
        id,
        content.slides.map(s => s.id)
      )
    } catch (e) {
      console.warn('[documentModel] 同步缩略图 slide_index 失败:', id, e?.message || e)
    }
    return serializeBigInt(updated)
  },

  // 删除文档
  async delete(id) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')
    
    // 删除文档前，更新所有关联的 file_scan_history 记录
    // 将 document_id 设为 null，status 设为 'pending'（未处理状态）
    await prisma.file_scan_history.updateMany({
      where: { document_id: id },
      data: {
        document_id: null,
        status: 'pending',
        processed_time: null,
        error_message: null
      }
    })
    
    // 删除内容文件
    const contentPath = path.join(DATA_DIR, doc.content_file_path)
    if (fs.existsSync(contentPath)) {
      fs.unlinkSync(contentPath)
    }
    
    // 删除数据库记录(会自动级联删除 thumbnails)
    return await prisma.documents.delete({ where: { id } })
  },
  
  // 关闭 Prisma 连接(应用退出时调用)
  async disconnect() {
    await prisma.$disconnect()
  }
}

