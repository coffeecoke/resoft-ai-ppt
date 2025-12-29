<template>
  <div class="layout profile-page">
    <Header />
    
    <div class="main">
      <!-- 个人信息卡片 -->
      <div class="profile-header card-block">
        <div class="profile-info">
          <div class="profile-avatar">
            <el-avatar :size="80" :src="userInfo.avatar">
              <i class="ri-user-2-fill" style="font-size: 40px; color: #006DF9;"></i>
            </el-avatar>
          </div>
          <div class="profile-details">
            <h2 class="profile-name">{{ userInfo.name }}</h2>
            <div class="profile-meta">
              <span><i class="ri-building-line"></i> {{ userInfo.department }}</span>
              <span><i class="ri-mail-line"></i> {{ userInfo.email }}</span>
              <span><i class="ri-phone-line"></i> {{ userInfo.phone }}</span>
            </div>
            <div class="profile-stats">
              <div class="stat-item">
                <span class="stat-value">{{ userStats.totalSessions }}</span>
                <span class="stat-label">交流会议</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ userStats.totalPPTs }}</span>
                <span class="stat-label">PPT文档</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ userStats.totalDownloads }}</span>
                <span class="stat-label">下载次数</span>
              </div>
              <div class="stat-item">
                <span class="stat-value">{{ userStats.totalCollections }}</span>
                <span class="stat-label">收藏</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 内容标签页 -->
      <el-tabs v-model="activeTab" class="profile-tabs">
        <el-tab-pane label="交流会议" name="sessions">
          <div class="tab-content">
            <div class="session-cards">
              <div 
                v-for="session in filteredSessions" 
                :key="session.id" 
                class="session-card"
              >
                <div class="session-card-layout">
                  <!-- 左侧：视频播放器 -->
                  <div class="session-video-section">
                    <div class="video-thumbnail" @click="openSession(session)">
                      <img :src="session.thumbnail" :alt="session.title" />
                      <div class="play-button-overlay">
                        <div class="play-button">
                          <el-icon><VideoPlay /></el-icon>
                        </div>
                      </div>
                      <div class="video-duration-badge">{{ session.duration }}</div>
                    </div>
                  </div>

                  <!-- 右侧：信息卡片 -->
                  <div class="session-info-section">
                    <h3 class="session-main-title">
                      {{ session.title }}
                      <span class="session-date">{{ session.date }}</span>
                    </h3>
                    <div class="info-cards-grid">
                      <!-- 客户关心 -->
                      <div class="info-card info-card-concern">
                        <div class="info-card-header">
                          <span class="info-card-bullet bullet-blue"></span>
                          <span class="info-card-title">客户关心</span>
                        </div>
                        <ul class="info-card-list">
                          <li v-for="question in getSessionQuestions(session.id)" :key="question.id">
                            {{ question.question }}
                          </li>
                          <li v-if="getSessionQuestions(session.id).length === 0" class="empty-item">暂无数据</li>
                        </ul>
                      </div>

                      <!-- 潜在需求 -->
                      <div class="info-card info-card-need">
                        <div class="info-card-header">
                          <span class="info-card-bullet bullet-orange"></span>
                          <span class="info-card-title">潜在需求</span>
                        </div>
                        <ul class="info-card-list">
                          <li v-for="need in getSessionNeeds(session.id)" :key="need.id">
                            {{ need.title }}
                          </li>
                          <li v-if="getSessionNeeds(session.id).length === 0" class="empty-item">暂无数据</li>
                        </ul>
                      </div>

                      <!-- 交流洞察 -->
                      <div class="info-card info-card-insight">
                        <div class="info-card-header">
                          <span class="info-card-bullet bullet-green"></span>
                          <span class="info-card-title">交流洞察</span>
                        </div>
                        <ul class="info-card-list">
                          <li v-for="insight in getSessionInsights(session.id)" :key="insight.id">
                            {{ insight.description }}
                          </li>
                          <li v-if="getSessionInsights(session.id).length === 0" class="empty-item">暂无数据</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="产品介绍PPT" name="ppts">
          <div class="tab-content">
            <div class="ppt-grid">
              <div 
                v-for="ppt in filteredPPTs" 
                :key="ppt.id" 
                class="ppt-card" 
                style="cursor: pointer;"
              >
                <div class="thumb" @click="openPpt(ppt)">
                  <img :src="ppt.thumbnail" :alt="ppt.title" />
                  <span class="badge" :class="ppt.tag === 'public' ? 'badge-public' : 'badge-practical'">
                    {{ ppt.tag === 'public' ? 'AI生成' : '回传' }}
                  </span>
                </div>
                <div class="meta">
                  <div class="title" @click="openPpt(ppt)">{{ ppt.title }}</div>
                  <div class="sub">{{ ppt.date }} · {{ ppt.author }}</div>
                  <div class="ppt-actions">
                    <el-button size="small" type="primary" plain @click.stop="optimizePpt(ppt)">
                      <el-icon><MagicStick /></el-icon> AI优化
                    </el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="招投标" name="tenders">
          <div class="tab-content">
            <div class="ppt-grid">
              <div class="empty-item" style="text-align:center; padding:40px 0; color:#909399;">
                暂无招投标记录
              </div>
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="收藏" name="collections">
          <div class="tab-content">
            <div class="ppt-grid">
              <div 
                v-for="item in filteredCollections" 
                :key="item.id" 
                class="ppt-card" 
                style="cursor: pointer;"
                @click="openItem(item)"
              >
                <div class="thumb" :class="{ 'is-video': item.type === 'video' }">
                  <img :src="item.thumbnail" :alt="item.title" />
                  <span v-if="item.tag" class="badge" :class="item.tag === 'public' ? 'badge-public' : 'badge-practical'">
                    {{ item.tag === 'public' ? '公共版' : '实战版' }}
                  </span>
                  <div v-if="item.type === 'video'" class="play-icon"><el-icon><VideoPlay /></el-icon></div>
                  <span v-if="item.type === 'video'" class="video-duration">{{ item.duration }}</span>
                </div>
                <div class="meta">
                  <div class="title">{{ item.title }}</div>
                  <div class="sub">{{ item.date }} · {{ item.author || item.customer }}</div>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>


        <el-tab-pane label="下载记录" name="downloads">
          <div class="tab-content">
            <div class="download-list">
              <div 
                v-for="download in downloads" 
                :key="download.id" 
                class="download-item"
              >
                <div class="download-icon">
                  <i v-if="download.type === 'ppt'" class="ri-file-ppt-2-fill" style="color: #FD6330; font-size: 24px;"></i>
                  <i v-else-if="download.type === 'video'" class="ri-video-line" style="color: #006DF9; font-size: 24px;"></i>
                  <i v-else class="ri-file-line" style="color: #909399; font-size: 24px;"></i>
                </div>
                <div class="download-info">
                  <div class="download-title">{{ download.title }}</div>
                  <div class="download-meta">
                    <span>{{ download.date }}</span>
                    <span>{{ download.size }}</span>
                  </div>
                </div>
                <div class="download-actions">
                  <el-button size="small" type="primary" plain @click="reDownload(download)">重新下载</el-button>
                </div>
              </div>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { VideoPlay, MagicStick } from '@element-plus/icons-vue'
