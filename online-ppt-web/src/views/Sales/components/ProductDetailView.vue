<template>
  <div class="columns">
    <div class="product-ppt-section product-ppt-section--no-catalog">
      <!-- 公共版PPT展示块：使用接口数据 -->
      <PublicPptBlock
        :publicDocuments="catalogState.publicDocuments.value"
        :publicThumbnails="catalogState.publicThumbnails.value"
        :activeCatalogCodes="props.activeCatalogCodes"
        :loading="catalogState.loading.value"
      />

      <!-- 实战版PPT展示块：使用接口数据 -->
      <PracticalPptBlock
        :practicalDocuments="catalogState.practicalDocuments.value"
        :practicalThumbnailGroups="catalogState.practicalThumbnailGroups.value"
        :activeCatalogCodes="props.activeCatalogCodes"
        :loading="catalogState.loading.value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRef, computed, type PropType } from 'vue'
import PublicPptBlock from './PublicPptBlock.vue'
import PracticalPptBlock from './PracticalPptBlock.vue'
import { useProductCatalogs } from '../composables/useProductCatalogs'

const props = defineProps({
  activeProduct: {
    type: String,
    required: true
  },
  // 新增：从外部（FilterPanel）传入的目录筛选条件
  activeCatalogCodes: {
    type: Array as PropType<string[]>,
    default: () => []
  }
})

// 使用 computed 确保数组变化时能正确响应
const activeCatalogCodesRef = computed(() => props.activeCatalogCodes || [])

// 使用产品目录 composable，传入外部的 activeCatalogCodes
const catalogState = useProductCatalogs(
  toRef(props, 'activeProduct'),
  activeCatalogCodesRef
)
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
