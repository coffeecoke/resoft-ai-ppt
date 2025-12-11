import { Router } from 'express'
import multer from 'multer'
import aiService from '../services/aiService.js'
import wordService from '../services/wordService.js'
import slotService from '../services/slotService.js'
import { buildOutlineMessages } from '../prompts/outlinePrompt.js'
import { buildWordOutlineMessages } from '../prompts/wordOutlinePrompt.js'
import { buildAIPPTMessages } from '../prompts/aipptPrompt.js'
import { buildTemplateFillMessages } from '../prompts/templateFillPrompt.js'

const router = Router()

// 配置multer用于文件上传
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024 // 限制10MB
  },
  fileFilter: (req, file, cb) => {
    // 只允许.docx文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname.endsWith('.docx')) {
      cb(null, true)
    } else {
      cb(new Error('只支持.docx格式的Word文档'))
    }
  }
})

/**
 * API 0: Word文档解析
 * 
 * POST /tools/parse_word
 * Content-Type: multipart/form-data
 * 
 * Request:
 *   - file: Word文件 (.docx)
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "title": "文档标题",
 *     "text": "纯文本内容",
 *     "markdown": "Markdown格式内容",
 *     "wordCount": 3500
 *   }
 * }
 */
router.post('/parse_word', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '请上传Word文件' 
      })
    }

    console.log(`[Word解析] 文件: ${req.file.originalname}, 大小: ${req.file.size} bytes`)

    // 解析Word文档
    const result = await wordService.parseWord(req.file.path)

    // 删除临时文件
    await wordService.deleteFile(req.file.path)

    console.log(`[Word解析] 完成, 标题: ${result.title}, 字数: ${result.wordCount}`)

    res.json({ 
      success: true, 
      data: result 
    })

  } catch (error) {
    console.error('[Word解析] 错误:', error)
    
    // 尝试删除临时文件
    if (req.file) {
      await wordService.deleteFile(req.file.path)
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || '文档解析失败' 
    })
  }
})

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
 *   "stream": true,
 *   "source": "word",           // 可选，来源标识：topic(默认) | word
 *   "wordContent": {            // source为word时必填
 *     "title": "文档标题",
 *     "text": "文档文本",
 *     "markdown": "文档Markdown"
 *   }
 * }
 * 
 * Response: 流式返回Markdown格式大纲
 */
router.post('/aippt_outline', async (req, res) => {
  try {
    const { 
      content, 
      language = '中文', 
      model = 'GLM-4.5-Flash', 
      stream = true,
      source,        // 新增：来源标识
      wordContent    // 新增：Word文档内容
    } = req.body

    if (!content) {
      return res.status(400).json({ error: '请提供PPT主题' })
    }

    // 根据来源选择不同的Prompt
    let messages
    if (source === 'word' && wordContent) {
      // Word模式：基于文档内容生成大纲
      console.log(`[大纲生成] Word模式, 主题: ${content}, 模型: ${model}, 文档字数: ${wordContent.wordCount || '未知'}`)
      messages = buildWordOutlineMessages(content, wordContent, language, model)
    } else {
      // 主题模式：纯主题生成大纲
      console.log(`[大纲生成] 主题模式, 主题: ${content}, 模型: ${model}, 语言: ${language}`)
      messages = buildOutlineMessages(content, language, model)
    }

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

// ============ 方案D：模板填充相关接口 ============

/**
 * API 4: 提取模板槽位
 * 
 * POST /tools/extract_slots
 * 
 * Request Body:
 * {
 *   "slides": [...] // PPT模板的slides数组
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "totalPages": 6,
 *     "totalSlots": 25,
 *     "structure": [...],  // 结构摘要
 *     "slots": [...]       // 详细槽位列表
 *   }
 * }
 */
router.post('/extract_slots', async (req, res) => {
  try {
    const { slides } = req.body

    if (!slides || !Array.isArray(slides)) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供有效的模板slides数组' 
      })
    }

    console.log(`[槽位提取] 开始提取, 页面数: ${slides.length}`)

    // 提取槽位
    const result = slotService.extractSlots(slides)

    console.log(`[槽位提取] 完成, 总槽位数: ${result.totalSlots}`)

    res.json({ 
      success: true, 
      data: result 
    })

  } catch (error) {
    console.error('[槽位提取] 错误:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || '槽位提取失败' 
    })
  }
})

/**
 * API 5: 生成模板填充内容
 * 
 * POST /tools/generate_fill_content
 * 
 * Request Body:
 * {
 *   "slots": {...},           // extractSlots返回的数据
 *   "topic": "PPT主题",
 *   "wordContent": "参考文档内容（可选）",
 *   "model": "GLM-4.5-Flash"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "slot_id_1": "生成的内容1",
 *     "slot_id_2": "生成的内容2",
 *     ...
 *   }
 * }
 */
