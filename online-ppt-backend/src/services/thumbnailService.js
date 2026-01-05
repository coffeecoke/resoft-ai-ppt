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
      viewCount: doc?.viewCount || 0, // 🆕 返回阅读次数
      thumbnails: thumbnails.map(t => ({
        id: t.id,
        slideId: t.slide_id, // 数据库字段转换
        slideIndex: t.slide_index,
        url: t.url,
        width: t.width,
        height: t.height,
        size: t.size,
        format: t.format,
        generatedAt: t.generated_at instanceof Date ? t.generated_at.toISOString() : t.generated_at,
        metadata: {
          hasText: t.has_text, // 数据库字段转换
          hasImage: t.has_image,
          elementCount: t.element_count
        }
      })),
      lastUpdated: thumbnails.length > 0 
        ? (thumbnails[thumbnails.length - 1].generated_at instanceof Date 
          ? thumbnails[thumbnails.length - 1].generated_at.toISOString()
          : thumbnails[thumbnails.length - 1].generated_at)
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
    const allThumbnails = await thumbnailModel.findAll()
    
    return {
      total: allThumbnails.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      thumbnails: allThumbnails.slice(parseInt(offset), parseInt(offset) + parseInt(limit)).map(t => ({
        id: t.id,
        documentId: t.document_id, // 数据库字段转换
        slideId: t.slide_id,
        slideIndex: t.slide_index,
        url: t.url,
        width: t.width,
        height: t.height,
        size: t.size,
        format: t.format,
        generatedAt: t.generated_at instanceof Date ? t.generated_at.toISOString() : t.generated_at,
        hasText: t.has_text, // 数据库字段转换
        hasImage: t.has_image,
        elementCount: t.element_count
      })),
      lastUpdated: allThumbnails.length > 0 
        ? (allThumbnails[allThumbnails.length - 1].generated_at instanceof Date 
          ? allThumbnails[allThumbnails.length - 1].generated_at.toISOString()
          : allThumbnails[allThumbnails.length - 1].generated_at)
        : new Date().toISOString()
    }
  },

  // 获取单个缩略图详情
  async getById(thumbnailId) {
    const thumbnail = await thumbnailModel.findById(thumbnailId)
    if (!thumbnail) {
      return null
    }

    const doc = await documentModel.findById(thumbnail.document_id) // 数据库字段
    if (!doc) {
      return null
    }

    return {
      thumbnail: {
        id: thumbnail.id,
        slideId: thumbnail.slide_id, // 数据库字段转换
        slideIndex: thumbnail.slide_index,
        url: thumbnail.url,
        width: thumbnail.width,
        height: thumbnail.height,
        size: thumbnail.size,
        format: thumbnail.format,
        generatedAt: thumbnail.generated_at instanceof Date ? thumbnail.generated_at.toISOString() : thumbnail.generated_at,
        documentId: thumbnail.document_id,
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

