<template>
  <div class="practical-block card-block">
    <div class="section-head"><h3>实战版</h3></div>
    <div class="ppt-groups">
      <!-- 概览模式：显示文件列表 -->
      <div v-if="activeCatalogIds.length === 0" class="customer-group">
        <div 
          v-for="p in flatPracticalFiles" 
          :key="p.id" 
          v-show="p.type === 'file'" 
          class="ppt-item"
        >
          <i class="ri-file-ppt-2-fill" style="color: #FD6330; font-size: 18px;"></i>
          <span class="title" style="cursor:pointer;" @click="handleOpenPpt(p)">{{ p.title }}</span>
          <div class="meta-right">
            <span class="author">{{ p.author }}</span>
            <span class="date">{{ p.date }}</span>
          </div>
        </div>
      </div>
      
      <!-- 选中目录：按客户分组显示 -->
      <template v-else>
        <div v-for="group in practicalPPTData" :key="group.customer" class="customer-group">
          <!-- 机构信息标题行 -->
          <div class="customer-title">
            <span>{{ group.customer }}</span>
            <span class="customer-meta">{{ group.meta }}</span>
          </div>
          
          <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
          <template v-if="activeCatalogIds.length === 1">
            <div 
              v-for="p in group.items" 
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
          
          <!-- 选择多个二级目录：合并所有图片 -->
          <template v-else>
            <div class="ppt-slides-scroll">
              <div 
                v-for="(slide, index) in getMergedSlidesForGroup(group)" 
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
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, inject } from 'vue'
import { Document } from '@element-plus/icons-vue'

const props = defineProps({
  practicalPPTData: {
    type: Array,
    default: () => []
  },
  activeCatalogIds: {
    type: Array,
    default: () => []
  },
  getMergedSlidesForGroup: {
    type: Function,
    default: () => () => []
  }
})

// 注入dialogs composable
const dialogs: any = inject('dialogs')

// 扁平化实战版文件列表（用于概览模式）
const flatPracticalFiles = computed(() => {
  const files: any[] = []
  props.practicalPPTData.forEach((group: any) => {
    group.items.forEach((item: any) => {
      files.push(item)
    })
  })
  return files
})

const handleOpenPpt = (ppt: any) => {
  if (dialogs) {
    dialogs.openPpt(ppt)
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

