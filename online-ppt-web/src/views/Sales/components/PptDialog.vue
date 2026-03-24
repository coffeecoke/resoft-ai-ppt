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
            <el-tooltip :content="title" placement="top" :disabled="title.length <= 20">
              <span class="ppt-title-text">{{ title }}</span>
            </el-tooltip>
            <span class="ppt-title-meta">创建人：融鑫小R · {{ formattedCreatedAt }} · 阅读 {{ viewCount }}</span>
          </div>
          <div class="ppt-actions">
              <el-button size="small">
                <i class="ri-heart-2-line"></i>
                收藏 12
              </el-button>
              <el-button size="small" type="primary" :loading="exporting" @click="handleDownloadAll">
                <i class="ri-folder-download-line"></i>
                下载
              </el-button>
              <el-button size="small" @click="pendingDrawerVisible = true">
                <i class="ri-list-check-3"></i>
                待操作
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
              <el-button type="primary" plain style="width: 100%; margin-bottom: 0;" @click="handleAnalyzeClick">
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
                      :src="normalizeThumb(communicationInfo?.thumbnail)" 
                      :alt="communicationInfo?.title || '视频'"
                    />
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
                      width="120px"
                     
                      :src="normalizeThumb(doc.thumbnail)" 
                      :alt="doc.title || 'PPT'"
                    />
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
                        :src="normalizeThumb(comm.thumbnail)" 
                        :alt="comm.title || '视频'"
                      />
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
          <!-- 顶部标题 -->
          <div class="ai-panel-header">
            <div class="ai-panel-title">
              AI助手
              <button class="ai-panel-close-btn" @click="closeAiPanel" title="关闭AI助手">
                关闭助手
              </button>
            </div>
          </div>
          
          <!-- 功能按钮区域（固定不滚动） -->
          <div class="ai-panel-actions">
            <div class="ai-panel-subtitle">试试以下 AI 功能,提升阅读写作效率</div>
            <div class="ai-feature-list">
              <div class="ai-feature-item" @click="editCurrentPPT">
                <span class="feature-text">
                  使用当前PPT再编辑
                  <i class="ri-quill-pen-ai-line feature-icon"></i>
                </span>
                <i class="ri-arrow-right-s-line feature-arrow"></i>
              </div>
              <div class="ai-feature-item" @click="handleSummarizeClick">
                <span class="feature-text">总结本文档大意</span>
                <i class="ri-arrow-right-s-line feature-arrow"></i>
              </div>
            </div>
          </div>
          
          <!-- 中间内容区域（可滚动：聊天记录） -->
          <div class="ai-panel-main">
            <!-- 聊天记录 -->
            <div v-if="chatMessages.length > 0" class="ai-chat-messages">
              <div 
                v-for="(msg, index) in chatMessages" 
                :key="index" 
                class="chat-message"
                :class="msg.role"
              >
                <div class="message-avatar">
                  <i v-if="msg.role === 'user'" class="ri-user-line"></i>
                  <i v-else class="ri-robot-line"></i>
                </div>
                <div class="message-content">
                  <div class="message-text" v-html="msg.content"></div>
                </div>
              </div>
              <!-- AI正在输入状态 -->
              <div v-if="aiTyping" class="chat-message assistant typing">
                <div class="message-avatar">
                  <i class="ri-robot-line"></i>
                </div>
                <div class="message-content">
                  <div class="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- 空状态提示 -->
            <div v-else class="empty-state">
              <i class="ri-chat-3-line"></i>
              <p>开始与AI助手对话吧</p>
            </div>
          </div>
          
          <!-- 底部输入框（固定不滚动） -->
          <div class="ai-panel-footer">
            <div class="ai-input-wrapper">
              <textarea 
                class="ai-input" 
                placeholder="需要我做什么?输入@发现更多技能"
                v-model="aiInputText"
                rows="3"
                @keydown.enter.ctrl="sendAiMessage"
              ></textarea>
              <div class="ai-input-actions">
                <button 
                  class="ai-send-btn" 
                  type="button" 
                  @click="sendAiMessage"
                  :disabled="aiChatLoading || !aiInputText.trim()"
                >
                  <i v-if="!aiChatLoading" class="ri-send-plane-fill"></i>
                  <i v-else class="ri-loader-4-line rotating"></i>
                  {{ aiChatLoading ? '发送中' : '发送' }}
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
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { openEditorTab } from '@/utils/openEditor'
import { duplicateDocument } from '@/services/documentService'
import { MagicStick, Download } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { authFetch } from '@/services'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'
import { usePptDialogAiStore } from '@/store/Sales/pptDialogAi'
import PendingOperationsDrawer from '@/components/Sales/PendingOperationsDrawer.vue'
import { useExportPPT } from '../composables/useExportPPT'
import defaultCoverImg from '@/assets/imgs/fm.jpg'

