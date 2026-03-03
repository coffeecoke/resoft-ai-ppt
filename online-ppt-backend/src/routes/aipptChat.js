/**
 * PPT智能对话路由
 * 
 * 提供对话式PPT编辑能力：
 * - 更换样式
 * - 续写一页
 * - 更换配图
 * - 增减内容
 * - 通用AI对话
 */

import express from 'express'
import { classifyIntent, getLimitMessage, getActionGuide, parseContinueTopic, parsePolishIntent } from '../services/intentService.js'
import { imageService } from '../services/imageService.js'
import aiService from '../services/aiService.js'
import { getModelConfig } from '../config/models.js'

const router = express.Router()

// 配置：减少内容时是否使用AI智能选择
// true: 使用AI分析哪些要点重要，智能选择保留
// false: 直接删除最后一项（简单、快速、可预期）
const USE_AI_FOR_DECREASE = false

/**
 * 智能对话接口
 * 
 * POST /aippt/chat
 * 
 * Request:
 * {
 *   message: "用户输入",
 *   context: {
 *     currentSlide: {...},      // 当前选中的页面
 *     slideIndex: 2,            // 当前页索引
 *     totalSlides: 10,          // 总页数
 *     topic: "年度工作汇报",    // PPT主题
 *     slides: [...]             // 所有幻灯片（用于续写时的上下文）
 *   },
 *   history: [...],             // 对话历史
 *   model: "deepseek"           // 使用的模型
 * }
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, context = {}, history = [], model = 'deepseek-chat', scope, requirement, polishContext } = req.body
    
    // 【调试】打印请求参数
    console.log('[aipptChat] 收到请求:', {
      message: message?.substring(0, 50),
      scope,
      requirement,
      hasPolishContext: !!polishContext,
      polishContextKeys: polishContext ? Object.keys(polishContext) : []
    })
    
    if (!message) {
      return res.json({
        success: false,
        error: '请输入内容'
      })
    }
    
    // 0. 优先检查续写话术（特殊格式优先处理）
    const continueTopic = parseContinueTopic(message) || context.continueWriteTopic
    if (continueTopic) {
      console.log(`[对话] 续写话术识别: ${continueTopic}`)
      return handleContinueWrite({ ...context, topic: continueTopic }, model, res)
    }
    
    // 【修改】0.5. 优先检查润色意图（特殊格式优先处理）
    const polishIntent = parsePolishIntent(message)
    console.log('[aipptChat] 润色意图识别:', polishIntent)
    
    if (polishIntent.isPolish) {
      // 文本编辑模式：有 polishContext
      if (polishContext) {
        console.log(`[对话] 文本编辑润色: elementId=${polishContext.elementId}, hasSelection=${polishContext.hasSelection}`)
        return handleTextEditingPolish(context, polishContext, requirement || polishIntent.requirement, model, res)
      }
      // 范围选择模式：有 scope
      else if (scope) {
        console.log(`[对话] 范围选择润色: scope=${scope}, requirement=${requirement || 'default'}`)
        return handleSmartPolish(context, scope, requirement || polishIntent.requirement, model, res)
      }
    }
    
    // 1. 意图识别
    const intent = classifyIntent(message)
    console.log(`[对话] 意图识别: ${intent.type}`, intent.action || intent.limit || '')
    
    // 2. 根据意图分流处理
    switch (intent.type) {
      case 'edit':
        return handleEditIntent(intent.action, message, context, model, res)
        
      case 'query':
        return handleQueryIntent(message, context, model, res)
        
      case 'limit':
        return res.json({
          success: true,
          type: 'limit',
          message: getLimitMessage(intent.limit)
        })
        
      case 'chat':
      default:
        return handleChatIntent(message, context, history, model, res)
    }
  } catch (error) {
    console.error('[对话] 错误:', error)
    res.status(500).json({
      success: false,
      error: error.message || '处理失败'
    })
  }
})

/**
 * 处理编辑意图
 */
async function handleEditIntent(action, message, context, model, res) {
  const guide = getActionGuide(action)
  
  switch (action) {
    case 'change_style':
      // 返回指令让前端处理（前端有模板数据）
      // 注意：itemCount 由前端计算更准确，因为需要遍历元素判断textType
      return res.json({
        success: true,
        type: 'edit',
        action: 'change_style',
        message: guide,
        data: {
          slideType: context.currentSlide?.type || 'content',
          // itemCount 由前端计算，这里只返回简单估算
          itemCount: getItemCount(context.currentSlide)
        }
      })
      
    case 'continue_write':
      return handleContinueWrite(context, model, res)
      
    case 'change_image':
      return handleChangeImage(context, res)
      
    case 'adjust_content':
      return handleAdjustContent(message, context, model, res)
      
    default:
      return res.json({
        success: true,
        type: 'edit',
        action,
        message: guide
      })
  }
}

/**
 * 续写一页
 * 
 * 根据用户输入的主题生成 3-4 个要点
 * 前端负责匹配模板并插入页面
 */
