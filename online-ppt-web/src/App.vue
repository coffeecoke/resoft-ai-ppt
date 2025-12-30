<template>
  <RouterView />
  <!-- 全局AI对话抽屉 -->
  <GlobalAiChatDrawer v-model:visible="globalAiChatVisible" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import GlobalAiChatDrawer from '@/components/GlobalAiChatDrawer.vue'

// 平台层应用入口，只保留全局基础功能
// PPT相关业务逻辑已迁移到 src/views/PPT/Layout.vue

// 全局AI对话抽屉显示状态
const globalAiChatVisible = ref(false)

// 开发环境禁用页面关闭提示
if (import.meta.env.MODE !== 'development') {
  window.onbeforeunload = () => false
}
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>