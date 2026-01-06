/**
 * 统一AI调用服务（增强版）
 * 整合模型配置、提示词模板和AI调用
 */

const { OpenAI } = require('openai');
const modelConfigService = require('./modelConfigService');
const promptTemplateService = require('./promptTemplateService');
const logger = require('../utils/logger');

class AIService {
  /**
   * 为指定场景创建OpenAI客户端
   * @param {string} sceneType - 场景类型
   * @param {string} modelId - 可选：指定模型ID，不传则使用默认模型
   * @returns {Promise<{client: OpenAI, config: Object}>}
   */
  async getClient(sceneType, modelId = null) {
    try {
      let config;
      
      if (modelId) {
        config = await modelConfigService.getModelById(modelId);
      } else {
        config = await modelConfigService.getDefaultModel(sceneType);
      }
      
      if (!config.api_key) {
        throw new Error(`模型配置缺少API密钥: ${config.name}`);
      }
      
      const client = new OpenAI({
        apiKey: config.api_key,
        baseURL: config.api_url,
      });
      
      return { client, config };
    } catch (error) {
      logger.error(`创建AI客户端失败 [${sceneType}]:`, error.message);
      throw error;
    }
  }

  /**
   * 通用调用方法（非流式）
   * @param {string} sceneType - 场景类型
   * @param {string|Object} prompt - 提示词（字符串或包含code和variables的对象）
   * @param {Object} options - 可选配置
   * @returns {Promise<string>} AI返回的内容
   */
  async chat(sceneType, prompt, options = {}) {
    try {
      // 1. 获取客户端和配置
      const { client, config } = await this.getClient(sceneType, options.modelId);
      
      // 2. 处理提示词
      let finalPrompt;
      if (typeof prompt === 'string') {
        finalPrompt = prompt;
      } else if (prompt.code && prompt.variables) {
        // 使用提示词模板
        finalPrompt = await promptTemplateService.getPromptByCode(prompt.code, prompt.variables);
      } else if (prompt.variables) {
        // 使用场景默认模板
        finalPrompt = await promptTemplateService.getPrompt(sceneType, prompt.variables);
      } else {
        throw new Error('Invalid prompt format');
      }
      
      logger.ai(sceneType, config.name, '开始调用');
      logger.debug('提示词长度:', finalPrompt.length, '字符');
      
      // 3. 构建消息
      const messages = options.messages || [
        { role: 'user', content: finalPrompt }
      ];
      
      // 4. 调用AI
      const startTime = Date.now();
      const response = await client.chat.completions.create({
        model: config.model_name,
        messages,
        temperature: options.temperature ?? config.temperature,
        max_tokens: options.max_tokens ?? config.max_tokens,
        top_p: options.top_p ?? config.top_p,
        stream: false,
        ...config.extra_config,
        ...options.extraParams,
      });
      
      const duration = Date.now() - startTime;
      const content = response.choices[0].message.content;
      const tokenCount = response.usage?.total_tokens || 0;
      
      // 5. 更新统计
      await modelConfigService.updateCallStats(config.id, tokenCount);
      
      logger.ai(
        sceneType,
        config.name,
        `调用成功 (耗时: ${duration}ms, Tokens: ${tokenCount})`
      );
      
      return content;
    } catch (error) {
      logger.error(`AI调用失败 [${sceneType}]:`, error.message);
      
      // 记录错误
      if (options.modelId || sceneType) {
        try {
          const { config } = await this.getClient(sceneType, options.modelId);
          await modelConfigService.recordError(config.id, error);
        } catch (e) {
          // 忽略记录错误时的异常
        }
      }
      
      throw error;
    }
  }

  /**
   * 流式调用（带回调）
   * @param {string} sceneType - 场景类型
   * @param {string|Object} prompt - 提示词
   * @param {Function} onChunk - 每收到一个chunk时的回调
   * @param {Object} options - 可选配置
   * @returns {Promise<string>} 完整的AI返回内容
   */
  async chatStream(sceneType, prompt, onChunk, options = {}) {
    try {
      // 1. 获取客户端和配置
      const { client, config } = await this.getClient(sceneType, options.modelId);
      
      // 2. 处理提示词
      let finalPrompt;
      if (typeof prompt === 'string') {
        finalPrompt = prompt;
      } else if (prompt.code && prompt.variables) {
        finalPrompt = await promptTemplateService.getPromptByCode(prompt.code, prompt.variables);
      } else if (prompt.variables) {
        finalPrompt = await promptTemplateService.getPrompt(sceneType, prompt.variables);
      } else {
        throw new Error('Invalid prompt format');
      }
      
      logger.ai(sceneType, config.name, '开始流式调用');
      
      // 3. 构建消息
      const messages = options.messages || [
        { role: 'user', content: finalPrompt }
      ];
      
      // 4. 调用AI（流式）
      const startTime = Date.now();
      const stream = await client.chat.completions.create({
        model: config.model_name,
        messages,
        temperature: options.temperature ?? config.temperature,
        max_tokens: options.max_tokens ?? config.max_tokens,
        top_p: options.top_p ?? config.top_p,
        stream: true,
        ...config.extra_config,
        ...options.extraParams,
      });
      
      let fullContent = '';
      let chunkCount = 0;
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          chunkCount++;
          if (onChunk) {
            onChunk(content);
          }
        }
      }
      
