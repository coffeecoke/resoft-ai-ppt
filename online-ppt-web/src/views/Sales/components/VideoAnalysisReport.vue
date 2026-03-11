<template>
  <div class="side-block analysis-report">
    <!-- 加载中 -->
    <div v-if="loading" class="analysis-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!hasAnalysis" class="analysis-empty">
      <i class="ri-file-text-line"></i>
      <p>暂无分析结果</p>
    </div>

    <!-- Markdown 内容 -->
    <div v-else class="markdown-content">
      <el-button
        size="small"
        type="primary"
        :icon="Download"
        @click="downloadReport"
        class="download-btn"
      >
        下载报告
      </el-button>
      <div v-html="renderedMarkdown"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Download, Loading } from '@element-plus/icons-vue'
import { marked } from 'marked'
import { getTranscriptionAnalysis } from '@/services/salesService'

interface VideoDetail {
  id?: string
  name?: string
  customer_name?: string
  [key: string]: any
}

interface Props {
  videoDetail: VideoDetail
}

const props = defineProps<Props>()

const loading = ref(false)
const analysisData = ref(null)
const rawMarkdown = ref('')

// 是否有分析结果
const hasAnalysis = computed(() => {
  return !!rawMarkdown.value
})

// 渲染后的 HTML
const renderedMarkdown = computed(() => {
  if (!rawMarkdown.value) return ''
  try {
    return marked.parse(rawMarkdown.value)
  } catch (e) {
    console.error('Markdown 解析失败:', e)
    return '<p>分析结果解析失败</p>'
  }
})

// 加载分析结果
const loadAnalysis = async () => {
  const transcriptionId = props.videoDetail?.id
  if (!transcriptionId) return

  loading.value = true
  try {
    const res = await getTranscriptionAnalysis(transcriptionId)
    if (res.success && res.data) {
      analysisData.value = res.data
      rawMarkdown.value = res.data.rawMarkdown || ''
    }
  } catch (e) {
    console.error('加载分析结果失败:', e)
  } finally {
    loading.value = false
  }
}

// 下载报告为 Word 文档
const downloadReport = async () => {
  if (!rawMarkdown.value) return

  try {
    // 动态导入 docx 库
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

    // 生成文件名（使用交流主题或会议名称）
    const themeName = props.videoDetail?.name || props.videoDetail?.customer_name || '会议'
    const fileName = `${themeName}_分析报告.docx`

    console.log('[下载] 开始解析 Markdown')

    // 简单解析 Markdown 转换为 docx 段落
    const paragraphs: any[] = []
    const lines = rawMarkdown.value.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // 空行
      if (!line.trim()) {
        paragraphs.push(new Paragraph({ text: '' }))
        continue
      }

      // H1 标题
      if (line.startsWith('# ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        )
      }
      // H2 标题
      else if (line.startsWith('## ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 150 }
          })
        )
      }
      // H3 标题
      else if (line.startsWith('### ')) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 }
          })
        )
      }
      // 无序列表
      else if (line.match(/^[\-\*]\s/)) {
        paragraphs.push(
          new Paragraph({
            text: line.substring(2),
            bullet: { level: 0 },
            spacing: { before: 100, after: 100 }
          })
        )
      }
      // 有序列表
      else if (line.match(/^\d+\.\s/)) {
        paragraphs.push(
          new Paragraph({
            text: line.replace(/^\d+\.\s/, ''),
            numbering: { reference: 'default-numbering', level: 0 },
            spacing: { before: 100, after: 100 }
          })
        )
      }
      // 加粗文本 **text**
      else if (line.includes('**')) {
        const children: any[] = []
        const parts = line.split('**')
        parts.forEach((part, index) => {
          if (index % 2 === 0) {
            if (part) children.push(new TextRun({ text: part }))
          } else {
            children.push(new TextRun({ text: part, bold: true }))
          }
        })
        paragraphs.push(
          new Paragraph({
            children,
            spacing: { before: 100, after: 100 }
          })
        )
      }
      // 普通段落
      else {
        paragraphs.push(
          new Paragraph({
            text: line,
            spacing: { before: 100, after: 100 }
          })
        )
      }
    }

    console.log('[下载] 创建 Word 文档')

    // 创建文档
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440,
                right: 1440,
                bottom: 1440,
                left: 1440
              }
            }
          },
          children: paragraphs
        }
      ],
      numbering: {
        config: [
          {
            reference: 'default-numbering',
            levels: [
              {
                level: 0,
                format: 'decimal',
                text: '%1.',
                alignment: AlignmentType.LEFT
              }
            ]
          }
        ]
      }
    })

    console.log('[下载] 生成 Blob')

    // 生成 Blob
    const blob = await Packer.toBlob(doc)

    console.log('[下载] Blob 创建完成, size:', blob.size)

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log('[下载] 完成，文件名:', fileName)
  } catch (e) {
    console.error('下载 Word 文档失败:', e)
  }
}

