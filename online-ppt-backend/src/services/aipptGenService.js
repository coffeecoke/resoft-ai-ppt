import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer'
import { nanoid } from 'nanoid'
import aiService from './aiService.js'
import { imageService } from './imageService.js'
import { buildSlideGenMessages } from '../prompts/aipptGenPrompt.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data')
const TEMPLATES_DIR = path.join(DATA_DIR, 'aippt-templates')
const PREVIEWS_DIR = path.join(DATA_DIR, 'aippt-previews')
const PROJECTS_DIR = path.join(DATA_DIR, 'aippt-projects')

// 确保目录存在
for (const dir of [PREVIEWS_DIR, PROJECTS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// 内存中的任务状态 { taskId -> taskState }
const tasks = new Map()

const TASKS_CACHE = path.join(DATA_DIR, 'aippt-tasks-cache.json')

// 启动时从磁盘恢复未完成任务
function loadTasksFromDisk() {
  try {
    if (fs.existsSync(TASKS_CACHE)) {
      const arr = JSON.parse(fs.readFileSync(TASKS_CACHE, 'utf-8'))
      for (const t of arr) {
        tasks.set(t.taskId, t)
      }
      console.log(`[aipptGen] restored ${arr.length} tasks from disk`)
    }
  } catch (err) {
    console.error('[aipptGen] failed to restore tasks:', err.message)
  }
}

function persistTasksToDisk() {
  try {
    const arr = []
    for (const [, t] of tasks) {
      arr.push(t)
    }
    fs.writeFileSync(TASKS_CACHE, JSON.stringify(arr), 'utf-8')
  } catch (err) {
    console.error('[aipptGen] failed to persist tasks:', err.message)
  }
}

loadTasksFromDisk()

// 清理超过1小时的已完成任务（节省内存和磁盘）
function cleanupOldTasks() {
  const ONE_HOUR = 60 * 60 * 1000
  const now = Date.now()
  let removed = 0
  for (const [id, t] of tasks) {
    if (t.status === 'completed' && now - (t.createdAt || 0) > ONE_HOUR) {
      tasks.delete(id)
      removed++
    }
  }
  if (removed > 0) {
    console.log(`[aipptGen] cleaned up ${removed} old completed tasks`)
    persistTasksToDisk()
  }
}
setInterval(cleanupOldTasks, 10 * 60 * 1000)

const PAGE_TYPE_FILE = {
  cover: '封面页.html',
  catalog: '目录页.html',
  chapter: '章节页.html',
  content: '内容页.html',
  end: '结束页.html',
}

const TAILWIND_SCRIPT = '<script src="/libs/tailwind.js"></script>'

export function readThemeHtml(themeId, pageType) {
  const file = path.join(TEMPLATES_DIR, themeId, PAGE_TYPE_FILE[pageType])
  if (!fs.existsSync(file)) return ''
  let html = fs.readFileSync(file, 'utf-8')
  // 替换外部 CDN 为本地路径
  html = html.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, TAILWIND_SCRIPT)
  if (!html.includes('tailwind.js') && !html.includes('tailwindcss') && html.includes('class=')) {
    html = html.replace('</head>', `${TAILWIND_SCRIPT}\n</head>`)
  }
  return html
}

export function ensureTailwind(html) {
  // 已经正确以 <script> 方式引入本地 tailwind.js，跳过
  if (/<script[^>]*tailwind\.js[^>]*>/.test(html)) return html
  // CDN script 版，替换为本地
  if (/<script[^>]*cdn\.tailwindcss\.com/.test(html)) {
    return html.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, TAILWIND_SCRIPT)
  }
  // AI 有时把 tailwind.js 写成 <link rel="stylesheet">，先去掉再重新注入
  html = html.replace(/<link[^>]*tailwind(?:css|\.js)[^>]*\/?>/gi, '')
  html = html.replace(/<script[^>]*tailwindcss[^>]*><\/script>/gi, '')
  // 注入本地脚本
  if (html.includes('</head>')) {
    return html.replace('</head>', `${TAILWIND_SCRIPT}\n</head>`)
  }
  return TAILWIND_SCRIPT + html
}

const FA_CSS = '<link rel="stylesheet" href="/libs/fontawesome.min.css">'
const ANIMATE_CSS = '<link rel="stylesheet" href="/libs/animate.min.css">'