async function handleContinueWrite(context, model, res) {
  try {
    const { topic, slideIndex, slides = [] } = context
    
    if (!topic) {
      return res.json({
        success: false,
        error: '请提供要续写的主题内容'
      })
    }
    
    console.log(`[续写] 主题: ${topic}`)
    
    // 构建上下文信息
    let contextInfo = ''
    if (slides.length > 0 && slideIndex !== undefined) {
      const prevSlides = slides.slice(Math.max(0, slideIndex - 2), slideIndex + 1)
      if (prevSlides.length > 0) {
        contextInfo = '\n\n参考前面页面的风格：\n'
        prevSlides.forEach((slide, i) => {
          // 尝试提取页面标题
          const title = extractSlideTitle(slide)
          if (title) {
            contextInfo += `- ${title}\n`
          }
        })
      }
    }
    
    // 判断是简短主题还是大段内容
    const isLongContent = topic.length > 50 || topic.includes('\n')
    
    const systemPrompt = `你是一个PPT内容生成专家。${isLongContent ? '用户提供了一段参考内容，你需要从中提取' : '用户要在PPT中插入一页关于某主题的内容，你需要生成'} 3-4 个核心要点。

${isLongContent ? '**重要**：不要直接使用原文，而是要提炼、概括、精简成适合PPT展示的要点。' : ''}

你需要生成：
- pageTitle: 这一页的标题（5-15字，概括本页核心主题）
- items: 3-4 个核心要点，每个包含：
  - title: 简洁有力的标题（5-10字）
  - text: 精炼的说明（15-30字）
${contextInfo}

请严格按照以下JSON格式返回，不要有其他内容：
{"pageTitle":"本页标题","items":[{"title":"要点1标题","text":"要点1简短说明"},{"title":"要点2标题","text":"要点2简短说明"},{"title":"要点3标题","text":"要点3简短说明"}]}

注意：
1. pageTitle 要简洁概括本页主题（5-15字），不要直接使用原文
2. 生成 3-4 个要点（根据内容复杂度决定）
3. 要点标题要简洁有力（5-10字）
4. 要点说明要精炼专业（15-30字）
5. ${isLongContent ? '必须提炼概括，不要直接复制原文' : '内容要准确专业'}
6. 只返回JSON，不要有markdown代码块或其他文字`

    const userPrompt = isLongContent 
      ? `请从以下内容中提取页面标题和 3-4 个核心要点：\n\n${topic}`
      : `请为"${topic}"生成PPT页面标题和要点内容`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]
    
    const result = await aiService.chat(model, messages, {
      temperature: 0.7,
      maxTokens: isLongContent ? 800 : 1024  // 大段内容时限制token，避免AI啰嗦
    })
    
    console.log('[续写] AI返回:', result)
    
    // 解析JSON
    let itemsData = null
    try {
      // 尝试直接解析
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        itemsData = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('[续写] JSON解析失败:', e)
    }
    
    if (!itemsData || !itemsData.items || !Array.isArray(itemsData.items)) {
      return res.json({
        success: false,
        error: '生成内容解析失败，请重试'
      })
    }
    
    // 确保每个 item 都有 title 和 text
    const items = itemsData.items.map(item => ({
      title: item.title || '',
      text: item.text || item.description || ''
    })).filter(item => item.title) // 过滤掉没有标题的
    
    if (items.length === 0) {
      return res.json({
        success: false,
        error: '未能生成有效内容，请重试'
      })
    }
    
    // 提取页面标题，如果 AI 没有生成则使用截取的 topic
    const pageTitle = itemsData.pageTitle || (topic.length > 15 ? topic.slice(0, 15) + '...' : topic)
    
    return res.json({
      success: true,
      type: 'edit',
      action: 'continue_write',
      message: `已为您生成 ${items.length} 个要点`,
      data: {
        topic,
        pageTitle,  // 新增：AI提炼的页面标题
        items
      }
    })
  } catch (error) {
    console.error('[续写] 错误:', error)
    return res.json({
      success: false,
      error: '续写失败：' + error.message
    })
  }
}

/**
 * 从 slide 中提取标题
 */
function extractSlideTitle(slide) {
  if (!slide) return null
  
  // 尝试从 data.title 获取
  if (slide.data?.title) return slide.data.title
  
  // 尝试从 elements 中提取
  if (slide.elements && Array.isArray(slide.elements)) {
    for (const el of slide.elements) {
      if (el.type === 'text' && el.textType === 'title') {
        return el.content?.replace(/<[^>]*>/g, '').trim()
      }
      if (el.type === 'shape' && el.text?.type === 'title') {
        return el.text.content?.replace(/<[^>]*>/g, '').trim()
      }
    }
  }
  
  return null
}

/**
 * 更换配图
 */
async function handleChangeImage(context, res) {
  const { currentSlide } = context
  
  // 检查API是否可用
  if (!imageService.isAvailable()) {
    return res.json({
      success: true,
      type: 'edit',
      action: 'change_image',
      message: '图片搜索服务未配置，请设置 UNSPLASH_ACCESS_KEY 或 PEXELS_API_KEY 环境变量',
      data: { images: [], status: imageService.getStatus() }
    })
  }
  
  // 提取关键词
  const keyword = imageService.extractKeywords(currentSlide)
  
  if (!keyword) {
    return res.json({
      success: true,
      type: 'edit',
      action: 'change_image',
      message: '无法从当前页面提取关键词，请手动输入搜索词',
      data: { images: [], keyword: '', needInput: true }
    })
  }
  
  // 搜索图片
  const images = await imageService.searchImages(keyword, {
    count: 4,
    orientation: 'landscape'
  })
  
  return res.json({
    success: true,
    type: 'edit',
    action: 'change_image',
    message: images.length > 0 
      ? '好的，智能助手已为您推荐以下图片，点击更换。'
      : '未找到相关图片，请尝试其他关键词',
    data: {
      images,
      keyword,
      hasMore: images.length >= 4
    }
  })
}

/**
 * 增减内容
 */
