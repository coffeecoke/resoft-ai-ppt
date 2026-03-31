import { Router } from 'express'
import { documentService } from '../../services/documentService.js'
import { thumbnailService } from '../../services/thumbnailService.js'
import aiService from '../../services/aiService.js'
import { createSummaryPrompt } from '../../prompts/summaryPrompt.js'
import prisma from '../../lib/prisma.js'

const router = Router()

/**
 * 获取默认PPT列表（未选择产品时）
 * GET /api/sales/documents
 * 
 * Query参数：
 * - status: 文档状态（默认: published）
 * - tag: 文档标签（public=公版, practical=实战版）
 * - page: 页码（默认: 1）
 * - pageSize: 每页数量（默认: 20）
 * - keyword: 搜索关键词
 * - industry: 行业筛选（可传多个，用逗号分隔）
 * - audience: 交流对象筛选（可传多个，用逗号分隔）
 * - language: 语言筛选（可传多个，用逗号分隔）
 * - pageType: 产品目录筛选（可传多个，用逗号分隔，如 "1.1,1.2"）
 * - sortBy: 排序字段（默认: updatedAt）
 * - order: 排序方式（asc/desc，默认: desc）
 */
router.get('/', async (req, res) => {
  try {
    const {
      status = 'published',
      tag,
      page = 1,
      pageSize = 20,
      keyword,
      industry,
      audience,
      language,
      pageType,
      sortBy = 'updated_at',
      order = 'desc',
    } = req.query

    console.log('[文档查询] 📥 收到请求:', {
      status,
      tag,
      page,
      pageSize,
      keyword,
      industry,
      audience,
      language,
      pageType
    })

    // 如果传了pageType，需要先通过缩略图表查询符合条件的document_id
    let documentIdsFromPageType = null
    if (pageType && typeof pageType === 'string') {
      const pageTypes = pageType.split(',').map(p => p.trim()).filter(Boolean)
      if (pageTypes.length > 0) {
        console.log('[文档查询] 🔍 根据pageType筛选:', pageTypes)
        
        // 查询符合page_type的所有缩略图，获取document_id
        const thumbnails = await prisma.thumbnails.findMany({
          where: {
            page_type: { in: pageTypes },
            documents: {
              status: status
            }
          },
          select: {
            document_id: true
          },
          distinct: ['document_id']  // 去重
        })
        
        documentIdsFromPageType = thumbnails.map(t => t.document_id)
        console.log('[文档查询] 📦 找到符合pageType的文档数量:', documentIdsFromPageType.length)
      }
    }

    // 获取所有文档
    let list = await documentService.getAll({ status, tag })
    
    console.log('[文档查询] 📚 查询到文档总数:', list.length)

    console.log('[文档查询] 📚 查询到文档总数:', list.length)

    // 应用高级筛选
    let filtered = list
    
    // 0. pageType筛选（必须包含至少一个符合的page_type）
    if (documentIdsFromPageType !== null) {
      filtered = filtered.filter(item => documentIdsFromPageType.includes(item.id))
      console.log('[文档查询] ✂️ pageType筛选后数量:', filtered.length)
    }
    
    // 1. 关键词搜索（匹配名称或客户名称）
    if (keyword && typeof keyword === 'string') {
      const k = keyword.toLowerCase()
      filtered = filtered.filter(item => {
        const name = (item.name || '').toLowerCase()
        const customerName = (item.customerName || '').toLowerCase()
        return name.includes(k) || customerName.includes(k)
      })
    }

    // 2. 行业筛选（支持多选，满足任一即可）
    if (industry && typeof industry === 'string') {
      const industries = industry.split(',').map(i => i.trim()).filter(Boolean)
      if (industries.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.industry || !Array.isArray(item.industry)) return false
          return industries.some(filterIndustry => 
            item.industry.includes(filterIndustry)
          )
        })
      }
    }

    // 3. 交流对象筛选（支持多选，满足任一即可）
    if (audience && typeof audience === 'string') {
      const audiences = audience.split(',').map(a => a.trim()).filter(Boolean)
      if (audiences.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.audience || !Array.isArray(item.audience)) return false
          return audiences.some(filterAudience => 
            item.audience.includes(filterAudience)
          )
        })
      }
    }

    // 4. 语言筛选（支持多选，满足任一即可）
    if (language && typeof language === 'string') {
      const languages = language.split(',').map(l => l.trim()).filter(Boolean)
      if (languages.length > 0) {
        filtered = filtered.filter(item => {
          if (!item.language) return false
          return languages.includes(item.language)
        })
      }
    }

    console.log('[文档查询] ✅ 最终筛选后数量:', filtered.length)

    // 排序
    filtered.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]

      if (sortBy === 'name') {
        aVal = (aVal || '').toLowerCase()
        bVal = (bVal || '').toLowerCase()
      }

      if (order === 'asc') {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
      }
    })

    // 分页
    const p = Number(page) || 1
    const ps = Number(pageSize) || 20
    const start = (p - 1) * ps
    const end = start + ps
    const pageList = filtered.slice(start, end)

    // 检查并修复封面：如果cover为空或地址不正确，从缩略图获取第一张
    for (const doc of pageList) {
      if (!doc.cover || doc.cover.trim() === '' || !doc.cover.startsWith('/snapshots/')) {
        try {
          const thumbnailResult = await thumbnailService.getByDocumentId(doc.id)
          if (thumbnailResult.thumbnails && thumbnailResult.thumbnails.length > 0) {
            // 按 slideIndex 排序，取第一张（slideIndex = 0）
            const firstThumbnail = thumbnailResult.thumbnails.find(t => t.slideIndex === 0) || thumbnailResult.thumbnails[0]
            if (firstThumbnail && firstThumbnail.url) {
              doc.cover = firstThumbnail.url
              // 同时更新数据库中的cover字段（异步，不阻塞响应）
              documentService.update(doc.id, { cover: firstThumbnail.url }).catch(err => {
                console.warn(`[Sales文档] 更新封面失败: ${doc.id}`, err.message)
              })
            }
          }
        } catch (error) {
          console.warn(`[Sales文档] 获取缩略图失败: ${doc.id}`, error.message)
        }
      }
    }

    res.json({
      success: true,
      data: {
        documents: pageList,
        pagination: {
          total: filtered.length,
          page: p,
          pageSize: ps,
          totalPages: Math.ceil(filtered.length / ps)
        }
      }
    })
  } catch (error) {
    console.error('[Sales文档] 获取列表失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取文档列表失败' })
  }
})

