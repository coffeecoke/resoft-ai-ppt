/**
 * 文档提取服务
 * 功能：读取documents表的文档JSON文件，提取内容并保存到slide_merged_contents表
 */

const fs = require('fs').promises
const path = require('path')

// 使用 online-ppt-backend 的 Prisma Client
const prismaClientPath = path.join(__dirname, '../../../online-ppt-backend/node_modules/.prisma/client')
const { PrismaClient } = require(prismaClientPath)

const prisma = new PrismaClient()

// 生成唯一ID（格式：smc_timestamp_random）
function generateId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  return `smc_${timestamp}_${random}`
}

/**
 * 文档提取服务模块
 */
const documentService = {
  /**
   * 获取文档列表（含提取状态）
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @param {string} [params.status] - 状态筛选
   * @param {string} [params.category] - 分类筛选
   * @param {string} [params.keyword] - 搜索关键词
   * @returns {Promise<Object>} 文档列表和分页信息
   */
  async getDocumentList(params) {
    const { page = 1, pageSize = 20, status, category, keyword } = params

    // 构建查询条件
    const where = {}
    if (status) where.status = status
    if (category) where.category = category
    if (keyword) {
      where.OR = [
        { name: { contains: keyword } },
        { customer_name: { contains: keyword } },
      ]
    }

    // 查询总数
    const total = await prisma.documents.count({ where })

    // 分页查询
    const skip = (page - 1) * pageSize
    const documents = await prisma.documents.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        cover: true,
        content_file_path: true,
        slide_count: true,
        file_size: true,
        status: true,
        category: true,
        customer_name: true,
        product: true,
        industry: true,
        audience: true,
        language: true,
        created_at: true,
        updated_at: true,
      },
    })

    // 查询每个文档的提取状态
    const list = await Promise.all(
      documents.map(async (doc) => {
        const extractedCount = await prisma.slide_merged_contents.count({
          where: { document_id: doc.id },
        })

        return {
          id: doc.id,
          name: doc.name,
          cover: doc.cover,
          content_file_path: doc.content_file_path,
          slide_count: doc.slide_count,
          file_size: Number(doc.file_size), // BigInt转Number
          status: doc.status,
          category: doc.category,
          customer_name: doc.customer_name,
          product: doc.product,
          industry: doc.industry,
          audience: doc.audience,
          language: doc.language,
          created_at: doc.created_at,
          updated_at: doc.updated_at,
          is_extracted: extractedCount > 0,
          extracted_count: extractedCount,
        }
      })
    )

    return {
      list,
      total,
      page,
      pageSize,
    }
  },

  /**
   * 检查文档是否存在
   * @param {string} documentId - 文档ID
   * @returns {Promise<boolean>}
   */
  async checkDocumentExists(documentId) {
    const count = await prisma.documents.count({
      where: { id: documentId },
    })
    return count > 0
  },

  /**
   * 检查文档是否已提取
   * @param {string} documentId - 文档ID
   * @returns {Promise<Object>} { isExtracted, count, lastExtractedAt }
   */
  async checkExtractStatus(documentId) {
    const count = await prisma.slide_merged_contents.count({
      where: { document_id: documentId },
    })

    let lastExtractedAt = null
    if (count > 0) {
      const latest = await prisma.slide_merged_contents.findFirst({
        where: { document_id: documentId },
        orderBy: { created_at: 'desc' },
        select: { created_at: true },
      })
      lastExtractedAt = latest?.created_at
    }

    return {
      isExtracted: count > 0,
      count,
      lastExtractedAt,
    }
  },

  /**
   * 读取并解析文档JSON文件
   * @param {string} filePath - 文件路径（从数据库读取的相对路径）
   * @returns {Promise<Object>} 解析后的JSON对象
   */
  async readDocumentJson(filePath) {
    try {
      // 构建完整路径（相对于 online-ppt-backend 项目根目录）
      // ai_backend 和 online-ppt-backend 是同级目录
      const projectRoot = path.join(__dirname, '..', '..', '..', 'online-ppt-backend')
      
      // 数据库中存储的路径格式可能是：
      // 1. "documents/document_1.json" (旧格式，需要加 data/ 前缀)
      // 2. "data/documents/document_1.json" (新格式，直接使用)
      let normalizedPath = filePath
      if (!filePath.startsWith('data/') && !filePath.startsWith('data\\')) {
        // 旧格式，添加 data/ 前缀
        normalizedPath = path.join('data', filePath)
      }
      
      const fullPath = path.join(projectRoot, normalizedPath)

      console.log(`[文档提取] 读取文件: ${fullPath}`)

      // 检查文件是否存在
      try {
        await fs.access(fullPath)
      } catch (error) {
        throw new Error(`文件不存在: ${fullPath}`)
      }

      // 读取并解析JSON
      const content = await fs.readFile(fullPath, 'utf-8')
      const json = JSON.parse(content)

      console.log(`[文档提取] 文件解析成功，幻灯片数: ${json.slides?.length || 0}`)

      return json
    } catch (error) {
      if (error.message.includes('文件不存在')) {
        throw error
      }
      if (error instanceof SyntaxError) {
        throw new Error(`JSON解析失败: ${error.message}`)
      }
      throw new Error(`读取文件失败: ${error.message}`)
    }
  },

  /**
   * 从HTML内容中提取<span>标签内的纯文本
   * @param {string} htmlText - 包含HTML标签的文本
   * @returns {Array<string>} 提取的文本数组
   */
  extractTextFromSpan(htmlText) {
    const results = []
    const spanPattern = /<span[^>]*>([^<]*)<\/span>/g
    const regex = new RegExp(spanPattern)
    let match

    while ((match = regex.exec(htmlText)) !== null) {
      let text = match[1]
      // 解码 HTML 实体
      text = this.decodeHtmlEntities(text)
      if (text.trim()) {
        results.push(text.trim())
      }
    }

    return results
  },

  /**
   * 解码常见的HTML实体
   * @param {string} text - 待解码的文本
   * @returns {string} 解码后的文本
   */
  decodeHtmlEntities(text) {
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ')
  },

  /**
   * 从幻灯片中提取文本内容（去除HTML标签）
   * @param {Object} slide - 幻灯片对象
   * @returns {string} 合并后的文本内容
   */
  extractTextFromSlide(slide) {
    if (!slide || !slide.elements || !Array.isArray(slide.elements)) {
      return ''
    }

    const texts = []

    for (const element of slide.elements) {
      if (!element) continue

      const elementType = element.type || 'unknown'

      // 处理表格元素（优先处理，避免与通用文本处理冲突）
      if (elementType === 'table' && element.data) {
        for (const row of element.data) {
          if (!Array.isArray(row)) continue
          
          for (const cell of row) {
            if (!cell) continue
            
            let cellText = ''
            
            // text 可能是字符串或对象
            if (typeof cell.text === 'string') {
              cellText = cell.text
            } else if (typeof cell.text === 'object' && cell.text.content) {
              cellText = cell.text.content
            }
            
            // 表格单元格的text通常是纯文本，直接添加（与原有逻辑一致）
            if (cellText && cellText.trim() && cellText.trim() !== ' ') {
              texts.push(cellText.trim())
            }
          }
        }
        continue // 表格处理完毕，跳过后续处理
      }

      // 处理图表元素（标题和描述通常是纯文本）
      if (elementType === 'chart') {
        if (element.title) {
          texts.push(element.title)
        }
        if (element.description) {
          texts.push(element.description)
        }
        continue // 图表处理完毕，跳过后续通用文本处理
      }

      // 处理其他所有元素（text, shape, image等）- 尝试提取文本内容
      // 与原始 DocumentTextExtractor 逻辑一致：除了 table，其他元素都尝试提取
      let textContent = ''

      // 方式1: 检查是否有 text 对象（结构1: element.text.content）
      if (element.text) {
        if (typeof element.text === 'object' && element.text.content) {
          textContent = element.text.content
        } else if (typeof element.text === 'string') {
          textContent = element.text
        }
      }
      // 方式2: 检查是否直接有 content 字段（结构2: element.content）
      else if (element.content) {
        textContent = element.content
      }

      // 从 HTML 内容中提取 <span> 标签内的文本
      if (textContent) {
        const extractedTexts = this.extractTextFromSpan(textContent)
        texts.push(...extractedTexts)
      }
    }

    // 合并所有文本，用空格分隔（与原有逻辑一致）
    return texts.filter(t => t && t.trim()).join(' ')
  },

  /**
   * 提取文档内容并保存到数据库
   * @param {string} documentId - 文档ID
   * @param {string} extractMethod - 提取方法（auto/manual）
   * @param {boolean} force - 是否强制重新提取
   * @returns {Promise<Object>} 提取结果统计
   */
  async extractAndSave(documentId, extractMethod = 'auto', force = false) {
    console.log(`[文档提取] 开始提取文档: ${documentId}, 方法: ${extractMethod}, 强制: ${force}`)

    // 1. 查询文档信息
    const document = await prisma.documents.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      throw new Error('文档不存在')
    }

    console.log(`[文档提取] 文档名称: ${document.name}, 路径: ${document.content_file_path}`)

    // 2. 如果强制提取，先删除已有数据
    if (force) {
      const deleteResult = await prisma.slide_merged_contents.deleteMany({
        where: { document_id: documentId },
      })
      console.log(`[文档提取] 删除已有数据: ${deleteResult.count} 条`)
    }

    // 3. 读取并解析JSON文件
    const documentData = await this.readDocumentJson(document.content_file_path)

    if (!documentData.slides || !Array.isArray(documentData.slides)) {
      throw new Error('文档数据格式错误：缺少 slides 数组')
    }

    // 4. 提取每页内容并准备数据
    const slides = documentData.slides
    const insertData = []

    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]
      const slideId = slide.id || `slide_${i + 1}`
      const mergedContent = this.extractTextFromSlide(slide)

      insertData.push({
        id: generateId(),
        document_id: documentId,
        slide_id: slideId,
        merged_content: mergedContent,
        content_length: mergedContent.length,
        slide_order: i + 1,
        file_name: document.name,
        extract_method: extractMethod,
        created_at: new Date(),
        updated_at: new Date(),
      })

      console.log(`[文档提取] 第 ${i + 1} 页: slide_id=${slideId}, 内容长度=${mergedContent.length}`)
    }

    // 5. 批量插入数据库
    console.log(`[文档提取] 开始批量插入: ${insertData.length} 条记录`)

    const result = await prisma.slide_merged_contents.createMany({
      data: insertData,
      skipDuplicates: true, // 跳过已存在的记录（基于 document_id + slide_id 唯一约束）
    })

    console.log(`[文档提取] 插入成功: ${result.count} 条记录`)

    // 6. 统计结果
    const extractedCount = result.count
    const failedCount = insertData.length - result.count

    return {
      document_id: documentId,
      document_name: document.name,
      extracted_count: extractedCount,
      failed_count: failedCount,
      total_slides: slides.length,
      status: failedCount > 0 ? 'partial' : 'completed',
      message: failedCount > 0
        ? `提取完成，成功 ${extractedCount} 条，跳过 ${failedCount} 条（可能已存在）`
        : `提取完成，共提取 ${extractedCount} 页内容`,
    }
  },

  /**
   * 批量保存幻灯片内容
   * @param {string} documentId - 文档ID
   * @param {Array} slides - 幻灯片数组
   * @param {string} fileName - 文件名
   * @param {string} extractMethod - 提取方法
   * @returns {Promise<number>} 保存的数量
   */
  async saveSlideMergedContents(documentId, slides, fileName, extractMethod = 'auto') {
    const insertData = slides.map((slide, index) => ({
      id: generateId(),
      document_id: documentId,
      slide_id: slide.slideId,
      merged_content: slide.content,
      content_length: slide.content.length,
      slide_order: index + 1,
      file_name: fileName,
      extract_method: extractMethod,
      created_at: new Date(),
      updated_at: new Date(),
    }))

    const result = await prisma.slide_merged_contents.createMany({
      data: insertData,
      skipDuplicates: true,
    })

    return result.count
  },
}

module.exports = documentService

