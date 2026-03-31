import express from 'express'
import prisma from '../../lib/prisma.js'

const router = express.Router()

// 为 5 个筛选项补充 name 字段（表存中文，code 与 name 同值）
function attachFilterNames(row) {
  return {
    ...row,
    industryName: row.industry ?? null,
    meetingTypeName: row.meeting_type ?? null,
    customerTypeName: row.customer_type ?? null,
    audienceName: row.audience ?? null,
    languageName: row.language ?? null
  }
}

// BigInt 无法被 JSON 序列化，转为 Number 再返回
function sanitizeForJson(obj) {
  if (obj == null) return obj
  if (typeof obj === 'bigint') return Number(obj)
  if (Array.isArray(obj)) return obj.map(sanitizeForJson)
  if (typeof obj === 'object') {
    const out = {}
    for (const k of Object.keys(obj)) {
      out[k] = sanitizeForJson(obj[k])
    }
    return out
  }
  return obj
}

/**
 * GET /api/sales/transcriptions
 * 交流会议列表，分页 + 筛选；产品支持 productId / productCode / productName 查询
 *
 * Query: page, pageSize, customerName, productId, productCode, productName,
 *        status, dateFrom, dateTo, industry, meeting_type, customer_type, audience, language
 */
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      customerName,
      productId,
      productCode,
      productName,
      status,
      dateFrom,
      dateTo,
      industry,
      meeting_type,
      customer_type,
      audience,
      language
    } = req.query

    const where = {}

    if (customerName && String(customerName).trim()) {
      where.customer_name = { contains: String(customerName).trim() }
    }

    if (productId && String(productId).trim()) {
      where.product_id = String(productId).trim()
    } else if (productCode || productName) {
      // 同时支持 productCode 和 productName 筛选（OR 条件）
      const productConditions = []
      if (productCode && String(productCode).trim()) {
        productConditions.push({ code: String(productCode).trim() })
      }
      if (productName && String(productName).trim()) {
        productConditions.push({ name: { contains: String(productName).trim() } })
      }
      if (productConditions.length === 1) {
        where.products = productConditions[0]
      } else if (productConditions.length > 1) {
        where.products = { OR: productConditions }
      }
    }

    if (status && String(status).trim()) {
      where.status = String(status).trim()
    }

    if (dateFrom || dateTo) {
      where.created_at = {}
      if (dateFrom) where.created_at.gte = new Date(dateFrom)
      if (dateTo) {
        const d = new Date(dateTo)
        d.setHours(23, 59, 59, 999)
        where.created_at.lte = d
      }
    }

    if (industry && String(industry).trim()) where.industry = String(industry).trim()
    if (meeting_type && String(meeting_type).trim()) where.meeting_type = String(meeting_type).trim()
    if (customer_type && String(customer_type).trim()) where.customer_type = String(customer_type).trim()
    if (audience && String(audience).trim()) where.audience = String(audience).trim()
    if (language && String(language).trim()) where.language = String(language).trim()

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, Math.min(100, parseInt(pageSize, 10)))
    const take = Math.max(1, Math.min(100, parseInt(pageSize, 10)))

    const [list, total] = await Promise.all([
      prisma.transcriptions.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: 'desc' },
        include: {
          products: { select: { id: true, name: true, code: true } }
        }
      }),
      prisma.transcriptions.count({ where })
    ])

    const items = list.map((row) => {
      const { products: product, ...rest } = row
      const item = attachFilterNames({
        ...rest,
        productId: product?.id ?? row.product_id ?? null,
        // 优先使用 transcriptions 表中的冗余字段，其次从关联表获取
        productCode: row.product_code ?? product?.code ?? null,
        productName: row.product_name ?? product?.name ?? null
      })
      return sanitizeForJson(item)
    })

    res.json({ success: true, data: { list: items, total } })
  } catch (error) {
    console.error('查询 transcriptions 列表失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/transcriptions/:id/concerns
 * 交流会议关联的 QA 列表（来自 concerns 表，按 transcription_id 关联）
 */
router.get('/:id/concerns', async (req, res) => {
  try {
    const { id } = req.params
    const list = await prisma.concerns.findMany({
      where: { transcription_id: id },
      include: { concern_categories: { select: { name: true, code: true } } },
      orderBy: { created_at: 'asc' }
    })
    const items = list.map((c) => {
      const createdAt = c.created_at instanceof Date ? c.created_at : new Date(c.created_at)
      const dateStr = Number.isNaN(createdAt.getTime()) ? null : createdAt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
      return {
        id: c.id,
        question: c.question,
        answer: c.answer,
        category: c.concern_categories?.name ?? c.category ?? null,
        time_range: c.time_range1 ?? c.time_range ?? null,
        status: c.status,
        created_at: c.created_at,
        date: dateStr,
        likes: c.likes ?? 0,
        expertApproved: !!c.expert_approved,
        expertAdvice: c.expert_advice ?? null,
        expertReviewer: c.expert_reviewer ?? null,
        question_speaker: c.question_speaker ?? null,
        answer_speaker: c.answer_speaker ?? null
      }
    })
    res.json({ success: true, data: sanitizeForJson(items) })
  } catch (error) {
    console.error('查询 transcriptions 关联 concerns 失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/transcriptions/:id/analysis
 * 获取会议分析结果（从 presales_analysis_results 表）
 */
router.get('/:id/analysis', async (req, res) => {
  try {
    const { id } = req.params

    // 查询分析结果
    const analysisResult = await prisma.presales_analysis_results.findFirst({
      where: { transcription_id: id },
      select: {
        id: true,
        analysis_result: true,
        created_at: true,
        updated_at: true
      },
      orderBy: { created_at: 'desc' }
    })

    if (!analysisResult) {
      return res.json({
        success: true,
        data: null
      })
    }

    // 解析 analysis_result JSON 字段
    let rawMarkdown = null
    try {
      if (analysisResult.analysis_result) {
        const result = JSON.parse(analysisResult.analysis_result)
        rawMarkdown = result.raw_markdown || null
      }
    } catch (e) {
      console.warn('解析 analysis_result 失败:', e)
    }

    res.json({
      success: true,
      data: {
        id: analysisResult.id,
        rawMarkdown,
        createdAt: analysisResult.created_at,
        updatedAt: analysisResult.updated_at
      }
    })
  } catch (error) {
    console.error('查询分析结果失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/transcriptions/:id
 * 交流会议详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const row = await prisma.transcriptions.findUnique({
      where: { id },
      include: {
        products: { select: { id: true, name: true, code: true } },
        dialogue_adjustments: {
          select: { speaker_roles: true },
          take: 1
        }
      }
    })
    if (!row) {
      return res.status(404).json({ success: false, error: '未找到该转录记录' })
    }
    const { products: product, dialogue_adjustments, ...rest } = row

    // 解析 speaker_roles（取第一条调整记录）
    let speakerRoles = null
    if (dialogue_adjustments && dialogue_adjustments.length > 0 && dialogue_adjustments[0].speaker_roles) {
      try {
        speakerRoles = JSON.parse(dialogue_adjustments[0].speaker_roles)
      } catch (e) {
        console.warn('解析 speaker_roles 失败:', e)
      }
    }

    const detail = attachFilterNames({
      ...rest,
      productId: product?.id ?? null,
      productCode: product?.code ?? null,
      productName: product?.name ?? null,
      speakerRoles
    })
    res.json({ success: true, data: sanitizeForJson(detail) })
  } catch (error) {
    console.error('查询 transcriptions 详情失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/transcriptions/:id/audio
 * 音频文件流式播放
 */
router.get('/:id/audio', async (req, res) => {
  try {
    const { id } = req.params
    const row = await prisma.transcriptions.findUnique({
      where: { id },
      select: { audio_file_path: true, audio_format: true }
    })

    if (!row || !row.audio_file_path) {
      return res.status(404).json({ success: false, error: '音频文件不存在' })
    }

    // 获取音频根目录配置（用于替换盘符）
    // 例如：数据库存 E:\跑批音频文件\xxx.MP3，配置 C:\，结果 C:\跑批音频文件\xxx.MP3
    const audioBaseDir = process.env.AUDIO_BASE_DIR

    let fullPath = row.audio_file_path

    // 如果配置了 AUDIO_BASE_DIR，替换原路径中的盘符
    if (audioBaseDir && row.audio_file_path.match(/^[A-Za-z]:\\/)) {
      // 确保 audioBaseDir 以 :\ 结尾
      const normalizedBase = audioBaseDir.match(/^[A-Za-z]:[\\/]?$/)
        ? audioBaseDir.replace(/[\\/]?$/, '\\')  // C: 或 C:\ -> C:\
        : audioBaseDir
      fullPath = row.audio_file_path.replace(/^[A-Za-z]:\\/, normalizedBase)
    }

    console.log('[Audio] 原路径:', row.audio_file_path)
    console.log('[Audio] 配置盘符:', audioBaseDir)
    console.log('[Audio] 最终路径:', fullPath)

    // 检查文件是否存在
    const fs = await import('fs')
    const path = await import('path')

    if (!fs.existsSync(fullPath)) {
      console.error('音频文件不存在:', fullPath)
      return res.status(404).json({ success: false, error: '音频文件不存在', path: fullPath })
    }

    const stat = fs.statSync(fullPath)
    const fileSize = stat.size
    const range = req.headers.range

    // 设置 MIME 类型
    const ext = path.extname(fullPath).toLowerCase()
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.m4a': 'audio/mp4',
      '.ogg': 'audio/ogg',
      '.flac': 'audio/flac'
    }
    const contentType = mimeTypes[ext] || 'audio/mpeg'

    if (range) {
      // 支持 Range 请求（断点续传/拖动进度）
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunkSize = end - start + 1

      const file = fs.createReadStream(fullPath, { start, end })
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType
      })
      file.pipe(res)
    } else {
      // 完整文件
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      })
      fs.createReadStream(fullPath).pipe(res)
    }
  } catch (error) {
    console.error('获取音频文件失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
