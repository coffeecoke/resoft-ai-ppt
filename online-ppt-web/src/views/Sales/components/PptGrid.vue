<template>
  <div class="ppt-grid">
    <div 
      v-for="item in items" 
      :key="item.id" 
      class="ppt-card" 
      @click="handleItemClick(item)" 
      style="cursor: pointer;"
    >
      <div class="thumb">
        <img :src="item.thumbnail" :alt="item.title" />
        <span 
          v-if="showBadge && item.tag" 
          class="badge" 
          :class="getBadgeClass(item.tag)"
        >
          {{ item.tag }}
        </span>
      </div>
      <div class="meta">
        <div class="title">{{ item.title }}</div>
        <div class="sub">{{ item.date }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  },
  showBadge: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['item-click'])

const getBadgeClass = (tag) => {
  if (tag === '公共版' || tag === 'PDF') return 'badge-public'
  if (tag === '实战版' || tag === 'PPT') return 'badge-practical'
  if (tag === '招标文件') return 'badge-tender'
  if (tag === '响应文件') return 'badge-response'
  return ''
}

const handleItemClick = (item) => {
  emit('item-click', item)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

