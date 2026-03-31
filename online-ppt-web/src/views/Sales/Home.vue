<template>
  <div class="layout">
    <!-- ✅ 已有组件：页面头部 -->
    <Header />
    
    <div class="main">
      <!-- ✅ 已有组件：搜索栏（已隐藏） -->
      <!-- <SearchBar /> -->
      
      <!-- 🆕 新组件：主推产品数据看板（整合ProductDashboard和BrandMaterials） -->
      <MainDashboardSection
        v-if="activeNav === 'recommend'"
        v-model:activeDashboardTab="activeDashboardTab"
        v-model:activeBrandTab="activeBrandTab"
        :activeProduct="productContent.activeProduct.value"
        :productStats="productStats"
        :brandData="brandData"
        @select-product="productContent.selectProduct"
      />
      
      <!-- 🆕 新组件：标签页切换 -->
      <TabsSection
        v-if="activeNav === 'recommend' && activeDashboardTab === 'products'"
        v-model:activeTab="activeTab"
        v-model:showAdvancedFilter="showAdvancedFilter"
        @create-ppt="handleCreatePpt"
        @filter="handleFilterClick"
      />
      
      <!-- ✅ 已有组件：高级筛选面板 -->
      <!-- <AdvancedFilterPanel
        v-if="showAdvancedFilter && activeNav === 'recommend' && activeDashboardTab === 'products'"
        :visible="showAdvancedFilter"
        :activeTab="activeTab"
        :activeProduct="productContent.activeProduct.value"
        :companyStructure="companyStructure"
        :filters="filterProps"
        :pptCatalogTree="pptCatalogTree"
        :bidSectionTypes="filters.bidSectionTypesFromAPI.value"
        @update:filters="handleFiltersUpdate"
      /> -->

      <!-- 🆕 新组件：交流会议（使用 VideoPageView 支持无限滚动） -->
      <div v-if="showVideoSection" class="content-with-filter">
        <!-- 筛选面板（在左侧） -->
        <FilterPanel
          v-if="showFilterPanel"
          v-model:visible="showFilterPanel"
          :active-tab="'video'"
          :filters="filterProps"
          @close="handleFilterClose"
        />

        <div class="content-grid-wrapper" :class="{ 'with-filter': showFilterPanel }">
          <VideoPageView
            :filteredVideos="[]"
            :showHeader="false"
            v-model:fProduct="fProduct"
            v-model:fIndustry="fIndustry"
          />
        </div>
      </div>

      <!-- 🆕 新组件：内容区域和筛选面板的容器（包含选中产品后的详情视图） -->
      <div v-if="showPptGrid || showContentGrid || showProductDetail" class="content-with-filter">
        <!-- 🆕 新组件：筛选面板（在左侧） -->
        <FilterPanel
          v-if="showMainFilterPanel"
          v-model:visible="showFilterPanel"
          :active-tab="activeTab === 'ppt-new' ? 'ppt' : activeTab"
          :filters="filterProps"
          :pptCatalogTree="pptCatalogTree"
          :bidSectionTypes="filters.bidSectionTypesFromAPI.value"
          @close="handleFilterClose"
          @create-ppt="handleCreatePpt"
        />

        <div class="content-grid-wrapper" :class="{ 'with-filter': showMainFilterPanel }">
          <!-- 🆕 新组件：选中产品后的详情视图（产品介绍PPT tab 与 ppt-new 均使用 ProductDetailView，保留当前项目 PPT 组件） -->
          <!-- 选中产品后的详情：内部用 useProductCatalogs 按 code 请求公共版/实战版 -->
          <ProductDetailView
            v-if="showProductDetail && (activeTab === 'ppt' || activeTab === 'ppt-new')"
            :activeProduct="productContent.activeProduct.value"
            :activeCatalogCodes="filters.pptFilters.productIntro"
          />
          
          <!-- 🆕 新组件：PPT tab 未选产品时显示PPT网格 -->
          <ContentGridSection
            v-if="showPptGrid"
            :activeTab="activeTab === 'ppt-new' ? 'ppt' : activeTab"
            :filteredPPT="filters.filteredPPT.value"
            :filteredVideos="filters.filteredVideos.value"
            :tenderFiles="filters.tenderFiles.value"
            :responseFiles="filters.responseFiles.value"
          />
          
          <!-- 🆕 新组件：视频/招标/响应 tab 始终显示内容网格 -->
          <ContentGridSection
            v-if="showContentGrid"
            :activeTab="activeTab"
            :filteredPPT="filters.filteredPPT.value"
            :filteredVideos="filters.filteredVideos.value"
            :tenderFiles="filters.tenderFiles.value"
            :responseFiles="filters.responseFiles.value"
          />
        </div>
      </div>
      
      
      <!-- 关心问题页面 -->
      <div v-if="showConcernedQuestions" class="concerned-questions-wrapper">
        <!-- 筛选面板（关心问题，在左侧） -->
        <FilterPanel
          v-if="showFilterPanel && activeTab === 'concerned'"
          v-model:visible="showFilterPanel"
          :active-tab="activeTab"
          @close="handleFilterClose"
          @update:questionCategoryFilters="handleQuestionCategoryFiltersUpdate"
        />

        <div class="concerned-questions-content" :class="{ 'with-filter': showFilterPanel && activeTab === 'concerned' }">
          <ConcernedQuestionsView
            :show-sidebar="false"
            :show-filters="true"
            :external-filters="questionCategoryFilters"
          />
        </div>
      </div>
      
      <!-- 🆕 新组件：独立PPT页面 -->
      <PptPageView
        v-if="activeNav === 'ppt'"
        :filteredPPT="filters.filteredPPTPage.value"
        v-model:fProduct="fProduct"
        v-model:fAudience="fAudience"
        v-model:fIndustry="fIndustry"
        v-model:fBiz="fBiz"
        v-model:fVersion="fVersion"
        v-model:customerName="customerName"
        v-model:sort="sort"
      />
      
      <!-- 🆕 新组件：独立视频页面 -->
      <VideoPageView
        v-if="activeNav === 'video'"
        :filteredVideos="filters.filteredVideosPage.value"
        v-model:fProduct="fProduct"
        v-model:fIndustry="fIndustry"
      />
      
      <!-- 🆕 新组件：独立招标文件页面 -->
      <TenderPageView
        v-if="activeNav === 'tender'"
        :tenderFiles="filters.tenderFiles.value"
      />
      
      <!-- 🆕 新组件：独立响应文件页面 -->
      <ResponsePageView
        v-if="activeNav === 'response'"
        :responseFiles="filters.responseFiles.value"
      />
      
      <!-- 🆕 新组件：品牌基础资料页面 -->
      <BrandMaterials
        v-if="activeNav === 'materials'"
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
                </div>
    
    <!-- ✅ 已有组件：PPT对话框（替换掉内联的el-dialog） -->
    <PptDialog
      v-model:visible="dialogs.dialogVisible.value"
      :document-id="dialogs.dialogDocumentId.value"
      :type="dialogs.dialogType.value"
      :title="dialogs.dialogTitle.value"
      :slides="dialogs.slides.value"
      :created-at="dialogs.dialogCreatedAt.value"
      :view-count="dialogs.dialogViewCount.value"
      :isResponseDialog="dialogs.isResponseDialog.value"
    />
    
    <!-- ✅ 新组件：响应文件对话框 -->
    <ResponseFileDialog
      v-model:visible="dialogs.responseFileDialogVisible.value"
      :title="dialogs.responseFileTitle.value"
      :file-id="dialogs.responseFileId.value"
    />

    <!-- ✅ 新组件：招标文件对话框 -->
    <TenderFileDialog
      v-model:visible="dialogs.tenderFileDialogVisible.value"
      :title="dialogs.tenderFileTitle.value"
      :file-id="dialogs.tenderFileId.value"
    />
    
    <!-- ✅ 已有组件：视频对话框（替换掉内联的el-dialog） -->
    <VideoDialog
      v-model:visible="dialogs.videoDialogVisible.value"
      :videoDetail="dialogs.videoDetail.value"
    />
    
    <!-- ✅ 招标文件PDF对话框 -->
    <PdfDialog
      v-model:visible="dialogs.pdfDialogVisible.value"
      :title="dialogs.pdfDetail.value?.title || ''"
      :pdf-url="dialogs.pdfDetail.value?.pdfUrl || ''"
      :update-date="dialogs.pdfDetail.value?.updateDate || ''"
    />
                </div>
                      </template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, provide } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'