import Header from './components/Header.vue'
const router = useRouter()

const activeTab = ref('sessions')
const sessionFilter = ref('all')
const pptFilter = ref('all')
const collectionFilter = ref('all')

// 用户信息
const userInfo = ref({
  name: '张三',
  department: '售前支持部',
  email: 'zhangsan@example.com',
  phone: '138****8888',
  avatar: ''
})

// 用户统计
const userStats = ref({
  totalSessions: 28,
  totalPPTs: 45,
  totalDownloads: 156,
  totalCollections: 32
})

// 交流会议数据
const sessions = ref([
  { 
    id: 's1', 
    title: '一表通产品演示视频 1.mp4', 
    date: '2025-10-31', 
    customer: '某国有大行',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/v1/360/200',
    duration: '38:54'
  },
  { 
    id: 's2', 
    title: '一表通产品演示视频 2.mp4', 
    date: '2025-10-28', 
    customer: '某农商行',
    tag: 'practical',
    thumbnail: 'https://picsum.photos/seed/v2/360/200',
    duration: '42:15'
  },
  { 
    id: 's3', 
    title: '一表通产品演示视频 3.mp4', 
    date: '2025-10-25', 
    customer: '某城商行',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/v3/360/200',
    duration: '35:20'
  },
  { 
    id: 's4', 
    title: '一表通产品演示视频 4.mp4', 
    date: '2025-10-20', 
    customer: '某股份制银行',
    tag: 'practical',
    thumbnail: 'https://picsum.photos/seed/v4/360/200',
    duration: '40:10'
  }
])

