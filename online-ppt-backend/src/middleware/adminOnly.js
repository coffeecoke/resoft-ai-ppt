// online-ppt-backend/src/middleware/adminOnly.js
export function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: '权限不足，需要管理员权限' })
  }
  next()
}