async function handleAdjustContent(message, context, model, res) {
  const { currentSlide } = context
  
  // 判断是增加还是减少
  const isIncrease = /增加|加|多|添加/.test(message)
  const isDecrease = /减少|少|删|去掉/.test(message)
  
  const currentItems = getItems(currentSlide)
  const currentCount = currentItems.length
  
  if (currentCount === 0) {
    return res.json({
      success: true,
      type: 'edit',
      action: 'adjust_content',
      message: '当前页面没有可调整的内容项',
      data: { items: [], count: 0 }
    })
  }
  
  let targetCount = currentCount
  let newItems = [...currentItems]
  
  if (isDecrease) {
    // 减少：默认减少1个，最少保留1个
    targetCount = Math.max(1, currentCount - 1)
    
    if (USE_AI_FOR_DECREASE) {
      // 【AI模式】使用AI智能选择保留哪些要点（更智能，但需要AI调用）
      // 使用AI选择保留哪些（更智能）
      if (currentCount > 2) {
        try {
          const selectPrompt = `以下是PPT中的${currentCount}个要点，请选择最重要的${targetCount}个保留。

要点列表：
${currentItems.map((item, i) => `${i + 1}. ${item.title || item}: ${item.text || ''}`).join('\n')}

请只返回要保留的编号，用逗号分隔，如：1,2,3`

          const result = await aiService.chat(model, [
            { role: 'user', content: selectPrompt }
          ], { temperature: 0.3, maxTokens: 100 })
          
          const indices = result.match(/\d+/g)?.map(n => parseInt(n) - 1) || []
          if (indices.length > 0 && indices.length <= targetCount) {
            newItems = indices.map(i => currentItems[i]).filter(Boolean)
            targetCount = newItems.length
          } else {
            // 降级：直接取前面的
            newItems = currentItems.slice(0, targetCount)
          }
        } catch (e) {
          // AI选择失败，直接取前面的
          newItems = currentItems.slice(0, targetCount)
        }
      } else {
        newItems = currentItems.slice(0, targetCount)
      }
    } else {
      // 【简单模式】直接删除最后一项（默认模式）
      // 理由：1. 用户添加的顺序通常代表优先级，最后添加的往往是最不重要的
      //       2. 操作可预期，不会"智能"删除用户认为重要的内容
      //       3. 减少AI调用，提升响应速度
      newItems = currentItems.slice(0, targetCount)
      
      console.log(`[减少内容] 从${currentCount}项减少到${targetCount}项，删除最后${currentCount - targetCount}项（简单模式）`)
    }
  } else if (isIncrease) {
    // 增加：默认增加1个
    targetCount = currentCount + 1
    
    try {
      // 【修复】分析现有内容的风格特征
      const titleLengths = currentItems.map(item => {
        const title = item.title || (typeof item === 'string' ? item : '')
        return title.length
      })
      const textLengths = currentItems.map(item => {
        const text = item.text || ''
        return text.length
      })
      
      const avgTitleLen = titleLengths.length > 0 
        ? Math.round(titleLengths.reduce((a, b) => a + b, 0) / titleLengths.length)
        : 10
      const avgTextLen = textLengths.length > 0
        ? Math.round(textLengths.reduce((a, b) => a + b, 0) / textLengths.length)
        : 15
      
      // 检测是否有特殊格式（百分比、数字、序号等）
      const hasPercentage = currentItems.some(item => {
        const title = item.title || (typeof item === 'string' ? item : '')
        return title.includes('%') || title.match(/[+\-]\d+/) || title.match(/^\d+%$/)
      })
      const hasNumber = currentItems.some(item => {
        const title = item.title || (typeof item === 'string' ? item : '')
        return title.match(/^\d+/) || title.match(/第[一二三四五六七八九十\d]+/)
      })
      
      // 获取第一个项目作为格式示例
      const firstItem = currentItems[0]
      const exampleTitle = firstItem?.title || (typeof firstItem === 'string' ? firstItem : '')
      const exampleText = firstItem?.text || ''
      
      const addPrompt = `你是PPT内容生成专家。用户要在PPT页面中增加一个新的内容项。

【重要】新增内容必须严格遵循现有内容的格式和风格！不要修改原有内容，只在末尾追加新项。

页面标题：${currentSlide?.data?.title || currentSlide?.title || '未知'}

现有内容（共${currentItems.length}项，请保持这些内容不变）：
${currentItems.map((item, i) => {
  const title = item.title || (typeof item === 'string' ? item : '')
  const text = item.text || ''
  return `${i + 1}. title: "${title}" (${title.length}字)\n   text: "${text}" (${text.length}字)`
}).join('\n\n')}

【格式要求】：
1. title字段：约${avgTitleLen}字${hasPercentage ? '，包含数据指标（如百分比、数字，格式与现有项一致）' : hasNumber ? '，保持序号或数字格式' : '，简短精炼'}
2. text字段：约${avgTextLen}字，${avgTextLen < 15 ? '简短说明' : '详细描述'}
3. 风格必须与上述${currentItems.length}项完全一致
4. 内容要与页面主题相关，但不要重复现有要点
5. 保持与现有项相同的语言风格和表达方式

【格式示例参考】：
{"title":"${exampleTitle}","text":"${exampleText}"}

请严格按照以下JSON格式返回，不要有其他内容：
{"title":"[${avgTitleLen}字左右，格式与示例一致]","text":"[${avgTextLen}字左右，风格与示例一致]"}`

      const result = await aiService.chat(model, [
        { role: 'user', content: addPrompt }
      ], { temperature: 0.7, maxTokens: 200 })
      
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const newItem = JSON.parse(jsonMatch[0])
        
        // 【新增】验证新内容的格式是否与现有一致
        const newTitleLen = (newItem.title || '').length
        const newTextLen = (newItem.text || '').length
        
        // 如果长度差异过大，记录警告（但不阻止，因为AI可能生成合理的内容）
        if (Math.abs(newTitleLen - avgTitleLen) > avgTitleLen * 0.8) {
          console.warn(`[增加内容] 新内容title长度(${newTitleLen})与平均值(${avgTitleLen})差异较大，但已接受`)
        }
        if (Math.abs(newTextLen - avgTextLen) > avgTextLen * 0.8) {
          console.warn(`[增加内容] 新内容text长度(${newTextLen})与平均值(${avgTextLen})差异较大，但已接受`)
        }
        
        // 【修复】保持原有内容不变，只在末尾追加新项
        newItems = [...currentItems, newItem]
        targetCount = newItems.length
        
        console.log(`[增加内容] 成功生成新项，保持原有${currentItems.length}项不变，新增1项`)
      } else {
        throw new Error('AI返回的JSON格式无效')
      }
    } catch (e) {
      console.error('[增加内容] 错误:', e)
      return res.json({
        success: false,
        error: '生成新内容失败，请重试'
      })
    }
  }
  
  return res.json({
    success: true,
    type: 'edit',
    action: 'adjust_content',
    message: isDecrease 
      ? `已为您减少内容。该项数下，您也可以选择如下风格样式，点击更换～`
      : `已为您增加内容。该项数下，您也可以选择如下风格样式，点击更换～`,
    data: {
      items: newItems,
      count: targetCount,
      originalCount: currentCount,
      action: isDecrease ? 'decrease' : 'increase',
      slideType: currentSlide?.type || 'content'
    }
  })
}

