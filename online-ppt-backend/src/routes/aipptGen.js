import express from 'express'
import path from 'path'
import multer from 'multer'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mammoth from 'mammoth'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse')
import { nanoid } from 'nanoid'
import aiService from '../services/aiService.js'
import { imageService } from '../services/imageService.js'
import {
  createTask, getTaskStatus, batchUpdateProject,
  saveProject, getProject, listProjects, listThemes,
  readThemeHtml, ensureTailwind,
} from '../services/aipptGenService.js'
import { analyzeSystemPrompt, buildOutlinePrompt, buildAiEditMessages } from '../prompts/aipptGenPrompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '../../data/aippt-uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 20 * 1024 * 1024 } })

// 获取主题列表
router.get('/themes', (req, res) => {
  res.json({ success: true, data: listThemes() })
})

// 获取主题模板HTML
router.get('/themes/:themeId/html', (req, res) => {
  const { themeId } = req.params
  const pageType = req.query.pageType || 'content'
  let html = readThemeHtml(themeId, pageType)
  if (!html) return res.status(404).json({ success: false, message: '模板不存在' })

  // 注入 Tailwind CDN（模板用了 Tailwind 类但没引入 CDN）
  const tailwindCdn = '<script src="https://cdn.tailwindcss.com"><\/script>'
  if (!html.includes('tailwindcss') && html.includes('class=')) {
    html = html.replace('</head>', `${tailwindCdn}\n</head>`)
  }

  res.json({ success: true, data: { html } })
})

// 文件上传 + 解析
router.post('/upload', upload.array('files', 5), async (req, res) => {
  const files = req.files
  if (!files || files.length === 0) return res.status(400).json({ success: false, message: '未上传文件' })

  const fileId = nanoid(10)
  const texts = []

  for (const file of files) {
    try {
      const ext = path.extname(file.originalname).toLowerCase()
      let text = ''

      if (ext === '.docx' || ext === '.doc') {
        const result = await mammoth.extractRawText({ path: file.path })
        text = result.value
      } else if (ext === '.pdf') {
        const buf = fs.readFileSync(file.path)
        const result = await pdfParse(buf)
        text = result.text
      } else if (ext === '.txt' || ext === '.md') {
        text = fs.readFileSync(file.path, 'utf-8')
      } else {
        text = ''
      }

      if (text.trim()) texts.push(`=== ${file.originalname} ===\n${text.trim()}`)
      fs.unlinkSync(file.path)
    } catch (err) {
      console.error(`[aipptGen] parse file error:`, err.message)
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path)
    }
  }

  if (texts.length === 0) return res.status(400).json({ success: false, message: '未能解析出任何文本内容' })

  res.json({ success: true, data: { fileId, text: texts.join('\n\n') } })
})