      const duration = Date.now() - startTime;
      
      // 5. 更新统计（流式调用无法准确统计token，使用字符数估算）
      const estimatedTokens = Math.ceil((finalPrompt.length + fullContent.length) / 4);
      await modelConfigService.updateCallStats(config.id, estimatedTokens);
      
      logger.ai(
        sceneType,
        config.name,
        `流式调用成功 (耗时: ${duration}ms, Chunks: ${chunkCount}, 预估Tokens: ${estimatedTokens})`
      );
      
      return fullContent;
    } catch (error) {
      logger.error(`AI流式调用失败 [${sceneType}]:`, error.message);
      
      // 记录错误
      if (options.modelId || sceneType) {
        try {
          const { config } = await this.getClient(sceneType, options.modelId);
          await modelConfigService.recordError(config.id, error);
        } catch (e) {
          // 忽略
        }
      }
      
      throw error;
    }
  }

  /**
   * 流式调用（返回Response流，用于Express SSE）
   * @param {string} sceneType - 场景类型
   * @param {string|Object} prompt - 提示词
   * @param {Object} res - Express response对象
   * @param {Object} options - 可选配置
   * @returns {Promise<void>}
   */
  async createStreamResponse(sceneType, prompt, res, options = {}) {
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    try {
      // 1. 获取客户端和配置
      const { client, config } = await this.getClient(sceneType, options.modelId);
      
      // 2. 处理提示词
      let finalPrompt;
      if (typeof prompt === 'string') {
        finalPrompt = prompt;
      } else if (prompt.code && prompt.variables) {
        finalPrompt = await promptTemplateService.getPromptByCode(prompt.code, prompt.variables);
      } else if (prompt.variables) {
        finalPrompt = await promptTemplateService.getPrompt(sceneType, prompt.variables);
      } else {
        throw new Error('Invalid prompt format');
      }
      
      logger.ai(sceneType, config.name, 'SSE流式调用开始');
      
      // 3. 构建消息
      const messages = options.messages || [
        { role: 'user', content: finalPrompt }
      ];
      
      // 4. 调用AI（流式）
      const stream = await client.chat.completions.create({
        model: config.model_name,
        messages,
        temperature: options.temperature ?? config.temperature,
        max_tokens: options.max_tokens ?? config.max_tokens,
        top_p: options.top_p ?? config.top_p,
        stream: true,
        ...config.extra_config,
        ...options.extraParams,
      });
      
      let fullContent = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullContent += content;
          res.write(content);
        }
      }
      
      res.end();
      
      // 5. 更新统计
      const estimatedTokens = Math.ceil((finalPrompt.length + fullContent.length) / 4);
      await modelConfigService.updateCallStats(config.id, estimatedTokens);
      
      logger.ai(sceneType, config.name, 'SSE流式调用完成');
    } catch (error) {
      logger.error(`AI SSE流失败 [${sceneType}]:`, error.message);
      
      if (!res.headersSent) {
        res.status(500).json({ error: `AI服务调用失败: ${error.message}` });
      } else {
        res.end();
      }
      
      // 记录错误
      if (options.modelId || sceneType) {
        try {
          const { config } = await this.getClient(sceneType, options.modelId);
          await modelConfigService.recordError(config.id, error);
        } catch (e) {
          // 忽略
        }
      }
    }
  }

  /**
   * 批量调用（并发控制）
   * @param {string} sceneType - 场景类型
   * @param {Array<Object>} prompts - 提示词数组
   * @param {Object} options - 可选配置
   * @returns {Promise<Array<string>>} AI返回内容数组
   */
  async batchChat(sceneType, prompts, options = {}) {
    const concurrency = options.concurrency || 3; // 默认并发数
    const results = [];
    const errors = [];
    
    logger.info(`开始批量AI调用 [${sceneType}]: ${prompts.length} 个任务，并发数: ${concurrency}`);
    
    // 分批执行
    for (let i = 0; i < prompts.length; i += concurrency) {
      const batch = prompts.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(prompt => this.chat(sceneType, prompt, options))
      );
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          errors.push({ index: i + index, error: result.reason });
          results.push(null);
        }
      });
    }
    
    if (errors.length > 0) {
      logger.warn(`批量调用完成，但有 ${errors.length} 个失败`);
    } else {
      logger.success(`批量调用全部成功: ${results.length} 个任务`);
    }
    
    return { results, errors };
  }
}

module.exports = new AIService();

