/**
 * 响应文件章节合并下载路由
 *
 * API 路径前缀：/api/sales/bid-compositions
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import * as prismaClient from '@prisma/client'
import docxMergeService from '../../services/docxMergeService.js'

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
 * POST /api/sales/bid-compositions/merge-download
 * 合并选中章节的 docx 片段为一个完整文档并下载
 *
 * Body: { sectionIds: string[], name?: string }
 */
router.post('/merge-download', async (req, res) => {
  try {
    const { sectionIds, name } = req.body

    if (!Array.isArray(sectionIds) || sectionIds.length === 0) {
      return res.status(400).json({ success: false, message: '请选择至少一个章节' })
    }

    // 查询章节信息
    const sections = await prisma.bid_sections.findMany({
      where: { id: { in: sectionIds } },
      select: {
        id: true,
        title: true,
        docx_file_path: true,
      },
    })

    // 按 sectionIds 输入顺序排列
    const ordered = sectionIds
      .map(id => sections.find(s => s.id === id))
      .filter(Boolean)

    if (ordered.length === 0) {
      return res.status(404).json({ success: false, message: '未找到对应的章节' })
    }

    // 解析文件绝对路径，并校验文件存在
    const docxPaths = []
    for (const section of ordered) {
      if (!section.docx_file_path) {
        return res.status(400).json({
          success: false,
          message: `章节「${section.title}」没有关联的 docx 文件`,
        })
      }
      const absPath = resolveFilePath(section.docx_file_path)
      if (!fs.existsSync(absPath)) {
        return res.status(404).json({
          success: false,
          message: `章节「${section.title}」的 docx 文件不存在`,
        })
      }
      docxPaths.push(absPath)
    }

    // 合并
    const buffer = docxMergeService.merge(docxPaths)

    // 返回下载
    const fileName = encodeURIComponent(name || '合并文档') + '.docx'
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(buffer)
  } catch (err) {
    console.error('[合并下载] 失败:', err)
    res.status(500).json({ success: false, message: err.message || '合并下载失败' })
  }
})

export default router
