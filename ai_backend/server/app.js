/**
 * 文档文本提取器 - Web 服务器
 * Express + 文件上传 + 静态服务
 */

// 加载环境变量
require('dotenv').config()

// BigInt 序列化支持（Prisma 的 BigInt 字段无法被 JSON.stringify 直接处理）
BigInt.prototype.toJSON = function () { return Number(this) }

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const { DocumentTextExtractor } = require('../core/extractors/DocumentTextExtractor')
const documentRoutes = require('./routes/documentRoutes')
const pptAnalysisRoutes = require('./routes/pptAnalysisRoutes')
const transcriptionRoutes = require('./routes/transcriptionRoutes')
const productsRoutes = require('./routes/productsRoutes')
const sessionsRoutes = require('./routes/sessionsRoutes')
const autoProcessRoutes = require('./routes/autoProcessRoutes')
const qaManagementRoutes = require('./routes/qaManagementRoutes')
const presalesAnalysisRoutes = require('./routes/presalesAnalysisRoutes')
const intelligentScraperRoutes = require('./routes/intelligentScraperRoutes')
const tenderAnalysisRoutes = require('./routes/tenderAnalysisRoutes')
const bidAnalysisRoutes = require('./routes/bidAnalysisRoutes')
const bidCompositionRoutes = require('./routes/bidCompositionRoutes')

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
// 增加 JSON 和 URL 编码的请求体大小限制（默认 100KB，增加到 50MB 以支持大量对话内容）
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// 静态文件服务
app.use(express.static(path.join(__dirname, '../frontend')))
app.use('/output', express.static(path.join(__dirname, '../output')))
app.use('/scraper_output', express.static(path.join(__dirname, '../scraper_output')))
app.use('/lib/jszip', express.static(path.join(__dirname, '../node_modules/jszip/dist')))
app.use('/lib/docx-preview', express.static(path.join(__dirname, '../node_modules/docx-preview/dist')))

// ==================== AI管理后台路由（新架构） ====================
const adminRoutes = require('./routes')
app.use('/api', adminRoutes)

// ==================== 原有功能路由 ====================
// 路由：AI后台文档管理（新增）
app.use('/api/documents', documentRoutes)

// 路由：PPT内容分析（新增）
app.use('/api/ppt-analysis', pptAnalysisRoutes)

// 路由：语音转录（新增）
app.use('/api/transcription', transcriptionRoutes)

// 路由：产品管理（新增）
app.use('/api/products', productsRoutes)

// 路由：交流场次管理（新增）
app.use('/api/sessions', sessionsRoutes)

// 路由：自动跑批处理（新增）
app.use('/api/auto-process', autoProcessRoutes)

// 路由：问答对管理（新增）
app.use('/api/qa', qaManagementRoutes)

// 路由：售前交流综合分析（新增）
app.use('/api/presales-analysis', presalesAnalysisRoutes)

// 路由：智能信息爬取（采招网）（新增）
app.use('/api/scraper', intelligentScraperRoutes)

// 路由：招标文件分析（新增）
app.use('/api/tender-analysis', tenderAnalysisRoutes)

// 路由：投标文件分析（新增）
app.use('/api/bid-analysis', bidAnalysisRoutes)

