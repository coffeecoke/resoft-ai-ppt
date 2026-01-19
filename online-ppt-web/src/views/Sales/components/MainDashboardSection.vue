<template>
  <section class="product-dashboard">
    <div class="dashboard-header">
      <el-segmented 
        :model-value="activeDashboardTab" 
        :options="dashboardTabOptions" 
        size="small"
        @update:model-value="handleDashboardTabChange"
      />
    </div>
    
    <!-- 重点关注产品 -->
    <ProductDashboard
      v-if="activeDashboardTab === 'products'"
      :productStats="productStats"
      :activeProduct="activeProduct"
      @select-product="handleSelectProduct"
    />
    
    <!-- 品牌基础资料 -->
    <BrandMaterials
      v-if="activeDashboardTab === 'brand'"
      :activeBrandTab="activeBrandTab"
      :brandTabOptions="brandTabOptions"
      :brandCompanyItems="brandData.companyItems"
      :brandProductsItems="brandData.productsItems"
      :brandRegulationsItems="brandData.regulationsItems"
      :brandCalendarItems="brandData.calendarItems"
      :brandComplianceItems="brandData.complianceItems"
      :brandGeneralItems="brandData.generalItems"
      :brandXinchuangItems="brandData.xinchuangItems"
      :brandLocalItems="brandData.localItems"
      :brandBillItems="brandData.billItems"
      @update:activeBrandTab="handleBrandTabChange"
      @open-brand-item="handleOpenBrandItem"
    />
  </section>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, inject } from 'vue'
import ProductDashboard from './ProductDashboard.vue'
import BrandMaterials from './BrandMaterials.vue'
import { BRAND_TAB_OPTIONS } from '@/configs/salesConstants'

const props = defineProps({
  activeDashboardTab: {
    type: String,
    default: 'products'
  },
  activeBrandTab: {
    type: String,
    default: 'company'
  },
  activeProduct: {
    type: String,
    default: ''
  },
  productStats: {
    type: Array,
    default: () => []
  },
  brandData: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:activeDashboardTab', 'update:activeBrandTab', 'select-product'])

// Dashboard Tab选项
const dashboardTabOptions = [
  { label: '重点关注产品', value: 'products' },
  { label: '品牌基础资料', value: 'brand' }
]

// 品牌Tab选项
const brandTabOptions = BRAND_TAB_OPTIONS

// 注入dialogs composable（用于打开品牌资料）
const dialogs: any = inject('dialogs')

const handleDashboardTabChange = (value: string) => {
  emit('update:activeDashboardTab', value)
}

const handleBrandTabChange = (value: string) => {
  emit('update:activeBrandTab', value)
}

const handleSelectProduct = (productCode: string) => {
  // 传递 product code 而不是 name
  emit('select-product', productCode)
}

// 打开品牌资料项（内部处理，不向上emit）
const handleOpenBrandItem = (item: any) => {
  if (dialogs) {
    dialogs.openBrandItem(item)
  }
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

