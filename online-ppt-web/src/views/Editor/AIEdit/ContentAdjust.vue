<template>
  <div class="content-adjust">
    <!-- 调整信息 -->
    <div class="adjust-info">
      <span class="badge" :class="adjustType">
        {{ adjustType === 'decrease' ? '减少' : '增加' }}
      </span>
      <span class="count-change">
        {{ originalCount }} → {{ count }} 项
      </span>
    </div>
    
    <!-- 内容预览 -->
    <div class="items-preview">
      <div class="item" v-for="(item, index) in items" :key="index">
        <span class="item-num">{{ index + 1 }}</span>
        <div class="item-content">
          <div class="item-title">{{ getItemTitle(item) }}</div>
          <div class="item-text" v-if="getItemText(item)">{{ getItemText(item) }}</div>
        </div>
      </div>
    </div>
    
    <!-- 分隔线 -->
    <div class="divider">
      <span class="divider-text">选择匹配的模板样式</span>
    </div>
    
    <!-- 模板库选择 -->
    <div class="template-catalog">
      <div class="catalog-list">
        <div 
          v-for="tpl in templateList" 
          :key="tpl.id"
          :class="['catalog-item', { active: activeCatalogId === tpl.id }]"
          @click="changeCatalog(tpl.id)"
        >
          {{ tpl.name }}
        </div>
      </div>
    </div>
    
    <!-- 加载中 -->
    <div class="loading" v-if="loading">
      <span class="loading-dot">●</span>
      <span class="loading-dot">●</span>
      <span class="loading-dot">●</span>
      <span class="loading-text">加载模板中...</span>
    </div>
    
    <!-- 筛选信息 -->
    <div class="filter-info" v-if="!loading && slideType">
      <span class="filter-badge">{{ getTypeName(slideType) }}</span>
      <span class="filter-text">精确匹配 {{ count }} 个要点</span>
    </div>
    
    <!-- 分页指示 -->
    <div class="page-indicator" v-if="!loading && totalPages > 1">
      <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">‹</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">›</button>
    </div>
    
    <!-- 模板网格 -->
    <div class="template-grid" v-if="!loading && currentPageTemplates.length > 0">
      <div
        v-for="slide in currentPageTemplates"
        :key="slide.id"
        :class="['template-item', { selected: selectedId === slide.id }]"
        @click="selectTemplate(slide)"
      >
        <ThumbnailSlide 
          class="thumbnail" 
          :slide="slide" 
          :size="140"
        />
        <div class="check-icon" v-if="selectedId === slide.id">✓</div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div class="empty" v-if="!loading && filteredTemplates.length === 0">
      <div class="empty-icon">📭</div>
      <div class="empty-text">
        该模板库中没有匹配的页面
        <br/>
        <span class="empty-hint">试试切换其他模板库</span>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="actions" v-if="!loading">
      <button 
        class="confirm-btn" 
        @click="handleConfirm" 
        :disabled="!selectedId && filteredTemplates.length > 0"
      >
        {{ selectedId ? '应用调整并更换样式' : '仅应用内容调整' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { Slide } from '@/types/slides'
import { 
  getTemplateList, 
  getTemplateSlides, 
  getSlideItemCount,
  type TemplateInfo 
} from '@/services/templateService'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'

type ItemType = string | { title?: string; text?: string }

const props = defineProps<{
  items?: ItemType[]
  count?: number
  originalCount?: number
  slideType?: string
}>()

const emit = defineEmits<{
  (e: 'confirm', data: { items: ItemType[], template?: Slide }): void
}>()

// 模板相关状态
const loading = ref(false)
const templateList = ref<TemplateInfo[]>([])
const activeCatalogId = ref('')
const catalogSlides = ref<Slide[]>([])
const selectedId = ref<string | null>(null)
const selectedTemplate = ref<Slide | null>(null)
const currentPage = ref(1)
const pageSize = 4

// 调整类型
const adjustType = computed(() => {
  if (!props.originalCount || !props.count) return 'decrease'
  return props.count < props.originalCount ? 'decrease' : 'increase'
})

// 页面类型名称映射
const getTypeName = (type: string): string => {
  const names: Record<string, string> = {
    cover: '封面页',
    contents: '目录页',
    transition: '过渡页',
    content: '内容页',
    end: '结束页',
  }
  return names[type] || type
}

// 获取项目标题
const getItemTitle = (item: ItemType) => {
  if (typeof item === 'string') return item
  return item.title || ''
}

// 获取项目文本
const getItemText = (item: ItemType) => {
  if (typeof item === 'string') return ''
  return item.text || ''
}

// 筛选符合条件的模板页面（精确匹配 items 数量）
const filteredTemplates = computed(() => {
  if (!catalogSlides.value.length) return []
  
  return catalogSlides.value.filter(slide => {
    // 1. 类型必须匹配
    if (props.slideType && slide.type !== props.slideType) {
      return false
    }
    
    // 2. items数量必须精确匹配新的数量
    if (props.count !== undefined && props.count > 0) {
      const slideItemCount = getSlideItemCount(slide)
      if (slideItemCount !== props.count) {
        return false
      }
    }
    
    return true
  })
})

// 分页计算
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTemplates.value.length / pageSize)))

const currentPageTemplates = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredTemplates.value.slice(start, start + pageSize)
})

// 翻页
const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
    selectedId.value = null
    selectedTemplate.value = null
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    selectedId.value = null
    selectedTemplate.value = null
  }
}

