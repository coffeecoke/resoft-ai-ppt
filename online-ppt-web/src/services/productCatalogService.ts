import axios from './config'
import { SERVER_URL } from './index'

/**
 * 筛选参数接口
 * ⚠️ 注意：product 数组中的值必须是产品的 code，不是 name
 */
export interface FilterParams {
  product?: string[]  // 产品 code 数组
  customer?: string
  industry?: string[]
  audience?: string[]
}

/**
 * 目录统计信息
 */
export interface CatalogStatistics {
  publicCount: number
  practicalCount: number
}

/**
 * 二级目录项
 */
export interface CatalogLevel2 {
  id: string
  name: string
  code: string
  level: number
  parentId: string | null
  sortOrder: number
  statistics: CatalogStatistics
}

/**
 * 一级目录项
 */
export interface CatalogLevel1 {
  id: string
  name: string
  code: string | null
  level: number
  parentId: string | null
  sortOrder: number
  children: CatalogLevel2[]
}

/**
 * 文档信息
 */
export interface DocumentInfo {
  id: string
  name: string
  cover: string | null
  slideCount: number
  createdAt: string
  customerName: string | null
  audienceNames: string | null
}

/**
 * 缩略图信息
 */
export interface ThumbnailInfo {
  id: string
  url: string
  slideIndex: number
  pageType: string | null
  document: {
    id: string
    name: string
    createdAt: string
    cover: string | null
  }
}

/**
 * 实战版文档分组
 */
export interface PracticalDocument {
  id: string
  name: string
  createdAt: string
  audienceNames: string | null
  cover: string | null
  thumbnails: Array<{
    id: string
    url: string
    slideIndex: number
    pageType: string | null
  }>
}

/**
 * 实战版客户分组
 */
export interface CustomerGroup {
  customer: string
  meta: string  // 预留：交流时间等
  documents: PracticalDocument[]
}

/**
 * 获取产品目录树
 */
export async function getProductCatalogs(
  productId?: string,
  filters?: FilterParams
): Promise<{ success: boolean; data: { catalogs: CatalogLevel1[] }; error?: string }> {
  try {
    const params: any = {}
    if (productId) {
      params.productId = productId
    }
    if (filters && Object.keys(filters).length > 0) {
      params.filters = JSON.stringify(filters)
    }
    
    const response = await axios.get(`${SERVER_URL}/sales/product-catalogs`, { params })
    return response
  } catch (error: any) {
    console.error('获取产品目录树失败:', error)
    return {
      success: false,
      error: error.message || '获取产品目录树失败',
      data: { catalogs: [] }
    }
  }
}

/**
 * 获取产品文档列表（未选目录时）
 */
export async function getProductDocuments(
  productCode: string,
  tag: 'public' | 'practical',
  filters?: FilterParams
): Promise<{ success: boolean; data: { documents: DocumentInfo[] }; error?: string }> {
  try {
    const params: any = {
      tag,
      status: 'published'
    }
    if (filters && Object.keys(filters).length > 0) {
      params.filters = JSON.stringify(filters)
    }
    
    const response = await axios.get(`${SERVER_URL}/sales/products/${productCode}/documents`, { params })
    return response
  } catch (error: any) {
    console.error('获取产品文档列表失败:', error)
    return {
      success: false,
      error: error.message || '获取产品文档列表失败',
      data: { documents: [] }
    }
  }
}

/**
 * 获取缩略图列表（选中目录后）
 */
export async function getThumbnailsByPageTypes(
  pageTypes: string[],
  tag: 'public' | 'practical',
  productCode: string,
  filters?: FilterParams
): Promise<{ 
  success: boolean
  data: { 
    thumbnails?: ThumbnailInfo[]
    groups?: CustomerGroup[]
  }
  error?: string 
}> {
  try {
    if (pageTypes.length === 0) {
      return {
        success: true,
        data: tag === 'public' ? { thumbnails: [] } : { groups: [] }
      }
    }
    
    const params: any = {
      pageTypes: pageTypes.join(','),
      tag,
      productCode
    }
    if (filters && Object.keys(filters).length > 0) {
      params.filters = JSON.stringify(filters)
    }
    
    const response = await axios.get(`${SERVER_URL}/sales/thumbnails`, { params })
    return response
  } catch (error: any) {
    console.error('获取缩略图列表失败:', error)
    return {
      success: false,
      error: error.message || '获取缩略图列表失败',
      data: tag === 'public' ? { thumbnails: [] } : { groups: [] }
    }
  }
}

