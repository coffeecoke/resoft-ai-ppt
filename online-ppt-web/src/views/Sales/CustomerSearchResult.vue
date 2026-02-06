<template>
  <div class="layout product-page customer-search-result-page">
    <Header />
    
    <div class="main">
      <div class="page-title-row">
        <h2 class="page-title">{{ customerName }}</h2>
      </div>

      <!-- 四个模块 -->
      <div class="columns">
        <!-- 模块1：产品介绍PPT -->
        <div class="product-ppt-section">
          <div class="product-ppt-layout">
            <!-- 左侧：产品目录选择面板 -->
            <div class="product-ppt-sidebar">
              <ProductCatalogPanel
                title="产品介绍PPT目录"
                :activeProduct="activeProduct"
                :catalogMode="catalogMode"
                :activeCatalogIds="activeCatalogIds"
                :productCatalog="catalog"
                @update:catalogMode="handleCatalogModeChange"
                @update:activeCatalogIds="handleCatalogIdsChange"
              />
            </div>

            <!-- 右侧：PPT内容区域 -->
            <div class="product-content-main">
              <!-- 默认显示所有PPT（与推荐页效果） -->
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
                  <PptGrid
                    :items="practicalPPTList"
                    :showBadge="true"
                    @item-click="openPpt"
                  />
                </template>
              </template>
              
              <!-- 选择目录后显示详细内容（保持原有逻辑） -->
              <template v-else>
                <div class="public-block card-block">
                  <div class="section-head"><h3>公共版</h3></div>
                  <div class="ppt-groups">
                    <div v-for="p in publicPPT" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                      <div class="ppt-group-header">
                        <div class="ppt-group-title" @click="openPpt(p)" style="cursor:pointer">
                          <el-icon><Document /></el-icon> {{ p.title }}
                        </div>
                      </div>
                      <PptPageView :slides="p.slides" @slide-click="(idx) => openPpt(p, idx)" />
                    </div>
                  </div>
                </div>

                <div class="practical-block card-block">
                  <div class="section-head"><h3>实战版</h3></div>
                  <div class="ppt-groups">
                    <div v-for="p in practicalPPT" :key="p.id" v-show="p.type === 'slides'" class="ppt-group-item">
                      <div class="ppt-group-header">
                        <div class="ppt-group-title" @click="openPpt(p)" style="cursor:pointer">
                          <el-icon><Document /></el-icon> {{ p.title }}
                        </div>
                      </div>
                      <PptPageView :slides="p.slides" @slide-click="(idx) => openPpt(p, idx)" />
                    </div>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 模块2：客户问题 -->
        <div class="qa-aside card-block">
          <div class="section-head">
            <h3>客户问题</h3>
            <el-link>更多</el-link>
          </div>
          <div class="qa-layout-split">
            <div class="qa-left-panel">
              <ul class="qa-list-detail" v-infinite-scroll="loadQa" infinite-scroll-distance="10">
                <li v-for="(q, index) in qaList" :key="index" :class="{active: activeQaIndex === index}">
                  <div class="qa-question" @click="activeQaIndex = index">
                    <i class="ri-question-line" v-if="activeQaIndex !== index"></i>
                    <i class="ri-question-fill" v-else></i>
                    {{ q.q }}
                  </div>
                  <div class="qa-answer" v-if="activeQaIndex === index">
                    <div class="a-text">{{ q.a }}</div>
                    <div class="a-stats">
                      <span><i class="ri-eye-line"></i> {{ q.views }}</span>
                      <span><i class="ri-thumb-up-line"></i> {{ q.likes }}</span>
                    </div>
                  </div>
                </li>
                <li v-if="qaLoading" class="qa-loading"><i class="el-icon-loading"></i> 加载中...</li>
                <li v-if="qaNoMore" class="qa-no-more">没有更多了</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- 模块3和4：交流会议 + 招投标文件/品牌基础资料 -->
      <div class="video-and-aside">
        <div class="video-main">
          <div class="section-head video-section-head">
            <h3>交流会议</h3>
          </div>
          <div class="videos-grid">
            <div 
              v-for="v in videos" 
              :key="v.id" 
              class="ppt-card" 
              style="cursor: pointer;"
              @click="openVideo(v)"
            >
              <div class="thumb is-video">
                <img :src="v.thumbnail" :alt="v.title" />
                <span class="badge" :class="v.tag === 'public' ? 'badge-public' : 'badge-practical'">{{ v.tag === 'public' ? '公共版' : '实战版' }}</span>
                <div class="play-icon"><el-icon><VideoPlay /></el-icon></div>
                <span class="video-duration">{{ v.duration || '38:54' }}</span>
              </div>
              <div class="meta">
                <div class="title">{{ v.title }}</div>
                <div class="sub">{{ v.date }}</div>
              </div>
            </div>
          </div>
        </div>
        <aside class="aside-materials">
          <!-- 上面的模块：招投标文件 -->
          <div class="tender-response-section">
            <div class="section-head aside-section-head">
              <h3>招投标文件</h3>
            </div>
            <el-tabs v-model="tenderResponseTab" class="tender-response-tabs">
              <el-tab-pane label="招标文件" name="tender">
                <div class="aside-cards">
                  <el-card 
                    v-for="item in tenderFilesList" 
                    :key="item.id" 
                    class="aside-card" 
                    shadow="never" 
                    :body-style="{ padding: '0' }"
                    @click="handleTenderFileClick(item)"
                    style="cursor: pointer;"
                  >
                    <div class="material-item">
                      <div class="material-icon">
                        <i class="ri-file-pdf-2-line"></i>
                      </div>
                      <div class="material-info">
                        <div class="m-title">{{ item.title }}</div>
                        <div class="m-date">{{ item.date }}</div>
                      </div>
                    </div>
                  </el-card>
                </div>
              </el-tab-pane>
              <el-tab-pane label="响应文件" name="response">
                <div class="aside-cards">
                  <el-card 
                    v-for="item in responseFilesList" 
                    :key="item.id" 
                    class="aside-card" 
                    shadow="never" 
                    :body-style="{ padding: '0' }"
                    @click="handleResponseFileClick(item)"
                    style="cursor: pointer;"
                  >
                    <div class="material-item">
                      <div class="material-icon">
                        <i class="ri-file-word-line"></i>
                      </div>
                      <div class="material-info">
                        <div class="m-title">{{ item.title }}</div>
                        <div class="m-date">{{ item.date }}</div>
                      </div>
                    </div>
                  </el-card>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
          
          <!-- 下面的模块：品牌基础资料 -->
          <div class="brand-materials-section">
            <div class="section-head aside-section-head">
              <h3>品牌基础资料</h3>
            </div>
            <div class="aside-cards">
              <el-card 
                v-for="m in materialsAside" 
                :key="m.id" 
                class="aside-card" 
                shadow="never" 
                :body-style="{ padding: '0' }"
                @click="handleMaterialClick(m)"
                style="cursor: pointer;"
              >
                <div class="material-item">
                  <div class="material-icon">
                    <i class="ri-file-pdf-2-line"></i>
                  </div>
                  <div class="material-info">
                    <div class="m-title">{{ m.title }}</div>
                    <div class="m-date">{{ m.date }}</div>
                  </div>
                </div>
              </el-card>
            </div>
          </div>
        </aside>
      </div>

      <!-- 对话框组件 -->
      <PptDialog
        v-model:visible="dialogs.dialogVisible.value"
        :type="dialogs.dialogType.value"
        :title="dialogs.dialogTitle.value"
        :slides="dialogs.slides.value"
        :isResponseDialog="dialogs.isResponseDialog.value"
      />
      <VideoDialog
        v-model:visible="dialogs.videoDialogVisible.value"
        :videoDetail="dialogs.videoDetail.value"
        @close="dialogs.closeVideoDialog"
      />
      <PdfDialog
        v-model:visible="dialogs.pdfDialogVisible.value"
        :title="dialogs.pdfDetail.value?.title || ''"
        :pdf-url="dialogs.pdfDetail.value?.pdfUrl || ''"
        :update-date="dialogs.pdfDetail.value?.updateDate || ''"
      />
      <ResponseFileDialog
        v-model:visible="dialogs.responseFileDialogVisible.value"
        :title="dialogs.responseFileTitle.value"
        :slides="dialogs.responseFileSlides.value"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Document, VideoPlay } from '@element-plus/icons-vue'
