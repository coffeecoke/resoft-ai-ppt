<template>
  <section class="tender-page">
    <h2 class="page-title">招标文件</h2>

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

    <!-- 加载状态 -->
    <div v-if="isLoading" class="tender-loading">
      <i class="ri-loader-4-line spin"></i>
      <span>加载中...</span>
    </div>

    <!-- 招标文件列表 -->
    <TenderFileList
      v-else
      :items="tenderFileItems"
      @item-click="handleTenderClick"
      @ai-analyze="handleTenderAiAnalyze"
      @download="handleTenderDownload"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import TenderFileList from './TenderFileList.vue'
import CommonFilters from './CommonFilters.vue'
import { getTenderDocumentList } from '@/services/tenderDocumentService'

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({
  procurementMethod: null
})

// 数据状态
const isLoading = ref(false)
const rawList = ref<any[]>([])

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

// 采购方式选项
const procurementMethods = [
  { id: 'open', name: '公开招标' },
  { id: 'invite', name: '邀请招标' },
  { id: 'negotiation', name: '竞争性谈判' },
  { id: 'inquiry', name: '询价' },
  { id: 'single', name: '单一来源' }
]

const filterGroups = computed(() => [
  {
    key: 'procurementMethod',
    label: '采购方式',
    icon: 'ri-file-list-3-line',
    options: procurementMethods
  }
])

// 将 API 数据映射到列表组件所需格式
const tenderFileItems = computed(() =>
  rawList.value.map(d => ({
    id: d.id,
    title: d.project_name || d.name,
    date: d.created_at ? d.created_at.slice(0, 10) : '',
    controlPrice: d.budget || '--',
    customerName: '--',
    tenderType: '--',
    views: 0,
    favorites: 0,
    downloads: 0,
    // 传递原始数据供弹窗使用
    type: 'tender',
    name: d.name,
    project_name: d.project_name,
  }))
)

// 注入 dialogs composable
const dialogs: any = inject('dialogs')

// 处理筛选变化
const handleIndustryChange = (tagId: string | null) => {
  selectedIndustry.value = tagId
}

const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
}

const handleSelectCustomer = () => {
  console.log('选择客户')
}

const handleSelectProduct = () => {
  console.log('选择产品与解决方案')
}

const handleTenderClick = (item: any) => {
  if (dialogs) {
    dialogs.openPpt({ ...item, type: 'tender' })
  }
}

const handleTenderAiAnalyze = (item: any) => {
  if (dialogs) {
    dialogs.openPpt({ ...item, type: 'tender' })
  }
}

const handleTenderDownload = (item: any) => {
  if (dialogs) {
    dialogs.openPpt({ ...item, type: 'tender' })
  }
}

// 加载数据
const loadData = async () => {
  isLoading.value = true
  try {
    const result = await getTenderDocumentList({ pageSize: 100 })
    rawList.value = result.list || []
  } catch (err) {
    console.error('[TenderPageView] 加载招标文件失败:', err)
    rawList.value = []
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.tender-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 60px 20px;
  color: #9ca3af;
  font-size: 14px;
}

.tender-loading i {
  font-size: 20px;
  color: #f36f6f;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
</style>
