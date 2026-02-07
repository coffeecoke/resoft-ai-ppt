<template>
  <div class="layout product-page product-search-result-page">
    <Header />
    
    <div class="main">
      <div class="page-title-row">
        <h2 class="page-title">{{ keyword }}</h2>
      </div>

      <!-- 高级筛选面板 -->
      <div v-if="showAdvancedFilter" class="advanced-filter-panel">
        <div class="advanced-filter-content">
          <div class="filter-section filter-section-inline">
            <h4 class="filter-section-title">客户名称</h4>
            <div class="filter-options">
              <el-input
                v-model="pptFilters.customerName"
                placeholder="请输入客户名称"
                clearable
                style="width: 200px;"
              />
            </div>
          </div>
          <div class="filter-section filter-section-inline">
            <h4 class="filter-section-title">行业</h4>
            <div class="filter-options">
              <el-checkbox-group v-model="pptFilters.industry">
                <div class="filter-row">
                  <el-checkbox label="全国/股份制/政策性银行">全国/股份制/政策性银行</el-checkbox>
                  <el-checkbox label="城商行">城商行</el-checkbox>
                  <el-checkbox label="外资行">外资行</el-checkbox>
                  <el-checkbox label="农商">农商</el-checkbox>
                  <el-checkbox label="财务公司">财务公司</el-checkbox>
                  <el-checkbox label="信托公司">信托公司</el-checkbox>
                  <el-checkbox label="汽车/消费金融">汽车/消费金融</el-checkbox>
                  <el-checkbox label="金融租赁">金融租赁</el-checkbox>
                  <el-checkbox label="其他">其他</el-checkbox>
                </div>
              </el-checkbox-group>
            </div>
          </div>
          <div class="filter-section filter-section-inline">
            <h4 class="filter-section-title">交流对象</h4>
            <div class="filter-options">
              <el-checkbox-group v-model="pptFilters.audience">
                <div class="filter-row">
                  <el-checkbox label="技术">技术</el-checkbox>
                  <el-checkbox label="技术负责人">技术负责人</el-checkbox>
                  <el-checkbox label="业务">业务</el-checkbox>
                  <el-checkbox label="业务负责人">业务负责人</el-checkbox>
                </div>
              </el-checkbox-group>
            </div>
          </div>
          <div class="filter-section filter-section-inline">
            <h4 class="filter-section-title">语言</h4>
            <div class="filter-options">
              <el-checkbox-group v-model="pptFilters.language">
                <div class="filter-row">
                  <el-checkbox label="中文">中文</el-checkbox>
                  <el-checkbox label="英文">英文</el-checkbox>
                </div>
              </el-checkbox-group>
            </div>
          </div>
        </div>
      </div>

      <div class="columns">
        <div class="product-ppt-section">
          <!-- 产品目录选择面板 -->
          <ProductCatalogPanel
            title="产品介绍PPT目录"
            :activeProduct="keyword"
            :catalogMode="catalogMode"
            :activeCatalogIds="activeCatalogIds"
            :productCatalog="catalog"
            @update:catalogMode="handleCatalogModeChange"
            @update:activeCatalogIds="handleCatalogIdsChange"
          />

          <div class="public-block card-block">
            <div class="section-head"><h3>公共版</h3></div>
            <div class="ppt-groups" :class="{'ppt-summary-grid': activeCatalogIds.length === 0}">
              <!-- 概览模式：显示PPT封面卡片 -->
              <template v-if="activeCatalogIds.length === 0">
                <div v-for="p in publicPPT" :key="p.id" class="ppt-card" @click="openPpt(p)" style="cursor:pointer;" v-show="p.type === 'ppt-cover'">
                  <div class="thumb"><img :src="p.thumbnail" :alt="p.title" /></div>
                  <div class="meta">
                    <div class="title">{{ p.title }}</div>
                    <div class="sub">{{ p.date }} · {{ p.author }}</div>
                  </div>
                </div>
              </template>
              <!-- 选择单个二级目录：显示带标题的幻灯片组 -->
              <template v-else-if="activeCatalogIds.length === 1">
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
    </div>
    
    <!-- PDF 对话框 -->
    <PdfDialog
      v-model:visible="pdfDialogVisible"
      :title="pdfDialogTitle"
      :pdf-url="pdfDialogUrl"
      :update-date="pdfDialogUpdateDate"
      @close="handlePdfDialogClose"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VideoPlay, Filter, MagicStick, Download, Document } from '@element-plus/icons-vue'
