/**
 * 投标文件分析服务
 *
 * 核心流程：
 *  1. 上传投标文件 → 提取纯文本（给AI用）
 *  2. AI 识别一级章节结构（返回 start_keyword 列表）
 *  3. 调用 Python splitter.py → 按章节切割为独立 .docx 文件（保留表格/图片/格式）
 *  4. AI 逐章节分类打标 → 存入章节库（docx_file_path + 纯文本 + 分类）
 */

require('dotenv').config()

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { spawn } = require('node:child_process')
const path = require('node:path')
const aiService = require('./aiService')
const documentParserService = require('./documentParserService')
const {
  buildSplitStructureMessages,
  buildClassifySectionMessages,
  buildLevel2StructureMessages,
} = require('../prompts/bidAnalysisPrompt')
const { getSectionTypeName } = require('../config/bidSectionTypes')
const logger = require('../utils/logger')
const { getUploadBaseDir, toRelativePath, toAbsolutePath } = require('../utils/pathHelper')

const SPLITTER_SCRIPT = path.join(__dirname, '../../python_services/doc_splitter/splitter.py')
// 章节文件输出目录：函数调用时动态获取，避免模块加载时 dotenv 未就绪
function getSectionsOutputDir() {
  return path.join(getUploadBaseDir(), 'bid-sections')
}

const prisma = new PrismaClient()

class BidAnalysisService {
  constructor() {
    this.SCENE_TYPE = 'bid_analysis'
    // 章节类型缓存，5分钟 TTL（避免每次分类都查 DB）
    this._sectionTypesCache = null
    this._sectionTypesCacheAt = 0
  }

  /**
   * 从数据库获取章节类型文本（用于 AI Prompt），带缓存
   * 格式：1. cover_letter — 投标函/承诺书：投标函、投标承诺书...
   */
  async _getSectionTypesText() {
    const TTL = 5 * 60 * 1000 // 5分钟
    if (this._sectionTypesCache && Date.now() - this._sectionTypesCacheAt < TTL) {
      return this._sectionTypesCache
    }
    try {
      const types = await prisma.bid_section_types.findMany({
        where: { is_active: true },
        orderBy: { sort_order: 'asc' },
        select: { code: true, name: true, description: true },
      })
      if (types.length > 0) {
        this._sectionTypesCache = types
          .map((t, i) => `${i + 1}. ${t.code} — ${t.name}：${t.description}`)
          .join('\n')
        this._sectionTypesCacheAt = Date.now()
        return this._sectionTypesCache
      }
    } catch (err) {
      logger.warn(`[投标分析] 从数据库加载章节类型失败，降级使用静态配置: ${err.message}`)
    }
    return null // 返回 null → prompt 内部用静态配置降级
  }

  // ======================== 文件上传 ========================

