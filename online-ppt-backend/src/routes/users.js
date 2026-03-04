// online-ppt-backend/src/routes/users.js
import express from 'express'
import bcrypt from 'bcryptjs'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { authMiddleware } from '../middleware/auth.js'
import { adminOnly } from '../middleware/adminOnly.js'

const router = express.Router()
const prisma = new PrismaClient()

// 所有 /users 路由都需要登录 + 管理员权限
router.use(authMiddleware, adminOnly)

// GET /users  — 用户列表
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword = '' } = req.query
    const skip = (Number(page) - 1) * Number(pageSize)
    const where = keyword
      ? { OR: [{ username: { contains: keyword } }, { name: { contains: keyword } }] }
      : {}

    const [total, list] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        skip,
        take: Number(pageSize),
        orderBy: { created_at: 'desc' },
        select: { id: true, username: true, name: true, department: true, role: true, status: true, last_login_at: true, login_count: true, created_at: true },
      }),
    ])
    res.json({ total, list, page: Number(page), pageSize: Number(pageSize) })
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' })
  }
})

// POST /users  — 创建用户
router.post('/', async (req, res) => {
  try {
    const { username, name, department, role = 'user', password } = req.body
    if (!username || !name || !password) {
      return res.status(400).json({ error: 'username、name、password 为必填项' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少6位' })
    }

    const exists = await prisma.users.findUnique({ where: { username } })
    if (exists) return res.status(409).json({ error: '用户名已存在' })

    const hash = await bcrypt.hash(password, 12)
    const user = await prisma.users.create({
      data: {
        id: crypto.randomUUID(),
        username,
        name,
        department,
        role,
        status: 'active',
        password_hash: hash,
        created_by: req.user.userId,
      },
      select: { id: true, username: true, name: true, department: true, role: true, status: true, created_at: true },
    })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'create',
        resource: 'user',
        resource_id: user.id,
        detail: { username, name, role },
        ip_address: req.ip,
      },
    })

    res.status(201).json(user)
  } catch (err) {
    res.status(500).json({ error: '创建用户失败' })
  }
})

// PUT /users/:id  — 修改用户信息
router.put('/:id', async (req, res) => {
  try {
    const { name, department, role, status } = req.body
    const updated = await prisma.users.update({
      where: { id: req.params.id },
      data: { name, department, role, status },
      select: { id: true, username: true, name: true, department: true, role: true, status: true },
    })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'update',
        resource: 'user',
        resource_id: updated.id,
        detail: { name, department, role, status },
        ip_address: req.ip,
      },
    })

    res.json(updated)
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '修改用户失败' })
  }
})

// POST /users/:id/reset-password  — 重置密码
router.post('/:id/reset-password', async (req, res) => {
  try {
    const { newPassword } = req.body
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.users.update({ where: { id: req.params.id }, data: { password_hash: hash } })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'reset-password',
        resource: 'user',
        resource_id: req.params.id,
        ip_address: req.ip,
      },
    })

    res.json({ message: '密码重置成功' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '重置密码失败' })
  }
})

// DELETE /users/:id  — 禁用用户（软删除）
router.delete('/:id', async (req, res) => {
  try {
    if (req.params.id === req.user.userId) {
      return res.status(400).json({ error: '不能禁用自己的账号' })
    }
    await prisma.users.update({ where: { id: req.params.id }, data: { status: 'disabled' } })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'disable',
        resource: 'user',
        resource_id: req.params.id,
        ip_address: req.ip,
      },
    })

    res.json({ message: '用户已禁用' })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: '用户不存在' })
    res.status(500).json({ error: '禁用用户失败' })
  }
})

export default router
