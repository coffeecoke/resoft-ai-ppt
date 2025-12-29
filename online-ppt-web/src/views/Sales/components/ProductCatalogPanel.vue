<template>
  <div class="product-catalog card-block">
    <div class="section-head">
      <h3>{{ activeProduct || '产品介绍PPT' }}</h3>
    </div>
    <div class="catalog-mode-switch">
      <div class="mode-switch-container">
        <div 
          class="mode-item" 
          :class="{ active: catalogMode === 'single' }"
          @click="handleModeChange('single')"
        >
          <svg class="mode-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3L10.07 10.07L7.5 12.5L3 3Z" fill="currentColor"/>
            <path d="M10.07 10.07L12.5 7.5L21 16L16 21L7.5 12.5L10.07 10.07Z" fill="currentColor"/>
          </svg>
          <span class="mode-text">单选模式</span>
        </div>
        <div 
          class="mode-item" 
          :class="{ active: catalogMode === 'multiple' }"
          @click="handleModeChange('multiple')"
        >
          <svg class="mode-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/>
            <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="17.5" y1="10" x2="17.5" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <line x1="10" y1="17.5" x2="14" y2="17.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="mode-text">多选模式</span>
        </div>
      </div>
    </div>
    <ul class="catalog-list">
      <li v-for="item in productCatalog" :key="item.id">
        <div class="cat-title">
          <el-checkbox 
            v-if="catalogMode === 'multiple'" 
            :model-value="isParentSelected(item.id)"
            @change="handleToggleParent(item.id)"
            @click.stop
          />
          <span>{{ item.text }}</span>
        </div>
        <ul class="catalog-sub">
          <li 
            v-for="c in item.children" 
            :key="c.id" 
            :class="{active: isCatalogSelected(c.id)}"
            @click="handleSelectCatalog(c.id)"
          >
            <el-checkbox 
              v-if="catalogMode === 'multiple'" 
              :model-value="activeCatalogIds.includes(c.id)"
              @change="handleToggleCatalog(c.id)"
              @click.stop
            >
              <template #default>
                <span>{{ c.text }}</span>
              </template>
            </el-checkbox>
            <el-radio 
              v-else
              :model-value="activeCatalogIds[0]"
              :label="c.id"
              @change="handleSelectCatalog(c.id)"
              @click.stop
            >
              <template #default>
                <span>{{ c.text }}</span>
              </template>
            </el-radio>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'

const props = defineProps({
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

<style scoped>
/* 样式继承自 sales.scss */
</style>
