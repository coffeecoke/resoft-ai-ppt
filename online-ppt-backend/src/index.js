import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import toolsRouter from './routes/tools.js'

// 加载环境变量
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

// 中间件
app.use(cors())
// 增加请求体大小限制到50MB，以支持大Word文档内容传输
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 路由
app.use('/tools', toolsRouter)

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
  console.log('=========================================')
})
