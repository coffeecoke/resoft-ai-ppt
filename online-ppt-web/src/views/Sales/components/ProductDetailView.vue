<template>
  <div class="columns">
    <div class="product-ppt-section">
      <!-- 产品目录选择面板：使用接口目录树 -->
      <ProductCatalogPanel
        :activeProduct="activeProduct"
        :catalogMode="catalogState.catalogMode.value"
        :activeCatalogIds="catalogState.activeCatalogCodes.value"
        :productCatalog="productCatalogForPanel"
        @update:catalogMode="handleCatalogModeChange"
        @update:activeCatalogIds="handleCatalogIdsChange"
        @select-catalog="handleSelectCatalog"
        @toggle-parent="handleToggleParent"
      />

      <!-- 公共版PPT展示块：使用接口数据 -->
      <PublicPptBlock
        :publicDocuments="catalogState.publicDocuments.value"
        :publicThumbnails="catalogState.publicThumbnails.value"
        :activeCatalogCodes="catalogState.activeCatalogCodes.value"
        :loading="catalogState.loading.value"
      />

      <!-- 实战版PPT展示块：使用接口数据 -->
      <PracticalPptBlock
        :practicalDocuments="catalogState.practicalDocuments.value"
        :practicalThumbnailGroups="catalogState.practicalThumbnailGroups.value"
        :activeCatalogCodes="catalogState.activeCatalogCodes.value"
        :loading="catalogState.loading.value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, toRef, ref } from 'vue'
import type { CatalogLevel1 } from '@/services/productCatalogService'
import ProductCatalogPanel from './ProductCatalogPanel.vue'
import PublicPptBlock from './PublicPptBlock.vue'
import PracticalPptBlock from './PracticalPptBlock.vue'
import { useProductCatalogs } from '../composables/useProductCatalogs'

const props = defineProps({
  activeProduct: {
    type: String,
    required: true
  }
})

// 使用之前的接口：产品目录与文档/缩略图（点击产品后按 code 请求公共版、实战版）
const filters = ref<Record<string, never>>({})
const catalogState = useProductCatalogs(toRef(props, 'activeProduct'), filters)

// 将接口目录树转为 ProductCatalogPanel 所需格式（二级 id 使用 code，与 loadThumbnails 一致）
const productCatalogForPanel = computed(() => {
  const catalogs = catalogState.catalogs.value as CatalogLevel1[]
  if (!catalogs || !catalogs.length) return []
  return catalogs.map(level1 => ({
    id: level1.id,
    text: level1.name,
    children: (level1.children || []).map(level2 => ({
      id: level2.code,
      text: level2.name
    }))
  }))
})

const handleCatalogModeChange = (mode: string) => {
  catalogState.setCatalogMode(mode as 'single' | 'multiple')
}

const handleCatalogIdsChange = (ids: string[]) => {
  catalogState.activeCatalogCodes.value = ids || []
}

const handleSelectCatalog = (_catId: string) => {
  // 由 ProductCatalogPanel 通过 update:activeCatalogIds 已处理
}

const handleToggleParent = (_parentId: string) => {
  // 多选时由 ProductCatalogPanel 内部处理
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
