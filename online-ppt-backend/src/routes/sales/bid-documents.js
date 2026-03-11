/**
 * 投标/响应文件路由（销售前端）
 *
 * API 路径前缀：/api/sales/bid-documents
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import * as prismaClient from '@prisma/client'

const router = Router()
const { PrismaClient } = prismaClient
const prisma = new PrismaClient()

const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR || ''

function resolveFilePath(relativePath) {
  if (!relativePath) return relativePath
  if (path.isAbsolute(relativePath)) return relativePath
  return UPLOAD_BASE_DIR ? path.join(UPLOAD_BASE_DIR, relativePath) : relativePath
}

/**
 * GET /api/sales/bid-documents
 * 销售端响应文件列表（已完成扫描的文件）
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 50, name, industry } = req.query
    const skip = (parseInt(page) - 1) * parseInt(pageSize)

    const where = {}
    if (industry) where.industry = industry
    if (name) where.name = { contains: name }

    const [list, total] = await Promise.all([
      prisma.bid_documents.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(pageSize),
        select: {
          id: true,
          name: true,
          file_type: true,
          file_size: true,
          source_info: true,
          industry: true,
          project_type: true,
          section_count: true,
          created_at: true,
        },
      }),
      prisma.bid_documents.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        list: list.map(d => ({ ...d, file_size: Number(d.file_size) })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    })
  } catch (error) {
    console.error('[sales/bid-documents] 列表查询失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/bid-documents/:id
 * 文档详情（含章节列表，用于构建 TOC）
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const doc = await prisma.bid_documents.findUnique({
      where: { id },
      include: {
        bid_sections: {
          orderBy: { sort_order: 'asc' },
          select: {
            id: true,
            title: true,
            level: true,
            sort_order: true,
            parent_section_id: true,
          },
        },
      },
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type,
        file_size: Number(doc.file_size),
        source_info: doc.source_info,
        industry: doc.industry,
        section_count: doc.section_count,
        created_at: doc.created_at,
        sections: doc.bid_sections,
      },
    })
  } catch (error) {
    console.error('[sales/bid-documents] 详情查询失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/bid-documents/:id/file
 * 下载原始 docx 文件（销售端）
 */
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params
    const doc = await prisma.bid_documents.findUnique({
      where: { id },
      select: { file_path: true, name: true, file_type: true },
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    const fullPath = resolveFilePath(doc.file_path)
    console.log('[bid-documents/file] UPLOAD_BASE_DIR:', UPLOAD_BASE_DIR)
    console.log('[bid-documents/file] db file_path:', doc.file_path)
    console.log('[bid-documents/file] resolved fullPath:', fullPath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: '文件不存在于磁盘' })
    }

    const fileName = encodeURIComponent(doc.name + doc.file_type)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.sendFile(path.resolve(fullPath))
  } catch (error) {
    console.error('[sales/bid-documents] 文件下载失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
