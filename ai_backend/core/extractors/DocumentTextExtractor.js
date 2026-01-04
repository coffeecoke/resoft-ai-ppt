/**
 * 文档文本提取器 (Node.js 版本)
 * 从 document_*.json 文件中提取中文文本内容
 * 
 * 提取逻辑：
 * 1. 提取 title 字段（文件名）
 * 2. 遍历所有 slides 中的 elements
 * 3. 从 text 字段中提取 <span> 标签内的文本内容
 * 
 * 输出格式：文件名, id, 文本内容
 */

const fs = require('fs').promises
const path = require('path')

/**
 * 提取的文本数据类
 */
class ExtractedText {
  constructor(fileName, slideId, elementId, text) {
    this.fileName = fileName
    this.slideId = slideId
    this.elementId = elementId
    this.text = text
  }

  getFileName() { return this.fileName }
  getSlideId() { return this.slideId }
  getElementId() { return this.elementId }
  getText() { return this.text }
}

/**
 * 拼接后的文本数据类（按主ID合并）
 */
class MergedText {
  constructor(fileName, slideId) {
    this.fileName = fileName
    this.slideId = slideId
    this.mergedText = []
  }

  appendText(text) {
    this.mergedText.push(text)
  }

  getFileName() { return this.fileName }
  getSlideId() { return this.slideId }
  getMergedText() { return this.mergedText.join(' ') }
}

/**
 * 文档文本提取器类
 */
class DocumentTextExtractor {
  constructor() {
    // 用于匹配 <span> 标签中的内容
    this.spanPattern = /<span[^>]*>([^<]*)<\/span>/g
  }

  /**
   * 从 HTML 内容中提取 <span> 标签内的文本
   * @param {string} htmlText - 包含 HTML 标签的文本
   * @returns {Array<string>} 提取的文本数组
   */
  extractTextFromSpan(htmlText) {
    const results = []
    const regex = new RegExp(this.spanPattern)
    let match

    while ((match = regex.exec(htmlText)) !== null) {
      let text = match[1]
      // 解码 HTML 实体
      text = this.decodeHtmlEntities(text)
      results.push(text)
    }

    return results
  }

  /**
   * 解码常见的 HTML 实体
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
  }

  /**
   * 从 table 类型元素中提取文本
   * table 结构: element.data 是二维数组，每个单元格有 id 和 text 字段
   * 
   * @param {Object} tableElement - 表格元素对象
   * @param {string} documentTitle - 文档标题
   * @param {string} slideId - 幻灯片 ID
   * @param {string} tableId - 表格 ID
   * @param {Array<ExtractedText>} extractedTexts - 提取文本数组
   */
  extractFromTable(tableElement, documentTitle, slideId, tableId, extractedTexts) {
    if (!tableElement.data || !Array.isArray(tableElement.data)) {
      return
    }

    const data = tableElement.data

    // 遍历每一行
    for (let row = 0; row < data.length; row++) {
      const rowData = data[row]
      
      if (!Array.isArray(rowData)) continue

      // 遍历每一列（单元格）
      for (let col = 0; col < rowData.length; col++) {
        const cell = rowData[col]
        
        // 获取单元格的 id 和 text
        const cellId = cell.id || `${tableId}_cell_${row}_${col}`
        
        if (cell.text) {
          let cellText = ''
          
          // text 可能是字符串或对象
          if (typeof cell.text === 'string') {
            cellText = cell.text
          } else if (typeof cell.text === 'object' && cell.text.content) {
            cellText = cell.text.content
          }
          
          // 只保留非空文本
          if (cellText.trim() && cellText.trim() !== ' ') {
            extractedTexts.push(
              new ExtractedText(documentTitle, slideId, cellId, cellText.trim())
            )
          }
        }
      }
    }
  }

