<template>
  <div class="layout product-page">
    <Header />
    
    <div class="main">
      <h2 class="page-title">产品介绍PPT</h2>
      
      <!-- 筛选区域 -->
      <CommonFilters
        :industry-tags="industryTags"
        :selected-industry="selectedIndustry"
        :filter-groups="filterGroups"
        :filter-values="filterValues"
        :sort-options="sortOptions"
        :selected-sort="selectedSort"
        @update:selected-industry="handleIndustryChange"
        @update:filter-values="handleFilterValuesChange"
        @update:selected-sort="handleSortChange"
        @select-customer="handleSelectCustomer"
        @select-product="handleSelectProduct"
      />
      
      <!-- 内容区域：左侧目录 + 右侧PPT列表 -->
      <div class="product-content-layout">
        <!-- 左侧：目录 -->
        <div class="product-catalog-sidebar">
          <ProductCatalogPanel
            :activeProduct="activeProduct"
            :catalogMode="catalogMode"
            :activeCatalogIds="activeCatalogIds"
            :productCatalog="catalog"
            @update:catalogMode="handleCatalogModeChange"
            @update:activeCatalogIds="handleCatalogIdsChange"
          />
        </div>
        
        <!-- 右侧：PPT列表（推荐页效果） -->
        <div class="product-content-main">
          <!-- 默认显示所有PPT（与推荐页一致） -->
          <template v-if="activeCatalogIds.length === 0">
            <!-- 公共版PPT（默认只显示一行，展开后显示全部） -->
            <PptGrid
              :items="displayedPublicPPT"
              :showBadge="true"
              @item-click="openPpt"
            />
            
            <!-- 展开按钮 -->
            <div 
              v-if="!isExpanded && hasMorePublicPPT" 
              class="expand-more-btn" 
              @click="toggleExpand"
            >
              <span>展开显示更多</span>
            </div>
            
            <!-- 收起按钮（展开后显示） -->
            <div 
              v-if="isExpanded" 
              class="expand-more-btn expanded" 
              @click="toggleExpand"
            >
              <span>收起</span>
            </div>
            
            <!-- 实战版PPT（默认显示，不随展开状态变化） -->
            <template v-if="practicalPPTList.length > 0">
              <div class="practical-ppt-section">
                <PptGrid
                  :items="practicalPPTList"
                  :showBadge="true"
                  @item-click="openPpt"
                />
              </div>
            </template>
          </template>
          
          <!-- 选择目录后显示详细内容 -->
          <template v-else>
            <div class="ppt-blocks-container">
              <!-- 公共版 -->
              <div class="public-block card-block">
                <div class="section-head"><h3>公共版</h3></div>
                <div class="ppt-groups">
                <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
                <template v-if="activeCatalogIds.length === 1">
                  <div v-for="p in publicPPT" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                    <div class="ppt-group-header">
                      <div class="ppt-group-title" @click="openPpt(p)" style="cursor:pointer">
                        <el-icon><Document /></el-icon> {{ p.title }}
                      </div>
                      <div class="ppt-group-meta">{{ p.date }} · {{ p.author }}</div>
                    </div>
                    <div class="ppt-slides-scroll">
                      <div v-for="slide in p.slides" :key="slide.id" class="slide-card" @click="openPpt(p)">
                        <img :src="slide.img" loading="lazy" />
                        <div class="slide-page-num">P{{ slide.page }}</div>
                      </div>
                    </div>
                  </div>
                </template>
                <!-- 选择多个二级目录：合并所有图片，按顺序一行一行排列 -->
                <template v-else>
                  <div class="ppt-slides-scroll">
                    <div 
                      v-for="(slide, index) in mergedSlides" 
                      :key="slide.id || index" 
                      class="slide-card" 
                      @click="openPpt(slide.parent)"
                    >
                      <img :src="slide.img" loading="lazy" />
                      <div class="slide-page-num">P{{ slide.page }}</div>
                    </div>
                  </div>
                </template>
              </div>
              </div>

              <!-- 实战版 -->
              <div class="practical-block card-block">
              <div class="section-head"><h3>实战版</h3></div>
              <div class="ppt-groups">
                <div v-if="activeCatalogIds.length === 0" class="customer-group">
                  <template v-for="p in practicalPPT" :key="p.id">
                    <div v-if="p.type === 'file'" class="ppt-item">
                      <i class="ri-file-ppt-2-fill" style="color: #FD6330; font-size: 18px;"></i>
                      <span class="title" style="cursor:pointer;" @click="openPractical(p)">{{ p.title }}</span>
                      <div class="meta-right">
                        <span class="author">{{ p.author }}</span>
                        <span class="date">{{ p.date }}</span>
                      </div>
                    </div>
                  </template>
                </div>
                <template v-else>
                  <div v-for="group in practicalPPT" :key="group.customer" class="customer-group">
                    <!-- 保留机构信息标题行 -->
                    <div class="customer-title">
                      <span>{{ group.customer }}</span>
                      <span class="customer-meta">{{ group.meta }}</span>
                    </div>
                    <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
                    <template v-if="activeCatalogIds.length === 1">
                      <div v-for="p in group.items" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                        <div class="ppt-group-header">
                          <div class="ppt-group-title" @click="openPractical(p)" style="cursor:pointer">
                            <el-icon><Document /></el-icon> {{ p.title }}
                          </div>
                          <div class="ppt-group-meta">{{ p.date }} · {{ p.author }}</div>
                        </div>
                        <div class="ppt-slides-scroll">
                          <div v-for="slide in p.slides" :key="slide.id" class="slide-card" @click="openPractical(p)">
                            <img :src="slide.img" loading="lazy" />
                            <div class="slide-page-num">P{{ slide.page }}</div>
                          </div>
                        </div>
                      </div>
                    </template>
                    <!-- 选择多个二级目录：合并所有图片，按顺序一行一行排列 -->
                    <template v-else>
                      <div class="ppt-slides-scroll">
                        <div 
                          v-for="(slide, index) in getMergedSlidesForGroup(group)" 
                          :key="slide.id || index" 
                          class="slide-card" 
                          @click="openPractical(slide.parent)"
                        >
                          <img :src="slide.img" loading="lazy" />
                          <div class="slide-page-num">P{{ slide.page }}</div>
                        </div>
                      </div>
                    </template>
                  </div>
                </template>
              </div>
              </div>
            </div>
          </template>
        </div>
      </div>

      <el-dialog 
        v-model="dialogVisible" 
        :show-close="true" 
        :close-on-click-modal="true" 
        :width="'85vw'" 
        class="ppt-dialog"
      >
        <template #header>
          <div class="ppt-header">
            <div class="ppt-title">
              <span
                class="ppt-title-tag"
                :class="dialogType === 'public' ? 'tag-public' : 'tag-practical'"
              >
                {{ dialogType === 'public' ? '公共版' : '实战版' }}
              </span>
              <span class="ppt-title-text">{{ dialogTitle }}</span>
              <span class="ppt-title-meta">创建人：用户名 · 2025/10/20 · 阅读 123</span>
            </div>
            <div class="ppt-actions">
                <el-button size="small">
                  <i class="ri-heart-2-line"></i>
                  收藏 12
                </el-button>
                <el-button size="small" type="primary">
                  <i class="ri-folder-download-line"></i>
                  下载
                </el-button>
                <el-button size="small">加入下载队列</el-button>
                <button class="ai-analyze-btn" type="button" @click="openAiPanel">
                  <i class="ri-quill-pen-ai-line"></i>
                  AI全文分析
                </button>
            </div>
          </div>
        </template>
        <div class="ppt-content" :class="{ 'is-public': dialogType === 'public' }">
          <aside class="ppt-thumbs">
            <div class="ppt-thumbs-header">
              <span class="ppt-thumbs-title">文档目录</span>
              <span class="ppt-thumbs-selected" v-if="selectedSlides.length > 0">已选{{ selectedSlides.length }}</span>
            </div>
            <el-scrollbar height="520px">
              <div 
                v-for="(s, i) in slides" 
                :key="s.id" 
                class="thumb-item" 
                :class="{active: i===activeSlide, selected: selectedSlides.includes(i)}" 
                @click="chooseSlide(i)"
              >
                <div class="thumb-checkbox" @click.stop="toggleSlideSelection(i)">
                  <el-checkbox 
                    :model-value="selectedSlides.includes(i)"
                    @change="toggleSlideSelection(i)"
                    @click.stop
                  />
                </div>
                <div class="thumb-image-wrapper">
                  <img :src="s.img" :alt="s.title" />
                  <div class="thumb-page-number">{{ i + 1 }}</div>
                </div>
              </div>
            </el-scrollbar>
            <div class="ppt-thumbs-footer">
              <el-button type="primary" plain style="width: 100%; margin-bottom: 8px;" @click="analyzeSelectedSlide">
                <el-icon><MagicStick /></el-icon> AI分析
              </el-button>
              <el-button style="width: 100%;">
                <el-icon><Download /></el-icon> 下载
              </el-button>
            </div>
          </aside>
          <section class="ppt-view">
            <div class="ppt-view-list">
              <div 
                v-for="(slide, idx) in slides" 
                :key="slide.id || idx" 
                class="ppt-view-item"
              >
                <img :src="slide.img" :alt="slide.title || slide.id || ('P' + (idx + 1))" />
                <div class="ppt-view-page-number">{{ idx + 1 }}</div>
              </div>
            </div>
          </section>
          <aside class="ppt-side" v-if="aiPanelVisible">
            <div class="side-group">
              <div class="side-title">AI全文分析</div>
              <ul class="side-list">
                <li>自动提取要点：性能优化、数据安全、接口对接</li>
                <li>风险提示：高并发场景需压测，接口权限需收敛</li>
                <li>行动建议：准备定制化演示页，附带压测报告</li>
              </ul>
              <el-button type="primary" size="small" @click="aiPanelVisible = false" style="margin-top: 12px;">关闭</el-button>
            </div>
          </aside>
          <aside class="ppt-side" v-else-if="dialogType === 'practical'">
            <div class="side-group">
              <div class="side-title">相关交流会议</div>
              <ul class="side-list">
                <li v-for="s in sideInfo.sessions" :key="s.id">
                  <img class="side-thumb" :src="s.thumb" :alt="s.title" />
                  <div class="side-info">
                    <div class="side-line">
                      <span class="s-title">{{ s.title }}</span>
                    </div>
                    <div class="s-meta">{{ s.date }} · 观看 {{ s.view }} · 点赞 {{ s.like }}</div>
                  </div>
                </li>
              </ul>
            </div>
            <div class="side-group">
              <div class="side-title">相似产品ppt</div>
              <ul class="side-list">
                <li v-for="d in sideInfo.docs" :key="d.id">
                  <div class="doc-thumb-wrap">
                    <img class="side-thumb doc-thumb" :src="d.thumb" :alt="d.title" />
                    <span class="doc-tag">{{ d.tag }}</span>
                  </div>
                  <div class="side-info">
                    <div class="doc-title-row">
                      <span class="doc-title">{{ d.title }}</span>
                    </div>
                    <div class="doc-meta-row">
                      <span class="doc-creator">创建者：{{ d.creator }}</span>
                      <span class="doc-date">{{ d.date }}</span>
                    </div>
                    <div class="doc-stats">
                      <span><i class="ri-eye-line"></i>{{ d.view }}</span>
                      <span><i class="ri-thumb-up-line"></i>{{ d.like }}</span>
                      <span><i class="ri-chat-3-line"></i>{{ d.comment }}</span>
                    </div>
                  </div>
                </li>
              </ul>
            </div>
            <div class="side-group">
              <div class="side-title">相关交流</div>
              <ul class="side-list">
                <li v-for="e in sideInfo.exchanges" :key="e.id">
                  <span class="doc-title">{{ e.title }}</span>
                  <span class="s-meta">{{ e.date }}</span>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </el-dialog>
      
      <!-- 使用统一的 PptDialog 组件（推荐使用） -->
      <PptDialog
        v-model:visible="dialogs.dialogVisible.value"
        :type="dialogs.dialogType.value"
        :title="dialogs.dialogTitle.value"
        :slides="dialogs.slides.value"
        :isResponseDialog="dialogs.isResponseDialog.value"
        documentId=""
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { MagicStick, Download, Document } from '@element-plus/icons-vue'
import Header from './components/Header.vue'
import ProductCatalogPanel from './components/ProductCatalogPanel.vue'
import CommonFilters from './components/CommonFilters.vue'
import PptGrid from './components/PptGrid.vue'
import PptDialog from './components/PptDialog.vue'
import { AUDIENCES } from '@/configs/salesConstants'
import { useDialogs } from './composables/useDialogs'
import { useProductCatalogs } from './composables/useProductCatalogs'
import { useFilters } from './composables/useFilters'
import { useGlobalCatalogOptions } from './composables/useGlobalCatalogOptions'

