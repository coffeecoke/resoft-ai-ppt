<template>
  <el-dialog 
    :model-value="visible" 
    :show-close="true" 
    :close-on-click-modal="true" 
    fullscreen
    class="pdf-dialog document-dialog ppt-dialog" 
    @update:model-value="handleClose"
  >
      <div class="pdf-dialog-wrapper document-dialog-wrapper ppt-dialog-wrapper">
      <div class="pdf-main-content document-main-content ppt-main-content">
        <div class="pdf-header document-header ppt-header">
          <div class="pdf-title document-title ppt-title">
            <span class="pdf-title-tag document-title-tag ppt-title-tag tag-tender">
              招标文件
            </span>
            <span class="pdf-title-text document-title-text ppt-title-text">{{ title }}</span>
            <span class="pdf-title-meta document-title-meta ppt-title-meta" v-if="updateDate">更新时间：{{ updateDate }}</span>
          </div>
          <div class="pdf-actions document-actions ppt-actions">
            <el-button size="small" @click="handleToggleFavorite">
              <i :class="isFavorited ? 'ri-heart-2-fill' : 'ri-heart-2-line'" :style="{ color: isFavorited ? '#f56565' : 'inherit' }"></i>
              收藏 {{ favoriteCount }}
            </el-button>
            <el-button size="small" type="primary" @click="handleDownload">
              <i class="ri-folder-download-line"></i>
              下载
            </el-button>
            <el-button size="small" @click="togglePendingList">
              <i class="ri-list-check-3"></i>
              {{ isInPendingList ? '已添加待操作' : '待操作' }}
            </el-button>
            <button class="ai-analyze-btn" type="button" @click="openAiPanel">
              <i class="ri-quill-pen-ai-line"></i>
              AI全文分析
            </button>
          </div>
        </div>
        <div class="pdf-content document-content ppt-content" style="grid-template-columns: 1fr;">
          <section class="pdf-view document-view ppt-view">
            <div class="pdf-view-container">
          <iframe 
            v-if="pdfUrl" 
            :src="pdfUrl + '#toolbar=0'" 
            class="pdf-iframe"
            frameborder="0"
            type="application/pdf"
          ></iframe>
          <div v-else class="pdf-placeholder">
            <div class="pdf-placeholder-content">
              <i class="ri-file-pdf-line"></i>
              <p>{{ title }}</p>
            </div>
          </div>
            </div>
          </section>
        </div>
      </div>
      <!-- AI对话面板（从右侧滑出） -->
      <aside class="ppt-ai-panel" v-show="aiPanelVisible">
        <div class="ai-panel-content">
          <div class="ai-panel-header">
            <div class="ai-panel-title">
              AI助手
              <button class="ai-panel-close-btn" @click="closeAiPanel" title="关闭AI助手">
                关闭助手
              </button>
            </div>
          </div>
          <div class="ai-panel-main">
            <div class="ai-panel-subtitle">试试以下 AI 功能,提升阅读写作效率</div>
            <div class="ai-feature-list">
              <div class="ai-feature-item">
                <span class="feature-text">
                  使用当前文档再编辑
                  <i class="ri-quill-pen-ai-line feature-icon"></i>
                </span>
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
              <textarea 
                class="ai-input" 
                placeholder="需要我做什么?输入@发现更多技能"
                v-model="aiInputText"
                rows="4"
              ></textarea>
              <div class="ai-input-actions">
                <button class="ai-send-btn" type="button" @click="sendAiMessage">
                  <i class="ri-send-plane-fill"></i>
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
      <!-- 待操作列表抽屉 -->
      <PendingOperationsDrawer v-model:visible="pendingDrawerVisible" />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'
import { usePptDialogAiStore } from '@/store/Sales/pptDialogAi'
import PendingOperationsDrawer from '@/components/Sales/PendingOperationsDrawer.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  pdfUrl: {
    type: String,
    default: ''
  },
  updateDate: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['update:visible', 'close'])

// 使用待操作列表store
const pendingStore = usePendingOperationsStore()
// 使用文档对话框AI面板store（通用，可用于PDF、PPT等）
const documentDialogAiStore = usePptDialogAiStore()

