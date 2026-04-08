/**
 * 销售平台常量配置
 * 存放所有选项常量
 */

// 产品列表
export const PRODUCTS = [
  { label: '一表通', value: '一表通' },
  { label: '1104', value: '1104' },
  { label: '受益所有人', value: '受益所有人' },
  { label: '反洗钱', value: '反洗钱' },
  { label: '金数', value: '金数' },
]

// 行业类型 - 已迁移到数据库 customer_types 表，请使用 useSalesOptions().industryOptions
/** @deprecated */
export const INDUSTRIES: { label: string; value: string }[] = []

// 交流对象
export const AUDIENCES = [
  { label: '技术', value: '技术' },
  { label: '技术负责人', value: '技术负责人' },
  { label: '业务', value: '业务' },
  { label: '业务负责人', value: '业务负责人' },
]

// 业务条线
export const BUSINESS_LINES = [
  { label: '监管条线', value: '监管条线' },
  { label: '信创协同条线', value: '信创协同条线' },
  { label: '票据条线', value: '票据条线' },
  { label: '互联网金融条线', value: '互联网金融条线' },
]

// 会议类型
export const MEETING_TYPES = [
  { label: '首次交流', value: '首次交流' },
  { label: '需求调研', value: '需求调研' },
  { label: '方案讲解', value: '方案讲解' },
  { label: '技术答疑', value: '技术答疑' },
  { label: '投标澄清', value: '投标澄清' },
  { label: '高层汇报', value: '高层汇报' },
]

// 采购方式
export const PROCUREMENT_METHODS = [
  { label: '公开招标', value: '公开招标' },
  { label: '邀请招标', value: '邀请招标' },
  { label: '竞争性谈判', value: '竞争性谈判' },
  { label: '询价', value: '询价' },
  { label: '单一来源', value: '单一来源' },
]

// 排序选项
export const SORT_OPTIONS = [
  { label: '综合排序', value: '综合排序' },
  { label: '最新上传', value: '最新上传' },
  { label: '最多下载', value: '最多下载' },
]

// 语言选项
export const LANGUAGES = [
  { label: '中文', value: '中文' },
  { label: '英文', value: '英文' },
]

// 版本类型
export const VERSION_TYPES = [
  { label: '公共版', value: 'public' },
  { label: '实战版', value: 'practical' },
]

// 品牌Tab选项
export const BRAND_TAB_OPTIONS = [
  { label: '公司介绍', value: 'company' },
  { label: '产品全向图', value: 'products' },
  { label: '制度解读合集', value: 'regulations' },
  { label: '台历', value: 'calendar' },
  { label: '监管合规', value: 'compliance' },
  { label: '泛监管', value: 'general' },
  { label: '协同信创', value: 'xinchuang' },
  { label: '地方金融监管', value: 'local' },
  { label: '金融票据业务', value: 'bill' },
]

// PPT目录选项（用于筛选）
export const PPT_CATALOG_OPTIONS = [
  { label: '产品案例', value: '产品案例' },
  { label: '监管发文与背景分析', value: '监管发文与背景分析' },
  { label: '行业发展趋势', value: '行业发展趋势' },
  { label: '监管要求', value: '监管要求' },
  { label: '客户痛难点', value: '客户痛难点' },
  { label: '解决方案概述', value: '解决方案概述' },
  { label: '产品架构设计', value: '产品架构设计' },
  { label: '产品功能详解', value: '产品功能详解' },
  { label: 'DEMO交互', value: 'DEMO交互' },
  { label: '产品优势说明', value: '产品优势说明' },
  { label: '产品应用场景', value: '产品应用场景' },
  { label: '软硬件资源需求', value: '软硬件资源需求' },
  { label: '实施服务流程', value: '实施服务流程' },
  { label: '售后服务保障', value: '售后服务保障' },
  { label: '其他', value: '其他' },
  { label: '合作伙伴名单', value: '合作伙伴名单' },
]

// 产品数字背景色（前3个特殊色，后面灰色）
export const getProductNumberColor = (index: number): string => {
  const colors = ['#FF6B35', '#4ECDC4', '#95E1D3']
  return index < 3 ? colors[index] : '#E8E8E8'
}

