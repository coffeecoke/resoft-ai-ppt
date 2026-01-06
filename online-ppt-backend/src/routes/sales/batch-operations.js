import { Router } from 'express'
import { PrismaClient } from '@prisma/client'
import aiService from '../../services/aiService.js'
import { createSlideAnalysisPrompt } from '../../prompts/slideAnalysisPrompt.js'

const router = Router()
const prisma = new PrismaClient()

/**
 * 批量AI分析接口
 * POST /api/sales/batch-operations/analyze
 * 
 * 功能：
 * 1. 支持批量分析多个文档的多个幻灯片
 * 2. 流式返回分析结果，按itemIndex区分
 * 3. 每个item独立分析，互不影响
 * 
 * Request Body:
 * {
 *   items: [
 *     {
 *       documentId: 'doc_xxx',
 *       slideIds: ['slide_1', 'slide_2'], // 可选，为空则分析整个文档
 *       title: 'PPT标题 - 第1页' // 用于结果标识
 *     }
 *   ]
 * }
 * 
 * Response: SSE流式返回
 * data: {"type": "start", "itemIndex": 0, "title": "PPT1"}
 * data: {"type": "content", "itemIndex": 0, "content": "分析结果..."}
 * data: {"type": "end", "itemIndex": 0}
 * data: {"type": "start", "itemIndex": 1, "title": "PPT2"}
 * ...
 * data: {"type": "complete"}
 */
router.post('/analyze', async (req, res) => {
  try {
    const { items } = req.body
    
    // 验证参数
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供要分析的项目列表' 
      })
    }
    
    console.log('[批量分析] 开始批量分析，项目数量:', items.length)
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    // 发送SSE数据的辅助函数
    const sendSSE = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    
    // 遍历每个项目进行分析
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const { documentId, slideIds = [], title = '' } = item
      
      try {
        // 发送开始信号
        sendSSE({
          type: 'start',
          itemIndex: i,
          title: title || `项目${i + 1}`,
          documentId,
          slideIds
        })
        
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
          sendSSE({
            type: 'error',
            itemIndex: i,
            title: title || `项目${i + 1}`,
            error: '文档不存在'
          })
          sendSSE({
            type: 'end',
            itemIndex: i
          })
          continue
        }
        
        // 2. 查询幻灯片内容
        const whereClause = {
          document_id: documentId
        }
        
        // 如果指定了slideIds，则只查询这些幻灯片
        if (slideIds.length > 0) {
          whereClause.slide_id = { in: slideIds }
        }
        
        const slideContents = await prisma.slide_merged_contents.findMany({
          where: whereClause,
          select: {
            merged_content: true,
            slide_order: true,
            slide_id: true
          },
          orderBy: { slide_order: 'asc' }
        })
        
        if (!slideContents || slideContents.length === 0) {
          sendSSE({
            type: 'error',
            itemIndex: i,
            title: title || `项目${i + 1}`,
            error: '幻灯片内容为空'
          })
          sendSSE({
            type: 'end',
            itemIndex: i
          })
          continue
        }
        
        console.log(`[批量分析] 项目${i + 1}，查询到幻灯片数量:`, slideContents.length)
        
        // 3. 拼接文本内容
        const documentText = slideContents
          .map((slide) => {
            const content = slide.merged_content || ''
            return `【第${slide.slide_order}页】\n${content.trim()}`
          })
          .join('\n\n')
        
        // 4. 限制文本长度
        const MAX_TEXT_LENGTH = 15000
        let finalText = documentText
        if (documentText.length > MAX_TEXT_LENGTH) {
          console.log(`[批量分析] 项目${i + 1}文本过长，截断至`, MAX_TEXT_LENGTH, '字符')
          finalText = documentText.substring(0, MAX_TEXT_LENGTH) + 
                      '\n\n【注：内容过长，仅分析前' + Math.floor(MAX_TEXT_LENGTH / 1000) + 'K字符】'
        }
        
        // 5. 构建Prompt
        const prompt = createSlideAnalysisPrompt(finalText, {
          name: document.name,
          slideCount: document.slide_count,
          analyzedPageCount: slideContents.length,
          pageNumbers: slideContents.map(s => s.slide_order)
        })
        
        // 6. 调用AI生成分析（流式返回）
        const modelName = 'ark-doubao-seed-1.6-flash'
        const messages = [
          {
            role: 'user',
            content: prompt
          }
        ]
        
        // 使用chatStream方法，手动发送SSE
        let accumulatedContent = ''
        
        await aiService.chatStream(
          modelName,
          messages,
          (chunk) => {
            // 每收到一个chunk，立即发送到SSE
            accumulatedContent += chunk
            sendSSE({
              type: 'content',
              itemIndex: i,
              content: chunk
            })
          },
          {
            temperature: 0.7,
            maxTokens: 1500
          }
        )
        
        // 分析完成
        sendSSE({
          type: 'end',
          itemIndex: i,
          totalContent: accumulatedContent
        })
        
        console.log(`[批量分析] 项目${i + 1}分析完成`)
        
      } catch (itemError) {
        console.error(`[批量分析] 项目${i + 1}分析失败:`, itemError)
        sendSSE({
          type: 'error',
          itemIndex: i,
          title: title || `项目${i + 1}`,
          error: itemError.message || '分析失败'
        })
        sendSSE({
          type: 'end',
          itemIndex: i
        })
      }
    }
    
    // 发送完成信号
    sendSSE({
      type: 'complete'
    })
    
    res.end()
    
    console.log('[批量分析] 批量分析全部完成')
    
  } catch (error) {
    console.error('[批量分析] 批量分析失败:', error)
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: error.message || '批量分析失败' 
      })
    } else {
      res.end()
    }
  }
})

export default router

