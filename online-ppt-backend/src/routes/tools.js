import { Router } from 'express'
import aiService from '../services/aiService.js'
import { buildOutlineMessages } from '../prompts/outlinePrompt.js'
import { buildAIPPTMessages } from '../prompts/aipptPrompt.js'

const router = Router()

/**
 * API 1: 大纲生成
 * 
 * POST /tools/aippt_outline
 * 
 * Request Body:
 * {
 *   "content": "PPT主题",
 *   "language": "中文",
 *   "model": "GLM-4.5-Flash",
 *   "stream": true
 * }
 * 
 * Response: 流式返回Markdown格式大纲
 */
router.post('/aippt_outline', async (req, res) => {
  try {
    const { content, language = '中文', model = 'GLM-4.5-Flash', stream = true } = req.body

    if (!content) {
      return res.status(400).json({ error: '请提供PPT主题' })
    }

    console.log(`[大纲生成] 主题: ${content}, 模型: ${model}, 语言: ${language}`)

    // 构建消息（传入模型名称以支持兼容性处理）
    const messages = buildOutlineMessages(content, language, model)

    if (stream) {
      // 流式响应
      await aiService.createStreamResponse(model, messages, res, {
        temperature: 0.7,
        maxTokens: 4096
      })
    } else {
      // 非流式响应
      const result = await aiService.chat(model, messages, {
        temperature: 0.7,
        maxTokens: 4096
      })
      res.json({ content: result })
    }

  } catch (error) {
    console.error('[大纲生成] 错误:', error)
    res.status(500).json({ error: error.message || 'AI服务调用失败' })
  }
})

/**
 * API 2: PPT生成
 * 
 * POST /tools/aippt
 * 
 * Request Body:
 * {
 *   "content": "Markdown大纲内容",
 *   "language": "中文",
 *   "style": "通用",
 *   "model": "GLM-4.5-Flash",
 *   "stream": true
 * }
 * 
 * Response: 流式返回AIPPTSlide JSON（每行一个JSON对象）
 */
router.post('/aippt', async (req, res) => {
  try {
    const { 
      content, 
      language = '中文', 
      style = '通用',
      model = 'GLM-4.5-Flash', 
      stream = true 
    } = req.body

    if (!content) {
      return res.status(400).json({ error: '请提供大纲内容' })
    }

    console.log(`[PPT生成] 模型: ${model}, 语言: ${language}, 风格: ${style}`)

    // 构建消息（传入模型名称以支持兼容性处理）
    const messages = buildAIPPTMessages(content, language, style, model)

    if (stream) {
      // 流式响应（PPT生成需要过滤JSON，只输出有效的JSON行）
      await aiService.createStreamResponse(model, messages, res, {
        temperature: 0.7,
        maxTokens: 8192,
        filterJson: true // 启用JSON过滤，确保只输出有效的JSON行
      })
    } else {
      // 非流式响应
      const result = await aiService.chat(model, messages, {
        temperature: 0.7,
        maxTokens: 8192
      })
      res.json({ content: result })
    }

  } catch (error) {
    console.error('[PPT生成] 错误:', error)
    res.status(500).json({ error: error.message || 'AI服务调用失败' })
  }
})

/**
 * API 3: AI写作（可选，用于文本润色/扩写/缩写）
 * 
 * POST /tools/ai_writing
 */
router.post('/ai_writing', async (req, res) => {
  try {
    const { content, command, model = 'GLM-4.5-Flash', stream = true } = req.body

    if (!content || !command) {
      return res.status(400).json({ error: '请提供内容和指令' })
    }

    const commandMap = {
      'rewrite': '请重写以下内容，使其更加专业和流畅：',
      'expand': '请扩展以下内容，添加更多细节和说明：',
      'abbreviate': '请精简以下内容，保留核心要点：',
      'polish': '请润色以下内容，使其更加通顺和有吸引力：'
    }

    const systemPrompt = '你是一位专业的文案写作助手，擅长文本润色、扩写和精简。'
    const userPrompt = `${commandMap[command] || command}\n\n${content}`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    if (stream) {
      await aiService.createStreamResponse(model, messages, res)
    } else {
      const result = await aiService.chat(model, messages)
      res.json({ content: result })
    }

  } catch (error) {
    console.error('[AI写作] 错误:', error)
    res.status(500).json({ error: error.message || 'AI服务调用失败' })
  }
})

/**
 * 获取支持的模型列表
 */
router.get('/models', (req, res) => {
  const models = [
    { value: 'GLM-4.5-Flash', label: 'GLM-4.5-Flash (智谱)', provider: '智谱AI' },
    { value: 'GLM-4-Flash', label: 'GLM-4-Flash (智谱)', provider: '智谱AI' },
    { value: 'GLM-4-Plus', label: 'GLM-4-Plus (智谱)', provider: '智谱AI' },
    { value: 'ark-doubao-seed-1.6-flash', label: 'Doubao-Seed-1.6-flash (豆包)', provider: '字节跳动' },
    { value: 'qwen-turbo', label: 'Qwen-Turbo (通义千问)', provider: '阿里云' },
    { value: 'qwen-plus', label: 'Qwen-Plus (通义千问)', provider: '阿里云' },
    { value: 'deepseek-chat', label: 'DeepSeek-Chat', provider: 'DeepSeek' },
    { value: 'moonshot-v1-8k', label: 'Moonshot-v1-8k (Kimi)', provider: '月之暗面' },
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini (OpenAI)', provider: 'OpenAI' },
    { value: 'gpt-4o', label: 'GPT-4o (OpenAI)', provider: 'OpenAI' },
  ]
  res.json(models)
})

export default router
