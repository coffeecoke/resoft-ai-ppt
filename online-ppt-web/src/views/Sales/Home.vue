<template>
  <div class="layout">
    <!-- ✅ 已有组件：页面头部 -->
    <Header />
    
    <div class="main">
      <!-- ✅ 已有组件：搜索栏 -->
      <SearchBar />
      
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
      />
      
      <!-- ✅ 已有组件：高级筛选面板 -->
      <AdvancedFilterPanel
        v-if="showAdvancedFilter && activeNav === 'recommend' && activeDashboardTab === 'products'"
        :visible="showAdvancedFilter"
        :activeTab="activeTab"
        :activeProduct="productContent.activeProduct.value"
        :companyStructure="companyStructure"
        :filters="{ ppt: pptFilters, video: videoFilters, qa: qaFilters, tender: tenderFilters, response: responseFilters }"
        @update:filters="handleFiltersUpdate"
      />
      
      <!-- 🆕 新组件：选中产品后的详情视图（仅PPT tab） -->
      <ProductDetailView
        v-if="showProductDetail"
        :activeProduct="productContent.activeProduct.value"
        v-model:catalogMode="productContent.catalogMode.value"
        v-model:activeCatalogIds="productContent.activeCatalogIds.value"
        :publicPPTData="productContent.publicPPTData.value"
        :practicalPPTData="productContent.practicalPPTData.value"
        :productCatalog="productCatalog"
        :mergedSlides="productContent.mergedSlides.value"
        :getMergedSlidesForGroup="productContent.getMergedSlidesForGroup"
      />
      
      <!-- 🆕 新组件：PPT tab 未选产品时显示PPT网格 -->
      <ContentGridSection
        v-if="showPptGrid"
        :activeTab="activeTab"
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
      
      <!-- ✅ 已有组件：QA区域（内部处理点赞/点踩） -->
      <QASection
        v-if="showQASection"
        :questions="filters.filteredQuestions.value"
      />
      
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
                </div>
    
    <!-- ✅ 已有组件：PPT对话框（替换掉内联的el-dialog） -->
    <PptDialog
      v-model:visible="dialogs.dialogVisible.value"
      :type="dialogs.dialogType.value"
      :title="dialogs.dialogTitle.value"
      :slides="dialogs.slides.value"
      :isResponseDialog="dialogs.isResponseDialog.value"
      :createdAt="dialogs.dialogCreatedAt.value"
      :viewCount="dialogs.dialogViewCount.value"
      :document-id="dialogs.dialogDocumentId.value"
    />
    
    <!-- ✅ 已有组件：视频对话框（替换掉内联的el-dialog） -->
    <VideoDialog
      v-model:visible="dialogs.videoDialogVisible.value"
      :videoDetail="dialogs.videoDetail.value"
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
import QASection from './components/QASection.vue'
import PptDialog from './components/PptDialog.vue'
import VideoDialog from './components/VideoDialog.vue'

// ============================================
// 🆕 新组件导入
// ============================================
import MainDashboardSection from './components/MainDashboardSection.vue'
import TabsSection from './components/TabsSection.vue'
import ProductDetailView from './components/ProductDetailView.vue'
import ContentGridSection from './components/ContentGridSection.vue'
import PptPageView from './components/PptPageView.vue'
import VideoPageView from './components/VideoPageView.vue'

// ============================================
// 📦 数据配置导入
// ============================================
import { salesData } from '@/configs/salesData'

// ============================================
// 📡 API 服务导入
// ============================================
import { getProductList } from '@/services/salesService'

// ============================================
// 🔧 Composable函数导入（所有业务逻辑都在这里）
// ============================================
import { useProductContent } from './composables/useProductContent'
import { useFilters } from './composables/useFilters'
import { useDialogs } from './composables/useDialogs'

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

// 对话框相关（包含所有打开逻辑：PPT、视频、品牌资料）
const dialogs = useDialogs()

// ============================================
// 2. Provide Composables（供子组件inject使用）
// ============================================
provide('dialogs', dialogs)
provide('productContent', productContent)

// ============================================
// 3. 页面级状态（仅UI状态，无业务逻辑）
// ============================================
const activeNav = ref('recommend')
const activeTab = ref('ppt')
const activeDashboardTab = ref('products')
const activeBrandTab = ref('company')
const showAdvancedFilter = ref(false)