/**
 * 处理PPT咨询意图
 */
async function handleQueryIntent(message, context, model, res) {
  const { currentSlide, slideIndex, totalSlides, topic } = context
  
  // 构建上下文
  let pptInfo = `PPT信息：
- 主题：${topic || '未设置'}
- 总页数：${totalSlides || '未知'}
- 当前页：第 ${(slideIndex || 0) + 1} 页
- 当前页类型：${currentSlide?.type || '未知'}`
  
  if (currentSlide?.data) {
    pptInfo += `\n- 当前页标题：${currentSlide.data.title || '无'}`
    const items = getItems(currentSlide)
    if (items.length > 0) {
      pptInfo += `\n- 当前页要点数：${items.length}个`
    }
  }
  
  const systemPrompt = `你是一个PPT智能助手。用户正在编辑PPT，请根据PPT信息回答问题。

${pptInfo}

请简洁、准确地回答用户的问题。`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ]
  
  try {
    const result = await aiService.chat(model, messages, {
      temperature: 0.7,
      maxTokens: 500
    })
    
    return res.json({
      success: true,
      type: 'query',
      message: result
    })
  } catch (error) {
    return res.json({
      success: false,
      error: '回答生成失败：' + error.message
    })
  }
}

/**
 * 处理通用聊天意图
 */
