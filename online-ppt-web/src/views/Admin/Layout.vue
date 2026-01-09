<template>
  <div class="admin-layout">
    <Sidebar ref="sidebarRef" />
    <div class="main-container" :style="{ marginLeft: isCollapsed ? '64px' : '200px' }">
      <Header ref="headerRef" @toggle-sidebar="handleToggleSidebar" />
      <div class="content-wrapper">
        <RouterView />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import Sidebar from './components/Sidebar.vue'
import Header from './components/Header.vue'

const sidebarRef = ref<InstanceType<typeof Sidebar>>()
const headerRef = ref<InstanceType<typeof Header>>()

const isCollapsed = ref(false)

// 切换侧边栏
const handleToggleSidebar = (value: boolean) => {
  isCollapsed.value = value
  if (sidebarRef.value) {
    sidebarRef.value.isCollapsed = value
  }
  if (headerRef.value) {
    headerRef.value.isCollapsed = value
  }
}

// 提供给子组件使用
provide('isCollapsed', isCollapsed)
</script>

<style lang="scss" scoped>
.admin-layout {
  height: 100vh;
  overflow: hidden;
  background-color: #f0f2f5;
}

.main-container {
  margin-left: 200px;
  transition: margin-left 0.3s;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.content-wrapper {
  flex: 1;
  overflow: auto;
  padding: 10px;
  margin-top: 60px;
  background-color: #f0f2f5;
}
</style>

