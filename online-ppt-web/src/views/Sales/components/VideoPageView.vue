<template>
  <section class="video-page">
    <h2 class="page-title">交流会议</h2>
    
    <!-- 筛选区域 -->
    <CommonFilters
      :industry-tags="industryTags"
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
    
    <!-- 加载中 -->
    <div v-if="loading" class="video-loading">加载中...</div>
    <!-- 视频卡片网格（交流会议来自 API） -->
    <VideoGrid
      v-else
      :items="gridItems"
      @video-click="handleVideoClick"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
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
const customerNameQuery = ref('')

// 筛选状态
const selectedIndustry = ref<string | null>(null)
const filterValues = ref<Record<string, string | null>>({
  meetingType: null,
  customerType: null,
  audience: null,
  language: null
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

// 行业领域映射（将筛选标签ID映射到中文，用于请求 API）
const industryMap: Record<string, string> = {
  'national': '全国/股份制/政策性银行',
  'city': '城商行',
  'foreign': '外资行',
  'rural': '农商',
  'finance': '财务公司',
  'trust': '信托公司',
  'auto': '汽车/消费金融',
  'leasing': '金融租赁'
}

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
async function fetchList() {
  loading.value = true
  try {
    const industry = selectedIndustry.value ? industryMap[selectedIndustry.value] : undefined
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
      apiList.value = res.data.list
      total.value = res.data.total ?? 0
    } else {
      apiList.value = []
      total.value = 0
    }
  } catch (e) {
    console.error('加载交流会议列表失败', e)
    apiList.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
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

onMounted(() => { fetchList() })
watch([selectedIndustry, filterValues, page], () => { fetchList() }, { deep: true })

// 监听产品筛选变化
watch(() => props.fProduct, () => {
  page.value = 1  // 重置页码
  fetchList()
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
            time: x.start_time != null ? `${Math.floor(x.start_time / 60)}:${String(x.start_time % 60).padStart(2, '0')}` : '',
            content: x.content ?? ''
          }))
        } catch (_) {}
        let qa: any[] = []
        try {
          const qaRes = await getTranscriptionConcerns(d.id) as { data?: any[] }
          const list = qaRes?.data ?? []
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
            expertReviewer: c.expertReviewer ?? ''
          }))
        } catch (_) {}
        const videoDetail = {
          project: d.name,
          customerName: d.customer_name,
          customer: d.customer_name,
          customerType: d.customerTypeName ?? d.customer_type,
          exchangeTime: formatDate(d.completed_at || d.created_at),
          productSolution: d.productName ?? '',
          exchangeTheme: d.name,
          transcript,
          qa,
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
.video-loading {
  padding: 24px;
  text-align: center;
  color: var(--el-text-color-secondary);
}
/* 样式已移至 CommonFilters 组件 */
</style>