async function handleChatIntent(message, context, history, model, res) {
  const { topic, totalSlides, slideIndex } = context
  
  // 构建系统提示词（带PPT上下文）
  const systemPrompt = `你是一个智能助手，名叫"PPT助手"。用户目前正在使用PPT编辑器。

${topic ? `用户正在编辑的PPT主题：${topic}` : ''}
${totalSlides ? `PPT共${totalSlides}页，当前在第${(slideIndex || 0) + 1}页` : ''}

你可以正常回答用户的任何问题。如果用户询问与PPT相关的内容，可以结合上下文回答。
如果发现用户可能需要PPT编辑功能，可以适当引导他们使用"更换样式"、"续写一页"、"更换配图"、"增减内容"等指令。

回复要简洁友好。`

  // 转换历史消息格式
  const historyMessages = history.map(h => ({
    role: h.role,
    content: h.content
  }))
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...historyMessages.slice(-10),  // 只保留最近10条历史
    { role: 'user', content: message }
  ]
  
  // 设置SSE响应头进行流式输出
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  try {
    // 先发送类型标识
    res.write(`data: ${JSON.stringify({ type: 'chat', streaming: true })}\n\n`)
    
    // 流式调用大模型
    await aiService.chatStream(model, messages, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: 'chat', content: chunk })}\n\n`)
    }, {
      temperature: 0.7,
      maxTokens: 2048
    })
    
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
    res.end()
  } catch (error) {
    console.error('[对话] 流式输出错误:', error)
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
    res.end()
  }
}

/**
 * 检查元素是否是指定类型的文本
 */
function checkTextType(el, type) {
  if (!el) return false
  // text 元素
  if (el.type === 'text' && el.textType === type) return true
  // shape 元素中的文本
  if (el.type === 'shape' && el.text?.type === type) return true
  return false
}

/**
 * 获取元素的文本内容
 */
function getElementText(el) {
  if (!el) return ''
  if (el.type === 'text') {
    return el.content?.replace(/<[^>]*>/g, '').trim() || ''
  }
  if (el.type === 'shape' && el.text) {
    return el.text.content?.replace(/<[^>]*>/g, '').trim() || ''
  }
  return ''
}

/**
 * 从 slide 的 elements 中提取 items
 * 
 * 前端的 slide 数据结构是 elements 数组，需要从中提取：
 * - itemTitle 类型的元素作为 title
 * - item 类型的元素作为 text
 */
function extractItemsFromElements(slide) {
  if (!slide?.elements || !Array.isArray(slide.elements)) {
    return []
  }
  
  const elements = slide.elements
  
  // 提取所有 itemTitle 和 item 类型的元素
  const itemTitles = elements
    .filter(el => checkTextType(el, 'itemTitle'))
    .map(el => getElementText(el))
  
  const itemTexts = elements
    .filter(el => checkTextType(el, 'item'))
    .map(el => getElementText(el))
  
  // 如果有 itemTitle，以它为主构建 items
  if (itemTitles.length > 0) {
    return itemTitles.map((title, i) => ({
      title,
      text: itemTexts[i] || ''
    }))
  }
  
  // 否则用 item 类型
  if (itemTexts.length > 0) {
    return itemTexts.map(text => ({
      title: text,
      text: ''
    }))
  }
  
  return []
}

/**
 * 获取页面中的items数量
 */
function getItemCount(slide) {
  if (!slide) return 0
  
  // 优先尝试从 data.items 获取（兼容旧格式）
  const dataItems = slide.data?.items || slide.items
  if (Array.isArray(dataItems) && dataItems.length > 0) {
    return dataItems.length
  }
  
  // 从 elements 中提取
  const items = extractItemsFromElements(slide)
  return items.length
}

/**
 * 获取页面中的items
 */
function getItems(slide) {
  if (!slide) return []
  
  // 优先尝试从 data.items 获取（兼容旧格式）
  const dataItems = slide.data?.items || slide.items
  if (Array.isArray(dataItems) && dataItems.length > 0) {
    return dataItems
  }
  
  // 从 elements 中提取
  return extractItemsFromElements(slide)
}

/**
 * 【新增】智能润色
 * @param {object} context PPT上下文
 * @param {string} scope 润色范围（'all' | 'title' | 'items'）
 * @param {string} requirement 润色要求
 * @param {string} model AI模型
 * @param {object} res Express响应对象
 */
async function handleSmartPolish(context, scope, requirement, model, res) {
  try {
    const { currentSlide } = context
    
    if (!currentSlide) {
      return res.json({
        success: false,
        error: '当前没有选中的页面'
      })
    }
    
    // 1. 提取要润色的内容
    const contentToPolish = extractContentByScope(currentSlide, scope)
    
    if (!contentToPolish || (Object.keys(contentToPolish).length === 0)) {
      return res.json({
        success: false,
        error: '未找到可润色的内容'
      })
    }
    
    // 2. 构建润色 prompt
    const prompt = buildPolishPrompt(contentToPolish, requirement, scope)
    
    // 3. AI 润色
    const result = await aiService.chat(model, [
      { 
        role: 'system', 
        content: `你是PPT内容润色专家。你的任务是优化PPT内容的表达，提升专业性、简洁性和说服力。

要求：
1. 保持原意不变，只优化表达方式
2. 根据用户要求调整风格（如未指定，保持原风格微调）
3. 保持格式和结构不变
4. 返回JSON格式：{"polished": {...}, "explanation": "说明优化了哪些方面"}`
      },
      { role: 'user', content: prompt }
    ], { 
      temperature: 0.7, 
      maxTokens: 1000 
    })
    
    // 4. 解析结果
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('AI返回格式无效')
    }
    
    const polishResult = JSON.parse(jsonMatch[0])
    
    // 5. 返回对比结果
    return res.json({
      success: true,
      type: 'edit',
      action: 'polish_result',
      message: '润色完成！',
      data: {
        scope,
        requirement: requirement === 'default' ? '' : requirement,
        original: contentToPolish,
        polished: polishResult.polished,
        explanation: polishResult.explanation || ''
      }
    })
  } catch (error) {
    console.error('[智能润色] 错误:', error)
    return res.json({
      success: false,
      error: '润色失败：' + error.message
    })
  }
}

/**
 * 【新增】处理文本编辑模式的润色
 * @param {object} context PPT上下文
 * @param {object} polishContext 润色上下文（包含选中信息）
 * @param {string} requirement 润色要求
 * @param {string} model AI模型
 * @param {object} res Express响应对象
 */
async function handleTextEditingPolish(context, polishContext, requirement, model, res) {
  try {
    if (!polishContext || !polishContext.elementId) {
      return res.json({
        success: false,
        error: '缺少润色上下文信息'
      })
    }
    
    // 提取要润色的内容（优先使用 HTML，如果没有则使用纯文本）
    const contentToPolish = polishContext.hasSelection
      ? (polishContext.selectedHTML || polishContext.selectedText)
      : (polishContext.fullHTML || polishContext.fullContent)
    
    if (!contentToPolish) {
      return res.json({
        success: false,
        error: '未找到可润色的内容'
      })
    }
    
    // 判断是否包含 HTML 标签
    const hasHTML = /<[^>]+>/.test(contentToPolish)
    
    console.log('[文本编辑润色] 内容信息:', {
      hasSelection: polishContext.hasSelection,
      hasHTML,
      contentLength: contentToPolish.length,
      contentPreview: contentToPolish.substring(0, 200)
    })
    
    // 判断润色策略
    const hasUserRequirement = requirement && requirement !== 'default' && requirement.trim() !== ''
    
    let systemPrompt = ''
    let userPrompt = ''
    let temperature = 0.6
    
    if (hasUserRequirement) {
      // 用户指定了要求 → 按用户要求来
      if (hasHTML) {
        systemPrompt = `你是PPT内容润色专家。请严格按照用户的要求对HTML内容进行润色。

