<template>
  <div class="sales-platform">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'

// 售前平台 Layout 组件
// 通过 .sales-platform 类实现样式隔离

// 添加类名以启用body滚动
onMounted(() => {
  document.documentElement.classList.add('sales-platform-active')
  document.body.classList.add('sales-platform-active')
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('sales-platform-active')
  document.body.classList.remove('sales-platform-active')
})
</script>