// ============================================
// ✅ 已有组件导入
// ============================================
import Header from './components/Header.vue'
import SearchBar from './components/SearchBar.vue'
import AdvancedFilterPanel from './components/AdvancedFilterPanel.vue'
import PptDialog from './components/PptDialog.vue'
import VideoDialog from './components/VideoDialog.vue'
import ResponseFileDialog from './components/ResponseFileDialog.vue'
import PdfDialog from './components/PdfDialog.vue'
import TenderFileDialog from './components/TenderFileDialog.vue'

// ============================================
// 🆕 新组件导入
// ============================================
import MainDashboardSection from './components/MainDashboardSection.vue'
import TabsSection from './components/TabsSection.vue'
import ProductDetailView from './components/ProductDetailView.vue'
import ContentGridSection from './components/ContentGridSection.vue'
import PptPageView from './components/PptPageView.vue'
import VideoPageView from './components/VideoPageView.vue'
import TenderPageView from './components/TenderPageView.vue'
import ResponsePageView from './components/ResponsePageView.vue'
import FilterPanel from './components/FilterPanel.vue'
import ConcernedQuestionsView from './components/ConcernedQuestionsView.vue'
import BrandMaterials from './components/BrandMaterials.vue'

// ============================================
// 📦 数据配置导入
// ============================================
import { salesData, responseTocSections } from '@/configs/salesData'
import { BRAND_TAB_OPTIONS } from '@/configs/salesConstants'
import { getProductStats } from '@/services/salesService'

