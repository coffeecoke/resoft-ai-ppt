<template>
  <section class="response-page">
    <h2 class="page-title">响应文件</h2>
    
    <!-- 筛选区域 -->
    <CommonFilters
      :industry-tags="industryTags"
      :selected-industry="selectedIndustry"
      :filter-groups="filterGroups"
      :filter-values="filterValues"
      :show-sort="false"
      @update:selected-industry="handleIndustryChange"
      @update:filter-values="handleFilterValuesChange"
      @select-customer="handleSelectCustomer"
      @select-product="handleSelectProduct"
    />
    
    <!-- 响应文件列表 -->
    <ResponseFileList
      :items="responseFiles"
      @item-click="handleResponseClick"
      @ai-analyze="handleResponseAiAnalyze"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { inject } from 'vue'
import ResponseFileList from './ResponseFileList.vue'
import CommonFilters from './CommonFilters.vue'

const props = defineProps({
  responseFiles: {
    type: Array,
    default: () => []
  }
})

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({})

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

// 筛选组配置（响应文件暂时不需要额外的筛选组）
const filterGroups = computed(() => [])

// 注入dialogs composable
const dialogs: any = inject('dialogs')

// 处理筛选变化
const handleIndustryChange = (tagId: string | null) => {
  selectedIndustry.value = tagId
}

const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
}

const handleSelectCustomer = () => {
  // TODO: 实现选择客户功能
  console.log('选择客户')
}

const handleSelectProduct = () => {
  // TODO: 实现选择产品与解决方案功能
  console.log('选择产品与解决方案')
}

const handleResponseClick = (item: any) => {
  if (dialogs) {
    dialogs.openPpt(item)
  }
}

const handleResponseAiAnalyze = (item: any) => {
  if (dialogs) {
    // 打开响应文件对话框并显示AI分析面板
    dialogs.openPpt(item)
    // 可以在这里添加打开AI分析面板的逻辑
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