import Header from './components/Header.vue'
import ProductCatalogPanel from './components/ProductCatalogPanel.vue'
import PptPageView from './components/PptPageView.vue'
import PptGrid from './components/PptGrid.vue'
import PptDialog from './components/PptDialog.vue'
import VideoDialog from './components/VideoDialog.vue'
import PdfDialog from './components/PdfDialog.vue'
import ResponseFileDialog from './components/ResponseFileDialog.vue'
import { useDialogs } from './composables/useDialogs'
import { salesData, createCustomerPptList } from '@/configs/salesData'

const route = useRoute()

// 客户名称（从路由参数获取）
const customerName = computed(() => route.query.q as string || route.query.customer as string || '北京银行')

// 创建独立的 dialogs 实例（因为 CustomerSearchResult.vue 是独立页面）
const dialogs = useDialogs()

// 产品目录相关
const catalogMode = ref('single')
const activeCatalogIds = ref<string[]>([])
const activeProduct = ref('一表通') // 默认产品，可以根据客户筛选
const isExpanded = ref(false) // 展开/收起状态

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

// PPT数据（根据客户名称过滤）
const publicPPT = ref<any[]>([])
const practicalPPT = ref<any[]>([])

// 分离公共版和实战版 PPT（仅用于默认视图）
const publicPPTList = computed(() => {
  return publicPPT.value.filter((ppt: any) => ppt.tag === '公共版')
})

