/**
 * 招标文件分析服务
 *
 * 三阶段流程：
 *  1. 提取招标关键信息（评分标准、资质要求等）
 *  2. 生成投标目录结构
 *  3. 逐章节填充默认内容
 */

require('dotenv').config()

const prisma = require('../utils/prisma')
const aiService = require('./aiService')
const documentParserService = require('./documentParserService')
const {
  buildExtractInfoMessages,
  buildDirectoryMessages,
  buildFillContentMessages,
} = require('../prompts/tenderAnalysisPrompt')
const { getSectionTypeName } = require('../config/bidSectionTypes')
const logger = require('../utils/logger')


class TenderAnalysisService {
  constructor() {
    this.SCENE_TYPE = 'tender_analysis'
  }

  // ======================== 文件上传 ========================

  /**
   * 保存上传的招标文件并创建记录
   */
  async uploadFile(file, createdBy = null) {
    const id = `tender_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const fileType = documentParserService.getFileType(file.originalname)

    const record = await prisma.tender_documents.create({
      data: {
        id,
        name: file.originalname,
        file_path: file.path,
        file_type: fileType,
        file_size: BigInt(file.size),
        status: 'uploaded',
        created_by: createdBy,
      },
    })

    logger.info(`[招标分析] 文件上传成功: ${file.originalname} (${id})`)
    return record
  }

  // ======================== 完整分析流程 ========================

  /**
   * 执行完整的招标分析流程（SSE 流式返回进度）
   * @param {string} tenderId
   * @param {string|null} modelName
   * @param {Function} onProgress - (step, total, data) => void
   */
  async analyzeFullFlow(tenderId, modelName = null, onProgress = null) {
    const doc = await prisma.tender_documents.findUnique({ where: { id: tenderId } })
    if (!doc) throw new Error('招标文件不存在')

    if (!modelName) {
      modelName = await this._getDefaultModelName()
    }

    const totalSteps = 3

    try {
      // ---- Step 1: 提取文本 + HTML ----
      this._emit(onProgress, 1, totalSteps, { type: 'step', message: '正在提取文档文本...' })
      await prisma.tender_documents.update({ where: { id: tenderId }, data: { status: 'extracting' } })

      let rawText = doc.raw_text
      if (!rawText) {
        // 同时提取纯文本（给AI用）和 HTML（存文件，给前端展示用）
        const [text, htmlResult] = await Promise.all([
          documentParserService.extractText(doc.file_path),
          documentParserService.extractHtml(doc.file_path, tenderId),
        ])
        rawText = text
        this._emit(onProgress, 1, totalSteps, { type: 'info', message: `提取完成，包含 ${htmlResult.imageCount} 张图片` })
        await prisma.tender_documents.update({
          where: { id: tenderId },
          data: { raw_text: rawText, raw_html_path: htmlResult.htmlPath },
        })
      }

      if (!rawText || rawText.trim().length < 50) {
        throw new Error('文档文本内容过短，无法进行有效分析')
      }

      // 文本过长时截断（保留前 30000 字符给 AI）
      const textForAI = rawText.length > 30000 ? rawText.slice(0, 30000) + '\n\n...（文档内容过长，已截断）' : rawText

      // ---- Step 2: AI 提取关键信息 + 生成目录 ----
      this._emit(onProgress, 2, totalSteps, { type: 'step', message: '正在AI分析招标要求并生成投标目录...' })
      await prisma.tender_documents.update({ where: { id: tenderId }, data: { status: 'analyzing', model_name: modelName } })

      const analysisResult = await this._extractKeyInfo(textForAI, modelName)

      // 更新分析结果到数据库
      await prisma.tender_documents.update({
        where: { id: tenderId },
        data: {
          analysis_result: analysisResult,
          project_name: analysisResult.project_name || null,
          bid_deadline: analysisResult.bid_deadline || null,
          budget: analysisResult.budget || null,
        },
      })

      this._emit(onProgress, 2, totalSteps, { type: 'info', message: `提取到 ${analysisResult.scoring_criteria?.length || 0} 项评分标准` })

      // 生成投标目录
      const rawDirectory = await this._generateDirectory(analysisResult, modelName)
      const directoryTree = this._extractArray(rawDirectory)

      logger.info(`[招标分析] 目录树提取结果: 共 ${directoryTree.length} 个顶级节点`)

      // 将目录树存入 bid_directory_items 表
      const itemCount = await this._saveDirectoryTree(tenderId, directoryTree)

      await prisma.tender_documents.update({
        where: { id: tenderId },
        data: { directory_json: directoryTree },
      })

      this._emit(onProgress, 2, totalSteps, { type: 'info', message: `生成 ${itemCount} 个目录项` })

      // ---- Step 3: 逐章节填充内容 ----
      this._emit(onProgress, 3, totalSteps, { type: 'step', message: '正在AI填充各章节默认内容...' })

      const leafItems = await prisma.bid_directory_items.findMany({
        where: {
          tender_id: tenderId,
          children: { none: {} },
        },
        orderBy: { sort_order: 'asc' },
      })

      let filledCount = 0
      for (const item of leafItems) {
        try {
          const content = await this._fillSectionContent(item, analysisResult, modelName)
          await prisma.bid_directory_items.update({
            where: { id: item.id },
            data: {
              default_content: content,
              content_status: 'ai_generated',
            },
          })
          filledCount++
          this._emit(onProgress, 3, totalSteps, {
            type: 'fill_progress',
            current: filledCount,
            total: leafItems.length,
            title: item.title,
          })
        } catch (err) {
          logger.error(`[招标分析] 章节填充失败: ${item.title}`, err.message)
        }

        // 避免 API 调用过快
        if (filledCount < leafItems.length) {
          await this._delay(500)
        }
      }

      // ---- 完成 ----
      await prisma.tender_documents.update({
        where: { id: tenderId },
        data: { status: 'completed' },
      })

      return {
        tenderId,
        status: 'completed',
        analysisResult,
        directoryItemCount: itemCount,
        filledCount,
        totalLeafSections: leafItems.length,
      }
    } catch (error) {
      await prisma.tender_documents.update({
        where: { id: tenderId },
        data: { status: 'failed', error_message: error.message },
      }).catch(() => {})
      throw error
    }
  }

  // ======================== 内部方法 ========================

  async _extractKeyInfo(text, modelName) {
    const messages = buildExtractInfoMessages(text)
    this._logAIRequest('提取关键信息', modelName, messages)
    const response = await aiService.chat(modelName, messages, { temperature: 0.3, maxTokens: 4000 })
    this._logAIResponse('提取关键信息', response)
    return this._parseJSON(response)
  }

  async _generateDirectory(analysisResult, modelName) {
    const messages = buildDirectoryMessages(analysisResult)
    this._logAIRequest('生成投标目录', modelName, messages)
    const response = await aiService.chat(modelName, messages, { temperature: 0.3, maxTokens: 4000 })
    this._logAIResponse('生成投标目录', response)
    return this._parseJSON(response)
  }

  async _fillSectionContent(item, analysisResult, modelName) {
    const typeName = getSectionTypeName(item.section_type)
    const messages = buildFillContentMessages(item.title, typeName, analysisResult, item.scoring_weight)
    this._logAIRequest(`填充章节[${item.title}]`, modelName, messages)
    const response = await aiService.chat(modelName, messages, { temperature: 0.5, maxTokens: 3000 })
    this._logAIResponse(`填充章节[${item.title}]`, response)
    return response
  }

  /**
   * 将 AI 生成的目录树递归存入数据库
   */
  async _saveDirectoryTree(tenderId, tree, parentId = null) {
    if (!Array.isArray(tree)) return 0
    let count = 0
    for (const node of tree) {
      const id = `biddir_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      await prisma.bid_directory_items.create({
        data: {
          id,
          tender_id: tenderId,
          parent_id: parentId,
          title: node.title,
          level: node.level || 1,
          sort_order: node.sort_order || count,
          section_type: node.section_type || 'other',
          scoring_weight: node.scoring_weight ?? null,
        },
      })
      count++
      if (node.children && node.children.length > 0) {
        count += await this._saveDirectoryTree(tenderId, node.children, id)
      }
      await this._delay(5) // 避免 ID 时间戳冲突
    }
    return count
  }

  // ======================== 查询方法 ========================

  async getList(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize
    const [list, total] = await Promise.all([
      prisma.tender_documents.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, file_type: true, file_size: true,
          status: true, project_name: true, bid_deadline: true, budget: true,
          model_name: true, created_by: true, created_at: true, updated_at: true,
          _count: { select: { bid_directory_items: true } },
        },
      }),
      prisma.tender_documents.count(),
    ])
    return { list, total, page, pageSize }
  }

  async getDetail(tenderId) {
    const doc = await prisma.tender_documents.findUnique({
      where: { id: tenderId },
    })
    if (!doc) throw new Error('招标文件不存在')
    return doc
  }

  async getDirectory(tenderId) {
    const items = await prisma.bid_directory_items.findMany({
      where: { tender_id: tenderId },
      orderBy: [{ level: 'asc' }, { sort_order: 'asc' }],
    })
    return this._buildTree(items)
  }

  async updateDirectoryItem(itemId, data) {
    const existing = await prisma.bid_directory_items.findUnique({ where: { id: itemId } })
    if (!existing) throw new Error('目录项不存在')

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.user_content !== undefined) {
      updateData.user_content = data.user_content
      updateData.content_status = 'user_edited'
    }
    if (data.section_type !== undefined) updateData.section_type = data.section_type

    return prisma.bid_directory_items.update({ where: { id: itemId }, data: updateData })
  }

  /**
   * 重新生成某个目录项的内容
   */
  async regenerateSection(tenderId, itemId, modelName = null) {
    const tender = await prisma.tender_documents.findUnique({ where: { id: tenderId } })
    if (!tender) throw new Error('招标文件不存在')
    if (!tender.analysis_result) throw new Error('招标文件尚未分析')

    const item = await prisma.bid_directory_items.findUnique({ where: { id: itemId } })
    if (!item) throw new Error('目录项不存在')

    const usedModel = modelName || tender.model_name || await this._getDefaultModelName()
    const content = await this._fillSectionContent(item, tender.analysis_result, usedModel)

    await prisma.bid_directory_items.update({
      where: { id: itemId },
      data: { default_content: content, content_status: 'ai_generated' },
    })

    return { id: itemId, default_content: content }
  }

  async deleteTender(tenderId) {
    const doc = await prisma.tender_documents.findUnique({ where: { id: tenderId } })
    if (!doc) throw new Error('招标文件不存在')
    await prisma.tender_documents.delete({ where: { id: tenderId } })
    return { success: true }
  }

  // ======================== 工具方法 ========================

  _parseJSON(text) {
    const strategies = [
      // 策略1: ```json ... ``` 代码块
      () => {
        const m = text.match(/```json\s*([\s\S]*?)\s*```/)
        return m ? m[1].trim() : null
      },
      // 策略2: ``` ... ``` 代码块
      () => {
        const m = text.match(/```\s*([\s\S]*?)\s*```/)
        return m ? m[1].trim() : null
      },
      // 策略3: 找到最外层 { } 配对（贪婪匹配最后一个 }）
      () => {
        const start = text.indexOf('{')
        if (start === -1) return null
        const lastEnd = text.lastIndexOf('}')
        if (lastEnd === -1) return null
        return text.slice(start, lastEnd + 1)
      },
      // 策略4: 找到最外层 [ ] 配对
      () => {
        const start = text.indexOf('[')
        if (start === -1) return null
        const lastEnd = text.lastIndexOf(']')
        if (lastEnd === -1) return null
        return text.slice(start, lastEnd + 1)
      },
      // 策略5: 去掉首尾非JSON字符后直接解析
      () => text.replace(/^[^[{]*/, '').replace(/[^\]}]*$/, '').trim() || null,
    ]

    for (let i = 0; i < strategies.length; i++) {
      try {
        const candidate = strategies[i]()
        if (!candidate) continue
        return JSON.parse(candidate)
      } catch (_) {
        // 当前策略失败，继续下一个
      }
    }

    // 全部失败，打印完整原文方便排查
    logger.error(`[招标分析] JSON解析全部失败，AI原始返回内容:\n${text}`)
    throw new Error('AI 返回格式不正确，无法解析 JSON，已将原文输出到日志')
  }

  _buildTree(items) {
    const map = new Map()
    const roots = []
    items.forEach(item => map.set(item.id, { ...item, children: [] }))
    items.forEach(item => {
      const node = map.get(item.id)
      if (item.parent_id && map.has(item.parent_id)) {
        map.get(item.parent_id).children.push(node)
      } else {
        roots.push(node)
      }
    })
    return roots
  }

  /**
   * 从 AI 返回的解析结果中提取数组
   * AI 可能返回直接数组 [...] 或包装对象 {"directory": [...], ...}
   */
  _extractArray(parsed) {
    if (Array.isArray(parsed)) return parsed

    if (parsed && typeof parsed === 'object') {
      // 遍历所有字段，找第一个数组值
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
          logger.info(`[招标分析] AI返回了包装对象，从字段 "${key}" 提取到数组(${parsed[key].length}项)`)
          return parsed[key]
        }
      }
    }

    logger.error(`[招标分析] 无法从AI返回中提取目录数组，原始类型: ${typeof parsed}，内容: ${JSON.stringify(parsed).slice(0, 300)}`)
    return []
  }

  _logAIRequest(stage, modelName, messages) {
    logger.info(`[招标分析][${stage}] ====== 请求开始 ======`)
    logger.info(`[招标分析][${stage}] 模型: ${modelName}`)
    for (const msg of messages) {
      const preview = msg.content.length > 500
        ? msg.content.slice(0, 500) + `...(共${msg.content.length}字，已截断)`
        : msg.content
      logger.info(`[招标分析][${stage}] [${msg.role}] ${preview}`)
    }
  }

  _logAIResponse(stage, response) {
    const preview = response.length > 1000
      ? response.slice(0, 1000) + `...(共${response.length}字，已截断)`
      : response
    logger.info(`[招标分析][${stage}] ====== AI返回 ======`)
    logger.info(`[招标分析][${stage}] ${preview}`)
  }

  _emit(callback, step, total, data) {
    if (callback) callback(step, total, data)
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  async _getDefaultModelName() {
    try {
      const { modelConfigService } = require('./index')
      const model = await modelConfigService.getDefaultModel(this.SCENE_TYPE)
      if (model) return model.model_name
    } catch (e) {
      logger.warn('[招标分析] 未找到默认模型配置，将使用请求中指定的模型')
    }
    return null
  }
}

module.exports = new TenderAnalysisService()
