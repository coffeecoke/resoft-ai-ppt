/**
 * 管理后台静态页路径前缀（与 app.use(AI_BACKEND_BASE_PATH, static) 一致）
 * 例：环境变量 AI_BACKEND_BASE_PATH=ai_backend → 返回 "/ai_backend"
 */
function getAiBackendStaticPathPrefix() {
  const raw = process.env.AI_BACKEND_BASE_PATH
  if (raw == null || !String(raw).trim()) return ''
  const s = String(raw).trim().replace(/^\/+|\/+$/g, '')
  return s ? `/${s}` : ''
}

module.exports = { getAiBackendStaticPathPrefix }
