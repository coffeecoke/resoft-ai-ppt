<template>
  <div class="columns">
    <div class="product-ppt-section">
      <!-- 产品目录选择面板 -->
      <ProductCatalogPanel
        :catalogs="catalogs"
        :activeCatalogCodes="activeCatalogCodes"
        :catalogMode="catalogMode"
        :loading="loading"
        @update:catalogMode="setCatalogMode"
        @update:activeCatalogCodes="handleCatalogCodesUpdate"
        @select-catalog="selectCatalog"
      />
      
      <!-- 中间公共版 -->
      <PublicPptBlock
        v-if="activeCatalogCodes.length === 0"
        :publicDocuments="publicDocuments"
        :loading="loading"
      />
      <PublicPptBlock
        v-else
        :publicThumbnails="publicThumbnails"
        :activeCatalogCodes="activeCatalogCodes"
        :loading="loading"
      />
      
      <!-- 右侧实战版 -->
      <PracticalPptBlock
        v-if="activeCatalogCodes.length === 0"
        :practicalDocuments="practicalDocuments"
        :loading="loading"
      />
      <PracticalPptBlock
        v-else
        :practicalThumbnailGroups="practicalThumbnailGroups"
        :activeCatalogCodes="activeCatalogCodes"
        :loading="loading"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useProductCatalogs } from '../composables/useProductCatalogs'
import ProductCatalogPanel from './ProductCatalogPanel.vue'
import PublicPptBlock from './PublicPptBlock.vue'
import PracticalPptBlock from './PracticalPptBlock.vue'

const props = defineProps({
  activeProduct: {
    type: String,
    required: true
  }
})

// 从父组件注入的筛选条件
const filters = inject<ReturnType<typeof ref>>('advancedFilters', ref({}))

// 使用composable管理状态和数据加载
const {
  catalogs,
  activeCatalogCodes,
  catalogMode,
  publicDocuments,
  practicalDocuments,
  publicThumbnails,
  practicalThumbnailGroups,
  loading,
  setCatalogMode,
  selectCatalog
} = useProductCatalogs(
  computed(() => props.activeProduct),
  filters
)

// 处理目录code更新事件
const handleCatalogCodesUpdate = (codes: string[]) => {
  activeCatalogCodes.value = codes
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

