// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 从项目根目录加载 .env 文件
const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

/**
 * 问答对分类初始化数据
 * 根据《售前问答对分类提示词（完善版）》生成
 * 包含：6大分类层面、23个分类类别、5个问题性质
 */

const categoriesData = [
  // ==================== 分类层面（level=1） ====================
  {
    code: '1',
    name: '公司层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '公司层面的相关问题分类',
    keywords: ['资质', '认证', '公司规模', '合作模式', '监管资源'],
    sort_order: 1
  },
  {
    code: '2',
    name: '产品层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '产品层面的相关问题分类',
    keywords: ['性能', '架构', '功能', '兼容性'],
    sort_order: 2
  },
  {
    code: '3',
    name: '业务层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '业务层面的相关问题分类',
    keywords: ['监管政策', '数据安全', '业务适配'],
    sort_order: 3
  },
  {
    code: '4',
    name: '商务层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '商务层面的相关问题分类',
    keywords: ['预算', '报价', '价格', '优惠政策'],
    sort_order: 4
  },
  {
    code: '5',
    name: '项目实施层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '项目实施层面的相关问题分类',
    keywords: ['POC', '项目周期', '项目团队', '项目管控', '资源配置', '数据迁移'],
    sort_order: 5
  },
  {
    code: '6',
    name: '售后保障层面',
    type: 'level',
    parent_code: null,
    level: 1,
    description: '售后保障层面的相关问题分类',
    keywords: ['运维', '培训', '安全支撑'],
    sort_order: 6
  },

  // ==================== 分类类别（level=2） ====================
  // 1. 公司层面（4个类别）
  {
    code: '1.1',
    name: '资质与案例',
    type: 'category',
    parent_code: '1',
    level: 2,
    description: '当客户询问/要求提供公司或项目层面的资质证明、行业准入能力、同类机构成功案例或验收证明时，归为本类。',
    keywords: ['资质', '认证', 'CMMI', 'ISO', '涉密', '金融行业准入能力', '某一机构类型合作深度', '合作客户类型体量', '合作案例', '成功案例', '验收报告', '客户评价', '行业解决方案'],
    sort_order: 1
  },
  {
    code: '1.2',
    name: '公司规模与背景',
    type: 'category',
    parent_code: '1',
    level: 2,
    description: '当客户关注公司规模、成立年限、注册资本、团队人数及稳定性（尤其研发/实施交付能力）时，归为本类。',
    keywords: ['注册资金', '成立时间', '人员规模', '研发团队', '实施团队', '公司历史', '组织架构', '分支机构'],
    sort_order: 2
  },
  {
    code: '1.3',
    name: '合作模式',
    type: 'category',
    parent_code: '1',
    level: 2,
    description: '当客户询问合作方式（项目型、人力外包型、个性化开发型等）以及双方协作模式时，归为本类。',
    keywords: ['项目型', '人力外包型', '个性化开发型', '合作框架', '服务模式', '交付模式'],
    sort_order: 3
  },
  {
    code: '1.4',
    name: '监管资源与协作',
    type: 'category',
    parent_code: '1',
    level: 2,
    description: '当客户询问对监管政策的理解、解读服务能力、与监管沟通协作能力或对接资源时，归为本类。',
    keywords: ['监管机构对接', '监管政策解读', '监管协作', '政策咨询'],
    sort_order: 4
  },

  // 2. 产品层面（4个类别）
  {
    code: '2.1',
    name: '性能与效率',
    type: 'category',
    parent_code: '2',
    level: 2,
    description: '当客户询问系统性能指标、并发吞吐、稳定性、容量上限、压测结果、故障恢复与可用性保障时，归为本类。',
    keywords: ['性能', '稳定性', '并发性', '可用性', '负载'],
    sort_order: 5
  },
  {
    code: '2.2',
    name: '产品架构',
    type: 'category',
    parent_code: '2',
    level: 2,
    description: '当客户询问系统架构形态（应用/数据/技术架构）、技术选型、架构扩展性与稳定性设计时，归为本类。',
    keywords: ['应用架构', '数据架构', '技术架构', '微服务', '分布式', '高可用', '架构设计'],
    sort_order: 6
  },
  {
    code: '2.3',
    name: '产品功能',
    type: 'category',
    parent_code: '2',
    level: 2,
    description: '当客户询问产品能做什么、是否覆盖关键业务流程/模块、报送校验规则与监管是否一致、是否可进行个性化功能开发时，归为本类。',
    keywords: ['功能', '业务处理流程', '数据加工流程', '监管一致性', '发文校验规则', '功能模块', '操作流程'],
    sort_order: 7
  },
  {
    code: '2.4',
    name: '兼容性与接口扩展',
    type: 'category',
    parent_code: '2',
    level: 2,
    description: '当客户询问与现有技术栈兼容性（数据库/中间件/操作系统等）、接口对接方式与标准、新业务快速部署能力、后续功能扩展机制时，归为本类。',
    keywords: ['兼容', '中间件', '数据库', '操作系统', '新业务快速部署', '接口', '拓展', '集成能力', '对接标准', '扩展机制'],
    sort_order: 8
  },

  // 3. 业务层面（3个类别）
  {
    code: '3.1',
    name: '监管政策适配',
    type: 'category',
    parent_code: '3',
    level: 2,
    description: '当客户询问对监管发文/规则的适配机制、更新响应时效、报送满足度以及变更管理与质量保障时，归为本类。',
    keywords: ['监管政策响应时效', '满足报送要求', '监管发文分析', '政策解读', '合规适配', '政策更新'],
    sort_order: 9
  },
  {
    code: '3.2',
    name: '数据安全与合规治理',
    type: 'category',
    parent_code: '3',
    level: 2,
    description: '当客户询问数据安全与合规要求（加密/脱敏/权限控制）、历史数据处理与清洗方案、数据质量校验机制、数据复用与风险预警能力时，归为本类。',
    keywords: ['数据安全', '历史数据处理', '数据价值挖掘', '数据特征分析', '风险预警', '数据复用', '数据加密', '数据脱敏', '权限控制', '数据质量'],
    sort_order: 10
  },
  {
    code: '3.3',
    name: '业务适配与定制化',
    type: 'category',
    parent_code: '3',
    level: 2,
    description: '当客户询问是否能适配本行细分业务场景、是否支持自定义报表、校验规则、流程或口径差异时，归为本类。',
    keywords: ['适配细分业务场景', '定制化', '自定义报表', '校验规则', '业务个性化', '场景适配', '定制开发'],
    sort_order: 11
  },

  // 4. 商务层面（2个类别）
  {
    code: '4.1',
    name: '预算与报价',
    type: 'category',
    parent_code: '4',
    level: 2,
    description: '当客户询问预算匹配、报价构成（软件产品、人员实施费用等）、分期报价方式或成本测算时，归为本类。',
    keywords: ['分期', '产品费用', '人员费用', '报价单', '费用构成', '预算匹配'],
    sort_order: 12
  },
  {
    code: '4.2',
    name: '价格竞争力与优惠政策',
    type: 'category',
    parent_code: '4',
    level: 2,
    description: '当客户询问其他厂商价格区间、竞品价格对比、折扣/优惠政策等价格问题时，归为本类。',
    keywords: ['同类型客户价格范围', '其他厂商的价格', '优惠政策', '折扣', '竞品对比', '价格优势'],
    sort_order: 13
  },

  // 5. 项目实施层面（6个类别）
  {
    code: '5.1',
    name: 'POC',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问POC验证方案、测试环境要求、样本数据准备、验证范围与标准、验证周期与输出物时，归为本类。',
    keywords: ['POC', '验证', '样本数据', '环境', '测试方案', '验证标准', '验证周期', '验证输出'],
    sort_order: 14
  },
  {
    code: '5.2',
    name: '项目周期',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问项目总周期、各阶段计划（需求/开发/测试SIT-UAT/上线/试运行/验收）、里程碑与关键节点时，归为本类。',
    keywords: ['总周期', '需求确认', '项目启动', '测试', 'SIT', 'UAT', '上线', '试运行', '工期', '里程碑', '交付时间', '进度计划'],
    sort_order: 15
  },
  {
    code: '5.3',
    name: '项目团队',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问实施交付团队如何配置、关键角色资历、人员到岗时间、驻场安排与交付节奏时，归为本类。',
    keywords: ['人员构成', '人员资历', '项目经理', '团队配置', '角色分工', '驻场安排', '人员稳定性'],
    sort_order: 16
  },
  {
    code: '5.4',
    name: '项目管控',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问如何管控质量与进度、如何处理风险与变更、交付过程的度量与工具方法时，归为本类。',
    keywords: ['质量管理', '进度管控', '风险应对', '变更管理'],
    sort_order: 17
  },
  {
    code: '5.5',
    name: '资源配置',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问软硬件资源清单、环境搭建与隔离、网络与部署准备时，归为本类。',
    keywords: ['软硬件资源', '环境', '网络', '资源清单', '环境搭建', '部署准备'],
    sort_order: 18
  },
  {
    code: '5.6',
    name: '数据迁移与系统切换',
    type: 'category',
    parent_code: '5',
    level: 2,
    description: '当客户询问历史数据迁移方式、迁移校验与回滚、单轨/双轨并行测试、无感切换与上线切换策略时，归为本类。',
    keywords: ['迁移方式', '数据完整性', '单轨测试', '双轨并行', '无感切换', '切换策略'],
    sort_order: 19
  },

  // 6. 售后保障层面（4个类别）
  {
    code: '6.1',
    name: '运维内容',
    type: 'category',
    parent_code: '6',
    level: 2,
    description: '当客户询问运维服务包含哪些内容、响应机制、支持方式（远程/驻场）、巡检升级与日常支持机制时，归为本类。',
    keywords: ['服务内容', '响应机制', '服务方式', '人员配置', '远程支持', '驻场服务', '巡检升级', '日常支持'],
    sort_order: 20
  },
  {
    code: '6.2',
    name: '运维费用和周期',
    type: 'category',
    parent_code: '6',
    level: 2,
    description: '当客户询问免费运维期、多长周期、收费标准、超出范围的增值服务与计费规则时，归为本类。',
    keywords: ['运维费用', '免费期', '有偿', '增值服务', '收费标准', '服务周期'],
    sort_order: 21
  },
  {
    code: '6.3',
    name: '培训与知识转移',
    type: 'category',
    parent_code: '6',
    level: 2,
    description: '当客户询问培训安排（业务/技术）、交付物清单、知识转移方式、源码/文档交付与知识产权边界时，归为本类。',
    keywords: ['知识产权', '源码', '技术培训', '业务培训', '培训安排', '交付物清单', '知识转移', '文档交付'],
    sort_order: 22
  },
  {
    code: '6.4',
    name: '安全支撑',
    type: 'category',
    parent_code: '6',
    level: 2,
    description: '当客户询问系统漏洞响应与修复机制、数据保密措施、信息安全合规保障、应急安全事件处理流程时，归为本类。',
    keywords: ['漏洞解决', '信息安全', '数据保密', '漏洞响应', '安全合规', '应急处理', '安全措施'],
    sort_order: 23
  },

  // 7. 其他（无法归类的问答对）
  {
    code: '0.0',
    name: '其他',
    type: 'category',
    parent_code: null,
    level: 2,
    description: '当问答对无法归入上述任何分类类别时，归为本类。包括但不限于：礼节性交流、背景说明、无法明确分类的问题等。',
    keywords: ['其他', '无法分类', '未归类', '杂项'],
    sort_order: 24
  },

  // ==================== 问题性质（level=3，intent类型） ====================
  {
    code: 'I1',
    name: '确认类（确认产品功能）',
    type: 'intent',
    parent_code: null,
    level: 3,
    description: '获取准确信息、消除认知模糊。典型语气特征："是否"、"能否"、"有没有"、"可不可以"',
    keywords: ['是否', '能否', '有没有', '可不可以', '可以吗', '支持吗'],
    sort_order: 24
  },
  {
    code: 'I2',
    name: '对比类（与竞品差异）',
    type: 'intent',
    parent_code: null,
    level: 3,
    description: '识别差异化优势、支持决策选型。典型语气特征："比"、"相比"、"差异"、"优势"、"区别"',
    keywords: ['比', '相比', '差异', '优势', '区别', '对比', '比较'],
    sort_order: 25
  },
  {
    code: 'I3',
    name: '顾虑类（担心使用效果）',
    type: 'intent',
    parent_code: null,
    level: 3,
    description: '识别风险、寻求保障。典型语气特征："担心"、"顾虑"、"会不会"、"能不能保证"、"怕"',
    keywords: ['担心', '顾虑', '会不会', '能不能保证', '怕', '风险', '问题'],
    sort_order: 26
  },
  {
    code: 'I4',
    name: '建议类（希望功能优化）',
    type: 'intent',
    parent_code: null,
    level: 3,
    description: '提出改进需求、寻求定制化。典型语气特征："建议"、"希望"、"最好"、"能不能改"、"可以增加"',
    keywords: ['建议', '希望', '最好', '能不能改', '可以增加', '优化', '改进'],
    sort_order: 27
  },
  {
    code: 'I5',
    name: '其它意图',
    type: 'intent',
    parent_code: null,
    level: 3,
    description: '无法归入上述4类的意图，如礼节性交流、背景说明、杂项意图',
    keywords: [],
    sort_order: 28
  }
]