export function sanitizeHtml(raw) {
  let html = raw

  // 1. 去掉 markdown 代码块包裹
  html = html.replace(/^```html?\s*\n?/i, '').replace(/\n?```\s*$/i, '')

  // 2. 提取 <html>...</html> 范围，去掉前后的 AI 说明文字
  const htmlStart = html.search(/<!DOCTYPE\s+html|<html/i)
  if (htmlStart > 0) html = html.slice(htmlStart)
  const htmlEnd = html.lastIndexOf('</html>')
  if (htmlEnd >= 0) html = html.slice(0, htmlEnd + '</html>'.length)

  // 3. 如果没有 <html> 结构（AI 只输出了 body 片段），补全
  if (!/<html/i.test(html)) {
    const hasCanvas = /w-\[1280px\]/.test(html)
    html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">${TAILWIND_SCRIPT}${FA_CSS}${ANIMATE_CSS}</head><body>${html}</body></html>`
    return ensureCanvas(html)
  }

  // 4. 去掉 <head> 和 <body> 之间、</body> 和 </html> 之间的 AI 说明文字
  // 去掉 </body> 之后到 </html> 之间的任何文字
  html = html.replace(/<\/body>([\s\S]*?)<\/html>/i, '</body></html>')
  // 去掉 </head> 之后到 <body> 之间的非标签文字（AI 夹带的说明）
  html = html.replace(/(<\/head>)([\s\S]*?)(<body[^>]*>)/i, (match, head, between, body) => {
    // 保留标签，去掉纯文本
    const cleaned = between.replace(/[^<][^>]*(?=<)/g, '').replace(/\n{3,}/g, '\n')
    return head + cleaned + body
  })

  // 5. 替换所有外部 CDN 为本地路径，并修正 AI 把 tailwind.js 写成 <link> 的错误
  html = html.replace(/<link[^>]*tailwind(?:css|\.js)[^>]*\/?>/gi, TAILWIND_SCRIPT)
  html = html.replace(/<script[^>]*cdn\.tailwindcss\.com[^>]*><\/script>/gi, TAILWIND_SCRIPT)
  html = html.replace(/<link[^>]*cdnjs\.cloudflare\.com\/ajax\/libs\/font-awesome[^>]*\/?>/gi, '')
  html = html.replace(/<link[^>]*cdn\.jsdelivr\.net\/npm\/font-awesome[^>]*\/?>/gi, '')
  html = html.replace(/<link[^>]*use\.fontawesome\.com[^>]*\/?>/gi, '')
  html = html.replace(/<link[^>]*cdnjs\.cloudflare\.com\/ajax\/libs\/animate\.css[^>]*\/?>/gi, '')
  // 课件帮的 CDN 也替换
  html = html.replace(/<link[^>]*chatfiles\.tydiczt\.com\/aippt\/asst\/css\/animate[^>]*\/?>/gi, '')
  html = html.replace(/<link[^>]*chatfiles\.tydiczt\.com\/tdh\/assets\/css\/all\.min\.css[^>]*\/?>/gi, '')
  html = html.replace(/<script[^>]*chatfiles\.tydiczt\.com\/tdh\/assets\/js\/3\.4\.16\.js[^>]*><\/script>/gi, '')
  html = html.replace(/<script[^>]*chatfiles\.tydiczt\.com\/tdh\/assets\/echarts[^>]*><\/script>/gi, '')
  html = html.replace(/<script[^>]*chatfiles\.tydiczt\.com\/aippt\/asst\/js\/mathjax[^>]*><\/script>/gi, '')
  // 去掉 MathJax config
  html = html.replace(/<script>\s*MathJax\s*=\s*\{[\s\S]*?\};?\s*<\/script>/gi, '')

  // 6. 去掉重复的 <style> 块（Tailwind CDN 编译输出会重复）
  const styleBlocks = []
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, (match) => {
    // 检查是否和已有块内容相同（忽略空白差异）
    const normalized = match.replace(/\s+/g, ' ').trim()
    if (styleBlocks.some(s => s === normalized)) return ''
    styleBlocks.push(normalized)
    return match
  })

  // 7. 去掉重复的画布 div（AI 有时输出两遍内容）
  // 如果 body 里有多个 w-[1280px] 的 div，只保留最后一个
  const canvasCount = (html.match(/w-\[1280px\]/g) || []).length
  if (canvasCount > 1) {
    // 找到所有顶层画布 div，只保留最后一个
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
      // 找最后一个 w-[1280px] 的 div 起始位置
      const lastCanvasIdx = bodyContent.lastIndexOf('w-[1280px]')
      if (lastCanvasIdx > 0) {
        // 从 body 内容开头到倒数第二个画布之间的内容都删掉
        // 找到包含 lastCanvasIdx 的那个 <div 的起始
        let divStart = bodyContent.lastIndexOf('<div', lastCanvasIdx)
        if (divStart > 0) {
          const cleanedBody = bodyContent.slice(divStart)
          html = html.replace(/<body[^>]*>[\s\S]*<\/body>/i, `<body>${cleanedBody}</body>`)
        }
      }
    }
  }

  // 8. 确保三个核心依赖
  if (!/fontawesome\.min\.css/.test(html)) {
    html = html.includes('</head>') ? html.replace('</head>', `${FA_CSS}\n</head>`) : FA_CSS + html
  }
  if (!/animate\.min\.css/.test(html)) {
    html = html.includes('</head>') ? html.replace('</head>', `${ANIMATE_CSS}\n</head>`) : ANIMATE_CSS + html
  }
  html = ensureTailwind(html)

  return ensureCanvas(html)
}

