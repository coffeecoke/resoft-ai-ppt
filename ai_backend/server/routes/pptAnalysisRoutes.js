/**
 * PPT内容分析路由
 */

const express = require('express')
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const pptAnalysisService = require('../services/pptAnalysisService')

const router = express.Router()
const prisma = new PrismaClient()

/**
 * POST /api/ppt-analysis/analyze/:documentId
 * 分析指定文档的所有页面内容并自动分类
 */
router.post('/analyze/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    const { modelName = 'custom-openai' } = req.body
    
    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    // 发送开始事件
    res.write(`data: ${JSON.stringify({ 
      type: 'start', 
      message: '开始分析...',
      documentId,
      documentName: document.name
    })}\n\n`)
    
    // 执行分析,使用进度回调
    const results = await pptAnalysisService.analyzeDocument(
      documentId,
      modelName,
      (current, total, result) => {
        // 发送进度事件
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          current,
          total,
          progress: Math.round((current / total) * 100),
          slideId: result.slideId,
          status: result.status,
          result: result.result
        })}\n\n`)
      }
    )
    
    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: '分析完成',
      results
    })}\n\n`)
    
    res.end()
    
  } catch (error) {
    console.error('PPT分析错误:', error)
    
    // 如果还没有发送响应头,返回JSON错误
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || 'PPT分析失败'
      })
    }
    
    // 如果已经开始流式传输,发送错误事件
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message || 'PPT分析失败'
    })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/ppt-analysis/analyze/:documentId
 * 分析指定文档（GET版本，支持EventSource）
 * Query参数: modelName (默认 custom-openai)
 */
router.get('/analyze/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    const { modelName = 'custom-openai' } = req.query  // 从query获取参数
    
    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')  // 禁用nginx缓冲
    
    // 发送开始事件
    res.write(`data: ${JSON.stringify({ 
      type: 'start', 
      message: '开始分析...',
      documentId,
      documentName: document.name
    })}\n\n`)
    
    // 执行分析,使用进度回调
    const results = await pptAnalysisService.analyzeDocument(
      documentId,
      modelName,
      (current, total, result) => {
        // 发送进度事件
        res.write(`data: ${JSON.stringify({
          type: 'progress',
          current,
          total,
          progress: Math.round((current / total) * 100),
          slideId: result.slideId,
          status: result.status,
          result: result.result
        })}\n\n`)
      }
    )
    
    // 发送完成事件
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: '分析完成',
      results
    })}\n\n`)
    
    res.end()
    
  } catch (error) {
    console.error('PPT分析错误:', error)
    
    // 如果还没有发送响应头,返回JSON错误
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: error.message || 'PPT分析失败'
      })
    }
    
    // 如果已经开始流式传输,发送错误事件
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: error.message || 'PPT分析失败'
    })}\n\n`)
    res.end()
  }
})

/**
 * GET /api/ppt-analysis/results/:documentId
 * 获取指定文档的分析结果
 */
router.get('/results/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    
    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }
    
    const results = await pptAnalysisService.getAnalysisResults(documentId)
    
    res.json({
      success: true,
      documentId,
      documentName: document.name,
      total: results.length,
      results
    })
    
  } catch (error) {
    console.error('获取分析结果错误:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取分析结果失败'
    })
  }
})

/**
 * GET /api/ppt-analysis/categories
 * 获取所有分类标准
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = await pptAnalysisService.getAllCategories()
    
    // 构建树形结构
    const tree = []
    const level1 = categories.filter(c => c.level === 1)
    
    for (const parent of level1) {
      const children = categories.filter(c => c.parent_id === parent.id)
      tree.push({
        ...parent,
        children
      })
    }
    
    res.json({
      success: true,
      total: categories.length,
      level1Count: level1.length,
      level2Count: categories.length - level1.length,
      categories: tree
    })
    
  } catch (error) {
    console.error('获取分类标准错误:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取分类标准失败'
    })
  }
})

/**
 * POST /api/ppt-analysis/analyze-single
 * 分析单个页面内容(测试用)
 */