// 路由：投标文件组合（新增）
app.use('/api/bid-composition', bidCompositionRoutes)

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
  console.log('')
  console.log('  [AI管理后台 - 统一管理平台 🆕]')
  console.log('  ┌─ 模型配置管理')
  console.log('  │  ├─ 模型列表:     GET    /api/admin/models')
  console.log('  │  ├─ 场景模型:     GET    /api/admin/models/scenes/:sceneType')
  console.log('  │  ├─ 默认模型:     GET    /api/admin/models/default/:sceneType')
  console.log('  │  ├─ 创建模型:     POST   /api/admin/models')
  console.log('  │  ├─ 更新模型:     PUT    /api/admin/models/:id')
  console.log('  │  ├─ 设为默认:     PUT    /api/admin/models/:id/set-default')
  console.log('  │  ├─ 删除模型:     DELETE /api/admin/models/:id')
  console.log('  │  └─ 场景统计:     GET    /api/admin/models/stats/scenes')
  console.log('  │')
  console.log('  ┌─ 提示词管理')
  console.log('  │  ├─ 提示词列表:   GET    /api/admin/prompts')
  console.log('  │  ├─ 场景提示词:   GET    /api/admin/prompts/scenes/:sceneType')
  console.log('  │  ├─ 创建提示词:   POST   /api/admin/prompts')
  console.log('  │  ├─ 更新提示词:   PUT    /api/admin/prompts/:id')
  console.log('  │  ├─ 删除提示词:   DELETE /api/admin/prompts/:id')
  console.log('  │  ├─ 复制模板:     POST   /api/admin/prompts/:id/duplicate')
  console.log('  │  ├─ 测试渲染:     POST   /api/admin/prompts/test/render')
  console.log('  │  ├─ 提取变量:     POST   /api/admin/prompts/test/extract')
  console.log('  │  └─ 场景统计:     GET    /api/admin/prompts/stats/scenes')
  console.log('  │')
  console.log('  └─ 系统设置')
  console.log('     ├─ 场景列表:     GET    /api/admin/system/scenes')
  console.log('     ├─ 提供商列表:   GET    /api/admin/system/providers')
  console.log('     ├─ 系统统计:     GET    /api/admin/system/stats')
  console.log('     └─ 健康检查:     GET    /api/admin/system/health')
  console.log('')
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
  console.log('  [语音转录 - 新增]')
  console.log('  - 上传转录: POST   /api/transcription/upload')
  console.log('  - 转录列表: GET    /api/transcription')
  console.log('  - 转录详情: GET    /api/transcription/:id')
  console.log('  - 更新转录: PUT    /api/transcription/:id')
  console.log('  - 删除转录: DELETE /api/transcription/:id')
  console.log('')
  console.log('  [产品管理 - 新增]')
  console.log('  - 产品列表: GET    /api/products')
  console.log('  - 产品详情: GET    /api/products/:id')
  console.log('  - 创建产品: POST   /api/products')
  console.log('  - 更新产品: PUT    /api/products/:id')
  console.log('  - 删除产品: DELETE /api/products/:id')
  console.log('  - 产品统计: GET    /api/products/statistics')
  console.log('')
  console.log('  [交流场次管理 - 新增]')
  console.log('  - 场次列表: GET    /api/sessions')
  console.log('  - 场次详情: GET    /api/sessions/:id')
  console.log('  - 创建场次: POST   /api/sessions')
  console.log('  - 更新场次: PUT    /api/sessions/:id')
  console.log('  - 删除场次: DELETE /api/sessions/:id')
  console.log('  - 场次统计: GET    /api/sessions/statistics')
  console.log('  - 最近场次: GET    /api/sessions/recent')
  console.log('')
  console.log('  [自动跑批处理 - 新增 🆕]')
  console.log('  - 获取状态: GET    /api/auto-process/status')
  console.log('  - 启动跑批: POST   /api/auto-process/start')
  console.log('  - 停止跑批: POST   /api/auto-process/stop')
  console.log('  - 获取配置: GET    /api/auto-process/config')
  console.log('  - 更新配置: PUT    /api/auto-process/config')
  console.log('  - 统计信息: GET    /api/auto-process/statistics')
  console.log('  - 处理日志: GET    /api/auto-process/logs')
  console.log('  - 清空日志: DELETE /api/auto-process/logs')
  console.log('  - 立即执行: POST   /api/auto-process/run-once')
  console.log('')
  console.log('  [售前交流综合分析 - 新增 🆕]')
  console.log('  - 分析对话: POST   /api/presales-analysis/analyze')
  console.log('  - 分析转录: POST   /api/presales-analysis/analyze/transcription/:id')
  console.log('  - 分析会话: POST   /api/presales-analysis/analyze/session/:id')
  console.log('  - 流式分析: POST   /api/presales-analysis/analyze/stream')
  console.log('  - 测试路由: GET    /api/presales-analysis/test')
  console.log('')
  console.log('  [招标文件分析 - 新增 🆕]')
  console.log('  - 上传文件: POST   /api/tender-analysis/upload')
  console.log('  - 触发分析: POST   /api/tender-analysis/analyze/:tenderId')
  console.log('  - 文件列表: GET    /api/tender-analysis/list')
  console.log('  - 投标目录: GET    /api/tender-analysis/:tenderId/directory')
  console.log('  - 导出Word: GET    /api/tender-analysis/:tenderId/export-docx')
  console.log('')
  console.log('  [投标文件分析 - 新增 🆕]')
  console.log('  - 上传文件: POST   /api/bid-analysis/upload')
  console.log('  - 触发拆分: POST   /api/bid-analysis/analyze/:bidDocId')
  console.log('  - 搜索章节: GET    /api/bid-analysis/sections/search')
  console.log('')
  console.log('  [投标文件组合 - 新增 🆕]')
  console.log('  - 创建组合: POST   /api/bid-composition')
  console.log('  - 组合详情: GET    /api/bid-composition/:id')
  console.log('  - 导入目录: POST   /api/bid-composition/:id/import-directory/:tenderId')
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

