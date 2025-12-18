<template>
  <div class="template-selector">
    <!-- 模板库选择 -->
    <div class="template-catalog">
      <div class="catalog-label">选择模板库：</div>
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
      <span class="filter-text" v-if="itemCount">精确匹配 {{ itemCount }} 个要点</span>
    </div>
    
    <!-- 分页指示 -->
    <div class="page-indicator" v-if="!loading && totalPages > 1">
      <button class="page-btn" @click="prevPage" :disabled="currentPage === 1">‹</button>
      <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
      <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">›</button>
    </div>
    
    <!-- 模板网格 - 使用真实缩略图 -->
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
          :size="160"
        />
        <div class="check-icon" v-if="selectedId === slide.id">✓</div>
        <div class="item-count-badge" v-if="getSlideItemCount(slide) > 0">
          {{ getSlideItemCount(slide) }}项
        </div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div class="empty" v-if="!loading && filteredTemplates.length === 0">
      <div class="empty-icon">📭</div>
      <div class="empty-text">
        该模板库中没有符合条件的页面
        <br/>
        <span class="empty-hint" v-if="slideType">
          需要「{{ getTypeName(slideType) }}」类型
          <span v-if="itemCount">，且精确 {{ itemCount }} 个要点</span>
        </span>
      </div>
      <div class="empty-tip">试试切换其他模板库</div>
    </div>
    
    <!-- 确认按钮 -->
    <div class="actions" v-if="!loading && filteredTemplates.length > 0">
      <button class="confirm-btn" @click="confirmSelect" :disabled="!selectedId">
        确认更换样式
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

const props = defineProps<{
  slideType?: string    // 当前页面类型（必须匹配）
  itemCount?: number    // 当前页面的items数量（模板必须 >= 此值）
}>()

const emit = defineEmits<{
  (e: 'select', template: Slide): void
}>()

const loading = ref(false)
const templateList = ref<TemplateInfo[]>([])
const activeCatalogId = ref('')
const catalogSlides = ref<Slide[]>([])
const selectedId = ref<string | null>(null)
const currentPage = ref(1)
const pageSize = 4

// 页面类型名称映射
const getTypeName = (type: string): string => {
  const names: Record<string, string> = {
    cover: '封面页',
    contents: '目录页',
    transition: '过渡页',
    content: '内容页',
    end: '结束页',
    text_image: '图文页',
    comparison: '对比页',
    timeline: '时间线页',
    statistics: '数据页',
    quote: '引用页',
  }
  return names[type] || type
}

// 筛选符合条件的模板页面
const filteredTemplates = computed(() => {
  if (!catalogSlides.value.length) return []
  
  return catalogSlides.value.filter(slide => {
    // 1. 类型必须匹配
    if (props.slideType && slide.type !== props.slideType) {
      return false
    }
    
    // 2. items数量必须精确匹配（确保完美填充，无空槽位）
    if (props.itemCount !== undefined && props.itemCount > 0) {
      const slideItemCount = getSlideItemCount(slide)
      if (slideItemCount !== props.itemCount) {
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
  }
}

const nextPage = () => {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
    selectedId.value = null
  }
}

// 切换模板库
const changeCatalog = async (id: string) => {
  if (loading.value || activeCatalogId.value === id) return
  
  loading.value = true
  activeCatalogId.value = id
  selectedId.value = null
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
  selectedId.value = slide.id
}

// 确认选择
const confirmSelect = () => {
  const selected = filteredTemplates.value.find(t => t.id === selectedId.value)
  if (selected) {
    emit('select', selected)
  }
}

// 监听筛选条件变化时重置分页
watch([() => props.slideType, () => props.itemCount], () => {
  currentPage.value = 1
  selectedId.value = null
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
.template-selector {
  // 主题变量
  --text-primary: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-primary: #fff;
  --bg-secondary: #fafafa;
  --bg-tertiary: #f5f7fa;
  --border-color: #e0e0e0;
  --border-hover: #667eea;
  
  @media (prefers-color-scheme: dark) {
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-tertiary: #808080;
    --bg-primary: #2a2a2a;
    --bg-secondary: #252525;
    --bg-tertiary: #1e1e1e;
    --border-color: #444;
    --border-hover: #667eea;
  }
  
  margin-top: 8px;
}

.template-catalog {
  margin-bottom: 12px;
  
  .catalog-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }
  
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
  margin-bottom: 10px;
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  
  .filter-badge {
    padding: 2px 8px;
    background: #667eea;
    color: #fff;
    font-size: 11px;
    border-radius: 4px;
  }
  
  .filter-text {
    font-size: 12px;
    color: var(--text-secondary);
  }
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px;
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
    font-size: 13px;
    color: var(--text-secondary);
  }
}

.page-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 10px;
  
  .page-btn {
    width: 26px;
    height: 26px;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 14px;
    
    &:hover:not(:disabled) {
      border-color: #667eea;
      color: #667eea;
    }
    
    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  }
  
  .page-info {
    font-size: 12px;
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
    background: var(--bg-secondary);
    
    &:hover {
      border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
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
      right: 6px;
      bottom: 6px;
      width: 22px;
      height: 22px;
      background: #52c41a;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: bold;
    }
    
    .item-count-badge {
      position: absolute;
      left: 6px;
      top: 6px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.6);
      color: #fff;
      font-size: 10px;
      border-radius: 3px;
    }
  }
}

.empty {
  padding: 30px 20px;
  text-align: center;
  
  .empty-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .empty-text {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  
  .empty-hint {
    font-size: 12px;
    color: var(--text-tertiary);
  }
  
  .empty-tip {
    margin-top: 10px;
    font-size: 12px;
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
    font-size: 14px;
    cursor: pointer;
    transition: background 0.2s;
    
    &:hover:not(:disabled) {
      background: #45a617;
    }
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}
</style>
