/**
 * 售前交流平台 - 销售页面配置文件
 * 包含所有字典项、选项配置等
 */

// ==================== 1. 导航和标签配置 ====================

/**
 * Dashboard 标签选项
 */
export const dashboardTabOptions = [
  { label: '重点关注产品', value: 'products' },
  { label: '品牌基础资料', value: 'brand' }
]

/**
 * 品牌资料标签选项
 */
export const brandTabOptions = [
  { label: '公司介绍', value: 'company' },
  { label: '产品全向图', value: 'products' },
  { label: '制度解读合集', value: 'regulations' },
  { label: '台历', value: 'calendar' },
  { label: '监管合规', value: 'compliance' },
  { label: '泛监管', value: 'general' },
  { label: '协同信创', value: 'xinchuang' },
  { label: '地方金融监管', value: 'local' },
  { label: '金融票据业务', value: 'bill' }
]

/**
 * 主标签页选项
 */
export const mainTabOptions = [
  { label: '产品介绍PPT', value: 'ppt' },
  { label: '交流会议', value: 'video' },
  { label: '客户关心问题', value: 'qa' },
  { label: '招标文件', value: 'tender' },
  { label: '响应文件', value: 'response' }
]

// ==================== 2. 筛选器选项配置 ====================

/**
 * 产品解决方案选项
 */
export const productSolutionOptions = [
  { label: '一表通', value: '一表通' },
  { label: '1104', value: '1104' },
  { label: '受益所有人', value: '受益所有人' },
  { label: '反洗钱', value: '反洗钱' },
  { label: '金数', value: '金数' }
]

/**
 * 行业选项
 */
export const industryOptions = [
  { label: '全国/股份制/政策性银行', value: '全国/股份制/政策性银行' },
  { label: '城商行', value: '城商行' },
  { label: '外资行', value: '外资行' },
  { label: '农商', value: '农商' },
  { label: '财务公司', value: '财务公司' },
  { label: '信托公司', value: '信托公司' },
  { label: '汽车/消费金融', value: '汽车/消费金融' },
  { label: '金融租赁', value: '金融租赁' },
  { label: '其他', value: '其他' }
]

/**
 * 交流对象选项
 */
export const audienceOptions = [
  { label: '技术', value: '技术' },
  { label: '技术负责人', value: '技术负责人' },
  { label: '业务', value: '业务' },
  { label: '业务负责人', value: '业务负责人' }
]

/**
 * 语言选项
 */
export const languageOptions = [
  { label: '中文', value: '中文' },
  { label: '英文', value: '英文' }
]

/**
 * PPT目录选项（映射到后端的page_type编码）
 */
export const pptCatalogOptions = [
 
]

/**
 * 客户属性选项（银行类型）
 */
export const customerTypeOptions = [
  { label: '全国/股份制/政策性银行', value: '全国/股份制/政策性银行' },
  { label: '城商行', value: '城商行' },
  { label: '外资行', value: '外资行' },
  { label: '农商', value: '农商' },
  { label: '财务公司', value: '财务公司' },
  { label: '信托公司', value: '信托公司' },
  { label: '汽车/消费金融', value: '汽车/消费金融' },
  { label: '金融租赁', value: '金融租赁' },
  { label: '其他', value: '其他' }
]

/**
 * 会议类型选项
 */
export const meetingTypeOptions = [
  { label: '首次交流', value: '首次交流' },
  { label: '需求调研', value: '需求调研' },
  { label: '方案讲解', value: '方案讲解' },
  { label: '技术答疑', value: '技术答疑' },
  { label: '投标澄清', value: '投标澄清' },
  { label: '高层汇报', value: '高层汇报' }
]

/**
 * 参会人员选项
 */
export const participantsOptions = [
  { label: '技术', value: '技术' },
  { label: '技术负责人', value: '技术负责人' },
  { label: '业务', value: '业务' },
  { label: '业务负责人', value: '业务负责人' }
]

/**
 * 提问人层级选项
 */
export const questionerOptions = [
  { label: '决策层', value: '决策层' },
  { label: '管理层', value: '管理层' },
  { label: '技术层', value: '技术层' },
  { label: '使用层', value: '使用层' }
]

/**
 * 交流阶段选项
 */
export const exchangeStageOptions = [
  { label: '初步接触', value: '初步接触' },
  { label: '需求调研', value: '需求调研' },
  { label: '方案讲解', value: '方案讲解' },
  { label: '技术答疑', value: '技术答疑' },
  { label: '投标澄清', value: '投标澄清' }
]

/**
 * 用户需求选项
 */
export const userNeedsOptions = [
  { label: '产品功能咨询', value: '产品功能咨询' },
  { label: '价格与优惠', value: '价格与优惠' },
  { label: '交付周期', value: '交付周期' },
  { label: '售后保障', value: '售后保障' },
  { label: '技术适配性', value: '技术适配性' }
]