关键规则：
1. 用户说怎么改就怎么改，充分理解用户意图
2. 如果用户说"可以重写"、"大改"，可以大幅调整
3. 如果用户说"只改表达"、"微调"，只做小幅优化
4. **重要**：必须保留所有HTML标签和样式结构（如 <p>、<span>、style属性等）
5. **重要**：只修改文本内容，不要改变HTML结构、标签属性、样式等
6. **重要**：必须返回有效的JSON格式，不要包含任何markdown代码块标记
7. JSON格式：{"polished": "润色后的HTML内容（保留所有标签）", "explanation": "说明优化了哪些方面"}
8. polished字段中的HTML如果包含引号，必须使用\\"转义
9. 只返回JSON，不要添加任何其他文字说明`

        userPrompt = `原文（HTML格式）：\n${contentToPolish}\n\n用户要求：${requirement}\n\n请按要求润色，保留所有HTML标签和样式，只返回JSON格式。`
      } else {
        systemPrompt = `你是PPT内容润色专家。请严格按照用户的要求对文字进行润色。

关键规则：
1. 用户说怎么改就怎么改，充分理解用户意图
2. 如果用户说"可以重写"、"大改"，可以大幅调整
3. 如果用户说"只改表达"、"微调"，只做小幅优化
4. **重要**：必须返回有效的JSON格式，不要包含任何markdown代码块标记
5. JSON格式：{"polished": "润色后的文字", "explanation": "说明优化了哪些方面"}
6. polished字段中的文字如果包含引号，必须使用\\"转义
7. polished字段中的文字如果包含换行符，必须使用\\n转义
8. 只返回JSON，不要添加任何其他文字说明`

        userPrompt = `原文：\n${contentToPolish}\n\n用户要求：${requirement}\n\n请按要求润色，只返回JSON格式。`
      }
      temperature = 0.8  // 用户指定时温度更高
    } else {
      // 用户未指定 → 适中策略
      if (hasHTML) {
        systemPrompt = `你是PPT内容润色专家。请对HTML内容进行适度优化润色。

润色策略（适中模式）：
1. 保留核心含义和关键信息，不大幅改写
2. 优化表达方式，提升专业性和简洁性
3. 如果是标题，保持简短（不超过15字），不改变核心意思
4. 如果是正文，适度调整句式，增强可读性
5. 保持原文风格，不要过度修饰
6. **重要**：必须保留所有HTML标签和样式结构（如 <p>、<span>、style属性等）
7. **重要**：只修改文本内容，不要改变HTML结构、标签属性、样式等
8. **重要**：必须返回有效的JSON格式，不要包含任何markdown代码块标记
9. JSON格式：{"polished": "润色后的HTML内容（保留所有标签）", "explanation": "说明优化了哪些方面"}
10. polished字段中的HTML如果包含引号，必须使用\\"转义
11. 只返回JSON，不要添加任何其他文字说明`

        userPrompt = `请对以下HTML内容进行适度润色，保留所有HTML标签和样式，只返回JSON格式：\n\n${contentToPolish}`
      } else {
        systemPrompt = `你是PPT内容润色专家。请对文字进行适度优化润色。

