<template>
  <div class="report-item">
    <!-- 左侧图标 -->
    <div class="report-item-icon" :class="{ 'expert-approved-icon': report.expertAnswer?.approved }">
      <i 
        v-if="report.expertAnswer?.approved"
        class="ri-account-pin-circle-line"
      ></i>
      <i 
        v-else
        class="ri-bill-line"
      ></i>
    </div>
    
    <!-- 右侧内容 -->
    <div class="report-item-content">
      <!-- 问题标题行（包含问题、点赞、日期） -->
      <div class="report-item-question-row">
        <div class="report-item-question">
          <span v-html="highlightKeyword ? highlightKeyword(report.question || report.title) : (report.question || report.title)"></span>
          <span 
            v-if="report.expertAnswer?.approved"
            class="expert-approved-tag"
          >
            专家核准
          </span>
        </div>
        <div class="report-item-actions">
          <div 
            class="report-item-likes"
            :class="{ liked: props.likedReports.includes(report.id) }"
            @click.stop="handleLike"
          >
            <i :class="props.likedReports.includes(report.id) ? 'ri-heart-fill' : 'ri-heart-line'"></i>
            <span>{{ localLikeCount }}</span>
          </div>
          <div class="report-item-date">{{ formatDate(report.date) }}</div>
        </div>
      </div>
      
      <!-- 系统答案 -->
      <div class="report-item-answer">
        <div class="answer-content-wrapper">
          <div 
            class="answer-content"
            :class="{ 'answer-content-expanded': localAnswerExpanded[`system-${report.id}`] }"
            v-html="highlightKeyword ? highlightKeyword(report.systemAnswer || report.description) : (report.systemAnswer || report.description)"
          ></div>
          <button
            v-if="shouldShowExpand(report.systemAnswer || report.description)"
            class="answer-expand-btn"
            @click="toggleAnswer(`system-${report.id}`)"
          >
            {{ localAnswerExpanded[`system-${report.id}`] ? '收起' : '展开' }}
            <i :class="answerExpanded[`system-${report.id}`] ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
          </button>
        </div>
      </div>

      <!-- 专家答案（如果有） -->
      <div v-if="report.expertAnswer" class="report-item-expert-answer">
        <div class="expert-answer-row">
          <div class="answer-label">专家建议：</div>
          <div class="answer-content-wrapper">
            <div 
              class="answer-content"
              :class="{ 'answer-content-expanded': localAnswerExpanded[`expert-${report.id}`] }"
              v-html="highlightKeyword ? highlightKeyword(report.expertAnswer.content) : report.expertAnswer.content"
            ></div>
            <button 
              v-if="shouldShowExpand(report.expertAnswer.content)"
              class="answer-expand-btn"
              @click="toggleAnswer(`expert-${report.id}`)"
            >
              {{ localAnswerExpanded[`expert-${report.id}`] ? '收起' : '展开' }}
              <i :class="answerExpanded[`expert-${report.id}`] ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
            </button>
          </div>
        </div>
      </div>
      
      <!-- 底部信息 -->
      <div class="report-item-footer">
        <div class="report-item-tags">
          <span class="report-item-tag">
            <i class="ri-command-line report-item-tag-icon"></i>
            {{ report.productName || '一表通' }}
          </span>
          <span class="report-item-tag">
            <i class="ri-building-line report-item-tag-icon"></i>
            {{ report.company }}
          </span>
          <span class="report-item-tag">
            <i class="ri-folder-line report-item-tag-icon"></i>
            {{ report.category === '公司类' ? '资质与案例' : report.category }}
          </span>
          <span class="report-item-tag">
            <i class="ri-building-line report-item-tag-icon"></i>
            {{ report.tag }}
          </span>
          <span v-if="report.meetingName" class="report-item-tag">
            <i class="ri-slideshow-4-line report-item-tag-icon"></i>
            {{ report.meetingName }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'

interface Props {
  report: any
  highlightKeyword?: (text: string) => string
  likedReports?: number[]
  likeCount?: number
  answerExpanded?: Record<string, boolean>
}

const props = withDefaults(defineProps<Props>(), {
  highlightKeyword: undefined,
  likedReports: () => [],
  likeCount: 0,
  answerExpanded: () => ({})
})

const emit = defineEmits<{
  'toggle-like': [reportId: number]
  'toggle-answer': [key: string]
}>()

// 使用 props 中的 answerExpanded，通过 watch 同步
const localAnswerExpanded = computed(() => props.answerExpanded)
const localLikeCount = computed(() => props.likeCount || 0)

// 格式化日期
const formatDate = (date: string): string => {
  if (!date) return ''
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

// 判断是否应该显示展开按钮
const shouldShowExpand = (text: string): boolean => {
  if (!text) return false
  return text.length > 150
}

// 切换答案展开/折叠
const toggleAnswer = (key: string) => {
  emit('toggle-answer', key)
}

// 处理点赞
const handleLike = () => {
  emit('toggle-like', props.report.id)
}
</script>

<style scoped lang="scss">
// report-item 相关样式
.report-item {
  display: flex;
  gap: 16px;
  background: #fff;
  border: none;
  border-bottom: 1px solid #e6e8eb;
  padding: 10px 10px 20px;
  transition: all 0.2s;
  width: 100%;
  box-sizing: border-box;
  cursor: pointer;
  margin-bottom: 0;
  
  &:hover {
    border-bottom-color: #2563eb;
    box-shadow: none;
    
    .report-item-question {
      color: #2563eb;
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
  --tw-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
  box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  
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
  
  &:hover.expert-approved-icon {
    background: #fffbeb;
  }
}

.report-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.report-item-question-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 5px;
}

.report-item-question {
  font-size: 1rem;
  color: #1f2937;
  line-height: 1.6;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
  min-width: 0;
}

.expert-approved-tag {
  font-size: 10px;
  color: #fff;
  background: #ff6a00;
  padding: 2px 8px;
  border-radius: 10px;
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
    font-size: 0.85rem;
    color: #666;
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
    padding: 3px 0 0 0;
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
  background-color: #fcf7e9;
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
    align-items: center;
    gap: 8px;
  }
  
  .answer-content {
    font-size: 0.8rem;
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
    padding: 3px 0 0 0;
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

.report-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0;
  margin-top: 0;
}

.report-item-tags {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
  flex-wrap: wrap;
  padding: 0;
  margin-top: 0.625rem;
  font-weight: normal;
}

.report-item-tag {
  font-size: 0.75rem;
  color: #94a3b8;
  background: none;
  padding: 0;
  border-radius: 4px;
  font-weight: normal;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;

  .report-item-tag-icon {
    font-size: 0.75rem;
    color: #94a3b8;
    font-weight: normal;
  }
}

@keyframes heartBeat {
  0%, 100% {
    transform: scale(1);
  }
  25% {
    transform: scale(1.3);
  }
  50% {
    transform: scale(1.1);
  }
  75% {
    transform: scale(1.2);
  }
}
</style>
