/**
 * 字典管理 API 服务
 * 
 * 封装所有字典管理相关的 API 调用
 */

import axios from '../config'

const API_BASE = '/api/admin/system/dict'

// ==================== 字典类型相关类型 ====================

export interface DictType {
  id: string
  dict_type: string
  dict_name: string
  status: string
  remark?: string
  sort_order: number
  created_at: string
  updated_at: string
  dataCount?: number
}

export interface DictTypeListParams {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface DictTypeListResponse {
  list: DictType[]
  total: number
}

// ==================== 字典数据相关类型 ====================

export interface DictData {
  id: string
  dict_type: string
  dict_label: string
  dict_value: string
  dict_sort: number
  css_class?: string
  list_class?: string
  is_default: string
  status: string
  remark?: string
  created_at: string
  updated_at: string
}

export interface DictDataListParams {
  dict_type: string
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
}

export interface DictDataListResponse {
  list: DictData[]
  total: number
}

// ==================== 字典类型管理接口 ====================

/**
 * 获取字典类型列表
 */
export async function getDictTypeList(params: DictTypeListParams = {}): Promise<DictTypeListResponse> {
  const response = await axios.get<{ success: boolean; data: DictTypeListResponse; error?: string }>(`${API_BASE}/types`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取字典类型列表失败')
  }
  return response.data
}

/**
 * 获取字典类型详情
 */
export async function getDictTypeById(id: string): Promise<DictType> {
  const response = await axios.get<{ success: boolean; data: DictType; error?: string }>(`${API_BASE}/types/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取字典类型详情失败')
  }
  return response.data
}

/**
 * 创建字典类型
 */
export async function createDictType(data: {
  dict_type: string
  dict_name: string
  status?: string
  remark?: string
  sort_order?: number
}): Promise<DictType> {
  const response = await axios.post<{ success: boolean; data: DictType; error?: string }>(`${API_BASE}/types`, data)
  if (!response.success) {
    throw new Error(response.error || '创建字典类型失败')
  }
  return response.data
}

/**
 * 更新字典类型
 */
export async function updateDictType(id: string, data: Partial<DictType>): Promise<DictType> {
  const response = await axios.put<{ success: boolean; data: DictType; error?: string }>(`${API_BASE}/types/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新字典类型失败')
  }
  return response.data
}

/**
 * 删除字典类型
 */
export async function deleteDictType(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/types/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除字典类型失败')
  }
}

// ==================== 字典数据管理接口 ====================

/**
 * 获取字典数据列表
 */
export async function getDictDataList(params: DictDataListParams): Promise<DictDataListResponse> {
  const response = await axios.get<{ success: boolean; data: DictDataListResponse; error?: string }>(`${API_BASE}/data`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取字典数据列表失败')
  }
  return response.data
}

/**
 * 获取字典数据详情
 */
export async function getDictDataById(id: string): Promise<DictData> {
  const response = await axios.get<{ success: boolean; data: DictData; error?: string }>(`${API_BASE}/data/${id}`)
  if (!response.success) {
    throw new Error(response.error || '获取字典数据详情失败')
  }
  return response.data
}

/**
 * 创建字典数据
 */
export async function createDictData(data: {
  dict_type: string
  dict_label: string
  dict_value: string
  dict_sort?: number
  css_class?: string
  list_class?: string
  is_default?: string
  status?: string
  remark?: string
}): Promise<DictData> {
  const response = await axios.post<{ success: boolean; data: DictData; error?: string }>(`${API_BASE}/data`, data)
  if (!response.success) {
    throw new Error(response.error || '创建字典数据失败')
  }
  return response.data
}

/**
 * 更新字典数据
 */
export async function updateDictData(id: string, data: Partial<DictData>): Promise<DictData> {
  const response = await axios.put<{ success: boolean; data: DictData; error?: string }>(`${API_BASE}/data/${id}`, data)
  if (!response.success) {
    throw new Error(response.error || '更新字典数据失败')
  }
  return response.data
}

/**
 * 删除字典数据
 */
export async function deleteDictData(id: string): Promise<void> {
  const response = await axios.delete<{ success: boolean; error?: string }>(`${API_BASE}/data/${id}`)
  if (!response.success) {
    throw new Error(response.error || '删除字典数据失败')
  }
}

// ==================== 字典查询接口（前端工具库使用） ====================

/**
 * 根据字典类型代码获取字典数据（前端工具库使用）
 * 只返回正常状态的字典数据，按排序字段排序
 */
export async function getDictByType(dictType: string): Promise<DictData[]> {
  try {
    const response = await axios.get<{ success: boolean; data: DictData[]; error?: string }>(`${API_BASE}/type/${dictType}`)
    if (!response.success) {
      console.warn(`[字典工具库] 获取字典数据失败: ${dictType}`, response.error)
      return []
    }
    return response.data || []
  } catch (error) {
    console.error(`[字典工具库] 获取字典数据异常: ${dictType}`, error)
    return []
  }
}

/**
 * 批量获取多个字典类型的数据（前端工具库使用）
 */
export async function getDictsByTypes(dictTypes: string[]): Promise<Record<string, DictData[]>> {
  try {
    if (!Array.isArray(dictTypes) || dictTypes.length === 0) {
      return {}
    }
    const response = await axios.post<{ success: boolean; data: Record<string, DictData[]>; error?: string }>(`${API_BASE}/types/batch`, {
      dictTypes
    })
    if (!response.success) {
      console.warn('[字典工具库] 批量获取字典数据失败', response.error)
      return {}
    }
    return response.data || {}
  } catch (error) {
    console.error('[字典工具库] 批量获取字典数据异常', error)
    return {}
  }
}

