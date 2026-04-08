<template>
  <section class="video-page">
    <h2 v-if="showHeader" class="page-title">交流会议</h2>

    <!-- 筛选区域（独立页面显示） -->
    <CommonFilters
      v-if="showHeader"

      :selected-industry="selectedIndustry"
      :filter-groups="filterGroups"
      :hidden-filter-groups="hiddenFilterGroups"
      :filter-values="filterValues"
      :sort-options="sortOptions"
      :selected-sort="selectedSort"
      @update:selected-industry="handleIndustryChange"
      @update:filter-values="handleFilterValuesChange"
      @update:selected-sort="handleSortChange"
      @select-customer="handleSelectCustomer"
      @select-product="handleSelectProduct"
    />

    <!-- 加载中（首次加载） -->
    <div v-if="loading && apiList.length === 0" class="video-loading">加载中...</div>

    <!-- 视频卡片网格（交流会议来自 API） -->
    <div v-else ref="scrollContainer" class="video-scroll-container"
         :style="!showHeader ? { maxHeight: 'calc(100vh - var(--sales-header-height))' } : {}"
         @scroll="handleScroll">
      <VideoGrid
        :items="gridItems"
        @video-click="handleVideoClick"
      />

      <!-- 加载更多状态 -->
      <div v-if="loading && apiList.length > 0" class="video-loading-more">
        <i class="ri-loader-4-line spinning"></i>
        加载更多...
      </div>

      <!-- 没有更多数据 -->
      <div v-if="!hasMore && apiList.length > 0" class="video-no-more">
        没有更多数据了
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && apiList.length === 0" class="video-empty">
        <i class="ri-video-line"></i>
        <p>暂无交流会议</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useSalesOptions } from '@/hooks/useSalesOptions'
import { defineProps, defineEmits, inject } from 'vue'
import VideoGrid from './VideoGrid.vue'
import CommonFilters from './CommonFilters.vue'
import { getTranscriptionList, getTranscriptionDetail, getTranscriptionConcerns } from '@/services/salesService'

