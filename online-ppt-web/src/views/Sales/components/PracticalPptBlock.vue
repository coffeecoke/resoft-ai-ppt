<template>
  <div class="practical-block card-block">
    <div class="section-head"><h3>实战版</h3></div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="ppt-groups">
      <!-- 未选目录：显示文件列表 -->
      <div v-if="activeCatalogCodes.length === 0" class="customer-group">
        <div 
          v-for="doc in practicalDocuments" 
          :key="doc.id" 
          class="ppt-item"
        >
          <i class="ri-file-ppt-2-fill" style="color: #FD6330; font-size: 18px;"></i>
          <span class="title" style="cursor:pointer;" @click="handleOpenDocument(doc)">
            {{ doc.name }}
          </span>
          <div class="meta-right">
            <span class="author">{{ doc.customerName || '未分类' }}</span>
            <span class="date">{{ formatDate(doc.createdAt) }}</span>
          </div>
        </div>
        <div v-if="practicalDocuments.length === 0" class="empty-state">
          暂无实战版文档
        </div>
      </div>
      
      <!-- 选中目录：按客户分组显示 -->
      <template v-else>
        <div v-for="group in practicalThumbnailGroups" :key="group.customer" class="customer-group">
          <!-- 机构信息标题行 -->
          <div class="customer-title">
            <span>{{ group.customer }}</span>
            <span v-if="group.meta" class="customer-meta">{{ group.meta }}</span>
          </div>
          
          <!-- 选择单个二级目录：按PPT分组显示 -->
          <template v-if="activeCatalogCodes.length === 1">
            <div 
              v-for="doc in group.documents" 
              :key="doc.id" 
              class="ppt-group-item"
            >
              <div class="ppt-group-header">
                <div class="ppt-group-title" @click="handleOpenDocument(doc)" style="cursor:pointer">
                  <el-icon><Document /></el-icon> {{ doc.name }}
                </div>
                <div class="ppt-group-meta">
                  {{ formatDate(doc.createdAt) }}
                  <span v-if="doc.audienceNames"> · {{ doc.audienceNames }}</span>
                </div>
              </div>
              <div class="ppt-slides-scroll">
                <div 
                  v-for="thumb in doc.thumbnails" 
                  :key="thumb.id" 
                  class="slide-card" 
                  @click="handleOpenDocument(doc)"
                >
                  <img :src="thumb.url" loading="lazy" :alt="`${doc.name} - 第${thumb.slideIndex + 1}页`" />
                  <div class="slide-page-num">P{{ thumb.slideIndex + 1 }}</div>
                </div>
              </div>
            </div>
          </template>
          
          <!-- 选择多个二级目录：合并该客户下所有缩略图 -->
          <template v-else>
            <div class="ppt-slides-scroll">
              <div 
                v-for="(thumb, index) in getMergedThumbnailsForGroup(group)" 
                :key="thumb.id || index" 
                class="slide-card" 
                @click="handleOpenDocument(thumb.document)"
              >
                <img :src="thumb.url" loading="lazy" :alt="`${thumb.document.name} - 第${thumb.slideIndex + 1}页`" />
                <div class="slide-page-num">P{{ thumb.slideIndex + 1 }}</div>
              </div>
            </div>
          </template>
        </div>
        <div v-if="practicalThumbnailGroups.length === 0" class="empty-state">
          所选目录下暂无内容
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { Document } from '@element-plus/icons-vue'
import type { DocumentInfo, CustomerGroup } from '@/services/productCatalogService'

const props = defineProps({
  practicalDocuments: {
    type: Array as () => DocumentInfo[],
    default: () => []
  },
  practicalThumbnailGroups: {
    type: Array as () => CustomerGroup[],
    default: () => []
  },
  activeCatalogCodes: {
    type: Array as () => string[],
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

// 注入dialogs composable
const dialogs: any = inject('dialogs')

// 格式化日期
const formatDate = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

// 获取合并的缩略图（多选模式，按客户分组）
const getMergedThumbnailsForGroup = (group: CustomerGroup) => {
  const merged: Array<{
    id: string
    url: string
    slideIndex: number
    document: { id: string; name: string }
  }> = []
  
  group.documents.forEach(doc => {
    doc.thumbnails.forEach(thumb => {
      merged.push({
        id: thumb.id,
        url: thumb.url,
        slideIndex: thumb.slideIndex,
        document: {
          id: doc.id,
          name: doc.name
        }
      })
    })
  })
  
  // 按文档排序，然后按slideIndex排序
  return merged.sort((a, b) => {
    const docCompare = a.document.name.localeCompare(b.document.name)
    if (docCompare !== 0) return docCompare
    return a.slideIndex - b.slideIndex
  })
}

const handleOpenDocument = (doc: any) => {
  if (dialogs && doc) {
    // 构造PPT对象，兼容现有的openPpt方法
    const pptData = {
      id: doc.id,
      title: doc.name,
      cover: doc.cover,
      customerName: doc.customerName,
      slides: [] // 如果需要显示详情，可能需要加载完整数据
    }
    dialogs.openPpt(pptData)
  }
}
</script>

<style scoped>
.loading {
  padding: 20px;
  text-align: center;
  color: #999;
}
.empty-state {
  padding: 40px;
  text-align: center;
  color: #999;
}
</style>

<style scoped>
/* 样式继承自 sales.scss */
</style>

