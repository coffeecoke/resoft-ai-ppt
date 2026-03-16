<template>
  <el-dialog
    :model-value="visible"
    :show-close="true"
    :close-on-click-modal="true"
    fullscreen
    class="ppt-dialog"
    @update:model-value="handleClose"
  >
    <div class="ppt-dialog-wrapper">
      <div class="ppt-main-content">
        <div class="ppt-header">
          <div class="ppt-title">
            <span class="ppt-title-tag tag-response">响应文件</span>
            <span class="ppt-title-text">{{ title }}</span>
          </div>
          <div class="ppt-actions">
            <el-button size="small" @click="handleToggleFavorite">
              <i :class="isFavorited ? 'ri-heart-2-fill' : 'ri-heart-2-line'" :style="{ color: isFavorited ? '#f56565' : 'inherit' }"></i>
              收藏 {{ favoriteCount }}
            </el-button>
            <el-button size="small" type="primary" @click="handleDownload">
              <i class="ri-folder-download-line"></i>
              下载
            </el-button>
            <el-button size="small" @click="openPendingDrawer">
              <i class="ri-list-check-3"></i>
              待操作
            </el-button>
            <button class="ai-analyze-btn" type="button" @click="openAiPanel">
              <i class="ri-quill-pen-ai-line"></i>
              AI全文分析
            </button>
          </div>
        </div>
        <div class="ppt-content">
          <!-- 左侧：文档目录 -->
          <ResponseFileToc
            :toc-sections="tocSections"
            :active-section-id="activeSectionId"
            :selected-section-ids="pendingSectionIdsForThisDoc"
            @heading-click="scrollToHeading"
            @add-to-pending="handleAddToPending"
            @download-selected="handleDownloadSelected"
            @analyze-selected="handleAnalyzeSelected"
          />

          <!-- 中间：docx 内容预览 -->
          <section class="ppt-view">
            <div v-if="isLoading" class="docx-loading">
              <i class="ri-loader-4-line spin"></i>
              <span>文档加载中...</span>
            </div>
            <div v-else-if="loadError" class="docx-error">
              <i class="ri-error-warning-line"></i>
              <span>{{ loadError }}</span>
            </div>
            <div v-else class="docx-content" ref="docxContentRef" v-html="renderedHtml"></div>
          </section>

          <!-- 右侧信息栏 -->
          <aside class="ppt-sidebar">
            <!-- 对应的招标文件 -->
            <div class="sidebar-section">
              <div class="sidebar-title">招标文件</div>
              <div class="response-tender-file-item" v-if="sidebarData.tenderFile">
                <div class="tender-file-icon"><i class="ri-file-pdf-2-line"></i></div>
                <div class="tender-file-info">
                  <div class="tender-file-title">{{ sidebarData.tenderFile.title }}</div>
                  <div class="tender-file-date">{{ sidebarData.tenderFile.date }}</div>
                </div>
              </div>
            </div>
            <!-- 项目前期交流视频 -->
            <div class="sidebar-section">
              <div class="sidebar-title">项目前期交流</div>
              <div class="communication-info">
                <div v-for="video in sidebarData.projectVideos" :key="video.id" class="comm-video-wrapper">
                  <div class="comm-video-thumb">
                    <img v-if="video.thumbnail" :src="video.thumbnail" :alt="video.title" />
                    <div v-else class="video-placeholder"><span class="video-label">视频</span></div>
                    <span v-if="video.duration" class="video-duration">{{ video.duration }}</span>
                  </div>
                  <div class="comm-content">
                    <div class="comm-title">{{ video.title }}</div>
                    <div class="comm-meta">{{ video.creator }} {{ video.date }}</div>
                    <div class="comm-stats">
                      <span>观看 {{ video.views }}</span>
                      <span>收藏 {{ video.likes }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 相似响应文件 -->
            <div class="sidebar-section">
              <div class="sidebar-title">相似响应文件</div>
              <div class="similar-docs">
                <div v-for="file in sidebarData.similarResponseFiles" :key="file.id" class="similar-doc-item">
                  <div class="doc-icon"><i class="ri-file-word-line"></i></div>
                  <div class="doc-info">
                    <div class="doc-title">{{ file.title }}</div>
                    <div class="doc-meta">{{ file.creator }} {{ file.date }}</div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <!-- AI 助手面板 -->
      <aside class="ppt-ai-panel" v-show="aiPanelVisible">
        <div class="ai-panel-content">
          <div class="ai-panel-header">
            <div class="ai-panel-title">
              AI助手
              <button class="ai-panel-close-btn" @click="closeAiPanel">关闭助手</button>
            </div>
          </div>
          <div class="ai-panel-main">
            <div class="ai-panel-subtitle">试试以下 AI 功能，提升阅读写作效率</div>
            <div class="ai-feature-list">
              <div class="ai-feature-item">
                <span class="feature-text">使用当前文档再编辑 <i class="ri-quill-pen-ai-line feature-icon"></i></span>
                <i class="ri-arrow-right-s-line feature-arrow"></i>
              </div>
              <div class="ai-feature-item">
                <span class="feature-text">总结本文档大意</span>
                <i class="ri-arrow-right-s-line feature-arrow"></i>
              </div>
            </div>
          </div>
          <div class="ai-panel-footer">
            <div class="ai-input-wrapper">
              <textarea class="ai-input" placeholder="需要我做什么？输入@发现更多技能" v-model="aiInputText" rows="4"></textarea>
              <div class="ai-input-actions">
                <button class="ai-send-btn" type="button" @click="sendAiMessage">
                  <i class="ri-send-plane-fill"></i> 发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

    </div>
  </el-dialog>

  <!-- 响应文件章节抽屉：放在 el-dialog 外部，避免嵌套 teleport 导致 renderSlot null 错误 -->
  <ResponseSectionDrawer v-model:visible="pendingDrawerVisible" />
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { useResponseSectionStore } from '@/store/Sales/responseSectionStore'
import { usePptDialogAiStore } from '@/store/Sales/pptDialogAi'
import ResponseSectionDrawer from './ResponseSectionDrawer.vue'
import ResponseFileToc from './ResponseFileToc.vue'
import { responseFileSidebarData } from '@/configs/salesData'
import { getBidDocumentDetail, fetchBidDocumentBuffer, type BidSection } from '@/services/bidDocumentService'
import { SERVER_URL } from '@/services'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '' },
  fileId: { type: String, default: '' },
})

