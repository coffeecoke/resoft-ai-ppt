/**
 * 转录内容 AI 处理服务
 * 
 * 功能：
 * 1. 错别字修正
 * 2. 角色初步判断
 */

const AIService = require('./aiService');
const logger = require('../utils/logger');
const { modelConfigService, promptTemplateService } = require('./index');

class TranscriptionAiService {
  constructor() {
    this.aiService = new AIService();
    this.SCENE_TYPE = 'transcription_correction'; // 场景类型
  }

  /**
   * 错别字修正及角色判断
   * 
   * @param {Array} dialogues - 对话数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 修正结果
   */
  async correctTyposAndRoles(dialogues, options = {}) {
    try {
      // 1. 获取默认模型配置（如果没有指定）
      let modelName = options.modelName;
      if (!modelName) {
        const defaultModel = await modelConfigService.getDefaultModel(this.SCENE_TYPE);
        if (!defaultModel) {
          throw new Error(`未配置错别字修正场景的默认模型，请前往"模型配置"中设置场景类型为"${this.SCENE_TYPE}"的模型`);
        }
        modelName = defaultModel.code;
        logger.info(`🤖 使用默认模型: ${defaultModel.name} (${modelName})`);
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
          systemPrompt = activeTemplate.prompt_content;
          logger.info(`📋 使用提示词模板: ${activeTemplate.name}`);
        }
      }
      
      // 3. 构建用户消息
      const userMessage = `请对以下对话内容进行错别字修正和角色判断：

\`\`\`json
${JSON.stringify(dialogues, null, 2)}
\`\`\`

请严格按照 JSON 格式输出结果。`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      logger.info('🤖 开始 AI 错别字修正和角色判断...');
      logger.info(`📊 对话数量: ${dialogues.length}`);
      logger.info(`🔧 使用模型: ${modelName}`);

      const startTime = Date.now();
      const response = await this.aiService.chat(modelName, messages, {
        temperature: options.temperature || 0.3, // 低温度，保证准确性
        maxTokens: options.maxTokens || 8000
      });

      const processingTime = Date.now() - startTime;
      logger.info(`⏱️ AI 处理耗时: ${processingTime}ms`);

      // 4. 解析 AI 返回的 JSON
      const result = this.parseAiResponse(response);

      logger.info(`✅ 修正完成: ${result.summary.correctedCount}/${result.summary.totalDialogues} 条对话需要修正`);

      return {
        success: true,
        data: result,
        processingTime,
        modelName
      };

    } catch (error) {
      logger.error('❌ AI 错别字修正失败:', error);
      throw error;
    }
  }

  /**
   * 内置默认提示词（用于未配置时的后备方案）
   */
  getDefaultPrompt() {
    return `你是一个专业的语音转录内容校对助手。你的任务是：

1. **修正错别字和语音识别错误**：
   - 纠正明显的错别字
   - 修正语音识别导致的同音字错误
   - 修正语句不通顺的地方
   - 保持原意，不要过度修改

2. **判断说话人角色**：
   - 根据对话内容，判断每个说话人是"客户"还是"我方"
   - 客户特征：提问题、咨询、表达需求、反馈问题
   - 我方特征：回答问题、介绍产品、提供方案、引导对话
   - 如果无法确定，标记为 "unknown"

**输出格式**（必须严格遵循 JSON 格式）：
\`\`\`json
{
  "dialogues": [
    {
      "timeRange": "00:00-00:02",
      "speaker": "SPEAKER_1",
      "originalText": "原始文本",
      "correctedText": "修正后的文本",
      "role": "customer",
      "confidence": 0.9,
      "changes": ["错别字1 → 修正1", "错别字2 → 修正2"]
    }
  ],
  "summary": {
    "totalDialogues": 10,
    "correctedCount": 5,
    "customerSpeakers": ["SPEAKER_1"],
    "ourSideSpeakers": ["SPEAKER_2"]
  }
}
\`\`\`

**角色判断依据**：
- customer（客户）：提问、咨询、表达需求、反馈问题
- our_side（我方）：回答、介绍、解释、引导
- unknown（未知）：无法确定

**注意**：
1. 只输出 JSON，不要有其他文字
2. 如果文本没有错误，correctedText 与 originalText 相同
3. changes 数组只包含实际修改的内容
4. confidence 是角色判断的置信度（0-1）`;
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

      const result = JSON.parse(jsonStr);

      // 验证结果格式
      if (!result.dialogues || !Array.isArray(result.dialogues)) {
        throw new Error('AI 返回格式错误：缺少 dialogues 数组');
      }

      if (!result.summary) {
        throw new Error('AI 返回格式错误：缺少 summary 对象');
      }

      return result;

    } catch (error) {
      logger.error('❌ 解析 AI 响应失败:', error);
      logger.error('原始响应:', response);
      throw new Error('AI 返回格式错误，无法解析');
    }
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
   * 提取角色设置
   * 
   * @param {Array} correctedDialogues - 修正后的对话
   * @returns {Object} 角色设置对象 { "SPEAKER_1": "customer", ... }
   */
  extractRoleSettings(correctedDialogues) {
    const roles = {};
    
    correctedDialogues.forEach(dialogue => {
      if (dialogue.role && dialogue.role !== 'unknown') {
        roles[dialogue.speaker] = dialogue.role;
      }
    });

    return roles;
  }
}

module.exports = new TranscriptionAiService();

