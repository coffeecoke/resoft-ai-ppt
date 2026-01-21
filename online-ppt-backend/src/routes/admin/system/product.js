/**
 * 产品解决方案管理路由
 *
 * API 路径前缀：/api/admin/system/product
 */

import express from 'express'
import productService from '../../../services/admin/system/productService.js'

const router = express.Router()

/**
 * GET /api/admin/system/product
 * 获取产品列表
 *
 * Query参数：
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - keyword: 关键词搜索（产品名称或代码）
 * - category: 产品分类筛选
 * - is_active: 启用状态筛选（true/false）
 * - is_featured: 重点产品筛选（true/false）
 */
router.get('/', async (req, res) => {
  try {
    const result = await productService.getProductList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[产品管理] 获取产品列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取产品列表失败'
    })
  }
})

/**
 * GET /api/admin/system/product/:id
 * 获取产品详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await productService.getProductById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[产品管理] 获取产品详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取产品详情失败'
    })
  }
})

/**
 * POST /api/admin/system/product
 * 创建产品
 *
 * Body: {
 *   name: "产品名称",
 *   code: "product_code",
 *   description: "产品描述",
 *   category: "产品分类",
 *   tags: ["标签1", "标签2"],
 *   icon: "图标URL",
 *   cover: "封面URL",
 *   sort_order: 0,
 *   is_active: true,
 *   is_featured: false
 * }
 */
router.post('/', async (req, res) => {
  try {
    const result = await productService.createProduct(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[产品管理] 创建产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建产品失败'
    })
  }
})

/**
 * PUT /api/admin/system/product/:id
 * 更新产品
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await productService.updateProduct(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[产品管理] 更新产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新产品失败'
    })
  }
})

/**
 * DELETE /api/admin/system/product/:id
 * 删除产品
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await productService.deleteProduct(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[产品管理] 删除产品失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除产品失败'
    })
  }
})

export default router
