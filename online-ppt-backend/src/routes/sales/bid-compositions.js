/**
 * 响应文件章节合并下载路由
 *
 * API 路径前缀：/api/sales/bid-compositions
 */

import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import docxMergeService from '../../services/docxMergeService.js'
import prisma from '../../lib/prisma.js'

const router = Router()

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
 * Body:
 *   sections: Array<{ id: string, headerOnly?: boolean, title?: string, level?: number }>
 *   name?: string
 */
router.post('/merge-download', async (req, res) => {
  try {
    const { sections: inputSections, name } = req.body

    if (!Array.isArray(inputSections) || inputSections.length === 0) {
      return res.status(400).json({ success: false, message: '请选择至少一个章节' })
    }

    // 分离：正常章节 vs 仅标题行
    const realIds = inputSections.filter(s => !s.headerOnly).map(s => s.id)

    // 查询正常章节的数据库记录
    const dbSections = realIds.length
      ? await prisma.bid_sections.findMany({
          where: { id: { in: realIds } },
          select: { id: true, title: true, level: true, docx_file_path: true },
        })
      : []

    const dbMap = new Map(dbSections.map(s => [s.id, s]))

    // 按前端传入顺序构建合并任务列表
    const mergeTasks = []
    for (const item of inputSections) {
      if (item.headerOnly) {
        // 标题行：只插入 heading 段落
        mergeTasks.push({
          type: 'heading',
          title: item.title || '',
          level: item.level || 1,
        })
      } else {
        const dbSection = dbMap.get(item.id)
        if (!dbSection) continue // 数据库无记录，跳过

        if (!dbSection.docx_file_path) {
          return res.status(400).json({
            success: false,
            message: `章节「${dbSection.title}」没有关联的 docx 文件`,
          })
        }
        const absPath = resolveFilePath(dbSection.docx_file_path)
        if (!fs.existsSync(absPath)) {
          return res.status(404).json({
            success: false,
            message: `章节「${dbSection.title}」的 docx 文件不存在`,
          })
        }
        mergeTasks.push({ type: 'docx', path: absPath })
      }
    }

    if (!mergeTasks.some(t => t.type === 'docx')) {
      return res.status(400).json({ success: false, message: '没有可合并的 docx 章节' })
    }

    // 合并
    const buffer = docxMergeService.mergeWithHeadings(mergeTasks)

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