/**
 * 获取产品关联的PPT列表
 * GET /api/sales/documents/by-product/:productId
 * 
 * Query参数：
 * - catalogId: 目录ID（可选，筛选特定目录的文档）
 * - version: 版本（public=公版, practical=实战版）
 * - page: 页码
 * - pageSize: 每页数量
 */
router.get('/by-product/:productId', async (req, res) => {
  try {
    const { productId } = req.params
    const {
      catalogId,
      version,
      page = 1,
      pageSize = 20,
    } = req.query

    // TODO: 实现产品关联文档查询
    // 这需要先实现 ProductDocument 相关的 model 和 service
    res.json({
      success: true,
      data: {
        documents: [],
        pagination: {
          total: 0,
          page: Number(page),
          pageSize: Number(pageSize),
          totalPages: 0
        }
      },
      message: '产品关联文档查询功能待实现'
    })
  } catch (error) {
    console.error('[Sales文档] 获取产品文档失败:', error)
    res.status(500).json({ success: false, error: error.message || '获取产品文档失败' })
  }
})

/**
 * 生成文档总结
 * POST /api/sales/documents/:documentId/summary
 * 
 * 功能：
 * 1. 从 slide_merged_contents 表查询文档的所有文本内容
 * 2. 调用豆包AI生成结构化总结
 * 3. 流式返回总结内容
 */
