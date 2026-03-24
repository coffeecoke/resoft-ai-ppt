/**
 * WOPI 服务 - OnlyOffice 集成
 *
 * 提供编辑器配置获取、Token 生成等接口
 */

import axios from './config'
import { SERVER_URL } from '.'

export interface EditorConfig {
  document: {
    fileType: string
    key: string
    title: string
    url: string
    permissions: {
      edit: boolean
      download: boolean
      print: boolean
    }
  }
  documentType: string
  editorConfig: {
    mode: 'edit' | 'view'
    callbackUrl: string
    user: {
      id: string
      name: string
    }
    customization: {
      autosave: boolean
      forcesave: boolean
      chat: boolean
      comments: boolean
    }
  }
}

export interface EditorTokenResult {
  token: string
  fileUrl: string
  fileName: string
  permissions: {
    edit: boolean
    download: boolean
    print: boolean
  }
}

/**
 * 获取编辑器配置
 */
export function getEditorConfig(
  documentId: string,
  mode: 'view' | 'edit' = 'edit'
): Promise<{ success: boolean; data?: EditorConfig; error?: string }> {
  return axios
    .get(`${SERVER_URL}/wopi/editor-config/${documentId}`, { params: { mode } })
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.message || '获取编辑器配置失败'
    }))
}

/**
 * 获取编辑器 Token
 */
export function getEditorToken(params: {
  documentId: string
  mode: 'view' | 'edit'
}): Promise<{ success: boolean; data?: EditorTokenResult; error?: string }> {
  return axios
    .post(`${SERVER_URL}/wopi/token`, params)
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.message || '获取 Token 失败'
    }))
}

/**
 * 合并章节并创建可编辑文档
 */
export interface MergeSection {
  id: string
  documentType: 'tender' | 'bid'
  title: string
}

export function mergeAndEdit(params: {
  sections: MergeSection[]
  name?: string
}): Promise<{
  success: boolean
  data?: {
    id: string
    name: string
    token: string
    created_at: string
  }
  error?: string
}> {
  return axios
    .post(`${SERVER_URL}/personal-documents/merge-and-edit`, params)
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.response?.data?.error || error.message || '合并章节失败'
    }))
}

/**
 * 获取个人文档列表
 */
export interface PersonalDocument {
  id: string
  name: string
  file_type: string
  file_size: number
  source_type: string | null
  created_at: string
  updated_at: string
}

export function getPersonalDocumentList(params?: {
  page?: number
  pageSize?: number
}): Promise<{
  success: boolean
  data?: {
    list: PersonalDocument[]
    total: number
    page: number
    pageSize: number
  }
  error?: string
}> {
  return axios
    .get(`${SERVER_URL}/personal-documents`, { params })
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.message || '获取文档列表失败'
    }))
}

/**
 * 删除个人文档
 */
export function deletePersonalDocument(id: string): Promise<{ success: boolean; error?: string }> {
  return axios
    .delete(`${SERVER_URL}/personal-documents/${id}`)
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.response?.data?.error || error.message || '删除失败'
    }))
}

/**
 * 重命名个人文档
 */
export function renamePersonalDocument(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  return axios
    .put(`${SERVER_URL}/personal-documents/${id}/rename`, { name })
    .then((res: any) => res)
    .catch((error) => ({
      success: false,
      error: error.response?.data?.error || error.message || '重命名失败'
    }))
}