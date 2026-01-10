/**
 * 角色管理路由
 * 
 * API 路径前缀：/api/admin/system/role
 */

import express from 'express'
import roleService from '../../../services/admin/system/roleService.js'

const router = express.Router()

/**
 * GET /api/admin/system/role
 * 获取角色列表
 * 
 * Query参数：
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - keyword: 关键词搜索（角色名称或权限字符）
 * - status: 状态筛选（0=正常，1=停用）
 */
router.get('/', async (req, res) => {
  try {
    const result = await roleService.getRoleList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[角色管理] 获取角色列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取角色列表失败'
    })
  }
})

/**
 * GET /api/admin/system/role/:id
 * 获取角色详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await roleService.getRoleById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[角色管理] 获取角色详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取角色详情失败'
    })
  }
})

/**
 * POST /api/admin/system/role
 * 创建角色
 * 
 * Body: {
 *   role_name: "角色名称",
 *   role_key: "role_key",
 *   role_sort: 0,
 *   status: "0",
 *   remark: "备注"
 * }
 */
router.post('/', async (req, res) => {
  try {
    const result = await roleService.createRole(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[角色管理] 创建角色失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建角色失败'
    })
  }
})

/**
 * PUT /api/admin/system/role/:id
 * 更新角色
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await roleService.updateRole(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[角色管理] 更新角色失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新角色失败'
    })
  }
})

/**
 * DELETE /api/admin/system/role/:id
 * 删除角色
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await roleService.deleteRole(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[角色管理] 删除角色失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除角色失败'
    })
  }
})

export default router

