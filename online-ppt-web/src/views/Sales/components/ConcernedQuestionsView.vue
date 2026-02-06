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
        <!-- 当前筛选 -->
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
import { ref, computed } from 'vue'
import { concernedQuestionsData } from '@/configs/salesData'
import QuestionCategorySidebar from './QuestionCategorySidebar.vue'
import HotSearchPanel from './HotSearchPanel.vue'
import QuestionReportItem from './QuestionReportItem.vue'

interface Props {
  showSidebar?: boolean
  showFilters?: boolean
  selectedSubFilter?: string | null
  selectedEssenceType?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  showSidebar: true,
  showFilters: true,
  selectedSubFilter: null,
  selectedEssenceType: null
})

// 已选中的筛选条件
const selectedFilters = ref<string[]>([])

// 已点赞的报告ID列表
const likedReports = ref<number[]>([])

// 每个报告的点赞数量（初始值从数据中获取，点击后会更新）
const reportLikeCounts = ref<Record<number, number>>({})

// 答案展开/折叠状态：key 为 'system-{reportId}' 或 'expert-{reportId}'
const answerExpanded = ref<Record<string, boolean>>({})

// 问题分类结构
const questionCategories = ref([
  {
    id: 'company',
    name: '公司类',
    icon: 'ri-building-line',
    children: [
      { id: 'qualifications', name: '资质与案例' },
      { id: 'scale', name: '公司规模与背景' },
      { id: 'cooperation', name: '合作模式' },
      { id: 'regulatory', name: '监管资源与协作' }
    ]
  },
  {
    id: 'product',
    name: '产品类',
    icon: 'ri-box-3-line',
    children: [
      { id: 'performance', name: '性能与效率' },
      { id: 'architecture', name: '产品架构' },
      { id: 'features', name: '产品功能' },
      { id: 'compatibility', name: '兼容性与接口扩展' }
    ]
  },
  {
    id: 'business',
    name: '业务类',
    icon: 'ri-briefcase-line',
    children: [
      { id: 'policy', name: '监管政策适配' },
      { id: 'security', name: '数据安全与合规治理' },
      { id: 'customization', name: '业务适配与定制化' }
    ]
  },
  {
    id: 'commerce',
    name: '商务类',
    icon: 'ri-money-dollar-circle-line',
    children: [
      { id: 'budget', name: '预算与报价' },
      { id: 'price-competitiveness', name: '价格竞争力与优惠政策' }
    ]
  },
  {
    id: 'project',
    name: '项目实施类',
    icon: 'ri-projector-line',
    children: [
      { id: 'poc', name: 'POC' },
      { id: 'project-cycle', name: '项目周期' },
      { id: 'project-team', name: '项目团队' },
      { id: 'project-control', name: '项目管控' },
      { id: 'resource-allocation', name: '资源配置' },
      { id: 'data-migration', name: '数据迁移与系统切换' }
    ]
  },
  {
    id: 'after-sales',
    name: '售后保障类',
    icon: 'ri-customer-service-line',
    children: [
      { id: 'maintenance-content', name: '运维内容' },
      { id: 'maintenance-cost', name: '运维费用和周期' },
      { id: 'training', name: '培训与知识转移' },
      { id: 'security-support', name: '安全支撑' }
    ]
  }
])


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
  // selectedSubFilter 和 selectedEssenceType 由父组件管理
}

// 获取筛选条件名称
const getFilterName = (filterId: string): string => {
  for (const category of questionCategories.value) {
    const child = category.children.find(c => c.id === filterId)
    if (child) return child.name
  }
  return filterId
}

// 显示信息
const showInfo = (child: any) => {
  // TODO: 显示详细信息
  console.log('显示信息:', child)
}

// 打开报告
const openReport = (report: any) => {
  // TODO: 打开报告详情
  console.log('打开报告:', report)
}


