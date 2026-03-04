import express from 'express'
import * as prismaClient from '@prisma/client'

const router = express.Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

/**
 * GET /api/sales/concern-categories
 * 获取问题分类目录（树形结构）
 *
 * Query参数:
 * - type: 类型过滤 level | category | intent（可选）
 * - includeInactive: 是否包含未启用的分类，默认 false
 */
router.get('/', async (req, res) => {
  try {
    const { type, includeInactive = 'false' } = req.query

    const where = {}

    // 类型过滤
    if (type && String(type).trim()) {
      where.type = String(type).trim()
    }

    // 默认只返回启用的分类
    if (includeInactive !== 'true') {
      where.is_active = true
    }

    // 查询所有分类
    const categories = await prisma.concern_categories.findMany({
      where,
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parent_code: true,
        level: true,
        description: true,
        keywords: true,
        sort_order: true,
        is_active: true
      }
    })

    // 构建树形结构
    const tree = buildCategoryTree(categories)

    res.json({
      success: true,
      data: tree
    })
  } catch (error) {
    console.error('查询分类目录失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/concern-categories/flat
 * 获取问题分类目录（扁平列表）
 */
router.get('/flat', async (req, res) => {
  try {
    const { type, includeInactive = 'false' } = req.query

    const where = {}

    if (type && String(type).trim()) {
      where.type = String(type).trim()
    }

    if (includeInactive !== 'true') {
      where.is_active = true
    }

    const categories = await prisma.concern_categories.findMany({
      where,
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ],
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parent_code: true,
        level: true,
        description: true,
        sort_order: true,
        is_active: true
      }
    })

    res.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('查询分类目录失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 构建树形结构
 * @param {Array} categories - 扁平的分类列表
 * @returns {Array} - 树形结构
 */
function buildCategoryTree(categories) {
  // 按 level 分组
  const level1 = categories.filter(c => c.level === 1)
  const level2 = categories.filter(c => c.level === 2)
  const level3 = categories.filter(c => c.level === 3)

  // 构建 level2 -> level3 的映射
  const level2WithChildren = level2.map(cat => ({
    ...cat,
    children: level3.filter(c => c.parent_code === cat.code)
  }))

  // 构建 level1 -> level2 的映射
  const tree = level1.map(cat => ({
    ...cat,
    children: level2WithChildren.filter(c => c.parent_code === cat.code)
  }))

  return tree
}

/**
 * GET /api/sales/concern-categories/:code
 * 获取单个分类详情
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params

    const category = await prisma.concern_categories.findUnique({
      where: { code },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        parent_code: true,
        level: true,
        description: true,
        keywords: true,
        sort_order: true,
        is_active: true
      }
    })

    if (!category) {
      return res.status(404).json({ success: false, error: '分类不存在' })
    }

    res.json({ success: true, data: category })
  } catch (error) {
    console.error('查询分类详情失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
