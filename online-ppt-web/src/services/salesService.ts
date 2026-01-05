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