// PPT文档数据
const ppts = ref([
  { 
    id: 'p1', 
    title: '一表通产品介绍PPT（标准版）', 
    date: '2025-10-31', 
    author: '售前团队',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/ppt1/320/180'
  },
  { 
    id: 'p2', 
    title: '某国有大行一表通售前交流PPT', 
    date: '2025-10-28', 
    author: '张三',
    tag: 'practical',
    thumbnail: 'https://picsum.photos/seed/ppt2/320/180'
  },
  { 
    id: 'p3', 
    title: '一表通产品功能详解PPT', 
    date: '2025-10-25', 
    author: '售前团队',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/ppt3/320/180'
  },
  { 
    id: 'p4', 
    title: '某农商行一表通方案PPT', 
    date: '2025-10-20', 
    author: '张三',
    tag: 'practical',
    thumbnail: 'https://picsum.photos/seed/ppt4/320/180'
  }
])

// 收藏数据
const collections = ref([
  { 
    id: 'c1', 
    title: '一表通产品介绍PPT（标准版）', 
    date: '2025-10-31', 
    author: '售前团队',
    type: 'ppt',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/col1/320/180'
  },
  { 
    id: 'c2', 
    title: '一表通产品演示视频 1.mp4', 
    date: '2025-10-31', 
    customer: '某国有大行',
    type: 'video',
    tag: 'public',
    thumbnail: 'https://picsum.photos/seed/col2/360/200',
    duration: '38:54'
  },
  { 
    id: 'c3', 
    title: '一表通技术文档', 
    date: '2025-10-28', 
    author: '技术团队',
    type: 'doc',
    thumbnail: 'https://picsum.photos/seed/col3/320/180'
  }
])

// 下载记录
const downloads = ref([
  { 
    id: 'd1', 
    title: '一表通产品介绍PPT（标准版）', 
    date: '2025-10-31 14:30', 
    type: 'ppt',
    size: '15.6 MB'
  },
  { 
    id: 'd2', 
    title: '一表通产品演示视频 1.mp4', 
    date: '2025-10-28 10:20', 
    type: 'video',
    size: '245.8 MB'
  },
  { 
    id: 'd3', 
    title: '某国有大行一表通售前交流PPT', 
    date: '2025-10-25 16:45', 
    type: 'ppt',
    size: '12.3 MB'
  }
])

// 客户关心的问题（按会议ID关联）
const questions = ref([
  {
    id: 'q1',
    sessionId: 's1',
    question: '数据库适配如何保障兼容与安全？',
    answer: '支持主流国产数据库（达梦、人大金仓）及MySQL/PostgreSQL。通过数据加密传输、细粒度权限控制及审计日志保障数据安全。',
    views: 1205,
    likes: 88
  },
  {
    id: 'q2',
    sessionId: 's1',
    question: '系统部署需要哪些资源与参数？',
    answer: '建议配置：8核CPU，32G内存，500G SSD硬盘。支持Docker容器化及K8s集群部署，需开放80/443及业务端口。',
    views: 980,
    likes: 65
  },
  {
    id: 'q3',
    sessionId: 's2',
    question: '成本投入及预算范围如何估算？',
    answer: '根据部署规模（节点数）及功能模块（基础版/高级版）定价。一般包含软件授权费、实施服务费及年度维保费。',
    views: 1560,
    likes: 120
  }
])

// AI生成客户潜在需求（按会议ID关联）
const aiNeeds = ref([
  {
    id: 'n1',
    sessionId: 's1',
    title: '数据治理自动化需求',
    description: '客户在交流中多次提及数据质量管理和自动化治理流程，表现出对自动化数据清洗、质量检测和治理流程优化的强烈需求。',
    confidence: 85,
    tags: ['数据治理', '自动化', '数据质量']
  },
  {
    id: 'n2',
    sessionId: 's2',
    title: '实时数据同步能力',
    description: '客户关注点集中在实时数据同步和增量更新机制，希望实现跨系统的实时数据流转，减少数据延迟。',
    confidence: 78,
    tags: ['实时同步', '增量更新', '数据流转']
  },
  {
    id: 'n3',
    sessionId: 's3',
    title: '多租户架构支持',
    description: '客户询问了多租户架构的实现方式，表明可能需要为不同业务部门或子公司提供独立的数据空间和权限管理。',
    confidence: 72,
    tags: ['多租户', '权限管理', '数据隔离']
  }
])

