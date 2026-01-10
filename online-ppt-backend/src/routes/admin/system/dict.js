/**
 * 字典管理路由
 * 
 * API 路径前缀：/api/admin/system/dict
 */

import express from 'express'
import dictService from '../../../services/admin/system/dictService.js'

const router = express.Router()

// ==================== 字典类型管理 ====================

/**
 * GET /api/admin/system/dict/types
 * 获取字典类型列表
 * 
 * Query参数：
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - keyword: 关键词搜索（字典类型代码或名称）
 * - status: 状态筛选（0=正常，1=停用）
 */
router.get('/types', async (req, res) => {
  try {
    const result = await dictService.getDictTypeList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[字典管理] 获取字典类型列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取字典类型列表失败'
    })
  }
})

/**
 * GET /api/admin/system/dict/types/:id
 * 获取字典类型详情
 */
router.get('/types/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await dictService.getDictTypeById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[字典管理] 获取字典类型详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取字典类型详情失败'
    })
  }
})

/**
 * POST /api/admin/system/dict/types
 * 创建字典类型
 * 
 * Body: {
 *   dict_type: "user_status",
 *   dict_name: "用户状态",
 *   status: "0",
 *   remark: "备注",
 *   sort_order: 0
 * }
 */
router.post('/types', async (req, res) => {
  try {
    const result = await dictService.createDictType(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[字典管理] 创建字典类型失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建字典类型失败'
    })
  }
})

/**
 * PUT /api/admin/system/dict/types/:id
 * 更新字典类型
 */
router.put('/types/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await dictService.updateDictType(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[字典管理] 更新字典类型失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新字典类型失败'
    })
  }
})

/**
 * DELETE /api/admin/system/dict/types/:id
 * 删除字典类型
 */
router.delete('/types/:id', async (req, res) => {
  try {
    const { id } = req.params
    await dictService.deleteDictType(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[字典管理] 删除字典类型失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除字典类型失败'
    })
  }
})

// ==================== 字典数据管理 ====================

/**
 * GET /api/admin/system/dict/data
 * 获取字典数据列表
 * 
 * Query参数：
 * - dict_type: 字典类型代码（必填）
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - keyword: 关键词搜索（字典标签或值）
 * - status: 状态筛选（0=正常，1=停用）
 */
router.get('/data', async (req, res) => {
  try {
    const result = await dictService.getDictDataList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[字典管理] 获取字典数据列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取字典数据列表失败'
    })
  }
})

/**
 * GET /api/admin/system/dict/data/:id
 * 获取字典数据详情
 */
router.get('/data/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await dictService.getDictDataById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[字典管理] 获取字典数据详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取字典数据详情失败'
    })
  }
})

/**
 * POST /api/admin/system/dict/data
 * 创建字典数据
 * 
 * Body: {
 *   dict_type: "user_status",
 *   dict_label: "正常",
 *   dict_value: "0",
 *   dict_sort: 0,
 *   status: "0",
 *   is_default: "N",
 *   remark: "备注"
 * }
 */
router.post('/data', async (req, res) => {
  try {
    const result = await dictService.createDictData(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[字典管理] 创建字典数据失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建字典数据失败'
    })
  }
})

/**
 * PUT /api/admin/system/dict/data/:id
 * 更新字典数据
 */
router.put('/data/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await dictService.updateDictData(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[字典管理] 更新字典数据失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新字典数据失败'
    })
  }
})

/**
 * DELETE /api/admin/system/dict/data/:id
 * 删除字典数据
 */
router.delete('/data/:id', async (req, res) => {
  try {
    const { id } = req.params
    await dictService.deleteDictData(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[字典管理] 删除字典数据失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除字典数据失败'
    })
  }
})

// ==================== 字典查询（前端工具库使用） ====================

/**
 * GET /api/admin/system/dict/type/:dictType
 * 根据字典类型代码获取字典数据（前端工具库使用）
 * 只返回正常状态的字典数据，按排序字段排序
 */
router.get('/type/:dictType', async (req, res) => {
  try {
    const { dictType } = req.params
    const data = await dictService.getDictByType(dictType)
    res.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[字典管理] 获取字典数据失败:', error)
    // 前端工具库使用，失败时返回空数组
    res.json({
      success: true,
      data: []
    })
  }
})

/**
 * POST /api/admin/system/dict/types/batch
 * 批量获取多个字典类型的数据（前端工具库使用）
 * 
 * Body: {
 *   dictTypes: ["user_status", "order_status"]
 * }
 */
router.post('/types/batch', async (req, res) => {
  try {
    const { dictTypes } = req.body
    if (!Array.isArray(dictTypes)) {
      return res.status(400).json({
        success: false,
        error: 'dictTypes 必须是数组'
      })
    }
    const data = await dictService.getDictsByTypes(dictTypes)
    res.json({
      success: true,
      data
    })
  } catch (error) {
    console.error('[字典管理] 批量获取字典数据失败:', error)
    // 前端工具库使用，失败时返回空对象
    res.json({
      success: true,
      data: {}
    })
  }
})

export default router