/** 缩略图优先用项目图：无值或为 picsum 占位图时使用 fm.jpg */
function normalizeThumb(url) {
  return (!url || (typeof url === 'string' && url.includes('picsum'))) ? defaultCoverImg : url
}

const router = useRouter()

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
  createdAt: {
    type: String,
    default: ''
  },
  viewCount: {
    type: Number,
    default: 0
  },
  documentId: {
    type: String,
    required: true
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
      thumbnail: defaultCoverImg
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
        thumbnail: defaultCoverImg
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
        thumbnail: defaultCoverImg
      },
      {
        id: 'comm2',
        title: '天津农发行一表通建设售前交流方案',
        creator: '王强',
        date: '25/09/20',
        views: 92,
        likes: 28,
        duration: '01:15:45',
        thumbnail: defaultCoverImg
      }
    ]
  }
})

const emit = defineEmits(['update:visible', 'close'])

// 格式化创建时间
const formattedCreatedAt = computed(() => {
  if (!props.createdAt) return '未知'
  
  // 如果是完整ISO格式（包含T），先提取日期部分
  if (props.createdAt.includes('T')) {
    const date = props.createdAt.split('T')[0]
    return date.replace(/-/g, '/')
  }
  
  // 如果是YYYY-MM-DD格式，转换为YYYY/MM/DD
  if (props.createdAt.includes('-')) {
    return props.createdAt.replace(/-/g, '/')
  }
  
  return props.createdAt
})

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
const exporting = ref(false) // 导出状态
const pendingSlideIds = ref<string[]>([]) // 分析方向模式：缓存待分析的幻灯片 ID
const pendingSummarize = ref(false) // 总结方向模式：等待用户输入总结方向

// 文档总结相关状态
const summaryVisible = ref(false)
const summaryLoading = ref(false)
const summaryText = ref('')

// AI聊天相关状态
const chatMessages = ref<Array<{role: 'user' | 'assistant', content: string}>>([])
const aiChatLoading = ref(false)
const aiTyping = ref(false)

// 格式化总结内容（简单格式化为HTML）- 已废弃，现在直接存储HTML
// const formattedSummary = computed(() => {
//   if (!summaryText.value) return ''
//   
//   let html = summaryText.value
//     // emoji标题转为h4
//     .replace(/^(📌|🎯|💡|👥|📊)\s+(.+)$/gm, '<h4>$1 $2</h4>')
//     // bullet points转为li
//     .replace(/^•\s+(.+)$/gm, '<li>$1</li>')
//     // 换行转为br
//     .replace(/\n/g, '<br>')
//   
//   return html
// })


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

/**
 * 点击"选中-AI分析"：缓存已选幻灯片 ID，预填输入框，打开 AI 面板
 */
const handleAnalyzeClick = () => {
  if (selectedSlides.value.length === 0) {
    ElMessage.warning('请先选择要分析的幻灯片')
    return
  }
  pendingSlideIds.value = selectedSlides.value
    .map(i => (props.slides[i] as any)?.id)
    .filter(Boolean) as string[]
  aiInputText.value = '分析方向：'
  aiPanelVisible.value = true
  nextTick(() => {
    const inputEl = document.querySelector('.ai-input') as HTMLTextAreaElement
    if (inputEl) {
      inputEl.focus()
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
    }
  })
}