// 过滤后的报告列表
const filteredReports = computed(() => {
  let reports = [...concernedQuestionsData.reports]
  
  // 根据筛选条件过滤
  if (selectedFilters.value.length > 0) {
    // TODO: 实现筛选逻辑
  }
  
  // 根据子筛选标签过滤
  if (props.selectedSubFilter) {
    reports = reports.filter(r => r.tagId === props.selectedSubFilter)
  }
  
  // 初始化点赞数量（如果还没有设置）
  reports.forEach(report => {
    if (!(report.id in reportLikeCounts.value)) {
      reportLikeCounts.value[report.id] = report.likes || 0
    }
  })
  
  return reports
})

// 切换点赞状态
const toggleLike = (reportId: number) => {
  const index = likedReports.value.indexOf(reportId)
  if (index > -1) {
    // 取消点赞
    likedReports.value.splice(index, 1)
    reportLikeCounts.value[reportId] = (reportLikeCounts.value[reportId] || 0) - 1
  } else {
    // 点赞
    likedReports.value.push(reportId)
    reportLikeCounts.value[reportId] = (reportLikeCounts.value[reportId] || 0) + 1
  }
}

// 获取点赞数量
const getLikeCount = (reportId: number): number => {
  return reportLikeCounts.value[reportId] || 0
}

// 格式化日期
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) {
    return '刚刚'
  } else if (days < 7) {
    return `${days}天前`
  } else {
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
  }
}

// 判断是否需要显示展开按钮（根据容器宽度和字体大小，大约一行可显示60-70个中文字符）
const shouldShowExpand = (content: string): boolean => {
  if (!content) return false
  // 考虑容器宽度约350px，字体大小0.75rem（约12px），一行大约可以显示60-70个中文字符
  // 超过70个字符才显示展开按钮
  return content.length > 70
}

// 切换答案展开/折叠状态
const toggleAnswer = (key: string) => {
  answerExpanded.value[key] = !answerExpanded.value[key]
}

// 热搜榜已移至 HotSearchPanel 组件

// 最热问题Top10数据（已废弃，保留用于兼容）
const hotTopics = ref([
  {
    id: 1,
    title: '针对监管要求,汽车/消费金融在合作模式模块的技术路径选择。',
    category: '合作模式',
    likes: 997,
    similarCount: 156
  },
  {
    id: 2,
    title: '全国/股份制/政策性银行如何通过资源配置提升业务敏捷度并确保数据资产安全?',
    category: '资源配置',
    likes: 996,
    similarCount: 142
  },
  {
    id: 3,
    title: '全国/股份制/政策性银行如何通过业务适配与定制化提升业务敏捷度并确保数据资产安全?',
    category: '业务适配与定制化',
    likes: 980,
    similarCount: 128
  },
  {
    id: 4,
    title: '全国/股份制/政策性银行如何通过POC提升业务敏捷度并确保数据资产安全?',
    category: 'POC',
    likes: 978,
    similarCount: 115
  },
  {
    id: 5,
    title: '针对监管要求,汽车/消费金融在资质与案例模块的技术路径选择。',
    category: '资质与案例',
    likes: 951,
    similarCount: 98
  },
  {
    id: 6,
    title: '全国/股份制/政策性银行如何通过公司规模与背景提升业务敏捷度并确保数据资产安全?',
    category: '公司规模与背景',
    likes: 950,
    similarCount: 87
  },
  {
    id: 7,
    title: '全国/股份制/政策性银行如何通过项目周期提升业务敏捷度并确保数据资产安全?',
    category: '项目周期',
    likes: 945,
    similarCount: 76
  },
  {
    id: 8,
    title: '针对监管要求,汽车/消费金融在数据安全与合规治理模块的技术路径选择。',
    category: '数据安全与合规治理',
    likes: 932,
    similarCount: 65
  },
  {
    id: 9,
    title: '全国/股份制/政策性银行如何通过产品功能提升业务敏捷度并确保数据资产安全?',
    category: '产品功能',
    likes: 920,
    similarCount: 54
  },
  {
    id: 10,
    title: '针对监管要求,汽车/消费金融在监管政策适配模块的技术路径选择。',
    category: '监管政策适配',
    likes: 915,
    similarCount: 43
  }
])
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