  async uploadFile(file, meta = {}) {
    const id = `biddoc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const fileType = documentParserService.getFileType(file.originalname)

    const record = await prisma.bid_documents.create({
      data: {
        id,
        name: file.originalname,
        file_path: file.path,
        file_type: fileType,
        file_size: BigInt(file.size),
        status: 'uploaded',
        source_info: meta.sourceInfo || null,
        industry: meta.industry || null,
        project_type: meta.projectType || null,
        created_by: meta.createdBy || null,
      },
    })

    logger.info(`[投标分析] 文件上传成功: ${file.originalname} (${id})`)
    return record
  }

  // ======================== 完整拆分流程 ========================

  /**
   * 执行投标文件拆分（SSE 流式返回进度）
   */
  async splitFullFlow(bidDocId, modelName = null, onProgress = null) {
    const doc = await prisma.bid_documents.findUnique({ where: { id: bidDocId } })
    if (!doc) throw new Error('投标文件不存在')

    if (!modelName) {
      modelName = await this._getDefaultModelName()
    }

    try {
      // ---- Step 1: 提取文本 + HTML ----
      this._emit(onProgress, 1, 3, { type: 'step', message: '正在提取文档文本...' })
      await prisma.bid_documents.update({ where: { id: bidDocId }, data: { status: 'extracting' } })

      let rawText = doc.raw_text
      if (!rawText) {
        // file_path 数据库存的是相对路径，使用前还原为绝对路径
        const absFilePath = toAbsolutePath(doc.file_path)
        rawText = await documentParserService.extractText(absFilePath)
        await prisma.bid_documents.update({
          where: { id: bidDocId },
          data: { raw_text: rawText },
        })
      }

      if (!rawText || rawText.trim().length < 50) {
        throw new Error('文档文本内容过短，无法进行有效拆分')
      }

      // ---- Step 2: 识别章节结构 ----
      this._emit(onProgress, 2, 4, { type: 'step', message: '正在识别章节结构...' })
      await prisma.bid_documents.update({ where: { id: bidDocId }, data: { status: 'splitting', model_name: modelName } })

      let structure = []
      let splitResult = null
      const isDocx = doc.file_type === 'docx'
      const absFilePath = toAbsolutePath(doc.file_path)

      if (isDocx) {
        // ── 策略1：优先用 Python 全量扫描原始文档的所有 H0 标题（不受文本截断影响）──
        this._emit(onProgress, 2, 4, { type: 'step', message: '正在扫描文档章节结构...' })
        try {
          splitResult = await this._splitDocxByPython(absFilePath, bidDocId, [], 0)
          if (splitResult?.success && splitResult.sections?.length >= 2) {
            structure = splitResult.sections.map(s => ({
              title: s.title,
              level: 1,
              start_keyword: s.title,
            }))
            this._emit(onProgress, 2, 4, { type: 'info', message: `Python扫描到 ${structure.length} 个一级章节` })
          }
        } catch (err) {
          logger.warn(`[投标分析] Python扫描章节结构失败，降级为AI识别: ${err.message}`)
        }
      }

      // ── 策略2：Python 扫描失败/结果不足时，fallback 到 AI 文本识别 ──
      if (structure.length < 2) {
        this._emit(onProgress, 2, 4, { type: 'step', message: '正在AI识别章节结构...' })
        // 一级识别取 head+tail，保留首尾内容（章节标题集中在开头和结尾）
        let textForAI
        if (rawText.length <= 30000) {
          textForAI = rawText
        } else {
          const head = rawText.slice(0, 20000)
          const tail = rawText.slice(-8000)
          textForAI = head + '\n\n...（中间正文内容已省略）...\n\n' + tail
        }
        structure = await this._identifyStructure(textForAI, modelName)
        this._emit(onProgress, 2, 4, { type: 'info', message: `AI识别到 ${structure.length} 个一级章节` })

        // AI 识别后再按 structure 做 Python 拆分（获取 docx 文件）
        if (isDocx && structure.length > 0) {
          this._emit(onProgress, 3, 4, { type: 'step', message: '正在拆分为独立章节文件...' })
          try {
            splitResult = await this._splitDocxByPython(absFilePath, bidDocId, structure)
            this._emit(onProgress, 3, 4, { type: 'info', message: `已生成 ${splitResult.sections.length} 个章节文件` })
          } catch (err) {
            logger.warn(`[投标分析] Python拆分失败，降级为纯文本模式: ${err.message}`)
          }
        }
      } else {
        // Python 扫描已经完成了拆分，无需再次调用
        this._emit(onProgress, 3, 4, { type: 'info', message: `已生成 ${splitResult.sections.length} 个章节文件` })
      }

      if (!isDocx) {
        // 非 docx（pdf/txt）降级：直接从纯文本切割
        this._emit(onProgress, 3, 4, { type: 'info', message: '非DOCX文件，使用纯文本切割模式' })
      }

      // 合并切割结果：优先用 Python 结果（带 docx_path），降级用纯文本切割
      const sections = this._mergeSplitResults(rawText, structure, splitResult)

      // ---- Step 4: 逐章节分类打标并存储（含2级子章节拆分）----
      this._emit(onProgress, 4, 4, { type: 'step', message: '正在AI分类打标各章节...' })

      let savedCount = 0
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i]

        // 安全兜底：跳过非一级章节（理论上经过过滤后不会有，但多一道保障）
        if (sec.level && sec.level !== 1) {
          logger.warn(`[投标分析] 跳过非一级章节: ${sec.title} (level=${sec.level})`)
          continue
        }

        try {
          const classification = await this._classifySection(sec.title, sec.content, modelName)

          const sectionId = `bidsec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
          await prisma.bid_sections.create({
            data: {
              id: sectionId,
              bid_document_id: bidDocId,
              parent_section_id: null,
              title: sec.title,
              content: sec.content,
              html_content_path: null,
              docx_file_path: sec.docxPath || null,
              content_length: sec.content.length,
              section_type: classification.section_type || 'other',
              level: 1,
              sort_order: savedCount,
              tags: classification.tags || [],
              quality_score: classification.quality_score ?? null,
              is_reusable: classification.is_reusable !== false,
            },
          })

          savedCount++
          this._emit(onProgress, 4, 4, {
            type: 'split_progress',
            current: savedCount,
            total: sections.length,
            title: sec.title,
            sectionType: getSectionTypeName(classification.section_type),
            hasDocx: !!sec.docxPath,
          })

          // ---- Step 4b: 对该1级章节进行2级子章节拆分 ----
          // 只有内容足够长、且有docxPath时才拆2级
          if (sec.content && sec.content.length > 300 && isDocx && sec.docxPath) {
            await this._splitLevel2(
              sectionId, bidDocId, sec, modelName, onProgress, sections.length
            )
          }
        } catch (err) {
          logger.error(`[投标分析] 章节分类失败: ${sec.title}`, err.message)
        }

