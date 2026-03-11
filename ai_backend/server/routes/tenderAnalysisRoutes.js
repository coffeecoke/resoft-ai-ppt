/**
 * 招标文件分析路由
 */

const express = require('express')
const multer = require('multer')
const path = require('path')
const fs = require('fs').promises
const tenderAnalysisService = require('../services/tenderAnalysisService')
const documentParserService = require('../services/documentParserService')
const docxGeneratorService = require('../services/docxGeneratorService')
const { toAbsolutePath } = require('../utils/pathHelper')

const router = express.Router()

// 配置文件上传（支持 PDF / Word）
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/tender')
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
 * POST /api/tender-analysis/upload
 * 上传招标文件
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' })
    }
    // multer 中文文件名修正
    req.file.originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8')

    const record = await tenderAnalysisService.uploadFile(req.file, req.body.createdBy || null)
    res.json({
      success: true,
      message: '上传成功',
      data: { id: record.id, name: record.name, status: record.status },
    })
  } catch (error) {
    console.error('招标文件上传失败:', error)
    res.status(500).json({ success: false, message: error.message || '上传失败' })
  }
})

/**
 * POST /api/tender-analysis/analyze/:tenderId
 * 触发AI分析（SSE 流式返回进度）
 */
router.post('/analyze/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params
    const { modelName } = req.body

    // SSE 头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始分析招标文件...' })}\n\n`)

    const result = await tenderAnalysisService.analyzeFullFlow(
      tenderId,
      modelName || null,
      (step, total, data) => {
        res.write(`data: ${JSON.stringify({ step, total, ...data })}\n\n`)
      }
    )

    res.write(`data: ${JSON.stringify({ type: 'complete', message: '分析完成', result })}\n\n`)
    res.end()
  } catch (error) {
    console.error('招标分析失败:', error)
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message })
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/tender-analysis/analyze/:tenderId
 * 触发AI分析（GET版，支持 EventSource）
 */
router.get('/analyze/:tenderId', async (req, res) => {
  try {
    const { tenderId } = req.params
    const { modelName } = req.query

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')

    res.write(`data: ${JSON.stringify({ type: 'start', message: '开始分析招标文件...' })}\n\n`)

    const result = await tenderAnalysisService.analyzeFullFlow(
      tenderId,
      modelName || null,
      (step, total, data) => {
        res.write(`data: ${JSON.stringify({ step, total, ...data })}\n\n`)
      }
    )

    res.write(`data: ${JSON.stringify({ type: 'complete', message: '分析完成', result })}\n\n`)
    res.end()
  } catch (error) {
    console.error('招标分析失败:', error)
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: error.message })
    }
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/tender-analysis/list
 * 获取招标文件列表
 */
router.get('/list', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1
    const pageSize = parseInt(req.query.pageSize) || 20
    const result = await tenderAnalysisService.getList(page, pageSize)
    res.json({ success: true, ...result })
  } catch (error) {
    console.error('获取招标列表失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/tender-analysis/:tenderId
 * 获取招标文件详情
 */
router.get('/:tenderId', async (req, res) => {
  try {
    const data = await tenderAnalysisService.getDetail(req.params.tenderId)
    res.json({ success: true, data })
  } catch (error) {
    console.error('获取招标详情失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/tender-analysis/:tenderId/directory
 * 获取投标目录结构（树形）
 */
router.get('/:tenderId/directory', async (req, res) => {
  try {
    const tree = await tenderAnalysisService.getDirectory(req.params.tenderId)
    res.json({ success: true, data: tree })
  } catch (error) {
    console.error('获取目录失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * PUT /api/tender-analysis/directory/:itemId
 * 编辑目录项
 */
router.put('/directory/:itemId', async (req, res) => {
  try {
    const updated = await tenderAnalysisService.updateDirectoryItem(req.params.itemId, req.body)
    res.json({ success: true, data: updated, message: '更新成功' })
  } catch (error) {
    console.error('更新目录项失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * POST /api/tender-analysis/:tenderId/directory/regenerate/:itemId
 * 重新生成某章节内容
 */
router.post('/:tenderId/directory/regenerate/:itemId', async (req, res) => {
  try {
    const { tenderId, itemId } = req.params
    const { modelName } = req.body
    const data = await tenderAnalysisService.regenerateSection(tenderId, itemId, modelName || null)
    res.json({ success: true, message: '重新生成成功', data })
  } catch (error) {
    console.error('重新生成章节失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * GET /api/tender-analysis/:tenderId/export-docx
 * 导出投标文件为 Word 文档
 */
router.get('/:tenderId/export-docx', async (req, res) => {
  try {
    const tender = await tenderAnalysisService.getDetail(req.params.tenderId)
    if (tender.status !== 'completed') {
      return res.status(400).json({ success: false, message: '请先完成AI分析后再导出' })
    }

    const directoryTree = await tenderAnalysisService.getDirectory(req.params.tenderId)
    const filePath = await docxGeneratorService.generateBidDocument(tender, directoryTree)

    const fileName = encodeURIComponent(path.basename(filePath))
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`)
    res.sendFile(toAbsolutePath(filePath))
  } catch (error) {
    console.error('导出Word失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

/**
 * DELETE /api/tender-analysis/:tenderId
 * 删除招标文件
 */
router.delete('/:tenderId', async (req, res) => {
  try {
    await tenderAnalysisService.deleteTender(req.params.tenderId)
    res.json({ success: true, message: '删除成功' })
  } catch (error) {
    console.error('删除招标文件失败:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

module.exports = router
