/**
 * 文档服务
 * 
 * 封装文档数据获取逻辑，对接后端文档API
 */

import { SERVER_URL } from './index'
import axios from './config'

// 文档元信息接口（与后端 document-index.json 对齐）
export interface DocumentMetadata {
  id: string
  name: string
  cover: string
  sourceDocumentId?: string
  category?: string
  status: 'draft' | 'published' | 'archived'
  tag?: 'public' | 'practical'  // 🆕 标签：公共版/实战版
  slideCount: number
  fileSize: number
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
  viewCount?: number // 🆕 阅读次数
  // 业务字段（用于销售管理）
  customerName?: string
  product?: string[]      // 多选
  industry?: string[]     // 多选
  audience?: string[]     // 多选
  audienceNames?: string  // 🆕 交流对象人员姓名
  language?: string
}

// 文档完整数据接口
export interface DocumentData {
  title: string
  width: number
  height: number
  theme: any
  slides: any[]
}

// 文档列表响应接口
export interface DocumentListResponse {
  success: boolean
  data: {
    list: DocumentMetadata[]
    total: number
    page?: number
    pageSize?: number
  }
  error?: string
}

// 文档详情响应接口
export interface DocumentDetailResponse {
  success: boolean
  data: DocumentMetadata & {
    documentData: DocumentData
  }
  error?: string
}

// 创建文档参数
export interface CreateDocumentParams {
  name: string
  sourceDocumentId?: string
  category?: string
  // 业务字段（用于销售管理）
  customerName?: string
  product?: string[]      // 多选
  industry?: string[]     // 多选
  audience?: string[]     // 多选
  audienceNames?: string  // 🆕 交流对象人员姓名
  language?: string
  // 基于PPTX创建时的初始slides
  initialSlides?: any[]
}

// 更新文档参数
export interface UpdateDocumentParams {
  documentData: DocumentData
  autoSave?: boolean
}

// 重命名文档参数
export interface RenameDocumentParams {
  name: string
}

/**
 * 获取文档列表
 * 
 * @param options 查询选项（分页、筛选、排序）
 */
export async function getDocumentList(options: {
  page?: number
  pageSize?: number
  status?: 'draft' | 'published' | 'archived'
  category?: string
  tag?: string
  keyword?: string
} = {}): Promise<DocumentMetadata[]> {
  try {
    const params = new URLSearchParams()
    if (options.page) params.append('page', options.page.toString())
    if (options.pageSize) params.append('pageSize', options.pageSize.toString())
    if (options.status) params.append('status', options.status)
    if (options.category) params.append('category', options.category)
    if (options.tag) params.append('tag', options.tag)
    if (options.keyword) params.append('keyword', options.keyword)

    const url = `${SERVER_URL}/documents${params.toString() ? `?${params.toString()}` : ''}`
    const resp = await axios.get(url) as DocumentListResponse

    if (!resp?.success || !resp.data?.list) {
      throw new Error(resp?.error || '获取文档列表失败')
    }

    return resp.data.list.map(item => {
      let cover = ''
      if (item.cover && typeof item.cover === 'string') {
        const c = item.cover as string
        // 已经是完整 URL，直接使用
        if (c.startsWith('http://') || c.startsWith('https://')) {
          cover = c
        }
        // 后端返回的相对路径（封面图或缩略图），需要拼上 SERVER_URL
        else if (c.startsWith('/covers/') || c.startsWith('/snapshots/')) {
          cover = `${SERVER_URL}${c}`
        } else if (c.startsWith('/')) {
          // 其他以 / 开头的相对路径
          cover = `${SERVER_URL}${c}`
        } else {
          cover = c
        }
      } else {
        // 没有 cover 字段时，使用默认封面
        cover = getDocumentCoverUrl(item.id)
      }

      return {
        ...item,
        cover,
        name: item.name || '未命名文档',
      } as DocumentMetadata
    })
  } catch (error) {
    console.error('[文档服务] 获取文档列表失败:', error)
    throw error
  }
}

/**
 * 获取文档详情
 * 
 * @param id 文档ID
 */
export async function getDocument(id: string): Promise<{
  metadata: DocumentMetadata
  documentData: DocumentData
}> {
  try {
    const resp = await axios.get(`${SERVER_URL}/documents/${id}`) as DocumentDetailResponse
    
    if (!resp?.success || !resp.data) {
      throw new Error(resp?.error || '获取文档详情失败')
    }

    // 后端返回的data包含metadata的所有字段（通过...meta展开）和documentData字段
    const { documentData, ...restData } = resp.data
    return {
      metadata: restData as DocumentMetadata,
      documentData: documentData as DocumentData,
    }
  } catch (error) {
    console.error(`[文档服务] 获取文档详情失败: ${id}`, error)
    throw error
  }
}

/**
 * 创建文档
 * 
 * @param params 创建参数
 */
export async function createDocument(params: CreateDocumentParams): Promise<{
  success: boolean
  data: { id: string }
  error?: string
}> {
  return axios.post(`${SERVER_URL}/documents/create`, {
    name: params.name,
    sourceDocumentId: params.sourceDocumentId,
    category: params.category || 'uncategorized',
    // 业务字段
    customerName: params.customerName,
    product: params.product,
    industry: params.industry,
    audience: params.audience,
    audienceNames: params.audienceNames, // 🆕 交流对象人员姓名
    language: params.language,
    // 基于PPTX创建时的初始slides
    initialSlides: params.initialSlides,
  })
}

