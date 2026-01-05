import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
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