const route = useRoute()
// 创建独立的 dialogs 实例（因为 Product.vue 是独立页面）
const dialogs = useDialogs()

// 产品 code：优先用 route.query.product，无参数时在 onMounted 里用接口取第一个产品
const activeProduct = ref((route.query.product as string) || '')
const activeCatalogIds = ref<string[]>([])
const catalogMode = ref('single')
const dialogVisible = ref(false)
const dialogTitle = ref('')
const isExpanded = ref(false) // 展开/收起状态
const activeSlide = ref(0)
const dialogType = ref('public')
const selectedSlides = ref<number[]>([])
const aiPanelVisible = ref(false)

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({
  version: null, // 版本筛选
  audience: null // 交流对象筛选
})
const selectedSort = ref<string>('latest')

// 行业领域标签
const industryTags = [
  { id: 'national', name: '全国/股份制/政策性银行' },
  { id: 'city', name: '城商行' },
  { id: 'foreign', name: '外资行' },
  { id: 'rural', name: '农商' },
  { id: 'finance', name: '财务公司' },
  { id: 'trust', name: '信托公司' },
  { id: 'auto', name: '汽车/消费金融' },
  { id: 'leasing', name: '金融租赁' }
]

// 版本选项
const versions = [
  { id: 'public', name: '公共版' },
  { id: 'practical', name: '实战版' }
]

