import axios from './config'
import { SERVER_URL } from './index'

// PPT回传参数
export interface UploadSalesPptParams {
  name: string
  customerName?: string
  product?: string[]
  industry?: string[]
  audience?: string[]
  audienceNames?: string // 🆕 交流对象人员姓名
  language?: string
  slides: any[]
}

// PPT列表项（复用DocumentMetadata结构）
export interface SalesPptItem {
  id: string
  name: string
  cover: string
  category?: string
  status: 'draft' | 'published' | 'archived'
  tag?: 'practical' | 'public'
  slideCount: number
  fileSize: number
  createdAt: string
  updatedAt: string
  customerName?: string
  product?: string[]
  industry?: string[]
  audience?: string[]
  language?: string
}

/**
 * 回传PPT到Sales模块
 */
export async function uploadSalesPpt(params: UploadSalesPptParams): Promise<{
  success: boolean
  data?: { id: string }
  error?: string
}> {
  return axios.post(`${SERVER_URL}/sales/profile/ppt/upload`, params)
}

/**
 * 获取Sales PPT列表（Profile页面使用）
 */
export async function getSalesPptList(options: {
  tag?: 'all' | 'practical' | 'public'
  status?: 'draft' | 'published'
} = {}): Promise<{
  success: boolean
  data: SalesPptItem[]
  error?: string
}> {
  const params: any = {}
  if (options.tag && options.tag !== 'all') {
    params.tag = options.tag
  }
  if (options.status) {
    params.status = options.status
  }
  
  return axios.get(`${SERVER_URL}/sales/profile/ppt/list`, { params })
}

// ==================== 产品管理接口 ====================

/**
 * 产品统计数据
 */
export interface ProductStats {
  sessions: number    // 交流场次数量
  ppts: number        // PPT回传数量
  questions: number   // 关心问题数量
}

/**
 * 产品列表项
 */
export interface ProductItem {
  id: string
  name: string
  code: string
  description?: string
  category?: string
  tags?: string[]
  icon?: string
  cover?: string
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  stats: ProductStats
}

/**
 * 获取产品列表
 */
export async function getProductList(options: {
  category?: string
  isActive?: boolean
} = {}): Promise<{
  success: boolean
  data: ProductItem[]
  error?: string
}> {
  const params: any = {}
  if (options.category) {
    params.category = options.category
  }
  if (options.isActive !== undefined) {
    params.isActive = options.isActive
  }
  
  return axios.get(`${SERVER_URL}/sales/products`, { params })
}

/**
 * 获取产品详情
 */
export async function getProductDetail(id: string): Promise<{
  success: boolean
  data: ProductItem
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/products/${id}`)
}

/**
 * 创建产品
 */
export async function createProduct(params: {
  name: string
  code: string
  description?: string
  category?: string
  tags?: string[]
  icon?: string
  cover?: string
  sortOrder?: number
}): Promise<{
  success: boolean
  data?: { id: string }
  error?: string
}> {
  return axios.post(`${SERVER_URL}/sales/products`, params)
}

/**
 * 更新产品
 */
export async function updateProduct(id: string, params: {
  name?: string
  code?: string
  description?: string
  category?: string
  tags?: string[]
  icon?: string
  cover?: string
  sortOrder?: number
  isActive?: boolean
}): Promise<{
  success: boolean
  data?: ProductItem
  error?: string
}> {
  return axios.put(`${SERVER_URL}/sales/products/${id}`, params)
}

/**
 * 删除产品（软删除）
 */
export async function deleteProduct(id: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  return axios.delete(`${SERVER_URL}/sales/products/${id}`)
}

/**
 * 产品卡片统计数据（用于首页重点关注产品）
 */
export interface ProductCardStats {
  code: string
  name: string
  sessions: number        // 交流会议数量
  ppts: number            // PPT资料数量（已发布）
  questions: number       // 客户问题数量
  brochures: number       // 产品彩页（占位）
  tenderFiles: number     // 招标文件（占位）
  responseFiles: number   // 投标文件（占位）
}

/**
 * 获取产品统计数据（用于首页重点关注产品卡片）
 */
export async function getProductStats(): Promise<{
  success: boolean
  data: ProductCardStats[]
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/products/stats`)
}

// ==================== 交流会议（transcriptions）接口 ====================

export interface TranscriptionListItem {
  id: string
  name: string
  customer_name: string | null
  product_id: string | null
  productCode: string | null
  productName: string | null
  status: string
  audio_duration: number | null
  industry: string | null
  industryName: string | null
  meeting_type: string | null
  meetingTypeName: string | null
  customer_type: string | null
  customerTypeName: string | null
  audience: string | null
  audienceName: string | null
  language: string | null
  languageName: string | null
  created_at: string
  completed_at: string | null
}

export interface TranscriptionDetail extends TranscriptionListItem {
  original_file_name: string
  audio_file_path: string
  audio_format: string
  dialogues: string | null
  full_text: string | null
  speaker_roles: string | null
  error_message: string | null
  progress: number
  updated_at: string
}

export interface TranscriptionListParams {
  page?: number
  pageSize?: number
  customerName?: string
  productId?: string
  productCode?: string
  productName?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  industry?: string
  meeting_type?: string
  customer_type?: string
  audience?: string
  language?: string
}

/**
 * 交流会议列表（分页+筛选）
 */
export async function getTranscriptionList(params: TranscriptionListParams = {}): Promise<{
  success: boolean
  data: { list: TranscriptionListItem[]; total: number }
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/transcriptions`, { params })
}

/**
 * 交流会议详情
 */
export async function getTranscriptionDetail(id: string): Promise<{
  success: boolean
  data: TranscriptionDetail
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/transcriptions/${id}`)
}

/** 交流会议关联的 QA 项（来自 concerns 表） */
export interface TranscriptionConcernItem {
  id: string
  question: string
  answer: string | null
  category: string | null
  time_range: string | null
  status: string
  created_at: string
  /** 格式化为 MM-DD，供前端展示 */
  date?: string | null
  likes?: number
  expertApproved?: boolean
  expertAdvice?: string | null
  expertReviewer?: string | null
}

/**
 * 交流会议关联的 QA 列表（concerns 表按 transcription_id 关联）
 */
export async function getTranscriptionConcerns(transcriptionId: string): Promise<{
  success: boolean
  data: TranscriptionConcernItem[]
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/transcriptions/${transcriptionId}/concerns`)
}

/**
 * 交流会议分析结果
 */
export interface TranscriptionAnalysis {
  id: string
  rawMarkdown: string | null
  createdAt: string
  updatedAt: string
}

/**
 * 获取交流会议分析结果
 */
export async function getTranscriptionAnalysis(transcriptionId: string): Promise<{
  success: boolean
  data: TranscriptionAnalysis | null
  error?: string
}> {
  return axios.get(`${SERVER_URL}/sales/transcriptions/${transcriptionId}/analysis`)
}
