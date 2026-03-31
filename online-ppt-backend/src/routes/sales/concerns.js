import express from 'express'
import prisma from '../../lib/prisma.js'

const router = express.Router()

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

// 解析数组参数（支持 "a,b,c" 或 ["a","b","c"] 格式）
function parseArrayParam(param) {
  if (!param) return []
  if (Array.isArray(param)) return param.filter(Boolean)
  if (typeof param === 'string') {
    return param.split(',').map(s => s.trim()).filter(Boolean)
  }
  return []
}

/**
 * GET /api/sales/concerns
 * 客户问题列表，支持 cursor 分页 + 多维度筛选
 *
 * Query参数:
 * - cursor: 上一页最后一条的ID（用于无限滚动）
 * - limit: 每页条数，默认20
 * - industry: 行业领域（多选，逗号分隔）
 * - productCode: 产品代码（多选，逗号分隔）
 * - categoryCode: 分类代码（多选，逗号分隔，左侧目录）
 * - intentCode: 问题本质I1-I5（多选，逗号分隔）
 * - sortBy: 排序方式 latest | likes | usage
 * - keyword: 搜索关键词
 */
router.get('/', async (req, res) => {
  try {
    const {
      cursor,
      limit = 20,
      industry,
      productCode,
      categoryCode,
      intentCode,
      sortBy = 'latest',
      keyword
    } = req.query

    const take = Math.max(1, Math.min(100, parseInt(limit, 10) || 20))

    // 构建 WHERE 条件
    const where = {}

    // 1. 分类目录筛选（同维度OR）- concerns.category_code
    const categoryCodes = parseArrayParam(categoryCode)
    if (categoryCodes.length > 0) {
      where.category_code = { in: categoryCodes }
    }

    // 2. 问题本质筛选（同维度OR）- concerns.intent_code
    const intentCodes = parseArrayParam(intentCode)
    if (intentCodes.length > 0) {
      where.intent_code = { in: intentCodes }
    }

    // 3. 关键词搜索
    if (keyword && String(keyword).trim()) {
      where.question = { contains: String(keyword).trim() }
    }

    // 4. cursor 分页（使用 Prisma cursor + skip，与 orderBy 一致，避免 id 与排序不一致导致只加载几页）
    const cursorId = cursor && String(cursor).trim() ? String(cursor).trim() : null

    // 5. 行业和产品筛选需要通过 transcription_id 关联查询
    const industries = parseArrayParam(industry)
    const productCodes = parseArrayParam(productCode)

    // 如果有行业或产品筛选，先查询符合条件的 transcription_id
    if (industries.length > 0 || productCodes.length > 0) {
      const transWhere = {}
      if (industries.length > 0) {
        transWhere.industry = { in: industries }
      }
      if (productCodes.length > 0) {
        transWhere.products = {
          OR: [
            { code: { in: productCodes } },
            { name: { in: productCodes } }
          ]
        }
      }

      const transcriptions = await prisma.transcriptions.findMany({
        where: transWhere,
        select: { id: true }
      })

      const transIds = transcriptions.map(t => t.id)
      if (transIds.length === 0) {
        // 没有符合条件的 transcription，返回空列表
        return res.json({
          success: true,
          data: { list: [], nextCursor: null, hasMore: false }
        })
      }
      where.transcription_id = { in: transIds }
    }

    // 排序方式
    let orderBy = { created_at: 'desc' }
    if (sortBy === 'likes') {
      orderBy = [{ likes: 'desc' }, { created_at: 'desc' }]
    } else if (sortBy === 'usage') {
      // usage 暂时用 likes 代替，后续可扩展
      orderBy = [{ likes: 'desc' }, { created_at: 'desc' }]
    }

    // 查询数据（只包含 concern_categories 关联）；使用 cursor + skip 实现与 orderBy 一致的分页
    const list = await prisma.concerns.findMany({
      where,
      take: take + 1, // 多取一条判断是否有更多
      skip: cursorId ? 1 : 0, // 有 cursor 时跳过 cursor 所在行
      cursor: cursorId ? { id: cursorId } : undefined,
      orderBy,
      include: {
        concern_categories: {
          select: { id: true, code: true, name: true, type: true, level: true }
        }
      }
    })

    // 判断是否有更多数据
    const hasMore = list.length > take
    const items = hasMore ? list.slice(0, take) : list

    // 收集所有需要查询的 transcription_id
    const transIds = [...new Set(items.map(c => c.transcription_id).filter(Boolean))]

    // 批量查询 transcription 信息
    let transMap = {}
    if (transIds.length > 0) {
      const trans = await prisma.transcriptions.findMany({
        where: { id: { in: transIds } },
        select: {
          id: true,
          name: true,
          customer_name: true,
          industry: true,
          product_id: true,
          products: {
            select: { id: true, code: true, name: true }
          }
        }
      })
      transMap = Object.fromEntries(trans.map(t => [t.id, t]))
    }

    // 格式化返回数据
    const formattedItems = items.map((c) => {
      const createdAt = c.created_at instanceof Date ? c.created_at : new Date(c.created_at)
      const dateStr = Number.isNaN(createdAt.getTime())
        ? null
        : createdAt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

      const trans = transMap[c.transcription_id] || null

      return {
        id: c.id,
        question: c.question,
        answer: c.answer,
        category: c.concern_categories?.name ?? c.category ?? null,
        categoryCode: c.category_code,
        intentCode: c.intent_code,
        timeRange: c.time_range1 ?? c.time_range ?? null,
        status: c.status,
        createdAt: c.created_at,
        date: dateStr,
        likes: c.likes ?? 0,
        expertApproved: !!c.expert_approved,
        expertAdvice: c.expert_advice ?? null,
        expertReviewer: c.expert_reviewer ?? null,
        // 关联信息（从 transcription 获取）
        transcriptionId: c.transcription_id,
        customerName: trans?.customer_name ?? null,
        industry: trans?.industry ?? null,
        productCode: trans?.products?.code ?? null,
        productName: trans?.products?.name ?? null,
        meetingName: trans?.name ?? null
      }
    })

    // 获取下一页的 cursor
    const nextCursor = hasMore && formattedItems.length > 0
      ? formattedItems[formattedItems.length - 1].id
      : null

    res.json({
      success: true,
      data: {
        list: sanitizeForJson(formattedItems),
        nextCursor,
        hasMore
      }
    })
  } catch (error) {
    console.error('查询 concerns 列表失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/concerns/hot
 * 热搜榜 Top10，多维度综合排序
 */
router.get('/hot', async (req, res) => {
  try {
    // 热度计算：likes * 1.0 + 时间衰减因子
    // 简化版本：按 likes DESC, created_at DESC 排序
    const list = await prisma.concerns.findMany({
      take: 10,
      orderBy: [
        { likes: 'desc' },
        { created_at: 'desc' }
      ],
      include: {
        concern_categories: {
          select: { id: true, code: true, name: true }
        }
      }
    })

    // 收集所有需要查询的 transcription_id
    const transIds = [...new Set(list.map(c => c.transcription_id).filter(Boolean))]

    // 批量查询 transcription 信息
    let transMap = {}
    if (transIds.length > 0) {
      const trans = await prisma.transcriptions.findMany({
        where: { id: { in: transIds } },
        select: {
          id: true,
          customer_name: true,
          industry: true,
          products: {
            select: { id: true, code: true, name: true }
          }
        }
      })
      transMap = Object.fromEntries(trans.map(t => [t.id, t]))
    }

    const items = list.map((c, index) => {
      const trans = transMap[c.transcription_id] || null
      return {
        id: c.id,
        rank: index + 1,
        question: c.question,
        category: c.concern_categories?.name ?? c.category ?? null,
        likes: c.likes ?? 0,
        customerName: trans?.customer_name ?? null,
        industry: trans?.industry ?? null,
        productName: trans?.products?.name ?? null
      }
    })

    res.json({ success: true, data: sanitizeForJson(items) })
  } catch (error) {
    console.error('查询热搜榜失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * POST /api/sales/concerns/:id/like
 * 点赞（无需登录，直接 +1）
 */
router.post('/:id/like', async (req, res) => {
  try {
    const { id } = req.params

    // 检查问题是否存在
    const concern = await prisma.concerns.findUnique({
      where: { id }
    })

    if (!concern) {
      return res.status(404).json({ success: false, error: '问题不存在' })
    }

    // 点赞 +1
    const updated = await prisma.concerns.update({
      where: { id },
      data: {
        likes: (concern.likes ?? 0) + 1
      }
    })

    res.json({
      success: true,
      data: {
        id: updated.id,
        likes: updated.likes
      }
    })
  } catch (error) {
    console.error('点赞失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/concerns/:id
 * 获取单个问题详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const concern = await prisma.concerns.findUnique({
      where: { id },
      include: {
        concern_categories: {
          select: { id: true, code: true, name: true, type: true, level: true }
        }
      }
    })

    if (!concern) {
      return res.status(404).json({ success: false, error: '问题不存在' })
    }

    // 查询关联的 transcription 信息
    let trans = null
    if (concern.transcription_id) {
      trans = await prisma.transcriptions.findUnique({
        where: { id: concern.transcription_id },
        select: {
          id: true,
          name: true,
          customer_name: true,
          industry: true,
          product_id: true,
          products: {
            select: { id: true, code: true, name: true }
          }
        }
      })
    }

    const createdAt = concern.created_at instanceof Date ? concern.created_at : new Date(concern.created_at)
    const dateStr = Number.isNaN(createdAt.getTime())
      ? null
      : createdAt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })

    const detail = {
      id: concern.id,
      question: concern.question,
      answer: concern.answer,
      category: concern.concern_categories?.name ?? concern.category ?? null,
      categoryCode: concern.category_code,
      intentCode: concern.intent_code,
      timeRange: concern.time_range1 ?? concern.time_range ?? null,
      status: concern.status,
      createdAt: concern.created_at,
      date: dateStr,
      likes: concern.likes ?? 0,
      expertApproved: !!concern.expert_approved,
      expertAdvice: concern.expert_advice ?? null,
      expertReviewer: concern.expert_reviewer ?? null,
      transcriptionId: concern.transcription_id,
      customerName: trans?.customer_name ?? null,
      industry: trans?.industry ?? null,
      productCode: trans?.products?.code ?? null,
      productName: trans?.products?.name ?? null,
      meetingName: trans?.name ?? null
    }

    res.json({ success: true, data: sanitizeForJson(detail) })
  } catch (error) {
    console.error('查询问题详情失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
