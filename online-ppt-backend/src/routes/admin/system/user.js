/**
 * 用户管理路由
 * 
 * API 路径前缀：/api/admin/system/user
 */

import express from 'express'
import userService from '../../../services/admin/system/userService.js'

const router = express.Router()

/**
 * GET /api/admin/system/user
 * 获取用户列表
 * 
 * Query参数：
 * - page: 页码（默认：1）
 * - pageSize: 每页数量（默认：20）
 * - keyword: 关键词搜索（用户名、昵称、手机号）
 * - status: 状态筛选（0=正常，1=停用）
 * - dept_id: 部门ID筛选
 */
router.get('/', async (req, res) => {
  try {
    const result = await userService.getUserList(req.query)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[用户管理] 获取用户列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取用户列表失败'
    })
  }
})

/**
 * GET /api/admin/system/user/:id
 * 获取用户详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await userService.getUserById(id)
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[用户管理] 获取用户详情失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取用户详情失败'
    })
  }
})

/**
 * POST /api/admin/system/user
 * 创建用户
 * 
 * Body: {
 *   user_name: "用户名",
 *   password: "密码",
 *   nick_name: "昵称",
 *   email: "邮箱",
 *   phone: "手机号",
 *   sex: "0",
 *   status: "0",
 *   dept_id: "部门ID",
 *   role_ids: ["角色ID1", "角色ID2"]
 * }
 */
router.post('/', async (req, res) => {
  try {
    const result = await userService.createUser(req.body)
    res.json({
      success: true,
      data: result,
      message: '创建成功'
    })
  } catch (error) {
    console.error('[用户管理] 创建用户失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '创建用户失败'
    })
  }
})

/**
 * PUT /api/admin/system/user/:id
 * 更新用户
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const result = await userService.updateUser(id, req.body)
    res.json({
      success: true,
      data: result,
      message: '更新成功'
    })
  } catch (error) {
    console.error('[用户管理] 更新用户失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '更新用户失败'
    })
  }
})

/**
 * DELETE /api/admin/system/user/:id
 * 删除用户
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    await userService.deleteUser(id)
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('[用户管理] 删除用户失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '删除用户失败'
    })
  }
})

/**
 * PUT /api/admin/system/user/:id/reset-password
 * 重置用户密码
 * 
 * Body: {
 *   newPassword: "新密码"
 * }
 */
router.put('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params
    const { newPassword } = req.body
    
    if (!newPassword) {
      return res.status(400).json({
        success: false,
        error: '新密码不能为空'
      })
    }
    
    await userService.resetPassword(id, newPassword)
    res.json({
      success: true,
      message: '密码重置成功'
    })
  } catch (error) {
    console.error('[用户管理] 重置密码失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '重置密码失败'
    })
  }
})

export default router

