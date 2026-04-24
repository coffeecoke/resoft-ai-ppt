/**
 * 售前交流综合分析路由
 * 提供售前对话分析相关的API接口
 */

const express = require('express')
const prisma = require('../utils/prisma')
const presalesAnalysisService = require('../services/presalesAnalysisService')
const logger = require('../utils/logger')

const router = express.Router()

/**
 * POST /api/presales-analysis/analyze
 * 对提供的对话内容进行综合分析
 * 
 * @body {string|Array} dialogueContent - 对话内容（字符串或对话数组）
 * @body {string} [modelId] - 模型ID（可选，不传则使用默认模型）
 * @body {string} [promptCode] - 提示词代码（可选，不传则使用默认提示词）
 * @body {Object} [metadata] - 元数据（可选）
 */
router.post('/analyze', async (req, res) => {
  try {
    const { dialogueContent, modelId, promptCode, metadata } = req.body

    if (!dialogueContent) {
      return res.status(400).json({
        success: false,
        error: '对话内容不能为空'
      })
    }

    logger.info('收到售前交流综合分析请求')

    const result = await presalesAnalysisService.analyzeDialogue(
      dialogueContent,
      {
        modelId,
        promptCode,
        metadata
      }
    )

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    })

  } catch (error) {
    logger.error('售前交流综合分析失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '售前交流综合分析失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * POST /api/presales-analysis/analyze/transcription/:id
 * 对指定转录记录进行综合分析（并保存结果）
 * 
 * @param {string} id - 转录记录ID
 * @body {string} [modelId] - 模型ID（可选，不传则使用默认模型）
 * @body {string} [promptCode] - 提示词代码（可选，不传则使用默认提示词）
 */
router.post('/analyze/transcription/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { modelId, promptCode, prependContent } = req.body

    // 验证转录记录是否存在
    const transcription = await prisma.transcriptions.findUnique({
      where: { id }
    })

    if (!transcription) {
      return res.status(404).json({
        success: false,
        error: '转录记录不存在'
      })
    }

    logger.info(`开始对转录记录进行售前交流分析: ${id}`)

    const startTime = Date.now()
    const result = await presalesAnalysisService.analyzeByTranscriptionId(
      id,
      {
        modelId,
        promptCode,
        prependContent: prependContent || ''
      }
    )

    const analysisTime = Date.now() - startTime

    // 保存分析结果到数据库
    const analysisResultId = await presalesAnalysisService.saveAnalysisResult(
      id,
      result.data,
      {
        modelId,
        promptCode,
        analysisTime,
        dialogueCount: result.metadata?.dialogueCount || 0
      }
    )

    res.json({
      success: true,
      data: result.data,
      metadata: {
        ...result.metadata,
        analysisResultId,
        analysisTime
      }
    })

  } catch (error) {
    logger.error('售前交流综合分析失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '售前交流综合分析失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * GET /api/presales-analysis/results/transcription/:id
 * 获取指定转录记录的分析结果
 * 
 * @param {string} id - 转录记录ID
 */
router.get('/results/transcription/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await presalesAnalysisService.getAnalysisResult(id)

    if (!result) {
      return res.status(404).json({
        success: false,
        error: '未找到分析结果'
      })
    }

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('获取分析结果失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取分析结果失败'
    })
  }
})

/**
 * GET /api/presales-analysis/transcriptions
 * 获取已完成转录、合并和角色设置的转录记录列表
 */
router.get('/transcriptions', async (req, res) => {
  try {
    const { page = 1, pageSize = 20 } = req.query

    const result = await presalesAnalysisService.getAvailableTranscriptions({
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    })

    res.json({
      success: true,
      data: result
    })

  } catch (error) {
    logger.error('获取转录记录列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取转录记录列表失败'
    })
  }
})

/**
 * POST /api/presales-analysis/analyze/session/:id
 * 对指定会话进行综合分析（包含该会话下的所有转录记录）
 * 
 * @param {string} id - 会话ID
 * @body {string} [modelId] - 模型ID（可选）
 * @body {string} [promptCode] - 提示词代码（可选）
 */
router.post('/analyze/session/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { modelId, promptCode } = req.body

    // 验证会话是否存在
    const session = await prisma.sessions.findUnique({
      where: { id }
    })

    if (!session) {
      return res.status(404).json({
        success: false,
        error: '会话不存在'
      })
    }

    logger.info(`开始对会话进行售前交流分析: ${id}`)

    const result = await presalesAnalysisService.analyzeBySessionId(
      id,
      {
        modelId,
        promptCode
      }
    )

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata
    })

  } catch (error) {
    logger.error('售前交流综合分析失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '售前交流综合分析失败',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

/**
 * POST /api/presales-analysis/analyze/stream
 * 流式分析（SSE）
 * 对提供的对话内容进行综合分析，使用流式返回结果
 * 
 * @body {string|Array} dialogueContent - 对话内容
 * @body {string} [modelId] - 模型ID（可选）
 * @body {string} [promptCode] - 提示词代码（可选）
 */
router.post('/analyze/stream', async (req, res) => {
  try {
    const { dialogueContent, modelId, promptCode, metadata } = req.body

    if (!dialogueContent) {
      return res.status(400).json({
        success: false,
        error: '对话内容不能为空'
      })
    }

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    // 发送开始事件
    res.write(`data: ${JSON.stringify({
      type: 'start',
      message: '开始分析...'
    })}\n\n`)

    try {
      // 格式化对话内容
      let formattedDialogue = ''
      if (Array.isArray(dialogueContent)) {
        formattedDialogue = dialogueContent.map((item, index) => {
          const speaker = item.speaker || item.role || '参与者'
          const content = item.content || item.text || ''
          const time = item.time ? ` [${item.time}]` : ''
          return `${speaker}${time}：${content}`
        }).join('\n\n')
      } else {
        formattedDialogue = dialogueContent
      }

      // 构建提示词变量
      const variables = {
        dialogueContent: formattedDialogue,
        metadata: metadata ? JSON.stringify(metadata, null, 2) : ''
      }

      // 构建提示词配置
      let promptConfig
      if (promptCode) {
        promptConfig = {
          code: promptCode,
          variables
        }
      } else {
        promptConfig = {
          variables: {
            ...variables,
            dialogueContent: formattedDialogue
          }
        }
      }

      // 调用AI进行流式分析
      const aiService = require('../services/aiServiceUnified')
      let fullContent = ''
      
      await aiService.chatStream(
        'presales_analysis',
        promptConfig,
        (chunk) => {
          fullContent += chunk
          res.write(`data: ${JSON.stringify({
            type: 'chunk',
            content: chunk
          })}\n\n`)
        },
        {
          modelId,
          temperature: 0.7,
          max_tokens: 4000
        }
      )

      // 尝试解析完整结果
      let analysisResult = null
      try {
        const jsonMatch = fullContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        // 解析失败，继续返回原始内容
      }

      // 发送完成事件
      res.write(`data: ${JSON.stringify({
        type: 'complete',
        message: '分析完成',
        result: analysisResult,
        rawContent: fullContent
      })}\n\n`)

      res.end()

    } catch (error) {
      logger.error('流式分析失败:', error)
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: error.message
      })}\n\n`)
      res.end()
    }

  } catch (error) {
    logger.error('售前交流综合分析（流式）失败:', error)
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: error.message || '售前交流综合分析失败'
      })
    } else {
      res.end()
    }
  }
})

/**
 * GET /api/presales-analysis/test
 * 测试路由
 */
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: '售前交流综合分析路由正常工作',
    timestamp: new Date().toISOString()
  })
})

module.exports = router

