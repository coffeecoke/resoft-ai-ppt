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
            <span
              class="ppt-title-tag"
              :class="type === 'public' ? 'tag-public' : 'tag-practical'"
            >
              {{ type === 'public' ? '公共版' : '实战版' }}
            </span>
            <span class="ppt-title-text">{{ title }}</span>
            <span class="ppt-title-meta">创建人：用户名 · 2025/10/20 · 阅读 123</span>
          </div>
          <div class="ppt-actions">
              <el-button size="small">
                <i class="ri-heart-2-line"></i>
                收藏 12
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
        <div class="ppt-content" :class="{ 'is-public': type === 'public' }">
          <aside class="ppt-thumbs" v-if="!isResponseDialog">
            <div class="ppt-thumbs-header">
              <span class="ppt-thumbs-title">文档目录</span>
              <span class="ppt-thumbs-selected" v-if="selectedSlides.length > 0">已选{{ selectedSlides.length }}</span>
            </div>
            <el-scrollbar height="520px">
              <div 
                v-for="(s, i) in slides" 
                :key="s.id" 
                class="thumb-item" 
                :class="{active: i===activeSlide, selected: selectedSlides.includes(i)}" 
                @click="chooseSlide(i)"
              >
                <div class="thumb-checkbox" @click.stop="toggleSlideSelection(i)">
                  <el-checkbox 
                    :model-value="selectedSlides.includes(i)"
                    @change="toggleSlideSelection(i)"
                    @click.stop
                  />
                </div>
                <div class="thumb-image-wrapper">
                  <img :src="s.img" :alt="s.title" />
                  <div class="thumb-page-number">{{ i + 1 }}</div>
                </div>
              </div>
            </el-scrollbar>
            <div class="ppt-thumbs-footer">
              <el-button type="primary" plain style="width: 100%; margin-bottom: 0;" @click="analyzeSelectedSlide">
                <el-icon><MagicStick /></el-icon> 选中-AI分析
              </el-button>
              <el-button style="width: 100%; margin-bottom: 0;" @click="downloadSelectedSlides">
                <el-icon><Download /></el-icon> 选中-下载
              </el-button>
              <el-button style="width: 100%;" @click="addSelectedToPendingList">
                <i class="ri-list-check-3"></i> 选中-待操作
              </el-button>
            </div>
          </aside>
          <aside class="ppt-thumbs word-toc" :class="wordTocMode === 'multi' ? 'is-multi' : 'is-single'" v-else>
            <div class="ppt-thumbs-header">
              <span class="ppt-thumbs-title">文档目录</span>
              <div class="mode-switch-container word-toc-switch">
                <div 
                  class="mode-item" 
                  :class="{ active: wordTocMode === 'single' }" 
                  @click="wordTocMode = 'single'"
                >
                  <i class="ri-check-line mode-icon"></i>
                  <span class="mode-text">单选模式</span>
                </div>
                <div 
                  class="mode-item" 
                  :class="{ active: wordTocMode === 'multi' }" 
                  @click="wordTocMode = 'multi'"
                >
                  <i class="ri-grid-fill mode-icon"></i>
                  <span class="mode-text">多选模式</span>
                </div>
              </div>
            </div>
            <ul class="word-toc-list catalog-list">
              <li v-for="section in responseTocSections" :key="section.title" class="word-toc-section">
                <div class="word-toc-section-title cat-title">{{ section.title }}</div>
                <ul class="catalog-sub">
                  <li
                    v-for="item in section.items"
                    :key="item"
                    class="word-toc-item"
                    :class="{
                      active: responseIndex(item) === activeSlide,
                      selected: selectedSlides.includes(responseIndex(item))
                    }"
                    @click="toggleResponseItem(item)"
                  >
                    <span class="word-toc-item-text">{{ responseIndex(item) + 1 }}. {{ item }}</span>
                  </li>
                </ul>
              </li>
            </ul>
          </aside>
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
          <!-- 实战版右侧栏 -->
          <aside class="ppt-sidebar" v-if="type === 'practical'">
            <!-- 售前交流信息 -->
            <div class="sidebar-section">
              <div class="sidebar-title">售前交流信息</div>
              <div class="communication-info">
                <div class="comm-video-wrapper">
                  <div class="comm-video-thumb">
                    <img 
                      v-if="communicationInfo?.thumbnail" 
                      :src="communicationInfo.thumbnail" 
                      :alt="communicationInfo?.title || '视频'"
                    />
                    <div v-else class="video-placeholder">
                      <span class="video-label">视频</span>
                    </div>
                    <span v-if="communicationInfo?.duration" class="video-duration">{{ communicationInfo.duration }}</span>
                  </div>
                  <div class="comm-content">
                    <div class="comm-title">{{ communicationInfo?.title || '中信信托s金数及数据质量产品方案介绍' }}</div>
                    <div class="comm-meta">{{ communicationInfo?.creator || '郑相宜' }} {{ communicationInfo?.date || '25/09/01' }}</div>
                    <div class="comm-stats">
                      <span>观看 {{ communicationInfo?.views || 100 }}</span>
                      <span>收藏 {{ communicationInfo?.likes || 30 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 相似文档 -->
            <div class="sidebar-section">
              <div class="sidebar-title">相似文档</div>
              <div class="similar-docs">
                <div 
                  v-for="doc in similarDocuments" 
                  :key="doc.id" 
                  class="similar-doc-item"
                >
                  <div class="doc-thumb">
                    <img 
                      v-if="doc.thumbnail" 
                      :src="doc.thumbnail" 
                      :alt="doc.title || 'PPT'"
                    />
                    <div v-else class="doc-thumb-placeholder">
                      <span class="doc-thumb-text">PPT</span>
                    </div>
                  </div>
                  <div class="doc-info">
                    <div class="doc-title">{{ doc.title }}</div>
                    <div class="doc-meta">{{ doc.creator }} {{ doc.date }}</div>
                    <div class="doc-stats">
                      <span><i class="ri-eye-line"></i>{{ doc.views || 23 }}</span>
                      <span><i class="ri-download-line"></i>{{ doc.downloads || 12 }}</span>
                      <span><i class="ri-thumb-up-line"></i>{{ doc.likes || 1 }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 相似交流 -->
            <div class="sidebar-section">
              <div class="sidebar-title">相似交流</div>
              <div class="similar-communications">
                <div 
                  v-for="comm in similarCommunications" 
                  :key="comm.id" 
                  class="communication-info"
                >
                  <div class="comm-video-wrapper">
                    <div class="comm-video-thumb">
                      <img 
                        v-if="comm.thumbnail" 
                        :src="comm.thumbnail" 
                        :alt="comm.title || '视频'"
                      />
                      <div v-else class="video-placeholder">
                        <span class="video-label">视频</span>
                      </div>
                      <span v-if="comm.duration" class="video-duration">{{ comm.duration }}</span>
                    </div>
                    <div class="comm-content">
                      <div class="comm-title">{{ comm.title || '产品方案介绍' }}</div>
                      <div class="comm-meta">{{ comm.creator || '张明' }} {{ comm.date || '25/09/01' }}</div>
                      <div class="comm-stats">
                        <span>观看 {{ comm.views || 100 }}</span>
                        <span>收藏 {{ comm.likes || 30 }}</span>
                      </div>
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
                  使用当前PPT再编辑
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
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { MagicStick, Download } from '@element-plus/icons-vue'
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
  type: {
    type: String,
    default: 'public', // 'public' | 'practical'
    validator: (value) => ['public', 'practical'].includes(value)
  },
  slides: {
    type: Array,
    default: () => []
  },
  isResponseDialog: {
    type: Boolean,
    default: false
  },
  responseTocSections: {
    type: Array,
    default: () => []
  },
  communicationInfo: {
    type: Object,
    default: () => ({
      title: '中信信托s金数及数据质量产品方案介绍',
      creator: '郑相宜',
      date: '25/09/01',
      views: 100,
      likes: 30,
      duration: '01:05:51',
      thumbnail: 'https://picsum.photos/seed/video1/400/225'
    })
  },
  similarDocuments: {
    type: Array,
    default: () => [
      {
        id: 'doc1',
        title: '金融基础数据报送系统(PBOCD)',
        creator: '郑相宜',
        date: '25/09/01',
        views: 23,
        downloads: 12,
        likes: 1,
        thumbnail: 'https://picsum.photos/seed/doc1/110/62'
      }
    ]
  },
  similarCommunications: {
    type: Array,
    default: () => [
      {
        id: 'comm1',
        title: '北京银行一表通建设售前交流方案',
        creator: '李华',
        date: '25/09/15',
        views: 85,
        likes: 25,
        duration: '01:20:30',
        thumbnail: 'https://picsum.photos/seed/comm1/400/225'
      },
      {
        id: 'comm2',
        title: '天津农发行一表通建设售前交流方案',
        creator: '王强',
        date: '25/09/20',
        views: 92,
        likes: 28,
        duration: '01:15:45',
        thumbnail: 'https://picsum.photos/seed/comm2/400/225'
      }
    ]
  }
})

const emit = defineEmits(['update:visible', 'close'])

// 使用待操作列表store
const pendingStore = usePendingOperationsStore()
// 使用PPT对话框AI面板store
const pptDialogAiStore = usePptDialogAiStore()

// 内部状态
const activeSlide = ref(0)
const selectedSlides = ref([])
const wordTocMode = ref('single') // single | multi
const aiPanelVisible = ref(false) // 默认隐藏AI助手面板，只显示AI图标
const aiInputText = ref('')
const pendingDrawerVisible = ref(false) // 待操作列表抽屉显示状态

// 检查当前PPT是否已在待操作列表中
const isInPendingList = computed(() => {
  const currentId = props.title || ''
  return pendingStore.pendingList.some(item => item.id === currentId && item.type === 'ppt')
})

// 响应文件目录扁平化
const responseTocFlat = computed(() => {
  return props.responseTocSections.flatMap(section =>
    section.items.map(title => ({ section: section.title, title }))
  )
})

const responseIndex = (title) => {
  return responseTocFlat.value.findIndex(t => t.title === title)
}

// 方法
const handleClose = (value) => {
  emit('update:visible', value)
  if (!value) {
    emit('close')
    // 重置状态
    activeSlide.value = 0
    selectedSlides.value = []
    aiPanelVisible.value = false // 重置时也保持隐藏状态
    aiInputText.value = ''
  }
}

const scrollToSlide = (i) => {
  nextTick(() => {
    const el = document.querySelector(`.ppt-view-list .ppt-view-item:nth-child(${i + 1})`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

const chooseSlide = (i) => { 
  activeSlide.value = i 
  scrollToSlide(i)
}

const toggleSlideSelection = (i) => {
  const index = selectedSlides.value.indexOf(i)
  if (index > -1) {
    selectedSlides.value.splice(index, 1)
  } else {
    selectedSlides.value.push(i)
  }
}

const toggleResponseItem = (title) => {
  const idx = responseIndex(title)
  if (idx < 0) return
  if (wordTocMode.value === 'multi') {
    toggleSlideSelection(idx)
    activeSlide.value = idx
    scrollToSlide(idx)
  } else {
    selectedSlides.value = []
    chooseSlide(idx)
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
    // 对话框打开时，注册打开和关闭AI面板的回调并设置状态
    pptDialogAiStore.setPptDialogOpen(true)
    pptDialogAiStore.registerOpenAiPanel(openAiPanel)
    pptDialogAiStore.registerCloseAiPanel(closeAiPanel)
  } else {
    // 对话框关闭时，注销回调并关闭AI面板
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
  // 清空输入框
  aiInputText.value = ''
}

const analyzeSelectedSlide = () => {
  const targetIndex = selectedSlides.value.length ? selectedSlides.value[0] : activeSlide.value
  activeSlide.value = targetIndex
  aiPanelVisible.value = true
}

// 下载选中的幻灯片
const downloadSelectedSlides = () => {
  if (selectedSlides.value.length === 0) {
    ElMessage.warning('请先选择要下载的幻灯片')
    return
  }
  // TODO: 实现下载逻辑
  ElMessage.success(`已选择 ${selectedSlides.value.length} 张幻灯片进行下载`)
}

// 将选中的幻灯片添加到待操作列表
const addSelectedToPendingList = () => {
  if (selectedSlides.value.length === 0) {
    ElMessage.warning('请先选择要添加的幻灯片')
    return
  }
  
  let addedCount = 0
  
  // 为每个选中的幻灯片创建待操作项
  selectedSlides.value.forEach(slideIndex => {
    const slide = props.slides[slideIndex]
    if (slide) {
      const itemId = `${props.title || Date.now().toString()}-slide-${slideIndex}`
      // 检查是否已存在，避免重复添加
      const exists = pendingStore.pendingList.find(
        item => item.id === itemId && item.type === 'ppt'
      )
      
      if (!exists) {
        pendingStore.addToPending({
          id: itemId,
          type: 'ppt',
          title: `${props.title} - 第${slideIndex + 1}页`,
          thumbnail: slide.img || '',
          tag: props.type === 'public' ? '公共版' : '实战版',
          date: new Date().toISOString().split('T')[0], // 使用当前日期
          slides: [slide] // 只包含选中的单张幻灯片
        })
        addedCount++
      }
    }
  })
  
  if (addedCount > 0) {
    ElMessage.success(`已将 ${addedCount} 张幻灯片添加到待操作列表`)
    // 添加后打开抽屉，让用户查看添加的结果
    pendingDrawerVisible.value = true
  } else {
    ElMessage.info('选中的幻灯片已在待操作列表中')
  }
}

// 切换待操作列表状态（添加/移除当前PPT）
const togglePendingList = () => {
  const currentId = props.title || Date.now().toString()
  
  if (isInPendingList.value) {
    // 如果已在列表中，则移除
    pendingStore.removeFromPending(currentId, 'ppt')
    ElMessage.success('已从待操作列表移除')
  } else {
    // 如果不在列表中，则添加
    pendingStore.addToPending({
      id: currentId,
      type: 'ppt',
      title: props.title,
      thumbnail: props.slides[0]?.img || '',
      tag: props.type === 'public' ? '公共版' : '实战版',
      date: new Date().toISOString().split('T')[0], // 使用当前日期
      slides: props.slides
    })
    ElMessage.success('已添加到待操作列表')
    // 添加后打开抽屉，让用户看到操作结果
    pendingDrawerVisible.value = true
  }
}
</script>

<style scoped>
/* 待操作按钮图标间距 */
.ppt-actions .el-button i {
  margin-right: 4px;
}

/* ppt-thumbs-footer 按钮图标间距 */
.ppt-thumbs-footer .el-button i {
  margin-right: 4px;
}
</style>

