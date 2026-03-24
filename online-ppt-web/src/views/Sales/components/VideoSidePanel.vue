<template>
  <div class="video-side-col" :style="{ width }">
    <el-tabs v-model="localActiveTab" class="video-side-tabs">
      <el-tab-pane name="record">
        <template #label>
          <span class="tab-label">
            <i class="ri-ai-generate-text"></i>
            <span>原文</span>
          </span>
        </template>
        <div class="side-block">
          <div class="transcript-content" v-if="transcriptList.length > 0">
            <div
              v-for="(item, index) in transcriptList"
              :key="index"
              :data-index="index"
              class="transcript-item"
              :class="{ 'transcript-item-active': activeTranscriptIndex === index }"
              @click="handleTranscriptClick(index)"
            >
              <div class="transcript-header">
                <span class="transcript-speaker" :class="getSpeakerClass(item.speaker)">{{ item.speaker }}</span>
                <span class="transcript-time">{{ item.time }}</span>
              </div>
              <div class="transcript-text">{{ item.content }}</div>
            </div>
          </div>
          <div v-else class="transcript-empty">
            <i class="ri-file-text-line"></i>
            <p>暂无原文内容</p>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane name="qa">
        <template #label>
          <span class="tab-label">
            <i class="ri-question-answer-line"></i>
            <span>Q&A</span>
          </span>
        </template>
        <div class="side-block qa-list-container">
          <div class="question-list" v-if="qaList.length > 0">
            <div
              v-for="(item, index) in qaList"
              :key="index"
              :id="`qa-item-${index}`"
              class="report-item"
              :class="{ 'qa-playing': activeQaIndex === index }"
            >
              <!-- 左侧图标 -->
              <div class="report-item-icon" :class="{ 'expert-approved-icon': item.expertApproved }">
                <i 
                  v-if="item.expertApproved"
                  class="ri-account-pin-circle-line"
                ></i>
                <i 
                  v-else
                  class="ri-bill-line"
                ></i>
              </div>
              
              <!-- 右侧内容 -->
              <div class="report-item-content">
                <!-- 标题区域 -->
                <div class="report-item-header">
                  <div class="report-item-title-row">
                    <span class="report-category-name">{{ item.category || '资质与案例' }}</span>
                    <span 
                      v-if="item.expertApproved"
                      class="expert-approved-tag"
                    >
                      专家核准
                    </span>
                  </div>
                  <div class="report-item-actions">
                    <div 
                      class="report-item-likes"
                      :class="{ liked: localLikedQuestions.includes(index) }"
                      @click.stop="handleToggleLike(index)"
                    >
                      <i :class="localLikedQuestions.includes(index) ? 'ri-heart-fill' : 'ri-heart-line'"></i>
                      <span>{{ item.likes ?? 57 }}</span>
                    </div>
                    <div class="report-item-date">{{ item.date || '03-12' }}</div>
                  </div>
                </div>

                <!-- 问题 -->
                <div class="report-item-question">
                  <span class="report-item-question-text">
                    <span v-if="item.questionRole" class="qa-role-label" :class="item.questionRole === '客户' ? 'qa-role-customer' : 'qa-role-our'">{{ item.questionRole }}</span>{{ item.q }}
                  </span>
                  <span
                    v-if="item.time"
                    class="report-item-time qa-time-clickable"
                    @click.stop="handleQATimeClick(item, index)"
                  >
                    {{ item.time }}
                  </span>
                </div>
                
                <!-- 系统答案 -->
                <div class="report-item-answer" v-if="item.answerText">
                  <div class="answer-content-wrapper">
                    <div
                      :data-key="`system-${index}`"
                      class="answer-content"
                      :class="{ 'answer-content-expanded': localAnswerExpanded[`system-${index}`] }"
                    >
                      <span v-if="item.answerRole" class="qa-role-label" :class="item.answerRole === '我方' ? 'qa-role-our' : 'qa-role-customer'">{{ item.answerRole }}</span>{{ item.answerText }}
                    </div>
                    <button
                      v-if="isTruncated[`system-${index}`] && !localAnswerExpanded[`system-${index}`]"
                      class="answer-expand-btn"
                      @click.stop="handleToggleAnswer(`system-${index}`)"
                    >
                      展开
                      <i class="ri-arrow-down-s-line"></i>
                    </button>
                    <button
                      v-if="localAnswerExpanded[`system-${index}`]"
                      class="answer-expand-btn"
                      @click.stop="handleToggleAnswer(`system-${index}`)"
                    >
                      收起
                      <i class="ri-arrow-up-s-line"></i>
                    </button>
                  </div>
                </div>

                <!-- 专家答案（如果有） -->
                <div v-if="item.expertAdvice" class="report-item-expert-answer">
                  <div class="expert-answer-row">
                    <div class="answer-label">专家建议：</div>
                    <div class="answer-content-wrapper">
                      <div
                        :data-key="`expert-${index}`"
                        class="answer-content"
                        :class="{ 'answer-content-expanded': localAnswerExpanded[`expert-${index}`] }"
                      >
                        {{ item.expertAdvice }}
                        <span class="expert-reviewer" v-if="item.expertReviewer">审核人：{{ item.expertReviewer }}</span>
                      </div>
                      <button
                        v-if="isTruncated[`expert-${index}`] && !localAnswerExpanded[`expert-${index}`]"
                        class="answer-expand-btn"
                        @click.stop="handleToggleAnswer(`expert-${index}`)"
                      >
                        展开
                        <i class="ri-arrow-down-s-line"></i>
                      </button>
                      <button
                        v-if="localAnswerExpanded[`expert-${index}`]"
                        class="answer-expand-btn"
                        @click.stop="handleToggleAnswer(`expert-${index}`)"
                      >
                        收起
                        <i class="ri-arrow-up-s-line"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="qa-empty">
            <i class="ri-question-line"></i>
            <p>暂无问答内容</p>
          </div>
        </div>
      </el-tab-pane>
      
      <el-tab-pane name="analysis">
        <template #label>
          <span class="tab-label">
            <i class="ri-ai-generate-2"></i>
            <span>分析</span>
          </span>
        </template>
        <VideoAnalysisReport :video-detail="videoDetail" />
      </el-tab-pane>
      
      <el-tab-pane name="info">
        <template #label>
          <span class="tab-label">
            <i class="ri-file-list-3-line"></i>
            <span>材料</span>
          </span>
        </template>
        <div class="side-block">
          <h4 class="sub-head">交流文件</h4>
          <div v-for="f in videoDetail.files" :key="f.id" class="file-item">
            <i class="ri-file-pdf-line file-icon"></i>
            <div class="file-info">
              <div class="f-name">{{ f.name }}</div>
              <div class="f-meta">
                <div class="f-meta-line">{{ f.creator || '郑相宜' }} {{ f.date || '25/09/01' }}</div>
                <div class="f-meta-stats">
                  <span class="stat-item">
                    <i class="ri-fire-line"></i>
                    <span>{{ f.view || 23 }}</span>
                  </span>
                  <span class="stat-item">
                    <i class="ri-download-line"></i>
                    <span>{{ f.down || 12 }}</span>
                  </span>
                  <span class="stat-item">
                    <i class="ri-heart-2-line"></i>
                    <span>{{ f.like || 1 }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="side-block">
          <h4 class="sub-head">相关交流会议</h4>
          <div v-for="rv in videoDetail.relatedVideos" :key="rv.id" class="rel-video-item">
            <div class="rv-thumb">
              <img :src="rv.img" />
              <span class="rv-dur">{{ rv.duration }}</span>
            </div>
            <div class="rv-info">
              <div class="rv-title">{{ rv.title }}</div>
              <div class="rv-meta">
                <div class="rv-meta-row">
                  <span class="rv-author">{{ rv.author }}</span>
                  <span class="rv-date">{{ rv.date }}</span>
                </div>
                <div class="rv-meta-row">
                  <span class="rv-stat-item">
                    <i class="ri-fire-line"></i>
                    <span>{{ rv.view }}</span>
                  </span>
                  <span class="rv-stat-item">
                    <i class="ri-heart-2-line"></i>
                    <span>{{ rv.like }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue'
import VideoAnalysisReport from './VideoAnalysisReport.vue'

const props = defineProps({
  videoDetail: {
    type: Object,
    required: true,
    default: () => ({})
  },
  width: {
    type: String,
    default: 'calc(37% - 0.37px)'
  },
  activeTab: {
    type: String,
    default: 'record'
  },
  currentTime: {
    type: Number,
    default: 0
  },
  activeQaIndex: {
    type: Number,
    default: -1
  }
})

const emit = defineEmits(['update:activeTab', 'seek-to', 'qa-time-click'])

// 格式化 speaker 显示名称
const formatSpeaker = (speaker, speakerRoles) => {
  if (!speaker) return ''

  // 获取映射的角色
  const role = speakerRoles[speaker]

  if (role === 'our_side') {
    return '我方'
  } else if (role === 'customer') {
    return '客户'
  }

  // 没有映射，保持原样
  return speaker
}

// 原文列表：归一化 transcript（兼容 content/text、空数组）
const transcriptList = computed(() => {
  const raw = props.videoDetail?.transcript
  if (!raw || !Array.isArray(raw)) return []

  // 获取 speaker_roles 映射
  const speakerRoles = props.videoDetail?.speakerRoles || {}

  return raw.map((x) => ({
    speaker: formatSpeaker(x.speaker || '', speakerRoles),
    time: x.time || '',
    content: x.content ?? x.text ?? ''
  }))
})

// 解析时间字符串为秒数 (支持 "MM:SS" 和 "MM:SS-MM:SS" 格式)
const parseTimeToSeconds = (timeStr) => {
  if (!timeStr) return { start: 0, end: 0 }

  // 处理 "MM:SS-MM:SS" 格式（支持任意位数的分钟）
  const rangeMatch = timeStr.match(/^(\d+):(\d{2})\s*-\s*(\d+):(\d{2})$/)
  if (rangeMatch) {
    const startMin = parseInt(rangeMatch[1], 10)
    const startSec = parseInt(rangeMatch[2], 10)
    const endMin = parseInt(rangeMatch[3], 10)
    const endSec = parseInt(rangeMatch[4], 10)
    return {
      start: startMin * 60 + startSec,
      end: endMin * 60 + endSec
    }
  }

  // 处理 "MM:SS" 格式（单个时间点，支持任意位数的分钟）
  const singleMatch = timeStr.match(/^(\d+):(\d{2})$/)
  if (singleMatch) {
    const min = parseInt(singleMatch[1], 10)
    const sec = parseInt(singleMatch[2], 10)
    const time = min * 60 + sec
    return { start: time, end: time }
  }

  return { start: 0, end: 0 }
}

// 计算每个条目的时间范围（秒）
const transcriptTimeRanges = computed(() => {
  return transcriptList.value.map((item, index) => {
    const { start, end } = parseTimeToSeconds(item.time)
    // 如果结束时间与开始时间相同，使用下一条的开始时间作为结束时间
    let effectiveEnd = end
    if (start === end && index < transcriptList.value.length - 1) {
      const nextStart = parseTimeToSeconds(transcriptList.value[index + 1].time).start
      if (nextStart > start) {
        effectiveEnd = nextStart
      }
    }
    // 如果是最后一条且没有结束时间，设置一个很大的值
    if (start === effectiveEnd && index === transcriptList.value.length - 1) {
      effectiveEnd = 999999
    }
    return { start, end: effectiveEnd }
  })
})

// 当前激活的原文条目索引
const activeTranscriptIndex = computed(() => {
  const current = props.currentTime
  if (current <= 0 || transcriptTimeRanges.value.length === 0) return -1

  // 找到当前时间所在的条目
  for (let i = 0; i < transcriptTimeRanges.value.length; i++) {
    const { start, end } = transcriptTimeRanges.value[i]
    if (current >= start && current < end) {
      return i
    }
  }

  // 如果没找到精确匹配，找最接近的前一个条目
  for (let i = transcriptTimeRanges.value.length - 1; i >= 0; i--) {
    if (current >= transcriptTimeRanges.value[i].start) {
      return i
    }
  }

  return -1
})

// 原文条目 refs
const transcriptItemRefs = ref([])

// 节流控制：避免频繁滚动
let lastScrollTime = 0
const SCROLL_THROTTLE_MS = 500

// 监听激活索引变化，自动滚动
watch(activeTranscriptIndex, (newIndex) => {
  if (newIndex < 0 || props.activeTab !== 'record') return

  const now = Date.now()
  if (now - lastScrollTime < SCROLL_THROTTLE_MS) return
  lastScrollTime = now

  nextTick(() => {
    const itemEl = document.querySelector(`.transcript-item[data-index="${newIndex}"]`)
    if (itemEl) {
      itemEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  })
})

// 点击原文条目跳转到对应时间
const handleTranscriptClick = (index) => {
  const range = transcriptTimeRanges.value[index]
  if (range) {
    emit('seek-to', range.start)
  }
}

// Q&A 列表：归一化 qa 项（兼容 q/question、summary/a/answer、与 new 一致的结构与样式）
const qaList = computed(() => {
  const raw = props.videoDetail?.qa
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((item) => ({
    ...item,
    q: item.q ?? item.question ?? '',
    answerText: item.summary ?? item.a ?? item.answer ?? '',
    company: item.company ?? props.videoDetail?.customerName ?? props.videoDetail?.customer,
    category: item.category ?? '资质与案例',
    expertApproved: !!item.expertApproved,
    likes: item.likes,
    date: item.date,
    time: item.time,
    expertAdvice: item.expertAdvice,
    expertReviewer: item.expertReviewer
  }))
})

// 本地状态，用于双向绑定
const localActiveTab = ref(props.activeTab)

// 监听本地状态变化，同步到父组件
watch(localActiveTab, (newVal) => {
  emit('update:activeTab', newVal)
})

// 监听父组件传入的 activeTab 变化
watch(() => props.activeTab, (newVal) => {
  localActiveTab.value = newVal
}, { immediate: true })

// Q&A 相关状态
const localAnswerExpanded = ref({})
const localLikedQuestions = ref([])

// 截断状态
const isTruncated = ref({})

// 检测所有答案是否被截断
const checkAllTruncation = () => {
  nextTick(() => {
    setTimeout(() => {
      // 获取所有 answer-content 元素
      const elements = document.querySelectorAll('.qa-list-container .answer-content:not(.answer-content-expanded)')
      elements.forEach((el, idx) => {
        const key = el.getAttribute('data-key')
        if (key) {
          isTruncated.value[key] = el.scrollHeight > el.clientHeight
        }
      })
    }, 100)
  })
}

// 监听 qaList 变化重新检测
watch(() => props.videoDetail?.qa, () => {
  isTruncated.value = {}
  checkAllTruncation()
}, { deep: true })

// 监听 tab 切换，切到 qa 时检测
watch(() => props.activeTab, (newTab) => {
  if (newTab === 'qa') {
    checkAllTruncation()
  }
})

// 组件挂载后检测
onMounted(() => {
  checkAllTruncation()
})

// 切换答案展开/折叠
const handleToggleAnswer = (key) => {
  localAnswerExpanded.value[key] = !localAnswerExpanded.value[key]
}

// 切换点赞
const handleToggleLike = (index) => {
  const idx = localLikedQuestions.value.indexOf(index)
  if (idx > -1) {
    localLikedQuestions.value.splice(idx, 1)
  } else {
    localLikedQuestions.value.push(index)
  }
}

// 处理 Q&A 时间点击
const handleQATimeClick = (qaItem, index) => {
  emit('qa-time-click', qaItem, index)
}

// 获取说话人的样式类
const getSpeakerClass = (speaker) => {
  if (speaker === '我方') return 'speaker-our'
  if (speaker === '客户') return 'speaker-customer'
  // 未分类的 speaker（如 SPEAKER_1, SPEAKER_2 等）使用默认样式
  if (speaker && speaker.startsWith('SPEAKER_')) return 'speaker-default'
  return ''
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
.video-side-tabs ::v-deep .el-tabs__content {
  overflow: auto;
}

/* 视频对话框：标签页导航区域高度 */
.video-side-tabs ::v-deep(.el-tabs__nav-scroll) {
  height: 50px;
  min-height: 50px;
  border-bottom: none !important;
}

/* 视频对话框：去掉标签导航的所有边框线 */
.video-side-tabs ::v-deep(.el-tabs__nav) {
  border-bottom: none !important;
}

.video-side-tabs ::v-deep(.el-tabs__header) {
  border-bottom: none !important;
}

.video-side-tabs ::v-deep(.el-tabs__nav-wrap) {
  border-bottom: none !important;
}

.video-side-tabs ::v-deep(.el-tabs__nav-wrap::after) {
  display: none !important;
}

/* 视频对话框：标签项高度和padding */
.video-side-tabs ::v-deep(.el-tabs__item) {
  height: 50px;
  line-height: 50px;
  padding: 0 25px 0 0 !important;
}

/* 视频对话框：标签页活动指示条样式 */
.video-side-tabs ::v-deep(.el-tabs__active-bar) {
  height: 5px !important;
  border-top-left-radius: 9999px;
  border-top-right-radius: 9999px;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  background-color: rgb(37 99 235 / 1);
  box-shadow: 0 -2px 8px rgba(37, 99, 235, 0.4);
}

/* 视频对话框：参与者标签样式（覆盖 Element UI 默认样式） */
.p-tags ::v-deep(.el-tag) {
  color: #333 !important;
  border: none !important;
  border-color: transparent !important;
}

/* 第一个标签（"前"）：浅红色背景 */
.p-tags ::v-deep(.el-tag:nth-child(1)) {
  background-color: #FEE2E2 !important;
}

/* 第二个标签（"项"）：浅蓝色背景 */
.p-tags ::v-deep(.el-tag:nth-child(2)) {
  background-color: #D9E9FF !important;
}

/* 第三个标签（"后"）：浅绿色背景 */
.p-tags ::v-deep(.el-tag:nth-child(3)) {
  background-color: #DCFCE7 !important;
}

/* 视频对话框：参与者名称不加粗 */
.participant-item .p-name {
  font-weight: normal !important;
}

/* 视频对话框：信息标签字体大小 */
.side-info-row .label {
  font-size: 0.85rem !important;
}

/* 视频对话框：文件名称字体大小 */
.file-item .f-name {
  font-size: 0.85rem !important;
}

/* Q&A 角色标签 */
.qa-role-label {
  display: inline-block;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 5px;
  vertical-align: middle;
  flex-shrink: 0;
  white-space: nowrap;
}

.qa-role-customer {
  color: #c2410c;
  background: #ffedd5;
}

.qa-role-our {
  color: #1d4ed8;
  background: #dbeafe;
}

/* Q&A 时间标签可点击样式 */
.qa-time-clickable {
  cursor: pointer;
  transition: all 0.2s;
}

.qa-time-clickable:hover {
  color: #2563eb;
  text-decoration: underline;
}

/* Q&A 播放中高亮样式 */
.report-item.qa-playing {
  background: #eff6ff;
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

/* 视频对话框：相关视频标题字体大小 */
.rel-video-item .rv-title {
  font-size: 0.9rem !important;
  color: #334155 !important;
}

/* 视频对话框：相关视频元数据样式 */
.rel-video-item .rv-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.rel-video-item .rv-meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.rel-video-item .rv-author {
  color: #666;
}

.rel-video-item .rv-date {
  color: #999;
}

.rel-video-item .rv-stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #999;
}

.rel-video-item .rv-stat-item i {
  font-size: 14px;
  color: #999;
}

/* Q&A 标签页样式 */
.qa-list-container {
  padding: 0;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  
  /* Q&A 标签页下的答案宽度设置为 100% */
  .report-item-answer {
    width: 100% !important;
  }
  
  .report-item-expert-answer {
    width: 100% !important;
  }
}

.question-list {
  display: flex;
  flex-direction: column;
  gap: 0;
}

.report-item {
  display: flex;
  gap: 16px;
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  padding: 10px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.3s;
  
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
}

.report-item-icon {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(239 246 255 / var(--tw-bg-opacity, 1));
  border-radius: 8px;
  color: rgb(37 99 235 / var(--tw-text-opacity, 1));
  font-size: 18px;
  transition: background 0.3s;
  
  i {
    font-weight: normal;
    color: rgb(37 99 235 / var(--tw-text-opacity, 1));
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
  font-size: 10px;
}

.report-category-name {
  color: #3b82f6;
  font-weight: 500;
  font-size: 10px;
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
    align-items: flex-start;
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
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    transition: all 0.3s;

    &.answer-content-expanded {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
      text-overflow: unset;
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
  background-color: #f9f9f9;
  width: 80%;

  .expert-answer-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .answer-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #d97706;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .answer-content-wrapper {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .answer-content {
    font-size: 0.8rem;
    color: #666;
    line-height: 1.7;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    transition: all 0.3s;

    &.answer-content-expanded {
      display: block;
      -webkit-line-clamp: unset;
      overflow: visible;
      text-overflow: unset;
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

/* 原文 tab 空状态 */
.transcript-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;

  i {
    font-size: 48px;
    color: #d1d5db;
    margin-bottom: 12px;
    display: block;
  }

  p {
    font-size: 0.9rem;
    margin: 0;
  }
}

/* 原文内容区域 */
.transcript-content {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

/* 原文条目样式 */
.transcript-item {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.3s ease;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f8fafc;
  }

  &.transcript-item-active {
    background: #eff6ff;
    border-left: 3px solid #3b82f6;

    .transcript-speaker {
      font-weight: 600;
    }

    .speaker-our {
      background: #bfdbfe;
    }

    .speaker-customer {
      background: #fed7aa;
    }

    .speaker-default {
      background: #e5e7eb;
    }

    .transcript-time {
      color: #3b82f6;
      background: #dbeafe;
    }

    .transcript-text {
      color: #1e40af;
    }
  }
}

.transcript-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.transcript-speaker {
  font-size: 0.75rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  transition: all 0.3s;
}

.speaker-our {
  color: #1d4ed8;
  background: #dbeafe;
}

.speaker-customer {
  color: #c2410c;
  background: #ffedd5;
}

.speaker-default {
  color: #6b7280;
  background: #f3f4f6;
}

.transcript-time {
  font-size: 0.7rem;
  color: #6b7280;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.3s;
}

.transcript-text {
  font-size: 0.85rem;
  color: #4b5563;
  line-height: 1.6;
  transition: color 0.3s;
}

.qa-empty {
  text-align: center;
  padding: 40px 20px;
  color: #9ca3af;
  
  i {
    font-size: 48px;
    color: #d1d5db;
    margin-bottom: 12px;
    display: block;
  }
  
  p {
    font-size: 0.9rem;
    margin: 0;
  }
}

@keyframes heartBeat {
  0% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(1.1);
  }
  75% {
    transform: scale(1.25);
  }
  100% {
    transform: scale(1.2);
  }
}
</style>