import axios from './config'
import { SERVER_URL } from './index'

// PPT回传参数
export interface UploadSalesPptParams {
  name: string
  customerName?: string
  product?: string[]
  industry?: string[]
  audience?: string[]
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