const emit = defineEmits(['update:visible', 'close'])

// 右侧栏数据
const sidebarData = computed(() => responseFileSidebarData)

const pendingStore = useResponseSectionStore()
const pptDialogAiStore = usePptDialogAiStore()

// 内容相关状态
const renderedHtml = ref('')
const tocSections = ref<BidSection[]>([])
const isLoading = ref(false)
const loadError = ref('')
const activeSectionId = ref('')
const docxContentRef = ref<HTMLElement | null>(null)

// UI 状态
const aiPanelVisible = ref(false)
const aiInputText = ref('')
const pendingDrawerVisible = ref(false)
const openPendingDrawer = () => { pendingDrawerVisible.value = true }
const isFavorited = ref(false)
const favoriteCount = ref(12)

// 已勾选的章节 ID（从 pending store 计算，用于双向联动）
const pendingSectionIdsForThisDoc = computed(() =>
  pendingStore.sectionList
    .filter((i: any) => i.documentId === props.fileId)
    .map((i: any) => i.id)
)

// 注入标题 id（备用，便于后续滚动位置追踪）
function injectHeadingIds(html: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  let counter = 0
  doc.querySelectorAll('h1,h2,h3,h4').forEach(el => {
    el.id = `heading-${counter++}`
  })
  return doc.body.innerHTML
}