/**
 * 初始化问答对分类数据
 */
async function seedConcernCategories() {
  console.log('开始初始化问答对分类数据...')

  try {
    // 清空现有数据（可选，根据需求决定是否保留）
    const existingCount = await prisma.concern_categories.count()
    if (existingCount > 0) {
      console.log(`发现 ${existingCount} 条现有数据，将清空后重新插入...`)
      await prisma.concern_categories.deleteMany({})
    }

    // 批量插入数据
    for (const item of categoriesData) {
      const id = randomUUID()
      await prisma.concern_categories.create({
        data: {
          id,
          code: item.code,
          name: item.name,
          type: item.type,
          parent_code: item.parent_code,
          level: item.level,
          description: item.description,
          keywords: item.keywords,
          sort_order: item.sort_order,
          is_active: true
        }
      })
      console.log(`✓ 已插入: ${item.code} - ${item.name}`)
    }

    console.log(`\n✅ 成功初始化 ${categoriesData.length} 条问答对分类数据`)
    console.log(`   - 分类层面: 6个`)
    console.log(`   - 分类类别: 24个（包含"其他"分类）`)
    console.log(`   - 问题性质: 5个`)

    // 验证数据
    const totalCount = await prisma.concern_categories.count()
    const levelCount = await prisma.concern_categories.count({ where: { level: 1 } })
    const categoryCount = await prisma.concern_categories.count({ where: { level: 2 } })
    const intentCount = await prisma.concern_categories.count({ where: { level: 3 } })

    console.log(`\n📊 数据统计:`)
    console.log(`   - 总计: ${totalCount} 条`)
    console.log(`   - 分类层面: ${levelCount} 条`)
    console.log(`   - 分类类别: ${categoryCount} 条`)
    console.log(`   - 问题性质: ${intentCount} 条`)

  } catch (error) {
    console.error('❌ 初始化失败:', error)
    throw error
  }
}

// 执行初始化
seedConcernCategories()
  .then(() => {
    console.log('\n✨ 初始化完成')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ 初始化失败:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

