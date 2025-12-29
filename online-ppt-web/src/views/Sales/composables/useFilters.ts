/**
 * useFilters
 * 管理所有筛选逻辑和筛选结果计算
 */

import { reactive, computed, ref } from 'vue'
import type { Ref } from 'vue'

export function useFilters(dataSource: any, activeProduct: Ref<string>) {
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
  
  // 推荐页面 - 筛选PPT
  const filteredPPT = computed(() => {
    let list = dataSource.pptList
    if (filterVersion.value === 'public') list = list.filter((x: any) => x.tag === '公共版')
    if (filterVersion.value === 'practical') list = list.filter((x: any) => x.tag === '实战版')
    if (activeProduct.value) list = list.filter((x: any) => x.product === activeProduct.value)
    
    // 应用pptFilters
    if (pptFilters.customerName) {
      const q = pptFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => x.title.toLowerCase().includes(q))
    }
    
    return list
  })
  
  // 推荐页面 - 筛选视频
  const filteredVideos = computed(() => {
    let list = dataSource.videoList
    if (filterVersion.value === 'public') list = list.filter((x: any) => x.tag === '公共版')
    if (filterVersion.value === 'practical') list = list.filter((x: any) => x.tag === '实战版')
    if (activeProduct.value) list = list.filter((x: any) => x.product === activeProduct.value)
    
    // 应用videoFilters
    if (videoFilters.customerName) {
      const q = videoFilters.customerName.trim().toLowerCase()
      list = list.filter((x: any) => x.title.toLowerCase().includes(q))
    }
    
    return list
  })
  
  // 独立PPT页面 - 筛选结果
  const filteredPPTPage = computed(() => {
    return dataSource.pptList
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
    
    // 方法
    resetFilters,
  }
}

