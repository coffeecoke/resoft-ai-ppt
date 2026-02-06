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
import { salesData } from '@/configs/salesData'
import { AUDIENCES } from '@/configs/salesConstants'
import { useDialogs } from './composables/useDialogs'

const route = useRoute()
// 创建独立的 dialogs 实例（因为 Product.vue 是独立页面）
const dialogs = useDialogs()

const activeProduct = ref(route.query.product as string || '一表通')
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

// 处理行业变化
const handleIndustryChange = (industryId: string | null) => {
  selectedIndustry.value = industryId
}

// 处理筛选值变化
const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
}

// 处理排序变化
const handleSortChange = (sortId: string) => {
  selectedSort.value = sortId
}

// 处理选择客户
const handleSelectCustomer = () => {
  if (dialogs) {
    dialogs.openCustomerSelect()
  }
}

// 处理选择产品
const handleSelectProduct = () => {
  if (dialogs) {
    dialogs.openProductSelect()
  }
}

const catalog = [
  { id: '1', text: '企业信息', children: [
    { id: '1.1', text: '企业基础信息' },
    { id: '1.2', text: '企业资质认证' },
    { id: '1.3', text: '业务条线介绍' },
    { id: '1.4', text: '业务咨询实力' },
    { id: '1.5', text: '技术研发实力' },
    { id: '1.6', text: '工程交付实力' }
  ]},
  { id: '2', text: '监管政策与行业背景', children: [
    { id: '2.1', text: '监管发文与背景分析' },
    { id: '2.2', text: '行业发展趋势' },
    { id: '2.3', text: '监管要求' }
  ]},
  { id: '3', text: '产品解决方案', children: [
    { id: '3.1', text: '客户痛点/难点' },
    { id: '3.2', text: '解决方案概述' },
    { id: '3.3', text: '产品架构设计' },
    { id: '3.4', text: '产品功能详解' },
    { id: '3.5', text: 'Demo 与交互演示' },
    { id: '3.6', text: '产品优势说明' },
    { id: '3.7', text: '产品应用场景' }
  ]},
  { id: '4', text: '部署实施及售后保障', children: [
    { id: '4.1', text: '软硬件资源需求' },
    { id: '4.2', text: '实施服务流程' },
    { id: '4.3', text: '售后服务保障' }
  ]},
  { id: '5', text: '合作案例', children: [
    { id: '5.1', text: '监管合作' },
    { id: '5.2', text: '机构合作' }
  ]},
  { id: '6', text: '其他', children: [] }
]

const publicPPT = ref<any[]>([])
const practicalPPT = ref<any[]>([])
const allPPTList = ref<any[]>([]) // 所有PPT列表（推荐页效果）

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

const generateSlides = (seed, count) => Array.from({length: count}, (_, i) => ({
  id: seed + '_' + i,
  img: `https://picsum.photos/seed/${seed}${i}/320/180`,
  page: i + 1
}))