// 监听 visible + fileId，打开时加载文档
watch(
  [() => props.visible, () => props.fileId],
  async ([visible, fileId]) => {
    if (!visible || !fileId) return

    isLoading.value = true
    loadError.value = ''
    renderedHtml.value = ''
    tocSections.value = []
    activeSectionId.value = ''

    try {
      // 第一步：先加载 TOC（快，不影响目录展示）
      const docInfo = await getBidDocumentDetail(fileId)
      tocSections.value = docInfo.sections || []

      // 第二步：加载并解析 docx 文件内容（独立失败不影响 TOC）
      try {
        const arrayBuffer = await fetchBidDocumentBuffer(fileId)
        const mammoth = await import('mammoth')
        const result = await mammoth.convertToHtml({ arrayBuffer })
        renderedHtml.value = injectHeadingIds(result.value)
      } catch (fileErr: any) {
        console.warn('[ResponseFileDialog] 文档内容加载失败:', fileErr)
        loadError.value = fileErr.message || '文档内容加载失败'
      }
    } catch (err: any) {
      console.error('[ResponseFileDialog] 加载文档信息失败:', err)
      loadError.value = err.message || '文档加载失败，请刷新重试'
    } finally {
      isLoading.value = false
    }
  },
  { immediate: false }
)

// 关闭弹窗
const handleClose = (value: boolean) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
    activeSectionId.value = ''
    aiPanelVisible.value = false
    aiInputText.value = ''
    renderedHtml.value = ''
    tocSections.value = []
  }
}

