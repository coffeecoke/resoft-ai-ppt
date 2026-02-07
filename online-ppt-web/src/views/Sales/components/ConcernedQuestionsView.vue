<template>
  <div class="concerned-questions-layout">
    <!-- 左侧容器：目录 + 问题列表 -->
    <div class="left-content-wrapper">
      <!-- 左侧分类导航 -->
      <QuestionCategorySidebar
        v-if="showSidebar"
        :question-categories="questionCategories"
        :selected-filters="selectedFilters"
        @toggle-filter="toggleFilter"
      />

      <!-- 主内容区域 -->
      <main class="concerned-questions-main">
        <!-- 当前筛选（内部筛选，来自 QuestionCategorySidebar） -->
        <div v-if="showFilters && selectedFilters.length > 0" class="current-filters">
          <div class="filter-content">
            <span class="filter-title">当前筛选:</span>
            <div class="filter-tags">
              <span
                v-for="filterId in selectedFilters"
                :key="filterId"
                class="filter-tag"
              >
                <i class="ri-price-tag-3-line filter-tag-icon"></i>
                {{ getFilterName(filterId) }}
                <i class="ri-close-line filter-tag-close" @click="removeFilter(filterId)"></i>
              </span>
            </div>
          </div>
          <button class="clear-all-btn" @click="clearAllFilters">清空</button>
        </div>

        <!-- 当前筛选（外部筛选，来自 FilterPanel） -->
        <div v-if="showFilters && hasActiveExternalFilters" class="current-filters">
          <div class="filter-content">
            <span class="filter-title">当前筛选:</span>
            <div class="filter-tags">
              <span
                v-for="filter in allActiveExternalFilters"
                :key="`${filter.type}-${filter.id}`"
                class="filter-tag"
              >
                <i class="ri-price-tag-3-line filter-tag-icon"></i>
                {{ getFilterName(filter.id, filter.type) }}
              </span>
            </div>
          </div>
        </div>

        <!-- 问题列表 -->
        <div class="reports-list">
          <QuestionReportItem
            v-for="report in filteredReports"
            :key="report.id"
            :report="report"
            :liked-reports="likedReports"
            :like-count="getLikeCount(report.id)"
            :answer-expanded="answerExpanded"
            @toggle-like="toggleLike"
            @toggle-answer="toggleAnswer"
          />
        </div>
      </main>
    </div>
    
    <!-- 右侧：热搜榜 -->
    <aside class="hot-topics-sidebar">
      <HotSearchPanel />
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { getConcerns, getConcernCategories, likeConcern, type ConcernItem } from '@/services/concernsApi'
import QuestionCategorySidebar from './QuestionCategorySidebar.vue'
import HotSearchPanel from './HotSearchPanel.vue'
import QuestionReportItem from './QuestionReportItem.vue'

// 定义分类数据类型（匹配 QuestionCategorySidebar 组件需要的格式）
interface CategoryChild {
  id: string
  name: string
}

interface QuestionCategory {
  id: string
  name: string
  icon: string
  children: CategoryChild[]
}

interface ExternalFilters {
  questionCategory: string[]
  industry: string[]
  essenceType: string[]
  customerName: string
}

interface Props {
  showSidebar?: boolean
  showFilters?: boolean
  selectedSubFilter?: string | null
  selectedEssenceType?: string | null
  externalFilters?: ExternalFilters
}

const props = withDefaults(defineProps<Props>(), {
  showSidebar: true,
  showFilters: true,
  selectedSubFilter: null,
  selectedEssenceType: null,
  externalFilters: () => ({
    questionCategory: [],
    industry: [],
    essenceType: [],
    customerName: ''
  })
})

// 已选中的筛选条件
const selectedFilters = ref<string[]>([])

// 已点赞的报告ID列表
const likedReports = ref<string[]>([])

// 每个报告的点赞数量
const reportLikeCounts = ref<Record<string, number>>({})

// 答案展开/折叠状态：key 为 'system-{reportId}' 或 'expert-{reportId}'
const answerExpanded = ref<Record<string, boolean>>({})

// ====================== API 数据 ======================
const concerns = ref<ConcernItem[]>([])
const loading = ref(false)
const hasMore = ref(true)
const nextCursor = ref<string | null>(null)

// 问题分类结构（使用正确的类型）
const questionCategories = ref<QuestionCategory[]>([])

// 加载分类目录
const loadCategories = async () => {
  try {
    const res = await getConcernCategories()
    if (res.success && res.data) {
      // 转换为组件需要的格式
      questionCategories.value = res.data.map(cat => ({
        id: cat.code,
        name: cat.name,
        icon: getCategoryIcon(cat.code),
        children: (cat.children || []).map(child => ({
          id: child.code,
          name: child.name
        }))
      }))
    }
  } catch (error) {
    console.error('加载分类目录失败:', error)
    // 使用默认分类
    questionCategories.value = getDefaultCategories()
  }
}

