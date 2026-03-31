/**
 * 个人文档路由
 *
 * API 端点：
 * - POST /api/personal-documents/merge-and-edit  → 合并章节并创建可编辑文档
 * - GET  /api/personal-documents                  → 获取当前用户的个人文档列表
 * - GET  /api/personal-documents/:id              → 获取文档详情
 * - DELETE /api/personal-documents/:id            → 删除文档
 */

import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import jwt from 'jsonwebtoken'
import docxMergeService from '../services/docxMergeService.js'
import prisma from '../lib/prisma.js'

const router = Router()

const UPLOAD_BASE_DIR = process.env.UPLOAD_BASE_DIR || ''
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

/**
 * 解析文件路径
 */
function resolveFilePath(relativePath) {
  if (!relativePath) return relativePath
  if (path.isAbsolute(relativePath)) return relativePath
  return UPLOAD_BASE_DIR ? path.join(UPLOAD_BASE_DIR, relativePath) : relativePath
}

/**
 * 确保目录存在
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (e) {
    // 目录可能已存在
  }
}

/**
 * POST /api/personal-documents/merge-and-edit
 * 合并选中章节并创建可编辑文档
 *
 * Body: {
 *   sections: [{ id: string, documentType: 'tender' | 'bid', title: string }],
 *   name?: string  // 可选的文件名，默认"合并文档_日期"
 * }
 */
