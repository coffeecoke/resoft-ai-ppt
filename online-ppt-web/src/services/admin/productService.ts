/**
 * 产品管理 API 服务
 *
 * 封装所有产品管理相关的 API 调用
 */

import axios from '../config'

const API_BASE = '/api/admin/system/product'

// ==================== 产品相关类型 ====================

export interface Product {
  id: string
  name: string
  code: string | null
  description: string | null
  category: string | null
  tags: any
  icon: string | null
  cover: string | null
  sort_order: number
  is_active: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface ProductListParams {
  page?: number
  pageSize?: number
  keyword?: string
  category?: string
  is_active?: boolean | string
  is_featured?: boolean | string
}

export interface ProductListResponse {
  list: Product[]
  total: number
}

// ==================== 产品管理接口 ====================

/**
 * 获取产品列表
 */
export async function getProductList(params: ProductListParams = {}): Promise<ProductListResponse> {
  const response = await axios.get<{ success: boolean; data: ProductListResponse; error?: string }>(`${API_BASE}`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取产品列表失败')
  }
  return response.data
}

/**
 * 获取产品详情
 */
export async function getProductById(id: string): Promise<Product> {
  const response = await axios.get<{ success: boolean; data: Product; error?: string }>(`${API_BASE}/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取产品详情失败')
  }
  return response.data
}

/**
 * 创建产品
 */
export async function createProduct(data: {
  name: string
  code?: string
  description?: string
  category?: string
  tags?: any
  icon?: string
  cover?: string
  sort_order?: number
  is_active?: boolean
  is_featured?: boolean
}): Promise<Product> {
  const response = await axios.post<{ success: boolean; data: Product; error?: string }>(`${API_BASE}`, data)
  if (!response.success) {
    throw new Error(response.error || '创建产品失败')
  }
  return response.data
}

/**
 * 更新产品
 */
export async function updateProduct(id: string, data: Partial<Product>): Promise<Product> {
  const response = await axios.put<{ success: boolean; data: Product; error?: string }>(`${API_BASE}/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新产品失败')
  }
  return response.data
}

/**
 * 删除产品
 */
export async function deleteProduct(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除产品失败')
  }
}
