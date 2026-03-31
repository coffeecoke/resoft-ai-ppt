/**
 * 招标文件路由（销售前端）
 *
 * API 路径前缀：/api/sales/tender-documents
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import prisma from '../../lib/prisma.js'

const router = Router()

const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR || ''

function resolveFilePath(relativePath) {
  if (!relativePath) return relativePath
  if (path.isAbsolute(relativePath)) return relativePath
  return UPLOAD_BASE_DIR ? path.join(UPLOAD_BASE_DIR, relativePath) : relativePath
}

/**
 * GET /api/sales/tender-documents
 * 招标文件列表
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, pageSize = 50, name } = req.query
    const skip = (parseInt(page) - 1) * parseInt(pageSize)

    const where = {}
    if (name) where.name = { contains: name }

    const [list, total] = await Promise.all([
      prisma.tender_documents.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: parseInt(pageSize),
        select: {
          id: true,
          name: true,
          project_name: true,
          budget: true,
          bid_deadline: true,
          status: true,
          file_type: true,
          file_size: true,
          created_at: true,
          _count: { select: { tender_sections: true } },
        },
      }),
      prisma.tender_documents.count({ where }),
    ])

    res.json({
      success: true,
      data: {
        list: list.map(d => ({
          id: d.id,
          name: d.name,
          project_name: d.project_name,
          budget: d.budget,
          bid_deadline: d.bid_deadline,
          status: d.status,
          file_type: d.file_type,
          file_size: Number(d.file_size),
          section_count: d._count.tender_sections,
          created_at: d.created_at,
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
      },
    })
  } catch (error) {
    console.error('[sales/tender-documents] 列表查询失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/tender-documents/:id
 * 招标文件详情（含章节列表，用于构建 TOC）
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const doc = await prisma.tender_documents.findUnique({
      where: { id },
      include: {
        tender_sections: {
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
      return res.status(404).json({ success: false, error: '招标文件不存在' })
    }

    res.json({
      success: true,
      data: {
        id: doc.id,
        name: doc.name,
        project_name: doc.project_name,
        budget: doc.budget,
        bid_deadline: doc.bid_deadline,
        status: doc.status,
        file_type: doc.file_type,
        file_size: Number(doc.file_size),
        section_count: doc.tender_sections?.length ?? 0,
        analysis_result: doc.analysis_result,
        created_at: doc.created_at,
        sections: doc.tender_sections,
      },
    })
  } catch (error) {
    console.error('[sales/tender-documents] 详情查询失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/sales/tender-documents/:id/file
 * 下载原始 docx 文件
 */
router.get('/:id/file', async (req, res) => {
  try {
    const { id } = req.params
    const doc = await prisma.tender_documents.findUnique({
      where: { id },
      select: { file_path: true, name: true, file_type: true },
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '招标文件不存在' })
    }

    const fullPath = resolveFilePath(doc.file_path)
    console.log('[tender-documents/file] UPLOAD_BASE_DIR:', UPLOAD_BASE_DIR)
    console.log('[tender-documents/file] db file_path:', doc.file_path)
    console.log('[tender-documents/file] resolved fullPath:', fullPath)

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: '文件不存在于磁盘' })
    }

    const ext = doc.file_type || '.docx'
    const fileName = encodeURIComponent(doc.name + ext)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.sendFile(path.resolve(fullPath))
  } catch (error) {
    console.error('[sales/tender-documents] 文件下载失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
