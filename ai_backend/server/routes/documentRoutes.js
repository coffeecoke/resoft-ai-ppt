/**
 * AI后台文档管理路由
 * 功能：查询文档库、提取文档内容到slide_merged_contents表
 */

const express = require('express')
const router = express.Router()
const documentService = require('../services/documentService')

/**
 * 获取文档列表（含提取状态）
 * GET /api/documents/list
 * 
 * Query参数：
 * - page: 页码（默认1）
 * - pageSize: 每页数量（默认20）
 * - status: 状态筛选（draft/published/extracted）
 * - category: 分类筛选
 * - keyword: 搜索关键词（匹配名称/客户名）
 */
router.get('/list', async (req, res) => {
  try {
    const {
      page = 1,
      pageSize = 20,
      status,
      category,
      keyword,
    } = req.query

    console.log('[AI后台] 查询文档列表:', { page, pageSize, status, category, keyword })

    const result = await documentService.getDocumentList({
      page: Number(page),
      pageSize: Number(pageSize),
      status,
      category,
      keyword,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[AI后台] 获取文档列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取文档列表失败',
    })
  }
})

/**
 * 提取文档内容
 * POST /api/documents/:id/extract
 * 
 * 路径参数：
 * - id: 文档ID
 * 
 * Body参数：
 * - extract_method: 提取方法（auto/manual，默认auto）
 * - force: 是否强制重新提取（默认false，如果已提取则跳过）
 */
router.post('/:id/extract', async (req, res) => {
  try {
    const { id } = req.params
    const { extract_method = 'auto', force = false } = req.body || {}

    console.log('[AI后台] 提取文档内容:', { id, extract_method, force })

    // 检查文档是否存在
    const exists = await documentService.checkDocumentExists(id)
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: '文档不存在',
      })
    }

    // 如果不是强制提取，检查是否已提取
    if (!force) {
      const extractStatus = await documentService.checkExtractStatus(id)
      if (extractStatus.isExtracted && extractStatus.count > 0) {
        return res.status(409).json({
          success: false,
          error: '文档已提取，如需重新提取请设置 force=true',
          data: {
            document_id: id,
            extracted_count: extractStatus.count,
            status: 'already_extracted',
          },
        })
      }
    }

    // 执行提取
    const result = await documentService.extractAndSave(id, extract_method, force)

    console.log('[AI后台] 提取完成:', result)

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error('[AI后台] 提取文档内容失败:', error)

    // 根据错误类型返回不同状态码
    if (error.message === '文档不存在') {
      return res.status(404).json({
        success: false,
        error: error.message,
      })
    }
    
    if (error.message === '文件不存在' || error.message.includes('找不到文件')) {
      return res.status(404).json({
        success: false,
        error: '文档JSON文件不存在或路径错误',
        detail: error.message,
      })
    }
    
    if (error.message.includes('JSON') || error.message.includes('解析')) {
      return res.status(400).json({
        success: false,
        error: '文档JSON文件解析失败',
        detail: error.message,
      })
    }

    res.status(500).json({
      success: false,
      error: error.message || '提取文档内容失败',
    })
  }
})

/**
 * 检查文档提取状态
 * GET /api/documents/:id/extract-status
 * 
 * 路径参数：
 * - id: 文档ID
 */
router.get('/:id/extract-status', async (req, res) => {
  try {
    const { id } = req.params

    const status = await documentService.checkExtractStatus(id)

    res.json({
      success: true,
      data: {
        document_id: id,
        is_extracted: status.isExtracted,
        extracted_count: status.count,
        last_extracted_at: status.lastExtractedAt,
      },
    })
  } catch (error) {
    console.error('[AI后台] 检查提取状态失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '检查提取状态失败',
    })
  }
})

/**
 * 批量提取文档
 * POST /api/documents/batch-extract
 * 
 * Body参数：
 * - document_ids: 文档ID数组
 * - extract_method: 提取方法（auto/manual，默认auto）
 * - force: 是否强制重新提取（默认false）
 */
router.post('/batch-extract', async (req, res) => {
  try {
    const { document_ids, extract_method = 'auto', force = false } = req.body || {}

    if (!Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请提供文档ID数组 document_ids',
      })
    }

    console.log('[AI后台] 批量提取文档:', { count: document_ids.length, extract_method, force })

    const results = []
    for (const id of document_ids) {
      try {
        // 检查是否已提取
        if (!force) {
          const extractStatus = await documentService.checkExtractStatus(id)
          if (extractStatus.isExtracted && extractStatus.count > 0) {
            results.push({
              document_id: id,
              success: true,
              status: 'skipped',
              message: '已提取，跳过',
              extracted_count: extractStatus.count,
            })
            continue
          }
        }

        // 执行提取
        const result = await documentService.extractAndSave(id, extract_method, force)
        results.push({
          document_id: id,
          success: true,
          status: 'extracted',
          extracted_count: result.extracted_count,
        })
      } catch (error) {
        console.error(`[AI后台] 提取文档失败: ${id}`, error)
        results.push({
          document_id: id,
          success: false,
          status: 'failed',
          error: error.message,
        })
      }
    }

    const successCount = results.filter(r => r.success && r.status === 'extracted').length
    const skippedCount = results.filter(r => r.success && r.status === 'skipped').length
    const failedCount = results.filter(r => !r.success).length

    console.log('[AI后台] 批量提取完成:', { successCount, skippedCount, failedCount })

    res.json({
      success: true,
      data: {
        total: document_ids.length,
        success_count: successCount,
        skipped_count: skippedCount,
        failed_count: failedCount,
        results,
      },
    })
  } catch (error) {
    console.error('[AI后台] 批量提取失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '批量提取失败',
    })
  }
})

module.exports = router

