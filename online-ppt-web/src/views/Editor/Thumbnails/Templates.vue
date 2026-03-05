<template>
  <div class="templates">
    <!-- 标签页切换 -->
    <div class="tabs">
      <div 
        class="tab" 
        :class="{ 'active': activeTab === 'template' }"
        @click="switchTab('template')"
      >模板</div>
      <div 
        class="tab" 
        :class="{ 'active': activeTab === 'document' }"
        @click="switchTab('document')"
      >已发布文档</div>
    </div>
    
    <div class="templates-content">
      <div class="catalogs">
        <!-- 模板列表 -->
        <template v-if="activeTab === 'template'">
          <div class="catalog" 
            :class="{ 'active': activeCatalog === item.id }" 
            v-for="item in templates" 
            :key="item.id"
            @click="changeCatalog(item.id)"
          >{{ item.name }}</div>
        </template>
        <!-- 已发布文档列表 -->
        <template v-else>
          <div class="catalog" 
            :class="{ 'active': activeCatalog === item.id }" 
            v-for="item in publishedDocuments" 
            :key="item.id"
            @click="changeCatalog(item.id)"
          >{{ item.name }}</div>
        </template>
      </div>
      
      <div class="content" v-loading="loading" element-loading-text="加载中...">
      <div class="header">
        <div class="types">
          <div class="type" 
            :class="{ 'active': activeType === item.value }"
            v-for="item in types"
            :key="item.value"
            @click="activeType = item.value"
          >{{ item.label }}</div>
        </div>
        <div class="insert-all" @click="insertTemplates(slides)">插入全部</div>
      </div>
      <div class="list" ref="listRef">
        <template v-for="slide in slides" :key="slide.id">
          <div 
            class="slide-item"
            v-if="shouldShowSlide(slide)"
          >
            <ThumbnailSlide class="thumbnail" :slide="slide" :size="180" />
    
            <div class="btns">
              <Button class="btn" type="primary" size="small" @click="insertTemplate(slide)">插入页面</Button>
            </div>
          </div>
        </template>
      </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, useTemplateRef } from 'vue'
import type { Slide, SlideTemplate } from '@/types/slides'
import api from '@/services'
import { getTemplateList, getTemplateSlides } from '@/services/templateService'
import { getDocumentList, getDocument, type DocumentMetadata } from '@/services/documentService'

import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import Button from '@/components/Button.vue'

const emit = defineEmits<{
  (event: 'select', payload: Slide): void
  (event: 'selectAll', payload: Slide[]): void
}>()

// 标签页状态
const activeTab = ref<'template' | 'document'>('template')

// 从后端加载模板列表
const templates = ref<SlideTemplate[]>([])
// 已发布文档列表
const publishedDocuments = ref<DocumentMetadata[]>([])

const slides = ref<Slide[]>([])
const listRef = useTemplateRef<HTMLElement>('listRef')
const types = ref<{
  label: string
  value: string
}[]>([
  { label: '全部', value: 'all' },
  { label: '封面', value: 'cover' },
  { label: '目录', value: 'contents' },
  { label: '过渡', value: 'transition' },
  { label: '内容', value: 'content' },
  { label: '结束', value: 'end' },
])
const activeType = ref('all')

const activeCatalog = ref('')
const loading = ref(false)
const requestId = ref(0) // 用于防止竞态条件

const insertTemplate = (slide: Slide) => {
  emit('select', slide)
}

const insertTemplates = (slides: Slide[]) => {
  emit('selectAll', slides)
}

// 页面筛选逻辑：无类型的页面只在"全部"中显示
const shouldShowSlide = (slide: Slide) => {
  if (activeType.value === 'all') return true
  if (!slide.type || slide.type === '') return false // 无类型的页面不显示在特定类型筛选中
  return slide.type === activeType.value
}

// 切换标签页
const switchTab = (tab: 'template' | 'document') => {
  activeTab.value = tab
  activeCatalog.value = ''
  slides.value = []
  activeType.value = 'all'
  
  if (tab === 'template') {
    // 切换到模板标签页，加载第一个模板
    if (templates.value.length > 0 && templates.value[0]?.id) {
      changeCatalog(templates.value[0].id)
    }
  } else {
    // 切换到文档标签页，加载第一个文档
    if (publishedDocuments.value.length > 0 && publishedDocuments.value[0]?.id) {
      changeCatalog(publishedDocuments.value[0].id)
    }
  }
}

