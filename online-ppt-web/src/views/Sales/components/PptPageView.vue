<template>
  <section class="ppt-summary">
    <h2 class="page-title">产品介绍PPT</h2>
    <div class="filters-row">
      <div class="filters-left">
        <el-select 
          :model-value="fProduct" 
          placeholder="产品及解决方案" 
          clearable 
          style="min-width:160px"
          @update:model-value="handleProductChange"
        >
          <el-option label="一表通" value="一表通" />
          <el-option label="1104" value="1104" />
          <el-option label="受益所有人" value="受益所有人" />
          <el-option label="反洗钱" value="反洗钱" />
        </el-select>
        
        <el-select 
          :model-value="fAudience" 
          placeholder="交流对象" 
          clearable 
          style="min-width:140px"
          @update:model-value="handleAudienceChange"
        >
          <el-option label="业务" value="业务" />
          <el-option label="科技" value="科技" />
          <el-option label="业务领导" value="业务领导" />
          <el-option label="科技领导" value="科技领导" />
        </el-select>
        
        <el-select 
          :model-value="fIndustry" 
          placeholder="行业" 
          clearable 
          style="min-width:120px"
          @update:model-value="handleIndustryChange"
        >
          <el-option label="全国性银行" value="全国性银行" />
          <el-option label="城商行" value="城商行" />
          <el-option label="外资行" value="外资行" />
          <el-option label="农村信社" value="农村信社" />
          <el-option label="汽车/消费金融" value="汽车/消费金融" />
        </el-select>
        
        <el-select 
          :model-value="fBiz" 
          placeholder="业务条线" 
          clearable 
          style="min-width:140px"
          @update:model-value="handleBizChange"
        >
          <el-option label="监管条线" value="监管条线" />
          <el-option label="信创协同条线" value="信创协同条线" />
          <el-option label="票据条线" value="票据条线" />
          <el-option label="互联网金融条线" value="互联网金融条线" />
        </el-select>
        
        <el-select 
          :model-value="fVersion" 
          placeholder="版本" 
          clearable 
          style="min-width:120px"
          @update:model-value="handleVersionChange"
        >
          <el-option label="公共版" value="public" />
          <el-option label="实战版" value="practical" />
        </el-select>
        
        <el-input 
          :model-value="customerName" 
          placeholder="输入客户名称" 
          style="max-width:220px;"
          @update:model-value="handleCustomerNameChange"
        />
      </div>
      
      <div class="sort-tabs">
        <el-radio-group 
          :model-value="sort" 
          size="small"
          @update:model-value="handleSortChange"
        >
          <el-radio-button label="综合排序" />
          <el-radio-button label="最新上传" />
          <el-radio-button label="最多下载" />
        </el-radio-group>
      </div>
    </div>
    
    <!-- PPT卡片网格 -->
    <PptGrid
      :items="filteredPPT"
      :showBadge="true"
      @item-click="handlePptClick"
    />
  </section>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, inject } from 'vue'
import PptGrid from './PptGrid.vue'

const props = defineProps({
  filteredPPT: {
    type: Array,
    default: () => []
  },
  fProduct: {
    type: [String, null] as any,
    default: null
  },
  fAudience: {
    type: [String, null] as any,
    default: null
  },
  fIndustry: {
    type: [String, null] as any,
    default: null
  },
  fBiz: {
    type: [String, null] as any,
    default: null
  },
  fVersion: {
    type: [String, null] as any,
    default: null
  },
  customerName: {
    type: String,
    default: ''
  },
  sort: {
    type: String,
    default: '综合排序'
  }
})

const emit = defineEmits([
  'update:fProduct',
  'update:fAudience',
  'update:fIndustry',
  'update:fBiz',
  'update:fVersion',
  'update:customerName',
  'update:sort'
])

// 注入dialogs composable
const dialogs: any = inject('dialogs')

const handleProductChange = (value: string) => {
  emit('update:fProduct', value)
}

const handleAudienceChange = (value: string) => {
  emit('update:fAudience', value)
}

const handleIndustryChange = (value: string) => {
  emit('update:fIndustry', value)
}

const handleBizChange = (value: string) => {
  emit('update:fBiz', value)
}

const handleVersionChange = (value: string) => {
  emit('update:fVersion', value)
}

const handleCustomerNameChange = (value: string) => {
  emit('update:customerName', value)
}

const handleSortChange = (value: string) => {
  emit('update:sort', value)
}

const handlePptClick = (item: any) => {
  if (dialogs) {
    dialogs.openPpt(item)
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

