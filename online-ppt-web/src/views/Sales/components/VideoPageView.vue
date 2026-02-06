<template>
  <section class="video-page">
    <h2 class="page-title">交流会议</h2>
    
    <!-- 筛选区域 -->
    <CommonFilters
      :industry-tags="industryTags"
      :selected-industry="selectedIndustry"
      :filter-groups="filterGroups"
      :hidden-filter-groups="hiddenFilterGroups"
      :filter-values="filterValues"
      :sort-options="sortOptions"
      :selected-sort="selectedSort"
      @update:selected-industry="handleIndustryChange"
      @update:filter-values="handleFilterValuesChange"
      @update:selected-sort="handleSortChange"
      @select-customer="handleSelectCustomer"
      @select-product="handleSelectProduct"
    />
    
    
    <!-- 视频卡片网格 -->
    <VideoGrid
      :items="filteredVideosList"
      @video-click="handleVideoClick"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { defineProps, defineEmits, inject } from 'vue'
import VideoGrid from './VideoGrid.vue'
import CommonFilters from './CommonFilters.vue'

const props = defineProps({
  filteredVideos: {
    type: Array,
    default: () => []
  },
  fProduct: {
    type: [String, null] as any,
    default: null
  },
  fIndustry: {
    type: [String, null] as any,
    default: null
  }
})

const emit = defineEmits([
  'update:fProduct',
  'update:fIndustry'
])

// 注入dialogs composable
const dialogs: any = inject('dialogs')

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({
  meetingType: null,
  customerType: null,
  audience: null,
  language: null
})
const selectedSort = ref<string>('latest')

// 行业领域标签
const industryTags = [
  { id: 'national', name: '全国/股份制/政策性银行' },
  { id: 'city', name: '城商行' },
  { id: 'foreign', name: '外资行' },
  { id: 'rural', name: '农商' },
  { id: 'finance', name: '财务公司' },
  { id: 'trust', name: '信托公司' },
  { id: 'auto', name: '汽车/消费金融' },
  { id: 'leasing', name: '金融租赁' }
]

// 会议类型
const meetingTypes = [
  { id: 'first', name: '首次交流' },
  { id: 'research', name: '需求调研' },
  { id: 'solution', name: '方案讲解' },
  { id: 'technical', name: '技术答疑' },
  { id: 'bid', name: '投标澄清' },
  { id: 'executive', name: '高层汇报' }
]

// 客户类型
const customerTypes = [
  { id: 'new-new', name: '新客户新产品' },
  { id: 'old-new', name: '老客户新产品' },
  { id: 'old-old', name: '老客户老产品' }
]

// 交流对象
const audiences = [
  { id: 'business', name: '业务' },
  { id: 'tech', name: '科技' },
  { id: 'business-leader', name: '业务领导' },
  { id: 'tech-leader', name: '科技领导' }
]

// 语言
const languages = [
  { id: 'chinese', name: '中文' },
  { id: 'english', name: '英文' }
]

// 排序选项
const sortOptions = [
  { id: 'latest', name: '最新更新' },
  { id: 'likes', name: '点赞量' },
  { id: 'usage', name: '使用度' }
]

// 可见的筛选组配置
const filterGroups = computed(() => [
  {
    key: 'meetingType',
    label: '会议类型',
    icon: 'ri-calendar-line',
    options: meetingTypes
  },
  {
    key: 'customerType',
    label: '客户类型',
    icon: 'ri-user-line',
    options: customerTypes
  }
])

// 隐藏的筛选组配置（通过"更多"按钮显示）
const hiddenFilterGroups = computed(() => [
  {
    key: 'audience',
    label: '交流对象',
    icon: 'ri-team-line',
    options: audiences
  },
  {
    key: 'language',
    label: '语言',
    icon: 'ri-global-line',
    options: languages
  }
])

// 行业领域映射（将筛选标签ID映射到实际行业值）
const industryMap: Record<string, string> = {
  'national': '全国/股份制/政策性银行',
  'city': '城商行',
  'foreign': '外资行',
  'rural': '农商',
  'finance': '财务公司',
  'trust': '信托公司',
  'auto': '汽车/消费金融',
  'leasing': '金融租赁'
}

// 根据筛选条件筛选视频列表
const filteredVideosList = computed(() => {
  let list = [...(props.filteredVideos as any[])]
  
  // 行业筛选
  if (selectedIndustry.value) {
    const industryName = industryMap[selectedIndustry.value]
    if (industryName) {
      list = list.filter((video: any) => {
        // 如果视频有 industry 字段，直接匹配
        if (video.industry) {
          return video.industry === industryName || video.industry?.includes(industryName)
        }
        // 如果没有 industry 字段，可以根据其他字段推断（这里暂时保留所有）
        return true
      })
    }
  }
  
  // 会议类型筛选（如果视频数据有 meetingType 字段）
  if (filterValues.value.meetingType) {
    list = list.filter((video: any) => video.meetingType === filterValues.value.meetingType)
  }
  
  // 客户类型筛选（如果视频数据有 customerType 字段）
  if (filterValues.value.customerType) {
    list = list.filter((video: any) => video.customerType === filterValues.value.customerType)
  }
  
  // 交流对象筛选（如果视频数据有 audience 字段）
  if (filterValues.value.audience) {
    list = list.filter((video: any) => video.audience === filterValues.value.audience)
  }
  
  // 语言筛选（如果视频数据有 language 字段）
  if (filterValues.value.language) {
    list = list.filter((video: any) => video.language === filterValues.value.language)
  }
  
  // 排序
  if (selectedSort.value === 'latest') {
    // 按日期排序（最新的在前）
    list.sort((a: any, b: any) => {
      const dateA = new Date(a.date || 0).getTime()
      const dateB = new Date(b.date || 0).getTime()
      return dateB - dateA
    })
  } else if (selectedSort.value === 'likes') {
    // 按点赞量排序
    list.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0))
  } else if (selectedSort.value === 'usage') {
    // 按使用度排序
    list.sort((a: any, b: any) => (b.usage || 0) - (a.usage || 0))
  }
  
  return list
})

// 处理筛选变化
const handleIndustryChange = (tagId: string | null) => {
  selectedIndustry.value = tagId
}

const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
}

const handleSortChange = (sortId: string) => {
  selectedSort.value = sortId
}

const handleSelectCustomer = () => {
  // TODO: 实现选择客户功能
  console.log('选择客户')
}

const handleSelectProduct = () => {
  // TODO: 实现选择产品与解决方案功能
  console.log('选择产品与解决方案')
}

const handleVideoClick = (item: any) => {
  if (dialogs) {
    dialogs.openVideo(item)
  }
}
</script>

<style scoped>
/* 样式已移至 CommonFilters 组件 */
</style>

