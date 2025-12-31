// 首先加载环境变量
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import { thumbnailModel } from '../models/thumbnailModel.js'
import { documentModel } from '../models/documentModel.js'

export const thumbnailService = {
  // 获取文档的所有缩略图
  async getByDocumentId(documentId) {
    const thumbnails = await thumbnailModel.findByDocumentId(documentId)
    const doc = await documentModel.findById(documentId)
    
    return {
      documentId,
      documentTitle: doc?.name || '',
      thumbnails: thumbnails.map(t => ({
        id: t.id,
        slideId: t.slideId,
        slideIndex: t.slideIndex,
        url: t.url,
        width: t.width,
        height: t.height,
        size: t.size,
        format: t.format,
        generatedAt: t.generatedAt instanceof Date ? t.generatedAt.toISOString() : t.generatedAt,
        metadata: {
          hasText: t.hasText,
          hasImage: t.hasImage,
          elementCount: t.elementCount
        }
      })),
      lastUpdated: thumbnails.length > 0 
        ? thumbnails[thumbnails.length - 1].generatedAt.toISOString()
        : new Date().toISOString()
    }
  },

  // 获取所有缩略图（支持分页）
  async getAll(query = {}) {
    const { documentId, limit = 100, offset = 0 } = query
    
    if (documentId) {
      const data = await this.getByDocumentId(documentId)
      return {
        total: data.thumbnails.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        thumbnails: data.thumbnails.slice(parseInt(offset), parseInt(offset) + parseInt(limit)),
        lastUpdated: data.lastUpdated
      }
    }
    
    // 查询所有文档的缩略图（需要从数据库查询）
    // 这里简化处理，实际应该使用 Prisma 的复杂查询
    const allThumbnails = await thumbnailModel.findAll()
    
    return {
      total: allThumbnails.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      thumbnails: allThumbnails.slice(parseInt(offset), parseInt(offset) + parseInt(limit)).map(t => ({
        ...t,
        generatedAt: t.generatedAt instanceof Date ? t.generatedAt.toISOString() : t.generatedAt
      })),
      lastUpdated: allThumbnails.length > 0 
        ? (allThumbnails[allThumbnails.length - 1].generatedAt instanceof Date 
          ? allThumbnails[allThumbnails.length - 1].generatedAt.toISOString()
          : allThumbnails[allThumbnails.length - 1].generatedAt)
        : new Date().toISOString()
    }
  },

  // 获取单个缩略图详情
  async getById(thumbnailId) {
    const thumbnail = await thumbnailModel.findById(thumbnailId)
    if (!thumbnail) {
      return null
    }

    const doc = await documentModel.findById(thumbnail.documentId)
    if (!doc) {
      return null
    }

    return {
      thumbnail: {
        id: thumbnail.id,
        slideId: thumbnail.slideId,
        slideIndex: thumbnail.slideIndex,
        url: thumbnail.url,
        width: thumbnail.width,
        height: thumbnail.height,
        size: thumbnail.size,
        format: thumbnail.format,
        generatedAt: thumbnail.generatedAt instanceof Date ? thumbnail.generatedAt.toISOString() : thumbnail.generatedAt,
        documentId: thumbnail.documentId,
        documentTitle: doc.name
      },
      source: {
        document: {
          id: doc.id,
          title: doc.name,
          width: doc.width || 1000,
          height: doc.height || 562.5,
          totalSlides: doc.slideCount || 0
        }
      }
    }
  },

  // 创建或更新缩略图
  async upsert(data) {
    const thumbnailId = data.id || `thumb_${data.documentId}_${data.slideId}`
    
    return await thumbnailModel.upsert({
      id: thumbnailId,
      documentId: data.documentId,
      slideId: data.slideId,
      slideIndex: data.slideIndex,
      url: data.url,
      width: data.width || 800,
      height: data.height || 450,
      size: data.size || 0,
      format: data.format || 'jpeg',
      hasText: data.metadata?.hasText || false,
      hasImage: data.metadata?.hasImage || false,
      elementCount: data.metadata?.elementCount || 0,
      generatedAt: data.generatedAt ? new Date(data.generatedAt) : new Date()
    })
  },

  // 删除缩略图
  async delete(id) {
    return await thumbnailModel.delete(id)
  },

  // 删除文档的所有缩略图
  async deleteByDocumentId(documentId) {
    return await thumbnailModel.deleteByDocumentId(documentId)
  }
}