// 根据分类代码获取图标
const getCategoryIcon = (code: string): string => {
  const iconMap: Record<string, string> = {
    '1': 'ri-building-line',
    '2': 'ri-box-3-line',
    '3': 'ri-briefcase-line',
    '4': 'ri-money-dollar-circle-line',
    '5': 'ri-projector-line',
    '6': 'ri-customer-service-line'
  }
  return iconMap[code] || 'ri-folder-line'
}

// 默认分类（备用）
const getDefaultCategories = (): QuestionCategory[] => [
  {
    id: '1', name: '公司类', icon: 'ri-building-line',
    children: [
      { id: '1.1', name: '资质与案例' },
      { id: '1.2', name: '公司规模与背景' },
      { id: '1.3', name: '合作模式' },
      { id: '1.4', name: '监管资源与协作' }
    ]
  },
  {
    id: '2', name: '产品类', icon: 'ri-box-3-line',
    children: [
      { id: '2.1', name: '性能与效率' },
      { id: '2.2', name: '产品架构' },
      { id: '2.3', name: '产品功能' },
      { id: '2.4', name: '兼容性与接口扩展' }
    ]
  }
]

// 加载问题列表
const loadConcerns = async (reset = false) => {
  if (loading.value) return
  if (!reset && !hasMore.value) return

  loading.value = true

  try {
    const params: any = {
      limit: 20,
      sortBy: 'latest'
    }

    if (!reset && nextCursor.value) {
      params.cursor = nextCursor.value
    }

    // 添加内部分类筛选（来自 QuestionCategorySidebar）
    if (selectedFilters.value.length > 0) {
      params.categoryCode = selectedFilters.value
    }

    // 添加外部筛选条件（来自 FilterPanel）
    if (props.externalFilters) {
      // 问题分类筛选
      if (props.externalFilters.questionCategory && props.externalFilters.questionCategory.length > 0) {
        params.categoryCode = [
          ...(params.categoryCode || []),
          ...props.externalFilters.questionCategory
        ]
      }
      // 行业筛选
      if (props.externalFilters.industry && props.externalFilters.industry.length > 0) {
        params.industry = props.externalFilters.industry
      }
      // 本质类型筛选
      if (props.externalFilters.essenceType && props.externalFilters.essenceType.length > 0) {
        params.intentCode = props.externalFilters.essenceType
      }
      // 客户名称筛选
      if (props.externalFilters.customerName) {
        params.keyword = props.externalFilters.customerName
      }
    }

    console.log('[ConcernedQuestionsView] 📤 加载问题列表，参数:', params)

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
    console.error('加载问题列表失败:', error)
  } finally {
    loading.value = false
  }
}

// 切换筛选条件
const toggleFilter = (filterId: string) => {
  const index = selectedFilters.value.indexOf(filterId)
  if (index > -1) {
    selectedFilters.value.splice(index, 1)
  } else {
    selectedFilters.value.push(filterId)
  }
}

// 移除筛选条件
const removeFilter = (filterId: string) => {
  const index = selectedFilters.value.indexOf(filterId)
  if (index > -1) {
    selectedFilters.value.splice(index, 1)
  }
}

// 清空所有筛选
const clearAllFilters = () => {
  selectedFilters.value = []
}

// 监听筛选变化，重新加载数据
watch(selectedFilters, () => {
  loadConcerns(true)
}, { deep: true })

// 监听外部筛选变化，重新加载数据
watch(() => props.externalFilters, (newFilters) => {
  console.log('[ConcernedQuestionsView] 📥 外部筛选变化:', newFilters)
  console.log('[ConcernedQuestionsView] 📥 questionCategory:', newFilters?.questionCategory)
  console.log('[ConcernedQuestionsView] 📥 hasActiveExternalFilters:', allActiveExternalFilters.value.length > 0)
  loadConcerns(true)
}, { deep: true, immediate: true })

// 行业选项映射
const industryOptions: Record<string, string> = {
  'national': '全国/股份制/政策性银行',
  'city': '城商行',
  'foreign': '外资行',
  'rural': '农商',
  'finance': '财务公司',
  'trust': '信托公司',
  'auto': '汽车/消费金融',
  'leasing': '金融租赁',
  'other': '其他'
}

// 本质类型选项映射
const essenceTypeOptions: Record<string, string> = {
  'confirm': '确认类',
  'compare': '对比类',
  'concern': '顾虑类',
  'suggestion': '建议类',
  'other': '其它意图'
}

