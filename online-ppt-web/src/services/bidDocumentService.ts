/**
 * 投标/响应文件 API 服务
 */

import axios from './config'
import { SERVER_URL, authFetch } from '.'

export interface BidSection {
  id: string
  title: string
  level: number
  sort_order: number
  parent_section_id?: string | null
}

export interface BidDocument {
  id: string
  name: string
  file_type: string
  file_size: number
  status?: string
  source_info?: string
  industry?: string
  project_type?: string
  section_count: number
  created_at: string
  sections?: BidSection[]
}

export interface BidSectionType {
  id: number
  code: string
  name: string
  description: string
}

export interface BidDocumentListResult {
  list: BidDocument[]
  total: number
  page: number
  pageSize: number
}

/**
 * 获取响应文件列表（销售端）
 */
export function getBidDocumentList(params?: {
  page?: number
  pageSize?: number
  name?: string
  industry?: string
  sectionTypes?: string[]
}): Promise<BidDocumentListResult> {
  const { sectionTypes, ...rest } = params ?? {}
  const query: any = { ...rest }
  if (sectionTypes?.length) query.sectionTypes = sectionTypes.join(',')
  return axios.get(`${SERVER_URL}/sales/bid-documents`, { params: query }).then((res: any) => res.data)
}

/**
 * 获取投标章节类型列表（用于筛选面板）
 */
export function getBidSectionTypeList(): Promise<BidSectionType[]> {
  return axios.get(`${SERVER_URL}/sales/bid-documents/section-types`).then((res: any) => res.data)
}

/**
 * 获取文档详情（含章节列表，用于构建 TOC）
 */
export function getBidDocumentDetail(id: string): Promise<BidDocument> {
  return axios.get(`${SERVER_URL}/sales/bid-documents/${id}`).then((res: any) => res.data)
}

/**
 * 返回原始 docx 文件的下载 URL
 * 前端用 authFetch 获取 ArrayBuffer 后传给 mammoth
 */
export function getBidDocumentFileUrl(id: string): string {
  return `${SERVER_URL}/sales/bid-documents/${id}/file`
}

/**
 * 获取 docx 文件的 ArrayBuffer（自带鉴权）
 */
export async function fetchBidDocumentBuffer(id: string): Promise<ArrayBuffer> {
  const response = await authFetch(getBidDocumentFileUrl(id))
  if (!response.ok) {
    throw new Error(`获取文件失败: ${response.status}`)
  }
  return response.arrayBuffer()
}