// 内部状态
const isFavorited = ref(false)
const favoriteCount = ref(12)
const pendingDrawerVisible = ref(false)
const aiPanelVisible = ref(false)
const aiInputText = ref('')

// 检查是否在待操作列表中
const isInPendingList = computed(() => {
  if (!props.title) return false
  const itemId = `pdf-${props.title}`
  return pendingStore.pendingList.some(
    item => item.id === itemId && item.type === 'pdf'
  )
})

const handleClose = (value) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
  }
}

// 处理收藏/取消收藏
const handleToggleFavorite = () => {
  isFavorited.value = !isFavorited.value
  if (isFavorited.value) {
    favoriteCount.value += 1
    ElMessage.success('已收藏')
  } else {
    favoriteCount.value -= 1
    ElMessage.info('已取消收藏')
  }
}

// 处理下载
const handleDownload = () => {
  if (props.pdfUrl) {
    // 创建一个临时的 a 标签来触发下载
    const link = document.createElement('a')
    link.href = props.pdfUrl
    link.download = props.title || 'document.pdf'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    ElMessage.success('下载已开始')
  } else {
    ElMessage.warning('PDF文件不存在')
  }
}

// 切换待操作列表
const togglePendingList = () => {
  if (isInPendingList.value) {
    // 如果已在列表中，打开待操作列表抽屉
    pendingDrawerVisible.value = true
  } else {
    // 添加到待操作列表
    const itemId = `pdf-${props.title}`
    pendingStore.addToPending({
      id: itemId,
      type: 'pdf',
      title: props.title,
      thumbnail: '',
      tag: '招标文件',
      date: props.updateDate || new Date().toISOString().split('T')[0],
      pdfUrl: props.pdfUrl
    })
    ElMessage.success('已添加到待操作列表')
    pendingDrawerVisible.value = true
  }
}

// 打开AI面板
const openAiPanel = () => {
  aiPanelVisible.value = true
  documentDialogAiStore.setAiPanelOpen(true)
  documentDialogAiStore.registerOpenAiPanel(openAiPanel)
}

// 关闭AI面板
const closeAiPanel = () => {
  aiPanelVisible.value = false
  documentDialogAiStore.setAiPanelOpen(false)
  documentDialogAiStore.registerCloseAiPanel(closeAiPanel)
}

// 发送AI消息
const sendAiMessage = () => {
  if (!aiInputText.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }
  // TODO: 实现发送AI消息的逻辑
  console.log('发送消息:', aiInputText.value)
  ElMessage.success('消息已发送')
  aiInputText.value = ''
}

// 监听对话框打开/关闭状态，同步到store
watch(() => props.visible, (newVal) => {
  if (newVal) {
    documentDialogAiStore.setPptDialogOpen(true)
    documentDialogAiStore.registerOpenAiPanel(openAiPanel)
    documentDialogAiStore.registerCloseAiPanel(closeAiPanel)
  } else {
    documentDialogAiStore.setPptDialogOpen(false)
    documentDialogAiStore.unregisterOpenAiPanel()
    documentDialogAiStore.unregisterCloseAiPanel()
    aiPanelVisible.value = false
    documentDialogAiStore.setAiPanelOpen(false)
  }
}, { immediate: true })

// 监听AI面板的显示状态，同步到store
watch(() => aiPanelVisible.value, (newVal) => {
  documentDialogAiStore.setAiPanelOpen(newVal)
})

// 组件卸载时清理
onBeforeUnmount(() => {
  documentDialogAiStore.unregisterOpenAiPanel()
  documentDialogAiStore.unregisterCloseAiPanel()
  documentDialogAiStore.setPptDialogOpen(false)
  documentDialogAiStore.setAiPanelOpen(false)
})
</script>

<style scoped>
.pdf-view-container {
  width: 100%;
  height: 100%;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
}

.pdf-iframe {
  width: 100%;
  height: 100%;
  border: none;
  background: #fff;
}

.pdf-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.pdf-placeholder-content {
  text-align: center;
  color: #666;
}

.pdf-placeholder-content i {
  font-size: 64px;
  color: #d32f2f;
  margin-bottom: 16px;
  display: block;
}

.pdf-placeholder-content p {
  font-size: 16px;
  margin: 0;
}
</style>