// 所有活动的外部筛选（用于显示"当前筛选"栏）
const allActiveExternalFilters = computed(() => {
  const filters: Array<{ id: string; type: 'questionCategory' | 'industry' | 'essenceType' }> = []

  console.log('[ConcernedQuestionsView] 📊 计算 allActiveExternalFilters, externalFilters:', props.externalFilters)

  // 问题分类筛选
  if (props.externalFilters?.questionCategory && props.externalFilters.questionCategory.length > 0) {
    props.externalFilters.questionCategory.forEach(id => {
      filters.push({ id, type: 'questionCategory' })
    })
  }

  // 行业筛选
  if (props.externalFilters?.industry && props.externalFilters.industry.length > 0) {
    props.externalFilters.industry.forEach(id => {
      filters.push({ id, type: 'industry' })
    })
  }

  // 本质类型筛选
  if (props.externalFilters?.essenceType && props.externalFilters.essenceType.length > 0) {
    props.externalFilters.essenceType.forEach(id => {
      filters.push({ id, type: 'essenceType' })
    })
  }

  console.log('[ConcernedQuestionsView] 📊 filters结果:', filters)
  return filters
})

// 是否有活动的外部筛选
const hasActiveExternalFilters = computed(() => {
  return allActiveExternalFilters.value.length > 0
})

// 获取筛选条件名称（支持多种类型）
const getFilterName = (filterId: string, filterType?: 'questionCategory' | 'industry' | 'essenceType'): string => {
  // 如果指定了类型，按类型查找
  if (filterType === 'industry') {
    return industryOptions[filterId] || filterId
  }
  if (filterType === 'essenceType') {
    return essenceTypeOptions[filterId] || filterId
  }

  // 问题分类：从 questionCategories 中查找
  for (const category of questionCategories.value) {
    if (category.id === filterId) return category.name
    const child = category.children.find(c => c.id === filterId)
    if (child) return child.name
  }
  return filterId
}

// 过滤后的报告列表
const filteredReports = computed(() => {
  let reports = [...concerns.value]

  // 根据子筛选标签过滤
  if (props.selectedSubFilter) {
    reports = reports.filter(r => r.categoryCode === props.selectedSubFilter)
  }

  return reports
})

// 切换点赞状态
const toggleLike = async (reportId: string) => {
  const index = likedReports.value.indexOf(reportId)
  if (index > -1) {
    // 已点赞，取消（前端本地处理，API暂不支持取消）
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

// 切换答案展开/折叠状态
const toggleAnswer = (key: string) => {
  answerExpanded.value[key] = !answerExpanded.value[key]
}

// 初始化
onMounted(() => {
  loadCategories()
  loadConcerns(true)
})
</script>

<style scoped lang="scss">
.concerned-questions-layout {
  display: flex;
  gap: 20px;
  margin-top: 0;
  align-items: flex-start;
}

.left-content-wrapper {
  display: flex;
  gap: 20px;
  flex: 1;
  min-width: 0;
  padding: 20px;
  background: #FFF;
  border-radius: 8px;
}

.concerned-questions-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.current-filters {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: #f9f9f9;
  border-radius: 8px;
}

.filter-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.filter-title {
  font-size: 12px;
  color: #333;
  white-space: nowrap;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: #EFF6FF;
  border: 1px solid #1D4ED8;
  border-radius: 16px;
  font-size: 12px;
  color: #1D4ED8;
}

.filter-tag-icon {
  font-size: 12px;
  color: #1D4ED8;
}

.filter-tag-close {
  font-size: 12px;
  cursor: pointer;
  color: #1D4ED8;
  
  &:hover {
    opacity: 0.7;
  }
}

.clear-all-btn {
  padding: 4px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #006DF9;
    color: #006DF9;
  }
}

/* 筛选容器样式已移至 ConcernedQuestionsFilters 组件 */

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  box-sizing: border-box;
}

.hot-topics-sidebar {
  flex-shrink: 0;
  width: 320px;
  background: #fff;
  border-radius: 8px;
  padding: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* 热搜榜样式已移至 HotSearchPanel 组件 */

.report-item {
  display: flex;
  gap: 16px;
  background: #fff;
  border: none;
  border-bottom: 1px solid rgb(248 250 252 / var(--tw-divide-opacity, 1));
  border-radius: 8px;
  padding: 10px;
  transition: all 0.3s;
  width: 100%;
  box-sizing: border-box;
  
  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    background: rgb(248 250 252 / var(--tw-bg-opacity, 1));
    
    .report-item-question {
      color: #006DF9;
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

.report-item-question {
  font-size: 1rem;
  color: #1f2937;
  line-height: 1.6;
  font-weight: 500;
  margin-bottom: 5px;
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
    color: #006DF9;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    align-self: flex-start;
    
    &:hover {
      color: #0056cc;
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
    align-items: center;
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
    color: #006DF9;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
    align-self: flex-start;
    
    &:hover {
      color: #0056cc;
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

.report-item-bookmark {
  display: flex;
  align-items: center;
  cursor: pointer;
  color: #6b7280;
  font-size: 18px;
  transition: all 0.3s ease;
  
  &:hover {
    color: #006DF9;
  }
}

.report-item-date {
  font-size: 12px;
  color: #9ca3af;
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