// 文档分析（SSE流式）
router.post('/analyze', async (req, res) => {
  const { text, topic, options = {}, model = 'ark-doubao-seed-1.6-flash' } = req.body
  if (!text) return res.status(400).json({ success: false, message: '缺少text' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const refModeGuide = {
    strict: '请尽量使用原文表述和原文数据，高度还原',
    adapt: '请在原文基础上提炼重组',
    free: '请自由概括大意即可',
  }
  const refGuide = refModeGuide[options.referenceMode] || refModeGuide.adapt

  const messages = [
    { role: 'system', content: analyzeSystemPrompt },
    { role: 'user', content: `请分析以下文档内容，生成结构化摘要报告。\n\n参考模式：${refGuide}\n\n文档内容：\n${text.slice(0, 30000)}` },
  ]

  let buffer = ''
  try {
    await aiService.chatStream(model, messages, (chunk) => {
      buffer += chunk
      res.write(`data: ${JSON.stringify({ type: 'analyze_chunk', content: chunk })}\n\n`)
    }, { maxTokens: 4096 })

    res.write(`data: ${JSON.stringify({ type: 'analyze_done', summary: buffer })}\n\n`)
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
  }
  res.end()
})

// 生成大纲（SSE流式）
router.post('/outline', async (req, res) => {
  const { topic, model = 'ark-doubao-seed-1.6-flash', summary, options = {} } = req.body
  if (!topic && !summary) return res.status(400).json({ success: false, message: '缺少topic或summary' })

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const outlinePrompt = buildOutlinePrompt(options)

  let userContent = ''
  if (summary) {
    userContent = `以下是文档分析摘要：\n\n${summary}\n\n请基于以上摘要`
    if (topic) userContent += `，PPT主题为「${topic}」，`
    userContent += `生成PPT大纲。`
  } else {
    userContent = `请为以下主题生成PPT大纲：${topic}`
  }

  const messages = [
    { role: 'system', content: outlinePrompt },
    { role: 'user', content: userContent },
  ]

  let buffer = ''
  try {
    await aiService.chatStream(model, messages, (chunk) => {
      buffer += chunk
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
    }, { maxTokens: 4096 })

    try {
      const outline = JSON.parse(buffer)
      res.write(`data: ${JSON.stringify({ type: 'done', outline })}\n\n`)
    } catch {
      res.write(`data: ${JSON.stringify({ type: 'done', raw: buffer })}\n\n`)
    }
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
  }
  res.end()
})

// 创建生成任务
router.post('/task/create', async (req, res) => {
  const { outline, themeId, illustrationMode = 'standard', model = 'ark-doubao-seed-1.6-flash', summary, options = {} } = req.body
  if (!outline || !themeId) return res.status(400).json({ success: false, message: '缺少outline或themeId' })

  try {
    const taskId = await createTask({ outline, themeId, illustrationMode, model, summary, options })
    res.json({ success: true, data: { taskId } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 查询任务状态（轮询）
router.get('/task/:taskId/status', (req, res) => {
  const status = getTaskStatus(req.params.taskId)
  if (!status) return res.status(404).json({ success: false, message: '任务不存在' })
  res.json({ success: true, data: status })
})

// AI编辑单页
router.post('/ai-edit', async (req, res) => {
  const { htmlContent, instruction, model = 'ark-doubao-seed-1.6-flash' } = req.body
  if (!htmlContent || !instruction) return res.status(400).json({ success: false, message: '参数缺失' })

  try {
    const messages = buildAiEditMessages(htmlContent, instruction)
    const result = await aiService.chat(model, messages, { maxTokens: 8192 })
    res.json({ success: true, data: { htmlContent: ensureTailwind(result) } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 保存/更新项目（batch-update）
router.post('/project/:id/batch-update', async (req, res) => {
  const { updatedSlides = [] } = req.body
  try {
    const result = await batchUpdateProject(req.params.id, updatedSlides)
    res.json({ success: true, data: result })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 创建项目
router.post('/project', (req, res) => {
  try {
    // 如果 body 里有 id，则更新已有项目
    if (req.body.id) {
      saveProject(req.body.id, req.body)
      res.json({ success: true, data: { id: req.body.id } })
    } else {
      const id = saveProject(null, req.body)
      res.json({ success: true, data: { id } })
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 获取项目
router.get('/project/:id', (req, res) => {
  const project = getProject(req.params.id)
  if (!project) return res.status(404).json({ success: false, message: '项目不存在' })
  res.json({ success: true, data: project })
})

// 项目列表
router.get('/projects', (req, res) => {
  res.json({ success: true, data: listProjects() })
})

// 图片搜索（供素材面板使用）
router.get('/images/search', async (req, res) => {
  const { keyword = 'business', page = 1 } = req.query
  try {
    const imgs = await imageService.searchImages(keyword, { count: 12, page: Number(page) })
    res.json({ success: true, data: imgs })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// PPTX导出（预留）
router.post('/project/:id/export', (req, res) => {
  res.json({ success: false, message: '导出功能开发中' })
})

export default router
