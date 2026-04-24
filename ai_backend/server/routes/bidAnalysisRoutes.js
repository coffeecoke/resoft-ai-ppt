/**
 * 投标文件分析路由
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const bidAnalysisService = require('../services/bidAnalysisService')
const documentParserService = require('../services/documentParserService')
const { getUploadBaseDir, toRelativePath } = require('../utils/pathHelper')
const prisma = require('../utils/prisma')

const router = express.Router()

// 配置文件上传：存储目录以 UPLOAD_BASE_DIR 为根
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(getUploadBaseDir(), 'bid')
    await fs.mkdir(uploadDir, { recursive: true })
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    cb(null, `${timestamp}_${safeName}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
    if (documentParserService.isSupportedType(originalName)) {
      cb(null, true)
    } else {
      cb(new Error('不支持的文件格式，请上传 PDF / Word / TXT 文件'))
    }
  },
  limits: { fileSize: 100 * 1024 * 1024 },
})

/**
 * POST /api/bid-analysis/upload
 * 上传投标文件
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' })
    }
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    // 将绝对路径转换为相对路径后再入库
    req.file.path = toRelativePath(req.file.path)

    const meta = {
      sourceInfo: req.body.sourceInfo,
      industry: req.body.industry,
      projectType: req.body.projectType,
      createdBy: req.body.createdBy,
    }

    const record = await bidAnalysisService.uploadFile(req.file, meta)
    res.json({
      success: true,
      message: '上传成功',
      data: { id: record.id, name: record.name, status: record.status },
    })
  } catch (error) {
    console.error('投标文件上传失败:', error)
    res.status(500).json({ success: false, message: error.message || '上传失败' })
  }
})

/**
 * POST /api/bid-analysis/analyze/:bidDocId
 * 触发AI拆分（SSE 流式返回进度）
 */
router.post('/analyze/:bidDocId', async (req, res) => {
  try {
    const { bidDocId } = req.params
    const { modelName } = req.body

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始拆分投标文件...' })}\n\n`)

    const result = await bidAnalysisService.splitFullFlow(
      bidDocId,
      modelName || null,
      (step, total, data) => {
        res.write(`data: ${JSON.stringify({ step, total, ...data })}\n\n`)
      }
    )

    res.write(`data: ${JSON.stringify({ type: 'complete', message: '拆分完成', result })}\n\n`)
    res.end()
  } catch (error) {
    console.error('投标拆分失败:', error)
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message })
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/bid-analysis/analyze/:bidDocId
 * 触发AI拆分（GET版，支持 EventSource）
 */
router.get('/analyze/:bidDocId', async (req, res) => {
  try {
    const { bidDocId } = req.params
    const { modelName } = req.query

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始拆分投标文件...' })}\n\n`)

    const result = await bidAnalysisService.splitFullFlow(
      bidDocId,
      modelName || null,
      (step, total, data) => {
        res.write(`data: ${JSON.stringify({ step, total, ...data })}\n\n`)
      }
    )

    res.write(`data: ${JSON.stringify({ type: 'complete', message: '拆分完成', result })}\n\n`)
    res.end()
  } catch (error) {
    console.error('投标拆分失败:', error)
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message })
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/bid-analysis/list
 * 获取投标文件列表
 */
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20
    const result = await bidAnalysisService.getList(page, pageSize)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('获取投标列表失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/bid-analysis/section-types
 * 获取章节类型列表（从数据库读取）
 */
router.get('/section-types', async (req, res) => {
  try {
    const types = await prisma.bid_section_types.findMany({
      where: { is_active: true },
      orderBy: { sort_order: 'asc' },
      select: { id: true, code: true, name: true, description: true, sort_order: true },
    })
    res.json({ success: true, data: types })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

/**
 * POST /api/bid-analysis/section-types
 * 新增章节类型
 */
router.post('/section-types', async (req, res) => {
  try {
    const { code, name, description, sort_order = 0 } = req.body
    if (!code || !name || !description) {
      return res.status(400).json({ success: false, message: 'code/name/description 均为必填' })
    }
    const created = await prisma.bid_section_types.create({
      data: { code, name, description, sort_order: Number(sort_order) },
    })
    res.json({ success: true, data: created })
  } catch (err) {
    const msg = err.code === 'P2002' ? `类型代码 "${req.body.code}" 已存在` : err.message
    res.status(400).json({ success: false, message: msg })
  }
})

/**
 * PUT /api/bid-analysis/section-types/:id
 * 修改章节类型
 */
router.put('/section-types/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, description, sort_order, is_active } = req.body
    const updated = await prisma.bid_section_types.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(sort_order !== undefined && { sort_order: Number(sort_order) }),
        ...(is_active !== undefined && { is_active: Boolean(is_active) }),
      },
    })
    res.json({ success: true, data: updated })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

/**
 * DELETE /api/bid-analysis/section-types/:id
 * 软删除（置为 is_active=false）
 */
router.delete('/section-types/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    await prisma.bid_section_types.update({
      where: { id },
      data: { is_active: false },
    })
    res.json({ success: true })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

/**
 * GET /api/bid-analysis/sections/search
 * 搜索章节库（跨所有投标文件）
 */
router.get('/sections/search', async (req, res) => {
  try {
    const result = await bidAnalysisService.searchSections(req.query)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('搜索章节失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/bid-analysis/:bidDocId
 * 获取投标文件详情
 */
router.get('/:bidDocId', async (req, res) => {
  try {
    const data = await bidAnalysisService.getDetail(req.params.bidDocId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('获取投标详情失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/bid-analysis/:bidDocId/sections
 * 获取投标文件的拆分章节列表
 */
router.get('/:bidDocId/sections', async (req, res) => {
  try {
    const data = await bidAnalysisService.getSections(req.params.bidDocId, req.query)
    res.json({ success: true, total: data.length, data })
  } catch (error) {
    console.error('获取章节列表失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * PUT /api/bid-analysis/sections/:sectionId
 * 编辑章节信息
 */
router.put('/sections/:sectionId', async (req, res) => {
  try {
    const updated = await bidAnalysisService.updateSection(req.params.sectionId, req.body)
    res.json({ success: true, data: updated, message: '更新成功' })
  } catch (error) {
    console.error('更新章节失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * DELETE /api/bid-analysis/:bidDocId
 * 删除投标文件（级联删除所有章节）
 */
router.delete('/:bidDocId', async (req, res) => {
  try {
    await bidAnalysisService.deleteBidDoc(req.params.bidDocId)
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除投标文件失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
