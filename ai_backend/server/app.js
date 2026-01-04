/**
 * 文档文本提取器 - Web 服务器
 * Express + 文件上传 + 静态服务
 */

// 加载环境变量
require('dotenv').config()

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const documentRoutes = require('./routes/documentRoutes')
const pptAnalysisRoutes = require('./routes/pptAnalysisRoutes')

const app = express()
const PORT = process.env.PORT || 3000

// 配置文件上传
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads')
    await fs.mkdir(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    cb(null, `${timestamp}_${file.originalname}`)
  }
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.json')) {
      cb(null, true)
    } else {
      cb(new Error('只支持 JSON 文件'))
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
})

// 中间件
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务
app.use(express.static(path.join(__dirname, '../frontend')))
app.use('/output', express.static(path.join(__dirname, '../output')))

// 路由：AI后台文档管理（新增）
app.use('/api/documents', documentRoutes)

// 路由：PPT内容分析（新增）
app.use('/api/ppt-analysis', pptAnalysisRoutes)

// 路由：文件提取接口
app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' })
    }

    console.log(`开始提取文件: ${req.file.originalname}`)

    // 创建时间戳和输出目录
    const now = new Date()
    const dateStr = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // YYYY-MM-DDTHH-MM-SS
    
    const outputDir = path.join(__dirname, '../output', dateStr)
    await fs.mkdir(outputDir, { recursive: true })

    // 生成输出文件名
    const baseName = path.basename(req.file.originalname, '.json')
    const outputFile = path.join(outputDir, `${baseName}_${timestamp}.txt`)
    const mergedFile = path.join(outputDir, `${baseName}_${timestamp}_merged.txt`)

    // 提取文本
    const extractor = new DocumentTextExtractor()
    await extractor.run(req.file.path, outputFile)

    // 读取提取结果统计
    const content = await fs.readFile(outputFile, 'utf-8')
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('='))
    const recordCount = lines.length - 1 // 减去表头

    const mergedContent = await fs.readFile(mergedFile, 'utf-8')
    const mergedLines = mergedContent.split('\n').filter(line => line.trim() && !line.startsWith('='))
    const slideCount = mergedLines.length - 1

    // 删除临时上传文件
    await fs.unlink(req.file.path)

    // 返回结果
    res.json({
      success: true,
      file: req.file.originalname,
      recordCount,
      slideCount,
      timestamp: dateStr,
      detailFile: `/output/${dateStr}/${path.basename(outputFile)}`,
      mergedFile: `/output/${dateStr}/${path.basename(mergedFile)}`
    })

    console.log(`✅ 提取完成: ${req.file.originalname} - ${recordCount} 条记录`)

  } catch (error) {
    console.error('提取失败:', error)
    
    // 清理临时文件
    if (req.file) {
      try {
        await fs.unlink(req.file.path)
      } catch (e) {
        // 忽略删除失败
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || '提取失败'
    })
  }
})

// 路由：获取历史记录
app.get('/api/history', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../output')
    
    // 确保输出目录存在
    await fs.mkdir(outputDir, { recursive: true })
    
    const dates = await fs.readdir(outputDir)
    const history = []

    for (const date of dates) {
      const datePath = path.join(outputDir, date)
      const stat = await fs.stat(datePath)
      
      if (stat.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        const files = await fs.readdir(datePath)
        const txtFiles = files.filter(f => f.endsWith('.txt') && !f.includes('_merged'))
        
        let totalRecords = 0
        for (const file of txtFiles) {
          const filePath = path.join(datePath, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('='))
          totalRecords += lines.length - 1 // 减去表头
        }

        history.push({
          date,
          files: txtFiles,
          totalRecords
        })
      }
    }

    // 按日期倒序排列
    history.sort((a, b) => b.date.localeCompare(a.date))

    res.json(history)

  } catch (error) {
    console.error('获取历史失败:', error)
    res.json([])
  }
})

