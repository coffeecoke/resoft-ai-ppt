/**
 * 问答对分类服务
 * 
 * 负责：
 * 1. 调用AI对问答对进行分类
 * 2. 根据分类表(concern_categories)进行分类标注
 * 3. 更新concerns表的category_id和intent_code字段
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const aiService = require('./aiServiceUnified')
const promptTemplateService = require('./promptTemplateService')
const logger = require('../utils/logger')

const prisma = new PrismaClient()
const SCENE_TYPE = 'qa_classification'

class ConcernClassificationService {
  constructor() {
    this.aiService = aiService
  }

  /**
   * 辅助函数：解析 keywords 字段
   * 兼容字符串 "a,b,c" 或 JSON数组 '["a","b","c"]' 或数组 ["a","b","c"]
   * @param {string|Array} keywords - 关键词字段
   * @returns {Array<string>} 关键词数组
   */
  parseKeywords(keywords) {
    if (!keywords) return []
    
    if (Array.isArray(keywords)) {
      return keywords.filter(k => k && k.trim())
    }
    
    if (typeof keywords === 'string') {
      // 判断是否是JSON数组格式
      if (keywords.startsWith('[')) {
        try {
          const parsed = JSON.parse(keywords)
          return Array.isArray(parsed) ? parsed.filter(k => k && k.trim()) : []
        } catch (e) {
          // JSON解析失败，按逗号分割
          return keywords.split(',').map(k => k.trim()).filter(k => k)
        }
      } else {
        // 直接按逗号分割
        return keywords.split(',').map(k => k.trim()).filter(k => k)
      }
    }
    
    return []
  }

  /**
   * 对单个问答对进行分类
   * @param {string} concernId - 问答对ID
   * @param {Object} options - 选项
   * @param {string} options.modelId - 模型ID（可选，不传则使用默认模型）
   * @param {string} options.promptCode - 提示词代码（可选，不传则使用默认提示词）
   * @returns {Promise<Object>} 分类结果
   */
  async classifyConcern(concernId, options = {}) {
    try {
      // 1. 获取问答对数据
      const concern = await prisma.concerns.findUnique({
        where: { id: concernId },
        include: {
          concern_categories: true
        }
      })

      if (!concern) {
        throw new Error(`问答对不存在: ${concernId}`)
      }

      if (!concern.question || concern.question.trim() === '') {
        throw new Error('问答对问题内容为空，无法分类')
      }

      logger.info(`开始对问答对进行分类: ${concernId}`)

      // 2. 获取分类表数据（level=2的分类类别和level=3的问题性质）
      const categories = await prisma.concern_categories.findMany({
        where: {
          level: { in: [2, 3] },
          is_active: true
        },
        orderBy: [
          { level: 'asc' },
          { sort_order: 'asc' }
        ]
      })

      if (!categories || categories.length === 0) {
        throw new Error('分类表数据为空，请先初始化分类数据')
      }

      // 分离level=2和level=3的分类
      const categoryLevel2 = categories.filter(c => c.level === 2) // 分类类别
      const categoryLevel3 = categories.filter(c => c.level === 3) // 问题性质

      // 3. 构建分类数据（精简版：参考PPT分析的格式）
      // 只提取必要的分类信息，使用紧凑的列表格式，包含关键词
      const categoriesLevel2List = categoryLevel2.map((c, index) => {
        const keywordsArray = this.parseKeywords(c.keywords)
        const keywordsText = keywordsArray.length > 0 
          ? `\n**关键词**：${keywordsArray.join('、')}`
          : ''
        return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
      }).join('\n\n')
      
      const categoriesLevel3List = categoryLevel3.map((c, index) => {
        const keywordsArray = this.parseKeywords(c.keywords)
        const keywordsText = keywordsArray.length > 0 
          ? `\n**关键词**：${keywordsArray.join('、')}`
          : ''
        return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
      }).join('\n\n')
      
      // 生成有效的分类代码列表（用于约束）
      const validCodesLevel2 = categoryLevel2.map(c => c.code).join('、')
      const validCodesLevel3 = categoryLevel3.map(c => c.code).join('、')
      
      // 构建分类详细说明（用于提示词模板，精简版）
      const categoriesLevel2Details = categoryLevel2.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description || '',
        keywords: this.parseKeywords(c.keywords)
      }))
      
      const categoriesLevel3Details = categoryLevel3.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description || '',
        keywords: this.parseKeywords(c.keywords)
      }))

      // 4. 构建提示词
      // 先获取提示词模板，然后手动替换变量
      let promptTemplate
      if (options.promptCode) {
        // 使用指定的提示词模板
        const template = await promptTemplateService.getPromptByCode(options.promptCode, {})
        promptTemplate = template
      } else {
        // 使用场景默认提示词
        try {
          promptTemplate = await promptTemplateService.getPrompt(SCENE_TYPE, {})
        } catch (error) {
          // 如果数据库中没有提示词模板，使用默认提示词
          logger.warn(`未找到场景 ${SCENE_TYPE} 的提示词模板，使用默认提示词`)
          promptTemplate = this.getDefaultClassificationPrompt(categoriesLevel2Details, categoriesLevel3Details)
        }
      }

      // 替换占位符（如果模板使用了占位符格式）
      if (promptTemplate.includes('{categories_level2}') || promptTemplate.includes('{valid_codes_level2}')) {
        // 使用占位符格式，直接替换
        promptTemplate = promptTemplate
          .replace('{categories_level2}', categoriesLevel2List)
          .replace('{categories_level3}', categoriesLevel3List)
          .replace('{valid_codes_level2}', validCodesLevel2)
          .replace('{valid_codes_level3}', validCodesLevel3)
      } else {
        // 如果模板中没有分类信息，则添加（兼容旧模板）
        // 检测是否包含分类标准（新的格式）或分类类别列表（旧的格式）
        const hasCategories = promptTemplate.includes('分类标准') || 
                             promptTemplate.includes('分类类别参考') ||
                             promptTemplate.includes('categories_level2') || 
                             promptTemplate.includes('分类类别列表')
        
        if (!hasCategories) {
          promptTemplate = this.injectCategoriesIntoPrompt(promptTemplate, categoriesLevel2Details, categoriesLevel3Details)
        }
      }

      // 5. 构建输入数据（包含ID、问题和答案，分类信息已在提示词中）
      const inputData = {
        id: concern.id,              // 问答对ID（用于返回结果时对应）
        question: concern.question,
        answer: concern.answer || ''
      }

      // 构建完整的提示词（在模板末尾添加输入数据）
      const finalPrompt = `${promptTemplate}

## 输入数据

\`\`\`json
${JSON.stringify(inputData, null, 2)}
\`\`\`

请对以上问答对进行分类，只输出JSON结果，不要有任何其他说明文字。`

      // 6. 记录发送内容到日志
      logger.info(`[问答对分类] 发送内容 [${concernId}]:`, {
        concernId: concernId,
        modelId: options.modelId || '默认模型',
        promptLength: finalPrompt.length,
        inputData: inputData,
        promptPreview: finalPrompt.substring(0, 500) + (finalPrompt.length > 500 ? '...' : '')
      })
      logger.debug(`[问答对分类] 完整提示词 [${concernId}]:\n${finalPrompt}`)

      // 7. 调用AI进行分类
      const aiResponse = await this.aiService.chat(SCENE_TYPE, finalPrompt, {
        modelId: options.modelId
      })

      // 8. 记录接收内容到日志
      logger.info(`[问答对分类] 接收内容 [${concernId}]:`, {
        concernId: concernId,
        responseLength: aiResponse.length,
        responsePreview: aiResponse.substring(0, 500) + (aiResponse.length > 500 ? '...' : '')
      })
      logger.debug(`[问答对分类] 完整AI响应 [${concernId}]:\n${aiResponse}`)

      // 9. 解析AI返回结果（传入期望的ID用于验证）
      const classificationResult = this.parseClassificationResult(aiResponse, concernId)
      
      logger.info(`[问答对分类] 解析结果 [${concernId}]:`, classificationResult)

      // 7. 验证分类结果（验证返回的ID是否匹配）
      if (classificationResult.id && classificationResult.id !== concernId) {
        logger.warn(`问答对ID不匹配: 期望 ${concernId}, 实际 ${classificationResult.id}`)
        // 如果ID不匹配，使用方法参数中的ID（更可靠）
        classificationResult.id = concernId
      } else if (!classificationResult.id) {
        // 如果返回结果中没有ID，使用方法参数中的ID
        classificationResult.id = concernId
      }

      // 8. 验证分类结果
      const validatedResult = this.validateClassificationResult(
        classificationResult,
        categoryLevel2,
        categoryLevel3
      )

      // 10. 更新数据库
      const updateData = {}
      
      // 更新category_id（level=2的分类类别）
      if (validatedResult.category_code) {
        const category = categoryLevel2.find(c => c.code === validatedResult.category_code)
        if (category) {
          updateData.category_id = category.id
          updateData.category = category.code // 兼容旧字段
        }
      }

      // 更新intent_code（level=3的问题性质）
      if (validatedResult.intent_code) {
        updateData.intent_code = validatedResult.intent_code
      }

      // 更新数据库
      if (Object.keys(updateData).length > 0) {
        await prisma.concerns.update({
          where: { id: concernId },
          data: updateData
        })
        logger.info(`[问答对分类] 入库成功 [${concernId}]:`, {
          concernId: concernId,
          category_code: validatedResult.category_code || '未分类',
          intent_code: validatedResult.intent_code || '未分类',
          category_id: updateData.category_id || null,
          updatedFields: Object.keys(updateData)
        })
        logger.success(`问答对分类成功: ${concernId} - 类别: ${validatedResult.category_code || '未分类'}, 性质: ${validatedResult.intent_code || '未分类'}`)
      } else {
        logger.warn(`[问答对分类] 分类结果为空，未更新数据库 [${concernId}]`)
      }

      return {
        success: true,
        concernId,
        classification: validatedResult,
        updated: updateData
      }

    } catch (error) {
      logger.error(`问答对分类失败: ${concernId}`, error)
      throw error
    }
  }

  /**
   * 批量对问答对进行分类（每批最多50个，一次发送）
   * @param {Array<string>} concernIds - 问答对ID数组
   * @param {Object} options - 选项
   * @param {string} options.modelId - 模型ID（可选）
   * @param {string} options.promptCode - 提示词代码（可选）
   * @param {number} options.batchSize - 每批数量（默认50）
   * @param {Function} options.onProgress - 进度回调 (current, total) => void
   * @returns {Promise<Object>} 批量分类结果
   */
  async classifyConcerns(concernIds, options = {}) {
    const batchSize = options.batchSize || 50  // 每批50个问答对
    const results = []
    const errors = []
    const total = concernIds.length

    logger.info(`[批量分类] 开始批量分类问答对: 总数=${total}, 每批=${batchSize}个`)

    // 1. 读取模型配置（如果未指定modelId）
    let modelId = options.modelId
    if (!modelId) {
      try {
        const { modelConfigService } = require('./index')
        const defaultModel = await modelConfigService.getDefaultModel(SCENE_TYPE)
        if (defaultModel) {
          modelId = defaultModel.id
          logger.info(`[批量分类] 使用默认模型配置: ${defaultModel.name} (ID: ${modelId})`)
        }
      } catch (error) {
        logger.warn(`[批量分类] 读取模型配置失败: ${error.message}`)
      }
    }

    // 2. 获取分类表数据（只需获取一次）
    const categories = await prisma.concern_categories.findMany({
      where: {
        level: { in: [2, 3] },
        is_active: true
      },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })

    if (!categories || categories.length === 0) {
      throw new Error('分类表数据为空，请先初始化分类数据')
    }

    const categoryLevel2 = categories.filter(c => c.level === 2)
    const categoryLevel3 = categories.filter(c => c.level === 3)

    // 3. 构建分类数据（只构建一次）
    const categoriesLevel2List = categoryLevel2.map((c, index) => {
      const keywordsArray = this.parseKeywords(c.keywords)
      const keywordsText = keywordsArray.length > 0 
        ? `\n**关键词**：${keywordsArray.join('、')}`
        : ''
      return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
    }).join('\n\n')
    
    const categoriesLevel3List = categoryLevel3.map((c, index) => {
      const keywordsArray = this.parseKeywords(c.keywords)
      const keywordsText = keywordsArray.length > 0 
        ? `\n**关键词**：${keywordsArray.join('、')}`
        : ''
      return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
    }).join('\n\n')
    
    const validCodesLevel2 = categoryLevel2.map(c => c.code).join('、')
    const validCodesLevel3 = categoryLevel3.map(c => c.code).join('、')

    // 4. 获取提示词模板（只获取一次）
    let promptTemplate
    if (options.promptCode) {
      promptTemplate = await promptTemplateService.getPromptByCode(options.promptCode, {})
      logger.info(`[批量分类] 使用指定提示词: ${options.promptCode}`)
    } else {
      try {
        promptTemplate = await promptTemplateService.getPrompt(SCENE_TYPE, {})
        logger.info(`[批量分类] 使用场景默认提示词`)
      } catch (error) {
        logger.warn(`[批量分类] 未找到提示词模板，使用代码默认提示词`)
        promptTemplate = this.getDefaultClassificationPrompt(
          categoryLevel2.map(c => ({ 
            code: c.code, 
            name: c.name, 
            description: c.description || '', 
            keywords: this.parseKeywords(c.keywords)
          })),
          categoryLevel3.map(c => ({ 
            code: c.code, 
            name: c.name, 
            description: c.description || '', 
            keywords: this.parseKeywords(c.keywords)
          }))
        )
      }
    }

    // 5. 替换占位符（只替换一次）
    if (promptTemplate.includes('{categories_level2}') || promptTemplate.includes('{valid_codes_level2}')) {
      promptTemplate = promptTemplate
        .replace('{categories_level2}', categoriesLevel2List)
        .replace('{categories_level3}', categoriesLevel3List)
        .replace('{valid_codes_level2}', validCodesLevel2)
        .replace('{valid_codes_level3}', validCodesLevel3)
    }

    // 6. 分批处理（每批50个，一次发送）
    const totalBatches = Math.ceil(total / batchSize)
    logger.info(`[批量分类] 将分 ${totalBatches} 批处理`)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * batchSize
      const batchEnd = Math.min(batchStart + batchSize, total)
      const batch = concernIds.slice(batchStart, batchEnd)
      const batchNumber = batchIndex + 1

      logger.info(`[批量分类] 处理第 ${batchNumber}/${totalBatches} 批: ${batch.length} 个问答对 (${batchStart + 1}-${batchEnd})`)

      try {
        // 6.1 获取这批问答对的数据
        const concerns = await prisma.concerns.findMany({
          where: { id: { in: batch } }
        })

        // 6.2 构建输入数据（包含多个问答对）
        const inputData = concerns.map(c => ({
          id: c.id,
          question: c.question,
          answer: c.answer || ''
        }))

        // 6.3 构建完整提示词（一个提示词 + 多个问答对）
        const finalPrompt = `${promptTemplate}

## 输入数据（共 ${inputData.length} 个问答对）

\`\`\`json
${JSON.stringify(inputData, null, 2)}
\`\`\`

## ⚠️ 输出要求（极其重要）

请对以上所有问答对进行分类，返回一个JSON数组。

**严格要求**：
1. ✅ **必须返回 ${inputData.length} 个分类结果**（与输入数量完全一致）
2. ✅ **必须按输入顺序返回**（第1个输入对应第1个输出，第2个对应第2个，以此类推）
3. ✅ **每个结果的 \`id\` 字段必须与输入的 \`id\` 完全一致**
4. ❌ **不要遗漏任何问答对**
5. ❌ **不要改变顺序**
6. ❌ **不要添加输入中不存在的ID**
7. ⚠️ **只输出JSON数组**，不要有任何其他说明文字

**示例输出格式**：
\`\`\`json
[
  {
    "id": "${inputData[0]?.id || '第1个问答对的ID'}",
    "category_code": "2.3",
    "intent_code": "I1",
    "confidence": 0.95
  },
  {
    "id": "${inputData[1]?.id || '第2个问答对的ID'}",
    "category_code": "1.1",
    "intent_code": "I2",
    "confidence": 0.90
  }${inputData.length > 2 ? ',\n  ...' : ''}
]
\`\`\`

**再次强调**：输出数组的顺序必须与输入完全一致，ID必须精确匹配！`

        // 6.4 记录发送内容
        logger.info(`[批量分类] 第 ${batchNumber} 批发送内容:`, {
          batchNumber,
          concernCount: inputData.length,
          promptLength: finalPrompt.length,
          concernIds: batch
        })
        logger.debug(`[批量分类] 第 ${batchNumber} 批完整提示词:\n${finalPrompt}`)

        // 6.5 调用AI（一次请求处理多个问答对）
        const aiResponse = await this.aiService.chat(SCENE_TYPE, finalPrompt, {
          modelId: modelId
        })

        // 6.6 记录接收内容
        logger.info(`[批量分类] 第 ${batchNumber} 批接收内容:`, {
          batchNumber,
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 500) + (aiResponse.length > 500 ? '...' : '')
        })
        logger.debug(`[批量分类] 第 ${batchNumber} 批完整响应:\n${aiResponse}`)

        // 6.7 解析AI返回的结果（应该是一个数组）
        const classificationResults = this.parseBatchClassificationResult(aiResponse, batch)

        // 6.8 更新数据库
        let batchSuccessCount = 0
        let batchErrorCount = 0

        for (const result of classificationResults) {
          try {
            const validatedResult = this.validateClassificationResult(result, categoryLevel2, categoryLevel3)
            
            const updateData = {}
            if (validatedResult.category_code) {
              const category = categoryLevel2.find(c => c.code === validatedResult.category_code)
              if (category) {
                updateData.category_id = category.id
                updateData.category = category.code
              }
            }
            if (validatedResult.intent_code) {
              updateData.intent_code = validatedResult.intent_code
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.concerns.update({
                where: { id: result.id },
                data: updateData
              })
              
              results.push({
                success: true,
                concernId: result.id,
                classification: validatedResult,
                updated: updateData
              })
              batchSuccessCount++
              
              logger.debug(`[批量分类] 问答对分类成功 [${result.id}]: 类别=${validatedResult.category_code}, 性质=${validatedResult.intent_code}`)
            }
          } catch (error) {
            errors.push({
              concernId: result.id,
              error: error.message || error
            })
            batchErrorCount++
            logger.error(`[批量分类] 问答对分类失败 [${result.id}]:`, error)
          }
        }

        logger.info(`[批量分类] 第 ${batchNumber}/${totalBatches} 批完成: 成功 ${batchSuccessCount}, 失败 ${batchErrorCount}`)

        // 进度回调
        if (options.onProgress) {
          options.onProgress(results.length, total)
        }

      } catch (error) {
        logger.error(`[批量分类] 第 ${batchNumber} 批处理失败:`, error)
        // 整批失败，记录所有问答对为失败
        batch.forEach(concernId => {
          errors.push({
            concernId,
            error: error.message || error
          })
        })
      }
    }

    logger.info(`[批量分类] 批量分类完成: 总数=${total}, 成功=${results.length}, 失败=${errors.length}`)

    return {
      success: true,
      total,
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors
    }
  }

  /**
   * 对指定转录记录的所有问答对进行分类
   * @param {string} transcriptionId - 转录记录ID
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 分类结果
   */
  async classifyConcernsByTranscription(transcriptionId, options = {}) {
    try {
      // 1. 查询该转录记录的所有问答对
      const concerns = await prisma.concerns.findMany({
        where: {
          transcription_id: transcriptionId
        },
        select: {
          id: true,
          question: true
        }
      })

      if (!concerns || concerns.length === 0) {
        return {
          success: true,
          message: '该转录记录没有问答对',
          total: 0,
          results: []
        }
      }

      // 2. 批量分类
      const concernIds = concerns.map(c => c.id)
      const result = await this.classifyConcerns(concernIds, {
        modelId: options.modelId,
        promptCode: options.promptCode,
        concurrency: options.concurrency || 3,
        onProgress: options.onProgress
      })

      return {
        success: true,
        transcriptionId,
        ...result
      }

    } catch (error) {
      logger.error(`按转录记录分类失败: ${transcriptionId}`, error)
      throw error
    }
  }

  /**
   * 解析AI返回的批量分类结果（数组格式）
   * @param {string} aiResponse - AI返回的文本
   * @param {Array<string>} expectedIds - 期望的问答对ID列表（用于验证）
   * @returns {Array<Object>} 解析后的分类结果数组
   */
  parseBatchClassificationResult(aiResponse, expectedIds = []) {
    try {
      // 尝试解析JSON
      let jsonStr = aiResponse.trim()
      
      // 如果包含代码块，提取JSON部分
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      // 尝试解析JSON
      const results = JSON.parse(jsonStr)

      // 验证结果格式（应该是数组）
      if (!Array.isArray(results)) {
        throw new Error('AI返回结果不是数组格式')
      }

      logger.info(`[批量分类] 解析到 ${results.length} 个分类结果，期望 ${expectedIds.length} 个`)

      // 构建期望ID集合（用于验证）
      const expectedIdSet = new Set(expectedIds)
      
      // 处理每个结果，并验证ID
      const parsedResults = []
      const returnedIds = new Set()
      
      for (const result of results) {
        const returnedId = result.id || null
        
        if (!returnedId) {
          logger.error(`[批量分类] AI返回的结果缺少ID字段:`, result)
          continue
        }
        
        // 检查返回的ID是否在期望列表中
        if (!expectedIdSet.has(returnedId)) {
          logger.warn(`[批量分类] AI返回了不在期望列表中的ID: ${returnedId}`)
        }
        
        // 检查重复ID
        if (returnedIds.has(returnedId)) {
          logger.warn(`[批量分类] AI返回了重复的ID: ${returnedId}`)
          continue
        }
        
        returnedIds.add(returnedId)
        
        parsedResults.push({
          id: returnedId,
          category_code: result.category_code || result.categoryCode || null,
          intent_code: result.intent_code || result.intentCode || null,
          confidence: result.confidence || null,
          reason: result.reason || result.explanation || null
        })
      }
      
      // 检查是否有遗漏的ID
      const missingIds = expectedIds.filter(id => !returnedIds.has(id))
      if (missingIds.length > 0) {
        logger.warn(`[批量分类] AI未返回以下ID的分类结果: ${missingIds.join(', ')}`)
        logger.warn(`[批量分类] 遗漏数量: ${missingIds.length}/${expectedIds.length}`)
      }
      
      logger.info(`[批量分类] 成功解析 ${parsedResults.length}/${expectedIds.length} 个分类结果`)
      
      return parsedResults

    } catch (error) {
      logger.error(`[批量分类] 解析AI返回结果失败:`, error)
      logger.error(`[批量分类] 原始响应内容: ${aiResponse}`)
      
      // 返回空数组，调用方会处理
      return []
    }
  }

  /**
   * 解析AI返回的单个分类结果（对象格式，用于单个分类）
   * @param {string} aiResponse - AI返回的文本
   * @param {string} expectedId - 期望的问答对ID（用于验证）
   * @returns {Object} 解析后的分类结果
   */
  parseClassificationResult(aiResponse, expectedId = null) {
    try {
      // 尝试解析JSON
      // AI可能返回纯JSON或包含JSON的文本
      let jsonStr = aiResponse.trim()
      
      // 如果包含代码块，提取JSON部分
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      // 尝试解析JSON
      const result = JSON.parse(jsonStr)

      // 验证结果格式
      if (typeof result !== 'object') {
        throw new Error('AI返回结果不是对象格式')
      }

      // 提取ID（如果AI返回了ID，用于验证）
      const returnedId = result.id || null
      
      // 如果期望ID存在且返回的ID不匹配，记录警告
      if (expectedId && returnedId && returnedId !== expectedId) {
        logger.warn(`AI返回的ID与期望不匹配: 期望 ${expectedId}, 实际 ${returnedId}`)
      }

      return {
        id: returnedId || expectedId || null,  // 优先使用返回的ID，否则使用期望的ID
        category_code: result.category_code || result.categoryCode || null,
        intent_code: result.intent_code || result.intentCode || null,
        confidence: result.confidence || null,
        reason: result.reason || result.explanation || null
      }

    } catch (error) {
      // 如果解析失败，尝试从文本中提取
      logger.warn('AI返回结果解析失败，尝试文本提取', error.message)
      
      // 尝试提取分类代码（如 "2.3" 或 "I1"）
      const categoryMatch = aiResponse.match(/(?:类别|分类)[：:]\s*([\d.]+)/i) || 
                           aiResponse.match(/category[：:]\s*([\d.]+)/i) ||
                           aiResponse.match(/(\d+\.\d+)/)
      
      const intentMatch = aiResponse.match(/(?:性质|意图)[：:]\s*(I\d+)/i) ||
                         aiResponse.match(/intent[：:]\s*(I\d+)/i) ||
                         aiResponse.match(/(I\d+)/)

      return {
        id: expectedId || null,  // 如果解析失败，使用期望的ID
        category_code: categoryMatch ? categoryMatch[1] : null,
        intent_code: intentMatch ? intentMatch[1] : null,
        confidence: null,
        reason: aiResponse
      }
    }
  }

  /**
   * 验证分类结果
   * @param {Object} result - 解析后的分类结果
   * @param {Array} categoryLevel2 - level=2的分类列表
   * @param {Array} categoryLevel3 - level=3的分类列表
   * @returns {Object} 验证后的分类结果
   */
  validateClassificationResult(result, categoryLevel2, categoryLevel3) {
    const validated = {
      id: result.id || null,  // 保留ID字段
      category_code: null,
      intent_code: null,
      confidence: result.confidence,
      reason: result.reason
    }

    // 验证category_code（level=2）
    if (result.category_code) {
      const category = categoryLevel2.find(c => c.code === result.category_code)
      if (category) {
        validated.category_code = category.code
      } else {
        logger.warn(`无效的分类类别代码: ${result.category_code}`)
      }
    }

    // 验证intent_code（level=3）
    if (result.intent_code) {
      const intent = categoryLevel3.find(c => c.code === result.intent_code)
      if (intent) {
        validated.intent_code = intent.code
      } else {
        logger.warn(`无效的问题性质代码: ${result.intent_code}`)
      }
    }

    return validated
  }

  /**
   * 将分类信息注入到提示词模板中（用于自定义提示词模板）
   * @param {string} template - 提示词模板
   * @param {Array} categoriesLevel2 - 分类类别列表（level=2）
   * @param {Array} categoriesLevel3 - 问题性质列表（level=3）
   * @returns {string} 注入分类信息后的提示词
   */
  injectCategoriesIntoPrompt(template, categoriesLevel2, categoriesLevel3) {
    // 构建分类列表（参考PPT分析的紧凑格式，包含关键词）
    const categoriesLevel2List = categoriesLevel2.map((c, index) => {
      const keywordsArray = this.parseKeywords(c.keywords)
      const keywordsText = keywordsArray.length > 0 
        ? `\n**关键词**：${keywordsArray.join('、')}`
        : ''
      return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
    }).join('\n\n')
    
    const categoriesLevel3List = categoriesLevel3.map((c, index) => {
      const keywordsArray = this.parseKeywords(c.keywords)
      const keywordsText = keywordsArray.length > 0 
        ? `\n**关键词**：${keywordsArray.join('、')}`
        : ''
      return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
    }).join('\n\n')
    
    // 生成有效的分类代码列表（用于约束）
    const validCodesLevel2 = categoriesLevel2.map(c => c.code).join('、')
    const validCodesLevel3 = categoriesLevel3.map(c => c.code).join('、')
    
    // 构建分类详细说明（JSON格式，仅用于参考，不强制包含）
    const categoriesLevel2Json = JSON.stringify(
      categoriesLevel2.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description || '',
        keywords: c.keywords || []
      })), 
      null, 
      2
    )
    const categoriesLevel3Json = JSON.stringify(
      categoriesLevel3.map(c => ({
        code: c.code,
        name: c.name,
        description: c.description || '',
        keywords: this.parseKeywords(c.keywords)
      })), 
      null, 
      2
    )
    
    // 在模板中查找插入位置（在"输入格式"或"## 输入"之前）
    const insertMarker = template.includes('## 📥 输入格式') 
      ? '## 📥 输入格式'
      : template.includes('## 输入格式')
        ? '## 输入格式'
        : template.includes('## 📤 输出格式')
          ? '## 📤 输出格式'
          : '## 📋 任务说明'
    
    const insertIndex = template.indexOf(insertMarker)
    
    if (insertIndex === -1) {
      // 如果找不到插入位置，在模板开头添加
      return `${template}

## 📋 分类标准

### 分类类别（level=2）

${categoriesLevel2List}

**有效代码列表**：${validCodesLevel2}

### 问题性质（level=3）

${categoriesLevel3List}

**有效代码列表**：${validCodesLevel3}

## ⚠️ 重要约束

1. **category_code** 必须从以下列表中选择：${validCodesLevel2}
2. **intent_code** 必须从以下列表中选择：${validCodesLevel3}
3. **如果无法确定分类类别**：应该归类到"其他"（代码：0.0），不要设置为 null
4. **如果无法确定问题性质**：可以设置为 null，但要在 reason 中说明原因

---
`
    }
    
    // 在插入位置之前添加分类信息
    const before = template.substring(0, insertIndex)
    const after = template.substring(insertIndex)
    
    return `${before}

## 📋 分类标准

### 分类类别（level=2）

${categoriesLevel2List}

**有效代码列表**：${validCodesLevel2}

### 问题性质（level=3）

${categoriesLevel3List}

**有效代码列表**：${validCodesLevel3}

## ⚠️ 重要约束

1. **category_code** 必须从以下列表中选择：${validCodesLevel2}
2. **intent_code** 必须从以下列表中选择：${validCodesLevel3}
3. **如果无法确定分类类别**：应该归类到"其他"（代码：0.0），不要设置为 null
4. **如果无法确定问题性质**：可以设置为 null，但要在 reason 中说明原因

---

${after}`
  }

  /**
   * 获取默认的分类提示词
   * @param {Array} categoriesLevel2 - 分类类别列表（level=2）
   * @param {Array} categoriesLevel3 - 问题性质列表（level=3）
   * @returns {string} 默认提示词
   */
  getDefaultClassificationPrompt(categoriesLevel2 = [], categoriesLevel3 = []) {
    // 构建分类列表（参考PPT分析的紧凑格式，包含关键词）
    const categoriesLevel2List = categoriesLevel2.length > 0
      ? categoriesLevel2.map((c, index) => {
          const keywordsArray = this.parseKeywords(c.keywords)
          const keywordsText = keywordsArray.length > 0 
            ? `\n**关键词**：${keywordsArray.join('、')}`
            : ''
          return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
        }).join('\n\n')
      : '（分类列表将在运行时注入）'
    
    const categoriesLevel3List = categoriesLevel3.length > 0
      ? categoriesLevel3.map((c, index) => {
          const keywordsArray = this.parseKeywords(c.keywords)
          const keywordsText = keywordsArray.length > 0 
            ? `\n**关键词**：${keywordsArray.join('、')}`
            : ''
          return `### ${index + 1}. ${c.name} (${c.code})\n${c.description || ''}${keywordsText}`
        }).join('\n\n')
      : '（分类列表将在运行时注入）'
    
    // 生成有效的分类代码列表（用于约束）
    const validCodesLevel2 = categoriesLevel2.length > 0
      ? categoriesLevel2.map(c => c.code).join('、')
      : ''
    
    const validCodesLevel3 = categoriesLevel3.length > 0
      ? categoriesLevel3.map(c => c.code).join('、')
      : ''
    
    return `你是一位资深的售前沟通分析专家，专注于对客户问答对进行分类标注。

## 📋 任务说明

对给定的问答对进行分类，需要同时标注：
1. **分类类别**（level=2）：从预定义的分类类别中选择一个（如"1.1", "2.3"等）
2. **问题性质**（level=3）：从预定义的问题性质中选择一个（如"I1", "I2"等）

## 📋 分类标准

### 分类类别（level=2）

${categoriesLevel2List}

**有效代码列表**：${validCodesLevel2}

### 问题性质（level=3）

${categoriesLevel3List}

**有效代码列表**：${validCodesLevel3}

## ⚠️ 重要约束

1. **category_code** 必须从以下列表中选择：${validCodesLevel2}
2. **intent_code** 必须从以下列表中选择：${validCodesLevel3}
3. **如果无法确定分类类别**：应该归类到"其他"（代码：0.0），不要设置为 null
4. **如果无法确定问题性质**：可以设置为 null，但要在 reason 中说明原因

## 📥 输入格式

输入为JSON对象，包含：
- \`id\`: 问答对ID（用于标识，返回结果时需要包含此ID）
- \`question\`: 问题内容
- \`answer\`: 回答内容（可能为空）

**注意**：分类类别和问题性质的详细说明已在上述"分类标准"部分提供，请参考该部分进行分类。

## 📤 输出格式（严格JSON）

**必须严格遵循以下JSON格式**：

\`\`\`json
{
  "id": "问答对ID（必须与输入数据中的id一致）",
  "category_code": "2.3",
  "intent_code": "I1",
  "confidence": 0.95
}
\`\`\`

**可选字段**：
- \`reason\`: 分类理由（可选，如果提供，简要说明为什么这样分类，50-200字）

**重要规则**：
1. **只输出JSON对象**：不要有任何其他说明文字
2. **id**：必须与输入数据中的id字段完全一致，用于标识对应的问答对
3. **category_code**：必须是上述有效代码列表中的某个值，**如果无法确定分类类别，必须使用"0.0"（其他）**，不要设置为null
4. **intent_code**：必须是上述有效代码列表中的某个值，如果无法确定可以为null
5. **confidence**：置信度（0-1之间的浮点数），表示分类的把握程度
6. **reason**：分类理由（可选字段，可以不返回）

## 分类原则

1. **分类类别（level=2）**：
   - 仔细阅读问题内容，匹配最符合的分类类别
   - 参考分类的description和keywords字段
   - 如果问题涉及多个类别，选择最主要的一个

2. **问题性质（level=3）**：
   - I1: 明确购买意向
   - I2: 信息咨询
   - I3: 疑虑与担忧
   - I4: 需求确认
   - I5: 其他

请根据问题内容，准确判断客户意图。`;
  }
}

module.exports = new ConcernClassificationService()


