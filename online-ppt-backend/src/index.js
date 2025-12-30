// 首先加载环境变量（必须在其他 import 之前）
import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import toolsRouter from './routes/tools.js'
import aipptChatRouter from './routes/aipptChat.js'
import imagesRouter from './routes/images.js'
import translateRouter from './routes/translate.js'
import templatesRouter from './routes/templates.js'
import documentsRouter from './routes/documents.js'
import salesRouter from './routes/sales.js'
import thumbnailsRouter from './routes/thumbnails.js'

const app = express()
const PORT = process.env.PORT || 5001

// 计算当前文件目录（ESM 环境无 __dirname，需要自行计算）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 中间件
app.use(cors())
// 增加请求体大小限制到100MB，以支持大文档内容传输（PPT文档可能包含大量图片数据）
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ extended: true, limit: '100mb' }))

// 静态资源：模板封面图（data/covers 下的图片）
const coversDir = path.join(__dirname, '..', 'data', 'covers')
app.use('/covers', express.static(coversDir))

// 静态资源：预览图快照（data/snapshots 下的图片）
const snapshotsDir = path.join(__dirname, '..', 'data', 'snapshots')
app.use('/snapshots', express.static(snapshotsDir))

// 路由 - 按业务模块区分
app.use('/tools', toolsRouter)              // 工具相关接口
app.use('/aippt', aipptChatRouter)          // 对话式PPT编辑
app.use('/images', imagesRouter)            // 图片相关接口
app.use('/translate', translateRouter)      // 翻译服务
app.use('/templates', templatesRouter)      // 模板管理
app.use('/documents', documentsRouter)      // 文档管理
app.use('/thumbnails', thumbnailsRouter)    // 预览图管理
app.use('/sales', salesRouter)              // 售前平台接口

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 启动服务
app.listen(PORT, () => {
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
  console.log('=========================================')
})
