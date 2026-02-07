<template>
  <el-dialog 
    :model-value="visible" 
    @update:model-value="handleClose"
    :show-close="true" 
    fullscreen 
    class="video-dialog" 
  >
    <template #header>
      <div class="video-header">
        <div class="video-title-row">
          <el-tag size="small" type="primary" effect="plain" class="v-title-tag">交流会议</el-tag>
          <span class="v-title">{{ videoDetail.project }}</span>
          <div class="v-meta">
            <span><i class="ri-user-2-line"></i> {{ videoDetail.host }}</span>
            <el-divider direction="vertical" />
            <span><i class="ri-time-line"></i> {{ videoDetail.time }}</span>
            <el-divider direction="vertical" />
            <span><i class="ri-fire-line"></i> 100</span>
          </div>
          <div class="v-actions">
            <el-button size="small">
              <i class="ri-heart-2-line"></i>
              收藏 {{ videoDetail.favoriteCount || 23 }}
            </el-button>
          </div>
        </div>
      </div>
    </template>
    <div class="video-layout assistant-split-pane-container">
      <div class="video-main-col" :style="{ width: leftWidth }">
        <div class="video-player-placeholder">
          <div class="play-btn"><el-icon size="64"><VideoPlay /></el-icon></div>
          <div class="video-controls">
            <div class="progress-bar"></div>
            <div class="ctrl-row">
              <el-icon><VideoPlay /></el-icon>
              <span>00:00 / 38:54</span>
            </div>
          </div>
        </div>
        
        <div class="video-segments">
          <!-- 交流基本信息 -->
          <div class="exchange-info-block">
            <h3 class="exchange-info-head">
              <div class="title-vertical-line"></div>
              {{ videoDetail.customerName || '阜新银行' }}
            </h3>
            <div class="exchange-info-row">
              <span class="exchange-info-label">客户类型：</span>
              <span class="exchange-info-value">{{ videoDetail.customerType || '老客户新产品' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">交流时间：</span>
              <span class="exchange-info-value">{{ videoDetail.exchangeTime || '2025 年 5 月 15 日' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">交流次数：</span>
              <span class="exchange-info-value">{{ videoDetail.exchangeCount || '首次' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">产品解决方案：</span>
              <span class="exchange-info-value">{{ videoDetail.productSolution || '一表通' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">交流人员：</span>
              <span class="exchange-info-value">{{ videoDetail.exchangePersonnel || '我方（刘佳、杨毅等）；客户方（业务、科技等部门相关人员）' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">交流主题：</span>
              <span class="exchange-info-value">{{ videoDetail.exchangeTheme || '阜新银行一表通建设方案介绍与需求对接' }}</span>
            </div>
            <div class="exchange-info-row">
              <span class="exchange-info-label">交流目标：</span>
              <span class="exchange-info-value">{{ videoDetail.exchangeGoal || '向客户解读一表通监管政策与建设要求，展示我方产品方案与案例优势，挖掘客户核心需求，推进项目合作意向' }}</span>
            </div>
          </div>
          
          <!-- 客户参会人（已隐藏） -->
          <!-- <div class="exchange-participants-block">
            <h4 class="exchange-participants-head">
              <div class="title-vertical-line"></div>
              客户参会人
            </h4>
            <div v-for="(p, i) in videoDetail.customerParticipants" :key="i" class="exchange-participant-item">
              <div class="exchange-participant-name">
                {{ p.name }} / {{ p.role }}
                <span class="exchange-participant-tags">
                  <el-tag size="small" effect="plain">前{{ p.stat1 }}</el-tag>
                  <el-tag size="small" effect="plain">项{{ p.stat2 }}</el-tag>
                  <el-tag size="small" effect="plain" v-if="p.stat3">后{{ p.stat3 }}</el-tag>
                </span>
              </div>
            </div>
          </div> -->
          
          <!-- 已观看 -->
          <div class="readers-section">
            <h4 class="readers-section-head">
              <div class="title-vertical-line"></div>
              已观看
              <span class="readers-count-badge">{{ readersList.length }}</span>
            </h4>
            <div class="readers-display">
              <span 
                v-for="(reader, index) in readersList" 
                :key="index"
                class="reader-item-inline"
              >
                {{ reader.userName }}({{ reader.duration || '0' }}分钟)<span v-if="index < readersList.length - 1">、</span>
              </span>
              <span v-if="readersList.length === 0" class="readers-empty">暂无阅读记录</span>
            </div>
          </div>
          
          <!-- 评论功能 -->
          <div class="exchange-comments-block">
            <div class="comments-section">
              <h4 class="comments-section-head">
                <div class="title-vertical-line"></div>
                评论 
                <span class="comments-count-badge">{{ comments.length }}</span>
              </h4>
              <div class="comment-input-wrapper">
                <div class="comment-input-container">
                  <textarea
                    ref="commentTextareaRef"
                    v-model="newComment"
                    class="comment-textarea"
                    placeholder="有何见解或问题? 在这里交流..."
                    rows="2"
                    @input="adjustTextareaHeight"
                  ></textarea>
                  <div class="comment-input-actions">
                    <button 
                      v-if="newComment.trim()"
                      class="comment-clear-btn"
                      @click="newComment = ''"
                      type="button"
                    >
                      <i class="ri-close-line"></i>
                    </button>
                    <button 
                      class="comment-submit-btn"
                      @click="submitComment"
                      :disabled="!newComment.trim()"
                      type="button"
                    >
                      <i class="ri-send-plane-fill"></i>
                      发表评论
                    </button>
                  </div>
                </div>
              </div>
              <div class="comments-list">
                <div 
                  v-for="(comment, index) in comments" 
                  :key="index"
                  class="comment-item"
                >
                  <div class="comment-user">
                    {{ comment.userName }}
                    <span class="comment-time">{{ formatCommentTime(comment.time) }}</span>
                  </div>
                  <div class="comment-content">{{ comment.content }}</div>
                </div>
                <div v-if="comments.length === 0" class="comment-empty">暂无评论</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div 
        class="split-pane-divider" 
        @mousedown="startResize"
      >
        <i class="ri-arrow-left-right-fill divider-icon"></i>
      </div>
      <VideoSidePanel 
        :video-detail="videoDetail"
        :width="rightWidth"
        :active-tab="activeTab"
        @update:active-tab="activeTab = $event"
      />
    </div>
  </el-dialog>
</template>

<script setup>
import { ref, defineProps, defineEmits, nextTick, onMounted, watch } from 'vue'
import { VideoPlay, Star } from '@element-plus/icons-vue'
import VideoSidePanel from './VideoSidePanel.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  videoDetail: {
    type: Object,
    default: () => ({
      customer: '',
      customerName: '',
      customerType: '',
      project: '',
      time: '',
      host: '',
      participants: '',
      desc: '',
      exchangeTime: '',
      exchangeCount: '',
      exchangePersonnel: '',
      exchangeTheme: '',
      exchangeGoal: '',
      customerParticipants: [],
      files: [],
      relatedVideos: [],
      qa: [],
      needs: [],
      segments: [
        {
          time: '00:00',
          title: '业务需求讨论与技术实现问题',
          subtitle: '开场介绍与需求对接'
        },
        {
          time: '10:59',
          title: '网络不稳定与电脑故障的困扰',
          subtitle: '技术问题讨论'
        },
        {
          time: '20:27',
          title: '售前资料库动态化库的构建与优化',
          subtitle: '资料管理方案'
        },
        {
          time: '24:31',
          title: '客户访谈与需求调研的方法论',
          subtitle: '调研方法分享'
        },
        {
          time: '29:34',
          title: '优化交流材料管理与复用',
          subtitle: '材料管理策略'
        },
        {
          time: '33:41',
          title: '提升售前交流效率与准备策略',
          subtitle: '效率提升方案'
        },
        {
          time: '38:26',
          title: '优化售前交流与资料管理',
          subtitle: '综合优化方案'
        },
        {
          time: '43:41',
          title: '招投标与产品功能优势的优化策略',
          subtitle: '招投标准备'
        },
        {
          time: '49:25',
          title: '提升公司业务材料质量与客户满意度',
          subtitle: '质量提升方案'
        }
      ]
    })
  }
})

const emit = defineEmits(['update:visible', 'close'])


// Tab切换
const activeTab = ref('record')

// 视频片段相关
const activeSegmentIndex = ref(0)
const activeQuestionIndex = ref(0)
const questionItemRefs = ref([])
const answerExpanded = ref({})
const likedQuestions = ref([])

// 评论输入框引用
const commentTextareaRef = ref(null)

// 评论相关
const comments = ref([
  { userName: '张三', content: '这个会议很有价值，学到了很多！', time: new Date(Date.now() - 5 * 60 * 1000).toISOString() }, // 5分钟前
  { userName: '李四', content: '客户的需求很明确，我们的方案应该能满足。', time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() } // 2小时前
])

const newComment = ref('')

// 阅读记录
const readersList = ref([
  { userName: '荆红戈', duration: 5 },
  { userName: '陈美静', duration: 0 },
  { userName: '丁建华', duration: 7 }
])

// 调整输入框高度
const adjustTextareaHeight = () => {
  if (commentTextareaRef.value) {
    commentTextareaRef.value.style.height = 'auto'
    const scrollHeight = commentTextareaRef.value.scrollHeight
    // 最小高度为2行，最大高度为200px
    const minHeight = 70 // 约2行的高度
    const maxHeight = 200
    commentTextareaRef.value.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`
  }
}

// 格式化评论时间（相对时间）
const formatCommentTime = (timeStr) => {
  if (!timeStr) return ''
  
  try {
    // 解析时间字符串，支持多种格式
    let date
    if (typeof timeStr === 'string') {
      // 尝试解析 "2025/10/20 14:30" 格式
      if (timeStr.includes('/')) {
        date = new Date(timeStr.replace(/\//g, '-'))
      } else {
        date = new Date(timeStr)
      }
    } else {
      date = new Date(timeStr)
    }
    
    if (isNaN(date.getTime())) {
      return timeStr // 如果解析失败，返回原字符串
    }
    
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diff / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    // 刚刚（1分钟内）
    if (diffSeconds < 60) {
      return '刚刚'
    }
    
    // 几分钟前
    if (diffMinutes < 60) {
      return `${diffMinutes}分钟前`
    }
    
    // 几小时前
    if (diffHours < 24) {
      return `${diffHours}小时前`
    }
    
    // 超过1天显示日期
    if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else {
      // 超过7天显示具体日期
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}/${month}/${day}`
    }
  } catch (error) {
    return timeStr // 解析失败时返回原字符串
  }
}

// 提交评论
const submitComment = () => {
  if (!newComment.value.trim()) return
  
  const now = new Date()
  const timeStr = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  comments.value.unshift({
    userName: '当前用户',
    content: newComment.value.trim(),
    time: timeStr
  })
  
  newComment.value = ''
  // 重置输入框高度
  nextTick(() => {
    if (commentTextareaRef.value) {
      commentTextareaRef.value.style.height = '70px'
    }
  })
}

// 监听 newComment 变化，自动调整高度
watch(newComment, () => {
  adjustTextareaHeight()
})

// 组件挂载时初始化高度
onMounted(() => {
  nextTick(() => {
    if (commentTextareaRef.value) {
      commentTextareaRef.value.style.height = '70px'
    }
  })
})

const shouldShowExpand = (text) => {
  if (!text) return false
  // 如果文本超过一定长度，显示展开按钮
  return text.length > 60
}

const toggleAnswer = (key) => {
  answerExpanded.value[key] = !answerExpanded.value[key]
}

const toggleLike = (index) => {
  const likedIndex = likedQuestions.value.indexOf(index)
  if (likedIndex > -1) {
    likedQuestions.value.splice(likedIndex, 1)
  } else {
    likedQuestions.value.push(index)
  }
}

const selectSegment = (index) => {
  activeSegmentIndex.value = index
  
  activeQuestionIndex.value = index
  // 滚动到对应的问题项
  nextTick(() => {
    const questionItem = questionItemRefs.value[index]
    if (questionItem) {
      questionItem.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  })
  
  // TODO: 跳转到对应视频时间点
}

const selectQuestion = (index) => {
  activeQuestionIndex.value = index
  activeSegmentIndex.value = index
}


const scrollThumbnails = (direction) => {
  const scrollContainer = document.querySelector('.thumbnails-scroll')
  if (scrollContainer) {
    const scrollAmount = 200
    scrollContainer.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth'
    })
  }
}

// 分屏调整相关
const leftWidth = ref('calc(63% - 0.63px)')
const rightWidth = ref('calc(37% - 0.37px)')
const isResizing = ref(false)
const startX = ref(0)
const startLeftWidth = ref(0)
const startRightWidth = ref(0)

const startResize = (e) => {
  isResizing.value = true
  startX.value = e.clientX
  const container = e.target.closest('.assistant-split-pane-container')
  if (container) {
    const leftCol = container.querySelector('.video-main-col')
    const rightCol = container.querySelector('.video-side-col')
    if (leftCol && rightCol) {
      startLeftWidth.value = leftCol.offsetWidth
      startRightWidth.value = rightCol.offsetWidth
    }
  }
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

const handleResize = (e) => {
  if (!isResizing.value) return
  
  const container = document.querySelector('.assistant-split-pane-container')
  if (!container) return
  
  const containerWidth = container.offsetWidth
  const diff = e.clientX - startX.value
  const newLeftWidth = startLeftWidth.value + diff
  const newRightWidth = startRightWidth.value - diff
  
  // 限制最小宽度
  const minLeftWidth = 384
  const minRightWidth = 440
  
  if (newLeftWidth >= minLeftWidth && newRightWidth >= minRightWidth) {
    const leftPercent = (newLeftWidth / containerWidth) * 100
    const rightPercent = (newRightWidth / containerWidth) * 100
    leftWidth.value = `${leftPercent}%`
    rightWidth.value = `${rightPercent}%`
  }
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

const handleClose = (value) => {
  emit('update:visible', value)
  emit('close')
}
</script>

<style scoped lang="scss">
/* 视频片段区域样式 */
.video-segments {
  margin-bottom: 24px;
}

/* 交流基本信息 */
.exchange-info-block {
  background: #fff;
  margin-top: 16px;
  padding-bottom: 1.6rem;
  border-bottom: 1px solid #e5e7eb;
}

.exchange-info-head {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.exchange-info-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 5px;
  font-size: 0.85rem;
  line-height: 2;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.exchange-info-label {
  color: #64748b;
  min-width: 100px;
  flex-shrink: 0;
}

.exchange-info-value {
  color: #1f2937;
  flex: 1;
}

/* 客户参会人 */
.exchange-participants-block {
  background: #fff;
  margin-top: 1.6rem;
  padding-bottom: 1.6rem;
  border-bottom: 1px solid #e5e7eb;
}

.exchange-participants-head {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.exchange-participant-item {
  margin-bottom: 12px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.exchange-participant-name {
  font-size: 0.85rem;
  color: #1f2937;
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.exchange-participant-tags {
  display: inline-flex;
  gap: 8px;
  flex-wrap: wrap;
  
  :deep(.el-tag) {
    color: #333 !important;
    border: none !important;
    border-color: transparent !important;
  }
  
  /* 第一个标签（"前"）：浅红色背景 */
  :deep(.el-tag:nth-child(1)) {
    background-color: #FEE2E2 !important;
  }
  
  /* 第二个标签（"项"）：浅蓝色背景 */
  :deep(.el-tag:nth-child(2)) {
    background-color: #D9E9FF !important;
  }
  
  /* 第三个标签（"后"）：浅绿色背景 */
  :deep(.el-tag:nth-child(3)) {
    background-color: #DCFCE7 !important;
  }
}

/* 评论和阅读记录模块 */
.exchange-comments-block {
  background: #fff;
  border-radius: 8px;
  margin-top: 20px;
}

.comments-section {
  margin-bottom: 24px;
}

.comments-section-head {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 标题竖线 */
.title-vertical-line {
  width: 4px;
  height: 18px;
  background-color: #2563eb;
  flex-shrink: 0;
  border-radius: 2px;
}

.comments-count-badge {
  font-size: 10px;
  line-height: 1.6;
  background-color: #e5e7eb;
  color: #94a3b8;
  padding: 0px 5px;
  border-radius: 10px;
  font-weight: normal;
}

.comment-input-wrapper {
  margin-bottom: 16px;
}

.comment-input-container {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  position: relative;
}

.comment-textarea {
  width: 100%;
  min-height: 70px;
  max-height: 200px;
  border: none;
  outline: none;
  resize: none;
  overflow-y: auto;
  font-size: 0.9rem;
  color: #1f2937;
  line-height: 1.6;
  padding: 12px;
  margin-bottom: 50px;
  font-family: inherit;
  transition: height 0.2s ease;
  
  &::placeholder {
    color: #9ca3af;
  }
  
  &:focus {
    outline: none;
  }
}

.comment-input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  position: absolute;
  bottom: 10px;
  right: 10px;
}

.comment-clear-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: #9ca3af;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover {
    background: #f3f4f6;
    color: #6b7280;
  }
  
  i {
    font-size: 16px;
  }
}

.comment-submit-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: none;
  border-radius: 6px;
  background: #f1f5f9;
  color: #64748b;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: #e2e8f0;
    color: #475569;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  i {
    font-size: 14px;
  }
}

.comments-list {
  max-height: 200px;
}

.comment-item {
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  
  &:last-child {
    border-bottom: none;
  }
}

.comment-user {
  font-size: 0.85rem;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.comment-time {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: normal;
}

.comment-content {
  font-size: 0.85rem;
  color: #4b5563;
  line-height: 1.6;
}

.comment-empty {
  text-align: center;
  padding: 20px;
  color: #9ca3af;
  font-size: 0.85rem;
}

.readers-section {
  background: #fff;
  margin-top: 1.6rem;
  padding-bottom: 1.6rem;
  border-bottom: 1px solid #e5e7eb;
}

.readers-section-head {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.readers-count-badge {
  font-size: 10px;
  line-height: 1.6;
  background-color: #e5e7eb;
  color: #94a3b8;
  padding: 0px 5px;
  border-radius: 10px;
  font-weight: normal;
}

.readers-display {
  font-size: 0.85rem;
  color: #4b5563;
  line-height: 1.6;
}

.reader-item-inline {
  color: #1f2937;
}

.readers-empty {
  color: #9ca3af;
  font-size: 0.85rem;
}


.reader-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  color: #4b5563;
}

.reader-icon {
  font-size: 16px;
  color: #9ca3af;
}

.reader-name {
  flex: 1;
  color: #1f2937;
}

.reader-time-small {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* 视频缩略图条 */
.video-thumbnails-strip {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  position: relative;
}

.thumbnails-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;
  scrollbar-width: none;
  -ms-overflow-style: none;
  
  &::-webkit-scrollbar {
    display: none;
  }
}

.thumbnail-item {
  flex-shrink: 0;
  cursor: pointer;
  transition: all 0.3s;
  
  &.active {
    .thumbnail-img {
      border: 2px solid #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
    }
  }
  
  &:hover {
    transform: translateY(-2px);
  }
}

.thumbnail-img {
  width: 120px;
  height: 68px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid transparent;
  transition: all 0.3s;
  
  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.thumbnail-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  font-size: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.thumbnail-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24px;
  opacity: 0;
  transition: opacity 0.3s;
}

.thumbnail-item.active .thumbnail-overlay {
  opacity: 1;
}

.thumbnail-time {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-top: 4px;
}

.thumbnails-arrow {
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #e4e7ed;
  color: #666;
  
  &:hover {
    background: #f5f7fa;
    border-color: #2563eb;
    color: #2563eb;
  }
}

/* 客户问题列表样式 */
.question-list {
  margin-top: 20px;
}

.question-item {
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 10px;
  cursor: pointer;
  transition: all 0.2s;
  background: #fff;
  
  &:hover {
    border-color: #2563eb;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
  }
  
  &.active {
    border-color: #2563eb;
    background: #fbfcff;
  }
}

.question-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.question-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
  color: #2563eb;
  font-size: 18px;
}

.question-content {
  flex: 1;
}

.question-title {
  font-size: 15px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 5px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.question-time {
  font-size: 10px;
  color: #64748b;
  font-weight: normal;
  flex-shrink: 0;
}

.question-text {
  flex: 1;
}

.question-item.active .question-title {
  color: #2563eb;
  
  .question-text {
    color: #2563eb;
  }
  
  .question-time {
    color: #2563eb;
  }
}

.question-answer {
  margin-top: 0;
  padding-top: 5px;
  border-top: 1px solid #eef2f6;
}

.answer-text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 0;
}


/* 报告项样式（用于视频对话框的问题列表） */
.report-item {
  display: flex;
  gap: 16px;
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  padding: 10px;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  margin-bottom: 15px;
  
  &:hover {
    border-color: #2563eb;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
    
    .report-item-question {
      color: #2563eb;
      
      .report-item-question-text {
        color: #2563eb;
      }
      
      .report-item-time {
        color: #2563eb;
      }
    }
    
    .expert-approved-icon {
      background: #fffbeb;
    }
  }
  
  &.active {
    border-color: #2563eb;
    background: #fbfcff;
  }
}

.report-item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(239 246 255);
  border-radius: 8px;
  color: rgb(37 99 235);
  font-size: 18px;
  transition: background 0.3s;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  
  i {
    font-weight: normal;
    color: rgb(37 99 235);
  }
  
  &.expert-approved-icon {
    width: 2rem;
    height: 2rem;
    border-radius: 5px;
    background: rgba(255, 251, 235, 0.4);
    
    i {
      color: #d97706;
      font-weight: normal;
    }
  }
}

.report-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.report-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.report-item-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 0.75rem;
}

.report-company-name {
  color: #94a3b8;
  font-weight: 500;
}

.report-category-name {
  color: #2563eb;
  font-weight: 500;
}

.report-item-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

.report-item-likes {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
  
  i {
    font-size: 16px;
    color: #6b7280;
    transition: all 0.3s ease;
  }
  
  &:hover {
    opacity: 0.8;
  }
  
  &.liked {
    color: #f43f5e;
    
    i {
      color: #f43f5e;
      transform: scale(1.2);
      animation: heartBeat 0.6s ease;
    }
  }
}

.report-item-date {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

.report-item-question {
  font-size: 0.875rem;
  color: #1f2937;
  line-height: 1.6;
  font-weight: 500;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.report-item-time {
  font-size: 10px;
  color: #64748b;
  font-weight: normal;
  flex-shrink: 0;
}

.report-item-question-text {
  flex: 1;
}

.report-item-answer {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
  width: 80%;
  
  .answer-content-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .answer-content {
    font-size: 0.75rem;
    color: #94a3b8;
    line-height: 1.7;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: all 0.3s;
    
    &.answer-content-expanded {
      white-space: normal;
      overflow: visible;
      text-overflow: unset;
      align-self: flex-start;
    }
  }
  
  .answer-expand-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: #2563eb;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    align-self: flex-start;
    
    &:hover {
      color: #1d4ed8;
    }
    
    i {
      font-size: 14px;
    }
  }
}

.report-item-expert-answer {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
  margin-top: 8px;
  padding: 0.375rem 0.75rem;
  background-color: rgb(255 251 235 / 0.4);
  width: 80%;
  
  .expert-answer-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  
  .answer-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #d97706;
    flex-shrink: 0;
    white-space: nowrap;
  }
  
  .answer-content-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .answer-content {
    font-size: 0.75rem;
    color: #334155;
    line-height: 1.7;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: all 0.3s;
    
    &.answer-content-expanded {
      white-space: normal;
      overflow: visible;
      text-overflow: unset;
      align-self: flex-start;
    }
  }
  
  .expert-reviewer {
    margin-left: 8px;
    font-size: 10px;
    color: rgb(217 119 6 / 0.7);
    display: inline;
  }
  
  .answer-expand-btn {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: #2563eb;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    align-self: flex-start;
    
    &:hover {
      color: #1d4ed8;
    }
    
    i {
      font-size: 14px;
    }
  }
}

.expert-approved-tag {
  font-size: 10px;
  color: #d97706;
  background: #fffbeb;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
}

@keyframes heartBeat {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(1);
  }
  75% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}
</style>
