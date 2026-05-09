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
  saveProject, getProject, listProjects, deleteProject, listThemes,
  readThemeHtml, ensureTailwind,
} from '../services/aipptGenService.js'
import { analyzeSystemPrompt, buildOutlinePrompt, buildAiEditMessages, buildSlideGenMessages } from '../prompts/aipptGenPrompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '../../data/aippt-uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const upload = multer({ dest: UPLOADS_DIR, limits: { fileSize: 20 * 1024 * 1024 } })

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data')
const USER_IMAGES_DIR = path.join(DATA_DIR, 'aippt-user-images')
const AI_GEN_TEMP_DIR = path.join(USER_IMAGES_DIR, 'ai-gen-temp')
const AI_GEN_DIR = path.join(USER_IMAGES_DIR, 'ai-gen')
for (const dir of [USER_IMAGES_DIR, AI_GEN_TEMP_DIR, AI_GEN_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function cleanupTempImages() {
  const maxAge = 24 * 60 * 60 * 1000
  const now = Date.now()
  try {
    for (const pid of fs.readdirSync(AI_GEN_TEMP_DIR)) {
      const dir = path.join(AI_GEN_TEMP_DIR, pid)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const file of fs.readdirSync(dir)) {
        const fp = path.join(dir, file)
        if (now - fs.statSync(fp).mtimeMs > maxAge) {
          fs.unlinkSync(fp)
          console.log('[ai-gen-temp] 清理过期图片:', fp)
        }
      }
      if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir)
    }
  } catch (err) {
    console.error('[ai-gen-temp] 清理失败:', err.message)
  }
}
cleanupTempImages()
setInterval(cleanupTempImages, 6 * 60 * 60 * 1000)

// 获取主题列表
router.get('/themes', (req, res) => {
  res.json({ success: true, data: listThemes() })
})

// 获取模版封面图
router.get('/themes/:themeId/cover', (req, res) => {
  const coverPath = path.join(DATA_DIR, 'aippt-templates', req.params.themeId, 'cover.jpg')
  if (!fs.existsSync(coverPath)) return res.status(404).end()
  res.sendFile(coverPath)
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

  // 从 outline.title 补充 topic，供生成时注入到 prompt 的【PPT主题】字段
  const enrichedOptions = { ...options, topic: options.topic || outline.title || '' }

  try {
    const taskId = await createTask({ outline, themeId, illustrationMode, model, summary, options: enrichedOptions })
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

// 生成一张图并保存到项目正式目录，返回本地 URL
async function generateImageToProject(altText, projectId) {
  const apiKey = process.env.IMAGE_GEN_API_KEY
  const baseUrl = process.env.IMAGE_GEN_BASE_URL
  if (!apiKey || !baseUrl) return null

  const resp = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: 'cogview-3-flash', prompt: altText, n: 1, size: '1024x1024' }),
  })
  const json = await resp.json()
  if (!resp.ok) return null

  const remoteUrl = json.data?.[0]?.url
  if (!remoteUrl) return null

  const dir = path.join(AI_GEN_DIR, projectId)
  fs.mkdirSync(dir, { recursive: true })
  const filename = `${nanoid(12)}.jpg`
  const imgResp = await fetch(remoteUrl)
  if (!imgResp.ok) return null
  fs.writeFileSync(path.join(dir, filename), Buffer.from(await imgResp.arrayBuffer()))
  return `/aippt-gen/user-images/ai-gen/${projectId}/${filename}`
}

// 扫描 HTML 中无 src 或 placeholder src 的 img 标签，并行 AI 生图填充
async function fillImagesInHtml(html, projectId) {
  const imgRegex = /<img([^>]*?)>/gi
  const tasks = []
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    const full = m[0]
    const attrs = m[1]
    const srcMatch = attrs.match(/src="([^"]*)"/)
    const hasExternalSrc = srcMatch && /^https?:\/\//i.test(srcMatch[1])
    const hasLocalSrc = srcMatch && !hasExternalSrc
    const altMatch = attrs.match(/alt="([^"]+)"/)
    // 无 src 或 src 是外部链接（AI 随手填的占位）才处理，已有本地路径的跳过
    if (altMatch && !hasLocalSrc) {
      tasks.push({ full, altText: altMatch[1] })
    }
  }
  if (tasks.length === 0) return html

  const results = await Promise.all(tasks.map(async ({ full, altText }) => {
    try {
      const localUrl = await generateImageToProject(altText, projectId)
      if (!localUrl) return { full, newTag: null }
      const newTag = full
        .replace(/\s*src="[^"]*"/, '')
        .replace('<img', `<img src="${localUrl}"`)
      return { full, newTag }
    } catch {
      return { full, newTag: null }
    }
  }))

  for (const { full, newTag } of results) {
    if (newTag) html = html.replace(full, newTag)
  }
  return html
}