// AI分析后的交流洞察（按会议ID关联）
const insights = ref([
  {
    id: 'i1',
    sessionId: 's1',
    title: '客户对数据安全高度重视',
    description: '在交流过程中，客户多次强调数据安全的重要性，特别是在数据加密、访问控制和审计日志方面提出了详细要求。这表明客户对数据安全合规性有较高标准。',
    type: 'opportunity',
    actions: [
      '准备详细的数据安全方案文档',
      '安排数据安全专家进行深度交流',
      '提供相关合规认证材料'
    ]
  },
  {
    id: 'i2',
    sessionId: 's2',
    title: '系统性能存在担忧',
    description: '客户对系统在高并发场景下的性能表现表示担忧，特别是在数据量较大的情况下。需要重点关注性能优化方案和实际案例。',
    type: 'risk',
    actions: [
      '提供性能测试报告和基准数据',
      '安排性能优化专题交流',
      '展示同类客户的性能表现案例'
    ]
  },
  {
    id: 'i3',
    sessionId: 's3',
    title: '建议提供定制化演示',
    description: '基于客户的具体业务场景，建议准备针对性的演示内容，重点展示与客户业务相关的功能模块，提高演示的针对性和说服力。',
    type: 'suggestion',
    actions: [
      '收集客户具体业务场景信息',
      '准备定制化演示方案',
      '安排业务专家参与演示'
    ]
  }
])

// 获取会议相关的问题
const getSessionQuestions = (sessionId) => {
  return questions.value.filter(q => q.sessionId === sessionId)
}

// 获取会议相关的需求
const getSessionNeeds = (sessionId) => {
  return aiNeeds.value.filter(n => n.sessionId === sessionId)
}

// 获取会议相关的洞察
const getSessionInsights = (sessionId) => {
  return insights.value.filter(i => i.sessionId === sessionId)
}

// 筛选后的交流会议
const filteredSessions = computed(() => {
  if (sessionFilter.value === 'all') return sessions.value
  return sessions.value.filter(s => s.tag === sessionFilter.value)
})

// 筛选后的PPT
const filteredPPTs = computed(() => {
  if (pptFilter.value === 'all') return ppts.value
  return ppts.value.filter(p => p.tag === pptFilter.value)
})

// 筛选后的收藏
const filteredCollections = computed(() => {
  if (collectionFilter.value === 'all') return collections.value
  return collections.value.filter(c => c.type === collectionFilter.value)
})

const openSession = (session) => {
  // 打开视频播放
  console.log('打开视频:', session)
}

const openPpt = (ppt) => {
  // 跳转到产品页面或打开PPT
  router.push({ path: '/sales/product', query: { q: ppt.title } })
}

const openItem = (item) => {
  if (item.type === 'video') {
    openSession(item)
  } else if (item.type === 'ppt') {
    openPpt(item)
  }
}

const reDownload = (download) => {
  console.log('重新下载:', download)
}

const optimizePpt = (ppt) => {
  router.push({ path: '/ppt/editor', query: { source: 'profile', pptId: ppt.id } })
}
</script>

<style scoped>
.profile-page .main {
  padding: 16px;
}

.profile-header {
  margin-bottom: 20px;
  padding: 24px;
}

.profile-info {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.profile-avatar {
  flex-shrink: 0;
}

.profile-details {
  flex: 1;
}

.profile-name {
  margin: 0 0 12px 0;
  font-size: 24px;
  font-weight: 600;
  color: #1f2d3d;
}

.profile-meta {
  display: flex;
  gap: 24px;
  margin-bottom: 20px;
  color: #606266;
  font-size: 14px;
}

.profile-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-meta i {
  font-size: 16px;
  color: #909399;
}

.profile-stats {
  display: flex;
  gap: 40px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #006DF9;
  line-height: 1;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}

.profile-tabs {
  background: #fff;
  border-radius: 10px;
  padding: 20px;
}

.tab-content {
  margin-top: 20px;
}

.download-list {
  margin-top: 20px;
}

.download-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  margin-bottom: 12px;
  transition: all 0.2s;
}

.download-item:hover {
  border-color: #006DF9;
  box-shadow: 0 2px 8px rgba(0, 109, 249, 0.1);
}

.download-icon {
  flex-shrink: 0;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fb;
  border-radius: 8px;
}

