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
    
    <!-- 招标文件网格 -->
    <PptGrid
      v-if="activeTab === 'tender'"
      :items="tenderFiles"
      :showBadge="true"
      @item-click="handlePptClick"
    />
    
    <!-- 响应文件网格 -->
    <PptGrid
      v-if="activeTab === 'response'"
      :items="responseFiles"
      :showBadge="true"
      @item-click="handlePptClick"
    />
  </div>
</template>

<script setup lang="ts">
import { defineProps, inject } from 'vue'
import PptGrid from './PptGrid.vue'
import VideoGrid from './VideoGrid.vue'

const props = defineProps({
  activeTab: {
    type: String,
    required: true
  },
  filteredPPT: {
    type: Array,
    default: () => []
  },
  filteredVideos: {
    type: Array,
    default: () => []
  },
  tenderFiles: {
    type: Array,
    default: () => []
  },
  responseFiles: {
    type: Array,
    default: () => []
  }
})

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
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