// AI编辑单页
router.post('/ai-edit', async (req, res) => {
  const { htmlContent, instruction, history = [], pageType = 'content', model = 'ark-doubao-seed-1.6-flash', projectId } = req.body
  if (!htmlContent || !instruction) return res.status(400).json({ success: false, message: '参数缺失' })

  try {
    const messages = buildAiEditMessages(htmlContent, instruction, history, pageType)
    let result = await aiService.chat(model, messages, { maxTokens: 8192 })
    result = ensureTailwind(result)
    if (projectId) result = await fillImagesInHtml(result, projectId)
    res.json({ success: true, data: { htmlContent: result } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 单页重新生成
router.post('/slide/regenerate', async (req, res) => {
  const { pageType, content, themeId, topic, summary, options = {}, model = 'ark-doubao-seed-1.6-flash' } = req.body
  if (!pageType || !themeId) return res.status(400).json({ success: false, message: '缺少 pageType 或 themeId' })

  try {
    const themeHtml = readThemeHtml(themeId, pageType)
    if (!themeHtml) return res.status(404).json({ success: false, message: '主题模板不存在' })

    const messages = buildSlideGenMessages(pageType, content || {}, ensureTailwind(themeHtml), topic || '', summary || '', options)
    const html = await aiService.chat(model, messages, { maxTokens: 8192, temperature: 0.7 })
    res.json({ success: true, data: { htmlContent: ensureTailwind(html) } })
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

// 拖动排序：只保存新顺序，不触发截图
router.post('/project/:id/reorder', (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: 'order 必须为数组' })
  try {
    const project = getProject(req.params.id)
    if (!project) return res.status(404).json({ success: false, message: '项目不存在' })
    // 优先用 slideId，旧数据没有 slideId 时 fallback 到 index
    const hasSlideId = (project.slides || []).some(s => s.slideId)
    const slideMap = hasSlideId
      ? new Map((project.slides || []).map(s => [s.slideId, s]))
      : new Map((project.slides || []).map(s => [String(s.index), s]))
    project.slides = order.map(id => slideMap.get(id)).filter(Boolean)
    project.updatedAt = new Date().toISOString()
    saveProject(req.params.id, project)
    res.json({ success: true })
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
      const data = {
        ...req.body,
        creatorId: req.user?.userId || null,
        creatorName: req.user?.name || req.user?.username || null,
      }
      const id = saveProject(null, data)
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
  // 旧数据可能存了错误的 <link tailwind.js>，读取时统一修正，不改磁盘
  if (project.slides) {
    project.slides = project.slides.map(s => ({
      ...s,
      htmlContent: s.htmlContent ? ensureTailwind(s.htmlContent) : s.htmlContent,
    }))
  }
  res.json({ success: true, data: project })
})

// 项目列表
router.get('/projects', (req, res) => {
  res.json({ success: true, data: listProjects() })
})

// 删除项目
router.delete('/project/:id', (req, res) => {
  try {
    deleteProject(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
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

// 查询图像生成服务支持的模型列表
router.get('/image/models', async (req, res) => {
  const apiKey = process.env.IMAGE_GEN_API_KEY
  const baseUrl = process.env.IMAGE_GEN_BASE_URL
  try {
    const resp = await fetch(`${baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const json = await resp.json()
    res.json({ success: true, data: json })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 智能生图（生成后下载到临时目录）
router.post('/image/generate', async (req, res) => {
  const { prompt, projectId, model = 'cogview-3-flash', size = '1024x1024', n = 1 } = req.body
  if (!prompt) return res.status(400).json({ success: false, message: '缺少 prompt' })
  if (!projectId) return res.status(400).json({ success: false, message: '缺少 projectId' })

  const apiKey = process.env.IMAGE_GEN_API_KEY
  const baseUrl = process.env.IMAGE_GEN_BASE_URL
  if (!apiKey || !baseUrl) return res.status(500).json({ success: false, message: '图像生成服务未配置' })

  try {
    const resp = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt, n, size }),
    })
    const json = await resp.json()
    if (!resp.ok) return res.status(500).json({ success: false, message: json.error?.message || json.msg || '生图失败' })

    const remoteUrls = (json.data || []).map(item => item.url).filter(Boolean)
    const tempDir = path.join(AI_GEN_TEMP_DIR, projectId)
    fs.mkdirSync(tempDir, { recursive: true })

    const localUrls = await Promise.all(remoteUrls.map(async (remoteUrl) => {
      const filename = `${nanoid(12)}.jpg`
      const imgResp = await fetch(remoteUrl)
      const buffer = Buffer.from(await imgResp.arrayBuffer())
      fs.writeFileSync(path.join(tempDir, filename), buffer)
      return `/aippt-gen/user-images/ai-gen-temp/${projectId}/${filename}`
    }))

    res.json({ success: true, data: { urls: localUrls } })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// 使用 AI 生成图片：从临时目录移到正式目录
router.post('/image/use', (req, res) => {
  const { url, projectId } = req.body
  if (!url || !projectId) return res.status(400).json({ success: false, message: '参数缺失' })

  const filename = path.basename(url)
  const tempPath = path.join(AI_GEN_TEMP_DIR, projectId, filename)
  const destDir = path.join(AI_GEN_DIR, projectId)
  fs.mkdirSync(destDir, { recursive: true })
  const destPath = path.join(destDir, filename)

  if (fs.existsSync(tempPath)) {
    try { fs.renameSync(tempPath, destPath) } catch {
      fs.copyFileSync(tempPath, destPath)
      fs.unlinkSync(tempPath)
    }
    return res.json({ success: true, data: { url: `/aippt-gen/user-images/ai-gen/${projectId}/${filename}` } })
  }
  res.json({ success: true, data: { url } })
})

// 用户素材图片上传
router.post('/project/:projectId/images', (req, res) => {
  console.log('[upload-images] ===== 收到请求 =====')
  console.log('[upload-images] content-type:', req.headers['content-type'])
  console.log('[upload-images] content-length:', req.headers['content-length'])
  console.log('[upload-images] projectId:', req.params.projectId)

  upload.any()(req, res, (err) => {
    if (err) {
      console.error('[upload-images] multer error:', err)
      return res.status(500).json({ success: false, message: err.message })
    }
    console.log('[upload-images] req.files:', JSON.stringify(req.files?.map(f => ({ field: f.fieldname, name: f.originalname, size: f.size }))))
    if (!req.files?.length) return res.status(400).json({ success: false, message: '未上传图片' })
    const { projectId } = req.params
    const dir = path.join(USER_IMAGES_DIR, projectId)
    fs.mkdirSync(dir, { recursive: true })
    const urls = []
    for (const file of req.files) {
      const ext = path.extname(file.originalname) || '.jpg'
      const filename = `${nanoid(12)}${ext}`
      const dest = path.join(dir, filename)
      try {
        fs.renameSync(file.path, dest)
      } catch {
        fs.copyFileSync(file.path, dest)
        fs.unlinkSync(file.path)
      }
      urls.push(`/aippt-gen/user-images/${projectId}/${filename}`)
    }
    res.json({ success: true, data: { urls } })
  })
})

// 获取项目已上传的素材图片列表
router.get('/project/:projectId/images', (req, res) => {
  const dir = path.join(USER_IMAGES_DIR, req.params.projectId)
  if (!fs.existsSync(dir)) return res.json({ success: true, data: { urls: [] } })
  const files = fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp|gif)$/i.test(f))
  const urls = files.map(f => `/aippt-gen/user-images/${req.params.projectId}/${f}`)
  res.json({ success: true, data: { urls } })
})

// PPTX导出（预留）
router.post('/project/:id/export', (req, res) => {
  res.json({ success: false, message: '导出功能开发中' })
})

export default router
