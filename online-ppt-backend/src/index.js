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

const app = express()
const PORT = process.env.PORT || 5001

// 计算当前文件目录（ESM 环境无 __dirname，需要自行计算）
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 中间件
app.use(cors())
// 增加请求体大小限制到50MB，以支持大Word文档内容传输
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 静态资源：模板封面图（data/covers 下的图片）
const coversDir = path.join(__dirname, '..', 'data', 'covers')
app.use('/covers', express.static(coversDir))

// 路由
app.use('/tools', toolsRouter)
app.use('/aippt', aipptChatRouter)  // 对话式PPT编辑
app.use('/images', imagesRouter)    // 图片推荐
app.use('/tools/translate', translateRouter)  // 翻译服务
app.use('/templates', templatesRouter)        // 模板管理

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// 启动服务
app.listen(PORT, () => {
  console.log('=========================================')
  console.log(`  AI PPT Server running on port ${PORT}`)
  console.log('=========================================')
  console.log(`  - 大纲生成: POST /tools/aippt_outline`)
  console.log(`  - PPT生成:  POST /tools/aippt`)
  console.log(`  - 智能对话: POST /aippt/chat`)
  console.log(`  - 图片推荐: POST /images/recommend`)
  console.log(`  - 模板列表: GET  /templates`)
  console.log(`  - 新建模板: POST /templates/create`)
  console.log(`  - 模板封面: GET  /covers/template_1.webp`)
  console.log('=========================================')
})
