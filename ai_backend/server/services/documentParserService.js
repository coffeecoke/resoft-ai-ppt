/**
 * 文档解析服务
 * 支持 PDF / Word (.docx/.doc) 文件的文本和富文本提取
 *
 * extractText()        — 只提纯文本，给 AI 分析用
 * extractHtml()        — 提取 HTML 存文件（保留表格+图片），返回文件路径
 * splitHtmlToFiles()   — 将整体 HTML 按章节切割，每章节存一个文件，返回 { [title]: filePath }
 */

const fs = require('fs').promises
const path = require('path')
const logger = require('../utils/logger')

// 图片存储目录
const IMAGE_SAVE_DIR  = path.join(__dirname, '../../uploads/bid-images')
const IMAGE_URL_PREFIX = '/uploads/bid-images'

// HTML 文件存储目录
const HTML_SAVE_DIR  = path.join(__dirname, '../../uploads/bid-html')
const HTML_URL_PREFIX = '/uploads/bid-html'

class DocumentParserService {

  // ======================== 纯文本提取（给 AI 用） ========================

  async extractText(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    switch (ext) {
      case '.pdf':  return this._extractTextFromPDF(filePath)
      case '.docx': return this._extractTextFromDocx(filePath)
      case '.doc':  return this._extractTextFromDoc(filePath)
      case '.txt':  return fs.readFile(filePath, 'utf-8')
      default:
        throw new Error(`不支持的文件格式: ${ext}，支持 PDF/DOCX/DOC/TXT`)
    }
  }

  async _extractTextFromPDF(filePath) {
    try {
      const pdfParse = require('pdf-parse')
      const buffer = await fs.readFile(filePath)
      const data = await pdfParse(buffer)
      logger.info(`[文档解析] PDF 文本提取完成: ${data.numpages} 页, ${data.text.length} 字符`)
      return data.text
    } catch (error) {
      logger.error('[文档解析] PDF 提取失败:', error.message)
      throw new Error(`PDF 解析失败: ${error.message}`)
    }
  }

  async _extractTextFromDocx(filePath) {
    try {
      const mammoth = require('mammoth')
      const buffer = await fs.readFile(filePath)
      const result = await mammoth.extractRawText({ buffer })
      logger.info(`[文档解析] Word 文本提取完成: ${result.value.length} 字符`)
      if (result.messages.length > 0) {
        logger.warn('[文档解析] Word 解析警告:', result.messages.map(m => m.message).join('; '))
      }
      return result.value
    } catch (error) {
      logger.error('[文档解析] Word 文本提取失败:', error.message)
      throw new Error(`Word 解析失败: ${error.message}`)
    }
  }

  async _extractTextFromDoc(filePath) {
    try {
      const WordExtractor = require('word-extractor')
      const extractor = new WordExtractor()
      const doc = await extractor.extract(filePath)
      const text = doc.getBody()
      logger.info(`[文档解析] .doc 文本提取完成: ${text.length} 字符`)
      return text
    } catch (error) {
      logger.error('[文档解析] .doc 文本提取失败:', error.message)
      throw new Error(`.doc 解析失败: ${error.message}`)
    }
  }

  // ======================== HTML 提取（存文件，不入数据库） ========================

  /**
   * 从 DOCX 提取 HTML，写入磁盘，返回访问路径
   * @param {string} filePath  - 源文件路径
   * @param {string} docId     - 关联文档ID，用于目录隔离
   * @returns {Promise<{htmlPath: string, imageCount: number}>}
   *   htmlPath: 前端可访问的 URL，如 /uploads/bid-html/biddoc_xxx/full.html
   */
  async extractHtml(filePath, docId) {
    const ext = path.extname(filePath).toLowerCase()

    if (ext !== '.docx') {
      // .doc / .txt / .pdf 降级：提纯文本包在 <pre> 里存文件
      const text = await this.extractText(filePath)
      const html = `<pre>${this._escapeHtml(text)}</pre>`
      const htmlPath = await this._writeHtmlFile(docId, 'full.html', html)
      return { htmlPath, imageCount: 0 }
    }

    return this._extractHtmlFromDocx(filePath, docId)
  }