const changeCatalog = async (id: string) => {
  // 生成新的请求ID，用于防止竞态条件
  const currentRequestId = ++requestId.value
  loading.value = true
  activeCatalog.value = id

  try {
    let newSlides: Slide[] = []

    if (activeTab.value === 'template') {
      // 加载模板数据（使用模板服务，会自动处理后端和mock的兼容）
      newSlides = await getTemplateSlides(id)
    } else if (activeTab.value === 'document') {
      // 加载文档数据
      const ret = await getDocument(id)
      newSlides = ret.documentData.slides
    }

    // 检查是否是最新请求，防止竞态条件
    if (currentRequestId !== requestId.value) {
      console.log('[模板面板] 请求已过期，忽略结果')
      return
    }

    slides.value = newSlides
    loading.value = false
    if (listRef.value) listRef.value.scrollTo(0, 0)
  } catch (error) {
    console.error('[模板面板] 加载数据失败:', error)
    // 只有最新请求才更新 loading 状态
    if (currentRequestId === requestId.value) {
      loading.value = false
    }
  }
}

// 加载模板列表
const loadTemplates = async () => {
  try {
    const list = await getTemplateList()
    // 只显示已发布的模板
    templates.value = list
      .filter(item => item.status === 'published')
      .map(item => ({
        id: item.id,
        name: item.name,
        cover: item.cover,
        origin: item.origin,
      }))
    
    // 如果当前在模板标签页，加载第一个模板
    if (activeTab.value === 'template' && templates.value.length > 0 && templates.value[0]?.id) {
      changeCatalog(templates.value[0].id)
    }
  } catch (error) {
    console.error('[模板面板] 加载模板列表失败:', error)
  }
}

// 加载已发布文档列表
const loadPublishedDocuments = async () => {
  try {
    publishedDocuments.value = await getDocumentList({ status: 'published' })
    
    // 如果当前在文档标签页，加载第一个文档
    if (activeTab.value === 'document' && publishedDocuments.value.length > 0 && publishedDocuments.value[0]?.id) {
      changeCatalog(publishedDocuments.value[0].id)
    }
  } catch (error) {
    console.error('[模板面板] 加载已发布文档列表失败:', error)
  }
}

onMounted(async () => {
  // 并行加载模板列表和已发布文档列表
  await Promise.all([loadTemplates(), loadPublishedDocuments()])
})
</script>

<style lang="scss" scoped>
.templates {
  width: 560px;
  height: 500px;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.tabs {
  display: flex;
  border-bottom: 1px solid $borderColor;
  margin-bottom: 10px;
  padding-bottom: 8px;

  .tab {
    flex: 1;
    text-align: center;
    padding: 6px 12px;
    cursor: pointer;
    border-radius: $borderRadius;
    font-size: 13px;
    color: rgba(17, 24, 39, 0.65);
    transition: all 0.2s;

    &:hover {
      background-color: #f5f5f5;
    }

    &.active {
      color: $themeColor;
      background-color: rgba($color: $themeColor, $alpha: 0.1);
      font-weight: 700;
    }

    & + .tab {
      margin-left: 8px;
    }
  }
}

.templates-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.catalogs {
  width: 150px;
  margin-right: 10px;
  padding-right: 10px;
  border-right: 1px solid $borderColor;
  overflow: auto;

  .catalog {
    padding: 7px 8px;
    border-radius: $borderRadius;
    cursor: pointer;

    &:hover {
      background-color: #f5f5f5;
    }

    &.active {
      color: $themeColor;
      background-color: rgba($color: $themeColor, $alpha: .05);
      border-right: 2px solid $themeColor;
      font-weight: 700;
    }

    & + .catalog {
      margin-top: 3px; 
    }
  }
}
.content {
  display: flex;
  flex-direction: column;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-right: 4px;

  &:hover .insert-all {
    opacity: 1;
    transition: opacity $transitionDelay;
  }
}
.types {
  display: flex;

  .type {
    border-radius: $borderRadius;
    padding: 3px 8px;
    font-size: 12px;
    cursor: pointer;

    & +.type {
      margin-left: 4px;
    }

    &.active {
      color: $themeColor;
      background-color: rgba($color: $themeColor, $alpha:.05);
      font-weight: 700;
    }

    &:hover {
      background-color: #f5f5f5;
    }
  }
}
.insert-all {
  opacity: 0;
  font-size: 12px;
  color: $themeColor;
  text-decoration: underline;
  cursor: pointer;
}
.list {
  width: 392px;
  padding: 2px;
  margin-right: -10px;
  padding-right: 10px;
  overflow: auto;
  @include flex-grid-layout();
}
.slide-item {
  position: relative;
  @include flex-grid-layout-children(2, 48%);

  &:hover .btns {
    opacity: 1;
  }

  &:hover .thumbnail {
    outline-color: $themeColor;
  }

  .btns {
    @include absolute-0();

    flex-direction: column;
    justify-content: center;
    align-items: center;
    display: flex;
    background-color: rgba($color: #000, $alpha: .25);
    opacity: 0;
    transition: opacity $transitionDelay;
    border-radius: $borderRadius;
  }

  .thumbnail {
    outline: 2px solid $borderColor;
    transition: outline $transitionDelay;
    border-radius: $borderRadius;
    cursor: pointer;
  }
}
</style>