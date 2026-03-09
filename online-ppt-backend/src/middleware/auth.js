// online-ppt-backend/src/middleware/auth.js
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'resoft-ppt-secret-change-in-production'

export function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization']
  
  // 调试日志
  console.log('[Auth] 请求路径:', req.path, req.method)
  console.log('[Auth] Authorization header:', authHeader ? authHeader.substring(0, 20) + '...' : '缺失')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[Auth] 401 - 缺少 Bearer token')
    return res.status(401).json({ error: '未登录，请先登录' })
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload  // { userId, username, name, role }
    console.log('[Auth] 认证成功:', req.user.username || req.user.userId)
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      console.warn('[Auth] Token 已过期')
      return res.status(401).json({ error: 'Token 已过期，请重新登录' })
    }
    console.warn('[Auth] Token 无效:', err.message)
    return res.status(401).json({ error: 'Token 无效' })
  }
}