/**
 * 更新文档
 * 
 * @param id 文档ID
 * @param params 更新参数
 */
export async function updateDocument(id: string, params: UpdateDocumentParams): Promise<{
  success: boolean
  data?: any
  error?: string
}> {
  return axios.put(`${SERVER_URL}/documents/${id}`, {
    documentData: params.documentData,
    autoSave: params.autoSave !== undefined ? params.autoSave : false,
  })
}

/**
 * 删除文档
 * 
 * @param id 文档ID
 */
export async function deleteDocument(id: string): Promise<{
  success: boolean
  error?: string
}> {
  return axios.delete(`${SERVER_URL}/documents/${id}`)
}

/**
 * 复制文档
 * 
 * @param id 文档ID
 */
export async function duplicateDocument(id: string): Promise<{
  success: boolean
  data: { id: string }
  error?: string
}> {
  return axios.post(`${SERVER_URL}/documents/${id}/duplicate`)
}

/**
 * 重命名文档
 * 
 * @param id 文档ID
 * @param name 新名称
 */
// 修改文档基础信息参数
export interface UpdateDocumentMetadataParams {
  name: string
  customerName?: string
  product?: string[]
  industry?: string[]
  audience?: string[]
  audienceNames?: string  // 🆕 交流对象人员姓名
  language?: string
}

/**
 * 修改文档基础信息（原重命名接口）
 * 
 * ✅ 支持更新文档名称和业务字段
 * 
 * @param id 文档ID
 * @param params 更新参数
 */
export async function updateDocumentMetadata(id: string, params: UpdateDocumentMetadataParams): Promise<{
  success: boolean
  error?: string
}> {
  return axios.patch(`${SERVER_URL}/documents/${id}/metadata`, params)
}

/**
 * 重命名文档（兼容旧接口）
 * 
 * @param id 文档ID
 * @param name 新名称
 */
export async function renameDocument(id: string, name: string): Promise<{
  success: boolean
  error?: string
}> {
  return updateDocumentMetadata(id, { name })
}

/**
 * 发布文档
 * 
 * @param id 文档ID
 */
export async function publishDocument(id: string): Promise<{
  success: boolean
  data?: { id: string; status: string; updatedAt: string }
  error?: string
}> {
  return axios.post(`${SERVER_URL}/documents/${id}/publish`)
}

/**
 * 获取文档封面图URL
 */
export function getDocumentCoverUrl(documentId: string): string {
  return `${SERVER_URL}/covers/${documentId}.webp`
}

/**
 * 获取 Sales 模块的文档列表（默认PPT列表）
 * 
 * @param options 查询选项
 */
export async function getSalesDocumentList(options: {
  page?: number
  pageSize?: number
  status?: 'draft' | 'published' | 'archived'
  tag?: 'public' | 'practical'
  keyword?: string
  pageType?: string  // PPT目录筛选（可传多个，用逗号分隔）
  industry?: string  // 行业筛选（可传多个，用逗号分隔）
  audience?: string  // 交流对象筛选（可传多个，用逗号分隔）
  language?: string  // 语言筛选（可传多个，用逗号分隔，如 "中文,英文"）
  sortBy?: string
  order?: 'asc' | 'desc'
} = {}): Promise<{
  documents: DocumentMetadata[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}> {
  const params: any = {
    page: options.page || 1,
    pageSize: options.pageSize || 20,
    status: options.status || 'published',
  }
  
  if (options.tag) params.tag = options.tag
  if (options.keyword) params.keyword = options.keyword
  if (options.pageType) params.pageType = options.pageType
  if (options.industry) params.industry = options.industry
  if (options.audience) params.audience = options.audience
  if (options.language) params.language = options.language
  if (options.sortBy) params.sortBy = options.sortBy
  if (options.order) params.order = options.order

  console.log('[getSalesDocumentList] 请求参数:', params)
  console.log('[getSalesDocumentList] 请求URL:', `${SERVER_URL}/sales/documents`)
  
  try {
    const response = await axios.get(`${SERVER_URL}/sales/documents`, { params })
    
    console.log('[getSalesDocumentList] 响应数据:', response)
    console.log('[getSalesDocumentList] response.success:', response.success)
    console.log('[getSalesDocumentList] response.data:', response.data)
    
    // axios拦截器已经返回了response.data，所以这里的response就是{success: true, data: {...}}
    if (!response || !response.success) {
      console.error('[getSalesDocumentList] success=false:', response?.error)
      throw new Error(response?.error || '获取文档列表失败')
    }
    
    return response.data
  } catch (error: any) {
    console.error('[getSalesDocumentList] 请求失败:', error)
    console.error('[getSalesDocumentList] 错误详情:', {
      message: error.message,
      response: error.response,
      request: error.request
    })
    throw error
  }
}

/**
 * 记录文档阅读
 */
export async function recordDocumentView(documentId: string): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  try {
    const response: any = await axios.post(`${SERVER_URL}/documents/${documentId}/view`)
    return response
  } catch (error: any) {
    console.error('[文档服务] 记录阅读失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '记录阅读失败'
    }
  }
}

export default {
  getDocumentList,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  duplicateDocument,
  renameDocument,
  publishDocument,
  getDocumentCoverUrl,
  getSalesDocumentList,
}
