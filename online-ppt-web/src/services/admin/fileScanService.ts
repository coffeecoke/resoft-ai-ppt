/**
 * 文件扫描 API 服务
 * 
 * 封装所有文件扫描相关的 API 调用
 */

import axios from '../config'

const API_BASE = '/api/admin/file-scan'

// 扫描配置
export interface ScanConfig {
  sourceDir: string
  enabled: boolean
  interval: number
  intervalHours: string
  autoProcess: boolean
  fileTypes: string[]
  typeDirs: Record<string, string>
  sourceDirs: Record<string, string>
  valid: boolean
  errors: string[]
}

// 文件信息
export interface FileInfo {
  fileName: string
  filePath: string
  fileSize: number
  fileType: string
  modifiedTime: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  processedTime: string | null
  documentId: string | null
  errorMessage: string | null
}

// 文件列表响应
export interface FileListResponse {
  files: FileInfo[]
  total: number
  stats: {
    total: number
    pending: number
    processing: number
    success: number
    failed: number
  }
}

// 处理结果
export interface ProcessResult {
  success: boolean
  fileName: string
  filePath: string
  documentId?: string
  documentName?: string
  processedTime?: string
  error?: string
}

// 扫描结果
export interface ScanResult {
  total: number
  processed: number
  skipped: number
  failed: number
  files: ProcessResult[]
}

// 处理历史记录
export interface HistoryRecord {
  id: string
  file_path: string
  file_name: string
  file_size: number
  file_type: string
  modified_time: string
  processed_time: string | null
  document_id: string | null
  status: string
  error_message: string | null
  scan_time: string
  created_at: string
  updated_at: string
}

// 历史记录响应
export interface HistoryResponse {
  list: HistoryRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * 获取扫描配置
 */
export async function getScanConfig(): Promise<ScanConfig> {
  const response = await axios.get<{ success: boolean; data: ScanConfig; error?: string }>(`${API_BASE}/config`)
  if (!response.success) {
    throw new Error(response.error || '获取配置失败')
  }
  return response.data
}

/**
 * 获取文件列表
 * 
 * @param sourceDir 源目录路径（可选）
 */
export async function getFileList(sourceDir?: string): Promise<FileListResponse> {
  const params = sourceDir ? { sourceDir } : {}
  const response = await axios.get<{ success: boolean; data: FileListResponse; error?: string }>(`${API_BASE}/files`, { params })
  if (!response.success) {
    throw new Error(response.error || '获取文件列表失败')
  }
  return response.data
}

/**
 * 立即处理指定文件
 * 
 * @param filePath 文件路径
 */
export async function processFile(filePath: string): Promise<ProcessResult> {
  const response = await axios.post<{ success: boolean; data: ProcessResult; error?: string }>(`${API_BASE}/process`, {
    filePath
  })
  if (!response.success) {
    throw new Error(response.error || '处理文件失败')
  }
  return response.data
}

/**
 * 手动触发扫描
 * 
 * @param autoProcess 是否自动处理新文件（可选，默认使用配置值）
 */
export async function scan(autoProcess?: boolean): Promise<ScanResult> {
  const response = await axios.post<{ success: boolean; data: ScanResult; error?: string }>(`${API_BASE}/scan`, {
    autoProcess
  })
  if (!response.success) {
    throw new Error(response.error || '扫描失败')
  }
  return response.data
}

/**
 * 获取处理历史记录
 * 
 * @param options 查询选项
 */
export async function getProcessHistory(options?: {
  page?: number
  pageSize?: number
  status?: string
}): Promise<HistoryResponse> {
  const response = await axios.get<{ success: boolean; data: HistoryResponse; error?: string }>(`${API_BASE}/history`, {
    params: options
  })
  if (!response.success) {
    throw new Error(response.error || '获取历史记录失败')
  }
  return response.data
}





