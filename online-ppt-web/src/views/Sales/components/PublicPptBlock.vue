<template>
  <div class="public-block card-block">
    <div class="section-head"><h3>公共版</h3></div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="ppt-groups" :class="{'ppt-summary-grid': activeCatalogCodes.length === 0}">
      <!-- 未选目录：显示PPT封面卡片 -->
      <template v-if="activeCatalogCodes.length === 0">
        <div 
          v-for="doc in publicDocuments" 
          :key="doc.id" 
          class="ppt-card" 
          @click="handleOpenDocument(doc)" 
          style="cursor:pointer;"
        >
          <div class="thumb">
            <img 
              :src="doc.cover || 'https://via.placeholder.com/320x180?text=PPT'" 
              :alt="doc.name" 
            />
          </div>
          <div class="meta">
            <div class="title">{{ doc.name }}</div>
            <div class="sub">{{ formatDate(doc.createdAt) }}</div>
          </div>
        </div>
        <div v-if="publicDocuments.length === 0" class="empty-state">
          暂无公共版文档
        </div>
      </template>
      
      <!-- 选择单个二级目录：按文档分组显示 -->
      <template v-else-if="activeCatalogCodes.length === 1">
        <div 
          v-for="group in groupedThumbnails" 
          :key="group.documentId" 
          class="ppt-group-item"
        >
          <div class="ppt-group-header">
            <div class="ppt-group-title" @click="handleOpenDocument(group.document)" style="cursor:pointer">
              <el-icon><Document /></el-icon> {{ group.document.name }}
            </div>
            <div class="ppt-group-meta">{{ formatDate(group.document.createdAt) }}</div>
          </div>
          <div class="ppt-slides-scroll">
            <div 
              v-for="thumb in group.thumbnails" 
              :key="thumb.id" 
              class="slide-card" 
              @click="handleOpenDocument(group.document)"
            >
              <img :src="thumb.url" loading="lazy" :alt="`${group.document.name} - 第${thumb.slideIndex + 1}页`" />
              <div class="slide-page-num">P{{ thumb.slideIndex + 1 }}</div>
            </div>
          </div>
        </div>
        <div v-if="groupedThumbnails.length === 0" class="empty-state">
          该目录下暂无内容
        </div>
      </template>
      
      <!-- 选择多个二级目录：合并所有缩略图 -->
      <template v-else>
        <div class="ppt-slides-scroll">
          <div 
            v-for="(thumb, index) in mergedThumbnails" 
            :key="thumb.id || index" 
            class="slide-card" 
            @click="handleOpenDocument(thumb.document)"
          >
            <img :src="thumb.url" loading="lazy" :alt="`${thumb.document.name} - 第${thumb.slideIndex + 1}页`" />
            <div class="slide-page-num">P{{ thumb.slideIndex + 1 }}</div>
          </div>
        </div>
        <div v-if="mergedThumbnails.length === 0" class="empty-state">
          所选目录下暂无内容
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { Document } from '@element-plus/icons-vue'
import type { DocumentInfo, ThumbnailInfo } from '@/services/productCatalogService'

const props = defineProps({
  publicDocuments: {
    type: Array as () => DocumentInfo[],
    default: () => []
  },
  publicThumbnails: {
    type: Array as () => ThumbnailInfo[],
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

// 按文档分组的缩略图（单选模式）
const groupedThumbnails = computed(() => {
  if (props.activeCatalogCodes.length !== 1) return []
  
  const groupsMap = new Map<string, {
    documentId: string
    document: { id: string; name: string; createdAt: string }
    thumbnails: ThumbnailInfo[]
  }>()
  
  props.publicThumbnails.forEach(thumb => {
    const docId = thumb.document.id
    if (!groupsMap.has(docId)) {
      groupsMap.set(docId, {
        documentId: docId,
        document: {
          id: thumb.document.id,
          name: thumb.document.name,
          createdAt: thumb.document.createdAt
        },
        thumbnails: []
      })
    }
    groupsMap.get(docId)!.thumbnails.push(thumb)
  })
  
  // 按文档创建时间排序，缩略图按slideIndex排序
  return Array.from(groupsMap.values())
    .map(group => ({
      ...group,
      thumbnails: group.thumbnails.sort((a, b) => a.slideIndex - b.slideIndex)
    }))
    .sort((a, b) => new Date(b.document.createdAt).getTime() - new Date(a.document.createdAt).getTime())
})

// 合并的缩略图（多选模式）
const mergedThumbnails = computed(() => {
  if (props.activeCatalogCodes.length <= 1) return []
  
  // 按文档排序，然后按slideIndex排序
  return [...props.publicThumbnails].sort((a, b) => {
    const docCompare = a.document.name.localeCompare(b.document.name)
    if (docCompare !== 0) return docCompare
    return a.slideIndex - b.slideIndex
  })
})

const handleOpenDocument = (doc: any) => {
  if (dialogs && doc) {
    // 构造PPT对象，兼容现有的openPpt方法
    const pptData = {
      id: doc.id,
      title: doc.name,
      cover: doc.cover,
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

