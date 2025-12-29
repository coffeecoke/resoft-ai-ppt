<template>
  <section class="video-page">
    <h2 class="page-title">交流会议·音频</h2>
    <div class="filters-row">
      <div class="filters-left">
        <el-select 
          :model-value="fProduct" 
          placeholder="产品名称" 
          clearable 
          style="min-width:160px"
          @update:model-value="handleProductChange"
        >
          <el-option label="一表通" value="一表通" />
          <el-option label="1104" value="1104" />
          <el-option label="受益所有人" value="受益所有人" />
          <el-option label="反洗钱" value="反洗钱" />
          <el-option label="金数" value="金数" />
        </el-select>
        
        <el-select 
          :model-value="fIndustry" 
          placeholder="行业" 
          clearable 
          style="min-width:160px"
          @update:model-value="handleIndustryChange"
        >
          <el-option label="银行" value="银行" />
          <el-option label="保险" value="保险" />
          <el-option label="证券" value="证券" />
          <el-option label="政务" value="政务" />
          <el-option label="企业" value="企业" />
        </el-select>
      </div>
    </div>
    
    <!-- 视频卡片网格 -->
    <VideoGrid
      :items="filteredVideos"
      @video-click="handleVideoClick"
    />
  </section>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, inject } from 'vue'
import VideoGrid from './VideoGrid.vue'

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

const handleProductChange = (value: string) => {
  emit('update:fProduct', value)
}

const handleIndustryChange = (value: string) => {
  emit('update:fIndustry', value)
}

const handleVideoClick = (item: any) => {
  if (dialogs) {
    dialogs.openVideo(item)
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