  /**
   * 从 JSON 文件中提取文本
   * @param {string} inputFile - 输入 JSON 文件路径
   * @param {string} outputFile - 输出 TXT 文件路径
   */
  async extractText(inputFile, outputFile) {
    try {
      // 读取 JSON 文件
      console.log('\n正在读取JSON文件...')
      const jsonContent = await fs.readFile(inputFile, 'utf-8')
      
      // 解析 JSON
      console.log('正在解析JSON...')
      const rootObject = JSON.parse(jsonContent)
      
      // 获取 title（文件名）
      const documentTitle = rootObject.title || '未知文件'
      console.log(`文档标题: ${documentTitle}`)
      
      // 准备输出
      const extractedTexts = []
      let totalCount = 0
      
      // 获取 slides 数组
      if (!rootObject.slides || !Array.isArray(rootObject.slides)) {
        console.log('警告: 未找到slides数组')
        return
      }
      
      const slides = rootObject.slides
      console.log(`找到 ${slides.length} 个slides`)
      
      // 遍历每个 slide
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        
        // 获取 slide 的 id
        const slideId = slide.id || `slide_${i}`
        
        // 获取 elements 数组
        if (!slide.elements || !Array.isArray(slide.elements)) {
          continue
        }
        
        const elements = slide.elements
        
        // 遍历每个 element
        for (let j = 0; j < elements.length; j++) {
          const element = elements[j]
          
          // 获取 element 的 id
          const elementId = element.id || `element_${j}`
          
          // 获取 element 的 type
          const elementType = element.type || 'unknown'
          
          // 根据类型处理不同的元素
          if (elementType === 'table') {
            // 处理 table 类型元素
            const beforeCount = extractedTexts.length
            this.extractFromTable(element, documentTitle, slideId, elementId, extractedTexts)
            totalCount += (extractedTexts.length - beforeCount)
          } else {
            // 处理 text 等其他类型元素
            // 获取文本内容，支持两种 JSON 结构：
            // 结构1: element.text.content (document_1.json)
            // 结构2: element.content (document_3.json等)
            let textContent = ''
            
            // 方式1: 检查是否有 text 对象（结构1）
            if (element.text) {
              // text 可能是对象（包含 content 字段）或字符串
              if (typeof element.text === 'object' && element.text.content) {
                textContent = element.text.content
              } else if (typeof element.text === 'string') {
                textContent = element.text
              }
            }
            // 方式2: 检查是否直接有 content 字段（结构2）
            else if (element.content) {
              textContent = element.content
            }
            
            // 如果没有内容，跳过
            if (!textContent) {
              continue
            }
            
            // 从 HTML 内容中提取 <span> 标签内的文本
            const extractedFromSpan = this.extractTextFromSpan(textContent)
            
            for (const text of extractedFromSpan) {
              // 只保留非空文本
              if (text.trim()) {
                extractedTexts.push(
                  new ExtractedText(documentTitle, slideId, elementId, text.trim())
                )
                totalCount++
              }
            }
          }
        }
      }
      
      console.log(`共提取 ${totalCount} 条文本记录`)
      
      // 写入详细文件
      console.log('\n正在写入详细输出文件...')
      await this.writeToFile(extractedTexts, outputFile)
      console.log(`已写入 ${extractedTexts.length} 条记录到: ${outputFile}`)
      
      // 写入拼接文件
      const mergedOutputFile = outputFile.replace('.txt', '_merged.txt')
      console.log('\n正在写入拼接输出文件...')
      await this.writeMergedFile(extractedTexts, mergedOutputFile)
      console.log(`已写入拼接文件到: ${mergedOutputFile}`)
      
    } catch (error) {
      console.error('提取过程中出错:', error)
      throw error
    }
  }

  /**
   * 将提取的文本写入文件（详细版）
   * @param {Array<ExtractedText>} texts - 提取的文本数组
   * @param {string} outputFile - 输出文件路径
   */
  async writeToFile(texts, outputFile) {
    // 确保输出目录存在
    const outputDir = path.dirname(outputFile)
    await fs.mkdir(outputDir, { recursive: true })
    
    // 构建输出内容
    const lines = []
    lines.push('文件名\t主ID\t子ID\t文本内容')
    lines.push('='.repeat(100))
    
    for (const text of texts) {
      lines.push(
        `${text.getFileName()}\t${text.getSlideId()}\t${text.getElementId()}\t${text.getText()}`
      )
    }
    
    // 写入文件
    await fs.writeFile(outputFile, lines.join('\n'), 'utf-8')
  }

  /**
   * 将提取的文本写入文件（拼接版 - 按主ID合并）
   * @param {Array<ExtractedText>} texts - 提取的文本数组
   * @param {string} outputFile - 输出文件路径
   */
  async writeMergedFile(texts, outputFile) {
    // 使用 Map 保持插入顺序
    const mergedMap = new Map()
    
    // 按主ID分组并拼接文本
    for (const text of texts) {
      const key = `${text.getFileName()}||${text.getSlideId()}`
      
      if (!mergedMap.has(key)) {
        mergedMap.set(key, new MergedText(text.getFileName(), text.getSlideId()))
      }
      
      // 追加文本内容（用空格分隔）
      mergedMap.get(key).appendText(text.getText())
    }
    
    // 构建输出内容
    const lines = []
    lines.push('文件名\t主ID\t拼接文本内容')
    lines.push('='.repeat(100))
    
    for (const merged of mergedMap.values()) {
      lines.push(
        `${merged.getFileName()}\t${merged.getSlideId()}\t${merged.getMergedText()}`
      )
    }
    
    // 写入文件
    await fs.writeFile(outputFile, lines.join('\n'), 'utf-8')
    
    console.log(`拼接后共 ${mergedMap.size} 条记录（按主ID合并）`)
  }

  /**
   * 主执行方法
   * @param {string} inputFile - 输入 JSON 文件路径
   * @param {string} outputFile - 输出 TXT 文件路径
   */
  async run(inputFile, outputFile) {
    console.log('='.repeat(60))
    console.log('文档文本提取器 (Node.js 版本)')
    console.log('='.repeat(60))
    console.log(`输入文件: ${inputFile}`)
    console.log(`输出文件: ${outputFile}`)
    console.log('='.repeat(60))
    
    await this.extractText(inputFile, outputFile)
    
    console.log('\n✓ 提取完成!')
  }
}

/**
 * 命令行入口
 */
async function main() {
  try {
    // 默认路径
    let inputFile = path.join(__dirname, '../online-ppt-backend/data/documents/document_1.json')
    let outputFile = path.join(__dirname, 'output/extracted_text.txt')
    
    // 如果提供了命令行参数，则使用参数
    const args = process.argv.slice(2)
    if (args.length >= 1) {
      inputFile = args[0]
    }
    if (args.length >= 2) {
      outputFile = args[1]
    }
    
    const extractor = new DocumentTextExtractor()
    await extractor.run(inputFile, outputFile)
    
  } catch (error) {
    console.error('❌ 错误:', error.message)
    process.exit(1)
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main()
}

// 导出类供其他模块使用
module.exports = {
  DocumentTextExtractor,
  ExtractedText,
  MergedText
}