// 切换模板库
const changeCatalog = async (id: string) => {
  if (loading.value || activeCatalogId.value === id) return
  
  loading.value = true
  activeCatalogId.value = id
  selectedId.value = null
  selectedTemplate.value = null
  currentPage.value = 1
  
  try {
    catalogSlides.value = await getTemplateSlides(id)
  } catch (error) {
    console.error('加载模板失败:', error)
    catalogSlides.value = []
  } finally {
    loading.value = false
  }
}

// 选择模板
const selectTemplate = (slide: Slide) => {
  if (selectedId.value === slide.id) {
    // 取消选择
    selectedId.value = null
    selectedTemplate.value = null
  } else {
    selectedId.value = slide.id
    selectedTemplate.value = slide
  }
}

// 确认调整
const handleConfirm = () => {
  emit('confirm', {
    items: props.items || [],
    template: selectedTemplate.value || undefined,
  })
}

// 监听筛选条件变化时重置分页
watch([() => props.slideType, () => props.count], () => {
  currentPage.value = 1
  selectedId.value = null
  selectedTemplate.value = null
})

// 初始化
onMounted(async () => {
  // 获取模板列表
  templateList.value = await getTemplateList()
  
  // 加载第一个模板库
  if (templateList.value.length > 0) {
    changeCatalog(templateList.value[0].id)
  }
})
</script>

<style lang="scss" scoped>
.content-adjust {
  // 主题变量
  --text-primary: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-primary: #fff;
  --bg-secondary: #f0f0f0;
  --bg-tertiary: #fafafa;
  --bg-quaternary: #f5f7fa;
  --border-color: #e0e0e0;
  --border-light: #f0f0f0;
  --border-hover: #667eea;
  
  @media (prefers-color-scheme: dark) {
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-tertiary: #808080;
    --bg-primary: #2a2a2a;
    --bg-secondary: #333;
    --bg-tertiary: #252525;
    --bg-quaternary: #1e1e1e;
    --border-color: #444;
    --border-light: #3a3a3a;
    --border-hover: #667eea;
  }
  
  margin-top: 8px;
}

.adjust-info {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  
  .badge {
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    
    &.decrease {
      background: #fff2e8;
      color: #fa541c;
    }
    
    &.increase {
      background: #e6f7ff;
      color: #1890ff;
    }
  }
  
  .count-change {
    font-size: 14px;
    color: var(--text-primary);
    font-weight: 500;
  }
}

.items-preview {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
  max-height: 150px;
  overflow-y: auto;
  
  .item {
    display: flex;
    gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border-light);
    
    &:last-child {
      border-bottom: none;
    }
    
    .item-num {
      width: 20px;
      height: 20px;
      background: #667eea;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      flex-shrink: 0;
    }
    
    .item-content {
      flex: 1;
      min-width: 0;
      
      .item-title {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .item-text {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}

.divider {
  display: flex;
  align-items: center;
  margin: 16px 0 12px;
  
  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border-color);
  }
  
  .divider-text {
    padding: 0 12px;
    font-size: 12px;
    color: var(--text-tertiary);
  }
}

.template-catalog {
  margin-bottom: 10px;
  
  .catalog-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .catalog-item {
    padding: 4px 10px;
    font-size: 12px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-primary);
    color: var(--text-primary);
    
    &:hover {
      border-color: var(--border-hover);
    }
    
    &.active {
      background: #667eea;
      border-color: #667eea;
      color: #fff;
    }
  }
}

.filter-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: var(--bg-quaternary);
  border-radius: 6px;
  
  .filter-badge {
    padding: 2px 6px;
    background: #667eea;
    color: #fff;
    font-size: 10px;
    border-radius: 3px;
  }
  
  .filter-text {
    font-size: 11px;
    color: var(--text-secondary);
  }
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  gap: 4px;
  
  .loading-dot {
    font-size: 10px;
    color: #667eea;
    animation: blink 1.4s infinite;
    
    &:nth-child(2) { animation-delay: 0.2s; }
    &:nth-child(3) { animation-delay: 0.4s; }
  }
  
  .loading-text {
    margin-left: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.page-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 8px;
  
  .page-btn {
    width: 24px;
    height: 24px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 12px;
    
    &:hover:not(:disabled) {
      border-color: var(--border-hover);
      color: #667eea;
    }
    
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
  
  .page-info {
    font-size: 11px;
    color: var(--text-secondary);
  }
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  
  .template-item {
    position: relative;
    border: 2px solid var(--border-color);
    border-radius: 6px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--bg-tertiary);
    
    &:hover {
      border-color: var(--border-hover);
    }
    
    &.selected {
      border-color: #52c41a;
      box-shadow: 0 2px 8px rgba(82, 196, 26, 0.3);
    }
    
    .thumbnail {
      width: 100%;
      display: block;
    }
    
    .check-icon {
      position: absolute;
      right: 4px;
      bottom: 4px;
      width: 18px;
      height: 18px;
      background: #52c41a;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: bold;
    }
  }
}

.empty {
  padding: 20px;
  text-align: center;
  
  .empty-icon {
    font-size: 24px;
    margin-bottom: 6px;
  }
  
  .empty-text {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  
  .empty-hint {
    font-size: 11px;
    color: #667eea;
  }
}

.actions {
  margin-top: 12px;
  
  .confirm-btn {
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 6px;
    background: #52c41a;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover:not(:disabled) {
      background: #45a617;
    }
    
    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--bg-secondary);
      color: var(--text-tertiary);
    }
  }
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}
</style>
