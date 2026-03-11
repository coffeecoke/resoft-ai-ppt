/**
 * 投标文件章节类型配置
 * 用于 AI 拆分投标文件时的分类标准
 */

const BID_SECTION_TYPES = {
  cover_letter:        { name: '投标函/承诺书',   description: '投标函、投标承诺书、法定代表人授权书等' },
  company_profile:     { name: '公司简介/资质',   description: '企业概况、营业执照、资质证书、荣誉等' },
  technical_solution:  { name: '技术方案',        description: '总体设计、技术架构、功能设计、数据方案等' },
  implementation_plan: { name: '实施方案',        description: '项目实施计划、里程碑、进度安排、风险应对等' },
  project_management:  { name: '项目管理',        description: '项目管理体系、沟通机制、变更管理等' },
  quality_assurance:   { name: '质量保障',        description: '质量管理体系、测试方案、验收标准等' },
  after_sales_service: { name: '售后服务',        description: '运维方案、服务承诺、SLA、培训方案等' },
  team_composition:    { name: '项目团队',        description: '项目经理、核心人员简历、组织架构等' },
  case_reference:      { name: '案例/业绩',       description: '类似项目经验、成功案例、客户评价等' },
  pricing:             { name: '报价/商务',       description: '报价清单、费用明细、付款条件等' },
  security:            { name: '安全方案',        description: '信息安全、数据安全、安全保障措施等' },
  appendix:            { name: '附件/证明材料',    description: '证明文件、检测报告、知识产权等' },
  other:               { name: '其他',            description: '不属于以上类别的内容' },
}

const SECTION_TYPE_LIST = Object.entries(BID_SECTION_TYPES).map(([code, info]) => ({
  code,
  ...info,
}))

function getSectionTypeName(code) {
  return BID_SECTION_TYPES[code]?.name || '未知类型'
}

function getSectionTypeDescription(code) {
  return BID_SECTION_TYPES[code]?.description || ''
}

function buildSectionTypePromptText() {
  return SECTION_TYPE_LIST.map((t, i) =>
    `${i + 1}. ${t.code} — ${t.name}：${t.description}`
  ).join('\n')
}

module.exports = {
  BID_SECTION_TYPES,
  SECTION_TYPE_LIST,
  getSectionTypeName,
  getSectionTypeDescription,
  buildSectionTypePromptText,
}