// ============================================
// 🔧 Composable函数导入（所有业务逻辑都在这里）
// ============================================
import { useProductContent } from './composables/useProductContent'
import { useFilters } from './composables/useFilters'
import { useDialogs } from './composables/useDialogs'
import { useGlobalCatalogOptions } from './composables/useGlobalCatalogOptions'

// ============================================
// 路由
// ============================================
const route = useRoute()

// ============================================
// 1. 使用 Composable 管理状态和逻辑
// ============================================

// 产品内容相关（包含产品选择、目录切换等逻辑）
const productContent = useProductContent()

// 筛选相关（包含筛选逻辑和结果计算）
const filters = useFilters(salesData, productContent.activeProduct)

// 全局 PPT 目录树（高级筛选「PPT目录」用，来自后台接口，带父级）
const { catalogs: pptCatalogTree } = useGlobalCatalogOptions()

// 对话框相关（包含所有打开逻辑：PPT、视频、品牌资料）
const dialogs = useDialogs()

// ============================================
// 2. Provide Composables（供子组件inject使用）
// ============================================
provide('dialogs', dialogs)
provide('productContent', productContent)
provide('filters', filters)

// ============================================
// 3. 页面级状态（仅UI状态，无业务逻辑）
// ============================================
const activeNav = ref('recommend')
const activeTab = ref('ppt')
const activeDashboardTab = ref('products')
const activeBrandTab = ref('company')
const showAdvancedFilter = ref(false)
const showFilterPanel = ref(true) // 筛选面板显示状态（默认展开）
// 主内容区筛选面板（ppt/ppt-new/video/tender/response tab 下展开）
const showMainFilterPanel = computed(() =>
  showFilterPanel.value && ['ppt', 'ppt-new', 'video', 'tender', 'response'].includes(activeTab.value)
)

// 问题分类筛选条件（关心问题 tab）
const questionCategoryFilters = ref<{
  questionCategory: string[]
  industry: string[]
  essenceType: string[]
  customerName: string
}>({
  questionCategory: [],
  industry: [],
  essenceType: [],
  customerName: ''
})

// 以下状态由 PptPageView/VideoPageView 通过 v-model 自维护，Home.vue 仅作托管
const fProduct = ref<string | null>(null)
const fAudience = ref<string | null>(null)
const fIndustry = ref<string | null>(null)
const fBiz = ref<string | null>(null)
const fVersion = ref<string | null>(null)
const customerName = ref('')
const sort = ref('综合排序')