润色策略（适中模式）：
1. 保留核心含义和关键信息，不大幅改写
2. 优化表达方式，提升专业性和简洁性
3. 如果是标题，保持简短（不超过15字），不改变核心意思
4. 如果是正文，适度调整句式，增强可读性
5. 保持原文风格，不要过度修饰
6. **重要**：必须返回有效的JSON格式，不要包含任何markdown代码块标记
7. JSON格式：{"polished": "润色后的文字", "explanation": "说明优化了哪些方面"}
8. polished字段中的文字如果包含引号，必须使用\\"转义
9. polished字段中的文字如果包含换行符，必须使用\\n转义
10. 只返回JSON，不要添加任何其他文字说明`

        userPrompt = `请对以下文字进行适度润色，只返回JSON格式：\n\n${contentToPolish}`
      }
    }
    
    // 调用AI（增加maxTokens避免JSON被截断）
    const result = await aiService.chat(model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ], { 
      temperature, 
      maxTokens: 1200  // 增加token限制，避免JSON被截断
    })
    
    console.log('[文本编辑润色] AI原始返回:', result)
    
    // 【修复】先清理 markdown 代码块标记
    let cleanedResult = result
    // 移除 markdown 代码块标记
    cleanedResult = cleanedResult.replace(/```json\s*/g, '')
    cleanedResult = cleanedResult.replace(/```\s*/g, '')
    cleanedResult = cleanedResult.trim()
    
    console.log('[文本编辑润色] 清理后内容:', cleanedResult)
    
    // 【改进】更健壮的 JSON 提取逻辑
    let polishResult = null
    let jsonString = ''
    
    // 方法1: 尝试直接解析整个内容
    try {
      polishResult = JSON.parse(cleanedResult)
      if (polishResult.polished) {
        console.log('[文本编辑润色] 方法1成功: 直接解析')
      } else {
        polishResult = null
      }
    } catch (e) {
      // 直接解析失败，继续尝试其他方法
    }
    
    // 方法2: 使用正则匹配，找到最完整的 JSON 对象
    if (!polishResult) {
      // 匹配从第一个 { 开始到最后一个 } 结束的内容
      const jsonMatches = cleanedResult.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)
      if (jsonMatches && jsonMatches.length > 0) {
        // 尝试解析每个匹配的 JSON，找到第一个有效的
        for (const match of jsonMatches) {
          try {
            const parsed = JSON.parse(match)
            if (parsed.polished) {
              polishResult = parsed
              jsonString = match
              console.log('[文本编辑润色] 方法2成功: 正则匹配')
              break
            }
          } catch (e) {
            // 继续尝试下一个
          }
        }
      }
    }
    
    // 方法3: 使用平衡括号算法，找到最完整的 JSON 对象
    if (!polishResult) {
      let startIdx = cleanedResult.indexOf('{')
      if (startIdx !== -1) {
        let braceCount = 0
        let endIdx = startIdx
        
        for (let i = startIdx; i < cleanedResult.length; i++) {
          if (cleanedResult[i] === '{') braceCount++
          if (cleanedResult[i] === '}') braceCount--
          if (braceCount === 0) {
            endIdx = i
            break
          }
        }
        
        if (endIdx > startIdx) {
          jsonString = cleanedResult.substring(startIdx, endIdx + 1)
          try {
            // 清理控制字符
            jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            polishResult = JSON.parse(jsonString)
            if (polishResult.polished) {
              console.log('[文本编辑润色] 方法3成功: 平衡括号')
            } else {
              polishResult = null
            }
          } catch (e) {
            polishResult = null
          }
        }
      }
    }
    
    // 方法4: 如果所有方法都失败，尝试从包含 "polished" 的部分提取
    if (!polishResult) {
      // 找到 "polished" 字段的位置
      const polishedIdx = cleanedResult.indexOf('"polished"')
      if (polishedIdx !== -1) {
        // 向前找到最近的 {
        let startIdx = polishedIdx
        while (startIdx >= 0 && cleanedResult[startIdx] !== '{') {
          startIdx--
        }
        
        if (startIdx !== -1) {
          // 向后找到匹配的 }
          let braceCount = 0
          let endIdx = startIdx
          for (let i = startIdx; i < cleanedResult.length; i++) {
            if (cleanedResult[i] === '{') braceCount++
            if (cleanedResult[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                endIdx = i
                break
              }
            }
          }
          
          if (endIdx > startIdx) {
            jsonString = cleanedResult.substring(startIdx, endIdx + 1)
            // 清理控制字符（但保留已转义的字符）
            jsonString = jsonString.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
            
            try {
              polishResult = JSON.parse(jsonString)
              if (polishResult.polished) {
                console.log('[文本编辑润色] 方法4成功: 从polished字段提取')
              } else {
                polishResult = null
              }
            } catch (e) {
              // 如果还是失败，尝试手动提取字段值（使用更宽松的正则）
              try {
                // 匹配 "polished": "..." 或 "polished":"..."
                const polishedMatch = jsonString.match(/"polished"\s*:\s*"((?:[^"\\]|\\.)*)"/)
                // 匹配 "explanation": "..." 或 "explanation":"..."
                const explanationMatch = jsonString.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/)
                
                if (polishedMatch && polishedMatch[1]) {
                  // 处理转义字符
                  let polishedValue = polishedMatch[1]
                    .replace(/\\n/g, '\n')
                    .replace(/\\r/g, '\r')
                    .replace(/\\t/g, '\t')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\')
                  
                  let explanationValue = ''
                  if (explanationMatch && explanationMatch[1]) {
                    explanationValue = explanationMatch[1]
                      .replace(/\\n/g, '\n')
                      .replace(/\\r/g, '\r')
                      .replace(/\\t/g, '\t')
                      .replace(/\\"/g, '"')
                      .replace(/\\\\/g, '\\')
                  }
                  
                  polishResult = {
                    polished: polishedValue,
                    explanation: explanationValue
                  }
                  console.log('[文本编辑润色] 方法5成功: 手动提取字段')
                }
              } catch (e2) {
                console.error('[文本编辑润色] 方法5也失败:', e2.message)
                polishResult = null
              }
            }
          }
        }
      }
    }
    
    // 最终验证
    if (!polishResult || !polishResult.polished) {
      console.error('[文本编辑润色] 所有解析方法都失败')
      console.error('[文本编辑润色] 原始内容:', result)
      console.error('[文本编辑润色] 清理后内容:', cleanedResult)
      throw new Error('AI返回的JSON格式无效，请重试')
    }
    
    console.log('[文本编辑润色] 解析成功:', {
      polished: polishResult.polished.substring(0, 50),
      explanation: polishResult.explanation?.substring(0, 50)
    })
    
    // 返回结果
    return res.json({
      success: true,
      type: 'edit',
      action: 'text_polish_result',
      message: '润色完成！',
      data: {
        mode: 'text_editing',
        elementId: polishContext.elementId,
        hasSelection: polishContext.hasSelection,
        from: polishContext.from,
        to: polishContext.to,
        original: contentToPolish,
        polished: polishResult.polished,
        explanation: polishResult.explanation || '',
        strategy: hasUserRequirement ? 'user_defined' : 'moderate'  // 标记使用的策略
      }
    })
  } catch (error) {
    console.error('[文本编辑润色] 错误:', error)
    return res.json({
      success: false,
      error: '润色失败：' + error.message
    })
  }
}

/**
 * 【新增】根据范围提取内容
 * @param {object} slide 页面数据
 * @param {string} scope 范围（'all' | 'title' | 'items'）
 * @returns {object} 提取的内容
 */
function extractContentByScope(slide, scope) {
  const result = {}
  
  if (scope === 'all' || scope === 'title') {
    // 提取标题
    if (slide.elements && Array.isArray(slide.elements)) {
      const titleEl = slide.elements.find(el => 
        (el.type === 'text' && el.textType === 'title') ||
        (el.type === 'shape' && el.text?.type === 'title')
      )
      if (titleEl) {
        result.title = getElementText(titleEl)
      }
    }
  }
  
  if (scope === 'all' || scope === 'items') {
    // 提取要点
    const items = extractItemsFromElements(slide)
    if (items.length > 0) {
      result.items = items
    }
  }
  
  return result
}

/**
 * 【新增】构建润色 prompt
 * @param {object} content 要润色的内容
 * @param {string} requirement 润色要求
 * @param {string} scope 润色范围
 * @returns {string} prompt
 */
function buildPolishPrompt(content, requirement, scope) {
  let prompt = `请对以下PPT内容进行润色优化：\n\n`
  
  if (content.title) {
    prompt += `页面标题：${content.title}\n`
  }
  
  if (content.items && content.items.length > 0) {
    prompt += `\n要点内容：\n`
    content.items.forEach((item, i) => {
      const title = item.title || (typeof item === 'string' ? item : '')
      const text = item.text || ''
      prompt += `${i + 1}. ${title}${text ? ': ' + text : ''}\n`
    })
  }
  
  if (requirement && requirement !== 'default') {
    prompt += `\n润色要求：${requirement}\n`
  } else {
    prompt += `\n润色要求：保持原风格，微调优化表达，提升专业性和简洁性\n`
  }
  
  prompt += `\n请返回JSON格式：
{
  "polished": {
    ${content.title ? '"title": "润色后的标题",' : ''}
    ${content.items ? '"items": [{"title": "...", "text": "..."}, ...]' : ''}
  },
  "explanation": "说明优化了哪些方面"
}`
  
  return prompt
}

/**
 * 按模版页生成内容
 * POST /aippt/template-page-generate
 *
 * Request:
 * {
 *   elements: [{textType, text}],  // 模版页可替换的文字元素列表
 *   topic: "用户输入的主题",
 *   model: "deepseek-chat"
 * }
 */
router.post('/template-page-generate', async (req, res) => {
  try {
    const { elements, topic, model = 'deepseek-chat' } = req.body
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.json({ success: false, error: '缺少模版页面文字元素' })
    }
    if (!topic) {
      return res.json({ success: false, error: '请输入主题内容' })
    }
    return handleTemplatePageGenerate(elements, topic, model, res)
  } catch (error) {
    console.error('[模版页生成] 错误:', error)
    res.status(500).json({ success: false, error: error.message || '处理失败' })
  }
})

/**
 * 根据模版页文字元素和用户主题，用 AI 生成替换文字
 *
 * 改进方案：按 ID 精准回填
 * - 请求：[{ id, textType, content }]
 * - 返回：[{ id, newContent }]
 */
async function handleTemplatePageGenerate(elements, topic, model, res) {
  try {
    // textType 中文含义映射
    const textTypeLabels = {
      title: '标题',
      subtitle: '副标题',
      content: '正文',
      item: '列表项内容',
      itemTitle: '列表项标题',
      notes: '注释',
      header: '页眉',
      footer: '页脚',
      partNumber: '章节编号',
      itemNumber: '项目编号',
    }

    // 构建发送给 AI 的元素描述
    const elementLines = elements.map((el, i) => {
      const label = textTypeLabels[el.textType] || el.textType
      // 从 HTML 中提取纯文本用于显示和长度参考
      const pureText = el.content?.replace(/<[^>]*>/g, '').trim() || ''
      const hasSeqPrefix = /^[①②③④⑤⑥⑦⑧⑨⑩]|^\d+[\.。、]/.test(pureText)
      const seqNote = hasSeqPrefix ? `\n   注意：开头的序号必须原样保留` : ''
      return `${i + 1}. [id="${el.id}"] [类型: ${label}]
   原文字: ${pureText}
   HTML: ${el.content}${seqNote}`
    }).join('\n\n')

    const systemPrompt = `你是PPT内容生成专家。用户选定了一个PPT模版页面，请根据用户输入的主题，为该模版中每个文字元素生成合适的替换内容。

【重要说明】
- 模版中的"原文字"只是格式和长度参考，不代表实际内容！
- 你必须完全根据"用户主题"来生成新内容，不要参考模版文字的含义！

【返回格式要求】
- 必须保留原HTML的所有标签和样式属性（如<p>、<span style="...">、<strong>等）
- 只替换标签内的文字内容，HTML结构完全不变
- 如果原内容是多段落（多个<p>），新内容也要保持相同的段落结构
- 开头的序号（①②③或1.2.3.等）必须原样保留在文字开头

【其他要求】
- 生成文字的长度与原文字相近（误差不超过30%）
- 内容要与用户主题紧密相关、专业准确
- 只返回JSON数组，不要有任何其他内容`

    const userPrompt = `用户主题：${topic}

请根据上述主题，为以下每个元素生成新内容(一定不要使用模版中的文字内容！)：

${elementLines}

【返回格式】
必须严格按原HTML格式返回，只替换文字，结构不变。示例：
[{"id":"xxx","newContent":"<p><span style=\"color:#265BFE;font-size:12.4px;\">新文字内容</span></p>"}]`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const result = await aiService.chat(model, messages, {
      temperature: 0.7,
      maxTokens: 2000,
    })

    console.log('[模版页生成] AI返回:', result.substring(0, 500))

    let items = null
    try {
      const jsonMatch = result.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        items = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.error('[模版页生成] JSON解析失败:', e)
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.json({ success: false, error: '生成内容解析失败，请重试' })
    }

    // 直接返回 items 数组，前端按 id 回填
    return res.json({
      success: true,
      type: 'edit',
      action: 'template_page_generate',
      message: '页面内容已生成',
      data: { items },
    })
  } catch (error) {
    console.error('[模版页生成] 错误:', error)
    return res.json({ success: false, error: '生成失败：' + error.message })
  }
}

export default router

