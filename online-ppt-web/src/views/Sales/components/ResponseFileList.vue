<template>
  <div class="response-file-list">
    <!-- 表头 -->
    <div class="response-file-header">
      <div class="header-cell header-name" @click="handleSort('title')">
        <span>响应文件名称</span>
        <i v-if="sortField === 'title'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-product" @click="handleSort('productName')">
        <span>产品名称</span>
        <i v-if="sortField === 'productName'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-bank" @click="handleSort('bankName')">
        <span>银行机构</span>
        <i v-if="sortField === 'bankName'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-procurement" @click="handleSort('procurementMethod')">
        <span>采购方式</span>
        <i v-if="sortField === 'procurementMethod'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-time" @click="handleSort('date')">
        <span>时间</span>
        <i v-if="sortField === 'date'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-stats">
        <span>统计</span>
      </div>
      <div class="header-cell header-actions">
        <span>操作</span>
      </div>
    </div>
    <!-- 列表项 -->
    <div 
      v-for="item in sortedItems" 
      :key="item.id" 
      class="response-file-item" 
    >
      <div class="item-cell item-name" @click="handleItemClick(item)">
        <span class="badge badge-response">响应文件</span>
        <span class="item-title">{{ item.title }}</span>
      </div>
      <div class="item-cell item-product" @click="handleItemClick(item)">{{ item.productName || '--' }}</div>
      <div class="item-cell item-bank" @click="handleItemClick(item)">{{ item.bankName || '--' }}</div>
      <div class="item-cell item-procurement" @click="handleItemClick(item)">{{ item.procurementMethod || '--' }}</div>
      <div class="item-cell item-time" @click="handleItemClick(item)">{{ item.date }}</div>
      <div class="item-cell item-stats" @click="handleItemClick(item)">
        <div class="stat-item">
          <i class="ri-book-open-line"></i>
          <span>{{ item.views || 0 }}</span>
        </div>
        <div class="stat-item">
          <i class="ri-heart-2-line"></i>
          <span>{{ item.favorites || 0 }}</span>
        </div>
        <div class="stat-item">
          <i class="ri-download-line"></i>
          <span>{{ item.downloads || 0 }}</span>
        </div>
      </div>
      <div class="item-cell item-actions">
        <el-button size="small" type="primary" plain @click.stop="handleAiAnalyze(item)">
          <i class="ri-quill-pen-ai-line"></i>
          AI分析
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface ResponseFileItem {
  id: string | number
  title: string
  thumbnail?: string
  creator?: string
  date?: string
  productName?: string
  bankName?: string
  procurementMethod?: string
  industry?: string
  views?: number
  favorites?: number
  downloads?: number
}

const props = defineProps<{
  items: ResponseFileItem[]
}>()

const emit = defineEmits<{
  'item-click': [item: ResponseFileItem]
  'ai-analyze': [item: ResponseFileItem]
}>()

// 排序状态
const sortField = ref<string | null>(null)
const sortOrder = ref<'asc' | 'desc'>('asc')

// 处理排序
const handleSort = (field: string) => {
  if (sortField.value === field) {
    // 如果点击的是当前排序列，切换排序方向
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    // 如果点击的是新列，设置为升序
    sortField.value = field
    sortOrder.value = 'asc'
  }
}

// 排序后的列表
const sortedItems = computed(() => {
  if (!sortField.value) {
    return props.items
  }

  const items = [...props.items]
  
  items.sort((a, b) => {
    let aValue: any = a[sortField.value as keyof ResponseFileItem] || ''
    let bValue: any = b[sortField.value as keyof ResponseFileItem] || ''

    // 处理空值
    if (aValue === '--' || aValue === '') aValue = ''
    if (bValue === '--' || bValue === '') bValue = ''

    // 字符串比较
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue, 'zh-CN')
      return sortOrder.value === 'asc' ? comparison : -comparison
    }

    // 数字比较
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortOrder.value === 'asc' ? aValue - bValue : bValue - aValue
    }

    return 0
  })

  return items
})

const handleItemClick = (item: ResponseFileItem) => {
  emit('item-click', item)
}

const handleAiAnalyze = (item: ResponseFileItem) => {
  emit('ai-analyze', item)
}
</script>

<style scoped lang="scss">
// 响应文件列表样式
.response-file-list {
  margin-top: 0;
  background: var(--card);
  border: none;
  border-radius: 8px;
  overflow: hidden;
}

.response-file-header {
  display: grid;
  grid-template-columns: 7fr 1fr 1.2fr 1.2fr 0.8fr 1.5fr 1fr;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e6e8eb;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.response-file-item {
  display: grid;
  grid-template-columns: 7fr 1fr 1.2fr 1.2fr 0.8fr 1.5fr 1fr;
  gap: 12px;
  padding: 14px 16px;
  background: #FFF;
  border-bottom: 1px solid #f1f5f9;
  transition: all 0.2s ease;
  align-items: center;

  &:hover {
    background: #f8fafc;
  }

  &:last-child {
    border-bottom: none;
  }

  .item-cell:not(.item-actions) {
    cursor: pointer;
  }
}

.response-file-item .item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  opacity: 1 !important;
  visibility: visible !important;

  :deep(.el-button) {
    padding: 4px 12px;
    font-size: 0.75rem;
    
    i {
      font-size: 14px;
      margin-right: 4px;
    }
  }
}

.item-cell {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: #1f2d3d;
  min-width: 0;
  
  &:first-child {
    gap: 12px;
  }
}

.response-file-item .item-name {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .badge {
    position: static;
    font-size: 12px;
    padding: 4px 8px;
    border-radius: 2px 10px;
    flex-shrink: 0;
  }
  
  .badge-response {
    background: #67C23A;
    color: #fff;
    padding: 1px 6px;
    font-size: 0.75rem;
  }
  
  .item-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1f2d3d;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }
}

.response-file-item .item-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.75rem;
  color: #64748b;
  white-space: nowrap;
  
  .stat-item {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    flex-shrink: 0;
    
    i {
      font-size: 14px;
      color: #64748b;
      flex-shrink: 0;
      order: 1;
    }
    
    span {
      font-size: 0.75rem;
      color: #64748b;
      white-space: nowrap;
      order: 2;
    }
  }
}

.response-file-item .item-time,
.response-file-item .item-product,
.response-file-item .item-bank,
.response-file-item .item-procurement {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.header-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;

  &:hover {
    color: #006DF9;
  }

  .sort-icon {
    font-size: 14px;
    color: #006DF9;
  }
}
</style>

