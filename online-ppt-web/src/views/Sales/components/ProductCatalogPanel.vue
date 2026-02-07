<template>
  <div class="product-catalog-toc">
    <div class="toc-header">
      <h3 class="sidebar-title">{{ title || '目录' }}</h3>
      <div class="mode-switch-container">
        <div 
          class="mode-item" 
          :class="{ active: catalogMode === 'single' }"
          @click="handleModeChange('single')"
        >
          <i class="ri-check-line mode-icon"></i>
          <span class="mode-text">单选模式</span>
        </div>
        <div 
          class="mode-item" 
          :class="{ active: catalogMode === 'multiple' }"
          @click="handleModeChange('multiple')"
        >
          <i class="ri-grid-fill mode-icon"></i>
          <span class="mode-text">多选模式</span>
        </div>
      </div>
    </div>
    <div class="toc-content">
      <div 
        v-for="item in productCatalog" 
        :key="item.id"
        class="category-group"
      >
        <div 
          class="category-title"
          :class="{ 'clickable': catalogMode === 'multiple' }"
          @click="catalogMode === 'multiple' ? handleToggleParent(item.id) : null"
        >
          <i :class="getCategoryIcon(item.text)" class="category-icon"></i>
          <span>{{ item.text }}</span>
        </div>
        <div class="category-children">
          <div 
            v-for="c in item.children" 
            :key="c.id" 
            class="category-child-item"
            :class="{ active: isCatalogSelected(c.id) }"
            @click="handleSelectCatalog(c.id)"
          >
            <span class="child-name">{{ c.text }}</span>
            <i 
              v-if="isCatalogSelected(c.id)" 
              class="ri-check-line check-icon"
            ></i>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
  title: {
    type: String,
    default: '目录'
  },
  activeProduct: {
    type: String,
    default: ''
  },
  productCatalog: {
    type: Array,
    default: () => []
  },
  activeCatalogIds: {
    type: Array,
    default: () => []
  },
  catalogMode: {
    type: String,
    default: 'single'
  }
})

const emit = defineEmits([
  'update:catalogMode',
  'update:activeCatalogIds'
])

// 判断目录是否选中
const isCatalogSelected = (catId: string) => {
  return props.activeCatalogIds.includes(catId)
}

// 判断父级目录是否全选
const isParentSelected = (parentId: string) => {
  if (props.catalogMode !== 'multiple') return false
  const parent = props.productCatalog.find((p: any) => p.id === parentId)
  if (!parent) return false
  return parent.children.every((child: any) => props.activeCatalogIds.includes(child.id))
}

// 事件处理
const handleModeChange = (mode: string) => {
  emit('update:catalogMode', mode)
}

const handleSelectCatalog = (catId: string) => {
  if (props.catalogMode === 'single') {
    emit('update:activeCatalogIds', catId ? [catId] : [])
  } else {
    handleToggleCatalog(catId)
  }
}

const handleToggleCatalog = (catId: string) => {
  if (props.catalogMode !== 'multiple') return
  const newIds = [...props.activeCatalogIds]
  const index = newIds.indexOf(catId)
  if (index > -1) {
    newIds.splice(index, 1)
  } else {
    newIds.push(catId)
  }
  emit('update:activeCatalogIds', newIds)
}

// 获取一级目录的图标
const getCategoryIcon = (title: string) => {
  if (title.includes('企业') || title.includes('公司')) {
    return 'ri-building-line'
  } else if (title.includes('监管') || title.includes('政策')) {
    return 'ri-government-line'
  } else if (title.includes('产品') || title.includes('解决方案')) {
    return 'ri-stack-line'
  } else if (title.includes('部署') || title.includes('实施') || title.includes('售后')) {
    return 'ri-settings-3-line'
  } else if (title.includes('合作') || title.includes('案例')) {
    return 'ri-handshake-line'
  }
  return 'ri-folder-line'
}

const handleToggleParent = (parentId: string) => {
  if (props.catalogMode !== 'multiple') return
  const parent = props.productCatalog.find((p: any) => p.id === parentId)
  if (!parent) return
  
  const allSelected = parent.children.every((child: any) => props.activeCatalogIds.includes(child.id))
  let newIds = [...props.activeCatalogIds]
  
  if (allSelected) {
    // 取消选择该一级目录下的所有二级目录
    newIds = newIds.filter((id: string) => !parent.children.some((child: any) => child.id === id))
  } else {
    // 选择该一级目录下的所有二级目录
    const childIds = parent.children.map((child: any) => child.id)
    newIds = [...new Set([...newIds, ...childIds])]
  }
  emit('update:activeCatalogIds', newIds)
}
</script>

<style scoped lang="scss">
.product-catalog-toc {
  width: 100%;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toc-header {
  flex-shrink: 0;
  padding: 0 0 16px 0;
}

.sidebar-title {
  font-size: 1.125rem;
  line-height: 1.75rem;
  color: #1e293b;
  font-weight: 600;
  margin: 0 0 16px 0;
  padding: 0;
  border-bottom: none;
}

.mode-switch-container {
  display: flex;
  gap: 8px;
  margin-bottom: 0;
  padding: 0;
}

.toc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  background: transparent;
  transition: all 0.2s;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &.active {
    background: #fff;
    color: #006DF9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  
  .mode-icon {
    font-size: 14px;
  }
  
  .mode-text {
    font-size: 12px;
  }
}

.category-group {
  margin-bottom: 15px;
  background: rgba(252, 252, 253, 1);
  border-radius: 10px;
  border: 1px solid #FCFCFD;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.25rem;
  font-weight: 500;
  color: #3b82f6;
  border-radius: 4px;
  background-color: rgb(241 245 249 / 0.5);
  
  &.clickable {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background-color: rgb(241 245 249 / 0.8);
    }
  }
}

.category-icon {
  font-size: 16px;
  color: #334155;
}

.category-children {
  padding: 10px;
  margin-top: 0;
}

.category-child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid rgb(252, 252, 253);
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  
  &:hover {
    background: #fff;
    border: 1px solid rgb(226 232 240 / 1);
  }
  
  &.active {
    background: rgba(0, 109, 249, 1);
    color: #fff;
    border: 1px solid #006DF9;
    
    .check-icon {
      color: #fff;
    }
    
    .child-name {
      color: #fff;
    }
  }
}

.child-name {
  font-size: 12px;
  flex: 1;
  color: #64748b;
}

.check-icon {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fff;
  border-radius: 50%;
  font-size: 8px;
  color: #006DF9;
  flex-shrink: 0;
}
</style>
