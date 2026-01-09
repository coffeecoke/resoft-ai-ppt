/**
 * 部门管理路由
 * 
 * API 路径前缀：/api/admin/system/dept
 */

import express from 'express'
import deptService from '../../../services/admin/system/deptService.js'

const router = express.Router()

/**
 * GET /api/admin/system/dept/tree
 * 获取部门树
 * 
 * Query参数：
 * - status: 状态筛选（0=正常，1=停用）
 */
router.get('/tree', async (req, res) => {
  try {
    const result = await deptService.getDeptTree(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[部门管理] 获取部门树失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取部门树失败'
    })
  }
})

/**
 * GET /api/admin/system/dept
 * 获取部门列表（扁平结构）
 * 
 * Query参数：
 * - keyword: 关键词搜索（部门名称）
 * - status: 状态筛选（0=正常，1=停用）
 */
router.get('/', async (req, res) => {
  try {
    const result = await deptService.getDeptList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[部门管理] 获取部门列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取部门列表失败'
    })
  }
})

/**
 * GET /api/admin/system/dept/:id
 * 获取部门详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await deptService.getDeptById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[部门管理] 获取部门详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取部门详情失败'
    })
  }
})

/**
 * POST /api/admin/system/dept
 * 创建部门
 * 
 * Body: {
 *   dept_name: "部门名称",
 *   parent_id: "父部门ID",
 *   order_num: 0,
 *   leader: "负责人",
 *   phone: "联系电话",
 *   email: "邮箱",
 *   status: "0"
 * }
 */
router.post('/', async (req, res) => {
  try {
    const result = await deptService.createDept(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[部门管理] 创建部门失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建部门失败'
    })
  }
})

/**
 * PUT /api/admin/system/dept/:id
 * 更新部门
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await deptService.updateDept(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[部门管理] 更新部门失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新部门失败'
    })
  }
})

/**
 * DELETE /api/admin/system/dept/:id
 * 删除部门
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deptService.deleteDept(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[部门管理] 删除部门失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除部门失败'
    })
  }
})

export default router

