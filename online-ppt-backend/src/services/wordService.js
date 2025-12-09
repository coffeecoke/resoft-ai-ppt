/**
 * Word文档解析服务
 * 
 * 使用mammoth库解析.docx文件，提取文本和结构
 */

import mammoth from 'mammoth'
import fs from 'fs/promises'

class WordService {
  
  /**
   * 解析Word文档
   * 
   * @param {string} filePath - 文件路径
   * @returns {Promise<Object>} 解析结果
   */
  async parseWord(filePath) {
    const buffer = await fs.readFile(filePath)
    
    // 转换为Markdown格式
    const markdownResult = await mammoth.convertToMarkdown({ buffer })
    
    // 提取纯文本
    const textResult = await mammoth.extractRawText({ buffer })
    
    // 提取文档标题
    const title = this.extractTitle(markdownResult.value, textResult.value)
    
    // 清理Markdown内容
    const markdown = this.cleanMarkdown(markdownResult.value)
    
    return {
      title,
      text: textResult.value.trim(),
      markdown,
      wordCount: textResult.value.replace(/\s/g, '').length, // 去除空白后的字数
      warnings: markdownResult.messages
    }
  }
  
  /**
   * 从文档中提取标题
   * 
   * 优先级：H1标题 > 第一行非空文本
   */
  extractTitle(markdown, text) {
    // 尝试从Markdown中提取H1标题
    const h1Match = markdown.match(/^#\s+(.+)$/m)
    if (h1Match) {
      return h1Match[1].trim()
    }
    
    // 尝试从Markdown中提取第一个标题（任意级别）
    const anyHeadingMatch = markdown.match(/^#{1,6}\s+(.+)$/m)
    if (anyHeadingMatch) {
      return anyHeadingMatch[1].trim()
    }
    
    // 否则取第一行非空文本
    const firstLine = text.split('\n').find(line => line.trim())
    if (firstLine) {
      // 截取前50个字符
      return firstLine.trim().substring(0, 50)
    }
    
    return '未命名文档'
  }
  
  /**
   * 清理Markdown内容
   * 
   * 移除多余的空行，规范格式
   */
  cleanMarkdown(markdown) {
    return markdown
      // 移除连续的空行，保留最多一个
      .replace(/\n{3,}/g, '\n\n')
      // 移除行首行尾空白
      .trim()
  }
  
  /**
   * 删除临时文件
   */
  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath)
    } catch (error) {
      console.warn(`[WordService] 删除临时文件失败: ${filePath}`, error.message)
    }
  }
}

export default new WordService()
