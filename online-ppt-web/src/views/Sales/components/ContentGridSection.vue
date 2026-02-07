<template>
  <div>
    <!-- PPT网格 -->
    <PptGrid
      v-if="activeTab === 'ppt'"
      :items="filteredPPT"
      :showBadge="true"
      @item-click="handlePptClick"
    />
    
    <!-- 视频网格 -->
    <VideoGrid
      v-if="activeTab === 'video'"
      :items="filteredVideos"
      @video-click="handleVideoClick"
    />
    
    <!-- 招标文件列表 -->
    <TenderFileList
      v-if="activeTab === 'tender'"
      :items="tenderFiles"
      @item-click="handlePptClick"
      @ai-analyze="handleTenderAiAnalyze"
      @download="handleTenderDownload"
    />
    
    <!-- 响应文件列表 -->
    <ResponseFileList
      v-if="activeTab === 'response'"
      :items="responseFiles"
      @item-click="handlePptClick"
      @ai-analyze="handleResponseAiAnalyze"
    />
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import PptGrid from './PptGrid.vue'
import VideoGrid from './VideoGrid.vue'
import ResponseFileList from './ResponseFileList.vue'
import TenderFileList from './TenderFileList.vue'

interface TenderFileItem {
  id: string | number
  title: string
  date?: string
  tag?: string
}

interface ResponseFileItem {
  id: string | number
  title: string
  date?: string
}

const props = defineProps<{
  activeTab: string
  filteredPPT?: any[]
  filteredVideos?: any[]
  tenderFiles?: TenderFileItem[]
  responseFiles?: ResponseFileItem[]
}>()

// 注入dialogs composable
const dialogs: any = inject('dialogs')

const handlePptClick = (item: any) => {
  if (dialogs) {
    dialogs.openPpt(item)
  }
}

const handleVideoClick = (item: any) => {
  if (dialogs) {
    dialogs.openVideo(item)
  }
}

const handleTenderAiAnalyze = (item: any) => {
  if (dialogs) {
    // 打开PDF对话框并显示AI分析面板
    dialogs.openPpt(item)
    // 可以在这里添加打开AI分析面板的逻辑
  }
}

const handleTenderDownload = (item: any) => {
  // TODO: 实现下载逻辑
  console.log('下载招标文件:', item)
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

