// online-ppt-backend/src/routes/auth.js
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET || 'resoft-ppt-secret-change-in-production'
const JWT_EXPIRES = '8h'

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    const user = await prisma.users.findUnique({ where: { username } })
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: '用户名或密码错误' })
    }
    if (!user.password_hash) {
      return res.status(401).json({ error: '该账号不支持密码登录' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    const payload = { userId: user.id, username: user.username, name: user.name, role: user.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    // 更新最后登录时间
    await prisma.users.update({
      where: { id: user.id },
      data: { last_login_at: new Date(), login_count: { increment: 1 } },
    })

    // 记录审计日志
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: user.id,
        username: user.username,
        action: 'login',
        resource: 'auth',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']?.slice(0, 500),
      },
    })

    res.json({
      token,
      user: { userId: user.id, username: user.username, name: user.name, role: user.role, department: user.department },
    })
  } catch (err) {
    console.error('[登录] 错误:', err)
    res.status(500).json({ error: '登录失败，请稍后重试' })
  }
})

// GET /auth/me  — 获取当前用户信息
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user.userId },
      select: { id: true, username: true, name: true, department: true, role: true, status: true, last_login_at: true },
    })
    if (!user) return res.status(404).json({ error: '用户不存在' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' })
  }
})

// POST /auth/logout  — 前端清除 token 即可，服务端记录日志
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: req.user.userId,
        username: req.user.username,
        action: 'logout',
        resource: 'auth',
        ip_address: req.ip,
      },
    })
  } catch (_) { /* 日志失败不影响登出 */ }
  res.json({ message: '已登出' })
})

// PUT /auth/password  — 修改自己的密码
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '请提供旧密码和新密码' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少6位' })
    }

    const user = await prisma.users.findUnique({ where: { id: req.user.userId } })
    if (!user?.password_hash) return res.status(400).json({ error: '该账号不支持密码修改' })

    const valid = await bcrypt.compare(oldPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: '旧密码错误' })

    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.users.update({ where: { id: user.id }, data: { password_hash: hash } })

    res.json({ message: '密码修改成功' })
  } catch (err) {
    res.status(500).json({ error: '密码修改失败' })
  }
})

export default router
