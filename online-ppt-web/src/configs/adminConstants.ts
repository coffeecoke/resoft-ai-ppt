/**
 * 管理后台常量配置
 * 
 * 存放管理后台相关的常量配置
 */

// 系统状态选项
export const SYSTEM_STATUS_OPTIONS = [
  { label: '正常', value: '0' },
  { label: '停用', value: '1' }
]

// 是否选项
export const YES_NO_OPTIONS = [
  { label: '是', value: 'Y' },
  { label: '否', value: 'N' }
]

// 用户性别选项
export const USER_SEX_OPTIONS = [
  { label: '男', value: '0' },
  { label: '女', value: '1' },
  { label: '未知', value: '2' }
]

// 字典状态选项
export const DICT_STATUS_OPTIONS = [
  { label: '正常', value: '0' },
  { label: '停用', value: '1' }
]

// 模版状态选项
export const TEMPLATE_STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' }
]

// 文档状态选项
export const DOCUMENT_STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' }
]

// 分页默认配置
export const PAGINATION_CONFIG = {
  pageSize: 20,
  pageSizes: [10, 20, 50, 100]
}