// 交流对象选项
const audiences = [
  ...AUDIENCES.map(audience => ({ id: audience.value, name: audience.label }))
]

// 排序选项
const sortOptions = [
  { id: 'latest', name: '最新更新' },
  { id: 'likes', name: '点赞量' },
  { id: 'usage', name: '使用度' }
]

// 筛选组配置（版本和交流对象筛选）
const filterGroups = computed(() => [
  {
    key: 'version',
    label: '版本',
    icon: 'ri-file-copy-line',
    options: versions
  },
  {
    key: 'audience',
    label: '交流对象',
    icon: 'ri-user-line',
    options: audiences
  }
])

// 处理行业变化（同步到 useFilters）
const handleIndustryChange = (industryId: string | null) => {
  selectedIndustry.value = industryId
  // 同步到 pptFilters
  if (industryId) {
    filters.pptFilters.industry = [industryId]
  } else {
    filters.pptFilters.industry = []
  }
}

// 处理筛选值变化（同步到 useFilters）
const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
  
  // 版本筛选
  if (values.version) {
    filters.filterVersion.value = values.version
  } else {
    filters.filterVersion.value = null
  }
  
  // 交流对象筛选
  if (values.audience) {
    filters.pptFilters.audience = [values.audience]
  } else {
    filters.pptFilters.audience = []
  }
}

