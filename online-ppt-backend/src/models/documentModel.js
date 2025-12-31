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
      result[key] = serializeBigInt(value)
    }
    return result
  }
  
  return obj
}

export const documentModel = {
  // 获取所有文档(只查元信息)
  async findAll(filter = {}) {
    const docs = await prisma.document.findMany({
      where: filter,
      orderBy: { createdAt: 'desc' }
    })
    // 转换 BigInt 字段
    return serializeBigInt(docs)
  },
  
  // 获取文档详情(元信息 + 内容)
  async findById(id) {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) return null
    
    // 转换 BigInt 字段
    const serializedDoc = serializeBigInt(doc)
    
    // 读取内容文件
    const contentPath = path.join(DATA_DIR, doc.contentFilePath)
    if (!fs.existsSync(contentPath)) {
      console.warn(`[文档模型] 内容文件不存在: ${contentPath}`)
      return serializedDoc
    }
    
    const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
    
    return { ...serializedDoc, ...content }
  },
  
  // 创建文档
  async create(data) {
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
    
    const contentPath = path.join(DATA_DIR, contentFilePath)
    // 确保目录存在
    const contentDir = path.dirname(contentPath)
    if (!fs.existsSync(contentDir)) {
      fs.mkdirSync(contentDir, { recursive: true })
    }
    
    fs.writeFileSync(contentPath, JSON.stringify(contentData, null, 2))
    
    // 写入数据库
    const created = await prisma.document.create({
      data: {
        id,
        name: data.name,
        contentFilePath,
        slideCount: contentData.slides.length,
        fileSize: BigInt(fs.statSync(contentPath).size),
        category: data.category || 'uncategorized',
        status: data.status || 'draft',
        tag: data.tag || 'public',
        customerName: data.customerName,
        product: data.product,
        industry: data.industry,
        audience: data.audience,
        language: data.language,
        sourceDocumentId: data.sourceDocumentId,
        sourceDocumentName: data.sourceDocumentName
      }
    })
    // 转换 BigInt 字段
    return serializeBigInt(created)
  },
  
  // 更新文档
  async update(id, data) {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')
    
    // 更新数据库
    const updateData = { ...data }
    // 移除不应该直接更新的字段
    delete updateData.slides
    delete updateData.theme
    delete updateData.title
    delete updateData.width
    delete updateData.height
    
    const updated = await prisma.document.update({
      where: { id },
      data: updateData
    })
    
    // 如果有内容更新,更新文件
    if (data.slides || data.theme || data.title || data.width || data.height) {
      const contentPath = path.join(DATA_DIR, doc.contentFilePath)
      if (fs.existsSync(contentPath)) {
        const content = JSON.parse(fs.readFileSync(contentPath, 'utf-8'))
        
        if (data.slides) content.slides = data.slides
        if (data.theme) content.theme = data.theme
        if (data.title) content.title = data.title
        if (data.width) content.width = data.width
        if (data.height) content.height = data.height
        
        fs.writeFileSync(contentPath, JSON.stringify(content, null, 2))
        
        // 更新文件大小和幻灯片数量
        await prisma.document.update({
          where: { id },
          data: {
            fileSize: BigInt(fs.statSync(contentPath).size),
            slideCount: content.slides ? content.slides.length : doc.slideCount
          }
        })
      }
    }
    
    // 转换 BigInt 字段
    return serializeBigInt(updated)
  },
  
  // 删除文档
  async delete(id) {
    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc) throw new Error('文档不存在')
    
    // 删除内容文件
    const contentPath = path.join(DATA_DIR, doc.contentFilePath)
    if (fs.existsSync(contentPath)) {
      fs.unlinkSync(contentPath)
    }
    
    // 删除数据库记录(会自动级联删除 thumbnails)
    return await prisma.document.delete({ where: { id } })
  },
  
  // 关闭 Prisma 连接(应用退出时调用)
  async disconnect() {
    await prisma.$disconnect()
  }
}

