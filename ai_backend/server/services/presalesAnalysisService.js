/**
 * 售前交流综合分析服务
 * 
 * 负责：
 * 1. 对整体售前对话进行综合分析
 * 2. 从多个维度分析对话内容
 * 3. 提供可操作的建议和行动方案
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const aiService = require('./aiServiceUnified')
const promptTemplateService = require('./promptTemplateService')
const logger = require('../utils/logger')

const prisma = new PrismaClient()
const SCENE_TYPE = 'presales_analysis'

class PresalesAnalysisService {
  constructor() {
    this.aiService = aiService
  }

  /**
   * 对售前对话进行综合分析
   * @param {string|Array} dialogueContent - 对话内容（字符串或对话数组）
   * @param {Object} options - 选项
   * @param {string} options.modelId - 模型ID（可选，不传则使用默认模型）
   * @param {string} options.promptCode - 提示词代码（可选，不传则使用默认提示词）
   * @param {Object} options.metadata - 元数据（如客户信息、对话时间等）
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeDialogue(dialogueContent, options = {}) {
    try {
      logger.info('开始售前交流综合分析')

      // 1. 格式化对话内容
      let formattedDialogue = ''
      if (Array.isArray(dialogueContent)) {
        // 如果是数组，格式化为文本
        formattedDialogue = dialogueContent.map((item, index) => {
          const speaker = item.speaker || item.role || '参与者'
          const content = item.content || item.text || ''
          const time = item.time ? ` [${item.time}]` : ''
          return `${speaker}${time}：${content}`
        }).join('\n\n')
      } else if (typeof dialogueContent === 'string') {
        formattedDialogue = dialogueContent
      } else {
        throw new Error('对话内容格式不正确，应为字符串或数组')
      }

      if (!formattedDialogue || formattedDialogue.trim() === '') {
        throw new Error('对话内容为空，无法分析')
      }

      logger.debug(`对话内容长度: ${formattedDialogue.length} 字符`)

      // 2. 构建提示词变量
      const variables = {
        dialogueContent: formattedDialogue,
        metadata: options.metadata ? JSON.stringify(options.metadata, null, 2) : ''
      }

      // 3. 调用AI进行分析
      let promptConfig
      if (options.promptCode) {
        // 使用指定的提示词模板
        promptConfig = {
          code: options.promptCode,
          variables
        }
      } else {
        // 使用场景默认提示词
        promptConfig = {
          variables: {
            ...variables,
            dialogueContent: formattedDialogue
          }
        }
      }

      logger.info('调用AI进行售前交流分析...')
      const aiResponse = await this.aiService.chat(
        SCENE_TYPE,
        promptConfig,
        {
          modelId: options.modelId,
          temperature: 0.7,
          max_tokens: 4000
        }
      )

      // 4. 解析AI返回的JSON
      let analysisResult
      try {
        // 尝试直接解析JSON
        analysisResult = JSON.parse(aiResponse)
      } catch (parseError) {
        // 如果直接解析失败，尝试提取JSON部分
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisResult = JSON.parse(jsonMatch[0])
        } else {
          throw new Error(`AI返回内容不是有效的JSON格式: ${aiResponse.substring(0, 200)}`)
        }
      }

      // 5. 验证分析结果结构
      this.validateAnalysisResult(analysisResult)

      logger.success('售前交流综合分析完成')
      return {
        success: true,
        data: analysisResult,
        metadata: {
          dialogueLength: formattedDialogue.length,
          analysisTime: new Date().toISOString(),
          modelId: options.modelId || 'default'
        }
      }

    } catch (error) {
      logger.error('售前交流综合分析失败:', error)
      throw error
    }
  }

  /**
   * 验证分析结果结构
   * @param {Object} result - 分析结果
   */
  validateAnalysisResult(result) {
    if (!result || typeof result !== 'object') {
      throw new Error('分析结果格式错误：应为对象')
    }

    // 验证必需字段
    const requiredFields = ['summary', 'analysis_details', 'recommendations']
    for (const field of requiredFields) {
      if (!result[field]) {
        throw new Error(`分析结果缺少必需字段: ${field}`)
      }
    }

    // 验证summary结构
    if (!result.summary.overall_impression) {
      throw new Error('分析结果缺少summary.overall_impression字段')
    }

    // 验证confidence
    if (result.confidence === undefined || result.confidence === null) {
      result.confidence = 0.8 // 设置默认值
    }
  }

  /**
   * 从转录记录ID获取对话内容并分析
   * @param {string} transcriptionId - 转录记录ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeByTranscriptionId(transcriptionId, options = {}) {
    try {
      // 1. 获取转录记录
      const transcription = await prisma.transcriptions.findUnique({
        where: { id: transcriptionId }
      })

      if (!transcription) {
        throw new Error(`转录记录不存在: ${transcriptionId}`)
      }

      // 2. 确定要分析的对话内容（优先使用最后一次合并完成后的内容）
      let dialogues = []

      // 最优先：再次合并后的对话
      const reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
        where: {
          transcription_id: transcriptionId,
          note1: '再次合并对话'
        },
        orderBy: { created_at: 'desc' }
      })

      if (reMergeAdjustment && reMergeAdjustment.adjusted_dialogues) {
        dialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
          ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
          : reMergeAdjustment.adjusted_dialogues
      } else {
        // 其次：AI修正后的对话
        const aiAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: transcriptionId,
            note1: 'AI错别字修正'
          },
          orderBy: { created_at: 'desc' }
        })

        if (aiAdjustment && aiAdjustment.adjusted_dialogues) {
          dialogues = typeof aiAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(aiAdjustment.adjusted_dialogues)
            : aiAdjustment.adjusted_dialogues
        } else if (transcription.dialogues) {
          // 最后：原始对话
          dialogues = typeof transcription.dialogues === 'string'
            ? JSON.parse(transcription.dialogues)
            : transcription.dialogues
        }
      }

      if (!dialogues || dialogues.length === 0) {
        throw new Error('转录记录中没有可用的对话内容')
      }

      // 3. 构建元数据
      const metadata = {
        transcriptionId,
        transcriptionName: transcription.name,
        dialogueCount: dialogues.length,
        createdAt: transcription.created_at
      }

      // 4. 进行分析
      return await this.analyzeDialogue(dialogues, {
        ...options,
        metadata
      })

    } catch (error) {
      logger.error(`从转录记录分析失败 [${transcriptionId}]:`, error)
      throw error
    }
  }

  /**
   * 从会话ID获取对话内容并分析
   * @param {string} sessionId - 会话ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeBySessionId(sessionId, options = {}) {
    try {
      // 1. 获取会话信息
      const session = await prisma.sessions.findUnique({
        where: { id: sessionId },
        include: {
          transcriptions: {
            orderBy: { created_at: 'asc' }
          }
        }
      })

      if (!session) {
        throw new Error(`会话不存在: ${sessionId}`)
      }

      // 2. 收集所有转录记录的对话内容
      const allDialogues = []
      for (const transcription of session.transcriptions) {
        // 获取每个转录记录的对话内容（使用相同的优先级逻辑）
        let dialogues = []

        const reMergeAdjustment = await prisma.dialogue_adjustments.findFirst({
          where: {
            transcription_id: transcription.id,
            note1: '再次合并对话'
          },
          orderBy: { created_at: 'desc' }
        })

        if (reMergeAdjustment && reMergeAdjustment.adjusted_dialogues) {
          dialogues = typeof reMergeAdjustment.adjusted_dialogues === 'string'
            ? JSON.parse(reMergeAdjustment.adjusted_dialogues)
            : reMergeAdjustment.adjusted_dialogues
        } else {
          const aiAdjustment = await prisma.dialogue_adjustments.findFirst({
            where: {
              transcription_id: transcription.id,
              note1: 'AI错别字修正'
            },
            orderBy: { created_at: 'desc' }
          })

          if (aiAdjustment && aiAdjustment.adjusted_dialogues) {
            dialogues = typeof aiAdjustment.adjusted_dialogues === 'string'
              ? JSON.parse(aiAdjustment.adjusted_dialogues)
              : aiAdjustment.adjusted_dialogues
          } else if (transcription.dialogues) {
            dialogues = typeof transcription.dialogues === 'string'
              ? JSON.parse(transcription.dialogues)
              : transcription.dialogues
          }
        }

        if (dialogues && dialogues.length > 0) {
          allDialogues.push(...dialogues)
        }
      }

      if (allDialogues.length === 0) {
        throw new Error('会话中没有可用的对话内容')
      }

      // 3. 构建元数据
      const metadata = {
        sessionId,
        sessionName: session.name,
        transcriptionCount: session.transcriptions.length,
        dialogueCount: allDialogues.length,
        createdAt: session.created_at
      }

      // 4. 进行分析
      return await this.analyzeDialogue(allDialogues, {
        ...options,
        metadata
      })

    } catch (error) {
      logger.error(`从会话分析失败 [${sessionId}]:`, error)
      throw error
    }
  }

  /**
   * 保存分析结果到数据库
   * @param {string} transcriptionId - 转录记录ID
   * @param {Object} analysisResult - 分析结果
   * @param {Object} options - 选项
   * @returns {Promise<string>} 分析结果ID
   */
  async saveAnalysisResult(transcriptionId, analysisResult, options = {}) {
    try {
      const { v4: uuidv4 } = require('uuid')
      const resultId = uuidv4()

      // 获取模型和提示词信息
      let modelName = null
      let promptName = null

      if (options.modelId) {
        try {
          const modelConfig = await prisma.ai_model_configs.findUnique({
            where: { id: options.modelId }
          })
          if (modelConfig) {
            modelName = modelConfig.name
          }
        } catch (e) {
          logger.warn('获取模型信息失败:', e)
        }
      }

      if (options.promptCode) {
        try {
          const promptTemplate = await prisma.prompt_templates.findUnique({
            where: { code: options.promptCode }
          })
          if (promptTemplate) {
            promptName = promptTemplate.name
          }
        } catch (e) {
          logger.warn('获取提示词信息失败:', e)
        }
      }

      // 保存分析结果
      await prisma.presales_analysis_results.create({
        data: {
          id: resultId,
          transcription_id: transcriptionId,
          model_id: options.modelId || null,
          model_name: modelName,
          prompt_code: options.promptCode || null,
          prompt_name: promptName,
          analysis_result: JSON.stringify(analysisResult),
          dialogue_count: options.dialogueCount || 0,
          analysis_time: options.analysisTime || null,
          confidence: analysisResult.confidence || null,
          status: 'completed'
        }
      })

      logger.success(`分析结果已保存: ${resultId}`)
      return resultId

    } catch (error) {
      logger.error('保存分析结果失败:', error)
      throw error
    }
  }

  /**
   * 获取分析结果
   * @param {string} transcriptionId - 转录记录ID
   * @returns {Promise<Object|null>} 分析结果
   */
  async getAnalysisResult(transcriptionId) {
    try {
      const result = await prisma.presales_analysis_results.findFirst({
        where: {
          transcription_id: transcriptionId,
          status: 'completed'
        },
        orderBy: {
          created_at: 'desc'
        }
      })

      if (!result) {
        return null
      }

      // 解析分析结果
      let analysisResult = null
      try {
        analysisResult = typeof result.analysis_result === 'string'
          ? JSON.parse(result.analysis_result)
          : result.analysis_result
      } catch (e) {
        logger.error('解析分析结果失败:', e)
        return null
      }

      return {
        id: result.id,
        transcriptionId: result.transcription_id,
        modelId: result.model_id,
        modelName: result.model_name,
        promptCode: result.prompt_code,
        promptName: result.prompt_name,
        analysisResult,
        dialogueCount: result.dialogue_count,
        analysisTime: result.analysis_time,
        confidence: result.confidence ? Number(result.confidence) : null,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      }

    } catch (error) {
      logger.error('获取分析结果失败:', error)
      throw error
    }
  }

  /**
   * 获取已设置角色的转录记录列表
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 转录记录列表
   */
  async getAvailableTranscriptions(options = {}) {
    try {
      const { page = 1, pageSize = 20 } = options
      const skip = (page - 1) * pageSize

      // 第一步：只从 dialogue_adjustments 表查找有角色设置的转录记录ID
      // 只要 speaker_roles 不为空即可，不限制 note1
      const roleAdjustments = await prisma.dialogue_adjustments.findMany({
        where: {
          speaker_roles: {
            not: null
          }
        },
        select: {
          transcription_id: true
        }
      })

      // 使用 Set 去重，获取所有有角色设置的转录记录ID
      const transcriptionIdsWithRoles = new Set()
      roleAdjustments.forEach(r => {
        if (r.transcription_id) {
          transcriptionIdsWithRoles.add(r.transcription_id)
        }
      })

      // 如果没有符合条件的记录，直接返回
      if (transcriptionIdsWithRoles.size === 0) {
        return {
          list: [],
          total: 0,
          page,
          pageSize,
          totalPages: 0
        }
      }

      // 第二步：根据符合条件的ID列表，查询转录记录详情（带分页）
      const validTranscriptionIds = Array.from(transcriptionIdsWithRoles)

      // 先获取总数
      const totalCount = validTranscriptionIds.length

      // 分页查询详情（只要求有角色设置，不要求其他条件）
      const transcriptions = await prisma.transcriptions.findMany({
        where: {
          id: {
            in: validTranscriptionIds
          }
        },
        orderBy: {
          created_at: 'desc'
        },
        skip,
        take: pageSize,
        include: {
          presales_analysis_results: {
            where: {
              status: 'completed'
            },
            orderBy: {
              created_at: 'desc'
            },
            take: 1
          }
        }
      })

      // 构建返回列表
      const availableTranscriptions = transcriptions.map(transcription => ({
        id: transcription.id,
        name: transcription.name,
        originalFileName: transcription.original_file_name,
        customerName: transcription.customer_name,
        createdAt: transcription.created_at,
        hasAnalysis: transcription.presales_analysis_results.length > 0,
        analysisResult: transcription.presales_analysis_results[0] || null
      }))

      return {
        list: availableTranscriptions,
        total: totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize)
      }

    } catch (error) {
      logger.error('获取可用转录记录列表失败:', error)
      throw error
    }
  }
}

module.exports = new PresalesAnalysisService()