router.post('/merge-and-edit', async (req, res) => {
  try {
    const { sections, name } = req.body
    const username = req.user?.username

    if (!sections || !Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ success: false, error: '请选择至少一个章节' })
    }

    console.log(`[PersonalDocs] 开始合并 ${sections.length} 个章节，用户: ${username}`)

    // 分类：应标文件有 docx，招标文件只有 HTML
    const bidDocxPaths = [] // 应标文件的 docx 路径
    const tenderSections = [] // 招标文件的章节

    for (const section of sections) {
      const { id, documentType } = section

      if (documentType === 'bid') {
        // 从 bid_sections 获取 docx 文件路径
        const bidSection = await prisma.bid_sections.findUnique({
          where: { id },
          select: { title: true, docx_file_path: true }
        })

        if (bidSection?.docx_file_path) {
          const fullPath = resolveFilePath(bidSection.docx_file_path)
          // 检查文件是否存在
          try {
            await fs.access(fullPath)
            bidDocxPaths.push({ path: fullPath, title: bidSection.title })
          } catch {
            console.warn(`[PersonalDocs] 文件不存在: ${fullPath}`)
          }
        }
      } else if (documentType === 'tender') {
        tenderSections.push(section)
      }
    }

    // 生成文档名称
    const docName = name || `合并文档_${new Date().toISOString().slice(0, 10)}`
    const documentId = uuidv4()

    // 确定存储目录
    const personalDir = UPLOAD_BASE_DIR
      ? path.join(UPLOAD_BASE_DIR, 'personal_documents')
      : path.join(process.cwd(), 'data', 'personal_documents')
    await ensureDir(personalDir)

    const docxFilePath = path.join(personalDir, `${documentId}.docx`)
    let mergedBuffer

    if (bidDocxPaths.length > 0) {
      // 有应标文件的 docx，使用 docxMergeService 合并（保留格式、图片）
      console.log(`[PersonalDocs] 使用 docxMergeService 合并 ${bidDocxPaths.length} 个 docx 文件`)

      if (bidDocxPaths.length === 1) {
        // 单文件直接复制
        const content = await fs.readFile(bidDocxPaths[0].path)
        mergedBuffer = content
      } else {
        // 多文件合并
        const tasks = bidDocxPaths.map((item, idx) => ({
          type: 'docx',
          path: item.path,
          // 第一个不加标题，后续加章节标题
          title: idx === 0 ? null : item.title
        })).filter(t => t.path)

        // 使用 mergeWithHeadings 在章节间插入标题
        mergedBuffer = docxMergeService.mergeWithHeadings(tasks, { pageBreak: true })
      }
    } else {
      // 只有招标文件的 HTML 内容，使用 docx 包创建（简化处理）
      console.log(`[PersonalDocs] 使用 docx 包从 HTML 创建文档`)

      const htmlContents = []
      for (const section of tenderSections) {
        const tenderSection = await prisma.tender_sections.findUnique({
          where: { id: section.id },
          include: {
            tender_documents: {
              select: { raw_html_path: true, name: true }
            }
          }
        })

        if (tenderSection?.tender_documents?.raw_html_path) {
          htmlContents.push(`<h1>${section.title}</h1><p>[章节内容待实现]</p>`)
        }
      }

      const mergedHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Microsoft YaHei', sans-serif; margin: 40px; }
            h1 { color: #333; border-bottom: 2px solid #006DF9; padding-bottom: 10px; }
          </style>
        </head>
        <body>
          ${htmlContents.join('\n<hr/>\n')}
        </body>
        </html>
      `

      mergedBuffer = await createMinimalDocx(mergedHtml)
    }

    // 保存合并后的文件
    await fs.writeFile(docxFilePath, mergedBuffer)

    // 保存到数据库
    const personalDoc = await prisma.personal_documents.create({
      data: {
        id: documentId,
        name: docName,
        file_path: path.relative(UPLOAD_BASE_DIR || process.cwd(), docxFilePath),
        file_type: '.docx',
        file_size: BigInt(mergedBuffer.length),
        source_type: sections[0]?.documentType,
        source_ids: sections.map(s => ({ id: s.id, title: s.title })),
        created_by: username
      }
    })

    // 生成编辑器 token
    const token = jwt.sign(
      {
        documentId,
        userId: username,
        permissions: { edit: true, download: true, print: true }
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    )

    console.log(`[PersonalDocs] 文档创建成功: ${docName}, ID: ${documentId}, 大小: ${mergedBuffer.length} bytes`)

    res.json({
      success: true,
      data: {
        id: documentId,
        name: docName,
        token,
        created_at: personalDoc.created_at
      }
    })
  } catch (error) {
    console.error('[PersonalDocs] 合并章节失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * 创建最小的 docx 文件（基于 HTML 内容）
 * 注意：这是一个简化实现，完整的转换需要使用 pandoc 或 docx 库
 */
async function createMinimalDocx(htmlContent) {
  // 使用 docx 库或 html-docx-js 进行转换
  // 这里先用简单的占位符，实际应该用专门的库
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')

  // 解析 HTML 提取文本（简化版）
  const textContent = htmlContent
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  const paragraphs = textContent.split('\n\n').map(text => {
    if (text.startsWith('合并文档') || text.length > 100) {
      return new Paragraph({
        children: [new TextRun({ text: text.trim() })],
        spacing: { after: 200 }
      })
    }
    return new Paragraph({
      text: text.trim(),
      spacing: { after: 100 }
    })
  })

  const doc = new Document({
    sections: [{
      properties: {},
      children: paragraphs.length > 0 ? paragraphs : [new Paragraph({ text: ' ' })]
    }]
  })

  return await Packer.toBuffer(doc)
}

/**
 * GET /api/personal-documents
 * 获取当前用户的个人文档列表
 */
router.get('/', async (req, res) => {
  try {
    const username = req.user?.username
    const { page = 1, pageSize = 20 } = req.query

    const skip = (parseInt(page) - 1) * parseInt(pageSize)

    const [list, total] = await Promise.all([
      prisma.personal_documents.findMany({
        where: { created_by: username },
        orderBy: { updated_at: 'desc' },
        skip,
        take: parseInt(pageSize),
        select: {
          id: true,
          name: true,
          file_type: true,
          file_size: true,
          source_type: true,
          created_at: true,
          updated_at: true
        }
      }),
      prisma.personal_documents.count({
        where: { created_by: username }
      })
    ])

    res.json({
      success: true,
      data: {
        list: list.map(doc => ({
          ...doc,
          file_size: Number(doc.file_size)
        })),
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize)
      }
    })
  } catch (error) {
    console.error('[PersonalDocs] 获取列表失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * GET /api/personal-documents/:id
 * 获取文档详情
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 权限检查：只有创建者可以访问
    if (doc.created_by !== username) {
      return res.status(403).json({ success: false, error: '无权访问此文档' })
    }

    res.json({
      success: true,
      data: {
        ...doc,
        file_size: Number(doc.file_size)
      }
    })
  } catch (error) {
    console.error('[PersonalDocs] 获取详情失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * DELETE /api/personal-documents/:id
 * 删除文档
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const username = req.user?.username

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    // 权限检查：只有创建者可以删除
    if (doc.created_by !== username) {
      return res.status(403).json({ success: false, error: '无权删除此文档' })
    }

    // 删除文件
    try {
      const filePath = resolveFilePath(doc.file_path)
      await fs.unlink(filePath)
    } catch (e) {
      console.warn('[PersonalDocs] 删除文件失败:', e.message)
    }

    // 删除数据库记录
    await prisma.personal_documents.delete({
      where: { id }
    })

    res.json({ success: true, message: '文档已删除' })
  } catch (error) {
    console.error('[PersonalDocs] 删除失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

/**
 * PUT /api/personal-documents/:id/rename
 * 重命名文档
 */
router.put('/:id/rename', async (req, res) => {
  try {
    const { id } = req.params
    const { name } = req.body
    const username = req.user?.username

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: '文件名不能为空' })
    }

    const doc = await prisma.personal_documents.findUnique({
      where: { id }
    })

    if (!doc) {
      return res.status(404).json({ success: false, error: '文档不存在' })
    }

    if (doc.created_by !== username) {
      return res.status(403).json({ success: false, error: '无权修改此文档' })
    }

    await prisma.personal_documents.update({
      where: { id },
      data: { name: name.trim() }
    })

    res.json({ success: true, message: '重命名成功' })
  } catch (error) {
    console.error('[PersonalDocs] 重命名失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router