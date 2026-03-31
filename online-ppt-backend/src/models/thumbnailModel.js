// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import prisma from '../lib/prisma.js'

export const thumbnailModel = {
  // 获取文档的所有缩略图
  async findByDocumentId(documentId) {
    return await prisma.thumbnails.findMany({
      where: { document_id: documentId }, // 数据库字段是 document_id
      orderBy: { slide_index: 'asc' } // 数据库字段是 slide_index
    })
  },
  
  // 获取所有缩略图（用于查询所有）
  async findAll() {
    return await prisma.thumbnails.findMany({
      orderBy: { generated_at: 'desc' } // 数据库字段是 generated_at
    })
  },
  
  // 获取单个缩略图
  async findById(id) {
    return await prisma.thumbnails.findUnique({
      where: { id }
    })
  },
  
  // 创建或更新缩略图
  async upsert(data) {
    return await prisma.thumbnails.upsert({
      where: { id: data.id },
      update: {
        url: data.url,
        width: data.width,
        height: data.height,
        size: data.size,
        format: data.format,
        has_text: data.hasText, // 驼峰 -> 下划线
        has_image: data.hasImage,
        element_count: data.elementCount,
        generated_at: data.generatedAt || new Date()
      },
      create: {
        id: data.id,
        document_id: data.documentId, // 驼峰 -> 下划线
        slide_id: data.slideId,
        slide_index: data.slideIndex,
        url: data.url,
        width: data.width,
        height: data.height,
        size: data.size,
        format: data.format,
        has_text: data.hasText,
        has_image: data.hasImage,
        element_count: data.elementCount,
        generated_at: data.generatedAt || new Date()
      }
    })
  },
  
  // 删除缩略图
  async delete(id) {
    return await prisma.thumbnails.delete({
      where: { id }
    })
  },
  
  // 删除文档的所有缩略图
  async deleteByDocumentId(documentId) {
    return await prisma.thumbnails.deleteMany({
      where: { document_id: documentId } // 数据库字段是 document_id
    })
  },

  /**
   * 按文档当前 slides 顺序回写 thumbnails.slide_index（与 JSON 内容一致）
   * @param {string} documentId
   * @param {string[]} slideIdsOrdered 与文档 content.slides 顺序一致的 slide id 列表
   */
  async syncSlideIndicesFromSlideIds(documentId, slideIdsOrdered) {
    if (!documentId || !slideIdsOrdered?.length) return
    await prisma.$transaction(
      slideIdsOrdered.map((slideId, i) =>
        prisma.thumbnails.updateMany({
          where: { document_id: documentId, slide_id: slideId },
          data: { slide_index: i }
        })
      )
    )
  },
  
  // 统计文档的缩略图数量
  async countByDocumentId(documentId) {
    return await prisma.thumbnails.count({
      where: { document_id: documentId } // 数据库字段是 document_id
    })
  },
  
  // 关闭 Prisma 连接
  async disconnect() {
    await prisma.$disconnect()
  }
}

