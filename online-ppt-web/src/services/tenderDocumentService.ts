/**
 * 招标文件 API 服务
 */

import axios from './config'
import { SERVER_URL, authFetch } from '.'

export interface TenderSection {
  id: string
  title: string
  level: number
  sort_order: number
  parent_section_id?: string | null
}

export interface TenderDocument {
  id: string
  name: string
  project_name?: string
  budget?: string
  bid_deadline?: string
  status: string
  file_type: string
  file_size: number
  section_count: number
  analysis_result?: any
  created_at: string
  sections?: TenderSection[]
}

export interface TenderDocumentListResult {
  list: TenderDocument[]
  total: number
  page: number
  pageSize: number
}

/**
 * 获取招标文件列表（销售端）
 */
export function getTenderDocumentList(params?: {
  page?: number
  pageSize?: number
  name?: string
}): Promise<TenderDocumentListResult> {
  return axios.get(`${SERVER_URL}/sales/tender-documents`, { params }).then((res: any) => res.data)
}

/**
 * 获取招标文件详情（含章节列表，用于构建 TOC）
 */
export function getTenderDocumentDetail(id: string): Promise<TenderDocument> {
  return axios.get(`${SERVER_URL}/sales/tender-documents/${id}`).then((res: any) => res.data)
}

/**
 * 返回原始 docx 文件的下载 URL
 */
export function getTenderDocumentFileUrl(id: string): string {
  return `${SERVER_URL}/sales/tender-documents/${id}/file`
}

/**
 * 获取 docx 文件的 ArrayBuffer（自带鉴权，供 mammoth 解析）
 */
export async function fetchTenderDocumentBuffer(id: string): Promise<ArrayBuffer> {
  const response = await authFetch(getTenderDocumentFileUrl(id))
  if (!response.ok) {
    throw new Error(`获取文件失败: ${response.status}`)
  }
  return response.arrayBuffer()
}
