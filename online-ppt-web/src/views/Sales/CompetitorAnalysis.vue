<template>
  <div class="layout competitor-analysis-page">
    <Header />
    <div class="main">
      <h2 class="page-title">竞品分析</h2>

      <el-tabs v-model="activeTab" class="competitor-tabs">
        <el-tab-pane label="竞争对手" name="competitor">
          <div class="tab-placeholder">竞争对手模块（待开发）</div>
        </el-tab-pane>
        <el-tab-pane label="客户分析" name="customer">
          <div class="tab-placeholder">客户分析模块（待开发）</div>
        </el-tab-pane>
        <el-tab-pane label="产品需求分析" name="product-demand">
          <ProductDemandAnalysis />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Header from './components/Header.vue'
import ProductDemandAnalysis from './components/competitor/ProductDemandAnalysis.vue'

const activeTab = ref('product-demand')
</script>

<style scoped>
.competitor-analysis-page .main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 20px 20px 24px;
}

.competitor-tabs {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

.competitor-tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.competitor-tabs :deep(.el-tabs__item-panel) {
  width: 100%;
  height: 100%;
  overflow: auto;
}

.competitor-tabs :deep(.el-tabs__header) {
  margin-bottom: 16px;
  flex-shrink: 0;
}

.competitor-tabs :deep(.el-tabs__item) {
  font-size: 15px;
}

.competitor-tabs :deep(.el-tabs__item.is-active) {
  font-weight: 600;
  color: #006DF9;
}

.competitor-tabs :deep(.el-tabs__active-bar) {
  background-color: #006DF9;
}

.competitor-tabs :deep(.el-tabs__nav-wrap::after) {
  border-bottom: 1px solid #e6e8eb;
}

.tab-placeholder {
  padding: 40px;
  text-align: center;
  color: #8a97a7;
  background: #fff;
  border-radius: 8px;
}
</style>
