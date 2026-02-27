import express from 'express'
import * as prismaClient from '@prisma/client'

const router = express.Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

/**
 * GET /api/sales/thumbnails
 * 获取缩略图列表（选中目录后）
 * 
 * Query参数:
 * - pageTypes: 目录code列表，逗号分隔，如 "3.1,3.2"
 * - tag: 'public' 或 'practical'
 * - productCode: 产品code（必须，直接用于匹配 documents.product JSON 字段）
 * - filters: JSON字符串，包含筛选条件 {product, customer, industry, audience}
 *   ⚠️ 注意：filters.product 中的值必须是 code 数组，不是 name
 */
router.get('/', async (req, res) => {
  try {
    const { pageTypes, tag, productCode, filters: filtersStr } = req.query
    
    if (!pageTypes || !tag || !productCode) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：pageTypes, tag, productCode'
      })
    }
    
    // 解析pageTypes
    const pageTypeArray = pageTypes.split(',').map(s => s.trim()).filter(Boolean)
    if (pageTypeArray.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'pageTypes不能为空'
      })
    }
    
    // 解析筛选条件
    let filters = {}
    if (filtersStr) {
      try {
        filters = typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr
      } catch (e) {
        console.warn('解析筛选条件失败:', e)
      }
    }
    
    // 构建where条件（不使用 product_id，在应用层通过 product JSON 字段过滤）
    const whereBase = {
      page_type: { in: pageTypeArray },
      documents: {
        tag: tag,
        status: 'published'
      }
    }
    
    // 应用筛选条件
    if (filters.customer) {
      whereBase.documents.customer_name = filters.customer
    }
    // JSON字段的筛选在应用层处理
    
    console.log('[缩略图查询] 📥 收到请求:', {
      pageTypes: pageTypeArray,
      tag,
      productCode,
      filters
    })
    
    if (tag === 'public') {
      // 公共版：直接返回缩略图数组
      const thumbnails = await prisma.thumbnails.findMany({
        where: whereBase,
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              created_at: true,
              cover: true,
              product: true,
              industry: true,    // ⚠️ 必须包含，用于筛选
              audience: true     // ⚠️ 必须包含，用于筛选
            }
          }
        },
        orderBy: [
          { documents: { created_at: 'desc' } },
          { slide_index: 'asc' }
        ]
      })
      
      console.log('[缩略图查询] 📦 查询到缩略图数量:', thumbnails.length)
      
      // 应用JSON字段筛选（如果有）
      let filteredThumbnails = thumbnails
      
      // 先根据 productCode 过滤（匹配 documents.product JSON 字段）
      filteredThumbnails = filteredThumbnails.filter(t => {
        try {
          const docProducts = Array.isArray(t.documents.product) 
            ? t.documents.product 
            : (t.documents.product ? [t.documents.product] : [])
          return docProducts.includes(productCode)
        } catch (e) {
          return false
        }
      })
      
      if (filters.product && Array.isArray(filters.product) && filters.product.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docProducts = Array.isArray(t.documents.product) 
              ? t.documents.product 
              : (t.documents.product ? [t.documents.product] : [])
            return filters.product.some(p => docProducts.includes(p))
          } catch (e) {
            return false
          }
        })
      }
      if (filters.industry && Array.isArray(filters.industry) && filters.industry.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docIndustries = Array.isArray(t.documents.industry) 
              ? t.documents.industry 
              : (t.documents.industry ? [t.documents.industry] : [])
            return filters.industry.some(i => docIndustries.includes(i))
          } catch (e) {
            return false
          }
        })
      }
      if (filters.audience && Array.isArray(filters.audience) && filters.audience.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docAudiences = Array.isArray(t.documents.audience) 
              ? t.documents.audience 
              : (t.documents.audience ? [t.documents.audience] : [])
            return filters.audience.some(a => docAudiences.includes(a))
          } catch (e) {
            return false
          }
        })
      }
      
      console.log('[缩略图查询] 🔍 筛选后数量:', filteredThumbnails.length)
      
      // 格式化返回数据
      const formatted = filteredThumbnails.map(t => ({
        id: t.id,
        url: t.url,
        slideIndex: t.slide_index,
        pageType: t.page_type,
        document: {
          id: t.documents.id,
          name: t.documents.name,
          createdAt: t.documents.created_at,
          cover: t.documents.cover
        }
      }))
      
      res.json({
        success: true,
        data: {
          thumbnails: formatted
        }
      })
    } else {
      // 实战版：需要按客户分组，每个客户下按文档分组
      const thumbnails = await prisma.thumbnails.findMany({
        where: whereBase,
        include: {
          documents: {
            select: {
              id: true,
              name: true,
              customer_name: true,
              created_at: true,
              audience_names: true,
              cover: true,
              product: true,
              industry: true,
              audience: true
            }
          }
        },
        orderBy: [
          { documents: { customer_name: 'asc' } },
          { documents: { created_at: 'desc' } },
          { slide_index: 'asc' }
        ]
      })
      
      // 应用JSON字段筛选（如果有）
      let filteredThumbnails = thumbnails
      
      // 先根据 productCode 过滤（匹配 documents.product JSON 字段）
      filteredThumbnails = filteredThumbnails.filter(t => {
        try {
          const docProducts = Array.isArray(t.documents.product) 
            ? t.documents.product 
            : (t.documents.product ? [t.documents.product] : [])
          return docProducts.includes(productCode)
        } catch (e) {
          return false
        }
      })
      
      if (filters.product && Array.isArray(filters.product) && filters.product.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docProducts = Array.isArray(t.documents.product) 
              ? t.documents.product 
              : (t.documents.product ? [t.documents.product] : [])
            return filters.product.some(p => docProducts.includes(p))
          } catch (e) {
            return false
          }
        })
      }
      if (filters.industry && Array.isArray(filters.industry) && filters.industry.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docIndustries = Array.isArray(t.documents.industry) 
              ? t.documents.industry 
              : (t.documents.industry ? [t.documents.industry] : [])
            return filters.industry.some(i => docIndustries.includes(i))
          } catch (e) {
            return false
          }
        })
      }
      if (filters.audience && Array.isArray(filters.audience) && filters.audience.length > 0) {
        filteredThumbnails = filteredThumbnails.filter(t => {
          try {
            const docAudiences = Array.isArray(t.documents.audience) 
              ? t.documents.audience 
              : (t.documents.audience ? [t.documents.audience] : [])
            return filters.audience.some(a => docAudiences.includes(a))
          } catch (e) {
            return false
          }
        })
      }
      
      console.log('[缩略图查询] 🔍 实战版筛选后数量:', filteredThumbnails.length)
      
      // 按客户分组，每个客户下按文档分组
      const groupsMap = new Map()
      filteredThumbnails.forEach(t => {
        const customer = t.documents.customer_name || '未分类'
        if (!groupsMap.has(customer)) {
          groupsMap.set(customer, {
            customer,
            meta: '',  // 预留：交流时间等
            documents: new Map()
          })
        }
        
        const group = groupsMap.get(customer)
        const docId = t.documents.id
        
        if (!group.documents.has(docId)) {
          group.documents.set(docId, {
            id: docId,
            name: t.documents.name,
            createdAt: t.documents.created_at,
            audienceNames: t.documents.audience_names,
            cover: t.documents.cover,
            thumbnails: []
          })
        }
        
        group.documents.get(docId).thumbnails.push({
          id: t.id,
          url: t.url,
          slideIndex: t.slide_index,
          pageType: t.page_type
        })
      })
      
      // 转换为数组格式
      const groups = Array.from(groupsMap.values()).map(group => ({
        customer: group.customer,
        meta: group.meta,
        documents: Array.from(group.documents.values())
      }))
      
      res.json({
        success: true,
        data: {
          groups
        }
      })
    }
  } catch (error) {
    console.error('查询缩略图列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router