/**
 * 点击"总结本文档大意"：预填输入框，打开 AI 面板
 */
const handleSummarizeClick = () => {
  pendingSummarize.value = true
  aiInputText.value = '总结方向：'
  aiPanelVisible.value = true
  nextTick(() => {
    const inputEl = document.querySelector('.ai-input') as HTMLTextAreaElement
    if (inputEl) {
      inputEl.focus()
      inputEl.setSelectionRange(inputEl.value.length, inputEl.value.length)
    }
  })
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
  pptDialogAiStore.unregisterAddAiMessage()
  pptDialogAiStore.unregisterUpdateLastAiMessage()
  pptDialogAiStore.setPptDialogOpen(false)
  pptDialogAiStore.setAiPanelOpen(false)
})

// 添加消息到AI助手的函数
const addMessageToAi = (message: { role: string; content: string }) => {
  chatMessages.value.push(message)
  nextTick(() => {
    scrollToBottom()
  })
}

// 更新最后一条AI消息的函数
const updateLastAiMessageFn = (content: string) => {
  if (chatMessages.value.length > 0) {
    const lastMessage = chatMessages.value[chatMessages.value.length - 1]
    if (lastMessage.role === 'assistant') {
      lastMessage.content = content
      nextTick(() => {
        scrollToBottom()
      })
    }
  }
}

// 注册添加消息和更新消息的回调
pptDialogAiStore.registerAddAiMessage(addMessageToAi)
pptDialogAiStore.registerUpdateLastAiMessage(updateLastAiMessageFn)

// 发送AI消息
const sendAiMessage = async () => {
  if (!aiInputText.value.trim()) {
    ElMessage.warning('请输入消息内容')
    return
  }
  
  if (!props.documentId) {
    ElMessage.error('文档ID不存在')
    return
  }
  
  if (aiChatLoading.value) {
    return // 防止重复发送
  }
  
  const userMessage = aiInputText.value.trim()
  
  // 检测"分析方向："前缀：有缓存的幻灯片 ID 时，走分析逻辑
  if (userMessage.startsWith('分析方向：') && pendingSlideIds.value.length > 0) {
    const direction = userMessage.replace('分析方向：', '').trim()
    const cachedIds = [...pendingSlideIds.value]
    pendingSlideIds.value = []
    aiInputText.value = ''
    await analyzeSelectedSlide(direction, cachedIds)
    return
  }

  // 检测"总结方向："前缀：有 pendingSummarize 标记时，走总结逻辑
  if (userMessage.startsWith('总结方向：') && pendingSummarize.value) {
    const direction = userMessage.replace('总结方向：', '').trim()
    pendingSummarize.value = false
    aiInputText.value = ''
    await handleSummarize(direction)
    return
  }
  
  // 添加用户消息到聊天记录
  chatMessages.value.push({
    role: 'user',
    content: userMessage
  })
  
  // 清空输入框
  aiInputText.value = ''
  
  // 滚动到底部
  await nextTick()
  scrollToBottom()
  
  // 设置加载状态
  aiChatLoading.value = true
  aiTyping.value = true
  
  try {
    console.log('[AI助手] 发送消息:', userMessage)
    
    // 准备历史对话（只保留最近5轮对话，避免token过多）
    const history = chatMessages.value.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }))
    
    // 调用后端流式API
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
    const response = await authFetch(
      `${API_BASE_URL}/sales/documents/${props.documentId}/chat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: history.slice(0, -1)
        })
      }
    )
    
    if (!response.ok) {
      throw new Error('AI助手回复失败')
    }
    
    // 流式读取响应
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    
    // 创建助手消息
    const assistantMessage = {
      role: 'assistant' as const,
      content: ''
    }
    chatMessages.value.push(assistantMessage)
    
    // 滚动到底部显示新消息
    await nextTick()
    scrollToBottom()
    
    aiTyping.value = false // 停止输入动画，开始显示文字
    
    let chunkCount = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      chunkCount++
      console.log(`[AI助手] 接收chunk #${chunkCount}, 长度:`, chunk.length)
      
      // 确保触发响应式更新
      chatMessages.value[chatMessages.value.length - 1].content += chunk
      
      // 流式输出时也滚动到底部
      await nextTick()
      scrollToBottom()
    }
    
    console.log('[AI助手] 回复完成，总内容长度:', chatMessages.value[chatMessages.value.length - 1].content.length)
  } catch (error: any) {
    console.error('[AI助手] 发送失败:', error)
    ElMessage.error('AI助手回复失败：' + (error.message || '未知错误'))
    
    // 移除失败的用户消息
    if (chatMessages.value[chatMessages.value.length - 1]?.role === 'assistant' && 
        !chatMessages.value[chatMessages.value.length - 1]?.content) {
      chatMessages.value.pop()
    }
  } finally {
    aiChatLoading.value = false
    aiTyping.value = false
  }
}