  /**
   * 将整体 HTML 按 AI 识别的章节结构切割，每章节存一个文件
   * @param {string} docId      - 文档ID
   * @param {string} fullHtml   - 完整 HTML 字符串（从文件读取，不存内存）
   * @param {Array}  structure  - AI 返回的章节结构 [{title, start_keyword, level}, ...]
   * @returns {Promise<Object>} { [chapterTitle]: htmlFilePath }
   */
  async splitHtmlToFiles(docId, fullHtml, structure) {
    if (!structure || structure.length === 0 || !fullHtml) return {}

    const result = {}
    for (let i = 0; i < structure.length; i++) {
      const current = structure[i]
      const next    = structure[i + 1]

      const startIdx = fullHtml.indexOf(current.start_keyword)
      if (startIdx === -1) continue

      // 退到标签边界，避免从标签中间截断
      let htmlStart = startIdx
      const tagBefore = fullHtml.lastIndexOf('<', startIdx)
      if (tagBefore !== -1 && fullHtml.indexOf('>', tagBefore) > startIdx) {
        htmlStart = tagBefore
      }

      let htmlEnd
      if (next && next.start_keyword) {
        const nextIdx = fullHtml.indexOf(next.start_keyword, startIdx + 1)
        if (nextIdx !== -1) {
          const nextTagBefore = fullHtml.lastIndexOf('<', nextIdx)
          htmlEnd = (nextTagBefore !== -1 && fullHtml.indexOf('>', nextTagBefore) > nextIdx)
            ? nextTagBefore
            : nextIdx
        } else {
          htmlEnd = fullHtml.length
        }
      } else {
        htmlEnd = fullHtml.length
      }

      const htmlSlice = fullHtml.slice(htmlStart, htmlEnd).trim()
      if (htmlSlice.length > 0) {
        const filename = `sec_${i}.html`
        const filePath = await this._writeHtmlFile(docId, filename, htmlSlice)
        result[current.title] = filePath
      }
    }

    return result
  }

  /**
   * 读取 HTML 文件内容（供后续处理使用）
   * @param {string} htmlPath - URL 路径，如 /uploads/bid-html/xxx/full.html
   * @returns {Promise<string>}
   */
  async readHtmlFile(htmlPath) {
    // 把 URL 路径转为磁盘路径
    const relativePath = htmlPath.replace(HTML_URL_PREFIX, '')
    const diskPath = path.join(HTML_SAVE_DIR, relativePath)
    return fs.readFile(diskPath, 'utf-8')
  }

  // ======================== 私有方法 ========================

  async _extractHtmlFromDocx(filePath, docId) {
    const mammoth = require('mammoth')
    const buffer  = await fs.readFile(filePath)

    // 确保图片目录存在
    const imageDir = path.join(IMAGE_SAVE_DIR, docId)
    await fs.mkdir(imageDir, { recursive: true })

    let imageCount = 0
    const options = {
      buffer,
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const ext      = this._mimeToExt(image.contentType) || 'png'
          const filename = `img_${++imageCount}.${ext}`
          const savePath = path.join(imageDir, filename)
          await fs.writeFile(savePath, await image.read())
          return { src: `${IMAGE_URL_PREFIX}/${docId}/${filename}` }
        } catch (err) {
          logger.warn(`[文档解析] 图片提取失败: ${err.message}`)
          return { src: '' }
        }
      }),
    }

    const result = await mammoth.convertToHtml(options)

    if (result.messages.length > 0) {
      logger.warn('[文档解析] Word HTML转换警告:', result.messages.map(m => m.message).join('; '))
    }

    // HTML 写到文件，不入数据库
    const htmlPath = await this._writeHtmlFile(docId, 'full.html', result.value)

    logger.info(`[文档解析] DOCX HTML 提取完成: ${result.value.length} 字符, ${imageCount} 张图片 → ${htmlPath}`)

    return { htmlPath, imageCount }
  }

  /**
   * 将 HTML 内容写入文件，返回前端可访问的 URL 路径
   */
  async _writeHtmlFile(docId, filename, content) {
    const dir = path.join(HTML_SAVE_DIR, docId)
    await fs.mkdir(dir, { recursive: true })
    const diskPath = path.join(dir, filename)
    await fs.writeFile(diskPath, content, 'utf-8')
    return `${HTML_URL_PREFIX}/${docId}/${filename}`
  }

  // ======================== 工具方法 ========================

  /** 从 HTML 剥离标签得到纯文本（备用，章节内容给 AI 时使用） */
  htmlToText(html) {
    return html
      .replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
        return tableHtml
          .replace(/<tr[^>]*>/gi, '\n')
          .replace(/<\/tr>/gi, '')
          .replace(/<t[dh][^>]*>/gi, '')
          .replace(/<\/t[dh]>/gi, '\t')
          .replace(/<[^>]+>/g, '')
          + '\n'
      })
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\t+/g, '\t')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  _mimeToExt(mimeType) {
    const map = {
      'image/png':  'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
      'image/webp': 'webp', 'image/bmp': 'bmp', 'image/tiff': 'tiff',
      'image/svg+xml': 'svg', 'image/emf': 'emf', 'image/wmf': 'wmf',
    }
    return map[mimeType] || null
  }

  _escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  getFileType(originalName) {
    const ext = path.extname(originalName).toLowerCase()
    return { '.pdf': 'pdf', '.docx': 'docx', '.doc': 'doc', '.txt': 'txt' }[ext] || 'unknown'
  }

  isSupportedType(originalName) {
    return ['.pdf', '.docx', '.doc', '.txt'].includes(path.extname(originalName).toLowerCase())
  }
}

module.exports = new DocumentParserService()
