<template>
  <div class="layout">
    <Header />
    
    <div class="main">
      <h2 class="page-title">#{{ pageTitle }}#</h2>
      
      <div class="search-result-layout">
        <!-- 左侧：问题列表 -->
        <div class="reports-list">
          <!-- 加载状态 -->
          <div v-if="loading" class="loading-state">
            <i class="ri-loader-4-line spinning"></i>
            <p>搜索中...</p>
          </div>

          <template v-else>
            <QuestionReportItem
              v-for="report in filteredReports"
              :key="report.id"
              :report="report"
              :highlight-keyword="highlightKeyword"
              :liked-reports="likedReports"
              :like-count="getLikeCount(report.id)"
              :answer-expanded="answerExpanded"
              @toggle-like="toggleLike"
              @toggle-answer="toggleAnswer"
            />

            <!-- 空状态 -->
            <div v-if="filteredReports.length === 0 && hasSearchCondition" class="empty-state">
              <i class="ri-search-line"></i>
              <p>未找到相关问题</p>
            </div>
          </template>
        </div>
      
      <!-- 右侧：历史搜索和热搜榜 -->
      <div class="right-sidebar">
        <!-- 历史搜索 -->
        <div class="search-history-panel">
          <div class="history-header">
            <h3 class="history-title">历史搜索</h3>
            <el-button 
              v-if="searchHistory.length > 0"
              type="text" 
              size="small" 
              @click="clearAllHistory"
              class="clear-all-btn"
            >
              <i class="ri-delete-bin-line"></i>
              全部清理
            </el-button>
          </div>
          
          <div v-if="searchHistory.length === 0" class="history-empty">
            <i class="ri-time-line"></i>
            <p>暂无搜索历史</p>
          </div>
          
          <div v-else class="history-list">
            <div 
              v-for="(item, index) in searchHistory" 
              :key="index"
              class="history-item"
              @click="searchFromHistory(item.keyword)"
            >
              <div class="history-keyword">{{ item.keyword }}</div>
              <div class="history-time">{{ formatHistoryTime(item.time) }}</div>
            </div>
          </div>
        </div>
        
        <!-- 热搜榜 -->
        <HotSearchPanel />
      </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getConcerns, likeConcern, type ConcernItem } from '@/services/concernsApi'
import Header from './components/Header.vue'
import HotSearchPanel from './components/HotSearchPanel.vue'
import QuestionReportItem from './components/QuestionReportItem.vue'

const route = useRoute()
const router = useRouter()

// 历史搜索存储 key
const SEARCH_HISTORY_KEY = 'question_search_history'
const MAX_HISTORY_COUNT = 20 // 最多保存20条历史记录

// 获取搜索参数
const keyword = computed(() => {
  return (route.query.q as string) || ''
})

const productCode = computed(() => {
  return (route.query.productCode as string) || ''
})

const productName = computed(() => {
  return (route.query.productName as string) || ''
})

// 页面标题（优先显示产品名称，其次是关键词）
const pageTitle = computed(() => {
  return productName.value || keyword.value || ''
})

// 是否有搜索条件
const hasSearchCondition = computed(() => {
  return !!keyword.value || !!productCode.value
})

// 历史搜索记录
interface SearchHistoryItem {
  keyword: string
  productCode?: string
  time: number
}

const searchHistory = ref<SearchHistoryItem[]>([])

// ====================== API 数据 ======================
const concerns = ref<ConcernItem[]>([])
const loading = ref(false)
const hasMore = ref(true)
const nextCursor = ref<string | null>(null)

// 已点赞的报告ID列表
const likedReports = ref<string[]>([])

// 每个报告的点赞数量
const reportLikeCounts = ref<Record<string, number>>({})

// 答案展开/折叠状态
const answerExpanded = ref<Record<string, boolean>>({})

// 加载搜索结果
const loadSearchResults = async (reset = false) => {
  if (!hasSearchCondition.value) {
    concerns.value = []
    return
  }

  if (loading.value) return
  if (!reset && !hasMore.value) return

  loading.value = true

  try {
    const params: any = {
      limit: 20,
      sortBy: 'latest'
    }

    // 使用 productCode 筛选（优先）
    if (productCode.value) {
      params.productCode = [productCode.value]
    }

    // 使用关键词搜索
    if (keyword.value) {
      params.keyword = keyword.value
    }

    if (!reset && nextCursor.value) {
      params.cursor = nextCursor.value
    }

    const res = await getConcerns(params)

    if (res.success && res.data) {
      if (reset) {
        concerns.value = res.data.list
      } else {
        concerns.value = [...concerns.value, ...res.data.list]
      }
      nextCursor.value = res.data.nextCursor
      hasMore.value = res.data.hasMore

      // 初始化点赞数
      res.data.list.forEach(item => {
        if (!(item.id in reportLikeCounts.value)) {
          reportLikeCounts.value[item.id] = item.likes
        }
      })
    }
  } catch (error) {
    console.error('搜索问题失败:', error)
  } finally {
    loading.value = false
  }
}

// 过滤后的报告列表（直接使用 API 返回的数据）
const filteredReports = computed(() => {
  return concerns.value
})

// 加载历史搜索记录
const loadSearchHistory = () => {
  try {
    const historyStr = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (historyStr) {
      searchHistory.value = JSON.parse(historyStr)
    }
  } catch (error) {
    console.error('加载搜索历史失败:', error)
    searchHistory.value = []
  }
}