onMounted(() => {
  loadAnalysis()
})
</script>

<style scoped lang="scss">
/* 分析报告样式 */
.analysis-report {
  // 样式已移至 markdown-content
}

/* 加载状态 */
.analysis-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
  gap: 12px;

  .el-icon {
    font-size: 32px;
  }

  span {
    font-size: 14px;
  }
}

/* 空状态 */
.analysis-empty {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;

  i {
    font-size: 48px;
    color: #d1d5db;
    margin-bottom: 12px;
    display: block;
  }

  p {
    font-size: 14px;
    margin: 0;
  }
}

/* Markdown 内容样式 */
.markdown-content {
  position: relative;
  font-size: 14px;
  color: #374151;
  line-height: 1.8;

  .download-btn {
    position: absolute;
    top: 5px;
    right: 5px;
    z-index: 10;
  }

  :deep(h1) {
    font-size: 20px;
    font-weight: 600;
    color: #1f2937;
    margin: 24px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid #e5e7eb;
  }

  :deep(h2) {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
    margin: 20px 0 12px 0;
    padding-left: 12px;
    border-left: 5px solid #2563eb;
  }

  :deep(h3) {
    font-size: 16px;
    font-weight: 600;
    color: #374151;
    margin: 16px 0 10px 0;
  }

  :deep(h4),
  :deep(h5),
  :deep(h6) {
    font-size: 14px;
    font-weight: 600;
    color: #4b5563;
    margin: 12px 0 8px 0;
  }

  :deep(p) {
    margin: 12px 0;
    line-height: 1.8;
  }

  :deep(ul),
  :deep(ol) {
    margin: 12px 0;
    padding-left: 24px;
  }

  :deep(li) {
    margin: 6px 0;
    line-height: 1.6;
  }

  :deep(blockquote) {
    margin: 16px 0;
    padding: 12px 16px;
    background: #f9fafb;
    border-left: 3px solid #d1d5db;
    color: #6b7280;
  }

  :deep(code) {
    padding: 2px 6px;
    background: #f3f4f6;
    border-radius: 3px;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 13px;
    color: #e11d48;
  }

  :deep(pre) {
    margin: 16px 0;
    padding: 16px;
    background: #1f2937;
    border-radius: 6px;
    overflow-x: auto;

    code {
      padding: 0;
      background: transparent;
      color: #e5e7eb;
      font-size: 13px;
    }
  }

  :deep(table) {
    width: 100%;
    margin: 16px 0;
    border-collapse: collapse;
    font-size: 13px;
  }

  :deep(th),
  :deep(td) {
    padding: 8px 12px;
    border: 1px solid #e5e7eb;
    text-align: left;
  }

  :deep(th) {
    background: #f9fafb;
    font-weight: 600;
    color: #374151;
  }

  :deep(tr:nth-child(even)) {
    background: #fafafa;
  }

  :deep(hr) {
    margin: 20px 0;
    border: none;
    border-top: 1px solid #e5e7eb;
  }

  :deep(a) {
    color: #2563eb;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  :deep(strong) {
    font-weight: 600;
    color: #1f2937;
  }

  :deep(em) {
    font-style: italic;
    color: #6b7280;
  }
}
</style>