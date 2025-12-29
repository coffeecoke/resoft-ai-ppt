<template>
  <div class="brand-content">
    <div class="brand-tabs tabs-row">
      <el-segmented 
        :model-value="activeBrandTab" 
        :options="brandTabOptions" 
        size="small" 
        @update:model-value="handleTabChange"
      />
    </div>
    <div class="brand-tab-content">
      <div class="ppt-grid">
        <div 
          v-for="item in currentTabItems" 
          :key="item.id" 
          class="ppt-card" 
          @click="handleOpenItem(item)" 
          style="cursor: pointer;"
        >
          <div class="thumb">
            <img :src="item.thumbnail" :alt="item.title" />
            <span 
              v-if="item.tag" 
              class="badge" 
              :class="item.tag === 'PDF' ? 'badge-public' : 'badge-practical'"
            >
              {{ item.tag }}
            </span>
            <div v-if="item.type === 'video'" class="play-icon">
              <el-icon><VideoPlay /></el-icon>
            </div>
          </div>
          <div class="meta">
            <div class="title">{{ item.title }}</div>
            <div class="sub">{{ item.date }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'

const props = defineProps({
  activeBrandTab: {
    type: String,
    default: 'company'
  },
  brandTabOptions: {
    type: Array,
    default: () => []
  },
  brandCompanyItems: {
    type: Array,
    default: () => []
  },
  brandProductsItems: {
    type: Array,
    default: () => []
  },
  brandRegulationsItems: {
    type: Array,
    default: () => []
  },
  brandCalendarItems: {
    type: Array,
    default: () => []
  },
  brandComplianceItems: {
    type: Array,
    default: () => []
  },
  brandGeneralItems: {
    type: Array,
    default: () => []
  },
  brandXinchuangItems: {
    type: Array,
    default: () => []
  },
  brandLocalItems: {
    type: Array,
    default: () => []
  },
  brandBillItems: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['update:activeBrandTab', 'open-brand-item'])

const currentTabItems = computed(() => {
  const itemsMap = {
    'company': props.brandCompanyItems,
    'products': props.brandProductsItems,
    'regulations': props.brandRegulationsItems,
    'calendar': props.brandCalendarItems,
    'compliance': props.brandComplianceItems,
    'general': props.brandGeneralItems,
    'xinchuang': props.brandXinchuangItems,
    'local': props.brandLocalItems,
    'bill': props.brandBillItems
  }
  return itemsMap[props.activeBrandTab] || []
})

const handleTabChange = (value) => {
  emit('update:activeBrandTab', value)
}

const handleOpenItem = (item) => {
  emit('open-brand-item', item)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