// 处理排序变化
const handleSortChange = (sortId: string) => {
  selectedSort.value = sortId
  // TODO: 实现排序逻辑（如果需要）
}

// 处理选择客户（暂不实现）
const handleSelectCustomer = () => {
  console.log('[Product.vue] 选择客户功能待实现')
  // TODO: 实现客户选择逻辑
}

// 处理选择产品（暂不实现）
const handleSelectProduct = () => {
  console.log('[Product.vue] 选择产品功能待实现')
  // TODO: 实现产品选择逻辑
}

// 🆕 使用 composables 获取数据
// 初始化筛选器（传入空数据源和当前产品）
const filters = useFilters({ pptList: [], videoList: [], questions: [], tenderFiles: [], responseFiles: [] }, activeProduct)

// 获取全局 PPT 目录树（用于目录面板展示）
const { catalogs: pptCatalogTree } = useGlobalCatalogOptions()

// useProductCatalogs 需要一个空 filters ref（Product 页面的筛选已经通过 CommonFilters 实现）
const emptyFilters = ref<Record<string, never>>({})
// 使用 useProductCatalogs 获取当前产品的 PPT 数据
const catalogState = useProductCatalogs(activeProduct, emptyFilters)

// 目录树：转换 API 树结构为 ProductCatalogPanel 所需格式
const catalog = computed(() => {
  if (!pptCatalogTree.value || pptCatalogTree.value.length === 0) {
    return []
  }
  // API 树：[{id, name, children: [{code, name}]}]
  // 组件需要：[{id, text, children: [{id, text}]}]
  return pptCatalogTree.value.map((parent: any) => ({
    id: parent.id,
    text: parent.name,
    children: (parent.children || []).map((child: any) => ({
      id: child.code, // 使用 code 作为 id
      text: child.name
    }))
  }))
})

