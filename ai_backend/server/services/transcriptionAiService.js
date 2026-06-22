/**
 * 转录内容 AI 处理服务
 * 
 * 功能：
 * 1. 错别字修正
 */

const aiService = require('./aiService'); // aiService 导出的是实例，不是类
const logger = require('../utils/logger');
const { modelConfigService, promptTemplateService } = require('./index');

class TranscriptionAiService {
  constructor() {
    this.aiService = aiService; // 直接使用导出的实例
    this.SCENE_TYPE = 'transcription_correction'; // 场景类型
  }

  /**
   * 错别字修正（支持分批处理）
   * 
   * @param {Array} dialogues - 对话数组
   * @param {Object} options - 选项
   * @param {number} options.batchSize - 每批处理的对话数量，默认50（已改为按4000字符分批）
   * @param {Function} options.onProgress - 进度回调函数 (current, total) => void
   * @returns {Promise<Object>} 修正结果
   */
  async correctTyposAndRoles(dialogues, options = {}) {
    try {
      // 1. 获取模型配置（优先从数据库获取）
      let modelName = options.modelName;
      let modelConfig = null; // 数据库中的模型配置
      
      if (!modelName) {
        // 从数据库获取默认模型配置
        const defaultModel = await modelConfigService.getDefaultModel(this.SCENE_TYPE);
        if (!defaultModel) {
          throw new Error(`未配置错别字修正场景的默认模型，请前往"模型配置"中设置场景类型为"${this.SCENE_TYPE}"的模型`);
        }
        modelName = defaultModel.code;
        modelConfig = defaultModel; // 保存完整的模型配置
        logger.info(`🤖 使用默认模型: ${defaultModel.name} (代码: ${defaultModel.code}, ID: ${defaultModel.id})`);
        logger.info(`📋 模型详情: Provider=${defaultModel.provider || 'N/A'}, Model=${defaultModel.model_name || defaultModel.code}, API_URL=${defaultModel.api_url || 'N/A'}`);
      } else {
        // 如果前端指定了模型代码，从数据库获取配置
        // 注意：如果前端传入的是场景类型而不是模型代码，需要处理
        if (modelName === this.SCENE_TYPE) {
          // 前端传入的是场景类型，应该使用默认模型
          logger.warn(`⚠️ 前端传入的是场景类型 "${modelName}"，将使用默认模型`);
          const defaultModel = await modelConfigService.getDefaultModel(this.SCENE_TYPE);
          if (!defaultModel) {
            throw new Error(`未配置错别字修正场景的默认模型，请前往"模型配置"中设置场景类型为"${this.SCENE_TYPE}"的模型`);
          }
          modelName = defaultModel.code;
          modelConfig = defaultModel;
          logger.info(`🤖 使用默认模型: ${defaultModel.name} (代码: ${defaultModel.code}, ID: ${defaultModel.id})`);
          logger.info(`📋 模型详情: Provider=${defaultModel.provider || 'N/A'}, Model=${defaultModel.model_name || defaultModel.code}, API_URL=${defaultModel.api_url || 'N/A'}`);
        } else {
          // 前端传入的是模型代码，从数据库获取配置
          try {
            const models = await modelConfigService.getModelsByScene(this.SCENE_TYPE);
            const matchedModel = models.find(m => m.code === modelName);
            if (matchedModel) {
              // 获取完整配置（包含解密后的 api_key）
              modelConfig = await modelConfigService.getModelById(matchedModel.id);
              logger.info(`🤖 使用前端指定的模型: ${modelConfig.name} (代码: ${modelName}, ID: ${modelConfig.id})`);
              logger.info(`📋 模型详情: Provider=${modelConfig.provider || 'N/A'}, Model=${modelConfig.model_name || modelName}, API_URL=${modelConfig.api_url || 'N/A'}`);
            } else {
              throw new Error(`前端指定的模型代码 "${modelName}" 在数据库中未找到。请前往"模型配置"中检查场景类型为"${this.SCENE_TYPE}"的模型配置`);
            }
          } catch (error) {
            logger.error(`❌ 获取模型配置失败: ${error.message}`);
            throw new Error(`获取模型配置失败: ${error.message}。请确保模型配置正确`);
          }
        }
      }
      
      // 验证模型配置是否完整
      if (!modelConfig) {
        throw new Error(`未获取到模型配置。请前往"模型配置"中设置场景类型为"${this.SCENE_TYPE}"的模型`);
      }
      
      if (!modelConfig.api_key || !modelConfig.api_url) {
        throw new Error(`模型配置不完整：缺少 api_key 或 api_url。请检查模型配置（代码: ${modelName}, ID: ${modelConfig.id}）`);
      }
      
      // 2. 获取提示词模板（如果没有指定）
      let systemPrompt = options.systemPrompt;
      if (!systemPrompt) {
        const templates = await promptTemplateService.getTemplatesByScene(this.SCENE_TYPE);
        const activeTemplate = templates.find(t => t.is_active);
        
        if (!activeTemplate) {
          // 如果没有配置提示词，使用内置的默认提示词
          logger.warn(`⚠️ 未配置错别字修正提示词，使用内置默认模板`);
          systemPrompt = this.getDefaultPrompt();
        } else {
          systemPrompt = activeTemplate.prompt;
          logger.info(`📋 使用提示词模板: ${activeTemplate.name}`);
        }
      }

      // 3. 按4000字符和90条对话分批处理（不截断说话人内容）
      const MAX_CHARS_PER_BATCH = 4000; // 每批最大字符数
      const MAX_DIALOGUES_PER_BATCH = 90; // 每批最大对话数量
      const totalDialogues = dialogues.length;
      
      // 计算总字符数
      const getTextLength = (text) => text ? text.length : 0;
      let totalChars = 0;
      for (const dialogue of dialogues) {
        const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';
        totalChars += getTextLength(text);
      }
      
      logger.info(`📊 开始处理对话: 总数=${totalDialogues}条, 总字符数=${totalChars}, 每批最大=${MAX_CHARS_PER_BATCH}字符或${MAX_DIALOGUES_PER_BATCH}条对话`);
      
      // 如果总字符数不超过限制且对话条数不超过限制，直接处理
      if (totalChars <= MAX_CHARS_PER_BATCH && totalDialogues <= MAX_DIALOGUES_PER_BATCH) {
        logger.info(`📦 总字符数和对话条数较少（${totalChars}字符 ≤ ${MAX_CHARS_PER_BATCH}字符，${totalDialogues}条 ≤ ${MAX_DIALOGUES_PER_BATCH}条），直接处理，不分批`);
        const batchResult = await this.processBatch(dialogues, systemPrompt, modelName, modelConfig, options);
        
        // 只返回错别字修正的结果，不包含角色判断
        return {
          success: true,
          data: {
            dialogues: batchResult.data.dialogues,
            summary: {
              totalDialogues: batchResult.data.summary?.totalDialogues || batchResult.data.dialogues.length,
              correctedCount: batchResult.data.summary?.correctedCount || 0
            }
          },
          processingTime: batchResult.processingTime,
          modelName: batchResult.modelName
        };
      }

      // 按4000字符和90条对话分批处理
      logger.info(`📦 总字符数或对话条数较大（${totalChars}字符 > ${MAX_CHARS_PER_BATCH}字符 或 ${totalDialogues}条 > ${MAX_DIALOGUES_PER_BATCH}条），启用按字符数和对话数量分批处理`);
      
      // 内存监控（如果可用）
      const getMemoryUsage = () => {
        if (process.memoryUsage) {
          const usage = process.memoryUsage();
          return {
            rss: Math.round(usage.rss / 1024 / 1024), // MB
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024) // MB
          };
        }
        return null;
      };
      
      const initialMemory = getMemoryUsage();
      if (initialMemory) {
        logger.info(`💾 初始内存使用: RSS=${initialMemory.rss}MB, Heap=${initialMemory.heapUsed}/${initialMemory.heapTotal}MB`);
      }
      
      // 内存优化：不预先创建所有批次，而是按需处理
      const allCorrectedDialogues = [];
      let totalProcessingTime = 0;
      let totalCorrectedCount = 0;
      
      // 按4000字符和90条对话分批（不截断说话人内容）
      const batches = [];
      let currentBatch = [];
      let currentBatchChars = 0;
      
      for (let i = 0; i < dialogues.length; i++) {
        const dialogue = dialogues[i];
        const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';
        const textLength = getTextLength(text);
        
        // ✅ 如果加上当前对话后超过字符数限制或对话数量限制，且当前批次不为空，保存当前批次并创建新批次
        const wouldExceedChars = currentBatchChars + textLength > MAX_CHARS_PER_BATCH;
        const wouldExceedCount = currentBatch.length >= MAX_DIALOGUES_PER_BATCH;
        if ((wouldExceedChars || wouldExceedCount) && currentBatch.length > 0) {
          batches.push([...currentBatch]);
          currentBatch = [];
          currentBatchChars = 0;
        }
        
        // 添加当前对话到批次（即使单条超过限制也要完整保存，不截断）
        currentBatch.push(dialogue);
        currentBatchChars += textLength;
      }
      
      // 添加最后一个批次
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      
      const totalBatches = batches.length;
      logger.info(`📦 已分成 ${totalBatches} 批，将逐批处理`);

      // 逐批处理
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = batches[batchIndex];
        const batchChars = batch.reduce((sum, d) => {
          const text = d.text || d.correctedText || d.originalText || '';
          return sum + getTextLength(text);
        }, 0);
        
        logger.info(`🔄 处理第 ${batchIndex + 1}/${totalBatches} 批（${batch.length}条对话，${batchChars}字符）`);
        
        // 计算已处理的对话数量
        const processedCount = batches.slice(0, batchIndex + 1).reduce((sum, b) => sum + b.length, 0);
        const batchStartIndex = batches.slice(0, batchIndex).reduce((sum, b) => sum + b.length, 0);
        
        // 调用进度回调
        if (options.onProgress) {
          options.onProgress(processedCount, totalDialogues);
        }
        
        // 处理当前批次
        let batchResult = null;
        try {
          batchResult = await this.processBatch(batch, systemPrompt, modelName, modelConfig, {
            ...options,
            batchContext: {
              batchIndex,
              batchStartIndex,
              totalBatches: totalBatches
            }
          });
          
          // 合并结果（只处理错别字修正的结果）
          if (batchResult && batchResult.data && batchResult.data.dialogues) {
            allCorrectedDialogues.push(...batchResult.data.dialogues);
          }
          
          // 累计处理时间和修正数量
          if (batchResult) {
            totalProcessingTime += batchResult.processingTime || 0;
            if (batchResult.data && batchResult.data.summary) {
              totalCorrectedCount += batchResult.data.summary.correctedCount || 0;
            }
          }
          
          // 内存优化：处理完一批后，立即释放 batchResult 的引用
          batchResult = null;
          
          // 每处理5批，输出内存使用情况
          if ((batchIndex + 1) % 5 === 0) {
            const currentMemory = getMemoryUsage();
            if (currentMemory && initialMemory) {
              const heapIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
              logger.info(`💾 已处理 ${batchIndex + 1}/${totalBatches} 批，当前内存: Heap=${currentMemory.heapUsed}MB (+${heapIncrease}MB)`);
              
              // 如果堆内存增长超过500MB，发出警告
              if (heapIncrease > 500) {
                logger.warn(`⚠️ 内存使用增长较大（+${heapIncrease}MB），建议减小批次大小或增加批次间延迟`);
              }
            }
          }
        } catch (batchError) {
          logger.error(`❌ 第 ${batchIndex + 1}/${totalBatches} 批处理失败:`, batchError.message);
          logger.error(`📋 失败批次: ${batch.length}条对话，${batchChars}字符`);
          
          // 如果批次处理失败，使用原始对话（不修正）
          logger.warn(`⚠️ 使用原始对话内容（未修正）`);
          batch.forEach(dialogue => {
            allCorrectedDialogues.push({
              timeRange: dialogue.timeRange || dialogue.startTime,
              speaker: dialogue.speaker,
              originalText: dialogue.text,
              correctedText: dialogue.text, // 使用原始文本
              changes: []
            });
          });
          
          // 继续处理下一批，不中断整个流程
          continue;
        } finally {
          // 强制释放批次数据引用（帮助垃圾回收）
          batch.length = 0;
        }
        
        // 批次间稍作延迟，避免请求过快，同时给垃圾回收器时间
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200)); // 增加延迟，给GC更多时间
          
          // 每处理5批，强制触发一次垃圾回收（如果可用）
          if (batchIndex > 0 && batchIndex % 5 === 0 && global.gc) {
            logger.info(`🧹 处理了 ${batchIndex + 1} 批，触发垃圾回收`);
            global.gc();
          }
        }
      }

      logger.info(`✅ 所有批次处理完成: ${totalCorrectedCount}/${totalDialogues} 条对话需要修正`);
      
      // 输出最终内存使用情况
      const finalMemory = getMemoryUsage();
      if (finalMemory && initialMemory) {
        const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
        logger.info(`💾 处理完成，最终内存: Heap=${finalMemory.heapUsed}MB (+${heapIncrease}MB)`);
      }

      return {
        success: true,
        data: {
          dialogues: allCorrectedDialogues,
          summary: {
            totalDialogues,
            correctedCount: totalCorrectedCount
          }
        },
        processingTime: totalProcessingTime,
        modelName,
        batchCount: batches.length
      };

    } catch (error) {
      logger.error('❌ AI 错别字修正失败:', error);
      throw error;
    }
  }

  /**
   * 处理单批对话
   * 
   * @param {Array} batchDialogues - 单批对话数组
   * @param {string} systemPrompt - 系统提示词
   * @param {string} modelName - 模型代码（用于从数据库获取配置）
   * @param {Object} modelConfig - 模型配置对象（从数据库获取）
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 处理结果
   */
  async processBatch(batchDialogues, systemPrompt, modelName, modelConfig, options = {}) {
    // 获取批次信息（如果有）
    const batchContext = options.batchContext || {};
    const batchInfo = batchContext.batchIndex !== undefined 
      ? `[批次 ${batchContext.batchIndex + 1}/${batchContext.totalBatches}] `
      : '';
    
    logger.info(`${batchInfo}🚀 开始处理批次，对话数量: ${batchDialogues.length}条`);
    
    // 构建用户消息（只要求错别字修正，不包含角色判断）
    const batchJsonStr = JSON.stringify(batchDialogues, null, 2);
    const userMessage = `请对以下对话内容进行错别字修正：

\`\`\`json
${batchJsonStr}
\`\`\`

请严格按照 JSON 格式输出结果。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // ⚠️ 关键：记录实际发送的JSON字符串长度
    const actualInputLength = batchJsonStr.length;
    const userMessageLength = userMessage.length;
    logger.info(`${batchInfo}📊 实际发送的JSON字符串长度: ${actualInputLength}字符`);
    logger.info(`${batchInfo}📊 用户消息总长度: ${userMessageLength}字符`);

    // 确定实际调用的模型名称：优先使用数据库中的 model_name，如果没有则使用 code
    const actualModelName = modelConfig.model_name || modelName;
    
    logger.info(`${batchInfo}🚀 开始调用AI服务`);
    logger.info(`${batchInfo}📋 模型配置信息: 代码=${modelName}, 实际调用模型=${actualModelName}`);
    if (modelConfig) {
      logger.info(`${batchInfo}📋 模型详情: 名称=${modelConfig.name}, Provider=${modelConfig.provider || 'N/A'}, API_URL=${modelConfig.api_url || 'N/A'}`);
    }
    
    // ⚠️ 关键：确定 max_tokens，优先使用数据库配置中的值，但不能超过模型限制
    const configuredMaxTokens = options.maxTokens || modelConfig.max_tokens || 8000;
    const maxTokensSource = options.maxTokens 
      ? 'options参数' 
      : (modelConfig.max_tokens ? '数据库模型配置' : '默认值8000');
    
    // ⚠️ 获取模型的最大 tokens 限制
    // 豆包模型（doubao）不限制 max_tokens
    const isDoubao = modelConfig?.provider?.toLowerCase() === 'doubao' || 
                     (actualModelName || '').toLowerCase().includes('doubao');
    
    const getModelMaxTokens = (modelName) => {
      // 豆包模型不限制
      if (isDoubao) {
        return Infinity; // 不限制
      }
      
      const modelLower = (modelName || '').toLowerCase();
      // OpenAI 模型限制
      if (modelLower.includes('gpt-4o-mini') || modelLower.includes('gpt-4o') || modelLower.includes('gpt-4-turbo')) {
        return 16384; // GPT-4o 系列最多 16384 tokens
      }
      if (modelLower.includes('gpt-3.5')) {
        return 16384; // GPT-3.5 系列最多 16384 tokens
      }
      // 其他模型，使用安全默认值
      return 16384; // 大多数现代模型都支持至少 16384 tokens
    };
    
    const modelMaxTokens = getModelMaxTokens(actualModelName);
    const actualMaxTokens = isDoubao ? configuredMaxTokens : Math.min(configuredMaxTokens, modelMaxTokens);
    
    if (!isDoubao && configuredMaxTokens > modelMaxTokens) {
      logger.warn(`${batchInfo}⚠️ max_tokens ${configuredMaxTokens} 超过模型 ${actualModelName} 的限制 ${modelMaxTokens}，已自动调整为 ${modelMaxTokens}`);
    }
    
    logger.info(`${batchInfo}📊 max_tokens设置: ${actualMaxTokens} tokens (来源: ${maxTokensSource}, 模型限制: ${modelMaxTokens})`);
    logger.info(`${batchInfo}📊 max_tokens约等于: ${Math.floor(actualMaxTokens * 0.7)}汉字 (1 token ≈ 1.4汉字)`);
    
    const startTime = Date.now();
    
    // 如果提供了数据库模型配置，直接使用；否则抛出错误
    let response;
    if (modelConfig && modelConfig.api_key && modelConfig.api_url) {
      // 使用数据库中的模型配置
      const { OpenAI } = require('openai');
      const client = new OpenAI({
        apiKey: modelConfig.api_key,
        baseURL: modelConfig.api_url,
      });
      
      logger.info(`${batchInfo}🔧 实际调用: 模型=${actualModelName}, API_URL=${modelConfig.api_url}`);
      
      const aiResponse = await client.chat.completions.create({
        model: actualModelName, // ✅ 使用 model_name（如 gpt-4o-mini），而不是 code
        messages,
        temperature: options.temperature || modelConfig.temperature || 0.3,
        max_tokens: actualMaxTokens, // ✅ 优先使用数据库配置中的 max_tokens
        ...options
      });
      
      response = aiResponse.choices[0].message.content;
      logger.info(`${batchInfo}✅ 使用数据库模型配置调用成功，实际调用模型: ${actualModelName}`);
      logger.info(`${batchInfo}📄 AI 返回内容长度: ${response ? response.length : 0} 字符`);
      if (response && response.length > 0) {
        logger.debug(`${batchInfo}📄 AI 返回内容前200字符: ${response.substring(0, 200)}`);
        // 如果返回内容过长，发出警告
        if (response.length > 8000) {
          logger.warn(`${batchInfo}⚠️ AI返回内容过长: ${response.length}字符，可能超过预期限制`);
        }
      }
    } else {
      // 如果数据库配置不完整，抛出错误，不要降级
      const errorMsg = modelConfig 
        ? `数据库模型配置不完整：缺少 api_key 或 api_url。请检查模型配置（代码: ${modelName}）`
        : `未找到模型配置（代码: ${modelName}）。请前往"模型配置"中设置场景类型为"${this.SCENE_TYPE}"的模型`;
      logger.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const processingTime = Date.now() - startTime;
    logger.info(`${batchInfo}✅ AI调用完成，耗时: ${processingTime}ms`);

    // 解析 AI 返回的 JSON
    const result = this.parseAiResponse(response);

    return {
      success: true,
      data: result,
      processingTime,
      modelName
    };
  }

  /**
   * 内置默认提示词（用于未配置时的后备方案）
   * 注意：只做错别字修正，不包含角色判断
   */
  getDefaultPrompt() {
    return `你是一个专业的语音转录内容校对助手。你的任务是修正错别字和语音识别错误。

**修正原则**：
- 纠正明显的错别字
- 修正语音识别导致的同音字、近音字错误
- 修正语句不通顺的地方
- 清理不必要的语气词和停顿词
- 保持原意，不要过度修改

**输出格式**（必须严格遵循 JSON 格式）：
\`\`\`json
{
  "dialogues": [
    {
      "timeRange": "00:00-00:02",
      "speaker": "SPEAKER_1",
      "originalText": "原始文本",
      "correctedText": "修正后的文本",
      "changes": ["错别字1 → 修正1", "错别字2 → 修正2"]
    }
  ],
  "summary": {
    "totalDialogues": 10,
    "correctedCount": 5
  }
}
\`\`\`

**注意**：
1. 只输出 JSON，不要有其他文字
2. 如果文本没有错误，correctedText 与 originalText 相同
3. changes 数组只包含实际修改的内容
4. 必须保留 timeRange 和 speaker 字段，不能修改`;
  }

  /**
   * 修复 JSON 字符串中的常见问题
   * @param {string} jsonStr - 原始 JSON 字符串
   * @returns {string} 修复后的 JSON 字符串
   */
  fixJsonString(jsonStr) {
    // 第一步：修复字符串内的转义问题
    let inString = false;
    let escapeNext = false;
    let result = '';
    
    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];
      const prevChar = i > 0 ? jsonStr[i - 1] : '';
      const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';
      
      // 处理转义字符
      if (escapeNext) {
        result += char;
        escapeNext = false;
        continue;
      }
      
      // 检测反斜杠（转义字符的开始）
      if (char === '\\') {
        if (nextChar === 'n' || nextChar === 'r' || nextChar === 't' || 
            nextChar === '"' || nextChar === '\\' || nextChar === '/' ||
            nextChar === 'u' || nextChar === 'b' || nextChar === 'f') {
          result += char;
          escapeNext = true;
          continue;
        } else {
          result += '\\\\';
          continue;
        }
      }
      
      // 检测字符串的开始和结束
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
        result += char;
        continue;
      }
      
      if (inString) {
        // 在字符串内，需要转义特殊字符
        if (char === '\n') {
          result += '\\n';
        } else if (char === '\r') {
          result += '\\r';
        } else if (char === '\t') {
          result += '\\t';
        } else if (char === '\b') {
          result += '\\b';
        } else if (char === '\f') {
          result += '\\f';
        } else if (char === '"' && prevChar !== '\\') {
          result += '\\"';
        } else {
          result += char;
        }
      } else {
        result += char;
      }
    }
    
    // 如果字符串未正确关闭，尝试修复
    if (inString) {
      logger.warn('⚠️ 检测到未关闭的字符串，尝试修复...');
      result += '"';
    }
    
    // 第二步：修复结构性问题（缺少逗号、未闭合括号等）
    result = this.fixJsonStructure(result);
    
    return result;
  }

  /**
   * 修复 JSON 结构性问题（缺少逗号、未闭合括号等）
   * 使用逐字符解析，避免误匹配字符串内的内容
   */
  fixJsonStructure(jsonStr) {
    let result = '';
    let inString = false;
    let escapeNext = false;
    let i = 0;
    
    while (i < jsonStr.length) {
      const char = jsonStr[i];
      const prevChar = i > 0 ? jsonStr[i - 1] : '';
      const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';
      const next2Char = i < jsonStr.length - 2 ? jsonStr[i + 2] : '';
      
      // 处理转义字符
      if (escapeNext) {
        result += char;
        escapeNext = false;
        i++;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        result += char;
        i++;
        continue;
      }
      
      // 检测字符串的开始和结束
      if (char === '"' && prevChar !== '\\') {
        inString = !inString;
        result += char;
        i++;
        continue;
      }
      
      // 在字符串内，直接添加
      if (inString) {
        result += char;
        i++;
        continue;
      }
      
      // 在字符串外，检查是否需要添加逗号
      
      // 情况1: } 或 ] 后面直接跟 "（新字符串值，缺少逗号）
      if ((char === '}' || char === ']') && nextChar === '"' && next2Char !== ':') {
        // 检查后面是否是对象键（"key":）还是字符串值
        // 如果是字符串值，需要添加逗号
        let j = i + 2; // 跳过 } 和 "
        let foundColon = false;
        while (j < jsonStr.length && j < i + 50) { // 最多检查50个字符
          if (jsonStr[j] === ':') {
            foundColon = true;
            break;
          }
          if (jsonStr[j] === '"' && jsonStr[j - 1] !== '\\') {
            break; // 字符串结束，没有找到冒号，说明是字符串值
          }
          j++;
        }
        
        if (!foundColon) {
          result += char + ',';
          logger.warn(`⚠️ 自动修复：在位置 ${i} 处，${char} 后添加逗号（后面是字符串值）`);
          i++;
          continue;
        }
      }
      
      // 情况2: } 或 ] 后面直接跟 { 或 [（缺少逗号）
      if ((char === '}' || char === ']') && (nextChar === '{' || nextChar === '[')) {
        result += char + ',';
        logger.warn(`⚠️ 自动修复：在位置 ${i} 处，${char} 和 ${nextChar} 之间添加逗号`);
        i++;
        continue;
      }
      
      // 情况3: 字符串值后直接跟 "（新字符串值，缺少逗号）
      // 检测模式: "..." 后面跟空白，然后是新的 "（但不是对象键）
      if (char === '"' && !inString) {
        // 检查前面是否是字符串值的结束（" 后跟空白或换行）
        let k = i - 1;
        let prevWasStringEnd = false;
        while (k >= 0 && k > i - 20) {
          if (jsonStr[k] === '"' && (k === 0 || jsonStr[k - 1] !== '\\')) {
            prevWasStringEnd = true;
            break;
          }
          if (!/\s/.test(jsonStr[k])) {
            break;
          }
          k--;
        }
        
        if (prevWasStringEnd) {
          // 检查后面是否是对象键（"key":）还是字符串值
          let j = i + 1;
          let foundColon = false;
          while (j < jsonStr.length && j < i + 50) {
            if (jsonStr[j] === ':') {
              foundColon = true;
              break;
            }
            if (jsonStr[j] === '"' && jsonStr[j - 1] !== '\\') {
              break; // 字符串结束，没有找到冒号
            }
            j++;
          }
          
          if (!foundColon) {
            // 检查前面是否已经有逗号
            let m = k - 1;
            let needsComma = true;
            while (m >= 0 && m > k - 10) {
              if (jsonStr[m] === ',' || jsonStr[m] === '[' || jsonStr[m] === '{') {
                needsComma = (jsonStr[m] !== ',');
                break;
              }
              if (!/\s/.test(jsonStr[m])) {
                break;
              }
              m--;
            }
            
            if (needsComma) {
              result += ',';
              logger.warn(`⚠️ 自动修复：在位置 ${i} 处，字符串后添加逗号（后面是新的字符串值）`);
            }
          }
        }
      }
      
      // 情况4: 数字、true/false/null 后面直接跟 "（缺少逗号）
      // 需要更精确的检测，避免匹配字符串中的数字
      if ((char === '0' || char === '1' || char === '2' || char === '3' || char === '4' || 
           char === '5' || char === '6' || char === '7' || char === '8' || char === '9')) {
        // 检查是否是完整的数字（后面跟空白或标点）
        let numEnd = i;
        while (numEnd < jsonStr.length && /[0-9]/.test(jsonStr[numEnd])) {
          numEnd++;
        }
        
        if (numEnd < jsonStr.length) {
          const afterNum = jsonStr.substring(numEnd).trim();
          if (afterNum.startsWith('"') && afterNum[1] !== ':') {
            // 数字后跟字符串值，需要添加逗号
            // 但需要检查前面是否已经有逗号
            let k = i - 1;
            let needsComma = true;
            while (k >= 0 && k > i - 10) {
              if (jsonStr[k] === ',' || jsonStr[k] === '[' || jsonStr[k] === '{') {
                needsComma = false;
                break;
              }
              if (!/\s/.test(jsonStr[k])) {
                break;
              }
              k--;
            }
            
            if (needsComma) {
              // 找到数字的结束位置，在数字后添加逗号
              result += jsonStr.substring(i, numEnd) + ',';
              logger.warn(`⚠️ 自动修复：在位置 ${numEnd} 处，数字后添加逗号`);
              i = numEnd;
              continue;
            }
          }
        }
      }
      
      // 处理 true/false/null
      if (jsonStr.substring(i).match(/^(true|false|null)[\s]*"/)) {
        const match = jsonStr.substring(i).match(/^(true|false|null)/);
        if (match) {
          const value = match[0];
          const afterValue = jsonStr.substring(i + value.length).trim();
          if (afterValue.startsWith('"') && afterValue[1] !== ':') {
            // 检查前面是否已经有逗号
            let k = i - 1;
            let needsComma = true;
            while (k >= 0 && k > i - 10) {
              if (jsonStr[k] === ',' || jsonStr[k] === '[' || jsonStr[k] === '{') {
                needsComma = false;
                break;
              }
              if (!/\s/.test(jsonStr[k])) {
                break;
              }
              k--;
            }
            
            if (needsComma) {
              result += value + ',';
              logger.warn(`⚠️ 自动修复：在位置 ${i + value.length} 处，${value} 后添加逗号`);
              i += value.length;
              continue;
            }
          }
        }
      }
      
      result += char;
      i++;
    }
    
    // 修复未闭合的括号
    let openBraces = (result.match(/{/g) || []).length;
    let closeBraces = (result.match(/}/g) || []).length;
    let openBrackets = (result.match(/\[/g) || []).length;
    let closeBrackets = (result.match(/\]/g) || []).length;
    
    while (openBraces > closeBraces) {
      result += '}';
      closeBraces++;
      logger.warn('⚠️ 自动添加闭合花括号');
    }
    
    while (openBrackets > closeBrackets) {
      result += ']';
      closeBrackets++;
      logger.warn('⚠️ 自动添加闭合方括号');
    }
    
    return result;
  }

  /**
   * 解析 AI 响应
   */
  parseAiResponse(response) {
    try {
      // 提取 JSON（可能被包裹在 markdown 代码块中）
      let jsonStr = response.trim();
      
      // 移除 markdown 代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 尝试直接解析
      try {
        const result = JSON.parse(jsonStr);
        return this.validateAndFixResult(result);
      } catch (parseError) {
        // 如果直接解析失败，尝试修复 JSON
        logger.warn('⚠️ 直接解析失败，尝试修复 JSON 格式...');
        const fixedJson = this.fixJsonString(jsonStr);
        const result = JSON.parse(fixedJson);
        return this.validateAndFixResult(result);
      }

    } catch (error) {
      logger.error('❌ 解析 AI 响应失败:', error.message);
      logger.error('原始响应长度:', response ? response.length : 0);
      logger.error('原始响应前500字符:', response ? response.substring(0, 500) : 'null');
      logger.error('原始响应后500字符:', response && response.length > 500 ? response.substring(response.length - 500) : '');
      
      // 尝试多种方法提取和修复 JSON
      const extractionMethods = [
        // 方法1: 提取第一个完整的 JSON 对象（从第一个 { 到匹配的 }）
        () => {
          let braceCount = 0;
          let startIndex = -1;
          for (let i = 0; i < response.length; i++) {
            if (response[i] === '{' && (i === 0 || response[i - 1] !== '\\')) {
              if (startIndex === -1) startIndex = i;
              braceCount++;
            } else if (response[i] === '}' && (i === 0 || response[i - 1] !== '\\')) {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                return response.substring(startIndex, i + 1);
              }
            }
          }
          return null;
        },
        // 方法2: 使用正则提取（贪婪匹配）
        () => {
          const match = response.match(/\{[\s\S]*\}/);
          return match ? match[0] : null;
        },
        // 方法3: 查找 ```json 代码块
        () => {
          const match = response.match(/```json\s*([\s\S]*?)\s*```/);
          return match ? match[1] : null;
        }
      ];
      
      for (let i = 0; i < extractionMethods.length; i++) {
        try {
          const extracted = extractionMethods[i]();
          if (!extracted) continue;
          
          logger.info(`尝试方法 ${i + 1} 提取 JSON...`);
          
          // 先尝试直接解析
          try {
            const result = JSON.parse(extracted);
            logger.info(`✅ 方法 ${i + 1} 成功提取并解析 JSON`);
            return this.validateAndFixResult(result);
          } catch (parseError) {
            // 如果直接解析失败，尝试修复
            logger.warn(`⚠️ 方法 ${i + 1} 提取的 JSON 需要修复...`);
            logger.debug(`解析错误位置: ${parseError.message}`);
            
            try {
              const fixed = this.fixJsonString(extracted);
              const result = JSON.parse(fixed);
              logger.info(`✅ 方法 ${i + 1} 修复后成功解析 JSON`);
              return this.validateAndFixResult(result);
            } catch (fixError) {
              // 如果修复后仍然失败，尝试更激进的修复
              logger.warn(`⚠️ 方法 ${i + 1} 第一次修复失败，尝试更激进的修复...`);
              logger.debug(`修复错误: ${fixError.message}`);
              
              try {
                // 尝试多次修复
                let multiFixed = extracted;
                for (let attempt = 0; attempt < 3; attempt++) {
                  multiFixed = this.fixJsonString(multiFixed);
                  try {
                    const result = JSON.parse(multiFixed);
                    logger.info(`✅ 方法 ${i + 1} 经过 ${attempt + 1} 次修复后成功解析 JSON`);
                    return this.validateAndFixResult(result);
                  } catch (e) {
                    if (attempt === 2) throw e;
                    // 继续下一次修复尝试
                  }
                }
              } catch (multiFixError) {
                logger.warn(`❌ 方法 ${i + 1} 多次修复后仍失败: ${multiFixError.message}`);
                // 记录错误位置的上下文（前后各100字符）
                const errorMatch = multiFixError.message.match(/position (\d+)/);
                if (errorMatch) {
                  const errorPos = parseInt(errorMatch[1]);
                  const start = Math.max(0, errorPos - 100);
                  const end = Math.min(extracted.length, errorPos + 100);
                  if (start < end) {
                    logger.debug(`错误位置上下文 (位置 ${errorPos}, 范围 ${start}-${end}): ${extracted.substring(start, end)}`);
                  } else {
                    logger.debug(`错误位置: ${errorPos}, 但无法提取上下文（范围无效）`);
                  }
                }
                throw multiFixError;
              }
            }
          }
        } catch (extractError) {
          logger.warn(`❌ 方法 ${i + 1} 失败:`, extractError.message);
          continue;
        }
      }
      
      // 最后尝试：即使 JSON 格式有问题，也尝试提取 dialogues 数组
      logger.warn('⚠️ 所有标准修复方法都失败，尝试提取部分有效数据...');
      try {
        // 方法1: 尝试提取完整的 dialogues 数组
        const dialoguesMatch = response.match(/"dialogues"\s*:\s*\[([\s\S]*?)\]/);
        if (dialoguesMatch) {
          logger.warn('⚠️ 找到 dialogues 数组，尝试提取...');
          let dialoguesStr = '[' + dialoguesMatch[1] + ']';
          
          // 尝试修复数组中的格式问题
          let fixedDialogues = dialoguesStr;
          // 简单的修复：在 } 或 ] 后添加逗号（如果后面不是 , } ]）
          fixedDialogues = fixedDialogues.replace(/([}\]])[\s\n]+([{\[])/g, '$1,$2');
          fixedDialogues = fixedDialogues.replace(/([}\]])[\s\n]+"/g, '$1,"');
          
          try {
            const dialogues = JSON.parse(fixedDialogues);
            logger.warn(`✅ 成功提取 ${dialogues.length} 条对话`);
            return this.validateAndFixResult({
              dialogues: dialogues,
              summary: {
                totalDialogues: dialogues.length,
                correctedCount: 0
              }
            });
          } catch (parseError) {
            logger.warn(`❌ 提取的 dialogues 数组也无法解析: ${parseError.message}`);
          }
        }
        
        // 方法2: 尝试逐条提取对话项（当 JSON 被截断时）
        logger.warn('⚠️ 尝试逐条提取对话项...');
        const dialogueItemPattern = /\{\s*"timeRange"\s*:\s*"([^"]+)"\s*,\s*"speaker"\s*:\s*"([^"]+)"\s*,\s*"correctedText"\s*:\s*"([^"]*)"\s*(?:,\s*"changes"\s*:\s*(\[[^\]]*\]))?\s*\}/g;
        const dialogues = [];
        let match;
        let lastIndex = 0;
        
        while ((match = dialogueItemPattern.exec(response)) !== null) {
          try {
            const dialogue = {
              timeRange: match[1],
              speaker: match[2],
              correctedText: match[3] || '',
              changes: match[4] ? JSON.parse(match[4]) : []
            };
            dialogues.push(dialogue);
            lastIndex = match.index + match[0].length;
          } catch (e) {
            // 跳过无法解析的项
            logger.warn(`⚠️ 跳过无法解析的对话项: ${e.message}`);
          }
        }
        
        if (dialogues.length > 0) {
          logger.warn(`✅ 成功提取 ${dialogues.length} 条对话（逐条提取）`);
          return this.validateAndFixResult({
            dialogues: dialogues,
            summary: {
              totalDialogues: dialogues.length,
              correctedCount: 0
            }
          });
        }
        
        // 方法3: 尝试提取到错误位置之前的所有有效对话
        logger.warn('⚠️ 尝试提取错误位置之前的有效数据...');
        const errorMatch = error.message.match(/position (\d+)/);
        if (errorMatch) {
          const errorPos = parseInt(errorMatch[1]);
          const partialResponse = response.substring(0, errorPos);
          
          // 尝试找到最后一个完整的对话项
          const lastCompleteMatch = partialResponse.match(/\{\s*"timeRange"[^}]*\}/g);
          if (lastCompleteMatch && lastCompleteMatch.length > 0) {
            const partialDialogues = [];
            for (const item of lastCompleteMatch) {
              try {
                const dialogue = JSON.parse(item);
                if (dialogue.timeRange && dialogue.speaker) {
                  partialDialogues.push({
                    timeRange: dialogue.timeRange,
                    speaker: dialogue.speaker,
                    correctedText: dialogue.correctedText || dialogue.originalText || '',
                    changes: dialogue.changes || []
                  });
                }
              } catch (e) {
                // 跳过无法解析的项
              }
            }
            
            if (partialDialogues.length > 0) {
              logger.warn(`✅ 成功提取 ${partialDialogues.length} 条对话（部分提取，在错误位置之前）`);
              return this.validateAndFixResult({
                dialogues: partialDialogues,
                summary: {
                  totalDialogues: partialDialogues.length,
                  correctedCount: 0
                }
              });
            }
          }
        }
        
      } catch (extractError) {
        logger.warn(`❌ 提取部分数据也失败: ${extractError.message}`);
      }
      
      throw new Error(`AI 返回格式错误，无法解析: ${error.message}`);
    }
  }

  /**
   * 验证和修复 AI 返回的结果
   * @param {Object} result - AI 返回的原始结果
   * @returns {Object} 验证和修复后的结果
   */
  validateAndFixResult(result) {
    // 验证结果格式
    if (!result.dialogues || !Array.isArray(result.dialogues)) {
      throw new Error('AI 返回格式错误：缺少 dialogues 数组');
    }

    // 只验证错别字修正的结果，不处理角色判断
    // 确保每个对话项都有必要的字段
    // ⚠️ 注意：根据新的提示词要求，AI 只返回 correctedText 和 changes，不返回 originalText
    // originalText 将在 mergeCorrections 时从原始对话中获取
    result.dialogues = result.dialogues.map(d => {
      // ✅ 新格式：只需要 correctedText，originalText 会在合并时从原始对话获取
      if (!d.correctedText) {
        throw new Error('AI 返回格式错误：对话项缺少 correctedText');
      }
      
      // ✅ 标准化 changes 格式：统一使用 "--" 分隔符
      // 支持格式：["原文--修正文"] 或 ["原文 → 修正文"]
      let changes = d.changes || [];
      changes = changes.map(change => {
        if (typeof change === 'string') {
          // 如果使用 "→" 格式，转换为 "--" 格式
          if (change.includes('→')) {
            const parts = change.split('→');
            if (parts.length === 2) {
              return `${parts[0].trim()}--${parts[1].trim()}`;
            }
          }
          // 如果已经是 "--" 格式，直接使用
          return change;
        }
        return String(change);
      });
      
      return {
        timeRange: d.timeRange,
        speaker: d.speaker,
        correctedText: d.correctedText,
        changes: changes // ✅ 标准化后的修改列表
      };
    });

    // 如果缺少 summary，自动生成一个简单的 summary
    if (!result.summary) {
      const correctedCount = result.dialogues.filter(d => {
        const original = d.originalText || '';
        const corrected = d.correctedText || '';
        return original !== corrected;
      }).length;
      
      result.summary = {
        totalDialogues: result.dialogues.length,
        correctedCount: correctedCount
      };
      
      logger.info(`⚠️ AI 返回结果缺少 summary，已自动生成: totalDialogues=${result.summary.totalDialogues}, correctedCount=${result.summary.correctedCount}`);
    } else {
      // 确保 summary 至少包含基本字段
      if (typeof result.summary.totalDialogues === 'undefined') {
        result.summary.totalDialogues = result.dialogues.length;
      }
      if (typeof result.summary.correctedCount === 'undefined') {
        const correctedCount = result.dialogues.filter(d => {
          const original = d.originalText || '';
          const corrected = d.correctedText || '';
          return original !== corrected;
        }).length;
        result.summary.correctedCount = correctedCount;
      }
    }

    return result;
  }

  /**
   * 从 dialogues 数组中提取角色设置（兼容旧格式）
   * 
   * @param {Array} dialogues - 对话数组（可能包含 role 字段）
   * @returns {Object} 角色设置对象 { "SPEAKER_1": { role: "customer", confidence: 0.95 }, ... }
   */
  extractRoleSettingsFromDialogues(dialogues) {
    const speakerRoles = {};
    
    dialogues.forEach(dialogue => {
      if (dialogue.role && dialogue.speaker) {
        const speaker = dialogue.speaker;
        if (!speakerRoles[speaker]) {
          speakerRoles[speaker] = {
            role: dialogue.role,
            confidence: dialogue.confidence || 0.5,
            reason: '从对话中提取'
          };
        } else {
          // 如果已存在，选择置信度更高的
          if ((dialogue.confidence || 0) > (speakerRoles[speaker].confidence || 0)) {
            speakerRoles[speaker] = {
              role: dialogue.role,
              confidence: dialogue.confidence || 0.5,
              reason: '从对话中提取'
            };
          }
        }
      }
    });

    return speakerRoles;
  }

  /**
   * 应用修正结果到对话数组
   * 
   * @param {Array} originalDialogues - 原始对话
   * @param {Array} correctedDialogues - 修正后的对话
   * @returns {Array} 更新后的对话数组
   */
  applyCorrections(originalDialogues, correctedDialogues) {
    return originalDialogues.map((dialogue, index) => {
      const corrected = correctedDialogues[index];
      if (!corrected) return dialogue;

      return {
        ...dialogue,
        text: corrected.correctedText || dialogue.text,
        speaker: dialogue.speaker,
        timeRange: dialogue.timeRange || dialogue.startTime
      };
    });
  }

  /**
   * 提取角色设置（从 speakerRoles 对象中提取）
   * 
   * @param {Object} aiResult - AI 返回的结果对象
   * @returns {Object} 角色设置对象 { "SPEAKER_1": "customer", ... }
   */
  extractRoleSettings(aiResult) {
    const roles = {};
    
    // 优先使用 speakerRoles 对象（新格式）
    if (aiResult.speakerRoles) {
      Object.keys(aiResult.speakerRoles).forEach(speaker => {
        const roleInfo = aiResult.speakerRoles[speaker];
        if (roleInfo.role && roleInfo.role !== 'unknown') {
          roles[speaker] = roleInfo.role;
        }
      });
      return roles;
    }
    
    // 兼容旧格式：从 dialogues 数组中提取
    if (aiResult.dialogues && Array.isArray(aiResult.dialogues)) {
      const speakerRoles = this.extractRoleSettingsFromDialogues(aiResult.dialogues);
      Object.keys(speakerRoles).forEach(speaker => {
        if (speakerRoles[speaker].role !== 'unknown') {
          roles[speaker] = speakerRoles[speaker].role;
        }
      });
    }

    return roles;
  }

  /**
   * 角色判断（仅判断角色，不修正文本）
   * 
   * @param {Array} dialogues - 对话数组
   * @param {Object} options - 选项
   * @param {string} options.modelName - 模型代码（可选）
   * @param {string} options.promptId - 提示词模板ID（可选）
   * @param {Function} options.onProgress - 进度回调函数
   * @returns {Promise<Object>} 角色判断结果
   */
  async judgeRoles(dialogues, options = {}) {
    if (!dialogues || dialogues.length === 0) {
      throw new Error('对话内容为空');
    }

    const SCENE_TYPE = 'role_judgment'; // 角色判断场景
    const startTime = Date.now();

    try {
      // 1. 获取系统提示词
      let systemPrompt = options.systemPrompt;
      if (!systemPrompt) {
        // 如果指定了 promptId，使用指定的提示词
        if (options.promptId) {
          const promptTemplateService = require('./promptTemplateService');
          const prompt = await promptTemplateService.getTemplateById(options.promptId);
          if (prompt && prompt.prompt) {
            systemPrompt = prompt.prompt;
            logger.info(`📋 使用指定提示词模板: ${prompt.name}`);
          }
        }
        
        // 如果没有指定或获取失败，尝试从数据库获取场景默认提示词
        if (!systemPrompt) {
          const promptTemplateService = require('./promptTemplateService');
          const templates = await promptTemplateService.getTemplatesByScene(SCENE_TYPE);
          const activeTemplate = templates.find(t => t.is_active);
          
          if (activeTemplate) {
            systemPrompt = activeTemplate.prompt;
            logger.info(`📋 使用提示词模板: ${activeTemplate.name}`);
          } else {
            // 使用内置默认提示词（从 transcription_correction_prompt_enhanced.txt 中提取角色判断部分）
            logger.warn(`⚠️ 未配置角色判断提示词，使用内置默认模板`);
            systemPrompt = this.getDefaultRoleJudgmentPrompt();
          }
        }
      }

      // 2. 获取模型配置
      let modelName = options.modelName;
      let modelConfig = null;
      
      if (modelName) {
        // 如果传入的是场景类型，需要转换为实际的模型代码
        if (modelName === SCENE_TYPE) {
          modelName = undefined; // 使用默认模型
        }
      }
      
      if (!modelName) {
        // 获取场景的默认模型
        const { modelConfigService } = require('./index');
        
        // 优先使用 role_judgment 场景的模型
        logger.info(`🔍 正在查找 ${SCENE_TYPE} 场景的模型配置...`);
        try {
          // 先尝试获取默认模型
          modelConfig = await modelConfigService.getDefaultModel(SCENE_TYPE);
          modelName = modelConfig.code;
          logger.info(`✅ 找到 ${SCENE_TYPE} 场景的默认模型: ${modelConfig.name} (代码: ${modelName}, ID: ${modelConfig.id})`);
        } catch (defaultError) {
          // 如果没有默认模型，尝试获取该场景的所有模型，使用第一个启用的模型
          logger.warn(`⚠️ ${SCENE_TYPE} 场景未配置默认模型: ${defaultError.message}`);
          logger.info(`🔍 尝试查找 ${SCENE_TYPE} 场景的其他可用模型...`);
          
          try {
            const roleJudgmentModels = await modelConfigService.getModelsByScene(SCENE_TYPE);
            logger.info(`📊 找到 ${roleJudgmentModels ? roleJudgmentModels.length : 0} 个 ${SCENE_TYPE} 场景的模型`);
            
            if (roleJudgmentModels && roleJudgmentModels.length > 0) {
              // 打印所有找到的模型信息（用于调试）
              roleJudgmentModels.forEach((m, index) => {
                logger.info(`  [${index + 1}] 模型: ${m.name} (代码: ${m.code}, ID: ${m.id}, 启用: ${m.is_active}, 默认: ${m.is_default})`);
              });
              
              // 如果有模型，优先使用第一个启用的模型（getModelsByScene 已经按 is_default 和 is_active 排序）
              const activeModel = roleJudgmentModels.find(m => m.is_active) || roleJudgmentModels[0];
              if (activeModel) {
                logger.info(`✅ 选择模型: ${activeModel.name} (ID: ${activeModel.id})`);
                modelConfig = await modelConfigService.getModelById(activeModel.id);
                modelName = modelConfig.code;
                logger.info(`✅ 成功获取 ${SCENE_TYPE} 场景的模型: ${modelConfig.name} (代码: ${modelName}, ID: ${modelConfig.id})`);
              } else {
                logger.error(`❌ ${SCENE_TYPE} 场景的所有模型都已禁用`);
              }
            } else {
              logger.warn(`⚠️ ${SCENE_TYPE} 场景没有任何模型配置（scene_type='${SCENE_TYPE}' 且 is_active=true）`);
            }
          } catch (listError) {
            logger.error(`❌ 查询 ${SCENE_TYPE} 场景的模型列表失败: ${listError.message}`);
          }
          
          // 如果还是没有找到模型，才回退到 transcription_correction 场景
          if (!modelConfig) {
            logger.warn(`⚠️ 场景 "${SCENE_TYPE}" 没有可用模型，尝试使用 transcription_correction 场景作为备用方案`);
            try {
              modelConfig = await modelConfigService.getDefaultModel('transcription_correction');
              modelName = modelConfig.code;
              logger.info(`📋 使用 transcription_correction 场景的默认模型: ${modelConfig.name} (代码: ${modelName})`);
            } catch (fallbackError) {
              throw new Error(`未找到场景 "${SCENE_TYPE}" 的模型配置。请前往"模型配置"中为"角色判断"场景添加模型，并设为默认模型。错误详情: ${fallbackError.message}`);
            }
          }
        }
      } else {
        // 使用指定的模型
        const { modelConfigService } = require('./index');
        // 先在 role_judgment 场景中查找
        const models = await modelConfigService.getModelsByScene(SCENE_TYPE);
        let matchedModel = models.find(m => m.code === modelName);
        
        if (!matchedModel) {
          // 如果当前场景找不到，尝试在 transcription_correction 场景中查找
          logger.warn(`⚠️ 在 role_judgment 场景中未找到模型 "${modelName}"，尝试在 transcription_correction 场景中查找`);
          const fallbackModels = await modelConfigService.getModelsByScene('transcription_correction');
          matchedModel = fallbackModels.find(m => m.code === modelName);
        }
        
        if (matchedModel) {
          modelConfig = await modelConfigService.getModelById(matchedModel.id);
          logger.info(`📋 使用指定模型: ${modelConfig.name} (代码: ${modelName}, 场景: ${matchedModel.scene_type})`);
        } else {
          throw new Error(`未找到模型配置: ${modelName}。请检查模型代码是否正确，或确认模型是否属于 "${SCENE_TYPE}" 或 "transcription_correction" 场景`);
        }
      }

      // 3. 前中后提取样本策略（如果对话太大）
      const MAX_SAMPLE_DIALOGUES = 100; // 如果对话数量超过这个值,则使用前中后提取样本
      const totalDialogues = dialogues.length;
      
      logger.info(`📊 开始处理对话: 总数=${totalDialogues}条`);
      
      // 确定要发送的对话样本
      let dialoguesToSend = [];
      
      if (totalDialogues <= MAX_SAMPLE_DIALOGUES) {
        // 如果对话数量较少,直接使用全部对话
        logger.info(`📦 对话数量较少（${totalDialogues}条 ≤ ${MAX_SAMPLE_DIALOGUES}条），使用全部对话`);
        dialoguesToSend = dialogues;
      } else {
        // 如果对话数量较大,前中后提取样本
        logger.info(`📦 对话数量较大（${totalDialogues}条 > ${MAX_SAMPLE_DIALOGUES}条），使用前中后提取样本策略`);
        
        // 前中后各提取一定比例的样本
        const SAMPLE_RATIO = 0.15; // 前中后各提取15%
        const frontCount = Math.max(1, Math.floor(totalDialogues * SAMPLE_RATIO));
        const middleStart = Math.floor(totalDialogues / 2) - Math.floor(totalDialogues * SAMPLE_RATIO / 2);
        const middleEnd = middleStart + Math.max(1, Math.floor(totalDialogues * SAMPLE_RATIO));
        const backCount = Math.max(1, Math.floor(totalDialogues * SAMPLE_RATIO));
        
        // 提取前部样本
        const frontSamples = dialogues.slice(0, frontCount);
        // 提取中部样本
        const middleSamples = dialogues.slice(middleStart, middleEnd);
        // 提取后部样本
        const backSamples = dialogues.slice(totalDialogues - backCount);
        
        // 合并样本（去重）
        const sampleMap = new Map();
        [...frontSamples, ...middleSamples, ...backSamples].forEach(d => {
          // 使用 timeRange 和 speaker 作为唯一键
          const key = `${d.timeRange || ''}_${d.speaker || ''}`;
          if (!sampleMap.has(key)) {
            sampleMap.set(key, d);
          }
        });
        
        dialoguesToSend = Array.from(sampleMap.values());
        
        logger.info(`📦 前中后样本提取: 前部=${frontSamples.length}条, 中部=${middleSamples.length}条, 后部=${backSamples.length}条, 去重后=${dialoguesToSend.length}条`);
      }
      
      // 调用进度回调
      if (options.onProgress) {
        options.onProgress(totalDialogues, totalDialogues);
      }
      
      // 处理角色判断
      const result = await this.processRoleJudgmentSample(dialoguesToSend, systemPrompt, modelName, modelConfig, options);
      
      logger.info(`✅ 角色判断完成`);
      
      return {
        success: true,
        data: {
          speakerRoles: result.speakerRoles || {},
          summary: {
            totalDialogues,
            sampleDialogues: dialoguesToSend.length,
            totalSpeakers: Object.keys(result.speakerRoles || {}).length
          }
        },
        processingTime: result.processingTime || 0,
        modelName,
        sampleCount: dialoguesToSend.length
      };

    } catch (error) {
      logger.error('❌ AI 角色判断失败:', error);
      throw error;
    }
  }

  /**
   * 处理对话样本的角色判断（前中后提取样本）
   */
  async processRoleJudgmentSample(sampleDialogues, systemPrompt, modelName, modelConfig, options = {}) {
    logger.info(`🚀 开始处理角色判断样本，对话数量: ${sampleDialogues.length}条`);
    
    // 构建用户消息（只要求角色判断）
    const userMessage = `请对以下对话内容进行角色判断：
    
\`\`\`json
${JSON.stringify(sampleDialogues, null, 2)}
\`\`\`

请严格按照 JSON 格式输出结果，格式：{"SPEAKER_1": "客户方", "SPEAKER_2": "我方", ...}
只输出JSON对象，不要任何解释文字。`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 确定实际调用的模型名称
    const actualModelName = modelConfig.model_name || modelName;
    
    logger.info(`🚀 开始调用AI服务`);
    logger.info(`📋 模型配置信息: 代码=${modelName}, 实际调用模型=${actualModelName}`);
    logger.info(`📋 提供方=${modelConfig.provider}, API地址=${modelConfig.api_url}`);
    
    const startTime = Date.now();
    
    // 使用数据库中的模型配置直接创建客户端（与 processBatch 方法保持一致）
    let response;
    if (modelConfig && modelConfig.api_key && modelConfig.api_url) {
      // 使用数据库中的模型配置
      const { OpenAI } = require('openai');
      const client = new OpenAI({
        apiKey: modelConfig.api_key,
        baseURL: modelConfig.api_url,
      });
      
      logger.info(`🔧 实际调用: 模型=${actualModelName}, API_URL=${modelConfig.api_url}`);
      
      // 限制 max_tokens，确保不超过模型支持的最大值（大多数模型最大支持 16384 或 8192）
      // 豆包模型（doubao）不限制 max_tokens
      const isDoubao = modelConfig?.provider?.toLowerCase() === 'doubao' || 
                       (actualModelName || '').toLowerCase().includes('doubao');
      
      const MAX_TOKENS_LIMIT = 16384; // 大多数模型的最大支持值
      const configuredMaxTokens = modelConfig.max_tokens || 4000;
      const actualMaxTokens = isDoubao ? configuredMaxTokens : Math.min(configuredMaxTokens, MAX_TOKENS_LIMIT);
      
      if (!isDoubao && configuredMaxTokens > MAX_TOKENS_LIMIT) {
        logger.warn(`⚠️ 模型配置的 max_tokens (${configuredMaxTokens}) 超过限制，已调整为 ${actualMaxTokens}`);
      }
      
      const aiResponse = await client.chat.completions.create({
        model: actualModelName, // ✅ 使用 model_name（如 gpt-4o-mini），而不是 code
        messages,
        temperature: modelConfig.temperature || 0.7,
        max_tokens: actualMaxTokens, // ✅ 使用限制后的值
      });
      
      response = aiResponse.choices[0].message.content;
      logger.info(`✅ 使用数据库模型配置调用成功，实际调用模型: ${actualModelName}`);
    } else {
      // 如果数据库配置不完整，抛出错误
      const errorMsg = modelConfig 
        ? `数据库模型配置不完整：缺少 api_key 或 api_url。请检查模型配置（代码: ${modelName}）`
        : `未找到模型配置（代码: ${modelName}）。请前往"模型配置"中设置场景类型为"role_judgment"的模型`;
      logger.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    const processingTime = Date.now() - startTime;
    logger.info(`✅ AI调用完成，耗时: ${processingTime}ms`);
    
    // 解析AI响应
    const result = this.parseRoleJudgmentResponse(response);
    
    return {
      speakerRoles: result.speakerRoles || {},
      processingTime
    };
  }

  /**
   * 解析角色判断的AI响应
   * 支持两种格式：
   * 1. 简化格式：{"SPEAKER_1": "客户方", "SPEAKER_2": "我方", ...}
   * 2. 完整格式：{"speakerRoles": {"SPEAKER_1": "customer", ...}}
   */
  parseRoleJudgmentResponse(response) {
    try {
      let jsonStr = response.trim();
      
      // 移除 markdown 代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      // 尝试直接解析
      try {
        const result = JSON.parse(jsonStr);
        return this.validateRoleJudgmentResult(result);
      } catch (parseError) {
        // 如果直接解析失败，尝试修复 JSON
        logger.warn('⚠️ 直接解析失败，尝试修复 JSON 格式...');
        const fixedJson = this.fixJsonString(jsonStr);
        const result = JSON.parse(fixedJson);
        return this.validateRoleJudgmentResult(result);
      }

    } catch (error) {
      logger.error('❌ 解析 AI 响应失败:', error.message);
      throw new Error(`AI 返回格式错误，无法解析: ${error.message}`);
    }
  }

  /**
   * 验证角色判断结果
   * 支持两种格式：
   * 1. 简化格式：{"SPEAKER_1": "客户方", "SPEAKER_2": "我方", ...}
   * 2. 完整格式：{"speakerRoles": {"SPEAKER_1": "customer", ...}}
   */
  validateRoleJudgmentResult(result) {
    let speakerRoles = {};
    
    // 判断返回格式类型
    if (result.speakerRoles && typeof result.speakerRoles === 'object') {
      // 完整格式：{"speakerRoles": {...}}
      speakerRoles = result.speakerRoles;
    } else if (typeof result === 'object' && !Array.isArray(result)) {
      // 简化格式：{"SPEAKER_1": "客户方", ...} 或者 {"SPEAKER_1": {"role": "customer"}, ...}
      speakerRoles = result;
    } else {
      throw new Error('AI 返回格式错误：无法识别返回格式');
    }

    // 角色名称映射表（将中文角色名转换为标准值）
    const roleMapping = {
      '客户方': 'customer',
      '客户': 'customer',
      'customer': 'customer',
      '我方': 'our_side',
      '我方/供应商': 'our_side',
      '供应商': 'our_side',
      'our_side': 'our_side',
      '未知': 'unknown',
      'unknown': 'unknown'
    };

    // 标准化角色值
    const normalizedRoles = {};
    Object.keys(speakerRoles).forEach(speaker => {
      const roleInfo = speakerRoles[speaker];
      let roleValue = null;
      
      if (typeof roleInfo === 'string') {
        // 如果是字符串，直接转换
        roleValue = roleMapping[roleInfo] || roleInfo.toLowerCase();
      } else if (roleInfo && typeof roleInfo === 'object') {
        // 如果是对象，提取 role 字段
        const roleStr = roleInfo.role || roleInfo.roleName || roleInfo.name;
        roleValue = roleMapping[roleStr] || (roleStr ? roleStr.toLowerCase() : 'unknown');
      }
      
      // 确保角色值有效
      if (roleValue && (roleValue === 'customer' || roleValue === 'our_side' || roleValue === 'unknown')) {
        normalizedRoles[speaker] = roleValue;
      } else {
        logger.warn(`⚠️ 说话人 ${speaker} 的角色值 "${roleValue}" 无效，设置为 unknown`);
        normalizedRoles[speaker] = 'unknown';
      }
    });

    if (Object.keys(normalizedRoles).length === 0) {
      throw new Error('AI 返回格式错误：未找到有效的角色判断结果');
    }

    logger.info(`✅ 角色判断结果: ${Object.keys(normalizedRoles).length} 个说话人`);

    return {
      speakerRoles: normalizedRoles,
      summary: {
        totalSpeakers: Object.keys(normalizedRoles).length
      }
    };
  }

  /**
   * 获取默认的角色判断提示词
   */
  getDefaultRoleJudgmentPrompt() {
    return `你是一位资深的语音转录内容分析专家，专注于金融行业客户交流场景的角色判断。你的任务是对语音转录的对话内容进行角色判断。

## 📋 任务说明

### 角色判断

**角色分类**：
- **"客户方"**：对话中的需求方、提问方，通常是银行/金融机构
- **"我方"**：对话中的服务方、回答方，通常是产品/服务提供商

**判断依据**（重点关注金融场景特征，按优先级排序）：

#### 一级规则（优先使用）

1. **"我们"的指向判断（最关键）**
   - **"我们行/我们银行/我们机构" + 讨论自己的需求/建设/系统 → 客户方**
   - **"我们公司/我们系统/我们产品/我们平台" + 介绍功能/服务/能力 → 我方**

2. **"贵行/贵公司"的使用**
   - 使用"贵行"、"贵公司"指代对方（通常是供应商对客户）→ 说话人是**我方**

3. **介绍其他客户/公司的案例**
   - 以第三方视角介绍其他客户的成功案例
   - 使用"XX公司用的是"、"XX那边"、"在XX实施过"、"我们给XX做过" → **我方**

#### 二级规则（辅助判断）

4. **问答模式**
   - 大量提问产品功能、价格、实施、技术细节 + 说"你们" → 倾向**客户方**
   - 详细解答技术细节、介绍案例、产品功能 → 倾向**我方**

5. **称谓模式**
   - 询问对方："你们系统"、"你们产品"、"你们公司"、"你们平台" → 倾向**客户方**
   - 主动介绍："我们系统"、"我们产品"、"我们平台"、"我们服务" → 倾向**我方**

**判断原则**：
- 如果某个说话人特征不明显，**优先根据一级规则判断**
- 基于每个说话人的**所有对话内容**进行整体角色判断，不是单句话的判断
- 如果确实无法判断，可以留空（但尽量判断）

## 📥 输入格式

输入为 JSON 数组，每个元素包含：
- \`timeRange\`：时间范围（如 "00:00-00:05"）
- \`speaker\`：说话人标识（如 "SPEAKER_1"、"SPEAKER_2"）
- \`text\`：转录的文本内容（可能是 \`text\`、\`correctedText\` 或 \`originalText\`）

## 📤 输出格式

**必须严格遵循以下 JSON 格式，只输出 JSON 对象，不要任何解释文字**：

\`\`\`json
{
  "SPEAKER_1": "客户方",
  "SPEAKER_2": "我方",
  "SPEAKER_3": "客户方"
}
\`\`\`

**输出要求**：
- 格式：{"SPEAKER_1": "客户方", "SPEAKER_2": "我方", ...}
- **只输出 JSON 对象，不要任何解释文字**
- 角色值只能是："客户方" 或 "我方"
- 必须包含所有出现的说话人（SPEAKER_1, SPEAKER_2, ...）
- 如果某个说话人特征不明显，优先根据一级规则判断`;
  }

  /**
   * 获取默认的问答对提取提示词
   */
  getDefaultQAExtractionPrompt() {
    return `你是一位资深的对话分析专家，专注于从客户交流对话中提取问答对。

## 📋 任务说明

从对话内容中提取**客户提问**和**我方回答**的问答对。

### 提取规则

1. **问答对识别**：
   - **问题**：客户方（customer）提出的问题、咨询、需求询问
   - **答案**：我方（our_side）对问题的回答、解释、说明

2. **提取原则**：
   - ✅ 提取完整的问答对（一个问题对应一个或多个回答）
   - ✅ 保留原意，可以适当精简冗余表达
   - ✅ 如果一个问题有多个回答，合并为一个完整的答案
   - ✅ 如果一个问题没有明确回答，answer 字段可以为空字符串

3. **时间范围**：
   - time_range 格式："[开始时间-结束时间]"
   - 包含问题和答案的完整时间范围
   - 例如："[00:10-00:30]"

4. **说话人标识**：
   - question_speaker：提问者的说话人ID（如 "SPEAKER_1"）
   - answer_speaker：回答者的说话人ID（如 "SPEAKER_2"）

## 📥 输入格式

输入为 JSON 对象，包含：
- \`dialogues\`: 对话数组，每个元素包含 timeRange, speaker, text 等字段
- \`speakerRoles\`: 说话人角色映射，格式：{"SPEAKER_1": "customer", "SPEAKER_2": "our_side"}

## 📤 输出格式（严格JSON）

**必须严格遵循以下JSON数组格式**：

\`\`\`json
[
  {
    "time_range1": "[开始时间-结束时间]",
    "question_speaker": "提问者ID",
    "question": "完整问题内容（必须是说话人实际说出的原始内容，不能是AI构造）",
    "time_range2": "[开始时间-结束时间]",
    "answer_speaker": "回答者ID",
    "answer": "完整回答内容（必须是对前面问题的回答）"
  }
]
\`\`\`

**重要规则**：
1. **只输出JSON数组**：不要有任何其他说明文字
2. **question_speaker** 必须是 customer 角色的说话人ID（如 "SPEAKER_1"）
3. **answer_speaker** 必须是 our_side 角色的说话人ID（如 "SPEAKER_2"）
4. **如果对话中没有问答对，返回空数组**：\`[]\`
5. **time_range1 格式**：问题的时间范围，必须包含方括号，格式为 "[开始时间-结束时间]"
6. **time_range2 格式**：回答的时间范围，必须包含方括号，格式为 "[开始时间-结束时间]"
7. **question 内容**：必须是说话人实际说出的原始内容，不能是AI构造或概括
8. **answer 内容**：必须是对前面问题的回答，必须是说话人实际说出的原始内容
9. **如果一个问题没有回答，answer 字段可以为空字符串 ""，time_range2 也可以为空 ""
`;
  }

  /**
   * 获取默认的「问答对优化」提示词
   * 用于：去除语气词 + 结合前/后文补全主语与句子完整性
   */
  getDefaultQAOptimizePrompt() {
    return `你是一位资深的对话文本编辑专家，负责对抽取出的问答对进行优化整理。

## 任务说明

对给定的**问题（question）**和**答案（answer）**进行优化，使表达更规范、完整、易读。

## 优化要求

### 1. 去除语气词与口头禅

删除以下类型的词（不改变原意）：
- 语气词：嗯、啊、呃、哦、哎、唉、哈、呀、嘛、吧、呢、呐、噢、喔
- 口头禅/填充词：那个、这个、就是、然后、那么、就是说、怎么说呢、怎么说、其实、可能、大概、基本上
- 重复的顿号、逗号（如「，，」保留一个即可）

### 2. 补全句子（结合上下文）

- **前文**与**后文**是围绕该问答对的对话片段（前4句、后4句），用于帮助理解语境。
- 若问题或答案缺少**主语**、**指代对象**或**背景**导致不完整，请根据前后文合理补全，使单独阅读时也能看懂。
- 补全时只做最小必要补充，不添加原文没有的信息，不改变原意。

### 3. 输出规范

- 保持原意与专业术语不变。
- 输出为**标准书面语**，语句通顺、简洁。
- 若原文已足够完整且无语气词，可仅做轻微润色或原样输出。

## 输入格式

你将收到 JSON：
- \`question\`: 原始问题文本
- \`answer\`: 原始答案文本（可能为空）
- \`context_before\`: 前文对话片段（前4句），数组，每项为 "说话人: 内容"
- \`context_after\`: 后文对话片段（后4句），数组，格式同上

## 输出格式（严格 JSON）

只输出一个 JSON 对象，不要任何解释：

\`\`\`json
{
  "question": "优化后的问题文本",
  "answer": "优化后的答案文本（若原answer为空则可为空字符串）"
}
\`\`\``;
  }

  /**
   * 问答对优化（单条）：去语气词 + 结合前后文补全
   * @param {string} question - 原始问题
   * @param {string} answer - 原始答案
   * @param {string[]} contextBefore - 前文句子（前4句），每项如 "SPEAKER_1: 内容"
   * @param {string[]} contextAfter - 后文句子（后4句），同上
   * @param {Object} options - modelName, promptId, systemPrompt
   * @returns {Promise<{ success: boolean, question?: string, answer?: string, error?: string }>}
   */
  async optimizeQAPair(question, answer, contextBefore, contextAfter, options = {}) {
    const { modelConfigService, promptTemplateService } = require('./index');
    const SCENE_OPTIMIZE = 'qa_optimize';   // 优先使用「问答对优化」场景的模型和提示词
    const SCENE_FALLBACK = 'qa_extraction'; // 未配置时回退

    let systemPrompt = options.systemPrompt;
    if (!systemPrompt && options.promptId) {
      const prompt = await promptTemplateService.getTemplateById(options.promptId);
      if (prompt && prompt.prompt) systemPrompt = prompt.prompt;
    }
    if (!systemPrompt) {
      // 优先使用 qa_optimize 场景提示词，若无则用 qa_extraction，最后用内置默认
      const templates = await promptTemplateService.getTemplatesByScene('qa_optimize').catch(() => []);
      const active = Array.isArray(templates) ? templates.find(t => t.is_active) : null;
      if (active && active.prompt) {
        systemPrompt = active.prompt;
      } else {
        const qaTemplates = await promptTemplateService.getTemplatesByScene('qa_extraction').catch(() => []);
        const qaActive = Array.isArray(qaTemplates) ? qaTemplates.find(t => t.is_active) : null;
        systemPrompt = (qaActive && qaActive.prompt) ? qaActive.prompt : this.getDefaultQAOptimizePrompt();
      }
    }

    // 模型：优先「问答对优化」场景，再回退「问答对提取」、再「语音转录纠错」
    let modelConfig = null;
    let modelName = options.modelName;
    if (!modelName) {
      try {
        modelConfig = await modelConfigService.getDefaultModel(SCENE_OPTIMIZE);
        modelName = modelConfig.code;
      } catch (e) {
        const models = await modelConfigService.getModelsByScene(SCENE_OPTIMIZE);
        const active = (models && models.length) ? (models.find(m => m.is_active) || models[0]) : null;
        if (active) {
          modelConfig = await modelConfigService.getModelById(active.id);
          modelName = modelConfig.code;
        }
      }
      if (!modelConfig) {
        try {
          modelConfig = await modelConfigService.getDefaultModel(SCENE_FALLBACK);
          modelName = modelConfig.code;
        } catch (_) {}
      }
      if (!modelConfig) {
        try {
          modelConfig = await modelConfigService.getDefaultModel('transcription_correction');
        } catch (_) {}
      }
    } else {
      for (const scene of [SCENE_OPTIMIZE, SCENE_FALLBACK, 'transcription_correction']) {
        const models = await modelConfigService.getModelsByScene(scene).catch(() => []);
        const matched = models.find(m => m.code === modelName);
        if (matched) {
          modelConfig = await modelConfigService.getModelById(matched.id);
          break;
        }
      }
    }
    if (!modelConfig) {
      return { success: false, error: '未找到可用模型，请在「模型配置」中为「问答对优化」场景配置并设为默认' };
    }

    const userPayload = {
      question: String(question || '').trim(),
      answer: String(answer || '').trim(),
      context_before: Array.isArray(contextBefore) ? contextBefore : [],
      context_after: Array.isArray(contextAfter) ? contextAfter : []
    };
    const userMessage = `请优化以下问答对，只输出一个 JSON 对象（包含 question 和 answer 字段）：\n\n\`\`\`json\n${JSON.stringify(userPayload, null, 2)}\n\`\`\``;

    logger.info('[问答对优化] 发送内容:');
    logger.info('[问答对优化] ' + JSON.stringify(userPayload, null, 2));

    const { OpenAI } = require('openai');
    const client = new OpenAI({
      apiKey: modelConfig.api_key,
      baseURL: modelConfig.api_url
    });
    const actualModel = modelConfig.model_name || modelConfig.code;

    try {
      const res = await client.chat.completions.create({
        model: actualModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.3,
        timeout: 90000  // 90秒超时，给AI足够处理时间
      });
      const content = (res.choices && res.choices[0] && res.choices[0].message && res.choices[0].message.content) ? res.choices[0].message.content.trim() : '';
      if (!content) return { success: false, error: 'AI 返回为空' };

      logger.info('[问答对优化] 接收内容:');
      logger.info('[问答对优化] ' + content);

      let jsonStr = content.replace(/^```json\s*/i, '').replace(/\s*```\s*$/, '').trim();
      const parsed = JSON.parse(jsonStr);
      const outQuestion = parsed.question != null ? String(parsed.question).trim() : userPayload.question;
      const outAnswer = parsed.answer != null ? String(parsed.answer).trim() : userPayload.answer;
      return { success: true, question: outQuestion, answer: outAnswer };
    } catch (err) {
      logger.error('问答对优化调用失败:', err);
      return { success: false, error: err.message || '问答对优化失败' };
    }
  }

  /**
   * 处理单批问答对提取（内部方法）
   * @param {Array} batchDialogues - 单批对话数组
   * @param {Object} speakerRoles - 说话人角色映射
   * @param {string} systemPrompt - 系统提示词
   * @param {Object} modelConfig - 模型配置
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 单批问答对提取结果
   */
  async processQABatch(batchDialogues, speakerRoles, systemPrompt, modelConfig, options = {}) {
    const batchStartTime = Date.now();
    const batchInfo = options.batchContext 
      ? `[批次 ${options.batchContext.batchIndex + 1}/${options.batchContext.totalBatches}] `
      : '';
    
    // ✅ 过滤对话数据，只保留必要字段（timeRange, speaker, text），text使用correctedText
    const filteredDialogues = batchDialogues.map(d => ({
      timeRange: d.timeRange || d.startTime,
      speaker: d.speaker,
      text: d.correctedText || d.text || d.originalText || ''
    }));
    
    // 构建用户消息
    const userMessage = `请从以下对话内容中提取问答对（客户提问，我方回答）：

\`\`\`json
${JSON.stringify(filteredDialogues, null, 2)}
\`\`\`

说话人角色信息：
\`\`\`json
${JSON.stringify(speakerRoles, null, 2)}
\`\`\`

请严格按照指定的JSON格式输出结果，只输出JSON数组，不要任何解释文字。`;

    // 调用AI
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    // 使用模型配置创建 OpenAI 客户端
    const { OpenAI } = require('openai');
    const client = new OpenAI({
      apiKey: modelConfig.api_key,
      baseURL: modelConfig.api_url,
    });

    // 处理模型名称（可能需要转换）
    const actualModelName = modelConfig.model_name || modelConfig.code;
    
    // 限制 max_tokens，防止超过模型限制
    // 豆包模型（doubao）不限制 max_tokens
    const isDoubao = modelConfig?.provider?.toLowerCase() === 'doubao' || 
                     (actualModelName || '').toLowerCase().includes('doubao');
    
    const MAX_TOKENS_LIMIT = 16384; // 大多数模型的最大支持值
    const configuredMaxTokens = modelConfig.max_tokens || 4000;
    const actualMaxTokens = isDoubao ? configuredMaxTokens : Math.min(configuredMaxTokens, MAX_TOKENS_LIMIT);

    if (!isDoubao && configuredMaxTokens > MAX_TOKENS_LIMIT) {
      logger.warn(`${batchInfo}⚠️ 模型配置的 max_tokens (${configuredMaxTokens}) 超过了建议限制 (${MAX_TOKENS_LIMIT})，已自动调整为 ${actualMaxTokens}`);
    }

    logger.info(`${batchInfo}🚀 调用 AI 提取问答对（${filteredDialogues.length} 条对话）...`);
    logger.debug(`${batchInfo}📤 System Prompt (${systemPrompt.length} 字符)`);
    logger.debug(`${batchInfo}📤 User Message (${userMessage.length} 字符)`);

    const batchTimeoutMs = parseInt(process.env.QA_BATCH_AI_TIMEOUT_MS || '300000', 10) || 300000;

    const aiResponse = await client.chat.completions.create({
      model: actualModelName,
      messages,
      temperature: modelConfig.temperature || 0.7,
      max_tokens: actualMaxTokens,
      timeout: batchTimeoutMs,
    });

    const content = aiResponse.choices[0]?.message?.content?.trim() || '';
    
    if (!content) {
      throw new Error('AI返回内容为空');
    }

    logger.info(`${batchInfo}📥 AI 返回 ${content.length} 字符，耗时 ${Date.now() - batchStartTime}ms`);
    logger.debug(`${batchInfo}📥 AI 完整返回:\n${content}`);

    // 解析JSON数组格式
    let qaPairs = [];
    try {
      // 去除可能的代码块标记
      let jsonContent = content.trim();
      
      // 移除代码块标记（如果有）
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n?/, '').replace(/```\n?$/, '').trim();
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n?/, '').replace(/```\n?$/, '').trim();
      }
      
      qaPairs = JSON.parse(jsonContent);
      
      if (!Array.isArray(qaPairs)) {
        throw new Error('AI返回的不是数组格式，期望格式: []');
      }
      
      logger.info(`${batchInfo}✅ 成功解析问答对，共 ${qaPairs.length} 个`);
    } catch (error) {
      logger.error(`${batchInfo}❌ 解析问答对失败:`, error);
      logger.error(`${batchInfo}AI返回内容:`, content.substring(0, 500));
      throw new Error(`解析AI返回结果失败: ${error.message}。请检查AI返回格式是否为JSON数组。`);
    }

    // 验证和格式化问答对
    const validatedPairs = qaPairs.map((pair, index) => {
      if (!pair.question) {
        logger.warn(`${batchInfo}问答对 ${index + 1} 缺少 question 字段，已跳过`);
        return null;
      }
      
      // ✅ 支持新的格式：time_range1 和 time_range2（问题和回答分别的时间范围）
      // ✅ 兼容旧格式：time_range（整体时间范围）
      // ⚠️ 使用明确的检查，确保有效值能正确保存
      let timeRange1 = null;
      if (pair.time_range1 !== undefined && pair.time_range1 !== null && String(pair.time_range1).trim() !== '') {
        timeRange1 = String(pair.time_range1).trim();
      } else if (pair.time_range !== undefined && pair.time_range !== null && String(pair.time_range).trim() !== '') {
        timeRange1 = String(pair.time_range).trim();
      }
      
      let timeRange2 = null;
      if (pair.time_range2 !== undefined && pair.time_range2 !== null && String(pair.time_range2).trim() !== '') {
        timeRange2 = String(pair.time_range2).trim();
      }
      
      // ✅ 调试：输出每个问答对的原始字段（仅第一个）
      if (index === 0) {
        logger.info(`${batchInfo}🔍 ========== 原始问答对字段（第一个） ==========`);
        logger.info(`${batchInfo}📋 完整数据:`, JSON.stringify(pair, null, 2));
        logger.info(`${batchInfo}   - pair.time_range: ${pair.time_range !== undefined ? JSON.stringify(pair.time_range) : '(undefined)'} (类型: ${typeof pair.time_range})`);
        logger.info(`${batchInfo}   - pair.time_range1: ${pair.time_range1 !== undefined ? JSON.stringify(pair.time_range1) : '(undefined)'} (类型: ${typeof pair.time_range1})`);
        logger.info(`${batchInfo}   - pair.time_range2: ${pair.time_range2 !== undefined ? JSON.stringify(pair.time_range2) : '(undefined)'} (类型: ${typeof pair.time_range2})`);
        logger.info(`${batchInfo}   - question_speaker: ${pair.question_speaker || '(null)'}`);
        logger.info(`${batchInfo}   - answer_speaker: ${pair.answer_speaker || '(null)'}`);
        logger.info(`${batchInfo}==================================================`);
      }
      
      const validatedPair = {
        time_range: timeRange1, // 兼容旧格式，保存问题的时间范围
        time_range1: timeRange1, // 问题的时间范围
        time_range2: timeRange2, // 回答的时间范围
        question_speaker: pair.question_speaker || null,
        question: String(pair.question).trim(),
        answer_speaker: pair.answer_speaker || null,
        answer: pair.answer ? String(pair.answer).trim() : ''
      };
      
      // ✅ 调试：输出验证后的字段（仅第一个）
      if (index === 0) {
        logger.info(`${batchInfo}✅ ========== 验证后的字段值（第一个） ==========`);
        logger.info(`${batchInfo}   - time_range: ${validatedPair.time_range || '(null)'}`);
        logger.info(`${batchInfo}   - time_range1: ${validatedPair.time_range1 || '(null)'}`);
        logger.info(`${batchInfo}   - time_range2: ${validatedPair.time_range2 || '(null)'}`);
        logger.info(`${batchInfo}   - timeRange1 判断逻辑: pair.time_range1=${JSON.stringify(pair.time_range1)}, 结果=${timeRange1}`);
        logger.info(`${batchInfo}   - timeRange2 判断逻辑: pair.time_range2=${JSON.stringify(pair.time_range2)}, 结果=${timeRange2}`);
        logger.info(`${batchInfo}==================================================`);
      }
      
      // ✅ 调试：输出验证后的问答对（仅第一个）
      if (index === 0) {
        logger.info(`${batchInfo}✅ 验证后的问答对字段（第一个）:`, JSON.stringify(validatedPair, null, 2));
      }
      
      return validatedPair;
    }).filter(pair => pair !== null);

    // ✅ 过滤掉自问自答的问答对（question_speaker 和 answer_speaker 相同）
    const beforeFilterCount = validatedPairs.length;
    const filteredPairs = validatedPairs.filter(pair => {
      // 如果问题和回答的说话人相同，则过滤掉（自问自答无效）
      const questionSpeaker = pair.question_speaker ? String(pair.question_speaker).trim() : null;
      const answerSpeaker = pair.answer_speaker ? String(pair.answer_speaker).trim() : null;
      if (questionSpeaker && answerSpeaker && questionSpeaker === answerSpeaker) {
        logger.info(`${batchInfo}⏭️  过滤自问自答的问答对: 问题说话人=${questionSpeaker}, 回答说话人=${answerSpeaker}, 问题="${pair.question.substring(0, 50)}..."`);
        return false;
      }
      return true;
    });
    const filteredCount = beforeFilterCount - filteredPairs.length;
    if (filteredCount > 0) {
      logger.info(`${batchInfo}🚫 已过滤 ${filteredCount} 个自问自答的问答对（无效数据）`);
    }

    const processingTime = Date.now() - batchStartTime;
    logger.info(`${batchInfo}✅ 问答对提取完成: 共提取 ${filteredPairs.length} 个有效问答对（过滤前 ${beforeFilterCount} 个），耗时 ${processingTime}ms`);

    return {
      success: true,
      qaPairs: filteredPairs,
      processingTime
    };
  }

  /**
   * 提取问答对（支持分批处理）
   * @param {Array} dialogues - 对话数组
   * @param {Object} speakerRoles - 说话人角色映射 {SPEAKER_1: 'customer', ...}
   * @param {Object} options - 选项
   * @param {string} options.modelName - 模型代码（可选）
   * @param {string} options.promptId - 提示词模板ID（可选）
   * @param {Function} options.onProgress - 进度回调函数
   * @returns {Promise<Object>} 问答对提取结果
   */
  async extractQAPairs(dialogues, speakerRoles, options = {}) {
    if (!dialogues || dialogues.length === 0) {
      throw new Error('对话内容为空');
    }

    if (!speakerRoles || Object.keys(speakerRoles).length === 0) {
      throw new Error('角色信息为空，请先进行角色判断');
    }

    const SCENE_TYPE = 'qa_extraction';

    try {
      // 1. 获取系统提示词
      let systemPrompt = options.systemPrompt;
      if (!systemPrompt) {
        // 如果指定了 promptId，使用指定的提示词
        if (options.promptId) {
          const promptTemplateService = require('./promptTemplateService');
          const prompt = await promptTemplateService.getTemplateById(options.promptId);
          if (prompt && prompt.prompt) {
            systemPrompt = prompt.prompt;
            logger.info(`📋 使用指定提示词模板: ${prompt.name}`);
          }
        }
        
        // 如果没有指定或获取失败，尝试从数据库获取场景默认提示词
        if (!systemPrompt) {
          const promptTemplateService = require('./promptTemplateService');
          const templates = await promptTemplateService.getTemplatesByScene(SCENE_TYPE);
          const activeTemplate = templates.find(t => t.is_active);
          
          if (activeTemplate) {
            systemPrompt = activeTemplate.prompt;
            logger.info(`📋 使用提示词模板: ${activeTemplate.name}`);
          } else {
            // 使用内置默认提示词
            logger.warn(`⚠️ 未配置问答对提取提示词，使用内置默认模板`);
            systemPrompt = this.getDefaultQAExtractionPrompt();
          }
        }
      }

      // 2. 获取模型配置
      let modelName = options.modelName;
      let modelConfig = null;
      
      if (modelName) {
        // 如果传入的是场景类型，需要转换为实际的模型代码
        if (modelName === SCENE_TYPE) {
          modelName = undefined; // 使用默认模型
        }
      }
      
      if (!modelName) {
        // 获取场景的默认模型
        const { modelConfigService } = require('./index');
        
        // 优先使用 qa_extraction 场景的模型
        logger.info(`🔍 正在查找 ${SCENE_TYPE} 场景的模型配置...`);
        try {
          // 先尝试获取默认模型
          modelConfig = await modelConfigService.getDefaultModel(SCENE_TYPE);
          modelName = modelConfig.code;
          logger.info(`✅ 找到 ${SCENE_TYPE} 场景的默认模型: ${modelConfig.name} (代码: ${modelName}, ID: ${modelConfig.id})`);
        } catch (defaultError) {
          // 如果没有默认模型，尝试获取该场景的所有模型，使用第一个启用的模型
          logger.warn(`⚠️ ${SCENE_TYPE} 场景未配置默认模型: ${defaultError.message}`);
          logger.info(`🔍 尝试查找 ${SCENE_TYPE} 场景的其他可用模型...`);
          
          try {
            const qaExtractionModels = await modelConfigService.getModelsByScene(SCENE_TYPE);
            logger.info(`📊 找到 ${qaExtractionModels ? qaExtractionModels.length : 0} 个 ${SCENE_TYPE} 场景的模型`);
            
            if (qaExtractionModels && qaExtractionModels.length > 0) {
              // 打印所有找到的模型信息（用于调试）
              qaExtractionModels.forEach((m, index) => {
                logger.info(`  [${index + 1}] 模型: ${m.name} (代码: ${m.code}, ID: ${m.id}, 启用: ${m.is_active}, 默认: ${m.is_default})`);
              });
              
              // 如果有模型，优先使用第一个启用的模型
              const activeModel = qaExtractionModels.find(m => m.is_active) || qaExtractionModels[0];
              if (activeModel) {
                logger.info(`✅ 选择模型: ${activeModel.name} (ID: ${activeModel.id})`);
                modelConfig = await modelConfigService.getModelById(activeModel.id);
                modelName = modelConfig.code;
                logger.info(`✅ 成功获取 ${SCENE_TYPE} 场景的模型: ${modelConfig.name} (代码: ${modelName}, ID: ${modelConfig.id})`);
              }
            }
            
            // 如果还是没有找到，尝试使用 transcription_correction 场景作为备选
            if (!modelConfig) {
              logger.warn(`⚠️ ${SCENE_TYPE} 场景未找到可用模型，尝试使用 transcription_correction 场景`);
              try {
                modelConfig = await modelConfigService.getDefaultModel('transcription_correction');
                modelName = modelConfig.code;
                logger.info(`📋 使用 transcription_correction 场景的默认模型: ${modelConfig.name} (代码: ${modelName})`);
              } catch (fallbackError) {
                throw new Error(`未找到场景 "${SCENE_TYPE}" 的模型配置。请前往"模型配置"中为"问答对提取"场景添加模型，并设为默认模型。`);
              }
            }
          } catch (error) {
            logger.error(`❌ 查找 ${SCENE_TYPE} 场景的模型失败:`, error);
            throw new Error(`未找到场景 "${SCENE_TYPE}" 的模型配置。请前往"模型配置"中为"问答对提取"场景添加模型，并设为默认模型。`);
          }
        }
      } else {
        // 如果指定了模型代码，直接获取模型配置
        const { modelConfigService } = require('./index');
        modelConfig = await modelConfigService.getModelByCode(modelName);
        if (!modelConfig) {
          throw new Error(`未找到模型: ${modelName}`);
        }
      }

      // 3. 按4000字符和90条对话分批处理（参考错别字修正的逻辑）
      const MAX_CHARS_PER_BATCH = 4000; // 每批最大字符数
      const MAX_DIALOGUES_PER_BATCH = 90; // 每批最大对话数量
      const totalDialogues = dialogues.length;
      
      // 计算总字符数（只计算对话内容，角色信息会加到每批中）
      const getTextLength = (text) => text ? text.length : 0;
      let totalChars = 0;
      for (const dialogue of dialogues) {
        const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';
        totalChars += getTextLength(text);
      }
      
      logger.info(`📊 开始处理问答对提取: 总数=${totalDialogues}条, 总字符数=${totalChars}, 每批最大=${MAX_CHARS_PER_BATCH}字符或${MAX_DIALOGUES_PER_BATCH}条对话`);
      logger.info(`📋 模型: ${modelConfig.name} (${modelConfig.model_name || modelConfig.code}) | 提供方=${modelConfig.provider}`);

      const emitBatchProgress = (payload) => {
        if (typeof options.onBatchProgress === 'function') {
          options.onBatchProgress(payload);
        }
      };

      const emitExtractStart = (totalBatches) => {
        if (typeof options.onExtractStart === 'function') {
          options.onExtractStart({
            totalDialogues,
            totalChars,
            totalBatches,
            modelName: modelConfig.name,
            modelCode: modelConfig.code,
          });
        }
      };
      
      // 如果总字符数不超过限制，直接处理
      if (totalChars <= MAX_CHARS_PER_BATCH) {
        logger.info(`📦 单批处理（${totalChars} 字符，${totalDialogues} 条对话）`);
        emitExtractStart(1);
        
        // ✅ 检查是否所有对话都是同一说话人
        const speakers = [...new Set(dialogues.map(d => d.speaker).filter(Boolean))];
        if (speakers.length === 1) {
          logger.info(`⏭️  同一说话人不需提取（说话人: ${speakers[0]}）`);
          return {
            success: true,
            qaPairs: [],
            summary: {
              totalPairs: 0,
              answeredPairs: 0,
              pendingPairs: 0,
              batchCount: 1
            },
            processingTime: 0,
            modelName: modelConfig.name,
            modelCode: modelConfig.code
          };
        }
        
        emitBatchProgress({ phase: 'start', batchIndex: 0, totalBatches: 1, dialogueCount: dialogues.length, batchChars: totalChars });
        const batchResult = await this.processQABatch(dialogues, speakerRoles, systemPrompt, modelConfig, options);
        emitBatchProgress({
          phase: 'done',
          batchIndex: 0,
          totalBatches: 1,
          qaPairCount: batchResult.qaPairs?.length || 0,
          processingTimeMs: batchResult.processingTime || 0,
        });
        
        return {
          success: true,
          qaPairs: batchResult.qaPairs,
          summary: {
            totalPairs: batchResult.qaPairs.length,
            answeredPairs: batchResult.qaPairs.filter(p => p.answer && p.answer.length > 0).length,
            pendingPairs: batchResult.qaPairs.filter(p => !p.answer || p.answer.length === 0).length,
            batchCount: 1
          },
          processingTime: batchResult.processingTime,
          modelName: modelConfig.name,
          modelCode: modelConfig.code
        };
      }
      
      // 按4000字符和90条对话分批处理
      logger.info(`📦 总字符数较大（${totalChars}字符 > ${MAX_CHARS_PER_BATCH}字符），启用按字符数和对话数量分批处理`);
      
      const allQAPairs = [];
      let totalProcessingTime = 0;
      
      // 按4000字符和90条对话分批（不截断说话人内容）
      const batches = [];
      let currentBatch = [];
      let currentBatchChars = 0;
      
      for (let i = 0; i < dialogues.length; i++) {
        const dialogue = dialogues[i];
        const text = dialogue.text || dialogue.correctedText || dialogue.originalText || '';
        const textLength = getTextLength(text);
        
        // ✅ 如果加上当前对话后超过字符数限制或对话数量限制，且当前批次不为空，保存当前批次并创建新批次
        const wouldExceedChars = currentBatchChars + textLength > MAX_CHARS_PER_BATCH;
        const wouldExceedCount = currentBatch.length >= MAX_DIALOGUES_PER_BATCH;
        if ((wouldExceedChars || wouldExceedCount) && currentBatch.length > 0) {
          batches.push([...currentBatch]);
          currentBatch = [];
          currentBatchChars = 0;
        }
        
        // 添加当前对话到批次（即使单条超过限制也要完整保存，不截断）
        currentBatch.push(dialogue);
        currentBatchChars += textLength;
      }
      
      // 添加最后一个批次
      if (currentBatch.length > 0) {
        batches.push(currentBatch);
      }
      
      const totalBatches = batches.length;
      logger.info(`📦 已分成 ${totalBatches} 批，将逐批串行调用 AI`);
      emitExtractStart(totalBatches);
      
      // 逐批处理
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = batches[batchIndex];
        const batchChars = batch.reduce((sum, d) => {
          const text = d.text || d.correctedText || d.originalText || '';
          return sum + getTextLength(text);
        }, 0);
        
        logger.info(`🔄 处理第 ${batchIndex + 1}/${totalBatches} 批（${batch.length}条对话，${batchChars}字符）`);
        
        // 计算已处理的对话数量
        const processedCount = batches.slice(0, batchIndex + 1).reduce((sum, b) => sum + b.length, 0);
        
        // 调用进度回调
        if (options.onProgress) {
          options.onProgress(processedCount, totalDialogues);
        }
        
        // 处理当前批次
        try {
          // ✅ 检查是否所有对话都是同一说话人
          const batchSpeakers = [...new Set(batch.map(d => d.speaker).filter(Boolean))];
          if (batchSpeakers.length === 1) {
            logger.info(`⏭️  第 ${batchIndex + 1}/${totalBatches} 批跳过（同一说话人: ${batchSpeakers[0]}）`);
            emitBatchProgress({
              phase: 'skip',
              batchIndex,
              totalBatches,
              dialogueCount: batch.length,
              batchChars,
              reason: '同一说话人',
            });
            
            // 跳过AI调用，返回空结果（格式与processQABatch一致）
            const batchResult = {
              success: true,
              qaPairs: [],
              processingTime: 0
            };
            
            // 合并结果（虽然为空，但保持代码结构一致）
            if (batchResult && batchResult.qaPairs && Array.isArray(batchResult.qaPairs)) {
              allQAPairs.push(...batchResult.qaPairs);
              logger.info(`✅ 第 ${batchIndex + 1}/${totalBatches} 批处理完成: 跳过（同一说话人）`);
            }
            
            // 累计处理时间
            if (batchResult) {
              totalProcessingTime += batchResult.processingTime || 0;
            }
            
            continue; // 跳过当前批次，继续下一批（循环最后有统一的延迟逻辑）
          }
          
          emitBatchProgress({
            phase: 'start',
            batchIndex,
            totalBatches,
            dialogueCount: batch.length,
            batchChars,
          });

          const batchResult = await this.processQABatch(batch, speakerRoles, systemPrompt, modelConfig, {
            ...options,
            batchContext: {
              batchIndex,
              batchStartIndex: batches.slice(0, batchIndex).reduce((sum, b) => sum + b.length, 0),
              totalBatches: totalBatches
            }
          });
          
          // 合并结果
          if (batchResult && batchResult.qaPairs && Array.isArray(batchResult.qaPairs)) {
            allQAPairs.push(...batchResult.qaPairs);
            logger.info(`✅ 第 ${batchIndex + 1}/${totalBatches} 批完成: ${batchResult.qaPairs.length} 个问答对, 耗时 ${batchResult.processingTime || 0}ms`);
            emitBatchProgress({
              phase: 'done',
              batchIndex,
              totalBatches,
              qaPairCount: batchResult.qaPairs.length,
              processingTimeMs: batchResult.processingTime || 0,
            });
          }
          
          // 累计处理时间
          if (batchResult) {
            totalProcessingTime += batchResult.processingTime || 0;
          }
        } catch (batchError) {
          logger.error(`❌ 第 ${batchIndex + 1}/${totalBatches} 批处理失败:`, batchError.message);
          logger.error(`📋 失败批次: ${batch.length}条对话，${batchChars}字符`);
          emitBatchProgress({
            phase: 'error',
            batchIndex,
            totalBatches,
            dialogueCount: batch.length,
            batchChars,
            error: batchError.message,
          });
          
          // 批次处理失败，跳过该批次，继续处理下一批
          logger.warn(`⚠️ 跳过该批次，继续处理下一批`);
          continue;
        } finally {
          // 强制释放批次数据引用（帮助垃圾回收）
          batch.length = 0;
        }
        
        // 批次间稍作延迟，避免请求过快
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      logger.info(`✅ 所有批次处理完成: 共提取 ${allQAPairs.length} 个问答对，总耗时 ${totalProcessingTime}ms`);

      // ✅ 调试：输出合并后的第一个问答对的字段（检查数据是否正确）
      if (allQAPairs.length > 0) {
        logger.debug(`🔍 合并后首个问答对: ${JSON.stringify(allQAPairs[0], null, 2)}`);
      }

      return {
        success: true,
        qaPairs: allQAPairs,
        summary: {
          totalPairs: allQAPairs.length,
          answeredPairs: allQAPairs.filter(p => p.answer && p.answer.length > 0).length,
          pendingPairs: allQAPairs.filter(p => !p.answer || p.answer.length === 0).length,
          batchCount: totalBatches
        },
        processingTime: totalProcessingTime,
        modelName: modelConfig.name,
        modelCode: modelConfig.code
      };

    } catch (error) {
      logger.error('❌ 问答对提取失败:', error);
      throw error;
    }
  }

  /**
   * 应用修正结果到对话数组（合并原始对话和修正结果）
   * 
   * @param {Array} originalDialogues - 原始对话（包含 timeRange, speaker, text 等）
   * @param {Array} correctedDialogues - AI修正后的对话（包含 timeRange, speaker, correctedText, changes）
   *                                      注意：AI 不返回 originalText，需要从 originalDialogues 中获取
   * @returns {Array} 更新后的对话数组（包含 originalText, correctedText, changes 等）
   */
  mergeCorrections(originalDialogues, correctedDialogues) {
    // 创建修正结果的映射（以 timeRange 和 speaker 作为唯一标识）
    const correctedMap = new Map();
    correctedDialogues.forEach(corrected => {
      const key = `${corrected.timeRange}_${corrected.speaker}`;
      correctedMap.set(key, corrected);
    });
    
    // 合并原始对话和修正结果
    return originalDialogues.map(dialogue => {
      const key = `${dialogue.timeRange || dialogue.startTime}_${dialogue.speaker}`;
      const corrected = correctedMap.get(key);
      
      if (corrected) {
        const originalText = dialogue.text || dialogue.correctedText || '';
        const correctedText = corrected.correctedText || corrected.text || originalText;
        
        return {
          ...dialogue,
          originalText: originalText, // ✅ 保留原始文本
          correctedText: correctedText, // ✅ 保留修正后的文本
          text: correctedText, // ✅ 兼容性：也保存到 text 字段（用于显示）
          speaker: dialogue.speaker, // 保留原始说话人标识
          timeRange: dialogue.timeRange || dialogue.startTime, // 保留原始时间范围
          changes: corrected.changes || [] // ✅ 保留修改详情
        };
      }
      
      // 如果没有找到对应的修正结果，返回原始对话（也添加 originalText 和 correctedText 字段以保持一致性）
      const originalText = dialogue.text || dialogue.correctedText || '';
      return {
        ...dialogue,
        originalText: originalText,
        correctedText: originalText, // 没有修正时，修正文本等于原始文本
        text: originalText
      };
    });
  }
}

module.exports = new TranscriptionAiService();