router.post('/analyze-single', async (req, res) => {
  try {
    const { slideText, slideIndex = 0, slideId = 'test', modelName = 'custom-openai', promptId } = req.body
    
    if (!slideText || slideText.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: '页面内容不能为空'
      })
    }
    
    const result = await pptAnalysisService.analyzeSingleSlide(
      slideText,
      slideIndex,
      slideId,
      modelName,
      promptId || null
    )
    
    // 查询分类信息 (🔄 已更新：从 product_catalogs 表读取)
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      throw new Error('未找到通用PPT分类产品')
    }
    
    const category = await prisma.product_catalogs.findFirst({
      where: { 
        product_id: generalProduct.id,
        code: result.category_code 
      }
    })
    
    res.json({
      success: true,
      result: {
        ...result,
        categoryName: category?.name || '未知分类',
        categoryDescription: category?.description
      }
    })
    
  } catch (error) {
    console.error('单页分析错误:', error)
    res.status(500).json({
      success: false,
      message: error.message || '单页分析失败'
    })
  }
})

/**
 * GET /api/ppt-analysis/statistics/:documentId
 * 获取文档的分类统计信息
 */
router.get('/statistics/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params
    
    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }
    
    // 统计各分类的页面数量
    const thumbnails = await prisma.thumbnails.findMany({
      where: {
        document_id: documentId
      },
      select: {
        page_type: true,
        page_type_confidence: true
      }
    })
    
    // 按分类统计
    const stats = {}
    let analyzedCount = 0
    let totalConfidence = 0
    
    for (const thumb of thumbnails) {
      if (thumb.page_type) {
        analyzedCount++
        totalConfidence += thumb.page_type_confidence || 0
        
        if (!stats[thumb.page_type]) {
          stats[thumb.page_type] = {
            count: 0,
            totalConfidence: 0
          }
        }
        
        stats[thumb.page_type].count++
        stats[thumb.page_type].totalConfidence += thumb.page_type_confidence || 0
      }
    }
    
    // 查询分类名称 (🔄 已更新：从 product_catalogs 表读取)
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      throw new Error('未找到通用PPT分类产品')
    }
    
    const categoryStats = []
    for (const [code, data] of Object.entries(stats)) {
      const category = await prisma.product_catalogs.findFirst({
        where: { 
          product_id: generalProduct.id,
          code 
        }
      })
      
      categoryStats.push({
        categoryCode: code,
        categoryName: category?.name || '未知分类',
        count: data.count,
        percentage: Math.round((data.count / analyzedCount) * 100),
        avgConfidence: data.totalConfidence / data.count
      })
    }
    
    // 按数量排序
    categoryStats.sort((a, b) => b.count - a.count)
    
    res.json({
      success: true,
      documentId,
      documentName: document.name,
      summary: {
        totalSlides: thumbnails.length,
        analyzedSlides: analyzedCount,
        unanalyzedSlides: thumbnails.length - analyzedCount,
        avgConfidence: analyzedCount > 0 ? totalConfidence / analyzedCount : 0
      },
      categoryStats
    })
    
  } catch (error) {
    console.error('获取统计信息错误:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取统计信息失败'
    })
  }
})

/**
 * ==================== 提示词管理接口 ====================
 */

/**
 * GET /api/ppt-analysis/prompts
 * 获取所有提示词模板
 */
router.get('/prompts', async (req, res) => {
  try {
    const prompts = await prisma.prompt_templates.findMany({
      orderBy: [
        { sort_order: 'asc' },
        { created_at: 'desc' }
      ]
    })
    
    res.json({
      success: true,
      data: prompts
    })
  } catch (error) {
    console.error('获取提示词列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '获取提示词列表失败'
    })
  }
})

/**
 * POST /api/ppt-analysis/prompts
 * 创建新的提示词模板
 */
router.post('/prompts', async (req, res) => {
  try {
    const { name, code, type, description, prompt, isActive, sortOrder } = req.body
    
    // 验证必填字段
    if (!name || !code || !prompt) {
      return res.status(400).json({
        success: false,
        message: '名称、代码和提示词内容为必填项'
      })
    }
    
    // 检查code是否已存在
    const existing = await prisma.prompt_templates.findUnique({
      where: { code }
    })
    
    if (existing) {
      return res.status(400).json({
        success: false,
        message: '该代码标识已存在，请使用其他标识'
      })
    }
    
    // 生成ID
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // 创建提示词
    const newPrompt = await prisma.prompt_templates.create({
      data: {
        id,
        name,
        code,
        type: type || 'ppt_analysis',
        description: description || '',
        prompt,
        is_active: isActive !== undefined ? isActive : true,
        sort_order: sortOrder || 0
      }
    })
    
    res.json({
      success: true,
      data: newPrompt,
      message: '创建成功'
    })
  } catch (error) {
    console.error('创建提示词失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '创建提示词失败'
    })
  }
})

