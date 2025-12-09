import OpenAI from 'openai'
import { getModelConfig } from '../config/models.js'

/**
 * AI服务类
 * 
 * 封装了对各种大模型的调用，统一使用OpenAI SDK（因为大部分国内模型都兼容OpenAI API格式）
 */
class AIService {
  
  /**
   * 创建OpenAI客户端
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
   * 普通调用（非流式）
   */
  async chat(modelName, messages, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
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
   */
  async chatStream(modelName, messages, onChunk, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
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
   * 流式调用（返回Response流，用于直接pipe给Express response）
   * 
   * @param {string} modelName - 模型名称
   * @param {Array} messages - 消息数组
   * @param {Object} res - Express response对象
   * @param {Object} options - 其他选项
   * @param {boolean} options.filterJson - 是否过滤JSON（用于PPT生成，只输出有效的JSON行）
   */
  async createStreamResponse(modelName, messages, res, options = {}) {
    const config = getModelConfig(modelName)
    const client = this.createClient(modelName)
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    // 如果启用JSON过滤，使用缓冲处理
    const filterJson = options.filterJson || false
    let buffer = '' // 用于缓冲不完整的行
    
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
          if (filterJson) {
            // JSON过滤模式：按行处理，只输出有效的JSON
            buffer += content
            
            // 按行分割处理
            const lines = buffer.split('\n')
            // 保留最后一行（可能不完整）
            buffer = lines.pop() || ''
            
            // 处理完整的行
            for (const line of lines) {
              const trimmedLine = line.trim()
              
              // 跳过空行和markdown代码块标记
              if (!trimmedLine || 
                  trimmedLine === '```json' || 
                  trimmedLine === '```' ||
                  trimmedLine.startsWith('```')) {
                continue
              }
              
              // 尝试解析JSON，只发送有效的JSON
              try {
                JSON.parse(trimmedLine)
                // 是有效的JSON，发送给前端
                res.write(trimmedLine + '\n')
              } catch (e) {
                // 不是有效的JSON，可能是说明文字，跳过
                // 不输出，避免前端解析错误
              }
            }
          } else {
            // 普通模式：直接输出（用于大纲生成）
            res.write(content)
          }
        }
      }
      
      // 处理最后一行缓冲
      if (filterJson && buffer.trim()) {
        const trimmedLine = buffer.trim()
        // 跳过markdown代码块标记
        if (trimmedLine && 
            trimmedLine !== '```json' && 
            trimmedLine !== '```' &&
            !trimmedLine.startsWith('```')) {
          try {
            JSON.parse(trimmedLine)
            res.write(trimmedLine + '\n')
          } catch (e) {
            // 最后一行不是有效JSON，忽略
          }
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

export default new AIService()
