<template>
  <div class="product-catalog card-block">
    <div class="section-head">
      <h3>产品介绍PPT</h3>
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
    <div v-if="loading" class="loading">加载中...</div>
    <ul v-else class="catalog-list">
      <li v-for="item in catalogs" :key="item.id">
        <div class="cat-title">
          <el-checkbox 
            v-if="catalogMode === 'multiple'" 
            :model-value="isParentSelected(item.id)"
            @change="handleToggleParent(item.id)"
            @click.stop
          />
          <span>{{ item.name }}</span>
        </div>
        <ul class="catalog-sub">
          <li 
            v-for="c in item.children" 
            :key="c.id" 
            :class="{active: isCatalogSelected(c.code)}"
            @click="handleSelectCatalog(c.code)"
          >
            <el-checkbox 
              v-if="catalogMode === 'multiple'" 
              :model-value="activeCatalogCodes.includes(c.code || '')"
              @change="handleToggleCatalog(c.code)"
              @click.stop
            >
              <template #default>
                <span>{{ c.name }}</span>
              </template>
            </el-checkbox>
            <el-radio 
              v-else
              :model-value="activeCatalogCodes[0]"
              :label="c.code || ''"
              @change="handleSelectCatalog(c.code)"
              @click.stop
            >
              <template #default>
                <span>{{ c.name }}</span>
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
  catalogs: {
    type: Array,
    default: () => []
  },
  activeCatalogCodes: {
    type: Array,
    default: () => []
  },
  catalogMode: {
    type: String,
    default: 'single'
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'update:catalogMode',
  'update:activeCatalogCodes',
  'select-catalog'
])

// 判断目录是否选中（通过code）
const isCatalogSelected = (code: string | null) => {
  if (!code) return false
  return props.activeCatalogCodes.includes(code)
}

// 判断父级目录是否全选
const isParentSelected = (parentId: string) => {
  if (props.catalogMode !== 'multiple') return false
  const parent = props.catalogs.find((p: any) => p.id === parentId)
  if (!parent) return false
  return parent.children.every((child: any) => {
    const code = child.code
    return code && props.activeCatalogCodes.includes(code)
  })
}

// 事件处理
const handleModeChange = (mode: 'single' | 'multiple') => {
  emit('update:catalogMode', mode)
  
  // 切换模式时，如果是单选模式且当前多选，只保留第一个
  if (mode === 'single' && props.activeCatalogCodes.length > 1) {
    emit('update:activeCatalogCodes', [props.activeCatalogCodes[0]])
  }
}

const handleSelectCatalog = (code: string | null) => {
  if (!code) return
  
  if (props.catalogMode === 'single') {
    // 单选模式：替换当前选择
    emit('update:activeCatalogCodes', [code])
  } else {
    // 多选模式：切换选择状态
    handleToggleCatalog(code)
  }
  
  emit('select-catalog', code)
}

const handleToggleCatalog = (code: string | null) => {
  if (!code || props.catalogMode !== 'multiple') return
  
  const newCodes = [...props.activeCatalogCodes]
  const index = newCodes.indexOf(code)
  
  if (index > -1) {
    newCodes.splice(index, 1)
  } else {
    newCodes.push(code)
  }
  
  emit('update:activeCatalogCodes', newCodes)
}

const handleToggleParent = (parentId: string) => {
  if (props.catalogMode !== 'multiple') return
  
  const parent = props.catalogs.find((p: any) => p.id === parentId)
  if (!parent) return
  
  const childCodes = parent.children
    .map((child: any) => child.code)
    .filter((code: string | null) => code !== null)
  
  const allSelected = childCodes.every((code: string) => props.activeCatalogCodes.includes(code))
  let newCodes = [...props.activeCatalogCodes]
  
  if (allSelected) {
    // 取消选择该一级目录下的所有二级目录
    newCodes = newCodes.filter((code: string) => !childCodes.includes(code))
  } else {
    // 选择该一级目录下的所有二级目录
    newCodes = [...new Set([...newCodes, ...childCodes])]
  }
  
  emit('update:activeCatalogCodes', newCodes)
}
</script>

<style scoped>
.catalog-stats {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
.loading {
  padding: 20px;
  text-align: center;
  color: #999;
}
</style>

<style scoped>
/* 样式继承自 sales.scss */
</style>
