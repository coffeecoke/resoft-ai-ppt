/**
 * useFilters
 * 管理所有筛选逻辑和筛选结果计算
 */

import { reactive, computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { getSalesDocumentList, type DocumentMetadata, getDocumentCoverUrl } from '@/services/documentService'
import { getTranscriptionList } from '@/services/salesService'
import { SERVER_URL } from '@/services'

export function useFilters(dataSource: any, activeProduct: Ref<string>) {
  // 🆕 从API加载的文档列表
  const documentsFromAPI = ref<DocumentMetadata[]>([])
  const isLoadingDocuments = ref(false)

  // 加载文档列表（支持筛选参数）
  const loadDocuments = async (params?: {
    pageType?: string[]
    industry?: string[]
    audience?: string[]
    language?: string[]
    keyword?: string
  }) => {
    try {
      isLoadingDocuments.value = true
      
      const queryParams: any = {
        status: 'published',
        pageSize: 100, // 暂时一次性加载所有数据
      }
      
      // 添加筛选参数
      if (params?.pageType && params.pageType.length > 0) {
        queryParams.pageType = params.pageType.join(',')
        console.log('[Sales首页] 🔍 PPT目录筛选:', params.pageType)
      }
      if (params?.industry && params.industry.length > 0) {
        queryParams.industry = params.industry.join(',')
        console.log('[Sales首页] 🔍 行业筛选:', params.industry)
      }
      if (params?.audience && params.audience.length > 0) {
        queryParams.audience = params.audience.join(',')
        console.log('[Sales首页] 🔍 交流对象筛选:', params.audience)
      }
      if (params?.language && params.language.length > 0) {
        queryParams.language = params.language.join(',')
        console.log('[Sales首页] 🔍 语言筛选:', params.language)
      }
      if (params?.keyword) {
        queryParams.keyword = params.keyword
        console.log('[Sales首页] 🔍 关键词筛选:', params.keyword)
      }
      
      console.log('[Sales首页] 📤 加载文档请求参数:', queryParams)
      
      const result = await getSalesDocumentList(queryParams)
      documentsFromAPI.value = result.documents
      console.log('[Sales首页] 📦 从API加载文档数量:', result.documents.length)
      console.log('[Sales首页] 📦 加载的文档:', result.documents)
    } catch (error) {
      console.error('[Sales首页] 加载文档失败:', error)
      documentsFromAPI.value = []
    } finally {
      isLoadingDocuments.value = false
    }
  }

  // 🆕 页面加载时获取数据
  loadDocuments()

  // 🆕 交流会议（transcriptions）列表，用于推荐页下方「交流会议」tab
  const transcriptionsList = ref<any[]>([])
  const loadTranscriptions = async () => {
    try {
      const res = await getTranscriptionList({ pageSize: 100 })
      const list = res?.data?.list ?? []
      transcriptionsList.value = list
    } catch (e) {
      console.error('[Sales首页] 加载交流会议列表失败', e)
      transcriptionsList.value = []
    }
  }
  loadTranscriptions()

  // 🆕 将 DocumentMetadata 转换为旧的 PPT 列表格式（保持兼容）
  const pptListFromAPI = computed(() => {
    const result = documentsFromAPI.value.map(doc => {
      // 封面URL处理：后端返回的cover已经是完整路径（如：/snapshots/xxx），
      // 在开发环境中需要加上/api前缀以便Vite代理
      // 在生产环境中，Nginx会处理路由，不需要前缀
      let coverUrl = ''
      if (doc.cover) {
        // 如果cover已经包含完整路径，直接使用
        if (doc.cover.startsWith('http://') || doc.cover.startsWith('https://') || doc.cover.startsWith('/snapshots/')) {
          coverUrl = doc.cover.startsWith('/snapshots/') ? `${SERVER_URL}${doc.cover}` : doc.cover
        } else {
          // 兼容旧格式
          coverUrl = `${SERVER_URL}${doc.cover}`
        }
        console.log('[Sales首页] 📷 封面URL:', doc.id, coverUrl)
      } else {
        console.warn('[Sales首页] ⚠️ 文档缺少封面:', doc.id, doc.name)
      }
      
      return {
        id: doc.id,
        title: doc.name,
        tag: doc.tag === 'public' ? '公共版' : doc.tag === 'practical' ? '实战版' : '公共版',
        product: doc.product?.[0] || '', // 取第一个产品
        customerName: doc.customerName || '',
        industry: doc.industry || [],
        audience: doc.audience || [],
        language: doc.language || '',
        cover: coverUrl,
        thumbnail: coverUrl,  // ← 🆕 添加thumbnail字段，PptGrid组件使用此字段
        date: doc.updatedAt ? doc.updatedAt.split('T')[0] : '', // 从 ISO 字符串提取 YYYY-MM-DD
        slideCount: doc.slideCount,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    })
    console.log('[Sales首页] 🔄 转换后的PPT列表数量:', result.length)
    console.log('[Sales首页] 📦 转换后的PPT列表:', result)
    return result
  })

  // PPT筛选条件
  const pptFilters = reactive({
    customerName: '',
    productSolution: null as string | null,
    productIntro: [] as string[],
    industry: [] as string[],
    audience: [] as string[],
    language: [] as string[],
  })
  
  
  // 视频筛选条件
  const videoFilters = reactive({
    customerName: '',
    customerType: [] as string[],
    meetingType: [] as string[],
    participants: [] as string[],
    ourParticipants: [] as string[],
  })
  
  // QA筛选条件
  const qaFilters = reactive({
    customerName: '',
    customerIndustry: [] as string[],
    questioner: [] as string[],
    exchangeStage: [] as string[],
    userNeeds: [] as string[],
    questionType: [] as string[],
  })
  
  // 招标文件筛选条件
  const tenderFilters = reactive({
    customerName: '',
    procurementMethod: [] as string[],
    projectOverview: [] as string[],
    technicalRequirements: [] as string[],
    qualificationReview: [] as string[],
    contractBusiness: [] as string[],
  })
  
  // 响应文件筛选条件
  const responseFilters = reactive({
    customerName: '',
    quotation: [] as string[],
    bidStatus: [] as string[],
    businessQualification: [] as string[],
    technicalSolution: [] as string[],
    implementationGuarantee: [] as string[],
    casesProof: [] as string[],
  })
  
  // 独立页面筛选条件
  const filterVersion = ref<string | null>(null)
  
  // 推荐页面 - 筛选PPT（只使用API数据）
  const filteredPPT = computed(() => {
    // 🔍 调试信息
    console.log('[Sales首页] 🎯 filteredPPT 计算:')
    console.log('  - pptListFromAPI 数量:', pptListFromAPI.value.length)
    
    // ✅ 只使用API数据，不再使用Mock数据作为fallback
    let list = pptListFromAPI.value
    console.log('  - 使用数据源: API')
    console.log('  - 初始列表数量:', list.length)
    
    // 基础筛选：版本和产品
    if (filterVersion.value === 'public') list = list.filter((x: any) => x.tag === '公共版')
    if (filterVersion.value === 'practical') list = list.filter((x: any) => x.tag === '实战版')
    // ⚠️ 注意：activeProduct.value 是 product code，x.product 也必须是 code（通过数据迁移脚本确保）
    if (activeProduct.value) list = list.filter((x: any) => x.product === activeProduct.value)
    
    // 应用高级筛选条件
    // 1. 客户名称（搜索标题和客户名称）
    if (pptFilters.customerName) {
      const q = pptFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => 
        x.title.toLowerCase().includes(q) || 
        (x.customerName && x.customerName.toLowerCase().includes(q))
      )
    }
    
    // 2. 行业筛选（多选，满足任一即可）
    if (pptFilters.industry && pptFilters.industry.length > 0) {
      list = list.filter((x: any) => {
        if (!x.industry || !Array.isArray(x.industry)) return false
        return pptFilters.industry.some(filterIndustry => 
          x.industry.includes(filterIndustry)
        )
      })
    }
    
    // 3. 交流对象筛选（多选，满足任一即可）
    if (pptFilters.audience && pptFilters.audience.length > 0) {
      list = list.filter((x: any) => {
        if (!x.audience || !Array.isArray(x.audience)) return false
        return pptFilters.audience.some(filterAudience => 
          x.audience.includes(filterAudience)
        )
      })
    }
    
    // 4. 语言筛选（多选，满足任一即可；兼容中文/英文与 English/Chinese 等写法）
    if (pptFilters.language && pptFilters.language.length > 0) {
      const langMap: Record<string, string[]> = { '中文': ['中文', 'Chinese', 'zh'], '英文': ['英文', 'English', 'en'] }
      list = list.filter((x: any) => {
        if (!x.language) return false
        const docLang = (x.language || '').trim()
        return pptFilters.language.some((selected: string) => {
          if (selected === docLang) return true
          const aliases = langMap[selected]
          return aliases && aliases.includes(docLang)
        })
      })
    }
    
    // 5. PPT目录筛选（productIntro）- 暂时保留，等待后续实现
    // TODO: 需要后端支持目录筛选或者通过其他方式实现
    
    console.log('  - 筛选后数量:', list.length)
    return list
  })
  
  // 根据 pptFilters 构建 API 请求参数（与 watch / 父组件共用）
  const buildDocumentParams = (pf: typeof pptFilters): Record<string, unknown> => {
    const params: any = {}
    if (pf.productIntro && pf.productIntro.length > 0) params.pageType = pf.productIntro
    if (pf.industry && pf.industry.length > 0) params.industry = pf.industry
    if (pf.audience && pf.audience.length > 0) params.audience = pf.audience
    if (pf.language && pf.language.length > 0) params.language = pf.language
    if (pf.customerName && pf.customerName.trim() !== '') params.keyword = pf.customerName
    return params
  }

  // 监听筛选条件变化，重新加载数据（直接深度监听 pptFilters，确保子组件修改能触发）
  watch(
    pptFilters,
    (newVal) => {
      const params = buildDocumentParams(newVal)
      console.log('[Sales首页] 🔄 筛选条件变化，重新加载数据:', params)
      loadDocuments(params)
    },
    { deep: true }
  )
  
  // 推荐页面 - 交流会议（使用 transcriptions API），映射为 VideoGrid 所需结构
  const transcriptionsMappedForVideo = computed(() => {
    const list = transcriptionsList.value
    const formatDate = (d: string | null) => {
      if (!d) return ''
      const date = new Date(d)
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }
    const formatDuration = (s: number | null) => {
      if (s == null || s < 0) return ''
      const m = Math.floor(s / 60)
      const sec = Math.floor(s % 60)
      return `${m}:${String(sec).padStart(2, '0')}`
    }
    return list.map((row: any) => ({
      id: row.id,
      title: row.name,
      date: formatDate(row.completed_at || row.created_at),
      product: row.productName ?? '',
      industry: row.industry ?? row.industryName ?? '',
      thumbnail: 'https://picsum.photos/seed/' + row.id + '/360/200',
      duration: formatDuration(row.audio_duration),
      __raw: row
    }))
  })

  // 推荐页面 - 筛选视频（数据源改为 transcriptions API，再应用左侧筛选）
  const filteredVideos = computed(() => {
    let list = [...transcriptionsMappedForVideo.value]
    // ⚠️ 注意：activeProduct.value 是 product code
    if (activeProduct.value) {
      list = list.filter((x: any) => x.__raw?.productCode === activeProduct.value || x.__raw?.productName === activeProduct.value)
    }
    if (videoFilters.customerName) {
      const q = videoFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => (x.title || '').toLowerCase().includes(q) || (x.__raw?.customer_name || '').toLowerCase().includes(q))
    }
    return list
  })
  
  // 独立PPT页面 - 筛选结果（只使用API数据）
  const filteredPPTPage = computed(() => {
    // ✅ 只使用API数据
    return pptListFromAPI.value
  })
  
  // 独立视频页面 - 筛选结果
  const filteredVideosPage = computed(() => {
    return dataSource.videoList
  })
  
  // 招标文件列表
  const tenderFiles = computed(() => {
    let list = dataSource.tenderFiles
    
    // 应用tenderFilters
    if (tenderFilters.customerName) {
      const q = tenderFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => x.title.toLowerCase().includes(q))
    }
    
    return list
  })
  
  // 响应文件列表
  const responseFiles = computed(() => {
    let list = dataSource.responseFiles
    
    // 应用responseFilters
    if (responseFilters.customerName) {
      const q = responseFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => x.title.toLowerCase().includes(q))
    }
    
    return list
  })
  
  // 客户关心问题列表（支持按产品筛选）
  const filteredQuestions = computed(() => {
    let list = dataSource.questions
    
    // 如果选择了产品，按产品筛选
    // ⚠️ 注意：activeProduct.value 是 product code，x.product 也必须是 code
    if (activeProduct.value) {
      list = list.filter((x: any) => x.product === activeProduct.value)
    }
    
    // 应用qaFilters
    if (qaFilters.customerName) {
      const q = qaFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => 
        x.question.toLowerCase().includes(q) || 
        x.answer.toLowerCase().includes(q)
      )
    }
    
    return list
  })
  
  // 重置筛选条件
  const resetFilters = (type: string) => {
    switch (type) {
      case 'ppt':
        Object.assign(pptFilters, {
          customerName: '',
          productSolution: null,
          productIntro: [],
          industry: [],
          audience: [],
          language: [],
        })
        break
      case 'video':
        Object.assign(videoFilters, {
          customerName: '',
          customerType: [],
          meetingType: [],
          participants: [],
          ourParticipants: [],
        })
        break
      case 'qa':
        Object.assign(qaFilters, {
          customerName: '',
          customerIndustry: [],
          questioner: [],
          exchangeStage: [],
          userNeeds: [],
          questionType: [],
        })
        break
      case 'tender':
        Object.assign(tenderFilters, {
          customerName: '',
          procurementMethod: [],
          projectOverview: [],
          technicalRequirements: [],
          qualificationReview: [],
          contractBusiness: [],
        })
        break
      case 'response':
        Object.assign(responseFilters, {
          customerName: '',
          quotation: [],
          bidStatus: [],
          businessQualification: [],
          technicalSolution: [],
          implementationGuarantee: [],
          casesProof: [],
        })
        break
    }
  }
  
  return {
    // 筛选条件
    pptFilters,
    videoFilters,
    qaFilters,
    tenderFilters,
    responseFilters,
    filterVersion,
    
    // 筛选结果
    filteredPPT,
    filteredVideos,
    filteredPPTPage,
    filteredVideosPage,
    tenderFiles,
    responseFiles,
    filteredQuestions,
    
    // 🆕 API数据状态
    documentsFromAPI,
    isLoadingDocuments,
    loadDocuments,
    buildDocumentParams,
    
    // 方法
    resetFilters,
  }
}