const practicalPPTList = computed(() => {
  return practicalPPT.value.filter((ppt: any) => ppt.tag === '实战版')
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

// 客户问题
const activeQaIndex = ref(0)
const qaList = ref<any[]>([])
const qaLoading = ref(false)
const qaNoMore = ref(false)

// 交流会议（根据客户名称过滤）
// 1. 先显示该客户每个产品的公共版视频（每个产品一个）
// 2. 然后显示所有该客户的实战版视频
const videos = computed(() => {
  const customer = customerName.value
  
  // 从该客户的招投标文件和响应文件中提取产品列表
  const customerProducts = new Set<string>()
  
  // 从招投标文件提取产品
  salesData.tenderFiles.forEach((item: any) => {
    if (item.title.includes(customer) || item.customerName === customer) {
      // 从标题中提取产品名称（假设格式为：客户名+产品名+...）
      const products = ['一表通', '1104', '受益所有人', '反洗钱', '金数', '金数数据质量', '监管集市', '征信', '票据', '支付']
      products.forEach(product => {
        if (item.title.includes(product)) {
          customerProducts.add(product)
        }
      })
    }
  })
  
  // 从响应文件提取产品
  salesData.responseFiles.forEach((item: any) => {
    if (item.bankName === customer || item.title.includes(customer)) {
      if (item.productName) {
        customerProducts.add(item.productName)
      }
    }
  })
  
  // 如果没找到产品，使用默认产品列表
  if (customerProducts.size === 0) {
    customerProducts.add('一表通')
    customerProducts.add('1104')
    customerProducts.add('受益所有人')
  }
  
  // 1. 为每个产品生成一个公共版视频
  const publicVideos = Array.from(customerProducts).map((product, index) => ({
    id: `public_${customer}_${product}_${index}`,
    title: `${customer}${product}产品介绍`,
    date: '10-31',
    tag: 'public', // 用于模板中的判断
    product: product,
    thumbnail: `https://picsum.photos/seed/public_${customer}_${product}/360/200`,
    duration: `${Math.floor(Math.random() * 20) + 15}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
  }))
  
  // 2. 获取所有该客户的实战版视频
  let practicalVideos = salesData.videoList.filter((video: any) => {
    const videoTitle = video.title || ''
    // 标题包含客户名称，且是实战版
    return videoTitle.includes(customer) && (video.tag === '实战版' || video.tag === 'practical')
  }).map((video: any) => ({
    ...video,
    tag: 'practical' // 统一为 'practical' 用于模板判断
  }))
  
  // 如果实战版视频不足，生成一些模拟数据
  if (practicalVideos.length < 5) {
    const practicalTitles = [
      `${customer}一表通产品方案交流会议`,
      `${customer}1104监管报送系统需求调研`,
      `${customer}受益所有人识别系统技术答疑`,
      `${customer}反洗钱智能风控方案讲解`,
      `${customer}金数数据质量平台首次交流`,
      `${customer}监管集市数据服务投标澄清`,
      `${customer}征信数据报送系统高层汇报`,
      `${customer}票据系统建设项目交流会议`
    ]
    
    const additionalPracticalVideos = practicalTitles.slice(0, 8 - practicalVideos.length).map((title, index) => ({
      id: `practical_${customer}_${index}`,
      title: title,
      date: ['10-31', '10-28', '10-25', '10-22', '10-19'][index % 5],
      tag: 'practical',
      product: ['一表通', '1104', '受益所有人', '反洗钱', '金数', '监管集市', '征信', '票据'][index % 8],
      thumbnail: `https://picsum.photos/seed/practical_${customer}_${index}/360/200`,
      duration: `${Math.floor(Math.random() * 30) + 10}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
    }))
    
    practicalVideos = [...practicalVideos, ...additionalPracticalVideos]
  }
  
  // 合并：公共版在前，实战版在后
  return [...publicVideos, ...practicalVideos]
})

// 招投标文件（根据客户名称过滤）
const tenderResponseTab = ref('tender')
const tenderFilesList = computed(() => {
  return salesData.tenderFiles.filter((item: any) => {
    return item.title.includes(customerName.value) || item.customerName === customerName.value
  }).slice(0, 5).map((item: any) => ({
    id: item.id,
    title: item.title,
    date: item.date,
    pdfUrl: item.pdfUrl || '/zbwj.pdf'
  }))
})

const responseFilesList = computed(() => {
  return salesData.responseFiles.filter((item: any) => {
    return item.bankName === customerName.value || item.title.includes(customerName.value)
  }).slice(0, 5).map((item: any) => ({
    id: item.id,
    title: item.title,
    date: item.date,
    type: 'response'
  }))
})

// 品牌基础资料
const materialsAside = [
  { id: 'm1', title: '一表通宣传册（NUPS-GRDC）', date: '2025/10/20', pdfUrl: '/xywn.docx' },
  { id: 'm2', title: '公司介绍2025版', date: '2025/10/20', pdfUrl: '/xywn.docx' },
  { id: 'm3', title: '蓝海方向企业介绍', date: '2025/10/20', pdfUrl: '/xywn.docx' },
]

// 处理函数
const handleCatalogModeChange = (mode: string) => {
  catalogMode.value = mode
}

const handleCatalogIdsChange = (ids: string[]) => {
  activeCatalogIds.value = ids
  updateContent(ids)
}

const updateContent = (catIds: string[]) => {
  const ids = Array.isArray(catIds) ? catIds : (catIds ? [catIds] : [])
  activeCatalogIds.value = ids
  
  // 切换目录时重置展开状态
  if (ids.length > 0) {
    isExpanded.value = false
  }
  
  // 使用 createCustomerPptList 生成包含客户名称的PPT数据
  const customerPPTList = createCustomerPptList(customerName.value, 25) // 生成25个PPT
  
  // 根据目录ID过滤PPT（如果选择了目录，只显示包含该目录ID的PPT）
  let filteredPPT = customerPPTList
  if (ids.length > 0) {
    filteredPPT = customerPPTList.filter((ppt: any) => {
      return ids.some((id: string) => ppt.catalogIds?.includes(id))
    })
  }
  
  if (ids.length === 0) {
    // 概览模式：显示PPT封面卡片
    publicPPT.value = filteredPPT
      .filter((ppt: any) => ppt.tag === '公共版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '公共库',
        date: ppt.date || '10-31',
        type: 'ppt-cover'
      }))
    
    practicalPPT.value = filteredPPT
      .filter((ppt: any) => ppt.tag === '实战版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '未知',
        date: ppt.date || '10-31',
        type: 'ppt-cover'
      }))
  } else {
    // 选择目录后：显示幻灯片组
    publicPPT.value = filteredPPT
      .filter((ppt: any) => ppt.tag === '公共版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '公共库',
        date: ppt.date || '10-31',
        type: 'slides',
        slides: Array.from({ length: 20 }, (_, i) => ({
          id: `s${i + 1}`,
          title: `第 ${i + 1} 页`,
          img: `https://picsum.photos/seed/slide${i + 1}/1024/640`,
          page: i + 1
        }))
      }))
    
    practicalPPT.value = filteredPPT
      .filter((ppt: any) => ppt.tag === '实战版')
      .map((ppt: any) => ({
        ...ppt,
        author: ppt.creator || '未知',
        date: ppt.date || '10-31',
        type: 'slides',
        slides: Array.from({ length: 20 }, (_, i) => ({
          id: `s${i + 1}`,
          title: `第 ${i + 1} 页`,
          img: `https://picsum.photos/seed/slide${i + 1}/1024/640`,
          page: i + 1
        }))
      }))
  }
}