// 独立页面的筛选条件
const fProduct = ref<string | null>(null)
const fAudience = ref<string | null>(null)
const fIndustry = ref<string | null>(null)
const fBiz = ref<string | null>(null)
const fVersion = ref<string | null>(null)
const customerName = ref('')
const sort = ref('综合排序')

// ============================================
// 4. 数据定义（从API获取或配置）
// ============================================
const productStats = ref([]) // 从 API 获取
const brandData = ref(salesData.brandData)
const questions = ref(salesData.questions)
const productCatalog = ref(salesData.productCatalog)
const companyStructure = ref(salesData.companyStructure)

// ============================================
// 4.1 加载产品数据
// ============================================
const loadProductStats = async () => {
  try {
    const res = await getProductList({ isActive: true })
    if (res.success) {
      // 转换API数据为前端需要的格式
      productStats.value = res.data.map(product => ({
        name: product.name,
        sessions: product.stats.sessions,
        ppts: product.stats.ppts,
        questions: product.stats.questions
      }))
    }
  } catch (error) {
    console.error('加载产品数据失败:', error)
    // 失败时使用Mock数据
    productStats.value = salesData.productStats
  }
}

// ============================================
// 4.2 组件挂载时加载数据
// ============================================
onMounted(() => {
  loadProductStats()
})

// 筛选条件（从filters composable中解构）
const { pptFilters, videoFilters, qaFilters, tenderFilters, responseFilters } = filters

// ============================================
// 4.5. 计算属性（优化复杂的显示逻辑）
// ============================================

// 是否显示内容网格（PPT/视频/招标/响应）
const showContentGrid = computed(() => {
  return activeNav.value === 'recommend'           // ① 在推荐页
    && activeDashboardTab.value === 'products'     // ② 在产品标签
    && ['video', 'tender', 'response'].includes(activeTab.value)  // ③ 这3个tab（不包括ppt和qa）
})

// 是否显示产品详情（仅PPT tab且已选产品时显示）
const showProductDetail = computed(() => {
  return activeNav.value === 'recommend'           // ① 在推荐页
    && activeDashboardTab.value === 'products'     // ② 在产品标签
    && activeTab.value === 'ppt'                   // ③ 在PPT tab
    && !!productContent.activeProduct.value        // ④ 已选中产品
})

// 是否显示PPT网格（PPT tab且未选产品时显示）
const showPptGrid = computed(() => {
  return activeNav.value === 'recommend'           // ① 在推荐页
    && activeDashboardTab.value === 'products'     // ② 在产品标签
    && activeTab.value === 'ppt'                   // ③ 在PPT tab
    && !productContent.activeProduct.value         // ④ 未选中产品
})

// 是否显示QA区域
const showQASection = computed(() => {
  return activeNav.value === 'recommend'           // ① 在推荐页
    && activeDashboardTab.value === 'products'     // ② 在产品标签
    && activeTab.value === 'qa'                    // ③ 在QA tab
    // ④ 无论是否选择产品都显示（通过filters自动过滤）
})

// ============================================
// 5. 事件处理（仅状态同步，无业务逻辑）
// ============================================
const handleCreatePpt = () => {
  // TODO: 实现新建PPT的逻辑
  ElMessage.info('新建PPT功能开发中...')
}

const handleFiltersUpdate = (newFilters: any) => {
  // 将 AdvancedFilterPanel 返回的 { ppt: {...}, video: {...} } 格式
  // 映射回 { pptFilters, videoFilters, ... } 对象
  if (newFilters.ppt) Object.assign(pptFilters, newFilters.ppt)
  if (newFilters.video) Object.assign(videoFilters, newFilters.video)
  if (newFilters.qa) Object.assign(qaFilters, newFilters.qa)
  if (newFilters.tender) Object.assign(tenderFilters, newFilters.tender)
  if (newFilters.response) Object.assign(responseFilters, newFilters.response)
}

// ============================================
// 6. 路由监听（仅状态同步，无业务逻辑）
// ============================================
watch(() => route.query.nav, (newNav) => {
  if (newNav) activeNav.value = newNav as string
})

onMounted(() => {
  if (route.query.nav) {
    activeNav.value = route.query.nav as string
  }
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