import Header from './components/Header.vue'
import ProductCatalogPanel from './components/ProductCatalogPanel.vue'
import PdfDialog from './components/PdfDialog.vue'
import { salesData } from '@/configs/salesData'

const route = useRoute()
const router = useRouter()
const dialogs = inject('dialogs')

const keyword = ref(route.query.q || '')
const activeCatalogIds = ref([])
const catalogMode = ref('single')
const showAdvancedFilter = ref(false)
const pptFilters = reactive({
  customerName: '',
  industry: [],
  audience: [],
  language: []
})
const activeQaIndex = ref(0)
const qaLoading = ref(false)
const qaNoMore = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const activeSlide = ref(0)
const dialogType = ref('public')
const selectedSlides = ref([])
const aiPanelVisible = ref(false)
const pdfDialogVisible = ref(false)
const pdfDialogTitle = ref('')
const pdfDialogUrl = ref('')
const pdfDialogUpdateDate = ref('')
const tenderResponseTab = ref('tender')

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

const publicPPT = ref([])
const practicalPPT = ref([])

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

const qaList = ref([
  { q: '数据库适配如何保障兼容与安全？', a: '支持主流国产数据库（达梦、人大金仓）及MySQL/PostgreSQL。通过数据加密传输、细粒度权限控制及审计日志保障数据安全。', views: 1205, likes: 88 },
  { q: '系统部署需要哪些资源与参数？', a: '建议配置：8核CPU，32G内存，500G SSD硬盘。支持Docker容器化及K8s集群部署，需开放80/443及业务端口。', views: 980, likes: 65 },
  { q: '成本投入及预算范围如何估算？', a: '根据部署规模（节点数）及功能模块（基础版/高级版）定价。一般包含软件授权费、实施服务费及年度维保费。', views: 1560, likes: 120 },
  { q: '与现有系统对接的接口策略？', a: '提供标准RESTful API接口，支持Oauth2.0认证。具备ESB集成能力，可快速对接OA、HR及业务核心系统。', views: 890, likes: 45 },
  { q: '监控告警与运维方案如何落地？', a: '内置Prometheus监控组件，提供可视化运维大屏。支持邮件、短信及钉钉/企微告警推送，具备自动巡检功能。', views: 750, likes: 30 },
])

const allVideos = Array.from({ length: 16 }, (_, i) => ({ 
  id: 'v' + i, 
  title: `${keyword.value} 产品演示视频 ${i + 1}.mp4`, 
  date: '10-31', 
  tag: i % 2 ? 'practical' : 'public', 
  thumbnail: 'https://picsum.photos/seed/vp' + (i + 1) + '/360/200',
  duration: `${Math.floor(Math.random() * 30) + 10}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`
}))

const materialsAside = [
  { id: 'm1', title: '一表通宣传册（NUPS-GRDC）', date: '2025/10/20', pdfUrl: '/xywn.docx' },
  { id: 'm2', title: '公司介绍2025版', date: '2025/10/20', pdfUrl: '/xywn.docx' },
  { id: 'm3', title: '蓝海方向企业介绍', date: '2025/10/20', pdfUrl: '/xywn.docx' },
]

// 招标文件和响应文件列表（根据当前搜索的产品过滤）
const tenderFilesList = computed(() => {
  if (!keyword.value) return []
  
  // 根据产品关键词过滤招标文件（标题中包含产品关键词）
  const filtered = salesData.tenderFiles.filter(item => {
    return item.title.includes(keyword.value)
  })
  
  // 取前5条
  return filtered.slice(0, 5).map(item => ({
    id: item.id,
    title: item.title,
    date: item.date,
    pdfUrl: item.pdfUrl || '/zbwj.pdf'
  }))
})

const responseFilesList = computed(() => {
  if (!keyword.value) return []
  
  // 根据产品名称过滤响应文件
  const filtered = salesData.responseFiles.filter(item => {
    return item.productName === keyword.value
  })
  
  // 取前5条
  return filtered.slice(0, 5).map(item => ({
    id: item.id,
    title: item.title,
    date: item.date,
    type: 'response'
  }))
})

