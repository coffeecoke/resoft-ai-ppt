<template>
  <div class="layout">
    <Header />
    
    <div class="main">
      <!-- 搜索栏（已删除） -->
      <!-- <SearchBar /> -->
      
      <h2 class="page-title">客户问题</h2>
      
      <!-- 筛选区域 -->
      <ConcernedQuestionsFilters
        v-model:selectedSubFilter="selectedSubFilter"
        v-model:selectedEssenceType="selectedEssenceType"
        :sub-filter-tags="subFilterTags"
        :essence-types="essenceTypes"
        @select-customer="handleSelectCustomer"
        @select-product="handleSelectProduct"
      />
      
      <ConcernedQuestionsView 
        :selectedSubFilter="selectedSubFilter"
        :selectedEssenceType="selectedEssenceType"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useSalesOptions } from '@/hooks/useSalesOptions'
import Header from './components/Header.vue'
import SearchBar from './components/SearchBar.vue'
import ConcernedQuestionsView from './components/ConcernedQuestionsView.vue'
import ConcernedQuestionsFilters from './components/ConcernedQuestionsFilters.vue'

// 筛选状态
const selectedSubFilter = ref<string | null>(null)
const selectedEssenceType = ref<string | null>(null)

// 行业领域标签（动态从 customer_types 表加载）
const { load: loadSalesOptions, industryTags: subFilterTags } = useSalesOptions()
onMounted(() => loadSalesOptions())

// 本质类型选项
const essenceTypes = ref([
  { id: 'confirm', name: '确认类' },
  { id: 'compare', name: '对比类' },
  { id: 'concern', name: '顾虑类' },
  { id: 'suggestion', name: '建议类' },
  { id: 'other', name: '其它意图' }
])

const handleSelectCustomer = () => {
  // TODO: 实现选择客户功能
  console.log('选择客户')
}

const handleSelectProduct = () => {
  // TODO: 实现选择产品与解决方案功能
  console.log('选择产品与解决方案')
}
</script>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.main {
  flex: 1;
  padding: 20px 20px 0;
}
</style>
