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

// 外部系统登录验证
async function verifyExternalLogin(username, password) {
  const loginUrl = process.env.EXTERNAL_LOGIN_URL
  if (!loginUrl) {
    console.error('[外部登录] 未配置 EXTERNAL_LOGIN_URL')
    return { success: false }
  }

  try {
    // Step 1: GET 页面获取 session cookie 和 ViewState
    const getRes = await fetch(loginUrl, { signal: AbortSignal.timeout(10000) })
    const cookie = getRes.headers.get('set-cookie')?.split(';')[0]
    const html = await getRes.text()
    const vsMatch = html.match(/id="__VIEWSTATE"\s+value="([^"]*)"/)
    const vsgMatch = html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]*)"/)

    // Step 2: POST 验证
    const body = new URLSearchParams({
      __VIEWSTATE: vsMatch?.[1] || '',
      __VIEWSTATEGENERATOR: vsgMatch?.[1] || '',
      txtUserName: username,
      txtPassword: password,
      btnLogin: '登录',
    })
    const postRes = await fetch(loginUrl, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
      body,
      signal: AbortSignal.timeout(10000),
    })

    if (postRes.status === 302) {
      const location = postRes.headers.get('location')
      if (location) {
        const uid = new URL(location).searchParams.get('uid')
        if (uid) {
          console.log(`[外部登录] 验证成功: uid=${uid}`)
          return { success: true, uid }
        }
      }
    }
    console.log(`[外部登录] 验证失败: status=${postRes.status}`)
    return { success: false }
  } catch (err) {
    console.error('[外部登录] 请求异常:', err.message)
    return { success: false }
  }
}

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      return res.status(400).json({ error: '请输入用户名和密码' })
    }

    const user = await prisma.users.findUnique({ where: { username } })

    // admin 用户 → 本地密码验证
    if (user?.role === 'admin') {
      if (user.status !== 'active') {
        return res.status(401).json({ error: '账号已被禁用' })
      }
      if (!user.password_hash) {
        return res.status(401).json({ error: '该账号不支持密码登录' })
      }
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) {
        return res.status(401).json({ error: '用户名或密码错误' })
      }
      // admin 验证通过，生成 token
      const payload = { userId: user.id, username: user.username, name: user.name, role: user.role }
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })
      await prisma.users.update({
        where: { id: user.id },
        data: { last_login_at: new Date(), login_count: { increment: 1 } },
      })
      await prisma.audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          user_id: user.id,
          username: user.username,
          action: 'login',
          resource: 'auth',
          detail: '本地验证',
          ip_address: req.ip,
          user_agent: req.headers['user-agent']?.slice(0, 500),
        },
      })
      return res.json({
        token,
        user: { userId: user.id, username: user.username, name: user.name, role: user.role, department: user.department_name },
      })
    }

    // 普通用户 → 外部系统验证
    const result = await verifyExternalLogin(username, password)
    if (!result.success) {
      return res.status(401).json({ error: '用户名或密码错误' })
    }

    // 查找或创建本地用户
    let localUser = user
    if (!localUser) {
      localUser = await prisma.users.create({
        data: {
          id: crypto.randomUUID(),
          username: result.uid,
          name: result.uid,
          role: 'user',
          status: 'active',
        },
      })
      console.log(`[外部登录] 自动创建用户: ${result.uid}`)
    } else if (localUser.status !== 'active') {
      return res.status(401).json({ error: '账号已被禁用' })
    }

    const payload = { userId: localUser.id, username: localUser.username, name: localUser.name, role: localUser.role }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES })

    await prisma.users.update({
      where: { id: localUser.id },
      data: { last_login_at: new Date(), login_count: { increment: 1 } },
    })

    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        user_id: localUser.id,
        username: localUser.username,
        action: 'login',
        resource: 'auth',
        detail: '外部验证',
        ip_address: req.ip,
        user_agent: req.headers['user-agent']?.slice(0, 500),
      },
    })

    res.json({
      token,
      user: { userId: localUser.id, username: localUser.username, name: localUser.name, role: localUser.role, department: localUser.department_name },
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