const updateContent = (catIds: string[]) => {
  const ids = Array.isArray(catIds) ? catIds : (catIds ? [catIds] : [])
  activeCatalogIds.value = ids
  const isOverview = ids.length === 0
  
  // 切换目录时重置展开状态
  if (!isOverview) {
    isExpanded.value = false
  }

  if (isOverview) {
    // 默认显示所有PPT（推荐页效果）- 使用与推荐页相同的数据源
    const allPPT = salesData.pptList || []
    allPPTList.value = allPPT.map((ppt: any) => ({
      ...ppt,
      author: ppt.creator || '未知',
      date: ppt.date || '10-31'
    }))
    
    // 同时保留原有的公共版和实战版数据（用于选择目录后显示）
    publicPPT.value = allPPT
      .filter((ppt: any) => ppt.product === activeProduct.value && ppt.tag === '公共版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '公共库',
        date: ppt.date || '10-31'
      }))
    
    // 如果没有找到匹配的PPT，使用默认数据
    if (publicPPT.value.length === 0) {
      publicPPT.value = [
        {
          id: 'pub_full_1',
          title: `${activeProduct.value} 产品介绍完整版`,
          date: '10-31',
          creator: '公共库',
          author: '公共库',
          tag: '公共版',
          product: activeProduct.value,
          thumbnail: `https://picsum.photos/seed/pub_full_${activeProduct.value}/320/180`
        },
        {
          id: 'pub_full_2',
          title: `${activeProduct.value} 标准版PPT`,
          date: '10-30',
          creator: '公共库',
          author: '公共库',
          tag: '公共版',
          product: activeProduct.value,
          thumbnail: `https://picsum.photos/seed/pub_std_${activeProduct.value}/320/180`
        },
        {
          id: 'pub_full_3',
          title: `${activeProduct.value} 产品演示完整版`,
          date: '10-29',
          creator: '公共库',
          author: '公共库',
          tag: '公共版',
          product: activeProduct.value,
          thumbnail: `https://picsum.photos/seed/pub_demo_${activeProduct.value}/320/180`
        },
        {
          id: 'pub_full_4',
          title: `${activeProduct.value} 功能详解完整版`,
          date: '10-28',
          creator: '公共库',
          author: '公共库',
          tag: '公共版',
          product: activeProduct.value,
          thumbnail: `https://picsum.photos/seed/pub_func_${activeProduct.value}/320/180`
        }
      ]
    }

    // 实战版PPT
    const practicalPPTList = allPPT
      .filter((ppt: any) => ppt.product === activeProduct.value && ppt.tag === '实战版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '未知',
        date: ppt.date || '10-31',
        type: 'file'
      }))
    
    // 如果没有找到匹配的PPT，使用默认数据
    if (practicalPPTList.length === 0) {
      practicalPPT.value = [
        { id: 'file_bh', title: '渤海银行一表通售前交流.ppt', date: '10-28', author: '王总', type: 'file', tag: '实战版', product: activeProduct.value },
        { id: 'file_cz', title: '沧州银行一表通售前交流.ppt', date: '10-26', author: '刘经理', type: 'file', tag: '实战版', product: activeProduct.value },
        { id: 'file_zs', title: '招商银行一表通售前交流.ppt', date: '10-24', author: '陈工', type: 'file', tag: '实战版', product: activeProduct.value },
        { id: 'file_dy', title: '第一银行上海一表通售前交流.ppt', date: '10-20', author: '张工', type: 'file', tag: '实战版', product: activeProduct.value }
      ]
    } else {
      practicalPPT.value = practicalPPTList
    }
  } else {
    publicPPT.value = []
    const practicalMap = new Map()

    ids.forEach(catId => {
      publicPPT.value.push({ 
        id: 'pb_detail_' + catId, 
        title: `${activeProduct.value} 标准介绍 - ${catId}`, 
        date: '10-31', 
        author: '标准化小组',
        type: 'slides', 
        slides: generateSlides('pb_det_' + catId, 3) 
      })

      const addToMap = (customer, item) => {
        if (!practicalMap.has(customer)) practicalMap.set(customer, [])
        practicalMap.get(customer).push(item)
      }

      addToMap('某国有大行', {
        id: 'pc1_' + catId, 
        title: `${activeProduct.value} 汇报 - ${catId} 相关页`, 
        date: '10-25', 
        author: '赵总',
        type: 'slides',
        slides: generateSlides('pc1_' + catId, 2)
      })

      addToMap('某农商行', {
        id: 'pc2_' + catId, 
        title: `${activeProduct.value} 方案 - ${catId} 相关页`, 
        date: '10-22', 
        author: '李工',
        type: 'slides',
        slides: generateSlides('pc2_' + catId, 1)
      })
    })

    practicalPPT.value = Array.from(practicalMap.entries()).map(([customer, items]) => {
      const first = items && items.length ? items[0] : null
      const meta = first ? `${first.date} · ${first.author}` : ''
      return { customer, items, meta }
    })
  }
}

const handleCatalogModeChange = (mode) => {
  catalogMode.value = mode
  activeCatalogIds.value = []
  updateContent([])
}

const handleCatalogIdsChange = (ids) => {
  activeCatalogIds.value = ids
  updateContent(ids)
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

watch(catalogMode, () => {
  activeCatalogIds.value = []
  updateContent([])
})

onMounted(() => {
  updateContent([])
})
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>
