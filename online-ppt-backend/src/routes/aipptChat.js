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
import { classifyIntent, getLimitMessage, getActionGuide, parseContinueTopic } from '../services/intentService.js'
import { imageService } from '../services/imageService.js'
import aiService from '../services/aiService.js'
import { getModelConfig } from '../config/models.js'

const router = express.Router()

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
    const { message, context = {}, history = [], model = 'deepseek-chat' } = req.body
    
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
    
    const systemPrompt = `你是一个PPT内容生成专家。用户要在PPT中插入一页关于"${topic}"的内容。

请根据主题生成 3-4 个核心要点，每个要点包含标题和简短说明。
${contextInfo}

请严格按照以下JSON格式返回，不要有其他内容：
{"items":[{"title":"要点1标题","text":"要点1简短说明（15-30字）"},{"title":"要点2标题","text":"要点2简短说明"},{"title":"要点3标题","text":"要点3简短说明"}]}

注意：
1. 生成 3-4 个要点（根据主题复杂度决定）
2. 标题要简洁有力（5-10字）
3. 说明要精炼专业（15-30字）
4. 只返回JSON，不要有markdown代码块或其他文字`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请为"${topic}"生成PPT要点内容` }
    ]
    
    const result = await aiService.chat(model, messages, {
      temperature: 0.7,
      maxTokens: 1024
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
    
    return res.json({
      success: true,
      type: 'edit',
      action: 'continue_write',
      message: `已为您生成 ${items.length} 个要点`,
      data: {
        topic,
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
  } else if (isIncrease) {
    // 增加：默认增加1个
    targetCount = currentCount + 1
    
    try {
      const addPrompt = `以下是PPT中现有的要点，请补充一个相关的新要点。

页面标题：${currentSlide?.data?.title || currentSlide?.title || '未知'}
现有要点：
${currentItems.map((item, i) => `${i + 1}. ${item.title || item}: ${item.text || ''}`).join('\n')}

请返回一个新要点，格式：{"title":"要点标题","text":"要点说明"}
只返回JSON，不要其他内容。`

      const result = await aiService.chat(model, [
        { role: 'user', content: addPrompt }
      ], { temperature: 0.7, maxTokens: 200 })
      
      const jsonMatch = result.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const newItem = JSON.parse(jsonMatch[0])
        newItems = [...currentItems, newItem]
        targetCount = newItems.length
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

export default router