const openPpt = (ppt: any, slideIndex?: number) => {
  dialogs.openPpt(ppt)
  // 生成幻灯片数据
  dialogs.slides.value = Array.from({ length: 20 }, (_, i) => ({
    id: `s${i + 1}`,
    title: `第 ${i + 1} 页`,
    img: `https://picsum.photos/seed/slide${i + 1}/1024/640`
  }))
}

const openVideo = (video: any) => {
  dialogs.videoDetail.value = {
    ...salesData.videoDetail,
    project: video.title,
    customerName: customerName.value,
    productSolution: activeProduct.value
  }
  dialogs.openVideo(video)
}

const handleTenderFileClick = (item: any) => {
  dialogs.openPdf({
    title: item.title,
    pdfUrl: item.pdfUrl,
    date: item.date,
    updateDate: item.date
  })
}

const handleResponseFileClick = (item: any) => {
  dialogs.openResponseFile(item)
}

const handleMaterialClick = (item: any) => {
  dialogs.openPdf({
    title: item.title,
    pdfUrl: item.pdfUrl,
    date: item.date,
    updateDate: item.date
  })
}

const loadQa = () => {
  if (qaLoading.value || qaNoMore.value) return
  
  qaLoading.value = true
  
  // 根据客户名称过滤问题
  const filteredQA = salesData.questions.filter((q: any) => {
    return q.company === customerName.value || 
           q.title?.includes(customerName.value)
  })
  
  setTimeout(() => {
    const startIndex = qaList.value.length
    const endIndex = startIndex + 10
    qaList.value = [...qaList.value, ...filteredQA.slice(startIndex, endIndex)]
    qaLoading.value = false
    
    if (endIndex >= filteredQA.length) {
      qaNoMore.value = true
    }
  }, 500)
}

onMounted(() => {
  updateContent([])
  loadQa()
})
</script>

<style scoped>
</style>
