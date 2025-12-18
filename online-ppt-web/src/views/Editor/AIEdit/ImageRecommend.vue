<template>
  <div class="image-recommend">
    <!-- 搜索输入 -->
    <div class="search-bar" v-if="needInput || showSearch">
      <input
        v-model="searchKeyword"
        placeholder="输入关键词搜索图片"
        @keyup.enter="handleSearch"
      />
      <button @click="handleSearch" :disabled="!searchKeyword.trim()">搜索</button>
    </div>
    
    <!-- 当前关键词 -->
    <div class="current-keyword" v-if="keyword && !needInput">
      <span class="label">关键词：</span>
      <span class="keyword">{{ keyword }}</span>
      <span class="edit-btn" @click="showSearch = true">修改</span>
    </div>
    
    <!-- 图片网格 -->
    <div class="image-grid" v-if="images && images.length > 0">
      <div
        v-for="img in images"
        :key="img.id"
        :class="['image-item', { selected: selectedId === img.id }]"
        @click="selectImage(img)"
      >
        <img :src="img.thumb" :alt="img.alt" loading="lazy" />
        <div class="check-icon" v-if="selectedId === img.id">✓</div>
        <div class="source-badge">{{ img.source }}</div>
      </div>
    </div>
    
    <!-- 空状态 -->
    <div class="empty" v-else-if="!needInput">
      <span>未找到相关图片</span>
    </div>
    
    <!-- 操作按钮 -->
    <div class="actions" v-if="images && images.length > 0">
      <button class="refresh-btn" @click="handleRefresh" :disabled="!hasMore">
        <span>换一批</span>
        <span v-if="!hasMore">(没有更多)</span>
      </button>
      <button class="confirm-btn" @click="confirmSelect" :disabled="!selectedId">
        确认选择
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface ImageItem {
  id: string
  src: string
  thumb: string
  width: number
  height: number
  alt: string
  source: string
  author: string
}

const props = defineProps<{
  images?: ImageItem[]
  keyword?: string
  hasMore?: boolean
  needInput?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', image: ImageItem): void
  (e: 'refresh'): void
  (e: 'search', keyword: string): void
}>()

const selectedId = ref<string | null>(null)
const searchKeyword = ref('')
const showSearch = ref(false)

// 同步关键词
watch(() => props.keyword, (val) => {
  if (val) searchKeyword.value = val
}, { immediate: true })

// 选择图片
const selectImage = (img: ImageItem) => {
  selectedId.value = img.id
}

// 确认选择
const confirmSelect = () => {
  const selected = props.images?.find(img => img.id === selectedId.value)
  if (selected) {
    emit('select', selected)
  }
}

// 换一批
const handleRefresh = () => {
  selectedId.value = null
  emit('refresh')
}

// 搜索
const handleSearch = () => {
  if (searchKeyword.value.trim()) {
    selectedId.value = null
    showSearch.value = false
    emit('search', searchKeyword.value.trim())
  }
}
</script>

<style lang="scss" scoped>
.image-recommend {
  // 主题变量
  --text-primary: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-primary: #fff;
  --bg-secondary: #f0f0f0;
  --border-color: #ddd;
  --border-hover: #667eea;
  
  @media (prefers-color-scheme: dark) {
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-tertiary: #808080;
    --bg-primary: #2a2a2a;
    --bg-secondary: #333;
    --border-color: #444;
    --border-hover: #667eea;
  }
  
  margin-top: 8px;
}

.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  
  input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 13px;
    background: var(--bg-primary);
    color: var(--text-primary);
    
    &::placeholder {
      color: var(--text-tertiary);
    }
    
    &:focus {
      outline: none;
      border-color: var(--border-hover);
    }
  }
  
  button {
    padding: 8px 16px;
    border: none;
    border-radius: 6px;
    background: #667eea;
    color: #fff;
    font-size: 13px;
    cursor: pointer;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}

.current-keyword {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-size: 13px;
  
  .label {
    color: var(--text-tertiary);
  }
  
  .keyword {
    color: #667eea;
    font-weight: 500;
  }
  
  .edit-btn {
    color: #667eea;
    cursor: pointer;
    font-size: 12px;
    
    &:hover {
      text-decoration: underline;
    }
  }
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  
  .image-item {
    position: relative;
    aspect-ratio: 4/3;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s;
    
    &:hover {
      border-color: #667eea;
    }
    
    &.selected {
      border-color: #52c41a;
    }
    
    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    
    .check-icon {
      position: absolute;
      right: 8px;
      bottom: 8px;
      width: 24px;
      height: 24px;
      background: #52c41a;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    
    .source-badge {
      position: absolute;
      left: 4px;
      top: 4px;
      padding: 2px 6px;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      font-size: 10px;
      border-radius: 4px;
      text-transform: capitalize;
    }
  }
}

.empty {
  padding: 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  
  button {
    flex: 1;
    padding: 8px;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: opacity 0.2s;
    
    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
  
  .refresh-btn {
    background: var(--bg-secondary);
    color: var(--text-primary);
    
    &:hover:not(:disabled) {
      opacity: 0.8;
    }
  }
  
  .confirm-btn {
    background: #52c41a;
    color: #fff;
    
    &:hover:not(:disabled) {
      background: #45a617;
    }
  }
}
</style>