// publicPPT：选择目录后显示。有 product= 时带 slides；所有产品时用 filters 结果做卡片列表
const publicPPT = computed(() => {
  if (!activeProduct.value) {
    const raw = (filters.filteredPPT as any)?.value
    const list = Array.isArray(raw) ? raw : []
    return list.filter((x: any) => x.tag === '公共版').map((x: any) => ({
      id: x.id,
      title: x.title,
      type: activeCatalogIds.value.length > 0 ? 'ppt-cover' : 'ppt-cover',
      tag: '公共版',
      thumbnail: x.thumbnail || x.cover || '',
      date: x.date || '',
      author: x.author || '',
      product: x.product || ''
    }))
  }
  const docs = catalogState.publicDocuments.value || []
  const thumbnails = catalogState.publicThumbnails.value || []
  return docs.map((doc: any) => {
    const docThumbnails = thumbnails.filter((t: any) => t.documentId === doc.id)
    return {
      id: doc.id,
      title: doc.name,
      type: 'slides',
      tag: '公共版',
      date: doc.updatedAt?.split('T')[0] || '',
      author: doc.createdBy || '',
      product: doc.product?.[0] || activeProduct.value,
      slides: docThumbnails.map((t: any) => ({
        id: t.id,
        page: t.pageNumber,
        img: t.url || ''
      }))
    }
  })
})

// 实战版：概览视图（文件列表）。有 product= 用 catalogState，否则用 filters
const practicalPPTFiles = computed(() => {
  if (!activeProduct.value) {
    const raw = (filters.filteredPPT as any)?.value
    const list = Array.isArray(raw) ? raw : []
    return list.filter((x: any) => x.tag === '实战版').map((x: any) => ({
      id: x.id,
      title: x.title,
      type: 'file',
      tag: '实战版',
      date: x.date || '',
      author: x.author || '',
      product: x.product || ''
    }))
  }
  return catalogState.practicalDocuments.value.map((doc: any) => ({
    id: doc.id,
    title: doc.name,
    type: 'file',
    tag: '实战版',
    date: doc.updatedAt?.split('T')[0] || '',
    author: doc.createdBy || '',
    product: doc.product?.[0] || activeProduct.value
  }))
})

// 实战版：选择目录后（分组格式）。所有产品时无分组接口，返回空或按列表展示
const practicalPPTGroups = computed(() => {
  if (!activeProduct.value) return []
  const groups = catalogState.practicalThumbnailGroups.value || []
  return groups.map((group: any) => ({
    customer: group.customerName || '未知客户',
    meta: `${group.documents?.[0]?.updatedAt?.split('T')[0] || ''} · ${group.documents?.[0]?.createdBy || ''}`,
    items: group.documents?.map((doc: any) => ({
      id: doc.id,
      title: doc.name,
      type: 'slides',
      tag: '实战版',
      date: doc.updatedAt?.split('T')[0] || '',
      author: doc.createdBy || '',
      slides: doc.thumbnails?.map((t: any) => ({
        id: t.id,
        page: t.pageNumber,
        img: t.url || ''
      })) || []
    })) || []
  }))
})

