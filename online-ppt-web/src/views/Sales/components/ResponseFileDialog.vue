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
            <span class="ppt-title-tag tag-response">
              响应文件
            </span>
            <span class="ppt-title-text">{{ title }}</span>
            <span class="ppt-title-meta">
              <i class="ri-account-pin-box-line"></i> 用户名 · 
              <i class="ri-time-line"></i> 2025/10/20 · 
              <i class="ri-fire-line"></i> 123
            </span>
          </div>
          <div class="ppt-actions">
            <el-button size="small" @click="handleToggleFavorite">
              <i :class="isFavorited ? 'ri-heart-2-fill' : 'ri-heart-2-line'" :style="{ color: isFavorited ? '#f56565' : 'inherit' }"></i>
              收藏 {{ favoriteCount }}
            </el-button>
            <el-button size="small" type="primary">
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
        <div class="ppt-content">
          <ResponseFileToc
            :response-toc-sections="responseTocSections"
            :active-slide="activeSlide"
            :selected-slides="selectedSlides"
            v-model:word-toc-mode="wordTocMode"
            @item-click="toggleResponseItem"
            @analyze-selected="handleAnalyzeSelected"
            @download-selected="handleDownloadSelected"
            @add-to-pending="handleAddToPending"
            @section-select-all="handleSectionSelectAll"
          />
          <section class="ppt-view">
            <div class="ppt-view-list">
              <div 
                v-for="(slide, idx) in slides" 
                :key="slide.id || idx" 
                class="ppt-view-item"
              >
                <img :src="slide.img" :alt="slide.title || slide.id || ('P' + (idx + 1))" />
                <div class="ppt-view-page-number">{{ idx + 1 }}</div>
              </div>
            </div>
          </section>
          <!-- 响应文件右侧信息栏 -->
          <aside class="ppt-sidebar">
            <!-- 对应的招标文件 -->
            <div class="sidebar-section">
              <div class="sidebar-title">招标文件</div>
              <div class="response-tender-file-item" v-if="sidebarData.tenderFile">
                <div class="tender-file-icon">
                  <i class="ri-file-pdf-2-line"></i>
                </div>
                <div class="tender-file-info">
                  <div class="tender-file-title">{{ sidebarData.tenderFile.title }}</div>
                  <div class="tender-file-date">{{ sidebarData.tenderFile.date }}</div>
                </div>
              </div>
            </div>
            
            <!-- 项目前期交流的视频 -->
            <div class="sidebar-section">
              <div class="sidebar-title">项目前期交流</div>
              <div class="communication-info">
                <div 
                  v-for="video in sidebarData.projectVideos" 
                  :key="video.id"
                  class="comm-video-wrapper"
                >
                  <div class="comm-video-thumb">
                    <img 
                      v-if="video.thumbnail" 
                      :src="video.thumbnail" 
                      :alt="video.title"
                    />
                    <div v-else class="video-placeholder">
                      <span class="video-label">视频</span>
                    </div>
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
            
            <!-- 相似的响应文件 -->
            <div class="sidebar-section">
              <div class="sidebar-title">相似响应文件</div>
              <div class="similar-docs">
                <div 
                  v-for="file in sidebarData.similarResponseFiles" 
                  :key="file.id" 
                  class="similar-doc-item"
                >
                  <div class="doc-icon">
                    <i class="ri-file-word-line"></i>
                  </div>
                  <div class="doc-info">
                    <div class="doc-title-row">
                      <div class="doc-title">{{ file.title }}</div>
                    </div>
                    <div class="doc-meta">{{ file.creator }} {{ file.date }}</div>
                    <div class="doc-stats">
                      <span>{{ file.views }}</span>
                      <span>{{ file.downloads }}</span>
                      <span>{{ file.likes }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
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

<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'
import { usePptDialogAiStore } from '@/store/Sales/pptDialogAi'
import PendingOperationsDrawer from '@/components/Sales/PendingOperationsDrawer.vue'
import ResponseFileToc from './ResponseFileToc.vue'
import { responseFileSidebarData } from '@/configs/salesData'

interface ResponseTocSection {
  title: string
  items: string[]
}

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: ''
  },
  slides: {
    type: Array,
    default: () => []
  },
  responseTocSections: {
    type: Array as () => ResponseTocSection[],
    default: () => []
  }
})

const emit = defineEmits(['update:visible', 'close'])

// 右侧栏数据
const sidebarData = computed(() => responseFileSidebarData)

// 使用待操作列表store
const pendingStore = usePendingOperationsStore()
// 使用PPT对话框AI面板store
const pptDialogAiStore = usePptDialogAiStore()

// 内部状态
const activeSlide = ref(0)
const selectedSlides = ref<number[]>([])
const wordTocMode = ref<'single' | 'multi'>('single')
const aiPanelVisible = ref(false)
const aiInputText = ref('')
const pendingDrawerVisible = ref(false)
const isFavorited = ref(false)
const favoriteCount = ref(12)

// 检查当前文档是否已在待操作列表中
const isInPendingList = computed(() => {
  const currentId = props.title || ''
  return pendingStore.pendingList.some(item => item.id === currentId && item.type === 'response')
})

// 响应文件目录扁平化（用于计算索引）
const responseTocFlat = computed(() => {
  return props.responseTocSections.flatMap(section =>
    section.items.map(title => ({ section: section.title, title }))
  )
})

const responseIndex = (title: string) => {
  return responseTocFlat.value.findIndex(t => t.title === title)
}

