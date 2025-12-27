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
        <el-menu-item index="video"><i class="ri-video-on-ai-line"></i> 交流会议·音频</el-menu-item>
        <el-menu-item index="qa"><i class="ri-heart-2-line"></i> 客户关心问题</el-menu-item>
        <el-menu-item index="materials"><i class="ri-git-repository-line"></i> 宣传物料</el-menu-item>
        <el-menu-item index="ai-ppt"><i class="ri-quill-pen-ai-line"></i> AI PPT</el-menu-item>
      </el-menu>
      <div class="header-actions">
        <div class="user">
          <el-link :underline="false" @click="goToProfile"><i class="ri-user-2-line" style="margin-right:4px"></i> 用户名</el-link>
          <el-divider direction="vertical" />
          <el-link type="danger" :underline="false"><i class="ri-logout-circle-r-line" style="margin-right:4px"></i> 退出</el-link>
        </div>
      </div>
    </header>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const activeNav = computed(() => {
  const name = route.name
  if (name === 'SalesHome') {
    return route.query.nav || 'recommend'
  }
  if (name === 'SalesProduct') return 'ppt'
  if (name === 'SalesQA') return 'qa'
  return 'recommend'
})

const handleNav = (key) => {
  if (key === 'qa') {
    router.push('/sales/qa')
  } else if (key === 'ppt' || key === 'video' || key === 'materials' || key === 'recommend') {
    router.push({ path: '/sales/home', query: { nav: key } })
  } else if (key === 'ai-ppt') {
    router.push('/ppt/editor')
  }
}

const goToProfile = () => {
  router.push('/sales/profile')
}
</script>

<style scoped>
</style>