/**
 * 滚动聊天区域到底部
 */
const scrollToBottom = () => {
  const mainEl = document.querySelector('.ai-panel-main')
  if (mainEl) {
    mainEl.scrollTop = mainEl.scrollHeight
  }
}

/**
 * 分析选中的幻灯片
 * @param userPrompt 用户输入的分析方向（可选，来自"分析方向："前缀）
 * @param overrideSlideIds 直接传入的幻灯片 ID 数组（从 sendAiMessage 分支传来）
 */
const analyzeSelectedSlide = async (userPrompt = '', overrideSlideIds?: string[]) => {
  // 验证文档ID
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法进行分析')
    return
  }

  let selectedSlideIds: string[]
  let pageCount: number
  let pageList: string

  if (overrideSlideIds && overrideSlideIds.length > 0) {
    // 来自 sendAiMessage 分支，直接使用传入的 ID
    selectedSlideIds = overrideSlideIds
    pageCount = overrideSlideIds.length
    pageList = String(pageCount)
  } else {
    // 来自按钮直接点击（不走分析方向前缀流程）
    if (selectedSlides.value.length === 0) {
      ElMessage.warning('请先选择要分析的幻灯片')
      return
    }
    selectedSlideIds = selectedSlides.value.map(index => {
      const slide = props.slides[index] as any
      return slide?.id
    }).filter((id): id is string => Boolean(id))

    if (selectedSlideIds.length === 0) {
      ElMessage.error('选中的幻灯片数据不完整')
      return
    }
    pageCount = selectedSlides.value.length
    pageList = selectedSlides.value.map(i => i + 1).join('、')
  }

  console.log('[幻灯片分析] slideIds:', selectedSlideIds, 'userPrompt:', userPrompt)

  // 打开AI面板
  aiPanelVisible.value = true

  // 构建用户消息（展示在聊天记录中）
  const requestMessage = userPrompt
    ? `请分析选中的${pageCount}页内容（分析方向：${userPrompt}）`
    : pageCount === 1
      ? `请分析第${pageList}页的内容`
      : `请分析选中的${pageCount}页内容（第${pageList}页）`

  chatMessages.value.push({
    role: 'user',
    content: requestMessage
  })

  // 滚动到底部
  await nextTick()
  scrollToBottom()

  // 设置加载状态
  aiChatLoading.value = true
  aiTyping.value = true

  try {
    console.log('[幻灯片分析] 开始分析，documentId:', props.documentId,
                'slideIds:', selectedSlideIds)

    // 调用后端流式API
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
    const response = await authFetch(
      `${API_BASE_URL}/sales/documents/${props.documentId}/analyze-slides`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slideIds: selectedSlideIds,
          userPrompt: userPrompt || ''
        })
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || '生成分析失败')
    }

    // 流式读取响应
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    // 创建助手消息
    const assistantMessage = {
      role: 'assistant' as const,
      content: ''
    }
    chatMessages.value.push(assistantMessage)

    // 滚动到底部显示新消息
    await nextTick()
    scrollToBottom()

    aiTyping.value = false // 停止输入动画，开始显示文字

    let rawContent = ''
    let chunkCount = 0
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        console.log('[幻灯片分析] 流式传输完成，总块数:', chunkCount)
        break
      }

      chunkCount++
      const chunk = decoder.decode(value, { stream: true })
      rawContent += chunk

      // 更新助手消息内容
      assistantMessage.content = rawContent

      // 定期滚动
      if (chunkCount % 3 === 0) {
        await nextTick()
        scrollToBottom()
      }
    }

    console.log('[幻灯片分析] 分析完成，内容长度:', rawContent.length)

    // 最后滚动一次
    await nextTick()
    scrollToBottom()

  } catch (error: any) {
    console.error('[幻灯片分析] 分析失败:', error)
    ElMessage.error('AI分析失败：' + (error.message || '未知错误'))

    // 移除失败的消息
    if (chatMessages.value[chatMessages.value.length - 1]?.role === 'assistant' &&
        !chatMessages.value[chatMessages.value.length - 1]?.content) {
      chatMessages.value.pop()
    }
    // 也移除用户消息
    if (chatMessages.value[chatMessages.value.length - 1]?.role === 'user') {
      chatMessages.value.pop()
    }
  } finally {
    aiChatLoading.value = false
    aiTyping.value = false
  }
}

