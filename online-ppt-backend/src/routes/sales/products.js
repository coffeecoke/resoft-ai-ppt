import express from 'express'
import * as prismaClient from '@prisma/client'

const router = express.Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

/**
 * GET /api/sales/products
 * 获取产品列表（包含统计数据）
 */
router.get('/', async (req, res) => {
  try {
    const { category, isActive } = req.query
    
    // 构建查询条件
    const where = {}
    if (category) {
      where.category = category
    }
    if (isActive !== undefined) {
      where.is_active = isActive === 'true'
    }
    
    // 查询产品列表
    const products = await prisma.products.findMany({
      where,
      orderBy: { sort_order: 'asc' },
      include: {
        _count: {
          select: {
            sessions: true,      // 交流场次数量
            documents: true,     // PPT 文档数量（回传的）
          }
        }
      }
    })
    
    // 为每个产品统计关心的问题数量
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        // 统计关心的问题数量（通过 sessions 表关联）
        const concernCount = await prisma.session_concerns.count({
          where: {
            sessions: {
              product_id: product.id
            }
          }
        })
        
        return {
          id: product.id,
          name: product.name,
          code: product.code,
          description: product.description,
          category: product.category,
          tags: product.tags,
          icon: product.icon,
          cover: product.cover,
          sortOrder: product.sort_order,
          isActive: product.is_active,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          // 统计数据
          stats: {
            sessions: product._count.sessions,      // 交流场次数量
            ppts: product._count.documents,         // PPT 数量
            questions: concernCount                 // 关心问题数量
          }
        }
      })
    )
    
    res.json({
      success: true,
      data: productsWithStats
    })
  } catch (error) {
    console.error('查询产品列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/sales/products/stats
 * 获取产品统计数据（用于首页重点关注产品卡片）
 *
 * 返回所有产品的统计数据：
 * - sessions: 交流会议数量（transcriptions 表）
 * - ppts: PPT 资料数量（documents 表，仅已发布）
 * - questions: 客户问题数量（concerns 表）
 * - brochures, tenderFiles, responseFiles: 占位字段，暂时为 0
 */
router.get('/stats', async (req, res) => {
  try {
    // 1. 获取所有产品列表
    const products = await prisma.products.findMany({
      select: {
        code: true,
        name: true
      },
      orderBy: { sort_order: 'asc' }
    })

    // 2. 对每个产品统计三类数据
    const stats = await Promise.all(products.map(async (product) => {
      // 统计交流会议（transcriptions 表）
      // 通过 product_code 或 product_name 关联
      const sessions = await prisma.transcriptions.count({
        where: {
          OR: [
            { product_code: product.code },
            { product_name: product.name }
          ]
        }
      })

      // 统计 PPT 资料（documents 表，仅已发布）
      // 需要检查 product 字段（JSON 数组）是否包含该产品的 code 或 name
      const allDocuments = await prisma.documents.findMany({
        where: {
          status: 'published'
        },
        select: {
          product: true
        }
      })

      const ppts = allDocuments.filter(doc => {
        try {
          const docProducts = Array.isArray(doc.product)
            ? doc.product
            : (doc.product ? [doc.product] : [])
          // 匹配 code 或 name
          return docProducts.includes(product.code) || docProducts.includes(product.name)
        } catch (e) {
          return false
        }
      }).length

      // 统计客户问题（concerns 表）
      // 先查询符合条件的 transcription ids，再统计 concerns
      const transcriptionIds = await prisma.transcriptions.findMany({
        where: {
          OR: [
            { product_code: product.code },
            { product_name: product.name }
          ]
        },
        select: { id: true }
      })

      const questions = await prisma.concerns.count({
        where: {
          transcription_id: {
            in: transcriptionIds.map(t => t.id)
          }
        }
      })

      return {
        code: product.code,
        name: product.name,
        sessions,
        ppts,
        questions,
        brochures: 0,
        tenderFiles: 0,
        responseFiles: 0
      }
    }))

    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('查询产品统计数据失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/sales/products/:productCode/documents
 * 获取产品文档列表（未选目录时使用）
 * 
 * Query参数:
 * - tag: 'public' 或 'practical'
 * - status: 文档状态，默认 'published'
 * - filters: JSON字符串，包含筛选条件 {product, customer, industry, audience}
 * 
 * ⚠️ 注意：productCode 必须是产品的 code，不是 name
 */
router.get('/:productCode/documents', async (req, res) => {
  try {
    const { productCode } = req.params  // productCode 必须是产品的 code
    const { tag = 'public', status = 'published', filters: filtersStr } = req.query
    
    // 解析筛选条件
    let filters = {}
    if (filtersStr) {
      try {
        filters = typeof filtersStr === 'string' ? JSON.parse(filtersStr) : filtersStr
      } catch (e) {
        console.warn('解析筛选条件失败:', e)
      }
    }
    
    // 构建查询条件
    const where = {
      tag: tag,
      status: status
    }
    
    // 应用筛选条件
    if (filters.customer) {
      where.customer_name = filters.customer
    }
    
    // 查询文档列表
    const documents = await prisma.documents.findMany({
      where,
      select: {
        id: true,
        name: true,
        cover: true,
        slide_count: true,
        created_at: true,
        customer_name: true,
        audience_names: true,
        product: true,
        industry: true,
        audience: true
      },
      orderBy: {
        created_at: 'desc'
      }
    })
    
    // 根据 product JSON 字段过滤（匹配传入的 productCode，必须是 code）
    let filteredDocuments = documents.filter(doc => {
      try {
        const docProducts = Array.isArray(doc.product) 
          ? doc.product 
          : (doc.product ? [doc.product] : [])
        
        // 匹配传入的 productCode（必须是 code）
        return docProducts.includes(productCode)
      } catch (e) {
        return false
      }
    })
    
    // 应用JSON字段筛选（如果有，filters.product 也必须是 code 数组）
    if (filters.product && Array.isArray(filters.product) && filters.product.length > 0) {
      filteredDocuments = filteredDocuments.filter(doc => {
        try {
          const docProducts = Array.isArray(doc.product) 
            ? doc.product 
            : (doc.product ? [doc.product] : [])
          // filters.product 中的值必须是 code
          return filters.product.some(p => docProducts.includes(p))
        } catch (e) {
          return false
        }
      })
    }
    if (filters.industry && Array.isArray(filters.industry) && filters.industry.length > 0) {
      filteredDocuments = filteredDocuments.filter(doc => {
        try {
          const docIndustries = Array.isArray(doc.industry) 
            ? doc.industry 
            : (doc.industry ? [doc.industry] : [])
          return filters.industry.some(i => docIndustries.includes(i))
        } catch (e) {
          return false
        }
      })
    }
    if (filters.audience && Array.isArray(filters.audience) && filters.audience.length > 0) {
      filteredDocuments = filteredDocuments.filter(doc => {
        try {
          const docAudiences = Array.isArray(doc.audience) 
            ? doc.audience 
            : (doc.audience ? [doc.audience] : [])
          return filters.audience.some(a => docAudiences.includes(a))
        } catch (e) {
          return false
        }
      })
    }
    
    // 格式化返回数据
    const formatted = filteredDocuments.map(doc => ({
      id: doc.id,
      name: doc.name,
      cover: doc.cover,
      slideCount: doc.slide_count,
      createdAt: doc.created_at,
      customerName: doc.customer_name,
      audienceNames: doc.audience_names
    }))
    
    res.json({
      success: true,
      data: {
        documents: formatted
      }
    })
  } catch (error) {
    console.error('查询产品文档列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * GET /api/sales/products/:id
 * 获取产品详情（包含统计数据）
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    const product = await prisma.products.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sessions: true,
            documents: true,
          }
        }
      }
    })
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: '产品不存在'
      })
    }
    
    // 统计关心的问题数量
    const concernCount = await prisma.session_concerns.count({
      where: {
        sessions: {
          product_id: product.id
        }
      }
    })
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        code: product.code,
        description: product.description,
        category: product.category,
        tags: product.tags,
        icon: product.icon,
        cover: product.cover,
        sortOrder: product.sort_order,
        isActive: product.is_active,
        createdAt: product.created_at,
        updatedAt: product.updated_at,
        stats: {
          sessions: product._count.sessions,
          ppts: product._count.documents,
          questions: concernCount
        }
      }
    })
  } catch (error) {
    console.error('查询产品详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * POST /api/sales/products
 * 创建产品
 */
router.post('/', async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      category,
      tags,
      icon,
      cover,
      sortOrder = 0
    } = req.body
    
    // 生成 ID
    const { randomUUID } = await import('crypto')
    const productId = randomUUID()
    
    const product = await prisma.products.create({
      data: {
        id: productId,
        name,
        code,
        description,
        category,
        tags,
        icon,
        cover,
        sort_order: sortOrder,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      }
    })
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        code: product.code,
        description: product.description,
        category: product.category,
        tags: product.tags,
        icon: product.icon,
        cover: product.cover,
        sortOrder: product.sort_order,
        isActive: product.is_active,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }
    })
  } catch (error) {
    console.error('创建产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * PUT /api/sales/products/:id
 * 更新产品
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      code,
      description,
      category,
      tags,
      icon,
      cover,
      sortOrder,
      isActive
    } = req.body
    
    // 检查产品是否存在
    const existingProduct = await prisma.products.findUnique({
      where: { id }
    })
    
    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: '产品不存在'
      })
    }
    
    // 更新产品
    const product = await prisma.products.update({
      where: { id },
      data: {
        name,
        code,
        description,
        category,
        tags,
        icon,
        cover,
        sort_order: sortOrder,
        is_active: isActive,
        updated_at: new Date()
      }
    })
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.name,
        code: product.code,
        description: product.description,
        category: product.category,
        tags: product.tags,
        icon: product.icon,
        cover: product.cover,
        sortOrder: product.sort_order,
        isActive: product.is_active,
        createdAt: product.created_at,
        updatedAt: product.updated_at
      }
    })
  } catch (error) {
    console.error('更新产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * DELETE /api/sales/products/:id
 * 删除产品（软删除，设为不启用）
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // 检查产品是否存在
    const product = await prisma.products.findUnique({
      where: { id }
    })

    if (!product) {
      return res.status(404).json({
        success: false,
        error: '产品不存在'
      })
    }

    // 软删除：设为不启用
    await prisma.products.update({
      where: { id },
      data: {
        is_active: false,
        updated_at: new Date()
      }
    })

    res.json({
      success: true,
      message: '产品已删除'
    })
  } catch (error) {
    console.error('删除产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router