        if (i < sections.length - 1) {
          await this._delay(500)
        }
      }

      // 更新文档状态
      await prisma.bid_documents.update({
        where: { id: bidDocId },
        data: { status: 'completed', section_count: savedCount },
      })

      return {
        bidDocId,
        status: 'completed',
        totalSections: sections.length,
        savedSections: savedCount,
      }
    } catch (error) {
      await prisma.bid_documents.update({
        where: { id: bidDocId },
        data: { status: 'failed', error_message: error.message },
      }).catch(() => {})
      throw error
    }
  }

  // ======================== 内部方法 ========================

  /**
   * 调用 Python splitter.py 将 .docx 按章节拆分为独立文件
   * @param {string} filePath          - 原始 .docx 文件的磁盘路径
   * @param {string} bidDocId          - 文档ID（用于建隔离目录）
   * @param {Array}  structure         - AI 返回的章节结构 [{title, start_keyword}, ...]
   * @param {number} targetOutlineLevel - 目标 outlineLevel（0=1级，1=2级，默认0）
   * @returns {Promise<{success, sections: [{title, docx_path, text, error}]}>}
   */
  _splitDocxByPython(filePath, bidDocId, structure, targetOutlineLevel = 0) {
    return new Promise((resolve, reject) => {
      const outputDir = path.join(getSectionsOutputDir(), bidDocId)
      const sectionsJson = JSON.stringify(structure.map(s => ({
        title: s.title,
        start_keyword: s.start_keyword,
      })))

      const args = [SPLITTER_SCRIPT, filePath, outputDir, sectionsJson, String(targetOutlineLevel)]
      const child = spawn('python', args, {
        timeout: 120000, // 2分钟超时
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', d => { stdout += d.toString() })
      child.stderr.on('data', d => { stderr += d.toString() })

      child.on('close', (code) => {
        if (stderr) {
          logger.warn(`[投标分析] Python splitter stderr: ${stderr.slice(0, 500)}`)
        }
        try {
          const result = JSON.parse(stdout.trim())
          if (result.success) {
            resolve(result)
          } else {
            reject(new Error(result.error || 'Python拆分返回失败'))
          }
        } catch (e) {
          reject(new Error(`Python输出解析失败 (exit=${code}): ${stdout.slice(0, 200)}`))
        }
      })

      child.on('error', (err) => {
        reject(new Error(`无法启动Python进程: ${err.message}`))
      })
    })
  }

  /**
   * 合并 Python 拆分结果和纯文本切割结果
   * Python 成功时优先用 docx_path 和 text；失败时降级为纯文本切割
   */
  _mergeSplitResults(rawText, structure, pythonResult) {
    // 构建 structure 的 title→level 映射（只有 level=1 的才在 structure 里）
    const titleLevelMap = {}
    for (const s of structure) {
      titleLevelMap[s.title] = s.level || 1
    }

    // 有 Python 结果时：以 Python 的 sections 为主（包含 docx_path 和 text）
    if (pythonResult && pythonResult.success && pythonResult.sections.length > 0) {
      return pythonResult.sections
        .filter(sec => {
          // 只保留在 structure 里的一级章节（过滤掉意外混入的多级）
          const level = titleLevelMap[sec.title] ?? 1
          return level === 1
        })
        .map((sec) => ({
          title: sec.title,
          level: titleLevelMap[sec.title] || 1,
          content: sec.text || '',
          // Python 返回的是绝对路径，存 DB 时转为相对路径
          docxPath: sec.docx_path ? toRelativePath(sec.docx_path) : null,
        }))
    }

    // 降级：从纯文本切割（原有逻辑）
    return this._splitTextBySections(rawText, structure)
  }

  async _identifyStructure(text, modelName) {
    const messages = buildSplitStructureMessages(text)
    const response = await aiService.chat(modelName, messages, { temperature: 0.3, maxTokens: 8000 })
    const raw = this._parseJSON(response)

    // 只保留真正的一级章节，过滤掉 AI 误返回的 2/3/4 级
    const level1 = raw.filter(s => {
      // 强制要求 level === 1
      if (s.level && s.level !== 1) return false
      // 过滤掉带小数点的多级编号，如 4.2、1.1.3、三.2 等
      const title = (s.title || '').trim()
      if (/^\d+\.\d+/.test(title)) return false       // 4.2 xxx
      if (/^[一二三四五六七八九十]+\.\d+/.test(title)) return false  // 三.1 xxx
      // 过滤掉明显是子节的括号编号（仅保留"一级括号"形式的顶层章节需要结合上下文判断，这里保守处理）
      return true
    })

    logger.info(`[投标分析] AI识别章节: 原始${raw.length}个, 过滤后${level1.length}个一级章节`)
    return level1
  }

  async _classifySection(title, content, modelName) {
    // 内容过长时截断给 AI
    const contentForAI = content.length > 5000
      ? content.slice(0, 5000) + '\n...（内容过长已截断）'
      : content
    const sectionTypesText = await this._getSectionTypesText()
    const messages = buildClassifySectionMessages(title, contentForAI, sectionTypesText)
    const response = await aiService.chat(modelName, messages, { temperature: 0.3, maxTokens: 1000 })
    return this._parseJSON(response)
  }

  /**
   * 对一个1级章节进行2级子章节拆分入库
   * @param {string} parentSectionId - 已入库的1级章节ID
   * @param {string} bidDocId
   * @param {object} sec - { title, content, docxPath }
   * @param {string} modelName
   */
  async _splitLevel2(parentSectionId, bidDocId, sec, modelName, onProgress, totalLevel1) {
    try {
      const subBidDocId = `${bidDocId}_sub_${parentSectionId.slice(-8)}`
      const absDocxPath = toAbsolutePath(sec.docxPath)

      // ── 策略1：优先用 Python 直接扫描子文档的 level=1 标题（最准确，不受文本截断影响）──
      // 传空 sections，splitter 会自动按所有 outlineLevel=1 标题全量拆分
      let subSplitResult = null
      let level2Structure = []

      try {
        subSplitResult = await this._splitDocxByPython(absDocxPath, subBidDocId, [], 1)

        if (subSplitResult?.success && subSplitResult.sections?.length > 0) {
          // 把 Python 扫描到的标题作为 level2Structure
          level2Structure = subSplitResult.sections.map(s => ({
            title: s.title,
            level: 2,
            start_keyword: s.title,
          }))
          logger.info(`[投标分析] 章节「${sec.title}」Python扫描到 ${level2Structure.length} 个二级子章节`)
        }
      } catch (err) {
        logger.warn(`[投标分析] 2级Python扫描失败，降级为AI识别: ${err.message}`)
      }

      // ── 策略2：Python 扫描失败或无结果时，fallback 到 AI 文本识别 ──
      if (level2Structure.length === 0) {
        level2Structure = await this._identifyLevel2Structure(sec.title, sec.content, modelName)
        if (!level2Structure || level2Structure.length === 0) {
          logger.info(`[投标分析] 章节「${sec.title}」无二级子章节`)
          return
        }
        logger.info(`[投标分析] 章节「${sec.title}」AI识别到 ${level2Structure.length} 个二级子章节`)

        // AI 识别后再调 Python 按识别结果拆分
        try {
          subSplitResult = await this._splitDocxByPython(absDocxPath, subBidDocId, level2Structure, 1)
        } catch (err) {
          logger.warn(`[投标分析] 2级Python拆分失败，降级为纯文本: ${err.message}`)
        }
      }

      // 3. 合并2级拆分结果
      const subSections = this._mergeLevel2Results(sec.content, level2Structure, subSplitResult)

      if (subSections.length === 0) {
        logger.info(`[投标分析] 章节「${sec.title}」二级拆分结果为空，跳过`)
        return
      }

      // 4. 逐一入库2级章节
      for (let j = 0; j < subSections.length; j++) {
        const subSec = subSections[j]
        try {
          const subClassification = await this._classifySection(subSec.title, subSec.content, modelName)
          const subId = `bidsec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
          await prisma.bid_sections.create({
            data: {
              id: subId,
              bid_document_id: bidDocId,
              parent_section_id: parentSectionId,
              title: subSec.title,
              content: subSec.content,
              html_content_path: null,
              docx_file_path: subSec.docxPath || null,
              content_length: subSec.content.length,
              section_type: subClassification.section_type || 'other',
              level: 2,
              sort_order: j,
              tags: subClassification.tags || [],
              quality_score: subClassification.quality_score ?? null,
              is_reusable: subClassification.is_reusable !== false,
            },
          })

          this._emit(onProgress, 4, 4, {
            type: 'split_progress',
            current: `${sec.title} > ${subSec.title}`,
            total: totalLevel1,
            title: subSec.title,
            level: 2,
            sectionType: getSectionTypeName(subClassification.section_type),
            hasDocx: !!subSec.docxPath,
          })

          await this._delay(300)
        } catch (err) {
          logger.error(`[投标分析] 2级章节入库失败: ${subSec.title}`, err.message)
        }
      }
    } catch (err) {
      logger.warn(`[投标分析] 2级拆分整体失败: ${sec.title}`, err.message)
    }
  }

  /**
   * AI识别1级章节内部的2级结构
   */
  async _identifyLevel2Structure(parentTitle, sectionText, modelName) {
    const messages = buildLevel2StructureMessages(parentTitle, sectionText)
    const response = await aiService.chat(modelName, messages, { temperature: 0.3, maxTokens: 4000 })
    let raw
    try {
      raw = this._parseJSON(response)
    } catch {
      return []  // AI返回空数组或解析失败，视为无子章节
    }
    if (!Array.isArray(raw) || raw.length === 0) return []

    // 过滤：只保留 level=2，且标题不是3级以上的
    return raw.filter(s => {
      if (s.level && s.level !== 2) return false
      const title = (s.title || '').trim()
      // 过滤 x.x.x 三级以上编号
      if (/^\d+\.\d+\.\d+/.test(title)) return false
      return true
    })
  }

  /**
   * 合并2级子章节的 Python 拆分结果和纯文本切割结果
   */
  _mergeLevel2Results(parentText, level2Structure, pythonResult) {
    // 构建 title→结构信息 的映射，用于后续匹配
    const titleSet = new Set(level2Structure.map(s => s.title))

    if (pythonResult && pythonResult.success && pythonResult.sections.length > 0) {
      // 模糊匹配：Python 返回的标题与 AI 识别的标题可能存在空格/截断差异
      const mapped = pythonResult.sections
        .map(sec => {
          const matchedTitle = this._fuzzyFindTitle(sec.title, titleSet)
          return matchedTitle ? { ...sec, title: matchedTitle } : sec
        })
        .filter(sec => titleSet.has(sec.title))
        .map(sec => ({
          title: sec.title,
          level: 2,
          content: sec.text || '',
          // Python 返回绝对路径，转为相对路径存 DB
          docxPath: sec.docx_path ? toRelativePath(sec.docx_path) : null,
        }))

      // Python 拆分结果有效（至少命中一个），直接用
      if (mapped.length > 0) return mapped

      // Python 拆分结果一个都没命中（outlineLevel 识别全失败），降级纯文本切割
      logger.warn('[投标分析] 2级Python拆分结果与AI结构全部不匹配，降级为纯文本切割')
    }

    // 降级：从纯文本切割
    return this._splitTextBySections(parentText, level2Structure)
  }

  /**
   * 在 titleSet 中找与 candidate 最相似的标题（去空白后包含匹配）
   */
  _fuzzyFindTitle(candidate, titleSet) {
    if (titleSet.has(candidate)) return candidate
    const norm = s => s.replace(/\s+/g, '').trim()
    const normCandidate = norm(candidate)
    for (const t of titleSet) {
      const normT = norm(t)
      if (normCandidate === normT || normCandidate.includes(normT) || normT.includes(normCandidate)) {
        return t
      }
    }
    return null
  }

  /**
   * 根据 AI 识别的结构从原文中切分内容
   */
  _splitTextBySections(fullText, structure) {
    if (!structure || structure.length === 0) return []

    const sections = []
    for (let i = 0; i < structure.length; i++) {
      const current = structure[i]
      const next = structure[i + 1]

      const startIdx = fullText.indexOf(current.start_keyword)
      if (startIdx === -1) continue

      let endIdx
      if (next && next.start_keyword) {
        endIdx = fullText.indexOf(next.start_keyword, startIdx + 1)
        if (endIdx === -1) endIdx = fullText.length
      } else {
        endIdx = fullText.length
      }

      const content = fullText.slice(startIdx, endIdx).trim()
      if (content.length > 0) {
        sections.push({
          title: current.title,
          level: current.level || 1,
          content,
          docxPath: null, // 降级模式无 docx 文件
        })
      }
    }

    return sections
  }

  // ======================== 查询方法 ========================

  async getList(page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize
    const [list, total] = await Promise.all([
      prisma.bid_documents.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true, name: true, file_type: true, file_size: true,
          status: true, section_count: true, source_info: true,
          industry: true, project_type: true,
          model_name: true, created_by: true, created_at: true,
        },
      }),
      prisma.bid_documents.count(),
    ])
    return { list, total, page, pageSize }
  }

  async getDetail(bidDocId) {
    const doc = await prisma.bid_documents.findUnique({ where: { id: bidDocId } })
    if (!doc) throw new Error('投标文件不存在')
    return doc
  }

  async getSections(bidDocId, filters = {}) {
    const where = { bid_document_id: bidDocId }
    if (filters.sectionType) where.section_type = filters.sectionType
    if (filters.isReusable !== undefined) where.is_reusable = filters.isReusable === 'true'

    return prisma.bid_sections.findMany({
      where,
      orderBy: { sort_order: 'asc' },
    })
  }

  /**
   * 搜索章节库（跨所有投标文件）
   */
  async searchSections(query = {}) {
    const where = {}
    if (query.sectionType) where.section_type = query.sectionType
    if (query.isReusable !== undefined) where.is_reusable = query.isReusable
    if (query.keyword) {
      where.OR = [
        { title: { contains: query.keyword } },
        { content: { contains: query.keyword } },
      ]
    }
    if (query.minQuality) {
      where.quality_score = { gte: parseFloat(query.minQuality) }
    }

    const page = parseInt(query.page) || 1
    const pageSize = parseInt(query.pageSize) || 20
    const skip = (page - 1) * pageSize

    const [list, total] = await Promise.all([
      prisma.bid_sections.findMany({
        where,
        orderBy: { quality_score: 'desc' },
        skip,
        take: pageSize,
        include: {
          bid_documents: { select: { name: true, industry: true, project_type: true } },
        },
      }),
      prisma.bid_sections.count({ where }),
    ])

    return { list, total, page, pageSize }
  }

  async updateSection(sectionId, data) {
    const existing = await prisma.bid_sections.findUnique({ where: { id: sectionId } })
    if (!existing) throw new Error('章节不存在')

    const updateData = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.section_type !== undefined) updateData.section_type = data.section_type
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.is_reusable !== undefined) updateData.is_reusable = data.is_reusable
    if (data.content !== undefined) {
      updateData.content = data.content
      updateData.content_length = data.content.length
    }

    return prisma.bid_sections.update({ where: { id: sectionId }, data: updateData })
  }

  async deleteBidDoc(bidDocId) {
    const doc = await prisma.bid_documents.findUnique({ where: { id: bidDocId } })
    if (!doc) throw new Error('投标文件不存在')
    await prisma.bid_documents.delete({ where: { id: bidDocId } })
    return { success: true }
  }

  // ======================== 工具方法 ========================

  _parseJSON(text) {
    // 1. 优先提取 ```json ... ``` 代码块
    let jsonStr = null
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1]
    }

    // 2. 其次提取普通 ``` 代码块
    if (!jsonStr) {
      const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/)
      if (codeBlockMatch) jsonStr = codeBlockMatch[1]
    }

    // 3. 根据响应首字符判断类型，精准提取（避免对象中的数组字段被误匹配）
    if (!jsonStr) {
      const trimmed = text.trim()
      // 以 [ 开头：优先匹配数组
      if (trimmed.startsWith('[')) {
        const arrayMatch = trimmed.match(/(\[[\s\S]*\])/)
        if (arrayMatch) jsonStr = arrayMatch[1]
      }
      // 以 { 开头：优先匹配对象
      if (!jsonStr && trimmed.startsWith('{')) {
        const objectMatch = trimmed.match(/(\{[\s\S]*\})/)
        if (objectMatch) jsonStr = objectMatch[0]
      }
      // 都不是：先尝试对象（防止 tags 数组误匹配），再尝试数组
      if (!jsonStr) {
        const objectMatch = trimmed.match(/(\{[\s\S]*\})/)
        if (objectMatch) jsonStr = objectMatch[0]
      }
      if (!jsonStr) {
        const arrayMatch = trimmed.match(/(\[[\s\S]*\])/)
        if (arrayMatch) jsonStr = arrayMatch[1]
      }
    }

    if (!jsonStr) {
      throw new Error('AI 返回格式不正确，无法解析 JSON')
    }

    // 尝试直接解析
    try {
      return JSON.parse(jsonStr)
    } catch (e) {
      // 容错修复：JSON 被截断时，尝试补全
      const fixed = this._tryFixTruncatedJSON(jsonStr)
      if (fixed !== null) return fixed
      throw new Error(`AI 返回的 JSON 格式错误: ${e.message}`)
    }
  }

  /**
   * 尝试修复被截断的 JSON（按完整元素边界截断，不切半个对象）
   *
   * 思路：从后往前逐步缩减，每次在 "}, " 或 "}\n" 处截断，
   * 确保保留的每个元素都是完整的 JSON 对象。
   */
  _tryFixTruncatedJSON(str) {
    const isArray = str.trimStart().startsWith('[')
    if (!isArray) {
      // 非数组：单个对象，无法安全截断，直接放弃
      return null
    }

    // 从后往前，依次在每个 "完整元素边界" 尝试截断并解析
    // 完整元素边界特征：`}` 后紧跟 `,`、换行、空格或 `]`
    // 用正则找出所有 `}` 的位置，从最后一个往前逐个尝试
    const bracePositions = []
    for (let i = 0; i < str.length; i++) {
      if (str[i] === '}') bracePositions.push(i)
    }

    // 从最后一个 } 往前尝试，找到第一个能解析成功的完整数组
    for (let i = bracePositions.length - 1; i >= 0; i--) {
      const pos = bracePositions[i]
      const candidate = str.slice(0, pos + 1).trimEnd() + ']'
      try {
        const parsed = JSON.parse(candidate)
        // 必须是数组且至少有一个元素
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
        }
      } catch {
        // 这个截断点不完整，继续往前找
      }
    }

    return null
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
      logger.warn('[投标分析] 未找到默认模型配置')
    }
    return null
  }
}

module.exports = new BidAnalysisService()
