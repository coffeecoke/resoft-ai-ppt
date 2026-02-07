/**
 * 客户问题（Concerns）相关 API
 */
import salesApi from './salesApi'

// ====================== 类型定义 ======================

/** 问题项 */
export interface ConcernItem {
  id: string
  question: string
  answer: string | null
  category: string | null
  categoryCode: string | null
  intentCode: string | null
  timeRange: string | null
  status: string
  createdAt: string
  date: string | null
  likes: number
  expertApproved: boolean
  expertAdvice: string | null
  expertReviewer: string | null
  transcriptionId: string | null
  customerName: string | null
  industry: string | null
  productCode: string | null
  productName: string | null
  meetingName: string | null
}

/** 热搜榜项 */
export interface HotConcernItem {
  id: string
  rank: number
  question: string
  category: string | null
  likes: number
  customerName: string | null
  industry: string | null
  productName: string | null
}

/** 分类目录项 */
export interface CategoryItem {
  id: string
  code: string
  name: string
  type: string
  parent_code: string | null
  level: number
  description: string | null
  sort_order: number
  is_active: boolean
  children?: CategoryItem[]
}

/** 查询参数 */
export interface ConcernsQueryParams {
  cursor?: string
  limit?: number
  industry?: string | string[]
  productCode?: string | string[]
  categoryCode?: string | string[]
  intentCode?: string | string[]
  sortBy?: 'latest' | 'likes' | 'usage'
  keyword?: string
}

/** 列表响应 */
export interface ConcernsListResponse {
  success: boolean
  data: {
    list: ConcernItem[]
    nextCursor: string | null
    hasMore: boolean
  }
}

/** 热搜榜响应 */
export interface HotConcernsResponse {
  success: boolean
  data: HotConcernItem[]
}

/** 分类目录响应 */
export interface CategoriesResponse {
  success: boolean
  data: CategoryItem[]
}

/** 点赞响应 */
export interface LikeResponse {
  success: boolean
  data: {
    id: string
    likes: number
  }
}

// ====================== API 方法 ======================

/**
 * 获取客户问题列表
 * @param params 查询参数
 */
export async function getConcerns(params: ConcernsQueryParams = {}): Promise<ConcernsListResponse> {
  // 处理数组参数，转换为逗号分隔的字符串
  const queryParams: Record<string, string | number | undefined> = {
    limit: params.limit,
    sortBy: params.sortBy,
    keyword: params.keyword,
    cursor: params.cursor
  }

  if (params.industry) {
    queryParams.industry = Array.isArray(params.industry)
      ? params.industry.join(',')
      : params.industry
  }

  if (params.productCode) {
    queryParams.productCode = Array.isArray(params.productCode)
      ? params.productCode.join(',')
      : params.productCode
  }

  if (params.categoryCode) {
    queryParams.categoryCode = Array.isArray(params.categoryCode)
      ? params.categoryCode.join(',')
      : params.categoryCode
  }

  if (params.intentCode) {
    queryParams.intentCode = Array.isArray(params.intentCode)
      ? params.intentCode.join(',')
      : params.intentCode
  }

  return salesApi.get('/api/sales/concerns', { params: queryParams })
}

/**
 * 获取热搜榜 Top10
 */
export async function getHotConcerns(): Promise<HotConcernsResponse> {
  return salesApi.get('/api/sales/concerns/hot')
}

/**
 * 获取问题详情
 * @param id 问题ID
 */
export async function getConcernDetail(id: string): Promise<{ success: boolean; data: ConcernItem }> {
  return salesApi.get(`/api/sales/concerns/${id}`)
}

/**
 * 点赞问题
 * @param id 问题ID
 */
export async function likeConcern(id: string): Promise<LikeResponse> {
  return salesApi.post(`/api/sales/concerns/${id}/like`)
}

/**
 * 获取分类目录（树形结构）
 * @param type 类型过滤：level | category | intent
 */
export async function getConcernCategories(type?: string): Promise<CategoriesResponse> {
  const params: Record<string, string | undefined> = { type }
  return salesApi.get('/api/sales/concern-categories', { params })
}

/**
 * 获取分类目录（扁平列表）
 * @param type 类型过滤
 */
export async function getConcernCategoriesFlat(type?: string): Promise<CategoriesResponse> {
  const params: Record<string, string | undefined> = { type }
  return salesApi.get('/api/sales/concern-categories/flat', { params })
}

export default {
  getConcerns,
  getHotConcerns,
  getConcernDetail,
  likeConcern,
  getConcernCategories,
  getConcernCategoriesFlat
}
