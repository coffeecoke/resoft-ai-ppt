<template>
  <div class="dashboard-scroll">
    <div 
      v-for="(item, index) in productStats" 
      :key="item.code || item.name" 
      class="stat-card" 
      :class="{ 'is-selected': activeProduct === (item.code || item.name) }" 
      @click="handleSelectProduct(item.code || item.name)"
    >
      <span 
        class="stat-number" 
        :class="{ 'stat-number-gray': index >= 3 }"
        :style="{ backgroundColor: getProductNumberColor(index) }"
      >
        {{ index + 1 }}
      </span>
      <div class="stat-title">{{ item.name }}</div>
      <div class="stat-body">
        <div class="stat-row">
          <span class="label">交流场次</span>
          <span class="value">{{ item.sessions }}</span>
        </div>
        <div class="stat-row">
          <span class="label">PPT回传</span>
          <span class="value">{{ item.ppts }}</span>
        </div>
        <div class="stat-row">
          <span class="label">关心问题</span>
          <span class="value">{{ item.questions }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { getProductNumberColor } from '../constants/salesConfig'

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

const handleSelectProduct = (productCode) => {
  // 传递 product code 而不是 name
  emit('select-product', productCode)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

