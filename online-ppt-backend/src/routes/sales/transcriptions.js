import express from 'express'
import { PrismaClient } from '@prisma/client'

const router = express.Router()
const prisma = new PrismaClient()

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
        productId: product?.id ?? null,
        productCode: product?.code ?? null,
        productName: product?.name ?? null
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
        expertReviewer: c.expert_reviewer ?? null
      }
    })
    res.json({ success: true, data: sanitizeForJson(items) })
  } catch (error) {
    console.error('查询 transcriptions 关联 concerns 失败:', error)
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
        products: { select: { id: true, name: true, code: true } }
      }
    })
    if (!row) {
      return res.status(404).json({ success: false, error: '未找到该转录记录' })
    }
    const { products: product, ...rest } = row
    const detail = attachFilterNames({
      ...rest,
      productId: product?.id ?? null,
      productCode: product?.code ?? null,
      productName: product?.name ?? null
    })
    res.json({ success: true, data: sanitizeForJson(detail) })
  } catch (error) {
    console.error('查询 transcriptions 详情失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
