// 首先加载环境变量（必须在其他 import 之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

// 计算当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件（online-ppt-backend/.env）
const envPath = path.join(__dirname, '..', '.env')
dotenv.config({ path: envPath })

// 调试信息：显示 DATA_DIR 配置
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data')
console.log('📁 数据目录配置:')
console.log(`   DATA_DIR 环境变量: ${process.env.DATA_DIR || '(未设置，使用默认路径)'}`)
console.log(`   实际使用路径: ${DATA_DIR}`)

import express from 'express'
import http from 'http'
import cors from 'cors'
import compression from 'compression'
import toolsRouter from './routes/tools.js'
import aipptChatRouter from './routes/aipptChat.js'
import imagesRouter from './routes/images.js'
import translateRouter from './routes/translate.js'
import templatesRouter from './routes/templates.js'
import documentsRouter from './routes/documents.js'
import salesRouter from './routes/sales.js'
import wopiRouter from './routes/wopi.js'
import personalDocsRouter from './routes/personal-documents.js'
import thumbnailsRouter from './routes/thumbnails.js'
import thumbnailTasksRouter from './routes/thumbnailTasks.js'
import adminRouter from './routes/admin/index.js'
import aipptGenRouter from './routes/aipptGen.js'
import scanScheduler from './services/admin/scanScheduler.js'
import { setupThumbnailProgressWS } from './routes/websocket/thumbnailProgress.js'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import { authMiddleware } from './middleware/auth.js'

const app = express()
const PORT = process.env.PORT || 5001

// 中间件
app.use(cors())

// 启用 gzip 压缩（优化：可减少70-80%的传输大小）
app.use(compression({
  // 只压缩超过 1KB 的响应
  threshold: 1024,
  // 压缩级别（1-9，6是默认值，平衡压缩率和速度）
  level: 6,
  // 过滤函数：决定哪些响应需要压缩
  filter: (req, res) => {
    // 如果请求明确不需要压缩，则跳过
    if (req.headers['x-no-compression']) {
      return false
    }
    // 使用默认的压缩过滤器
    return compression.filter(req, res)
  }
}))

// 增加请求体大小限制到100MB，以支持大文档内容传输（PPT文档可能包含大量图片数据）
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true, limit: '100mb' }))

// 静态资源：模板封面图（data/covers 下的图片）
const coversDir = path.join(DATA_DIR, 'covers')
app.use('/covers', express.static(coversDir))

// 静态资源：预览图快照（data/snapshots 下的图片）
const snapshotsDir = path.join(DATA_DIR, 'snapshots')
app.use('/snapshots', express.static(snapshotsDir))

// 静态资源：AI PPT 幻灯片截图预览
const aipptPreviewsDir = path.join(DATA_DIR, 'aippt-previews')
if (!fs.existsSync(aipptPreviewsDir)) fs.mkdirSync(aipptPreviewsDir, { recursive: true })
app.use('/aippt-gen/previews', express.static(aipptPreviewsDir))

// 静态资源：模板页缩略图（data/templates/thumbnails 下的图片）
const templateThumbsDir = path.join(DATA_DIR, 'templates', 'thumbnails')
app.use('/templates/thumbnails', express.static(templateThumbsDir))

// 认证路由 — 公开，无需登录
app.use('/auth', authRouter)

// 全局认证中间件：白名单以外的所有请求都需要登录
app.use((req, res, next) => {
  const publicPaths = [
    { method: 'GET', path: '/health' },
    { method: 'GET', path: '/tools/models' },
  ]
  // 静态资源路径前缀（无需登录）
  // WOPI 文件接口：OnlyOffice 通过 access_token 验证，不需要登录
  const publicPrefixes = ['/covers/', '/snapshots/', '/thumbnails/', '/templates/thumbnails/', '/wopi/files/', '/aippt-gen/']
  const isPublic = publicPaths.some(
    p => p.method === req.method && req.path === p.path
  ) || publicPrefixes.some(prefix => req.path.startsWith(prefix))

  if (isPublic) return next()
  // 媒体流请求（<audio>/<video> src）无法携带 Authorization header，
  // 支持通过 query param ?token=xxx 传递（行业标准做法）
  if (req.query.token && !req.headers['authorization']) {
    req.headers['authorization'] = `Bearer ${req.query.token}`
  }
  return authMiddleware(req, res, next)
})

// 用户管理路由（需要管理员权限）
app.use('/users', usersRouter)

// 路由 - 按业务模块区分
app.use('/tools', toolsRouter)
app.use('/aippt', aipptChatRouter)
app.use('/aippt-gen', aipptGenRouter)
app.use('/images', imagesRouter)
app.use('/translate', translateRouter)
app.use('/templates', templatesRouter)
app.use('/documents', documentsRouter)
app.use('/thumbnails', thumbnailsRouter)
app.use('/thumbnail-tasks', thumbnailTasksRouter)
app.use('/sales', salesRouter)
app.use('/wopi', wopiRouter)
app.use('/personal-documents', personalDocsRouter)
app.use('/admin', adminRouter)

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 创建 HTTP 服务器并启动 WebSocket 服务
const server = http.createServer(app)

// 启动 WebSocket 服务
setupThumbnailProgressWS(server)

// 启动服务
server.listen(PORT, () => {
  console.log('=========================================')
  console.log(`  AI PPT Server running on port ${PORT}`)
  console.log('=========================================')
  console.log(`  PPT 编辑器接口:`)
  console.log(`  - 大纲生成: POST /tools/aippt_outline`)
  console.log(`  - PPT生成:  POST /tools/aippt`)
  console.log(`  - 智能对话: POST /aippt/chat`)
  console.log(`  - 图片推荐: POST /images/recommend`)
  console.log(`  - 模板列表: GET  /templates`)
  console.log(`  - 新建模板: POST /templates/create`)
  console.log(`  - 文档列表: GET  /documents`)
  console.log(`  - 新建文档: POST /documents/create`)
  console.log(`  - 模板封面: GET  /covers/template_1.webp`)
  console.log(``)
  console.log(`  售前平台接口:`)
  console.log(`  - 产品列表: GET  /api/products`)
  console.log(`  - 问答列表: GET  /api/qa`)
  console.log(`  - 推荐内容: GET  /api/recommendations`)
  console.log(`  - 宣传物料: GET  /api/materials`)
  console.log(`  - 用户信息: GET  /api/user/profile`)
  console.log(``)
  console.log(`  管理后台接口:`)
  console.log(`  - 扫描配置: GET  /api/admin/file-scan/config`)
  console.log(`  - 文件列表: GET  /api/admin/file-scan/files`)
  console.log(`  - 立即处理: POST /api/admin/file-scan/process`)
  console.log(`  - 手动扫描: POST /api/admin/file-scan/scan`)
  console.log(`  - 处理历史: GET  /api/admin/file-scan/history`)
  console.log(``)
  console.log(`  缩略图生成:`)
  console.log(`  - 创建任务: POST /thumbnail-tasks`)
  console.log(`  - WebSocket: ws://localhost:${PORT}/ws/thumbnail-progress?taskId=<taskId>`)
  console.log('=========================================')

  // 启动定时扫描任务
  try {
    scanScheduler.start()
  } catch (error) {
    console.error('[启动] 定时扫描任务启动失败:', error)
  }
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请更换端口或关闭占用该端口的程序`)
    console.error(`   可以使用命令查看占用端口的进程: netstat -ano | findstr :${PORT}`)
  } else {
    console.error('❌ 服务器启动失败:', error)
  }
  process.exit(1)
})

// 处理未捕获的错误
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的 Promise 拒绝:', error)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error)
  process.exit(1)
})
