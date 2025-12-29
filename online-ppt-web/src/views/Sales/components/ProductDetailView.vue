<template>
  <div class="columns">
    <div class="product-ppt-section">
      <!-- 产品目录选择面板 -->
      <ProductCatalogPanel
        :activeProduct="activeProduct"
        :catalogMode="catalogMode"
        :activeCatalogIds="activeCatalogIds"
        :productCatalog="productCatalog"
        @update:catalogMode="handleCatalogModeChange"
        @update:activeCatalogIds="handleCatalogIdsChange"
        @select-catalog="handleSelectCatalog"
        @toggle-parent="handleToggleParent"
      />
      
      <!-- 公共版PPT展示块 -->
      <PublicPptBlock
        :publicPPTData="publicPPTData"
        :activeCatalogIds="activeCatalogIds"
        :mergedSlides="mergedSlides"
      />
      
      <!-- 实战版PPT展示块 -->
      <PracticalPptBlock
        :practicalPPTData="practicalPPTData"
        :activeCatalogIds="activeCatalogIds"
        :getMergedSlidesForGroup="getMergedSlidesForGroup"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
import ProductCatalogPanel from './ProductCatalogPanel.vue'
import PublicPptBlock from './PublicPptBlock.vue'
import PracticalPptBlock from './PracticalPptBlock.vue'

const props = defineProps({
  activeProduct: {
    type: String,
    required: true
  },
  catalogMode: {
    type: String,
    default: 'single'
  },
  activeCatalogIds: {
    type: Array,
    default: () => []
  },
  publicPPTData: {
    type: Array,
    default: () => []
  },
  practicalPPTData: {
    type: Array,
    default: () => []
  },
  productCatalog: {
    type: Array,
    default: () => []
  },
  mergedSlides: {
    type: Array,
    default: () => []
  },
  getMergedSlidesForGroup: {
    type: Function,
    default: () => () => []
  }
})

const emit = defineEmits(['update:catalogMode', 'update:activeCatalogIds'])

const handleCatalogModeChange = (mode: string) => {
  emit('update:catalogMode', mode)
}

const handleCatalogIdsChange = (ids: string[]) => {
  emit('update:activeCatalogIds', ids)
}

const handleSelectCatalog = (catId: string) => {
  // 由ProductCatalogPanel内部处理或通过inject的composable处理
}

const handleToggleParent = (parentId: string) => {
  // 由ProductCatalogPanel内部处理或通过inject的composable处理
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