// 方法
const handleClose = (value: boolean) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
    // 重置状态
    activeSlide.value = 0
    selectedSlides.value = []
    aiPanelVisible.value = false
    aiInputText.value = ''
  }
}

const scrollToSlide = (i: number) => {
  nextTick(() => {
    const el = document.querySelector(`.ppt-view-list .ppt-view-item:nth-child(${i + 1})`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const chooseSlide = (i: number) => { 
  activeSlide.value = i 
  scrollToSlide(i)
}

const toggleSlideSelection = (i: number) => {
  const index = selectedSlides.value.indexOf(i)
  if (index > -1) {
    selectedSlides.value.splice(index, 1)
  } else {
    selectedSlides.value.push(i)
  }
}

const toggleResponseItem = (title: string) => {
  const idx = responseIndex(title)
  if (idx < 0) return
  if (wordTocMode.value === 'multi') {
    // 多选模式：切换选中状态
    toggleSlideSelection(idx)
    activeSlide.value = idx
    scrollToSlide(idx)
  } else {
    // 单选模式：清空其他选中项，只选中当前项
    selectedSlides.value = [idx]
    activeSlide.value = idx
    scrollToSlide(idx)
  }
}

const openAiPanel = () => {
  aiPanelVisible.value = true
}

const closeAiPanel = () => {
  aiPanelVisible.value = false
}

// 监听对话框打开/关闭状态，同步到store
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

// 监听AI面板的显示状态，同步到store
watch(() => aiPanelVisible.value, (newVal) => {
  pptDialogAiStore.setAiPanelOpen(newVal)
})

// 组件卸载时清理
onBeforeUnmount(() => {
  pptDialogAiStore.unregisterOpenAiPanel()
  pptDialogAiStore.unregisterCloseAiPanel()
  pptDialogAiStore.setPptDialogOpen(false)
  pptDialogAiStore.setAiPanelOpen(false)
})

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

// 切换待操作列表状态
const togglePendingList = () => {
  const currentId = props.title || Date.now().toString()
  
  if (isInPendingList.value) {
    pendingStore.removeFromPending(currentId, 'response')
    ElMessage.success('已从待操作列表移除')
  } else {
    pendingStore.addToPending({
      id: currentId,
      type: 'response',
      title: props.title,
      thumbnail: props.slides[0]?.img || '',
      tag: '响应文件',
      date: new Date().toISOString().split('T')[0],
      slides: props.slides
    })
    ElMessage.success('已添加到待操作列表')
    pendingDrawerVisible.value = true
  }
}

// 处理选中-AI分析
const handleAnalyzeSelected = () => {
  // 如果没有选中项，使用当前激活的项
  const targetIndex = selectedSlides.value.length > 0 ? selectedSlides.value[0] : activeSlide.value
  
  if (targetIndex < 0 || !props.slides[targetIndex]) {
    ElMessage.warning('请先选择要分析的内容')
    return
  }
  
  activeSlide.value = targetIndex
  scrollToSlide(targetIndex)
  aiPanelVisible.value = true
}

// 处理选中-下载
const handleDownloadSelected = () => {
  // 如果没有选中项，使用当前激活的项
  const itemsToDownload = selectedSlides.value.length > 0 
    ? selectedSlides.value 
    : (activeSlide.value >= 0 ? [activeSlide.value] : [])
  
  if (itemsToDownload.length === 0) {
    ElMessage.warning('请先选择要下载的内容')
    return
  }
  
  // TODO: 实现下载逻辑
  ElMessage.success(`已选择 ${itemsToDownload.length} 项进行下载`)
}

// 处理选中-待操作
const handleAddToPending = () => {
  // 如果没有选中项，使用当前激活的项
  const itemsToAdd = selectedSlides.value.length > 0 
    ? selectedSlides.value 
    : (activeSlide.value >= 0 ? [activeSlide.value] : [])
  
  if (itemsToAdd.length === 0) {
    ElMessage.warning('请先选择要添加的内容')
    return
  }
  
  let addedCount = 0
  
  itemsToAdd.forEach(slideIndex => {
    const slide = props.slides[slideIndex]
    if (slide) {
      const itemId = `${props.title || Date.now().toString()}-slide-${slideIndex}`
      const exists = pendingStore.pendingList.find(
        item => item.id === itemId && item.type === 'response'
      )
      
      if (!exists) {
        pendingStore.addToPending({
          id: itemId,
          type: 'response',
          title: `${props.title} - ${slide.title || `第${slideIndex + 1}项`}`,
          thumbnail: slide.img || '',
          tag: '响应文件',
          date: new Date().toISOString().split('T')[0],
          slides: [slide]
        })
        addedCount++
      }
    }
  })
  
  if (addedCount > 0) {
    ElMessage.success(`已将 ${addedCount} 项添加到待操作列表`)
    pendingDrawerVisible.value = true
  } else {
    ElMessage.info('选中的内容已在待操作列表中')
  }
}

// 处理一级目录全选/取消全选
const handleSectionSelectAll = (itemIndices: number[], select: boolean) => {
  if (select) {
    // 选中该目录下的所有项
    itemIndices.forEach(idx => {
      if (!selectedSlides.value.includes(idx)) {
        selectedSlides.value.push(idx)
      }
    })
  } else {
    // 取消选中该目录下的所有项
    itemIndices.forEach(idx => {
      const index = selectedSlides.value.indexOf(idx)
      if (index > -1) {
        selectedSlides.value.splice(index, 1)
      }
    })
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
</script>

<style scoped>
/* 待操作按钮图标间距 */
.ppt-actions .el-button i {
  margin-right: 4px;
}
</style>