// 头部下载按钮：如果有选中，下载选中的；否则下载全部
const handleDownloadAll = async () => {
  console.log('[PPT弹框] 下载 - documentId:', props.documentId)
  
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法下载')
    return
  }
  
  const indexes = selectedSlides.value.length > 0 ? selectedSlides.value : []
  
  exporting.value = true
  try {
    const { exportPPTX } = useExportPPT(props.documentId)
    await exportPPTX(indexes)
    ElMessage.success(
      indexes.length > 0 
        ? `已导出 ${indexes.length} 张幻灯片` 
        : '已导出全部幻灯片'
    )
  } catch (error: any) {
    console.error('[PPT弹框] 下载失败:', error)
    ElMessage.error('导出失败：' + (error.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

// 下载选中的幻灯片
const downloadSelectedSlides = async () => {
  if (selectedSlides.value.length === 0) {
    ElMessage.warning('请先选择要下载的幻灯片')
    return
  }
  
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法下载')
    return
  }
  
  exporting.value = true
  try {
    const { exportPPTX } = useExportPPT(props.documentId)
    await exportPPTX(selectedSlides.value)
    ElMessage.success(`已导出 ${selectedSlides.value.length} 张幻灯片`)
  } catch (error: any) {
    console.error('[PPT弹框] 下载失败:', error)
    ElMessage.error('导出失败：' + (error.message || '未知错误'))
  } finally {
    exporting.value = false
  }
}

// 将选中的幻灯片添加到待操作列表
const addSelectedToPendingList = () => {
  if (selectedSlides.value.length === 0) {
    ElMessage.warning('请先选择要添加的幻灯片')
    return
  }
  
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法添加到待操作列表')
    return
  }
  
  let addedCount = 0
  
  // 为每个选中的幻灯片创建待操作项
  selectedSlides.value.forEach(slideIndex => {
    const slide = props.slides[slideIndex]
    if (slide && slide.id) {
      // 使用 documentId 和 slideId 生成唯一ID
      const itemId = `${props.documentId}-slide-${slide.id}`
      // 检查是否已存在，避免重复添加
      const exists = pendingStore.pendingList.find(
        item => item.id === itemId && item.type === 'ppt'
      )
      
      if (!exists) {
        pendingStore.addToPending({
          id: itemId,
          type: 'ppt',
          title: `${props.title} - 第${slideIndex + 1}页`,
          documentId: props.documentId, // 必须字段，用于后端查询
          slideIds: [slide.id], // 幻灯片ID数组
          thumbnail: slide.img || '',
          tag: props.type === 'public' ? '公共版' : '实战版',
          date: new Date().toISOString().split('T')[0], // 使用当前日期
          slides: [slide] // 保留用于兼容
        })
        addedCount++
      }
    } else {
      console.warn('[待操作] 幻灯片缺少id字段，跳过:', slide)
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


/**
 * 使用当前PPT再编辑
 * 静默复制一份为个人副本（tag=personal），然后新页签打开编辑器
 */
const editCurrentPPT = async () => {
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法编辑')
    return
  }

  try {
    ElMessage.info('正在创建副本...')

    const resp = await duplicateDocument(props.documentId) as any
    if (!resp?.success || !resp?.data?.id) {
      throw new Error(resp?.error || '创建副本失败')
    }

    // 关闭当前弹框
    handleClose(false)

    // 新页签打开副本
    openEditorTab('/ppt/editor', { documentId: resp.data.id }, resp.data.id)

    ElMessage.success('副本已创建，正在打开编辑器')
    console.log('[PPT弹框] 创建副本并打开编辑器，newId:', resp.data.id)
  } catch (error: any) {
    console.error('[PPT弹框] 创建副本失败:', error)
    ElMessage.error(error?.message || '创建副本失败')
  }
}

/**
 * 总结文档
 * 调用后端API，流式接收总结内容，作为聊天消息展示
 * @param userPrompt 用户输入的总结方向（可选）
 */
const handleSummarize = async (userPrompt = '') => {
  if (!props.documentId) {
    ElMessage.error('文档ID不存在，无法生成总结')
    return
  }
  
  if (summaryLoading.value) {
    return // 防止重复生成
  }
  
  // 添加用户请求到聊天记录
  chatMessages.value.push({
    role: 'user',
    content: userPrompt ? `请总结这个PPT文档的大意（总结方向：${userPrompt}）` : '请总结这个PPT文档的大意'
  })
  
  // 滚动到底部
  await nextTick()
  scrollToBottom()
  
  // 设置加载状态
  summaryLoading.value = true
  aiTyping.value = true
  
  try {
    console.log('[PPT弹框] 开始生成总结，documentId:', props.documentId)
    
    // 调用后端流式API
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
    const response = await authFetch(
      `${API_BASE_URL}/sales/documents/${props.documentId}/summary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPrompt: userPrompt || '' })
      }
    )
    
    if (!response.ok) {
      throw new Error('生成总结失败')
    }
    
    // 流式读取响应
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    
    // 创建助手消息
    const assistantMessage = {
      role: 'assistant' as const,
      content: ''
    }
    chatMessages.value.push(assistantMessage)
    
    // 滚动到底部显示新消息
    await nextTick()
    scrollToBottom()
    
    aiTyping.value = false // 停止输入动画，开始显示文字
    
    let rawContent = ''
    let chunkCount = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      chunkCount++
      console.log(`[PPT弹框] 接收chunk #${chunkCount}, 长度:`, chunk.length, '内容:', chunk.substring(0, 50))
      
      rawContent += chunk
      
      // 实时格式化内容并更新（确保触发响应式更新）
      const formattedContent = formatSummaryContent(rawContent)
      chatMessages.value[chatMessages.value.length - 1].content = formattedContent
      
      // 流式输出时也滚动到底部
      await nextTick()
      scrollToBottom()
    }
    
    console.log('[PPT弹框] 总结生成完成，总长度:', rawContent.length)
    console.log('[PPT弹框] 最终内容:', rawContent.substring(0, 200))
    ElMessage.success('总结完成')
    
    // 最终滚动到底部
    await nextTick()
    scrollToBottom()
  } catch (error: any) {
    console.error('[PPT弹框] 生成总结失败:', error)
    ElMessage.error('生成总结失败：' + (error.message || '未知错误'))
    
    // 移除失败的消息
    if (chatMessages.value[chatMessages.value.length - 1]?.role === 'assistant' && 
        !chatMessages.value[chatMessages.value.length - 1]?.content) {
      chatMessages.value.pop()
    }
  } finally {
    summaryLoading.value = false
    aiTyping.value = false
  }
}

/**
 * 格式化总结内容为HTML
 */
const formatSummaryContent = (text: string): string => {
  if (!text) return ''
  
  let html = text
    // emoji标题转为h4
    .replace(/^(📌|🎯|💡|👥|📊)\s+(.+)$/gm, '<h4>$1 $2</h4>')
    // bullet points转为li
    .replace(/^•\s+(.+)$/gm, '<li>$1</li>')
    // 换行转为br
    .replace(/\n/g, '<br>')
  
  return html
}

/**
 * 关闭总结区域 - 已废弃，总结现在是聊天消息的一部分
 */
const closeSummary = () => {
  // summaryVisible.value = false
  // summaryText.value = ''
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

/* ==================== AI助手面板样式 ==================== */

/* 整体布局：固定高度，内部分区 */
.ai-panel-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
}

/* 顶部标题区域（固定） */
.ai-panel-header {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
}

.ai-panel-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.ai-panel-close-btn {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-panel-close-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
  background: #eff6ff;
}

/* 功能按钮区域（固定） */
.ai-panel-actions {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}

.ai-panel-subtitle {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 12px;
}

.ai-feature-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-feature-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.ai-feature-item:hover {
  border-color: #2563eb;
  box-shadow: 0 4px 6px rgba(37, 99, 235, 0.1);
  transform: translateY(-1px);
}

.feature-text {
  font-size: 13px;
  color: #1f2937;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.feature-icon {
  font-size: 16px;
  color: #2563eb;
}

.feature-arrow {
  font-size: 16px;
  color: #9ca3af;
}

/* 中间内容区域（可滚动） */
.ai-panel-main {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #9ca3af;
}

.empty-state i {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

/* 聊天记录 */

.ai-chat-messages {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.chat-message {
  display: flex;
  gap: 10px;
  animation: messageSlideIn 0.3s ease;
}

.chat-message.user {
  flex-direction: row-reverse;
}

.chat-message.user .message-content {
  background: #2563eb;
  color: #fff;
}

.chat-message.user .message-avatar {
  background: #2563eb;
  color: #fff;
}

.chat-message.assistant .message-content {
  background: #ffffff;
  color: #1f2937;
  border: 1px solid #d1d5db;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.chat-message.assistant .message-avatar {
  background: #f3f4f6;
  color: #6b7280;
}

.message-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar i {
  font-size: 18px;
}

.message-content {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.5;
  word-wrap: break-word;
}

.message-text {
  white-space: pre-wrap;
  word-break: break-word;
}

/* 消息中的HTML格式 */
.message-text :deep(h4) {
  font-size: 13px;
  font-weight: 600;
  margin: 10px 0 6px;
  color: inherit;
}

.message-text :deep(h4:first-child) {
  margin-top: 0;
}

.message-text :deep(li) {
  margin-left: 16px;
  margin-bottom: 4px;
  list-style: none;
  position: relative;
}

.message-text :deep(li::before) {
  content: '•';
  position: absolute;
  left: -12px;
  opacity: 0.7;
}

/* 用户消息中的HTML格式（白色文字） */
.chat-message.user .message-text :deep(h4) {
  color: #fff;
}

.chat-message.user .message-text :deep(li::before) {
  color: #fff;
}

/* AI消息中的HTML格式（深色文字） */
.chat-message.assistant .message-text :deep(h4) {
  color: #1f2937;
}

.chat-message.assistant .message-text :deep(li::before) {
  color: #6b7280;
}

/* AI输入动画 */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #9ca3af;
  border-radius: 50%;
  animation: typingDot 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

/* 底部输入框（固定） */
.ai-panel-footer {
  flex-shrink: 0;
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}

.ai-input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  transition: border-color 0.2s;
}

.ai-input:focus {
  outline: none;
  border-color: #2563eb;
}

.ai-input-actions {
  display: flex;
  justify-content: flex-end;
}

.ai-send-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 20px;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-send-btn:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(37, 99, 235, 0.3);
}

.ai-send-btn:active:not(:disabled) {
  transform: translateY(0);
}

.ai-send-btn:disabled {
  background: #9ca3af;
  cursor: not-allowed;
  transform: none;
}

.ai-send-btn i {
  font-size: 16px;
}

/* 动画 */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes typingDot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}
</style>

