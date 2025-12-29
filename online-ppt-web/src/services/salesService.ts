import salesApi from './salesApi'

// 售前平台业务接口

// 产品相关
export const getProducts = (params?: any) => {
  return salesApi.get('/api/products', { params })
}

export const getProductDetail = (id: string) => {
  return salesApi.get(`/api/products/${id}`)
}

export const searchProducts = (keyword: string) => {
  return salesApi.get('/api/products/search', { params: { q: keyword } })
}

// 问答相关
export const getQAList = (params?: any) => {
  return salesApi.get('/api/qa', { params })
}

export const getQADetail = (id: string) => {
  return salesApi.get(`/api/qa/${id}`)
}

export const searchQA = (keyword: string) => {
  return salesApi.get('/api/qa/search', { params: { q: keyword } })
}

// 推荐内容
export const getRecommendations = (type?: string) => {
  return salesApi.get('/api/recommendations', { params: { type } })
}

// 宣传物料
export const getMaterials = (params?: any) => {
  return salesApi.get('/api/materials', { params })
}

// 音频/视频
export const getMediaList = (params?: any) => {
  return salesApi.get('/api/media', { params })
}

// 用户相关
export const getUserProfile = () => {
  return salesApi.get('/api/user/profile')
}

export const updateUserProfile = (data: any) => {
  return salesApi.put('/api/user/profile', data)
}

// ==================== 以下为新增方法（当前返回Mock数据，后续对接API） ====================
import { salesData } from '@/configs/salesData'

/**
 * 获取产品统计数据
 * TODO: 后续替换为真实API调用
 */
export const getProductStats = async () => {
  // return salesApi.get('/api/product-stats')
  return Promise.resolve(salesData.productStats)
}

/**
 * 获取品牌资料数据
 * TODO: 后续替换为真实API调用
 */
export const getBrandMaterials = async (type?: string) => {
  // return salesApi.get('/api/brand-materials', { params: { type } })
  if (!type) return Promise.resolve(salesData.brandMaterials)
  
  const typeMap: any = {
    company: salesData.brandData.companyItems,
    products: salesData.brandData.productsItems,
    regulations: salesData.brandData.regulationsItems,
    calendar: salesData.brandData.calendarItems,
    compliance: salesData.brandData.complianceItems,
    general: salesData.brandData.generalItems,
    xinchuang: salesData.brandData.xinchuangItems,
    local: salesData.brandData.localItems,
    bill: salesData.brandData.billItems,
  }
  
  return Promise.resolve(typeMap[type] || [])
}

/**
 * 获取PPT列表
 * TODO: 后续替换为真实API调用
 */
export const getPPTList = async (params?: any) => {
  // return salesApi.get('/api/ppt-list', { params })
  return Promise.resolve(salesData.pptList)
}

/**
 * 获取视频列表
 * TODO: 后续替换为真实API调用
 */
export const getVideoList = async (params?: any) => {
  // return salesApi.get('/api/video-list', { params })
  return Promise.resolve(salesData.videoList)
}

/**
 * 获取招标文件列表
 * TODO: 后续替换为真实API调用
 */
export const getTenderFiles = async (params?: any) => {
  // return salesApi.get('/api/tender-files', { params })
  return Promise.resolve(salesData.tenderFiles)
}

/**
 * 获取响应文件列表
 * TODO: 后续替换为真实API调用
 */
export const getResponseFiles = async (params?: any) => {
  // return salesApi.get('/api/response-files', { params })
  return Promise.resolve(salesData.responseFiles)
}

/**
 * 获取问题列表
 * TODO: 后续替换为真实API调用
 */
export const getQuestions = async (params?: any) => {
  // return salesApi.get('/api/questions', { params })
  return Promise.resolve(salesData.questions)
}

/**
 * 获取产品目录结构
 * TODO: 后续替换为真实API调用
 */
export const getProductCatalog = async (productName?: string) => {
  // return salesApi.get('/api/product-catalog', { params: { product: productName } })
  return Promise.resolve(salesData.productCatalog)
}

/**
 * 获取公司组织结构
 * TODO: 后续替换为真实API调用
 */
export const getCompanyStructure = async () => {
  // return salesApi.get('/api/company-structure')
  return Promise.resolve(salesData.companyStructure)
}

/**
 * 获取视频详情
 * TODO: 后续替换为真实API调用
 */
export const getVideoDetail = async (id: string) => {
  // return salesApi.get(`/api/video/${id}`)
  return Promise.resolve(salesData.videoDetail)
}

/**
 * 获取响应文件目录结构
 * TODO: 后续替换为真实API调用
 */
export const getResponseToc = async () => {
  // return salesApi.get('/api/response-toc')
  return Promise.resolve(salesData.responseTocSections)
}

/**
 * 点赞/点踩问题
 * TODO: 后续替换为真实API调用
 */
export const likeQuestion = async (questionId: number, isLike: boolean) => {
  // return salesApi.post(`/api/questions/${questionId}/like`, { isLike })
  return Promise.resolve({ success: true })
}

/**
 * 下载PPT/文件
 * TODO: 后续替换为真实API调用
 */
export const downloadFile = async (fileId: string, fileType: string) => {
  // return salesApi.get(`/api/files/${fileId}/download`, { params: { type: fileType } })
  return Promise.resolve({ downloadUrl: 'mock-download-url' })
}

// 导出所有方法
export const salesService = {
  // 原有方法
  getProducts,
  getProductDetail,
  searchProducts,
  getQAList,
  getQADetail,
  searchQA,
  getRecommendations,
  getMaterials,
  getMediaList,
  getUserProfile,
  updateUserProfile,
  
  // 新增方法
  getProductStats,
  getBrandMaterials,
  getPPTList,
  getVideoList,
  getTenderFiles,
  getResponseFiles,
  getQuestions,
  getProductCatalog,
  getCompanyStructure,
  getVideoDetail,
  getResponseToc,
  likeQuestion,
  downloadFile,
}