router.post('/:documentId/summary', async (req, res) => {
  try {
    const { documentId } = req.params
    const { userPrompt } = req.body || {}
    
    // 1. 查询文档基本信息
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        slide_count: true
      }
    })
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: '文档不存在' 
      })
    }
    
    console.log('[文档总结] 文档信息:', document)
    
    // 2. 查询文档的所有文本内容（按幻灯片顺序）
    const slideContents = await prisma.slide_merged_contents.findMany({
      where: { document_id: documentId },
      select: {
        merged_content: true,
        slide_order: true
      },
      orderBy: { slide_order: 'asc' }
    })
    
    if (!slideContents || slideContents.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '文档内容为空，无法生成总结' 
      })
    }
    
    console.log('[文档总结] 查询到幻灯片内容数量:', slideContents.length)
    
    // 3. 拼接所有文本内容
    const documentText = slideContents
      .map((slide, index) => {
        const content = slide.merged_content || ''
        return `【第${index + 1}页】\n${content.trim()}`
      })
      .join('\n\n')
    
    console.log('[文档总结] 文本总长度:', documentText.length, '字符')
    
    // 4. 限制文本长度（避免超过模型token限制）
    const MAX_TEXT_LENGTH = 20000 // 约 32K token 的一半（留给输出）
    let finalText = documentText
    if (documentText.length > MAX_TEXT_LENGTH) {
      console.log('[文档总结] 文本过长，截断至', MAX_TEXT_LENGTH, '字符')
      finalText = documentText.substring(0, MAX_TEXT_LENGTH) + '\n\n【注：内容过长，仅分析前' + Math.floor(MAX_TEXT_LENGTH / 1000) + 'K字符】'
    }
    
    // 5. 构建Prompt
    const prompt = createSummaryPrompt(finalText, {
      name: document.name,
      slideCount: document.slide_count,
      userPrompt: userPrompt || ''
    })
    
    console.log('[文档总结] Prompt构建完成')
    
    // 6. 调用AI生成总结（流式返回）
    const modelName = 'ark-doubao-seed-1.6-flash' // 使用豆包Flash模型
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ]
    
    console.log('[文档总结] 调用AI模型:', modelName)
    
    // 使用aiService的流式响应方法
    await aiService.createStreamResponse(modelName, messages, res, {
      temperature: 0.7,
      maxTokens: 2000
    })
    
    console.log('[文档总结] 总结生成完成')
    
  } catch (error) {
    console.error('[文档总结] 生成失败:', error)
    
    // 如果响应头已发送，无法再返回JSON
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || '生成总结失败' 
      })
    } else {
      // 流式传输已开始，直接结束
      res.end()
    }
  }
})

/**
 * AI助手聊天
 * POST /api/sales/documents/:documentId/chat
 * 
 * 功能：
 * 1. 接收用户消息和历史对话
 * 2. 调用豆包AI进行对话
 * 3. 流式返回AI回复
 * 
 * Body参数：
 * - message: 用户消息
 * - history: 历史对话（可选）[{role: 'user'|'assistant', content: string}]
 */
router.post('/:documentId/chat', async (req, res) => {
  try {
    const { documentId } = req.params
    const { message, history = [] } = req.body
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: '消息内容不能为空' 
      })
    }
    
    console.log('[AI助手聊天] documentId:', documentId, '消息:', message)
    
    // 构建对话消息
    const messages = [
      {
        role: 'user',
        content: '你是一个专业的PPT助手，帮助用户分析和理解PPT文档内容。请用简洁、专业的语言回答用户的问题。'
      },
      ...history, // 历史对话
      {
        role: 'user',
        content: message
      }
    ]
    
    console.log('[AI助手聊天] 对话轮数:', messages.length)
    
    // 调用AI生成回复（流式返回）
    const modelName = 'ark-doubao-seed-1.6-flash'
    
    await aiService.createStreamResponse(modelName, messages, res, {
      temperature: 0.8,
      maxTokens: 2000
    })
    
    console.log('[AI助手聊天] 回复完成')
    
  } catch (error) {
    console.error('[AI助手聊天] 失败:', error)
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'AI助手聊天失败' 
      })
    } else {
      res.end()
    }
  }
})

/**
 * AI分析选中的幻灯片
 * POST /api/sales/documents/:documentId/analyze-slides
 * 
 * 功能：
 * 1. 必须传入选中的幻灯片ID数组
 * 2. 支持单页或多页分析
 * 3. 流式返回分析结果
 * 
 * Body参数：
 * - slideIds: 要分析的幻灯片ID数组（必填，如 ["slide_abc", "slide_def"]）
 */