.download-info {
  flex: 1;
}

.download-title {
  font-size: 15px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 6px;
}

.download-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
}

.download-actions {
  flex-shrink: 0;
}

/* PPT卡片操作按钮样式 */
.ppt-card .meta {
  position: relative;
}

.ppt-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}

.ppt-actions .el-button {
  width: 100%;
}

/* 个人页面PPT卡片标签位置调整 */
.profile-page .ppt-card .badge {
  left: 10px;
  right: auto;
  top: 10px;
}

/* 交流会议卡片样式 */
.session-cards {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.session-card {
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 12px;
  padding: 20px;
  transition: all 0.2s;
}

.session-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.session-card-layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 24px;
}

/* 左侧视频区域 */
.session-video-section {
  flex-shrink: 0;
}

.video-thumbnail {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: #f0f3f7;
  cursor: pointer;
  margin-bottom: 0;
}

.video-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.play-button-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  transition: background 0.2s;
}

.video-thumbnail:hover .play-button-overlay {
  background: rgba(0, 0, 0, 0.4);
}

.play-button {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #006DF9;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28px;
  box-shadow: 0 4px 12px rgba(0, 109, 249, 0.4);
  transition: transform 0.2s;
}

.video-thumbnail:hover .play-button {
  transform: scale(1.1);
}

.video-duration-badge {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
}


/* 右侧信息区域 */
.session-info-section {
  flex: 1;
}

.session-main-title {
  font-size: 16px;
  font-weight: 600;
  color: #006DF9;
  margin: 0 0 10px 0;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 12px;
}

.session-date {
  font-size: 14px;
  font-weight: normal;
  color: #909399;
}

.info-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.info-card {
  background: #f9fafb;
  border: 1px solid #eef2f6;
  border-radius: 8px;
  padding: 10px 16px;
}

.info-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.info-card-bullet {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.bullet-blue {
  background: #006DF9;
}

.bullet-orange {
  background: #FF6A00;
}

.bullet-green {
  background: #67C23A;
}

.info-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2d3d;
}

.info-card-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.info-card-list li {
  font-size: 13px;
  color: #4b5563;
  line-height: 18px;
  margin-top: 5px;
  margin-bottom: 5px;
  padding: 0 0 0 15px;
  position: relative;
}

.info-card-list li::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 4px;
  height: 4px;
  border-radius: 50%;
}

.info-card-concern .info-card-list li::before {
  background: #006DF9;
}

.info-card-need .info-card-list li::before {
  background: #FF6A00;
}

.info-card-insight .info-card-list li::before {
  background: #67C23A;
}

.info-card-list li:last-child {
  margin-bottom: 0;
}

.info-card-list li.empty-item {
  color: #909399;
  font-style: italic;
}