// 路由：读取文件内容（用于预览）
app.get('/api/preview', async (req, res) => {
  try {
    const { file } = req.query
    
    if (!file) {
      return res.status(400).json({ success: false, message: '缺少文件参数' })
    }
    
    // 安全检查：只允许读取 output 目录下的文件
    if (!file.startsWith('/output/')) {
      return res.status(403).json({ success: false, message: '无权访问该文件' })
    }
    
    const filePath = path.join(__dirname, '..', file.replace(/^\//, ''))
    
    // 检查文件是否存在
    try {
      await fs.access(filePath)
    } catch (err) {
      return res.status(404).json({ success: false, message: '文件不存在' })
    }
    
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8')
    
    res.json({
      success: true,
      content,
      file: path.basename(filePath)
    })
    
  } catch (error) {
    console.error('读取文件失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '读取文件失败'
    })
  }
})

// 路由：健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '服务运行正常' })
})

// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(60))
  console.log('文档文本提取器 - Web 服务已启动')
  console.log('='.repeat(60))
  console.log(`🌐 访问地址: http://localhost:${PORT}`)
  console.log(`📁 输出目录: ${path.join(__dirname, '../output')}`)
  console.log(`📤 上传目录: ${path.join(__dirname, '../uploads')}`)
  console.log('')
  console.log('📋 API 接口:')
  console.log('  [原有功能]')
  console.log('  - 上传提取: POST   /api/extract')
  console.log('  - 历史记录: GET    /api/history')
  console.log('  - 文件预览: GET    /api/preview')
  console.log('  - 健康检查: GET    /api/health')
  console.log('')
  console.log('  [文档管理 - 新增]')
  console.log('  - 文档列表: GET    /api/documents/list')
  console.log('  - 提取内容: POST   /api/documents/:id/extract')
  console.log('  - 提取状态: GET    /api/documents/:id/extract-status')
  console.log('  - 批量提取: POST   /api/documents/batch-extract')
  console.log('')
  console.log('  [PPT内容分析 - 新增]')
  console.log('  - 分析文档(POST): POST   /api/ppt-analysis/analyze/:documentId')
  console.log('  - 分析文档(GET):  GET    /api/ppt-analysis/analyze/:documentId')
  console.log('  - 获取结果:       GET    /api/ppt-analysis/results/:documentId')
  console.log('  - 获取统计:       GET    /api/ppt-analysis/statistics/:documentId')
  console.log('  - 分类标准:       GET    /api/ppt-analysis/categories')
  console.log('  - 单页测试:       POST   /api/ppt-analysis/analyze-single')
  console.log('')
  console.log('  [提示词管理 - 新增]')
  console.log('  - 提示词列表: GET    /api/ppt-analysis/prompts')
  console.log('  - 创建提示词: POST   /api/ppt-analysis/prompts')
  console.log('  - 更新提示词: PUT    /api/ppt-analysis/prompts/:id')
  console.log('  - 删除提示词: DELETE /api/ppt-analysis/prompts/:id')
  console.log('  - 切换状态:   PATCH  /api/ppt-analysis/prompts/:id/toggle')
  console.log('')
  console.log('🤖 支持的AI模型 (20+):')
  console.log('  🔥 推荐: gpt-4o-mini, gpt-4o, deepseek-chat')
  console.log('  🚀 GPT: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano')
  console.log('  🧠 DeepSeek: deepseek-reasoner, deepseek-v3, deepseek-v3.1, deepseek-r1')
  console.log('  🇨🇳 通义千问: qwen-plus, qwen3-max, qwen3-coder-flash, qwen3-coder-plus')
  console.log('  🔬 高级: o1, o1-preview, o1-mini, resoft-llm')
  console.log('  📖 详细说明: ai_backend/MODEL_EXPANSION.md')
  console.log('='.repeat(60))
})

// 错误处理
app.use((err, req, res, next) => {
  console.error('服务器错误:', err)
  res.status(500).json({
    success: false,
    message: err.message || '服务器内部错误'
  })
})

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('\n正在关闭服务器...')
  process.exit(0)
})

module.exports = app