// 保存搜索历史
const saveSearchHistory = (keyword: string) => {
  if (!keyword || !keyword.trim()) return
  
  const trimmedKeyword = keyword.trim()
  
  // 移除重复的关键词（如果已存在，先删除）
  searchHistory.value = searchHistory.value.filter(item => item.keyword !== trimmedKeyword)
  
  // 添加到最前面
  searchHistory.value.unshift({
    keyword: trimmedKeyword,
    time: Date.now()
  })
  
  // 限制数量
  if (searchHistory.value.length > MAX_HISTORY_COUNT) {
    searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_COUNT)
  }
  
  // 保存到 localStorage
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
  } catch (error) {
    console.error('保存搜索历史失败:', error)
  }
}

// 清除所有历史记录
const clearAllHistory = () => {
  searchHistory.value = []
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY)
  } catch (error) {
    console.error('清除搜索历史失败:', error)
  }
}

// 从历史记录搜索
const searchFromHistory = (keyword: string) => {
  router.push({ 
    path: '/sales/question-search', 
    query: { q: keyword } 
  })
}

// 格式化历史时间
const formatHistoryTime = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  
  if (minutes < 1) {
    return '刚刚'
  } else if (minutes < 60) {
    return `${minutes}分钟前`
  } else if (hours < 24) {
    return `${hours}小时前`
  } else if (days < 7) {
    return `${days}天前`
  } else {
    const date = new Date(timestamp)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${month}-${day}`
  }
}

// 热搜榜已移至 HotSearchPanel 组件

// 监听搜索条件变化，保存搜索历史并重新搜索
watch([keyword, productCode], ([newKeyword, newProductCode]) => {
  if (newKeyword && newKeyword.trim()) {
    saveSearchHistory(newKeyword)
  }
  if (newKeyword || newProductCode) {
    loadSearchResults(true)
  } else {
    concerns.value = []
  }
}, { immediate: true })

// 初始化
onMounted(() => {
  // 加载历史搜索记录
  loadSearchHistory()
})

// 高亮关键词（同时高亮搜索词和产品名称）
const highlightKeyword = (text: string): string => {
  if (!text) return ''

  let result = text

  // 高亮关键词
  if (keyword.value) {
    const regex = new RegExp(`(${escapeRegex(keyword.value)})`, 'gi')
    result = result.replace(regex, '<mark class="highlight-keyword">$1</mark>')
  }

  // 高亮产品名称
  if (productName.value && productName.value !== keyword.value) {
    const regex = new RegExp(`(${escapeRegex(productName.value)})`, 'gi')
    result = result.replace(regex, '<mark class="highlight-keyword">$1</mark>')
  }

  return result
}

// 转义正则表达式特殊字符// 转义正则表达式特殊字符
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 切换点赞
const toggleLike = async (reportId: string) => {
  const index = likedReports.value.indexOf(reportId)
  if (index > -1) {
    // 已点赞，取消（前端本地处理）
    likedReports.value.splice(index, 1)
    reportLikeCounts.value[reportId] = (reportLikeCounts.value[reportId] || 0) - 1
  } else {
    // 点赞
    try {
      const res = await likeConcern(reportId)
      if (res.success) {
        likedReports.value.push(reportId)
        reportLikeCounts.value[reportId] = res.data.likes
      }
    } catch (error) {
      console.error('点赞失败:', error)
    }
  }
}

// 获取点赞数量
const getLikeCount = (reportId: string): number => {
  return reportLikeCounts.value[reportId] || 0
}

// 切换答案展开/折叠
const toggleAnswer = (key: string) => {
  answerExpanded.value[key] = !answerExpanded.value[key]
}

// 判断是否应该显示展开按钮
const shouldShowExpand = (text: string): boolean => {
  if (!text) return false
  return text.length > 150
}

// 格式化日期
const formatDate = (date: string): string => {
  if (!date) return ''
  const d = new Date(date)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}-${day}`
}
</script>

<style scoped lang="scss">
.search-result-layout {
  display: flex;
  gap: 20px;
  margin-top: 20px;
}

.reports-list {
  flex: 1;
  min-width: 0;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* 右侧边栏容器 */
.right-sidebar {
  width: 300px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 历史搜索面板 */
.search-history-panel {
  width: 100%;
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  padding: 16px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e6e8eb;
}

.history-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.clear-all-btn {
  color: #9ca3af;
  font-size: 13px;
  padding: 4px 8px;
  
  &:hover {
    color: #f43f5e;
  }
  
  i {
    margin-right: 4px;
  }
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #9ca3af;
  
  i {
    font-size: 32px;
    margin-bottom: 12px;
    color: #d1d5db;
  }
  
  p {
    font-size: 14px;
    margin: 0;
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    .history-keyword {
      color: #2563eb;
    }
  }
}

.history-keyword {
  font-size: 12px;
  color: #1f2937;
  font-weight: normal;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
  transition: color 0.2s;
}

.history-time {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}

/* 热搜榜样式已移至 HotSearchPanel 组件 */

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;

  i {
    font-size: 48px;
    margin-bottom: 16px;
    color: #d1d5db;
  }

  p {
    font-size: 16px;
    margin: 0;
  }
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;

  i {
    font-size: 32px;
    margin-bottom: 16px;
    color: #2563eb;
  }

  p {
    font-size: 14px;
    margin: 0;
  }
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

// 高亮关键词样式
:deep(.highlight-keyword) {
  background-color: #fef3c7;
  color: #92400e;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 500;
}

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

.report-company-name {
  color: #94a3b8;
  font-weight: 500;
  font-size: 10px;
}

.report-category-name {
  color: #2563eb;
  font-weight: 500;
  font-size: 10px;
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