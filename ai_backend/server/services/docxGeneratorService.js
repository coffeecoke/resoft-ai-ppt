/**
 * 投标文件 Word 文档生成服务
 *
 * 将目录树 + AI 生成的内容组装成一份正式的 .docx 投标文件
 */

const {
  Document, Packer, Paragraph, TextRun,
  HeadingLevel, AlignmentType, PageBreak,
  Header, Footer, PageNumber, NumberFormat,
  BorderStyle, Tab, TabStopPosition, TabStopType,
} = require('docx')
const path = require('path')
const fs = require('fs').promises
const { getSectionTypeName } = require('../config/bidSectionTypes')
const logger = require('../utils/logger')
const { getUploadBaseDir, toRelativePath } = require('../utils/pathHelper')

class DocxGeneratorService {
  /**
   * 根据招标分析结果生成 .docx 投标文件
   * @param {Object} tender - tender_documents 记录
   * @param {Array} directoryTree - 树形目录（含 children）
   * @returns {string} 生成的 .docx 文件路径
   */
  async generateBidDocument(tender, directoryTree) {
    const children = []

    // 封面页
    children.push(...this._buildCoverPage(tender))

    // 目录页（Word 自动目录域）
    children.push(...this._buildTocPage())

    // 正文各章节
    this._buildContentSections(directoryTree, children)

    const doc = new Document({
      styles: this._getDocStyles(),
      sections: [{
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 },
            size: { width: 11906, height: 16838 },
          },
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: tender.project_name || '投标文件',
                size: 18, color: '999999', font: '宋体',
              })],
            })],
          }),
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ children: [PageNumber.CURRENT], size: 18, font: '宋体' }),
                new TextRun({ text: ' / ', size: 18, font: '宋体' }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: '宋体' }),
              ],
            })],
          }),
        },
        children,
      }],
    })

    // 输出目录以 UPLOAD_BASE_DIR 为根，保证路径可通过 env 配置
    const outputDir = path.join(getUploadBaseDir(), 'docx-outputs')
    await fs.mkdir(outputDir, { recursive: true })
    const fileName = `投标文件_${(tender.project_name || tender.id).replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.docx`
    const filePath = path.join(outputDir, fileName)

    const buffer = await Packer.toBuffer(doc)
    await fs.writeFile(filePath, buffer)

    logger.info(`[DOCX生成] 文件已生成: ${filePath} (${(buffer.length / 1024).toFixed(1)}KB)`)
    // 返回相对路径，调用方存入 DB
    return toRelativePath(filePath)
  }

  // ======================== 封面页 ========================

  _buildCoverPage(tender) {
    const lines = []

    // 上方留白
    for (let i = 0; i < 6; i++) {
      lines.push(new Paragraph({ spacing: { after: 200 } }))
    }

    lines.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({
        text: tender.project_name || '投标文件',
        bold: true, size: 52, font: '黑体',
      })],
    }))

    lines.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({
        text: '投 标 文 件',
        bold: true, size: 44, font: '黑体',
      })],
    }))

    // 投标信息
    const infoItems = [
      ['投标人', '【待填写：投标公司全称】'],
      ['投标截止', tender.bid_deadline || '【待填写】'],
      ['预算金额', tender.budget || '【待填写】'],
    ]
    for (const [label, value] of infoItems) {
      lines.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [
          new TextRun({ text: `${label}：`, size: 28, font: '宋体' }),
          new TextRun({ text: value, size: 28, font: '宋体', underline: {} }),
        ],
      }))
    }

    // 日期
    lines.push(new Paragraph({ spacing: { after: 200 } }))
    lines.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: `编制日期：${new Date().toLocaleDateString('zh-CN')}`,
        size: 24, font: '宋体',
      })],
    }))

    // 分页
    lines.push(new Paragraph({ children: [new PageBreak()] }))

    return lines
  }

  // ======================== 目录页 ========================

  _buildTocPage() {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        children: [new TextRun({ text: '目  录', bold: true, size: 36, font: '黑体' })],
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [new TextRun({
          text: '（请在 Word 中右键此处 → 更新域 → 更新整个目录）',
          size: 20, color: '999999', font: '宋体', italics: true,
        })],
      }),
      new Paragraph({ children: [new PageBreak()] }),
    ]
  }

  // ======================== 正文内容 ========================

  _buildContentSections(tree, children, depth = 0) {
    if (!Array.isArray(tree)) return

    for (const node of tree) {
      // 标题
      children.push(this._buildHeading(node, depth))

      // 如果有内容（优先用户内容，其次AI默认内容）
      const content = node.user_content || node.default_content
      if (content) {
        this._buildContentParagraphs(content, children)
      }

      // 递归子节点
      if (node.children && node.children.length > 0) {
        this._buildContentSections(node.children, children, depth + 1)
      }
    }
  }

  _buildHeading(node, depth) {
    const level = Math.min(depth, 4)
    const headingMap = [
      HeadingLevel.HEADING_1,
      HeadingLevel.HEADING_2,
      HeadingLevel.HEADING_3,
      HeadingLevel.HEADING_4,
      HeadingLevel.HEADING_5,
    ]
    const sizeMap = [32, 28, 26, 24, 22]

    return new Paragraph({
      heading: headingMap[level],
      spacing: { before: level === 0 ? 400 : 240, after: 120 },
      children: [new TextRun({
        text: node.title,
        bold: true,
        size: sizeMap[level],
        font: level === 0 ? '黑体' : '宋体',
      })],
    })
  }

  _buildContentParagraphs(text, children) {
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      const isPlaceholder = trimmed.includes('【待填写')
      children.push(new Paragraph({
        spacing: { after: 120, line: 360 },
        indent: { firstLine: 480 },
        children: [new TextRun({
          text: trimmed,
          size: 24,
          font: '宋体',
          color: isPlaceholder ? 'FF0000' : '000000',
          highlight: isPlaceholder ? 'yellow' : undefined,
        })],
      }))
    }
  }

  // ======================== 样式定义 ========================

  _getDocStyles() {
    return {
      default: {
        document: {
          run: { size: 24, font: '宋体' },
          paragraph: { spacing: { line: 360 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 32, bold: true, font: '黑体' },
          paragraph: { spacing: { before: 400, after: 200 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 28, bold: true, font: '宋体' },
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          run: { size: 26, bold: true, font: '宋体' },
          paragraph: { spacing: { before: 200, after: 120 } },
        },
      ],
    }
  }
}

module.exports = new DocxGeneratorService()