// 点击 TOC 定位到对应标题（用 title 文本在 DOM 里查找，避免 index 偏移问题）
const scrollToHeading = (section: BidSection) => {
  activeSectionId.value = section.id
  nextTick(() => {
    if (!docxContentRef.value) return
    const headings = docxContentRef.value.querySelectorAll('h1,h2,h3,h4,h5,h6')
    const target = section.title.trim()
    for (const el of headings) {
      if (el.textContent?.trim().includes(target)) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
  })
}

// 「选中→待操作」按钮：当前文档全量替换（先清再加，避免重复）
const handleAddToPending = (sections: (BidSection & { isHeaderOnly?: boolean })[]) => {
  // 清掉该文档在待操作中的所有章节
  pendingStore.removeDocumentSections(props.fileId)

  // 按树序把完全选中 + 半选标题行全部加入
  for (const section of sections) {
    pendingStore.addSection({
      id: section.id,
      title: section.title,
      documentId: props.fileId,
      documentName: props.title,
      level: section.level,
      parent_section_id: section.parent_section_id || null,
      isHeaderOnly: section.isHeaderOnly || false,
      tag: '响应文件',
      date: new Date().toISOString().split('T')[0],
    })
  }

  const realCount = sections.filter(s => !s.isHeaderOnly).length
  ElMessage.success(`已更新待操作列表（${realCount} 个章节）`)
  pendingDrawerVisible.value = true
}

// 「选中→下载」按钮：直接合并下载勾选的章节
const handleDownloadSelected = async (sections: BidSection[]) => {
  try {
    const { mergeDownloadSections } = await import('../composables/useMergeDownload')
    // 前端去重：父节点已包含子节点内容，过滤掉被覆盖的子节点
    const filteredIds = new Set(filterRedundantChildren(sections))
    const mergeSections = sections
      .filter(s => filteredIds.has(s.id))
      .map(s => ({ id: s.id, headerOnly: false }))
    await mergeDownloadSections(mergeSections, props.title || '响应文件')
    ElMessage.success('下载成功')
  } catch (err: any) {
    ElMessage.error(err.message || '下载失败')
  }
}

// 「选中→AI分析」按钮
const handleAnalyzeSelected = (sections: BidSection[]) => {
  ElMessage.success(`开始AI分析 ${sections.length} 个章节`)
  // TODO: 接入 AI 分析逻辑
}

// 父子去重：如果勾选了父节点，跳过其子节点（父节点 docx 已包含子节点内容）
function filterRedundantChildren(sections: BidSection[]): string[] {
  const selectedIds = new Set(sections.map(s => s.id))
  return sections
    .filter(s => {
      let parentId = s.parent_section_id
      while (parentId) {
        if (selectedIds.has(parentId)) return false // 父节点已选，跳过
        const parent = sections.find(p => p.id === parentId)
        parentId = parent?.parent_section_id || null
      }
      return true
    })
    .map(s => s.id)
}

// 下载原始 docx 文件
const handleDownload = () => {
  if (!props.fileId) return
  const url = `${SERVER_URL}/sales/bid-documents/${props.fileId}/file`
  const a = document.createElement('a')
  a.href = url
  a.download = props.title + '.docx'
  a.click()
}

const openAiPanel = () => { aiPanelVisible.value = true }
const closeAiPanel = () => { aiPanelVisible.value = false }

const sendAiMessage = () => {
  if (!aiInputText.value.trim()) { ElMessage.warning('请输入消息内容'); return }
  ElMessage.success('消息已发送')
  aiInputText.value = ''
}

const handleToggleFavorite = () => {
  isFavorited.value = !isFavorited.value
  favoriteCount.value += isFavorited.value ? 1 : -1
  ElMessage[isFavorited.value ? 'success' : 'info'](isFavorited.value ? '已收藏' : '已取消收藏')
}

// 同步 AI 面板状态到 store
watch(() => props.visible, (newVal) => {
  if (newVal) {
    pptDialogAiStore.setPptDialogOpen(true)
    pptDialogAiStore.registerOpenAiPanel(openAiPanel)
    pptDialogAiStore.registerCloseAiPanel(closeAiPanel)
  } else {
    pptDialogAiStore.setPptDialogOpen(false)
    pptDialogAiStore.unregisterOpenAiPanel()
    pptDialogAiStore.unregisterCloseAiPanel()
    aiPanelVisible.value = false
    pptDialogAiStore.setAiPanelOpen(false)
  }
}, { immediate: true })

watch(() => aiPanelVisible.value, (newVal) => {
  pptDialogAiStore.setAiPanelOpen(newVal)
})

onBeforeUnmount(() => {
  pptDialogAiStore.unregisterOpenAiPanel()
  pptDialogAiStore.unregisterCloseAiPanel()
  pptDialogAiStore.setPptDialogOpen(false)
  pptDialogAiStore.setAiPanelOpen(false)
})
</script>

<style scoped>
/* Word 文档内容样式 */
:deep(.docx-content) {
  max-width: 820px;
  margin: 0 auto;
  padding: 40px 48px;
  background: #fff;
  font-size: 14px;
  line-height: 1.8;
  color: #1f2d3d;
  min-height: 100%;
}

:deep(.docx-content h1) { font-size: 20px; font-weight: 700; margin: 28px 0 12px; color: #111827; }
:deep(.docx-content h2) { font-size: 17px; font-weight: 600; margin: 22px 0 10px; color: #1f2d3d; }
:deep(.docx-content h3) { font-size: 15px; font-weight: 600; margin: 18px 0 8px; color: #374151; }
:deep(.docx-content h4) { font-size: 14px; font-weight: 600; margin: 14px 0 6px; }
:deep(.docx-content p)  { margin: 8px 0; }
:deep(.docx-content ul),
:deep(.docx-content ol) { margin: 8px 0; padding-left: 24px; }
:deep(.docx-content li) { margin: 4px 0; }
:deep(.docx-content table) { border-collapse: collapse; width: 100%; margin: 14px 0; }
:deep(.docx-content td),
:deep(.docx-content th) { border: 1px solid #d1d5db; padding: 6px 12px; font-size: 13px; }
:deep(.docx-content th) { background: #f3f4f6; font-weight: 600; }
:deep(.docx-content img) { max-width: 100%; height: auto; }

.docx-loading,
.docx-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #6b7280;
  gap: 12px;
  font-size: 14px;
}

.docx-loading i { font-size: 32px; color: #006DF9; }
.docx-error i   { font-size: 32px; color: #ef4444; }

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
