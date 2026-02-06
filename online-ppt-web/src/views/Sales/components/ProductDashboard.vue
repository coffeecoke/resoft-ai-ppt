<template>
  <div class="dashboard-scroll-wrapper">
    <button 
      class="scroll-btn scroll-btn-left" 
      :class="{ 'is-hidden': !showLeftBtn }"
      @click="scrollLeft"
    >
      <i class="ri-arrow-left-s-line"></i>
    </button>
    <div 
      ref="scrollContainer"
      class="dashboard-scroll"
      @scroll="handleScroll"
    >
      <div 
        v-for="(item, index) in productStats" 
        :key="item.code || item.name" 
        class="stat-card" 
        :class="{ 'is-selected': activeProduct === item.code }" 
        :style="{ backgroundColor: getProductBackgroundColor(item.name) }"
        @click="handleSelectProduct(item.code)"
      >
        <div class="stat-rank-badge" :class="{ 'rank-top3': index < 3 }">
          {{ index + 1 }}
        </div>
        <div class="stat-title">{{ item.name }}</div>
        <div class="stat-metrics-grid">
          <!-- 第一行：交流会议、PPT资料 -->
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-slideshow-2-line"></i>
              <span class="metric-name">交流会议</span>
            </div>
            <div class="metric-value">{{ item.sessions || 0 }}</div>
          </div>
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-file-ppt-2-line"></i>
              <span class="metric-name">PPT资料</span>
            </div>
            <div class="metric-value">{{ item.ppts || 0 }}</div>
          </div>
          <!-- 第二行：产品彩页、客户问题 -->
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-file-paper-2-line"></i>
              <span class="metric-name">产品彩页</span>
            </div>
            <div class="metric-value">{{ item.brochures || 0 }}</div>
          </div>
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-bill-line"></i>
              <span class="metric-name">客户问题</span>
            </div>
            <div class="metric-value">{{ item.questions || 0 }}</div>
          </div>
          <!-- 第三行：招标文件、投标文件 -->
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-file-list-3-line"></i>
              <span class="metric-name">招标文件</span>
            </div>
            <div class="metric-value">{{ item.tenderFiles || 0 }}</div>
          </div>
          <div class="stat-metric-item">
            <div class="metric-header">
              <i class="ri-file-edit-line"></i>
              <span class="metric-name">投标文件</span>
            </div>
            <div class="metric-value">{{ item.responseFiles || 0 }}</div>
          </div>
        </div>
      </div>
    </div>
    <button 
      class="scroll-btn scroll-btn-right" 
      :class="{ 'is-hidden': !showRightBtn }"
      @click="scrollRight"
    >
      <i class="ri-arrow-right-s-line"></i>
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  productStats: {
    type: Array,
    default: () => []
  },
  activeProduct: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['select-product'])

const scrollContainer = ref(null)
const showLeftBtn = ref(false)
const showRightBtn = ref(true)

// 传 product code，供下游按 code 查 PPT/缩略图
const handleSelectProduct = (productCode) => {
  emit('select-product', productCode)
}

// 根据产品名称获取背景色
const getProductBackgroundColor = (productName) => {
  // 所有产品使用统一的背景色
  return '#F3F7FD'
}

// 检查滚动位置，更新按钮显示状态
const checkScrollButtons = () => {
  if (!scrollContainer.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value
  showLeftBtn.value = scrollLeft > 0
  showRightBtn.value = scrollLeft < scrollWidth - clientWidth - 1
}

// 处理滚动事件
const handleScroll = () => {
  checkScrollButtons()
}

// 向左滚动
const scrollLeft = () => {
  if (!scrollContainer.value) return
  const scrollAmount = scrollContainer.value.clientWidth * 0.8
  scrollContainer.value.scrollBy({
    left: -scrollAmount,
    behavior: 'smooth'
  })
}

// 向右滚动
const scrollRight = () => {
  if (!scrollContainer.value) return
  const scrollAmount = scrollContainer.value.clientWidth * 0.8
  scrollContainer.value.scrollBy({
    left: scrollAmount,
    behavior: 'smooth'
  })
}

onMounted(() => {
  checkScrollButtons()
  // 监听窗口大小变化
  window.addEventListener('resize', checkScrollButtons)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScrollButtons)
})
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