router.post('/:documentId/analyze-slides', async (req, res) => {
  try {
    const { documentId } = req.params
    const { slideIds, userPrompt } = req.body
    
    // 验证参数
    if (!Array.isArray(slideIds) || slideIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '请选择要分析的幻灯片' 
      })
    }
    
    console.log('[幻灯片分析] 开始分析，documentId:', documentId, 
                'slideIds:', slideIds)
    
    // 1. 查询文档基本信息
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        slide_count: true
      }
    })
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: '文档不存在' 
      })
    }
    
    // 2. 查询选中的幻灯片内容（使用 documentId + slideIds）
    const slideContents = await prisma.slide_merged_contents.findMany({
      where: {
        document_id: documentId,
        slide_id: {
          in: slideIds  // 直接使用 slideIds 数组
        }
      },
      select: {
        merged_content: true,
        slide_order: true,
        slide_id: true
      },
      orderBy: { slide_order: 'asc' }
    })
    
    if (!slideContents || slideContents.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '选中的幻灯片内容为空，无法生成分析' 
      })
    }
    
    console.log('[幻灯片分析] 查询到幻灯片内容数量:', slideContents.length)
    
    // 3. 拼接文本内容
    const documentText = slideContents
      .map((slide) => {
        const content = slide.merged_content || ''
        return `【第${slide.slide_order}页】\n${content.trim()}`
      })
      .join('\n\n')
    
    console.log('[幻灯片分析] 文本总长度:', documentText.length, '字符')
    
    // 4. 限制文本长度
    const MAX_TEXT_LENGTH = 15000
    let finalText = documentText
    if (documentText.length > MAX_TEXT_LENGTH) {
      console.log('[幻灯片分析] 文本过长，截断至', MAX_TEXT_LENGTH, '字符')
      finalText = documentText.substring(0, MAX_TEXT_LENGTH) + 
                  '\n\n【注：内容过长，仅分析前' + Math.floor(MAX_TEXT_LENGTH / 1000) + 'K字符】'
    }
    
    // 5. 构建Prompt（完全在后台）
    const { createSlideAnalysisPrompt } = await import('../../prompts/slideAnalysisPrompt.js')
    const prompt = createSlideAnalysisPrompt(finalText, {
      name: document.name,
      slideCount: document.slide_count,
      analyzedPageCount: slideContents.length,
      pageNumbers: slideContents.map(s => s.slide_order),
      userPrompt: userPrompt || ''
    })
    
    console.log('[幻灯片分析] Prompt构建完成')
    
    // 6. 调用AI生成分析（流式返回）
    const modelName = 'ark-doubao-seed-1.6-flash'
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ]
    
    console.log('[幻灯片分析] 调用AI模型:', modelName)
    
    await aiService.createStreamResponse(modelName, messages, res, {
      temperature: 0.7,
      maxTokens: 1500
    })
    
    console.log('[幻灯片分析] 分析生成完成')
    
  } catch (error) {
    console.error('[幻灯片分析] 生成失败:', error)
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || '生成分析失败' 
      })
    } else {
      res.end()
    }
  }
})

/**
 * 批量获取文档数据
 * POST /api/sales/documents/batch-fetch
 * 
 * 功能：
 * 1. 批量获取多个文档的完整数据
 * 2. 支持指定slideIds，只返回指定的幻灯片
 * 3. 用于批量导出功能
 * 
 * Request Body:
 * {
 *   items: [
 *     {
 *       documentId: 'doc_xxx',
 *       slideIds: ['slide_1', 'slide_2'] // 可选，为空则获取全部
 *     }
 *   ]
 * }
 * 
 * Response:
 * {
 *   success: true,
 *   data: [
 *     {
 *       documentId: 'doc_xxx',
 *       metadata: {...},
 *       documentData: {
 *         slides: [...] // 只包含slideIds指定的幻灯片
 *       }
 *     }
 *   ]
 * }
 */
router.post('/batch-fetch', async (req, res) => {
  try {
    const { items } = req.body
    
    // 验证参数
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供要获取的文档列表' 
      })
    }
    
    console.log('[批量获取] 开始批量获取文档数据，项目数量:', items.length)
    
    const results = []
    
    // 遍历每个项目
    for (const item of items) {
      const { documentId, slideIds = [] } = item
      
      try {
        // 获取文档完整数据
        const document = await documentService.getById(documentId)
        
        if (!document || !document.slides) {
          console.warn(`[批量获取] 文档不存在或数据为空: ${documentId}`)
          results.push({
            documentId,
            error: '文档不存在或数据为空'
          })
          continue
        }
        
        // 如果指定了slideIds，过滤slides
        let slides = document.slides || []
        if (slideIds.length > 0) {
          slides = slides.filter(slide => slideIds.includes(slide.id))
          console.log(`[批量获取] 文档 ${documentId}，过滤后幻灯片数量:`, slides.length)
        }
        
        // 构建返回数据
        results.push({
          documentId,
          metadata: {
            id: document.id,
            name: document.name,
            tag: document.tag,
            customerName: document.customerName,
            product: document.product,
            industry: document.industry,
            audience: document.audience,
            language: document.language,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
          },
          documentData: {
            title: document.title,
            width: document.width,
            height: document.height,
            theme: document.theme,
            slides // 使用过滤后的slides
          }
        })
        
      } catch (itemError) {
        console.error(`[批量获取] 获取文档 ${documentId} 失败:`, itemError)
        results.push({
          documentId,
          error: itemError.message || '获取失败'
        })
      }
    }
    
    console.log('[批量获取] 批量获取完成，成功:', results.filter(r => !r.error).length, 
                '失败:', results.filter(r => r.error).length)
    
    res.json({
      success: true,
      data: results
    })
    
  } catch (error) {
    console.error('[批量获取] 批量获取失败:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || '批量获取失败' 
    })
  }
})

export default router