/**
 * PUT /api/ppt-analysis/prompts/:id
 * 更新提示词模板
 */
router.put('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { name, description, prompt, isActive, sortOrder } = req.body
    
    // 检查提示词是否存在
    const existing = await prisma.prompt_templates.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '提示词模板不存在'
      })
    }
    
    // 更新提示词（code不允许修改）
    const updateData = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (prompt !== undefined) updateData.prompt = prompt
    if (isActive !== undefined) updateData.is_active = isActive
    if (sortOrder !== undefined) updateData.sort_order = sortOrder
    
    const updated = await prisma.prompt_templates.update({
      where: { id },
      data: updateData
    })
    
    res.json({
      success: true,
      data: updated,
      message: '更新成功'
    })
  } catch (error) {
    console.error('更新提示词失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '更新提示词失败'
    })
  }
})

/**
 * DELETE /api/ppt-analysis/prompts/:id
 * 删除提示词模板
 */
router.delete('/prompts/:id', async (req, res) => {
  try {
    const { id } = req.params
    
    // 检查提示词是否存在
    const existing = await prisma.prompt_templates.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '提示词模板不存在'
      })
    }
    
    // 删除提示词
    await prisma.prompt_templates.delete({
      where: { id }
    })
    
    res.json({
      success: true,
      message: '删除成功'
    })
  } catch (error) {
    console.error('删除提示词失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '删除提示词失败'
    })
  }
})

/**
 * PATCH /api/ppt-analysis/prompts/:id/toggle
 * 切换提示词激活状态
 */
router.patch('/prompts/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params
    
    // 检查提示词是否存在
    const existing = await prisma.prompt_templates.findUnique({
      where: { id }
    })
    
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '提示词模板不存在'
      })
    }
    
    // 切换激活状态
    const updated = await prisma.prompt_templates.update({
      where: { id },
      data: {
        is_active: !existing.is_active
      }
    })
    
    res.json({
      success: true,
      data: updated,
      message: updated.is_active ? '已激活' : '已停用'
    })
  } catch (error) {
    console.error('切换提示词状态失败:', error)
    res.status(500).json({
      success: false,
      message: error.message || '切换状态失败'
    })
  }
})

/**
 * POST /api/ppt-analysis/correct-single
 * 手动纠偏单个页面（人为调整分类）
 * Body参数: documentId, slideId, categoryCode
 */
router.post('/correct-single', async (req, res) => {
  try {
    const { documentId, slideId, categoryCode } = req.body
    
    if (!documentId || !slideId || !categoryCode) {
      return res.status(400).json({
        success: false,
        message: '文档ID、页面ID和分类代码为必填项'
      })
    }
    
    // 验证文档是否存在
    const document = await prisma.documents.findUnique({
      where: { id: documentId }
    })
    
    if (!document) {
      return res.status(404).json({
        success: false,
        message: '文档不存在'
      })
    }
    
    // 验证分类是否存在
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      throw new Error('未找到通用PPT分类产品')
    }
    
    const category = await prisma.product_catalogs.findFirst({
      where: {
        product_id: generalProduct.id,
        code: categoryCode
      }
    })
    
    if (!category) {
      return res.status(400).json({
        success: false,
        message: '分类代码不存在'
      })
    }
    
    // 更新thumbnails表（人为纠偏，置信度设为1.0）
    const updateResult = await prisma.thumbnails.updateMany({
      where: {
        document_id: documentId,
        slide_id: slideId
      },
      data: {
        page_type: categoryCode,
        page_type_confidence: 1.0,  // 人为纠偏，置信度为100%
        analyzed_at: new Date()
      }
    })
    
    if (updateResult.count === 0) {
      return res.status(404).json({
        success: false,
        message: '页面不存在'
      })
    }
    
    res.json({
      success: true,
      message: '纠偏成功',
      result: {
        slideId: slideId,
        categoryCode: categoryCode,
        categoryName: category.name,
        confidence: 1.0,
        correctedAt: new Date()
      }
    })
    
  } catch (error) {
    console.error('纠偏页面错误:', error)
    res.status(500).json({
      success: false,
      message: error.message || '纠偏失败'
    })
  }
})

module.exports = router

