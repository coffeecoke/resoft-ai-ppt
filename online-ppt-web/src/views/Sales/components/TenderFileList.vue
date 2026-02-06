<template>
  <div class="tender-file-list">
    <!-- 表头 -->
    <div class="tender-file-header">
      <div class="header-cell header-name" @click="handleSort('title')">
        <span>招标文件名称</span>
        <i v-if="sortField === 'title'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-price" @click="handleSort('controlPrice')">
        <span>采购控制价</span>
        <i v-if="sortField === 'controlPrice'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-customer" @click="handleSort('customerName')">
        <span>客户名称</span>
        <i v-if="sortField === 'customerName'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
      </div>
      <div class="header-cell header-type" @click="handleSort('tenderType')">
        <span>招标类型</span>
        <i v-if="sortField === 'tenderType'" :class="sortOrder === 'asc' ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" class="sort-icon"></i>
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
      class="tender-file-item" 
    >
      <div class="item-cell item-name" @click="handleItemClick(item)">
        <span class="badge badge-tender">招标文件</span>
        <span class="item-title">{{ item.title }}</span>
      </div>
      <div class="item-cell item-price" @click="handleItemClick(item)">{{ item.controlPrice || '--' }}</div>
      <div class="item-cell item-customer" @click="handleItemClick(item)">{{ item.customerName || '--' }}</div>
      <div class="item-cell item-type" @click="handleItemClick(item)">{{ item.tenderType || '--' }}</div>
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
        <el-button size="small" @click.stop="handleDownload(item)">
          <i class="ri-folder-download-line"></i>
          下载
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface TenderFileItem {
  id: string | number
  title: string
  thumbnail?: string
  date?: string
  tag?: string
  pdfUrl?: string
  controlPrice?: string
  customerName?: string
  tenderType?: string
  views?: number
  favorites?: number
  downloads?: number
}

const props = defineProps<{
  items: TenderFileItem[]
}>()

const emit = defineEmits<{
  'item-click': [item: TenderFileItem]
  'ai-analyze': [item: TenderFileItem]
  'download': [item: TenderFileItem]
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
    let aValue: any = a[sortField.value as keyof TenderFileItem] || ''
    let bValue: any = b[sortField.value as keyof TenderFileItem] || ''

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

const handleItemClick = (item: TenderFileItem) => {
  emit('item-click', item)
}

const handleAiAnalyze = (item: TenderFileItem) => {
  emit('ai-analyze', item)
}

const handleDownload = (item: TenderFileItem) => {
  emit('download', item)
}
</script>

<style scoped lang="scss">
// 招标文件列表样式
.tender-file-list {
  margin-top: 0;
  background: var(--card);
  border: none;
  border-radius: 8px;
  overflow: hidden;
}

.tender-file-header {
  display: grid;
  grid-template-columns: 7fr 1fr 1.2fr 1.2fr 0.8fr 1.5fr 1.5fr;
  gap: 12px;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e6e8eb;
  font-size: 0.75rem;
  font-weight: 600;
  color: #475569;
}

.tender-file-item {
  display: grid;
  grid-template-columns: 7fr 1fr 1.2fr 1.2fr 0.8fr 1.5fr 1.5fr;
  gap: 12px;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid #f1f5f9;
  border-radius: 0px;
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

.tender-file-item .item-actions {
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

.tender-file-item .item-name {
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
  
  .badge-tender {
    background: #f36f6f;
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

.tender-file-item .item-price,
.tender-file-item .item-customer,
.tender-file-item .item-type,
.tender-file-item .item-time {
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
}

.tender-file-item .item-stats {
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

