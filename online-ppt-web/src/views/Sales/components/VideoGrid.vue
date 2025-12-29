<template>
  <div class="ppt-grid">
    <div 
      v-for="item in items" 
      :key="item.id" 
      class="ppt-card" 
      @click="handleVideoClick(item)" 
      style="cursor: pointer;"
    >
      <div class="thumb is-video">
        <img :src="item.thumbnail" :alt="item.title" />
        <span 
          v-if="item.tag" 
          class="badge" 
          :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'"
        >
          {{ item.tag }}
        </span>
        <div class="play-icon">
          <el-icon><VideoPlay /></el-icon>
        </div>
        <span v-if="item.duration" class="video-duration">{{ item.duration }}</span>
      </div>
      <div class="meta">
        <div class="title">{{ item.title }}</div>
        <div class="sub">
          <template v-if="item.product && item.industry">
            {{ item.product }} | {{ item.industry }} | {{ item.date }}
          </template>
          <template v-else>
            {{ item.date }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['video-click'])

const handleVideoClick = (item) => {
  emit('video-click', item)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

