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

const prisma = new PrismaClient()

export const thumbnailModel = {
  // 获取文档的所有缩略图
  async findByDocumentId(documentId) {
    return await prisma.thumbnail.findMany({
      where: { documentId },
      orderBy: { slideIndex: 'asc' }
    })
  },
  
  // 获取所有缩略图（用于查询所有）
  async findAll() {
    return await prisma.thumbnail.findMany({
      orderBy: { generatedAt: 'desc' }
    })
  },
  
  // 获取单个缩略图
  async findById(id) {
    return await prisma.thumbnail.findUnique({
      where: { id }
    })
  },
  
  // 创建或更新缩略图
  async upsert(data) {
    return await prisma.thumbnail.upsert({
      where: { id: data.id },
      update: {
        url: data.url,
        width: data.width,
        height: data.height,
        size: data.size,
        format: data.format,
        hasText: data.hasText,
        hasImage: data.hasImage,
        elementCount: data.elementCount,
        generatedAt: data.generatedAt || new Date()
      },
      create: data
    })
  },
  
  // 删除缩略图
  async delete(id) {
    return await prisma.thumbnail.delete({
      where: { id }
    })
  },
  
  // 删除文档的所有缩略图
  async deleteByDocumentId(documentId) {
    return await prisma.thumbnail.deleteMany({
      where: { documentId }
    })
  },
  
  // 统计文档的缩略图数量
  async countByDocumentId(documentId) {
    return await prisma.thumbnail.count({
      where: { documentId }
    })
  },
  
  // 关闭 Prisma 连接
  async disconnect() {
    await prisma.$disconnect()
  }
}

