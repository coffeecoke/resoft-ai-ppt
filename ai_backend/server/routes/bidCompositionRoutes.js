/**
 * 投标组合路由
 */

const express = require('express')
const bidCompositionService = require('../services/bidCompositionService')

const router = express.Router()

/**
 * POST /api/bid-composition
 * 创建组合
 */
router.post('/', async (req, res) => {
  try {
    const data = await bidCompositionService.create(req.body)
    res.json({ success: true, message: '创建成功', data })
  } catch (error) {
    console.error('创建组合失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/bid-composition/list
 * 获取组合列表
 */
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20
    const result = await bidCompositionService.getList(page, pageSize)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('获取组合列表失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/bid-composition/:id
 * 获取组合详情（含所有章节项）
 */
router.get('/:id', async (req, res) => {
  try {
    const data = await bidCompositionService.getDetail(req.params.id)
    res.json({ success: true, data })
  } catch (error) {
    console.error('获取组合详情失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * PUT /api/bid-composition/:id
 * 更新组合基本信息
 */
router.put('/:id', async (req, res) => {
  try {
    const data = await bidCompositionService.update(req.params.id, req.body)
    res.json({ success: true, message: '更新成功', data })
  } catch (error) {
    console.error('更新组合失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * DELETE /api/bid-composition/:id
 * 删除组合
 */
router.delete('/:id', async (req, res) => {
  try {
    await bidCompositionService.delete(req.params.id)
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除组合失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// ==================== 组合项管理 ====================

/**
 * POST /api/bid-composition/:id/items
 * 添加章节到组合
 */
router.post('/:id/items', async (req, res) => {
  try {
    const data = await bidCompositionService.addItem(req.params.id, req.body)
    res.json({ success: true, message: '添加成功', data })
  } catch (error) {
    console.error('添加组合项失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * POST /api/bid-composition/:id/import-directory/:tenderId
 * 从招标目录一键导入到组合
 */
router.post('/:id/import-directory/:tenderId', async (req, res) => {
  try {
    const result = await bidCompositionService.addItemsFromDirectory(req.params.id, req.params.tenderId)
    res.json({ success: true, message: `成功导入 ${result.count} 个章节`, ...result })
  } catch (error) {
    console.error('导入目录失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * PUT /api/bid-composition/items/:itemId
 * 编辑组合项
 */
router.put('/items/:itemId', async (req, res) => {
  try {
    const data = await bidCompositionService.updateItem(req.params.itemId, req.body)
    res.json({ success: true, message: '更新成功', data })
  } catch (error) {
    console.error('更新组合项失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * DELETE /api/bid-composition/items/:itemId
 * 移除组合项
 */
router.delete('/items/:itemId', async (req, res) => {
  try {
    await bidCompositionService.removeItem(req.params.itemId)
    res.json({ success: true, message: '移除成功' })
  } catch (error) {
    console.error('移除组合项失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * PUT /api/bid-composition/:id/reorder
 * 批量排序组合项
 */
router.put('/:id/reorder', async (req, res) => {
  try {
    const { orderedIds } = req.body
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ success: false, message: 'orderedIds 必须为数组' })
    }
    const result = await bidCompositionService.reorderItems(req.params.id, orderedIds)
    res.json({ success: true, message: '排序成功', ...result })
  } catch (error) {
    console.error('排序失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
