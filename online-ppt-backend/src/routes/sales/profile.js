import express from 'express'
import { documentService } from '../../services/documentService.js'
import * as prismaClient from '@prisma/client'

const router = express.Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

/**
 * 回传PPT
 * POST /api/sales/profile/ppt/upload
 */
router.post('/ppt/upload', async (req, res) => {
  try {
    const {
      name,
      customerName,
      product,
      industry,
      audience,
      language,
      slides
    } = req.body || {}
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'PPT标题不能为空'
      })
    }
    
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'PPT内容不能为空'
      })
    }
    
    // ⚠️ 重要：将 product name 转换为 code
    let productCodes = []
    if (product && Array.isArray(product) && product.length > 0) {
      // 查询产品表，将 name 转换为 code
      const products = await prisma.products.findMany({
        where: {
          name: { in: product },
          is_active: true
        },
        select: { code: true }
      })
      productCodes = products.map(p => p.code).filter(Boolean)
      
      // 如果有些 product name 找不到对应的 code，记录警告
      const foundNames = products.length
      if (foundNames < product.length) {
        console.warn(`[Sales Profile] 部分产品名称未找到对应的 code:`, {
          input: product,
          found: foundNames,
          total: product.length
        })
      }
    }
    
    // 使用 documentService 创建文档
    // documentService 会自动处理封面图（从第一页缩略图获取）
    const meta = await documentService.create({
      name: name.trim(),
      category: 'uncategorized',
      status: 'draft',  // 默认为草稿
      tag: 'practical',  // 自动标记为实战
      customerName: customerName || undefined,
      product: productCodes.length > 0 ? productCodes : undefined,  // 存储 code 而不是 name
      industry: (Array.isArray(industry) && industry.length > 0) ? industry : undefined,
      audience: (Array.isArray(audience) && audience.length > 0) ? audience : undefined,
      language: language || undefined,
      initialSlides: slides,  // 传入初始幻灯片数据
      // userId: req.user?.id,  // TODO: 未来从session获取
    })
    
    console.log(`[Sales Profile] PPT回传成功: ${meta.id} - ${name}`)
    
    res.json({
      success: true,
      data: { id: meta.id }
    })
  } catch (error) {
    console.error('[Sales Profile] PPT回传失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'PPT回传失败'
    })
  }
})

/**
 * 获取PPT列表（Profile页面使用）
 * GET /api/sales/profile/ppt/list
 */
router.get('/ppt/list', async (req, res) => {
  try {
    const { tag, status = 'published' } = req.query
    
    // 使用 documentService 获取文档列表
    const filter = { status }
    if (tag && tag !== 'all') {
      filter.tag = tag
    }
    
    let list = await documentService.getAll(filter)
    
    // TODO: 未来按用户过滤
    // if (req.user?.id) {
    //   list = list.filter(item => item.userId === req.user.id)
    // }
    
    res.json({
      success: true,
      data: list
    })
  } catch (error) {
    console.error('[Sales Profile] 获取PPT列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取PPT列表失败'
    })
  }
})

export default router