const videos = computed(() => {
  // 筛选当前产品的所有视频
  let filtered = allVideos.filter(v => {
    // 如果视频标题包含产品关键词，或者是当前产品的视频
    return v.title.includes(keyword.value)
  })
  
  // 分离公共版和实战版
  const publicVideos = filtered.filter(v => v.tag === 'public')
  const practicalVideos = filtered.filter(v => v.tag === 'practical')
  
  // 只取第一个公共版视频（如果有的话）
  const publicVideo = publicVideos.length > 0 ? [publicVideos[0]] : []
  
  // 返回：一个公共版 + 所有实战版
  return [...publicVideo, ...practicalVideos]
})

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

const updateContent = (catIds) => {
  const ids = Array.isArray(catIds) ? catIds : (catIds ? [catIds] : [])
  activeCatalogIds.value = ids
  const isOverview = ids.length === 0

  if (isOverview) {
    publicPPT.value = catalog.map(c => ({
      id: 'pub_L1_' + c.id,
      title: `${c.id} ${c.text} (标准拆分版)`,
      date: '2025-10-31',
      author: '公共库',
      type: 'ppt-cover',
      thumbnail: `https://picsum.photos/seed/pub_cover_${c.id}/320/180`
    }))

    practicalPPT.value = [
      { id: 'file_bh', title: '渤海银行一表通售前交流.ppt', date: '2025-10-28', author: '王总', type: 'file' },
      { id: 'file_cz', title: '沧州银行一表通售前交流.ppt', date: '2025-10-26', author: '刘经理', type: 'file' },
      { id: 'file_zs', title: '招商银行一表通售前交流.ppt', date: '2025-10-24', author: '陈工', type: 'file' },
      { id: 'file_dy', title: '第一银行上海一表通售前交流.ppt', date: '2025-10-20', author: '张工', type: 'file' }
    ]
  } else {
    publicPPT.value = []
    const practicalMap = new Map()

    ids.forEach(catId => {
      publicPPT.value.push({ 
        id: 'pb_detail_' + catId, 
        title: `${keyword.value} 标准介绍 - ${catId}`, 
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
        title: `${keyword.value} 汇报 - ${catId} 相关页`, 
        date: '10-25', 
        author: '赵总',
        type: 'slides',
        slides: generateSlides('pc1_' + catId, 2)
      })

      addToMap('某农商行', {
        id: 'pc2_' + catId, 
        title: `${keyword.value} 方案 - ${catId} 相关页`, 
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

const openPpt = (p) => {
  dialogTitle.value = p.title
  activeSlide.value = 0
  dialogType.value = 'public'
  dialogVisible.value = true
}

const openPractical = (it) => {
  dialogTitle.value = it.title
  activeSlide.value = 0
  dialogType.value = 'practical'
  dialogVisible.value = true
}

// 处理宣传资料点击，打开PDF对话框
const handleMaterialClick = (material) => {
  pdfDialogTitle.value = material.title
  pdfDialogUrl.value = material.pdfUrl || '/xywn.docx' // 默认PDF URL，可以根据实际数据调整
  pdfDialogUpdateDate.value = material.date
  pdfDialogVisible.value = true
}

// 关闭PDF对话框
const handlePdfDialogClose = () => {
  pdfDialogVisible.value = false
}

// 处理招标文件点击
const handleTenderFileClick = (item) => {
  pdfDialogTitle.value = item.title
  pdfDialogUrl.value = item.pdfUrl || '/zbwj.pdf'
  pdfDialogUpdateDate.value = item.date
  pdfDialogVisible.value = true
}

// 处理响应文件点击
const handleResponseFileClick = (item) => {
  if (dialogs) {
    dialogs.openPpt(item)
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

const loadQa = () => {
  if (qaLoading.value || qaNoMore.value) return
  qaLoading.value = true
  
  setTimeout(() => {
    if (qaList.value.length >= 20) {
      qaNoMore.value = true
      qaLoading.value = false
      return
    }
    const nextIndex = qaList.value.length + 1
    qaList.value.push({
      q: `如何解决高并发场景下的性能瓶颈（${nextIndex}）？`,
      a: '采用分布式缓存（Redis）、消息队列（Kafka）削峰填谷，以及数据库读写分离架构。必要时引入Service Mesh进行微服务治理。',
      views: 100 + nextIndex,
      likes: 10 + nextIndex
    })
    qaList.value.push({
      q: `私有化部署的硬件配置要求是什么（${nextIndex+1}）？`,
      a: '最低配置：8核16G内存，建议配置：16核32G内存。存储空间需根据数据量预留，建议使用SSD提升I/O性能。',
      views: 90 + nextIndex,
      likes: 5 + nextIndex
    })
    qaLoading.value = false
  }, 1000)
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