// 为了兼容模板，保留 practicalPPT 作为统一接口（根据 activeCatalogIds 返回不同数据）
const practicalPPT = computed(() => {
  return activeCatalogIds.value.length === 0 ? practicalPPTFiles.value : practicalPPTGroups.value
})

// 所有PPT列表：无 product 参数 = 所有产品（用 getSalesDocumentList）；有 product = 单产品（用 useProductCatalogs）
const allPPTList = computed(() => {
  if (activeProduct.value) {
    const all = [...catalogState.publicDocuments.value, ...catalogState.practicalDocuments.value]
    return all.map((doc: any) => ({
      id: doc.id,
      title: doc.name,
      tag: doc.tag === 'public' ? '公共版' : '实战版',
      thumbnail: doc.cover || '',
      date: doc.updatedAt?.split('T')[0] || '',
      author: doc.createdBy || '',
      product: doc.product?.[0] || activeProduct.value
    }))
  }
  // 所有产品：用 useFilters 的 getSalesDocumentList 结果（filteredPPT 是 ref，取 .value）
  const raw = (filters.filteredPPT as any)?.value
  const list = Array.isArray(raw) ? raw : []
  return list.map((item: any) => ({
    id: item.id,
    title: item.title,
    tag: item.tag || '公共版',
    thumbnail: item.thumbnail || item.cover || '',
    date: item.date || '',
    author: item.author || item.createdBy || '',
    product: item.product || ''
  }))
})

// 分离公共版和实战版 PPT（仅用于默认视图）
const publicPPTList = computed(() => {
  return allPPTList.value.filter((ppt: any) => ppt.tag === '公共版')
})

const practicalPPTList = computed(() => {
  return allPPTList.value.filter((ppt: any) => ppt.tag === '实战版')
})

// 默认只显示一行公共版 PPT（5个），展开后显示全部
const displayedPublicPPT = computed(() => {
  if (isExpanded.value) {
    return publicPPTList.value // 展开后显示所有公共版
  }
  return publicPPTList.value.slice(0, 5) // 默认只显示前5个
})

// 是否有更多公共版 PPT
const hasMorePublicPPT = computed(() => {
  return publicPPTList.value.length > 5
})

// 切换展开/收起
const toggleExpand = () => {
  isExpanded.value = !isExpanded.value
}

const slides = [
  { id: 's1', title: '公司介绍', img: 'https://picsum.photos/seed/slide1/1024/640' },
  { id: 's2', title: '资质认证', img: 'https://picsum.photos/seed/slide2/1024/640' },
  { id: 's3', title: '技术体系', img: 'https://picsum.photos/seed/slide3/1024/640' },
  { id: 's4', title: '产品架构', img: 'https://picsum.photos/seed/slide4/1024/640' },
]

const sideInfo = {
  sessions: [
    { id: 'se1', type: '视频', title: '北京银行 一表通首次交流', date: '25/09/01', view: 100, like: 30, comment: 10, thumb: 'https://picsum.photos/seed/session1/120/80' },
    { id: 'se2', type: '视频', title: '上海银行 数据质量监管二次澄清会', date: '25/09/05', view: 80, like: 20, comment: 6, thumb: 'https://picsum.photos/seed/session2/120/80' },
  ],
  docs: [
    { id: 'd1', title: '北京某行交流宣讲PPT', tag: '公共版', date: '25/09/01', creator: '郑相宜', view: 23, like: 12, comment: 1, thumb: 'https://picsum.photos/seed/doc1/120/90' },
    { id: 'd2', title: '北京某行二次交流纪要.PPT', tag: '实战版', date: '25/09/10', creator: '郑相宜', view: 18, like: 6, comment: 2, thumb: 'https://picsum.photos/seed/doc2/120/90' },
  ],
  exchanges: [
    { id: 'ex1', title: '北京某行—一表通交流', date: '25/08/28' },
    { id: 'ex2', title: '天津某农商—功能演示交流', date: '25/08/30' },
  ],
}