/* 内联问题列表样式 */
.question-list-inline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-item-inline {
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.question-item-inline:hover {
  border-color: #006DF9;
}

.question-item-inline.active {
  border-color: #006DF9;
  background: #fbfcff;
}

.question-header-inline {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.question-icon-inline {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.question-content-inline {
  flex: 1;
}

.question-title-inline {
  font-size: 14px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 6px;
  line-height: 1.5;
}

.question-item-inline.active .question-title-inline {
  color: #006DF9;
}

.question-meta-inline {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #909399;
}

.question-meta-inline span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.question-answer-inline {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef2f6;
}

.answer-text-inline {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

/* 内联AI需求样式 */
.ai-need-list-inline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-need-item-inline {
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  padding: 12px;
  background: #f9fafb;
}

.ai-need-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.ai-need-title-inline {
  font-size: 14px;
  font-weight: 500;
  color: #1f2d3d;
}

.ai-confidence-inline {
  font-size: 12px;
  color: #006DF9;
  font-weight: 500;
}

.ai-need-description-inline {
  margin-bottom: 8px;
}

.description-text-inline {
  font-size: 13px;
  color: #4b5563;
  line-height: 1.6;
}

.ai-need-tags-inline {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

/* 内联洞察样式 */
.insight-list-inline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-item-inline {
  border: 1px solid #e6e8eb;
  border-radius: 6px;
  padding: 12px;
  border-left-width: 3px;
}

.insight-item-inline.opportunity {
  border-left-color: #67C23A;
  background: #f0f9ff;
}

.insight-item-inline.risk {
  border-left-color: #E6A23C;
  background: #fef7e6;
}

.insight-item-inline.suggestion {
  border-left-color: #006DF9;
  background: #f0f7ff;
}

.insight-header-inline {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
}

.insight-icon-inline {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.insight-content-inline {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.insight-title-inline {
  font-size: 14px;
  font-weight: 500;
  color: #1f2d3d;
}

.insight-type-tag-inline {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.insight-type-tag-inline.opportunity {
  background: #e8f5e9;
  color: #67C23A;
}

.insight-type-tag-inline.risk {
  background: #fff3e0;
  color: #E6A23C;
}

.insight-type-tag-inline.suggestion {
  background: #e3f2fd;
  color: #006DF9;
}

.insight-description-inline {
  margin-bottom: 8px;
}

.insight-actions-inline {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eef2f6;
}

.actions-label-inline {
  font-size: 12px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 6px;
}

.actions-list-inline {
  margin: 0;
  padding-left: 18px;
  list-style: disc;
}

.actions-list-inline li {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.8;
  margin-bottom: 2px;
}

/* 客户关心问题列表样式 */
.question-list {
  margin-top: 20px;
}

.question-item {
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.question-item:hover {
  border-color: #006DF9;
  box-shadow: 0 2px 8px rgba(0, 109, 249, 0.1);
}

.question-item.active {
  border-color: #006DF9;
  background: #fbfcff;
}

.question-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.question-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.question-content {
  flex: 1;
}

.question-title {
  font-size: 15px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 8px;
  line-height: 1.5;
}

.question-item.active .question-title {
  color: #006DF9;
}

.question-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
  flex-wrap: wrap;
}

.question-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.question-answer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #eef2f6;
}

.answer-text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
  margin-bottom: 12px;
}

.answer-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
}

.answer-stats span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* AI需求列表样式 */
.ai-need-list {
  margin-top: 20px;
}

.ai-need-item {
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.ai-need-item:hover {
  border-color: #006DF9;
  box-shadow: 0 2px 8px rgba(0, 109, 249, 0.1);
}

.ai-need-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.ai-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f7ff;
  border-radius: 6px;
}

.ai-need-content {
  flex: 1;
}

.ai-need-title {
  font-size: 15px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 8px;
}

.ai-need-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
  flex-wrap: wrap;
  align-items: center;
}

.ai-need-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ai-confidence {
  color: #006DF9;
  font-weight: 500;
}

.ai-need-description {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.description-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 6px;
}

.description-text {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.6;
}

.ai-need-tags {
  margin-top: 12px;
}

/* AI洞察列表样式 */
.insight-list {
  margin-top: 20px;
}

.insight-item {
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  margin-bottom: 12px;
  padding: 16px;
  transition: all 0.2s;
}

.insight-item:hover {
  border-color: #006DF9;
  box-shadow: 0 2px 8px rgba(0, 109, 249, 0.1);
}

.insight-item.opportunity {
  border-left: 3px solid #67C23A;
}

.insight-item.risk {
  border-left: 3px solid #E6A23C;
}

.insight-item.suggestion {
  border-left: 3px solid #006DF9;
}

.insight-header {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 12px;
}

.insight-icon {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.insight-item.opportunity .insight-icon {
  background: #f0f9ff;
}

.insight-item.risk .insight-icon {
  background: #fef7e6;
}

.insight-item.suggestion .insight-icon {
  background: #f0f7ff;
}

.insight-content {
  flex: 1;
}

.insight-title {
  font-size: 15px;
  font-weight: 500;
  color: #1f2d3d;
  margin-bottom: 8px;
}

.insight-meta {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
  flex-wrap: wrap;
  align-items: center;
}

.insight-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.insight-type-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.insight-type-tag.opportunity {
  background: #f0f9ff;
  color: #67C23A;
}

.insight-type-tag.risk {
  background: #fef7e6;
  color: #E6A23C;
}

.insight-type-tag.suggestion {
  background: #f0f7ff;
  color: #006DF9;
}

.insight-description {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.insight-actions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #eef2f6;
}

.actions-label {
  font-size: 13px;
  font-weight: 500;
  color: #606266;
  margin-bottom: 8px;
}

.actions-list {
  margin: 0;
  padding-left: 20px;
  list-style: disc;
}

.actions-list li {
  font-size: 14px;
  color: #4b5563;
  line-height: 1.8;
  margin-bottom: 4px;
}
</style>

