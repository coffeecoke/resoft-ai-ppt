/**
 * AI服务
 * 
 * 封装OpenAI API调用
 */

const { OpenAI } = require('openai')
const { getModelConfig } = require('../config/aiModels')

class AIService {
  /**
   * 创建OpenAI客户端
   * 
   * @param {string} modelName - 模型名称
   * @returns {OpenAI} OpenAI客户端实例
   */
  createClient(modelName) {
    const config = getModelConfig(modelName)
    
    if (!config.apiKey) {
      throw new Error(`请配置 ${config.envKey} 环境变量`)
    }
    
    return new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    })
  }

  /**
   * 普通调用(非流式)
   * 
   * @param {string} modelName - 模型名称
   * @param {Array} messages - 消息数组
   * @param {Object} options - 其他选项
   * @returns {Promise<string>} AI返回的内容
   */
  async chat(modelName, messages, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
    // ✅ 添加详细的调用日志
    console.log(`🤖 [AI调用] 模型代码: ${modelName}`)
    console.log(`📋 [AI调用] 实际模型: ${config.model}, Provider: ${config.provider}, BaseURL: ${config.baseUrl}`)
    console.log(`📊 [AI调用] 消息数量: ${messages.length}, 温度: ${options.temperature ?? 0.7}, 最大Token: ${options.maxTokens ?? 4096}`)
    
    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      ...options
    })
    
    return response.choices[0].message.content
  }

  /**
   * 流式调用
   * 
   * @param {string} modelName - 模型名称
   * @param {Array} messages - 消息数组
   * @param {Function} onChunk - 每收到一个chunk时的回调
   * @param {Object} options - 其他选项
   * @returns {Promise<string>} 完整的AI返回内容
   */
  async chatStream(modelName, messages, onChunk, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
    // ✅ 添加调用日志
    console.log(`🤖 [AI调用-流式] 模型: ${config.model}, Provider: ${config.provider}, BaseURL: ${config.baseUrl}`)
    
    const stream = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
      ...options
    })
    
    let fullContent = ''
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullContent += content
        if (onChunk) {
          onChunk(content)
        }
      }
    }
    
    return fullContent
  }

  /**
   * 流式调用(返回Response流,用于直接pipe给Express response)
   * 
   * @param {string} modelName - 模型名称
   * @param {Array} messages - 消息数组
   * @param {Object} res - Express response对象
   * @param {Object} options - 其他选项
   * @returns {Promise<void>}
   */
  async createStreamResponse(modelName, messages, res, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    try {
      const stream = await client.chat.completions.create({
        model: config.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: true,
        ...options
      })
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || ''
        if (content) {
          res.write(content)
        }
      }
      
      res.end()
    } catch (error) {
      console.error('AI Stream Error:', error)
      if (!res.headersSent) {
        res.status(500).json({ error: 'AI服务调用失败' })
      } else {
        res.end()
      }
    }
  }
}

module.exports = new AIService()