const mergedSlides = computed(() => {
  if (activeCatalogIds.value.length <= 1) return []
  const allSlides = []
  publicPPT.value.forEach(p => {
    if (p.type === 'slides' && p.slides) {
      p.slides.forEach(slide => {
        allSlides.push({
          ...slide,
          parent: p
        })
      })
    }
  })
  return allSlides
})

const getMergedSlidesForGroup = (group) => {
  if (activeCatalogIds.value.length <= 1) return []
  const allSlides = []
  group.items.forEach(p => {
    if (p.type === 'slides' && p.slides) {
      p.slides.forEach(slide => {
        allSlides.push({
          ...slide,
          parent: p
        })
      })
    }
  })
  return allSlides
}

// 🗑️ 旧的 generateSlides 和 updateContent 函数已被 catalogState 替代
/* 旧代码保留供参考：
const generateSlides = (seed, count) => Array.from({length: count}, (_, i) => ({
  id: seed + '_' + i,
  img: `https://picsum.photos/seed/${seed}${i}/320/180`,
  page: i + 1
}))
*/

/* 旧的 updateContent 函数（已不再需要）：
const updateContent = (catIds: string[]) => {
  const ids = Array.isArray(catIds) ? catIds : (catIds ? [catIds] : [])
  activeCatalogIds.value = ids
  const isOverview = ids.length === 0
... (旧的静态数据逻辑已移除，数据现在由 catalogState 自动管理)
*/

const handleCatalogModeChange = (mode) => {
  catalogMode.value = mode
  catalogState.catalogMode.value = mode
  activeCatalogIds.value = []
  catalogState.activeCatalogCodes.value = []
  if (!activeProduct.value) {
    filters.pptFilters.productIntro = []
    filters.loadDocuments(filters.buildDocumentParams(filters.pptFilters))
  }
}

const handleCatalogIdsChange = (ids) => {
  activeCatalogIds.value = ids
  if (activeProduct.value) {
    catalogState.activeCatalogCodes.value = ids
  } else {
    // 所有产品模式：按目录筛选文档列表（同步到 useFilters 并重新请求）
    filters.pptFilters.productIntro = ids || []
    const params = filters.buildDocumentParams(filters.pptFilters)
    filters.loadDocuments(params)
  }
}

const openPpt = (p: any) => {
  // 使用统一的 dialogs composable 打开PPT对话框
  if (dialogs) {
    dialogs.openPpt(p)
  } else {
    // 降级处理：使用本地dialog
    dialogTitle.value = p.title || p.name || ''
    activeSlide.value = 0
    dialogType.value = p.tag === '公共版' ? 'public' : 'practical'
    dialogVisible.value = true
  }
}

const openPractical = (it: any) => {
  // 使用统一的 dialogs composable 打开PPT对话框
  if (dialogs) {
    dialogs.openPpt(it)
  } else {
    // 降级处理：使用本地dialog
    dialogTitle.value = it.title || it.name || ''
    activeSlide.value = 0
    dialogType.value = 'practical'
    dialogVisible.value = true
  }
}

const chooseSlide = (i) => { 
  activeSlide.value = i 
}

const toggleSlideSelection = (i) => {
  const index = selectedSlides.value.indexOf(i)
  if (index > -1) {
    selectedSlides.value.splice(index, 1)
  } else {
    selectedSlides.value.push(i)
  }
}

const openAiPanel = () => {
  aiPanelVisible.value = !aiPanelVisible.value
}

const analyzeSelectedSlide = () => {
  const targetIndex = selectedSlides.value.length ? selectedSlides.value[0] : activeSlide.value
  activeSlide.value = targetIndex
  aiPanelVisible.value = true
}

// 路由带 ?product= 时同步为单产品，不带则为所有产品
watch(() => route.query.product, (code) => {
  activeProduct.value = code ? (code as string) : ''
}, { immediate: true })

onMounted(() => {
  // 无 product 时 useFilters 已会 loadDocuments（所有产品）；有 product 时 useProductCatalogs 会按 product 拉取
})
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
