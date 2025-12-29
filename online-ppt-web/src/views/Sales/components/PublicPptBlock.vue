<template>
  <div class="public-block card-block">
    <div class="section-head"><h3>公共版</h3></div>
    <div class="ppt-groups" :class="{'ppt-summary-grid': activeCatalogIds.length === 0}">
      <!-- 概览模式：显示PPT封面卡片 -->
      <template v-if="activeCatalogIds.length === 0">
        <div 
          v-for="p in publicPPTData" 
          :key="p.id" 
          class="ppt-card" 
          @click="handleOpenPpt(p)" 
          style="cursor:pointer;" 
          v-show="p.type === 'ppt-cover'"
        >
          <div class="thumb"><img :src="p.thumbnail" :alt="p.title" /></div>
          <div class="meta">
            <div class="title">{{ p.title }}</div>
            <div class="sub">{{ p.date }} · {{ p.author }}</div>
          </div>
        </div>
      </template>
      
      <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
      <template v-else-if="activeCatalogIds.length === 1">
        <div 
          v-for="p in publicPPTData" 
          :key="p.id" 
          v-show="p.type === 'slides'" 
          class="ppt-group-item"
        >
          <div class="ppt-group-header">
            <div class="ppt-group-title" @click="handleOpenPpt(p)" style="cursor:pointer">
              <el-icon><Document /></el-icon> {{ p.title }}
            </div>
            <div class="ppt-group-meta">{{ p.date }} · {{ p.author }}</div>
          </div>
          <div class="ppt-slides-scroll">
            <div 
              v-for="slide in p.slides" 
              :key="slide.id" 
              class="slide-card" 
              @click="handleOpenPpt(p)"
            >
              <img :src="slide.img" loading="lazy" />
              <div class="slide-page-num">P{{ slide.page }}</div>
            </div>
          </div>
        </div>
      </template>
      
      <!-- 选择多个二级目录：合并所有图片，按顺序一行一行排列 -->
      <template v-else>
        <div class="ppt-slides-scroll">
          <div 
            v-for="(slide, index) in mergedSlides" 
            :key="slide.id || index" 
            class="slide-card" 
            @click="handleOpenPpt(slide.parent)"
          >
            <img :src="slide.img" loading="lazy" />
            <div class="slide-page-num">P{{ slide.page }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, inject } from 'vue'
import { Document } from '@element-plus/icons-vue'

const props = defineProps({
  publicPPTData: {
    type: Array,
    default: () => []
  },
  activeCatalogIds: {
    type: Array,
    default: () => []
  },
  mergedSlides: {
    type: Array,
    default: () => []
  }
})

// 注入dialogs composable
const dialogs: any = inject('dialogs')

const handleOpenPpt = (ppt: any) => {
  if (dialogs) {
    dialogs.openPpt(ppt)
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

