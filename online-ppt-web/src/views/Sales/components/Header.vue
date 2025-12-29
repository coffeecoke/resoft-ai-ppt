<template>
  <div class="header-wrapper">
    <header class="header">
      <div class="brand">
        <img src="https://dummyimage.com/28x28/6aa1ff/ffffff&text=L" alt="logo" />
        <span>售前平台</span>
      </div>
      <el-menu :default-active="activeNav" mode="horizontal" class="nav" @select="handleNav">
        <el-menu-item index="recommend"><i class="ri-home-4-line"></i> 推荐</el-menu-item>
        <el-menu-item index="ppt"><i class="ri-file-ppt-2-line"></i> 产品介绍PPT</el-menu-item>
        <el-menu-item index="video"><i class="ri-video-on-ai-line"></i> 交流会议</el-menu-item>
        <el-menu-item index="tender"><i class="ri-file-list-3-line"></i> 招投标</el-menu-item>
        <el-menu-item index="qa"><i class="ri-heart-2-line"></i> 客户关心问题</el-menu-item>
        <el-menu-item index="materials"><i class="ri-git-repository-line"></i> 宣传物料</el-menu-item>
      </el-menu>
      <div class="header-actions">
        <div class="user">
          <el-link :underline="false" @click="openPendingDrawer">
            <i class="ri-list-check-3" style="margin-right:4px"></i> 待操作
            <span v-if="pendingCount > 0" class="pending-count-badge">{{ pendingCount }}</span>
          </el-link>
          <el-divider direction="vertical" />
          <el-link :underline="false" @click="goToProfile"><i class="ri-user-2-line" style="margin-right:4px"></i> 用户名</el-link>
          <el-divider direction="vertical" />
          <el-link type="danger" :underline="false"><i class="ri-logout-circle-r-line" style="margin-right:4px"></i> 退出</el-link>
        </div>
      </div>
    </header>
    <PendingOperationsDrawer v-model:visible="pendingDrawerVisible" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'
import PendingOperationsDrawer from './PendingOperationsDrawer.vue'

const route = useRoute()
const router = useRouter()
const pendingStore = usePendingOperationsStore()

const pendingDrawerVisible = ref(false)

// 待操作数量
const pendingCount = computed(() => pendingStore.pendingList.length)

const activeNav = computed(() => {
  const name = route.name
  if (name === 'Home') {
    // 如果有nav参数，使用参数值，否则默认recommend
    return route.query.nav || 'recommend'
  }
  if (name === 'Product') return 'ppt'
  if (name === 'QA') return 'qa'
  return 'recommend'
})

const handleNav = (key) => {
  if (key === 'qa') {
    router.push('/sales/qa')
  } else if (key === 'ppt' || key === 'video' || key === 'materials' || key === 'recommend' || key === 'tender') {
    router.push({ path: '/', query: { nav: key } })
  }
}

const goToProfile = () => {
  router.push('/sales/profile')
}

const openPendingDrawer = () => {
  pendingDrawerVisible.value = true
}
</script>

<style scoped>
</style>