const props = defineProps({
  filteredVideos: {
    type: Array,
    default: () => []
  },
  fProduct: {
    type: [String, null] as any,
    default: null
  },
  fIndustry: {
    type: [String, null] as any,
    default: null
  },
  showHeader: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits([
  'update:fProduct',
  'update:fIndustry'
])

// 注入dialogs composable
const dialogs: any = inject('dialogs')

// 列表来自 API
const loading = ref(false)
const apiList = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const hasMore = ref(true)
/** 最大保留条数，防止无限滚动导致 DOM/内存溢出 */
const MAX_LIST_ITEMS = 200
const customerNameQuery = ref('')
const scrollContainer = ref<HTMLElement | null>(null)

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({
  meetingType: null,
  customerType: null,
  audience: null,
  language: null
})
const selectedSort = ref<string>('latest')

// 会议类型
const meetingTypes = [
  { id: 'first', name: '首次交流' },
  { id: 'research', name: '需求调研' },
  { id: 'solution', name: '方案讲解' },
  { id: 'technical', name: '技术答疑' },
  { id: 'bid', name: '投标澄清' },
  { id: 'executive', name: '高层汇报' }
]

// 客户类型
const customerTypes = [
  { id: 'new-new', name: '新客户新产品' },
  { id: 'old-new', name: '老客户新产品' },
  { id: 'old-old', name: '老客户老产品' }
]

// 交流对象
const audiences = [
  { id: 'business', name: '业务' },
  { id: 'tech', name: '科技' },
  { id: 'business-leader', name: '业务领导' },
  { id: 'tech-leader', name: '科技领导' }
]

// 语言
const languages = [
  { id: 'chinese', name: '中文' },
  { id: 'english', name: '英文' }
]

// 排序选项
const sortOptions = [
  { id: 'latest', name: '最新更新' },
  { id: 'likes', name: '点赞量' },
  { id: 'usage', name: '使用度' }
]

// 可见的筛选组配置
const filterGroups = computed(() => [
  {
    key: 'meetingType',
    label: '会议类型',
    icon: 'ri-calendar-line',
    options: meetingTypes
  },
  {
    key: 'customerType',
    label: '客户类型',
    icon: 'ri-user-line',
    options: customerTypes
  }
])

// 隐藏的筛选组配置（通过"更多"按钮显示）
const hiddenFilterGroups = computed(() => [
  {
    key: 'audience',
    label: '交流对象',
    icon: 'ri-team-line',
    options: audiences
  },
  {
    key: 'language',
    label: '语言',
    icon: 'ri-global-line',
    options: languages
  }
])

// selectedIndustry 已经是中文名（tag.name），直接用于 API 请求
const { load: loadSalesOptions } = useSalesOptions()

// 将筛选选项 id 转为中文（API 使用中文）
function filterValueToName(key: string, id: string | null): string | undefined {
  if (!id) return undefined
  const map: Record<string, { id: string; name: string }[]> = {
    meetingType: meetingTypes,
    customerType: customerTypes,
    audience: audiences,
    language: languages
  }
  const opts = map[key]
  return opts?.find((o) => o.id === id)?.name
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds < 0) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(d: string | null): string {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// 请求列表（筛选参数传中文）
async function fetchList(reset = false) {
  if (loading.value) return
  if (!reset && !hasMore.value) return

  loading.value = true

  // 重置时清空列表并重置页码
  if (reset) {
    page.value = 1
    apiList.value = []
    hasMore.value = true
  }

  try {
    const industry = selectedIndustry.value || undefined
    // 同时传递 productCode 和 productName，后端优先使用 productCode
    const productFilter = props.fProduct || undefined
    const res = await getTranscriptionList({
      page: page.value,
      pageSize: pageSize.value,
      customerName: customerNameQuery.value || undefined,
      productCode: productFilter,
      productName: productFilter,
      industry,
      meeting_type: filterValueToName('meetingType', filterValues.value.meetingType),
      customer_type: filterValueToName('customerType', filterValues.value.customerType),
      audience: filterValueToName('audience', filterValues.value.audience),
      language: filterValueToName('language', filterValues.value.language)
    })
    if (res?.data?.list) {
      if (reset) {
        apiList.value = res.data.list
      } else {
        apiList.value = [...apiList.value, ...res.data.list]
      }
      total.value = res.data.total ?? 0
      // 达到上限后不再加载，防止内存溢出
      if (apiList.value.length >= MAX_LIST_ITEMS) {
        apiList.value = apiList.value.slice(0, MAX_LIST_ITEMS)
        hasMore.value = false
      } else {
        hasMore.value = apiList.value.length < total.value
      }
    } else {
      if (reset) {
        apiList.value = []
      }
      total.value = 0
      hasMore.value = false
    }
  } catch (e) {
    console.error('加载交流会议列表失败', e)
    if (reset) {
      apiList.value = []
    }
    total.value = 0
    hasMore.value = false
  } finally {
    loading.value = false
  }
}

// 处理滚动事件（无限滚动）
const handleScroll = () => {
  if (!scrollContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value

  // 距离底部100px时加载更多
  if (scrollHeight - scrollTop - clientHeight < 100) {
    loadMore()
  }
}

// 加载更多
const loadMore = () => {
  if (loading.value || !hasMore.value) return
  page.value++
  fetchList(false)
}

// 判断是否为视频格式
const videoFormats = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv']
function isVideoFormat(format: string | null): boolean {
  if (!format) return false
  return videoFormats.includes(format.toLowerCase())
}

// 映射为 VideoGrid 所需结构
const gridItems = computed(() => {
  let list = apiList.value.map((row: any) => ({
    id: row.id,
    title: row.name,
    date: formatDate(row.completed_at || row.created_at),
    product: row.productName ?? '',
    industry: row.industry ?? row.industryName ?? '',
    thumbnail: 'https://picsum.photos/seed/' + row.id + '/360/200',
    duration: formatDuration(row.audio_duration),
    isVideo: isVideoFormat(row.audio_format),
    audioFormat: row.audio_format || '',
    __raw: row
  }))
  if (selectedSort.value === 'latest') {
    list = [...list].sort((a: any, b: any) => {
      const ra = a.__raw
      const rb = b.__raw
      const tA = new Date(ra?.completed_at || ra?.created_at || 0).getTime()
      const tB = new Date(rb?.completed_at || rb?.created_at || 0).getTime()
      return tB - tA
    })
  }
  return list
})

onMounted(() => { loadSalesOptions(); fetchList(true) })

// 筛选变化时重置列表
watch([selectedIndustry, filterValues], () => {
  fetchList(true)
}, { deep: true })

// 监听产品筛选变化
watch(() => props.fProduct, () => {
  fetchList(true)
})

// 处理筛选变化
const handleIndustryChange = (tagId: string | null) => {
  selectedIndustry.value = tagId
}

const handleFilterValuesChange = (values: Record<string, string | null>) => {
  filterValues.value = values
}

const handleSortChange = (sortId: string) => {
  selectedSort.value = sortId
}

const handleSelectCustomer = () => {
  // TODO: 实现选择客户功能
  console.log('选择客户')
}

const handleSelectProduct = () => {
  // TODO: 实现选择产品与解决方案功能
  console.log('选择产品与解决方案')
}

const handleVideoClick = async (item: any) => {
  if (!dialogs) return
  const raw = item.__raw
  if (raw?.id) {
    try {
      const res = await getTranscriptionDetail(raw.id) as { data?: any }
      const d = res?.data
      if (d) {
        let transcript: { speaker: string; time: string; content: string }[] = []
        try {
          const arr = d.dialogues ? JSON.parse(d.dialogues) : []
          transcript = arr.map((x: any) => ({
            speaker: x.speaker ?? '',
            time: x.timeRange ?? '',
            content: x.text ?? ''
          }))
        } catch (_) {}
        let qa: any[] = []
        try {
          const qaRes = await getTranscriptionConcerns(d.id) as { data?: any[] }
          const list = qaRes?.data ?? []
          const speakerRolesMap = d.speakerRoles || {}
          const resolveRole = (speakerId: string | null) => {
            if (!speakerId) return null
            const role = speakerRolesMap[speakerId]
            if (role === 'customer') return '客户'
            if (role === 'our_side') return '我方'
            return null
          }
          qa = list.map((c: any) => ({
            q: c.question ?? '',
            question: c.question ?? '',
            answerText: c.answer ?? '',
            summary: c.answer ?? '',
            answer: c.answer ?? '',
            category: c.category ?? '资质与案例',
            time: c.time_range ?? '',
            date: c.date ?? '',
            likes: c.likes ?? 0,
            expertApproved: !!c.expertApproved,
            expertAdvice: c.expertAdvice ?? '',
            expertReviewer: c.expertReviewer ?? '',
            questionRole: resolveRole(c.question_speaker),
            answerRole: resolveRole(c.answer_speaker)
          }))
        } catch (_) {}
        const videoDetail = {
          id: d.id, // 用于音频/视频播放接口
          project: d.name,
          customerName: d.customer_name,
          customer: d.customer_name,
          customerType: d.customerTypeName ?? d.customer_type,
          exchangeTime: formatDate(d.completed_at || d.created_at),
          productSolution: d.productName ?? d.product_name ?? '',
          exchangeTheme: d.name,
          audioDuration: d.audio_duration, // 时长（秒）
          audioFormat: d.audio_format, // 文件格式（mp3, mp4, wav等）
          transcript,
          qa,
          speakerRoles: d.speakerRoles || {}, // 说话人角色映射
          host: '-',
          time: formatDate(d.created_at)
        }
        dialogs.openVideo(videoDetail)
      } else {
        dialogs.openVideo(item)
      }
    } catch (e) {
      console.error('加载交流会议详情失败', e)
      dialogs.openVideo(item)
    }
  } else {
    dialogs.openVideo(item)
  }
}
</script>

<style scoped>
.video-scroll-container {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.video-loading {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}

.video-loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  text-align: center;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.video-no-more {
  padding: 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 14px;
}

.video-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #9ca3af;
}

.video-empty i {
  font-size: 48px;
  margin-bottom: 16px;
  color: #d1d5db;
}

.video-empty p {
  font-size: 16px;
  margin: 0;
}
/* 样式已移至 CommonFilters 组件 */
</style>