// ============================================
// 4. 从配置/接口获取数据
// ============================================
// 重点关注产品列表：来自产品分类表接口，点击后通过 code 查 PPT
const productStats = ref<Array<{ name: string; code: string; sessions: number; ppts: number; questions: number; brochures?: number; tenderFiles?: number; responseFiles?: number }>>([])
const brandData = ref(salesData.brandData)
const questions = ref(salesData.questions)
const productCatalog = ref(salesData.productCatalog)
const companyStructure = ref(salesData.companyStructure)

// 筛选条件（从filters composable中解构，保持同一引用供 AdvancedFilterPanel 直接写回）
const { pptFilters, videoFilters, qaFilters, tenderFilters, responseFilters } = filters
// 稳定引用，便于高级筛选面板直接更新 pptFilters 等触发 useFilters 内 computed 更新
const filterProps = { pptFilters, videoFilters, qaFilters, tenderFilters, responseFilters }

// ============================================
// 4.5. 计算属性（优化复杂的显示逻辑）
// ============================================

// 基础条件：推荐页 + 产品标签
const isRecommendProducts = computed(() =>
  activeNav.value === 'recommend' && activeDashboardTab.value === 'products'
)

const showContentGrid = computed(() =>
  isRecommendProducts.value && ['tender', 'response'].includes(activeTab.value)
)

const showVideoSection = computed(() =>
  isRecommendProducts.value && activeTab.value === 'video'
)

const showProductDetail = computed(() =>
  isRecommendProducts.value
  && (activeTab.value === 'ppt' || activeTab.value === 'ppt-new')
  && !!productContent.activeProduct.value
)

const showPptGrid = computed(() =>
  isRecommendProducts.value
  && (activeTab.value === 'ppt' || activeTab.value === 'ppt-new')
  && !productContent.activeProduct.value
)

const showConcernedQuestions = computed(() =>
  isRecommendProducts.value && activeTab.value === 'concerned'
)

// ============================================
// 5. 事件处理（仅状态同步，无业务逻辑）
// ============================================
const handleCreatePpt = () => {
  // TODO: 实现新建PPT的逻辑
  ElMessage.info('新建PPT功能开发中...')
}

// 筛选面板相关事件（独立于高级筛选）
const handleFilterClick = () => {
  showFilterPanel.value = !showFilterPanel.value
}

const handleFilterClose = () => {
  showFilterPanel.value = false
}

// 处理问题分类筛选变化（关心问题 tab）
const handleQuestionCategoryFiltersUpdate = (newFilters: {
  questionCategory: string[]
  industry: string[]
  essenceType: string[]
  customerName: string
}) => {
  console.log('[Home] 📥 收到 FilterPanel 的问题分类筛选变化:', newFilters)
  questionCategoryFilters.value = newFilters
}


// 品牌Tab选项
const brandTabOptions = BRAND_TAB_OPTIONS

// 处理品牌Tab切换
const handleBrandTabChange = (value: string) => {
  activeBrandTab.value = value
}

// 处理打开品牌资料项
const handleOpenBrandItem = (item: any) => {
  dialogs.openBrandItem(item)
}

// ============================================
// 6. 路由监听（仅状态同步，无业务逻辑）
// ============================================
watch(() => route.query.nav, (newNav) => {
  if (newNav) activeNav.value = newNav as string
})

// 加载重点关注产品统计数据
const loadProductStats = async () => {
  try {
    const res = await getProductStats()
    if (res.success && res.data && Array.isArray(res.data)) {
      productStats.value = res.data
    }
  } catch (e) {
    console.error('[Sales首页] 加载产品统计失败:', e)
    productStats.value = []
  }
}

onMounted(() => {
  if (route.query.nav) {
    activeNav.value = route.query.nav as string
  }
  loadProductStats()
})

// ============================================
// ✅ Home.vue 重构完成
// ============================================
// - 从 2442 行减少到 约 250 行（减少约 90%）
// - 移除了所有硬编码数据（提取到 salesData.ts）
// - 移除了所有业务逻辑（下沉到 composables）
// - 移除了内联的 dialog 代码（使用 PptDialog 和 VideoDialog 组件）
// - 通过 provide/inject 让子组件访问 composables
// - Home.vue 只负责：1) 路由状态 2) 数据传递 3) 组件组合
// ============================================
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
