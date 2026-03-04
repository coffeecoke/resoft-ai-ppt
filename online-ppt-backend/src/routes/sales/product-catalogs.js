import express from 'express'
import * as prismaClient from '@prisma/client'

const router = express.Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

/**
 * GET /api/sales/product-catalogs
 * 获取产品目录树（支持筛选）
 * 
 * Query参数:
 * - productId: 产品ID（可选，如果所有产品共用目录则传null或不传）
 * - filters: JSON字符串，包含筛选条件 {product, customer, industry, audience}
 */
router.get('/', async (req, res) => {
  try {
    const { productId, filters: filtersStr } = req.query
    
    // 解析筛选条件
    let filters = {}
    if (filtersStr) {
      try {
        filters = typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr
      } catch (e) {
        console.warn('解析筛选条件失败:', e)
      }
    }
    
    const hasFilters = Object.keys(filters).length > 0
    
    console.log('[产品目录树] 📥 收到请求:', {
      productId,
      filters,
      hasFilters
    })
    
    // 1. 查询目录树（所有产品共用目录，product_id 为 null）
    // ⚠️ 重要：目录树始终返回完整结构，不受筛选条件影响
    // 筛选条件只用于统计每个目录下有多少条数据
    const catalogs = await prisma.product_catalogs.findMany({
      where: {
        // product_id: null,  // 所有产品共用目录
        is_active: true
      },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })
    
    // 2. 为每个二级目录统计缩略图数量（统计时应用筛选条件）
    const catalogStats = await Promise.all(
      catalogs
        .filter(c => c.level === 2 && c.code)  // 只统计有code的二级目录
        .map(async (catalog) => {
          // 构建基础where条件
          const whereBase = {
            page_type: catalog.code,
            documents: {
              status: 'published'
            }
          }
          
          // 应用客户名称筛选（字符串字段）
          if (hasFilters && filters.customer) {
            whereBase.documents.customer_name = filters.customer
          }
          
          // 如果有productId，筛选产品
          if (productId) {
            whereBase.documents.product_id = productId
          }
          
          // 由于Prisma对JSON字段查询支持有限，需要先查询所有缩略图，再在应用层筛选
          let publicThumbnails = []
          let practicalThumbnails = []
          
          if (hasFilters && (filters.industry || filters.audience)) {
            // 有JSON字段筛选时，需要先获取documents再过滤
            publicThumbnails = await prisma.thumbnails.findMany({
              where: {
                ...whereBase,
                documents: {
                  ...whereBase.documents,
                  tag: 'public'
                }
              },
              include: {
                documents: {
                  select: {
                    industry: true,
                    audience: true
                  }
                }
              }
            })
            
            practicalThumbnails = await prisma.thumbnails.findMany({
              where: {
                ...whereBase,
                documents: {
                  ...whereBase.documents,
                  tag: 'practical'
                }
              },
              include: {
                documents: {
                  select: {
                    industry: true,
                    audience: true
                  }
                }
              }
            })
            
            // 应用层筛选：检查JSON数组是否包含筛选值
            const matchesFilter = (doc) => {
              // 行业筛选（任一匹配即可）
              if (filters.industry && filters.industry.length > 0) {
                const docIndustries = Array.isArray(doc.industry) ? doc.industry : []
                const hasMatchingIndustry = filters.industry.some(filterInd => 
                  docIndustries.includes(filterInd)
                )
                if (!hasMatchingIndustry) return false
              }
              
              // 交流对象筛选（任一匹配即可）
              if (filters.audience && filters.audience.length > 0) {
                const docAudiences = Array.isArray(doc.audience) ? doc.audience : []
                const hasMatchingAudience = filters.audience.some(filterAud => 
                  docAudiences.includes(filterAud)
                )
                if (!hasMatchingAudience) return false
              }
              
              return true
            }
            
            publicThumbnails = publicThumbnails.filter(t => matchesFilter(t.documents))
            practicalThumbnails = practicalThumbnails.filter(t => matchesFilter(t.documents))
          } else {
            // 没有JSON字段筛选时，直接count即可
            const [publicCount, practicalCount] = await Promise.all([
              prisma.thumbnails.count({
                where: {
                  ...whereBase,
                  documents: {
                    ...whereBase.documents,
                    tag: 'public'
                  }
                }
              }),
              prisma.thumbnails.count({
                where: {
                  ...whereBase,
                  documents: {
                    ...whereBase.documents,
                    tag: 'practical'
                  }
                }
              })
            ])
            
            return {
              catalogId: catalog.id,
              publicCount,
              practicalCount
            }
          }
          
          return {
            catalogId: catalog.id,
            publicCount: publicThumbnails.length,
            practicalCount: practicalThumbnails.length
          }
        })
    )
    
    // 3. 构建树形结构并应用筛选
    const statsMap = new Map(catalogStats.map(s => [s.catalogId, s]))
    
    // 构建树形结构
    const level1Catalogs = catalogs.filter(c => c.level === 1)
    const level2Catalogs = catalogs.filter(c => c.level === 2)
    
    const tree = level1Catalogs
      .map(level1 => {
        const children = level2Catalogs
          .filter(c => c.parent_id === level1.id)
          .map(level2 => {
            const stats = statsMap.get(level2.id) || { publicCount: 0, practicalCount: 0 }
            return {
              id: level2.id,
              name: level2.name,
              code: level2.code,
              level: level2.level,
              parentId: level2.parent_id,
              sortOrder: level2.sort_order,
              statistics: {
                publicCount: stats.publicCount,
                practicalCount: stats.practicalCount
              }
            }
          })
          .filter(child => {
            // ⚠️ 重要：目录树始终显示所有目录，不管有没有数据
            // 筛选条件只影响统计数字（statistics），不影响目录是否显示
            // 如果需要隐藏没有数据的目录，可以在前端处理
            return true
          })
        
        return {
          id: level1.id,
          name: level1.name,
          code: level1.code,
          level: level1.level,
          parentId: level1.parent_id,
          sortOrder: level1.sort_order,
          children
        }
      })
      .filter(level1 => {
        // ⚠️ 重要：一级目录也始终显示，即使子目录都没有数据
        // 注释掉原来的过滤逻辑
        // return level1.children.length > 0
        return true
      })
    
    console.log('[产品目录树] 📦 返回结果:', {
      level1Count: tree.length,
      level2Count: tree.reduce((sum, l1) => sum + l1.children.length, 0),
      hasFilters
    })
    
    res.json({
      success: true,
      data: {
        catalogs: tree
      }
    })
  } catch (error) {
    console.error('查询产品目录树失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router

