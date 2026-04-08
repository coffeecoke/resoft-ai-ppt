import express from 'express'
import prisma from '../../lib/prisma.js'

const router = express.Router()

/**
 * GET /api/sales/filter-options
 * 聚合返回所有销售平台筛选选项
 * 设计为可扩展：新增独立选项表时在此追加 key
 */
router.get('/', async (req, res) => {
  try {
    const [customerTypes] = await Promise.all([
      prisma.customer_types.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { id: true, code: true, name: true, p_id: true }
      }),
    ])

    res.json({
      success: true,
      data: {
        customer_types: customerTypes,
      }
    })
  } catch (err) {
    console.error('[销售选项] 获取失败:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
