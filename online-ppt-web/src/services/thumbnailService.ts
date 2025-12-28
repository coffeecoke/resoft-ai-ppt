import axios from 'axios'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5001'

export interface Thumbnail {
  id: string
  documentId: string
  documentTitle: string
  slideId: string
  slideIndex: number
  url: string
  width: number
  height: number
  size: number
  format: string
  generatedAt: string
  metadata: {
    hasText: boolean
    hasImage: boolean
    elementCount: number
  }
}

export interface ThumbnailDetail extends Thumbnail {
  source: {
    document: {
      id: string
      title: string
      width: number
      height: number
      totalSlides: number
    }
    slide: {
      id: string
      index: number
      elements: Array<{ type: string; id: string }>
    }
  }
}

/**
 * 上传预览图
 */
export async function uploadThumbnail(
  documentId: string,
  slideId: string,
  file: Blob
): Promise<{ success: boolean; thumbnailUrl?: string; error?: string }> {
  try {
    const formData = new FormData()
    formData.append('documentId', documentId)
    formData.append('slideId', slideId)
    formData.append('thumbnail', file, `${slideId}.jpg`)

    const response = await axios.post(`${SERVER_URL}/api/thumbnails/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })

    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 上传失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '上传失败'
    }
  }
}

/**
 * 获取预览图列表
 */
export async function getThumbnails(params?: {
  documentId?: string
  limit?: number
  offset?: number
}): Promise<{
  success: boolean
  data?: {
    total: number
    thumbnails: Thumbnail[]
    lastUpdated: string
  }
  error?: string
}> {
  try {
    const query = new URLSearchParams()
    if (params?.documentId) query.append('documentId', params.documentId)
    if (params?.limit) query.append('limit', params.limit.toString())
    if (params?.offset) query.append('offset', params.offset.toString())

    const url = `${SERVER_URL}/api/thumbnails${query.toString() ? `?${query.toString()}` : ''}`
    const response = await axios.get(url)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取列表失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取列表失败'
    }
  }
}

/**
 * 获取预览图详情（含溯源信息）
 */
export async function getThumbnailDetail(
  thumbnailId: string
): Promise<{
  success: boolean
  data?: ThumbnailDetail
  error?: string
}> {
  try {
    const response = await axios.get(`${SERVER_URL}/api/thumbnails/${thumbnailId}`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取详情失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取详情失败'
    }
  }
}

/**
 * 获取某个文档的所有预览图
 */
export async function getDocumentThumbnails(
  documentId: string
): Promise<{
  success: boolean
  data?: {
    documentId: string
    total: number
    thumbnails: Thumbnail[]
  }
  error?: string
}> {
  try {
    const response = await axios.get(`${SERVER_URL}/api/thumbnails/document/${documentId}`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 获取文档预览图失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '获取文档预览图失败'
    }
  }
}

/**
 * 重建预览图索引
 */
export async function rebuildIndex(): Promise<{
  success: boolean
  data?: { total: number; message: string }
  error?: string
}> {
  try {
    const response = await axios.post(`${SERVER_URL}/api/thumbnails/rebuild-index`)
    return response.data
  } catch (error: any) {
    console.error('[预览图服务] 重建索引失败:', error)
    return {
      success: false,
      error: error.response?.data?.error || error.message || '重建索引失败'
    }
  }
}




