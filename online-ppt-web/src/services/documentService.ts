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
  slideCount: number
  fileSize: number
  createdAt: string
  updatedAt: string
  lastOpenedAt?: string
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
  keyword?: string
} = {}): Promise<DocumentMetadata[]> {
  try {
    const params = new URLSearchParams()
    if (options.page) params.append('page', options.page.toString())
    if (options.pageSize) params.append('pageSize', options.pageSize.toString())
    if (options.status) params.append('status', options.status)
    if (options.category) params.append('category', options.category)
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
        // 后端返回的相对路径，需要拼上 SERVER_URL
        else if (c.startsWith('/covers/')) {
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
export async function renameDocument(id: string, name: string): Promise<{
  success: boolean
  error?: string
}> {
  return axios.patch(`${SERVER_URL}/documents/${id}/rename`, { name })
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
}