// 强制防溢出的 CSS，注入到所有页面
const ANTIOVERFLOW_CSS = `<style>
  html, body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; width: 1280px; height: 720px; }
  .\\\\3\[1280px\\\\3\], [class*="w-[1280px]"] { max-width: 1280px !important; max-height: 720px !important; overflow: hidden !important; }
</style>`

function ensureCanvas(html) {
  // 确保 body 有 overflow:hidden 和无 margin
  if (/<body/i.test(html)) {
    html = html.replace(/<body([^>]*)>/i, (match, attrs) => {
      // 如果已有 style 属性，追加；否则添加
      if (/style=/.test(attrs)) {
        return match.replace(/style="([^"]*)"/, 'style="$1;margin:0;overflow:hidden;"')
      }
      return `<body style="margin:0;overflow:hidden;"${attrs}>`
    })
  }

  // 注入防溢出 CSS（在 </head> 前）
  const antiOverflow = `<style>html,body{margin:0!important;padding:0!important;overflow:hidden!important;max-width:1280px;max-height:720px;}</style>`
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${antiOverflow}\n</head>`)
  }

  // 确保画布容器有 overflow-hidden
  html = html.replace(
    /(class="[^"]*w-\[1280px\][^"]*h-\[720px\][^"]*)"/,
    '$1 overflow-hidden"'
  )
  if (/w-\[1280px\]/.test(html) && !/h-\[720px\]/.test(html)) {
    html = html.replace('w-[1280px]', 'w-[1280px] h-[720px] overflow-hidden')
  }
  // 去掉重复的 overflow-hidden
  html = html.replace(/(overflow-hidden\s*){2,}/g, 'overflow-hidden ')
  return html
}

function buildSlideSequence(outline) {
  // 新格式：flat pages with description
  if (outline.pages && Array.isArray(outline.pages)) {
    // 预先找出每个 content 页所属章节，以及同章节其他 content 页标题
    const pages = outline.pages
    return pages.map((page, index) => {
      const content = { title: page.title }
      if (page.description) content.description = page.description
      if (page.type === 'cover') content.subtitle = outline.subtitle
      if (page.type === 'catalog') content.chapters = pages.filter(p => p.type === 'chapter').map(p => p.title)
      if (page.type === 'end') content.subtitle = outline.title

      // 内容页：找所属章节 + 同章节其他内容页，避免 AI 重复
      if (page.type === 'content') {
        let chapterTitle = ''
        const siblingTitles = []
        // 向前找最近的 chapter 页作为所属章节
        for (let i = index - 1; i >= 0; i--) {
          if (pages[i].type === 'chapter') { chapterTitle = pages[i].title; break }
        }
        // 同章节的其他 content 页（向前到上一个 chapter，向后到下一个 chapter）
        let start = 0
        for (let i = index - 1; i >= 0; i--) {
          if (pages[i].type === 'chapter') { start = i + 1; break }
        }
        let end = pages.length
        for (let i = index + 1; i < pages.length; i++) {
          if (pages[i].type === 'chapter' || pages[i].type === 'end') { end = i; break }
        }
        for (let i = start; i < end; i++) {
          if (i !== index && pages[i].type === 'content') siblingTitles.push(pages[i].title)
        }
        if (chapterTitle) content.chapterTitle = chapterTitle
        if (siblingTitles.length) content.siblingTitles = siblingTitles
      }

      return { index, type: page.type, content }
    })
  }

  // 旧格式兼容（chapters tree）
  const slides = []
  let index = 0
  slides.push({ index: index++, type: 'cover', content: { title: outline.title, subtitle: outline.subtitle } })
  slides.push({ index: index++, type: 'catalog', content: { chapters: outline.chapters.map(c => c.title) } })
  for (const chapter of outline.chapters) {
    slides.push({ index: index++, type: 'chapter', content: { title: chapter.title } })
    for (const slide of chapter.slides) {
      slides.push({ index: index++, type: 'content', content: { title: slide.title } })
    }
  }
  slides.push({ index: index++, type: 'end', content: { title: '感谢聆听', subtitle: outline.title } })
  return slides
}

async function screenshotHtml(htmlContent, taskId, pageIndex) {
  const filename = `req_${taskId}_${pageIndex}.jpg`
  const outputPath = path.join(PREVIEWS_DIR, filename)

  // 移除 HTML 中的 /libs/ 引用（全部通过 Puppeteer API 注入）
  let html = htmlContent
    .replace(/<script[^>]*src=["'][^"']*tailwind[^"']*["'][^>]*><\/script>/gi, '')
    .replace(/<link[^>]*href=["'][^"']*\/libs\/fontawesome[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<link[^>]*href=["'][^"']*\/libs\/animate[^"']*["'][^>]*\/?>/gi, '')

  // 将图片相对路径替换为 localhost 绝对 URL，让 Puppeteer 能向本地后端请求图片
  // 兼容带 /api 前缀（前端代理路径）和不带前缀两种情况
  const PORT = process.env.PORT || 5001
  html = html.replace(/src="((?:\/api)?\/aippt-gen\/user-images\/[^"]+)"/g, (_, webPath) => {
    const cleanPath = webPath.replace(/^\/api/, '')
    return `src="http://localhost:${PORT}${cleanPath}"`
  })

  const tailwindJsPath = path.join(__dirname, '..', '..', 'data', 'aippt-assets', 'tailwind.js')
  const libsDir = path.join(__dirname, '..', '..', '..', 'online-ppt-web', 'public', 'libs')

  let browser
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 720 })
    await page.setContent(html, { waitUntil: 'load', timeout: 15000 })

    // 通过 Puppeteer API 注入本地资源（setContent 无法解析相对路径）
    if (fs.existsSync(tailwindJsPath)) {
      await page.addScriptTag({ path: tailwindJsPath })
    } else {
      await page.addScriptTag({ url: 'https://cdn.tailwindcss.com' })
    }
    const faCss = path.join(libsDir, 'fontawesome.min.css')
    if (fs.existsSync(faCss)) await page.addStyleTag({ path: faCss })
    const animateCss = path.join(libsDir, 'animate.min.css')
    if (fs.existsSync(animateCss)) await page.addStyleTag({ path: animateCss })

    // 等待 Tailwind 处理完 class
    await new Promise(r => setTimeout(r, 2000))

    // 检测画布是否溢出
    const overflowInfo = await page.evaluate(() => {
      const canvas = document.querySelector('[class*="w-[1280px]"]')
      if (!canvas) return { overflow: false }
      return {
        overflow: canvas.scrollHeight > 720 || canvas.scrollWidth > 1280,
        scrollH: canvas.scrollHeight,
        scrollW: canvas.scrollWidth,
        clientH: canvas.clientHeight,
        clientW: canvas.clientWidth,
      }
    })
    if (overflowInfo.overflow) {
      console.warn(`[aipptGen] page ${pageIndex} OVERFLOW: scrollHeight=${overflowInfo.scrollH} > clientHeight=${overflowInfo.clientH}`)
    }

    await page.screenshot({ path: outputPath, type: 'jpeg', quality: 80 })
  } catch (err) {
    console.error(`[aipptGen] screenshot failed page ${pageIndex}:`, err.message)
  } finally {
    if (browser) await browser.close()
  }

  return `/aippt-gen/previews/${filename}`
}

const SEARCH_IMAGES_DIR = path.join(DATA_DIR, 'aippt-user-images', '_search')

async function downloadToLocal(remoteUrl, taskId) {
  const dir = path.join(SEARCH_IMAGES_DIR, taskId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const filename = `${nanoid(12)}.jpg`
  const dest = path.join(dir, filename)
  const resp = await fetch(remoteUrl)
  if (!resp.ok) throw new Error(`download failed: ${resp.status}`)
  fs.writeFileSync(dest, Buffer.from(await resp.arrayBuffer()))
  return `/aippt-gen/user-images/_search/${taskId}/${filename}`
}

// 并发控制：最多同时跑 limit 个异步任务
async function runWithConcurrency(items, limit, fn) {
  const executing = new Set()
  for (const item of items) {
    const p = fn(item).finally(() => executing.delete(p))
    executing.add(p)
    if (executing.size >= limit) await Promise.race(executing)
  }
  await Promise.all(executing)
}

// 单页搜图替换（生成完立刻调用，不再批量）
async function replaceImagesForSlide(slide, taskId) {
  if (!slide.htmlContent || slide.isSkipped) return
  const imgRegex = /<img([^>]*?)alt="([^"]+)"([^>]*?)>/gi
  let html = slide.htmlContent
  let matched = false
  const replacements = []
  let m
  while ((m = imgRegex.exec(html)) !== null) {
    const [fullMatch, before, altText, after] = m
    if (/src=/.test(before) || /src=/.test(after)) continue
    replacements.push({ fullMatch, altText })
  }
  for (const { fullMatch, altText } of replacements) {
    try {
      const imgs = await imageService.searchImages(altText, { count: 1, orientation: 'landscape' })
      if (imgs?.length > 0) {
        const remoteUrl = imgs[0].url || imgs[0].regularUrl
        if (remoteUrl) {
          const localUrl = await downloadToLocal(remoteUrl, taskId)
          html = html.replace(fullMatch, fullMatch.replace(/<img/, `<img src="${localUrl}"`))
          matched = true
        }
      }
    } catch {}
  }
  if (matched) slide.htmlContent = html
}

const SLIDE_CONCURRENCY = parseInt(process.env.SLIDE_CONCURRENCY || '3', 10)

export async function createTask({ outline, themeId, illustrationMode = 'standard', model = 'ark-doubao-seed-1.6-flash', summary, options = {} }) {
  const taskId = nanoid(12)
  const slideSequence = buildSlideSequence(outline)

  const task = {
    taskId,
    themeId,
    illustrationMode,
    model,
    summary,
    options,
    status: 'generating',
    slides: slideSequence.map(s => ({
      index: s.index,
      pageType: s.type,
      htmlContent: null,
      previewUrl: null,
      pptLoading: true,
      isSkipped: false,
      needRegenerate: false,
      scriptContent: '',
    })),
    createdAt: Date.now(),
  }

  tasks.set(taskId, task)
  persistTasksToDisk()

  // 异步生成，不阻塞响应
  generateSlides(taskId, slideSequence, themeId, illustrationMode, model, summary, options).catch(err => {
    console.error(`[aipptGen] task ${taskId} failed:`, err)
    const t = tasks.get(taskId)
    if (t) t.status = 'failed'
  })

  return taskId
}

async function generateAndProcessSlide(taskId, slide, themeHtmlMap, topicContext, summary, options, illustrationMode, model) {
  const task = tasks.get(taskId)
  if (!task) return
  const taskSlide = task.slides[slide.index]
  try {
    const messages = buildSlideGenMessages(
      slide.type, slide.content, themeHtmlMap[slide.type],
      topicContext, summary, options
    )
    const html = await aiService.chat(model, messages, { maxTokens: 8192, temperature: 0.7 })
    const clean = sanitizeHtml(html)
    taskSlide.htmlContent = clean
    taskSlide.needRegenerate = clean.includes('生成错误')
    if (illustrationMode !== 'none') await replaceImagesForSlide(taskSlide, taskId)
    taskSlide.previewUrl = await screenshotHtml(taskSlide.htmlContent, taskId, slide.index)
  } catch (err) {
    console.error(`[aipptGen] slide ${slide.index} gen failed:`, err.message)
    taskSlide.isSkipped = true
  } finally {
    taskSlide.pptLoading = false
    persistTasksToDisk()
  }
}

async function generateSlides(taskId, slideSequence, themeId, illustrationMode, model, summary, options) {
  const task = tasks.get(taskId)
  if (!task) return

  const topicContext = task.options?.topic || ''
  const themeHtmlMap = {}
  for (const type of ['cover', 'catalog', 'chapter', 'content', 'end']) {
    themeHtmlMap[type] = readThemeHtml(themeId, type)
  }

  await runWithConcurrency(
    slideSequence,
    SLIDE_CONCURRENCY,
    slide => generateAndProcessSlide(taskId, slide, themeHtmlMap, topicContext, summary, options, illustrationMode, model)
  )

  task.status = 'completed'
  persistTasksToDisk()

  // 生成完成后，自动保存 slides 到关联的项目文件
  await saveTaskToProject(taskId)
}

// 将已完成的任务 slides 写入关联的项目 JSON
async function saveTaskToProject(taskId) {
  const task = tasks.get(taskId)
  if (!task || task.status !== 'completed') return

  // 找到关联的项目文件（包含该 taskId 的）
  if (!fs.existsSync(PROJECTS_DIR)) return
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'))
  for (const f of files) {
    try {
      const filePath = path.join(PROJECTS_DIR, f)
      const project = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      if (project.taskId === taskId) {
        project.slides = task.slides
        project.updatedAt = new Date().toISOString()
        fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8')
        console.log(`[aipptGen] task ${taskId} saved ${task.slides.length} slides to project ${project.id}`)
        return
      }
    } catch {}
  }
  console.warn(`[aipptGen] no project found for task ${taskId}`)
}

export function getTaskStatus(taskId) {
  const task = tasks.get(taskId)
  if (!task) {
    // 任务不在内存（重启后丢失），尝试从关联项目恢复
    return recoverTaskFromProject(taskId)
  }

  const completed = task.slides.filter(s => !s.pptLoading).length
  return {
    status: task.status,
    progress: { total: task.slides.length, completed },
    slides: task.slides,
  }
}

// 任务丢失后，从项目文件恢复状态
function recoverTaskFromProject(taskId) {
  if (!fs.existsSync(PROJECTS_DIR)) return null
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'))
  for (const f of files) {
    try {
      const project = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'))
      if (project.taskId === taskId) {
        const slides = project.slides || []
        if (slides.length > 0) {
          // 项目有 slides，重建任务到内存
          const task = {
            taskId,
            themeId: project.themeId,
            status: 'completed',
            slides,
            createdAt: project.createdAt,
          }
          tasks.set(taskId, task)
          persistTasksToDisk()
          console.log(`[aipptGen] recovered task ${taskId} from project ${project.id}`)
          return {
            status: 'completed',
            progress: { total: slides.length, completed: slides.length },
            slides,
          }
        }
        // 项目有 taskId 但无 slides — 任务确实丢失了
        return null
      }
    } catch {}
  }
  return null
}

export async function batchUpdateProject(projectId, updatedSlides) {
  const projectFile = path.join(PROJECTS_DIR, `${projectId}.json`)
  if (!fs.existsSync(projectFile)) throw new Error('项目不存在')

  const project = JSON.parse(fs.readFileSync(projectFile, 'utf-8'))
  const updatedPages = []

  for (const { index, htmlContent } of updatedSlides) {
    const slide = project.slides.find(s => s.index === index)
    if (!slide) continue
    slide.htmlContent = htmlContent
    const previewUrl = await screenshotHtml(htmlContent, projectId, index)
    slide.previewUrl = previewUrl
    updatedPages.push({ index, previewUrl })
  }

  project.updatedAt = new Date().toISOString()
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2), 'utf-8')

  return { screenshots_updated: updatedPages.length, updated_pages: updatedPages }
}

export function saveProject(projectId, data) {
  const id = projectId || nanoid(12)
  const projectFile = path.join(PROJECTS_DIR, `${id}.json`)
  const project = { id, ...data, createdAt: data.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
  fs.writeFileSync(projectFile, JSON.stringify(project, null, 2), 'utf-8')
  return id
}

export function getProject(projectId) {
  const projectFile = path.join(PROJECTS_DIR, `${projectId}.json`)
  if (!fs.existsSync(projectFile)) return null
  return JSON.parse(fs.readFileSync(projectFile, 'utf-8'))
}

export function listProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return []
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const p = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8'))
        return { id: p.id, topic: p.topic, themeId: p.themeId, slideCount: p.slides?.length, updatedAt: p.updatedAt }
      } catch { return null }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

export function listThemes() {
  if (!fs.existsSync(TEMPLATES_DIR)) return []
  return fs.readdirSync(TEMPLATES_DIR)
    .filter(name => {
      const dir = path.join(TEMPLATES_DIR, name)
      return fs.statSync(dir).isDirectory() && fs.existsSync(path.join(dir, '内容页.html'))
    })
    .map(name => {
      const parts = name.split('_')
      return { id: name, name: name.replace(/_/g, '·'), category: parts[0] || '其他' }
    })
}