/**
 * 问题类型选项
 */
export const questionTypeOptions = [
  { label: '信息收集', value: '信息收集' },
  { label: '对比评估', value: '对比评估' },
  { label: '风险担忧', value: '风险担忧' },
  { label: '价值探寻', value: '价值探寻' },
  { label: '细节深挖', value: '细节深挖' },
  { label: '潜在痛点', value: '潜在痛点' }
]

/**
 * 采购方式选项
 */
export const procurementMethodOptions = [
  { label: '公开招标', value: '公开招标' },
  { label: '邀请招标', value: '邀请招标' },
  { label: '竞争性谈判', value: '竞争性谈判' },
  { label: '询价', value: '询价' },
  { label: '单一来源', value: '单一来源' }
]

/**
 * 项目需求概览选项
 */
export const projectOverviewOptions = [
  { label: '项目背景', value: '项目背景' },
  { label: '建设目标', value: '建设目标' },
  { label: '项目范围', value: '项目范围' },
  { label: '叫服务清单', value: '叫服务清单' },
  { label: '项目周期要求', value: '项目周期要求' }
]

/**
 * 技术要求选项
 */
export const technicalRequirementsOptions = [
  { label: '性能要求', value: '性能要求' },
  { label: '非功能性要求', value: '非功能性要求' },
  { label: '关键技术要求', value: '关键技术要求' }
]

/**
 * 资格与评审规则选项
 */
export const qualificationReviewOptions = [
  { label: '硬性门槛', value: '硬性门槛' },
  { label: '评分标准', value: '评分标准' }
]

/**
 * 合同与商务选项
 */
export const contractBusinessOptions = [
  { label: '付款方式', value: '付款方式' },
  { label: '验收标准', value: '验收标准' },
  { label: '知识产权归属', value: '知识产权归属' },
  { label: '违约责任', value: '违约责任' },
  { label: '保修与运维', value: '保修与运维' }
]

/**
 * 报价区间选项
 */
export const quotationOptions = [
  { label: '10万以下', value: '10万以下' },
  { label: '10万-20万', value: '10万-20万' },
  { label: '20万-50万', value: '20万-50万' },
  { label: '50-100万', value: '50-100万' },
  { label: '100万-200万', value: '100万-200万' },
  { label: '200万-500万', value: '200万-500万' },
  { label: '500万以上', value: '500万以上' }
]

/**
 * 投标状态选项
 */
export const bidStatusOptions = [
  { label: '已提交', value: '已提交' },
  { label: '中标', value: '中标' },
  { label: '未中标', value: '未中标' },
  { label: '弃标', value: '弃标' }
]

/**
 * 商务资质选项
 */
export const businessQualificationOptions = [
  { label: '公司简介', value: '公司简介' },
  { label: '发展历程', value: '发展历程' },
  { label: '组织架构', value: '组织架构' },
  { label: '资质证明', value: '资质证明' },
  { label: '财务状况', value: '财务状况' },
  { label: '核心团队简历', value: '核心团队简历' },
  { label: '商务偏离表', value: '商务偏离表' },
  { label: '报价单', value: '报价单' }
]

/**
 * 技术方案选项
 */
export const technicalSolutionOptions = [
  { label: '总体架构', value: '总体架构' },
  { label: '功能模块设计', value: '功能模块设计' },
  { label: '关键技术选型说明', value: '关键技术选型说明' },
  { label: '数据架构设计', value: '数据架构设计' },
  { label: '安全设计方案', value: '安全设计方案' },
  { label: '性能与高可用设计', value: '性能与高可用设计' }
]

/**
 * 实施与保障选项
 */
export const implementationGuaranteeOptions = [
  { label: '项目实施计划', value: '项目实施计划' },
  { label: '项目组织架构', value: '项目组织架构' },
  { label: '培训计划', value: '培训计划' },
  { label: '售后服务方案', value: '售后服务方案' },
  { label: '质量保障体系', value: '质量保障体系' },
  { label: '风险管理与应对', value: '风险管理与应对' }
]

/**
 * 案例与证明选项
 */
export const casesProofOptions = [
  { label: '成功案例', value: '成功案例' },
  { label: '知识产权说明', value: '知识产权说明' }
]

// ==================== 3. 产品目录结构 ====================

/**
 * 产品目录配置
 */
