<template>
  <RouterView />
</template>

<script lang="ts" setup>
// 平台层应用入口，只保留全局基础功能
// PPT相关业务逻辑已迁移到 src/views/PPT/Layout.vue

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