router.post('/generate_fill_content', async (req, res) => {
  try {
    const { 
      slots, 
      topic, 
      wordContent = '',
      model = 'GLM-4.5-Flash' 
    } = req.body

    if (!slots || !topic) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供槽位信息和主题' 
      })
    }

    const BATCH_SIZE = 50  // 每批处理的槽位数
    const totalSlots = slots.totalSlots

    console.log(`[内容生成] 主题: ${topic}, 模型: ${model}, 总槽位数: ${totalSlots}`)

    // 如果槽位数较少，直接处理
    if (totalSlots <= BATCH_SIZE) {
      const contentMap = await generateContentForSlots(slots, topic, wordContent, model)
      return res.json({ success: true, data: contentMap })
    }

    // 槽位数较多，分批处理
    console.log(`[内容生成] 槽位较多，启用分批处理模式，每批 ${BATCH_SIZE} 个`)
    
    const batches = slotService.splitSlotsByPage(slots, BATCH_SIZE)
    console.log(`[内容生成] 分成 ${batches.length} 批处理`)

    let allContentMap = {}
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`[内容生成] 处理第 ${i + 1}/${batches.length} 批，槽位数: ${batch.totalSlots}`)
      
      try {
        const batchContent = await generateContentForSlots(batch, topic, wordContent, model, {
          batchIndex: i + 1,
          totalBatches: batches.length,
          previousContent: allContentMap  // 传递已生成的内容，保持连贯性
        })
        
        // 合并结果
        allContentMap = { ...allContentMap, ...batchContent }
        console.log(`[内容生成] 第 ${i + 1} 批完成，累计生成: ${Object.keys(allContentMap).length} 个槽位`)
      } catch (batchError) {
        console.error(`[内容生成] 第 ${i + 1} 批失败:`, batchError)
        // 继续处理下一批，不中断整个流程
      }
    }

    console.log(`[内容生成] 全部完成，共生成: ${Object.keys(allContentMap).length} 个槽位`)

    res.json({ 
      success: true, 
      data: allContentMap 
    })

  } catch (error) {
    console.error('[内容生成] 错误:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || '内容生成失败' 
    })
  }
})

/**
 * 为一批槽位生成内容
 */
async function generateContentForSlots(slots, topic, wordContent, model, options = {}) {
  const { batchIndex, totalBatches, previousContent } = options
  
  // 生成结构描述
  let structurePrompt = slotService.generateStructurePrompt(slots)
  
  // 如果是分批处理，添加上下文信息
  if (batchIndex && totalBatches) {
    structurePrompt = `【分批处理】这是第 ${batchIndex}/${totalBatches} 批内容\n\n` + structurePrompt
    
    // 如果有之前的内容，添加摘要以保持连贯性
    if (previousContent && Object.keys(previousContent).length > 0) {
      const prevSummary = Object.entries(previousContent)
        .slice(-5)  // 只取最后5个作为参考
        .map(([id, text]) => `${id}: ${String(text).substring(0, 30)}...`)
        .join('\n')
      structurePrompt += `\n\n【已生成内容参考】\n${prevSummary}\n\n请保持内容风格一致。`
    }
  }

  // 构建消息
  const messages = buildTemplateFillMessages(structurePrompt, topic, wordContent, model)

  // 调用AI生成内容
  const result = await aiService.chat(model, messages, {
    temperature: 0.7,
    maxTokens: 8192
  })

  // 解析AI返回的JSON
  let contentMap = {}
  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      contentMap = JSON.parse(jsonMatch[0])
    } else {
      throw new Error('未找到有效的JSON')
    }
  } catch (parseError) {
    console.error('[内容生成] JSON解析失败:', parseError)
    console.error('[内容生成] AI原始返回:', result.substring(0, 500))
    throw new Error('AI返回内容解析失败')
  }

  return contentMap
}

/**
 * API 6: 填充模板
 * 
 * POST /tools/fill_template
 * 
 * Request Body:
 * {
 *   "slides": [...],          // 原始模板slides
 *   "contentMap": {...}       // 槽位内容映射
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "slides": [...]         // 填充后的slides
 *   }
 * }
 */
router.post('/fill_template', async (req, res) => {
  try {
    const { slides, contentMap } = req.body

    if (!slides || !Array.isArray(slides)) {
      return res.status(400).json({ 
        success: false, 
        error: '请提供有效的模板slides数组' 
      })
    }

    if (!contentMap || typeof contentMap !== 'object') {
      return res.status(400).json({ 
        success: false, 
        error: '请提供有效的内容映射' 
      })
    }

    console.log(`[模板填充] 开始填充, 页面数: ${slides.length}, 内容数: ${Object.keys(contentMap).length}`)

    // 填充模板
    const filledSlides = slotService.fillTemplate(slides, contentMap)

    console.log(`[模板填充] 完成`)

    res.json({ 
      success: true, 
      data: {
        slides: filledSlides
      }
    })

  } catch (error) {
    console.error('[模板填充] 错误:', error)
    res.status(500).json({ 
      success: false, 
      error: error.message || '模板填充失败' 
    })
  }
})

export default router