export const productCatalog = [
  {
    id: '1',
    text: '企业基本信息',
    children: [
      { id: '1.1', text: '公司简介' },
      { id: '1.2', text: '技术体系' },
      { id: '1.3', text: '业务体系' },
      { id: '1.4', text: '监管合作' },
      { id: '1.5', text: '机构合作' }
    ]
  },
  {
    id: '2',
    text: '监管发文与背景分析',
    children: [
      { id: '2.1', text: '行业监管发展' },
      { id: '2.2', text: '监管要求' },
      { id: '2.3', text: '客户痛点/难点' }
    ]
  },
  {
    id: '3',
    text: '产品解决方案',
    children: [
      { id: '3.1', text: '解决方案概述' },
      { id: '3.2', text: '产品架构设计' },
      { id: '3.3', text: '产品功能详解' },
      { id: '3.4', text: 'Demo与交互演示' },
      { id: '3.5', text: '产品优势说明' },
      { id: '3.6', text: '产品应用场景' }
    ]
  },
  {
    id: '4',
    text: '实施计划',
    children: [
      { id: '4.1', text: '软硬件资源需求' },
      { id: '4.2', text: '实施服务流程' },
      { id: '4.3', text: '联调安排' },
      { id: '4.4', text: '售后服务保障' }
    ]
  },
  {
    id: '5',
    text: '合作案例',
    children: []
  }
]

// ==================== 4. 公司组织结构 ====================

/**
 * 公司组织结构配置
 */
export const companyStructure = [
  {
    department: '技术部',
    members: [
      { id: 'tech1', name: '张三', role: '技术' },
      { id: 'tech2', name: '李四', role: '技术' },
      { id: 'tech3', name: '王五', role: '技术' }
    ]
  },
  {
    department: '技术部',
    members: [
      { id: 'tech_lead1', name: '赵六', role: '技术负责人' },
      { id: 'tech_lead2', name: '孙七', role: '技术负责人' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz1', name: '周八', role: '业务' },
      { id: 'biz2', name: '吴九', role: '业务' },
      { id: 'biz3', name: '郑十', role: '业务' }
    ]
  },
  {
    department: '业务部',
    members: [
      { id: 'biz_lead1', name: '钱一', role: '业务负责人' },
      { id: 'biz_lead2', name: '钱二', role: '业务负责人' }
    ]
  },
  {
    department: '产品部',
    members: [
      { id: 'prod1', name: '产品经理A', role: '产品' },
      { id: 'prod2', name: '产品经理B', role: '产品' }
    ]
  },
  {
    department: '销售部',
    members: [
      { id: 'sales1', name: '销售A', role: '销售' },
      { id: 'sales2', name: '销售B', role: '销售' }
    ]
  }
]

// ==================== 5. 响应文件目录结构 ====================

/**
 * 响应文件目录配置
 */
export const responseTocSections = [
  {
    title: '一、商务基础类',
    items: [
      '文件头部',
      '法定代表人身份证明',
      '法定代表人授权委托书',
      '投标人基本情况表',
      '资格审查资料',
      '投标保证金缴纳凭证',
      '公司资质证书',
      '类似项目业绩',
      '项目团队',
      '投标报价'
    ]
  },
  {
    title: '二、技术方案类',
    items: [
      '项目理解',
      '总体技术方案',
      '详细功能方案',
      '实施方案',
      '项目管理方案',
      '售后运维服务方案',
      '培训方案'
    ]
  },
  {
    title: '三、投标响应类',
    items: [
      '评分索引表',
      '投标函',
      '偏离表',
      '承诺函'
    ]
  }
]

/**
 * 响应文件扁平化目录（用于快速索引）
 */
export const responseTocFlat = responseTocSections.flatMap(section =>
  section.items.map(title => ({ section: section.title, title }))
)

// ==================== 6. 其他常量配置 ====================

/**
 * 版本类型
 */
export const versionTypes = {
  PUBLIC: 'public',
  PRACTICAL: 'practical'
}

/**
 * 版本标签映射
 */
export const versionLabels = {
  [versionTypes.PUBLIC]: '公共版',
  [versionTypes.PRACTICAL]: '实战版'
}

/**
 * 排序选项
 */
export const sortOptions = [
  { label: '综合排序', value: '综合排序' },
  { label: '最新上传', value: '最新上传' },
  { label: '最多下载', value: '最多下载' }
]

/**
 * 业务条线选项
 */
export const businessLineOptions = [
  { label: '监管条线', value: '监管条线' },
  { label: '信创协同条线', value: '信创协同条线' },
  { label: '票据条线', value: '票据条线' },
  { label: '互联网金融条线', value: '互联网金融条线' }
]

/**
 * 产品序号颜色配置
 */
export const productNumberColors = {
  0: '#E02020', // 第1名 - 红色
  1: '#FA6400', // 第2名 - 橙色
  2: '#F7B500', // 第3名 - 黄色
  default: '#DDEAFF' // 其他 - 灰蓝色
}

/**
 * 获取产品序号颜色
 * @param {number} index - 产品索引
 * @returns {string} 颜色值
 */
export function getProductNumberColor(index) {
  return productNumberColors[index] || productNumberColors.default
}
