// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import fs from 'fs'

const prisma = new PrismaClient()
const DATA_DIR = path.join(__dirname, '..', '..', 'data')

// 将 BigInt 转换为 Number（用于 JSON 序列化）
// 同时将数据库字段（下划线）转换为前端字段（驼峰）
function serializeBigInt(obj) {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'bigint') {
    return Number(obj)
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
      const id = data.id || `document_${Date.now()}`
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
          language: data.language,
          source_document_id: data.sourceDocumentId,
          source_document_name: data.sourceDocumentName
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
    if (data.language !== undefined) updateData.language = data.language
    if (data.productId !== undefined) updateData.product_id = data.productId
    if (data.sessionId !== undefined) updateData.session_id = data.sessionId
    if (data.sourceDocumentId !== undefined) updateData.source_document_id = data.sourceDocumentId
    if (data.sourceDocumentName !== undefined) updateData.source_document_name = data.sourceDocumentName
    if (data.last_opened_at !== undefined) updateData.last_opened_at = data.last_opened_at
    
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
  
  // 删除文档
  async delete(id) {
    const doc = await prisma.documents.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')
    
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

