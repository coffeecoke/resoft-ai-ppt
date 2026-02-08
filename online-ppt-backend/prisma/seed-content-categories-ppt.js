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
 * 产品目录初始化数据（原 content_categories_ppt 数据）
 * 根据 1226产品拆分标准.xlsx 生成
 * 所有产品共用同一套目录结构，product_id 设为 null
 */
const categoriesData = [
  // ========== 一级分类：企业信息 ==========
  {
    level1: {
      name: '企业信息',
      code: 'enterprise_info',
      sortOrder: 1,
      description: '企业相关信息分类',
      children: [
        {
          name: '企业基础信息',
          code: 'enterprise_basic_info',
          sortOrder: 1,
          description: '从企业成立背景、基本规模、组织架构关联、核心定位及发展历程关键节点等维度,提取能反映企业基础属性的信息;排除项:资质证书、业务内容、产品信息、技术能力、客户案例。'
        },
        {
          name: '企业资质认证',
          code: 'enterprise_qualification',
          sortOrder: 2,
          description: '含官方认证机构颁发的证书,核心分两类:1.通用资质(软件著作权、ISO认证、高新技术企业证书);2.信创专项资质(产品信创适配证,如与飞腾/麒麟适配;数据库适配证,如与达梦/人大金仓互认)。排除项:非官方适配清单、企业技术能力描述、产品功能说明。'
        },
        {
          name: '业务条线介绍',
          code: 'business_line_intro',
          sortOrder: 3,
          description: '依据企业业务覆盖领域,将其研发的软件产品、解决方案及提供的服务,按监管合规、协同信创、地方金融监管、金融票据、业务咨询等业务方向进行分类,归为业务条线介绍类别:包含全产品名录,不含具体产品功能、客户案例、技术架构等深度内容。'
        },
        {
          name: '业务咨询实力',
          code: 'business_consulting_capability',
          sortOrder: 4,
          description: '包含专家团队/结构化知识体系;参与顶层设计并转化为客户服务的能力;咨询服务具体内容(如监管制度设计咨询、数据治理咨询等)。排除项:解决方案概述、项目实施细节、产品功能说明、技术架构设计。'
        },
        {
          name: '技术研发实力',
          code: 'technical_rd_capability',
          sortOrder: 5,
          description: '收集企业在技术架构、核心技术应用(大数据、人工智能、云计算、信创适配)、技术研发团队、专利与技术创新成果等方面的信息,归为技术实力类别,突出企业技术研发和应用能力。排除项:产品架构设计、具体功能操作、项目交付流程。'
        },
        {
          name: '工程交付实力',
          code: 'engineering_delivery_capability',
          sortOrder: 6,
          description: '含实施流程管理、交付团队能力、交付效率、交付质量、项目管理体系、质量保障体系等。排除项:具体项目的需求调研细节、售后维护服务、产品功能问题、技术问题解决方案。'
        }
      ]
    }
  },
  // ========== 一级分类：合作案例 ==========
  {
    level1: {
      name: '合作案例',
      code: 'cooperation_cases',
      sortOrder: 2,
      description: '合作案例相关信息分类',
      children: [
        {
          name: '监管合作',
          code: 'regulatory_cooperation',
          sortOrder: 1,
          description: '与监管机构的合作信息,合作对象为国家及地方金融监督管理机构、证监会、人民银行、外管局等;包括项目合作、监管制度设计参与、监管标准制定参与等。排除项:仅引用监管政策(无合作)、与非监管机构的合作、监管政策解读、行业趋势分析。'
        },
        {
          name: '机构合作',
          code: 'institutional_cooperation',
          sortOrder: 2,
          description: '包含具体合作机构名称(客户名称),可含合作产品/服务名称、合作内容或成效。包含内容:1.单个案例:含合作主体(客户名称)、合作场景(如监管报送/信创改造)、核心内容(产品/服务名称),具备"问题-方案-成效"中至少1项;2.合作列表:按行业或合作产品分类的合作主体汇总,标注核心合作内容(如"XX银行:监管报送系统");3.合作伙伴名单:仅列合作对象名称、机构logo,无合作场景/内容/成效等延伸信息。排除项:监管机构合作。'
        }
      ]
    }
  },
  // ========== 一级分类：监管政策与行业背景 ==========
  {
    level1: {
      name: '监管政策与行业背景',
      code: 'regulatory_policy_industry',
      sortOrder: 3,
      description: '监管政策与行业背景相关信息分类',
      children: [
        {
          name: '监管发文与背景分析',
          code: 'regulatory_documents_analysis',
          sortOrder: 1,
          description: '1. 核心要素:明确引用监管主体(如金融监管总局)、文件名称、文号、发布时间及出台依据;2. 政策背景:阐释宏观环境、行业背景、监管目标(可附数据/案例);3. 条款解读:提炼关键条款,说明约束对象与要求;排除项:单纯罗列条文、无具体文件的泛化趋势。'
        },
        {
          name: '行业发展趋势',
          code: 'industry_development_trends',
          sortOrder: 2,
          description: '围绕金融行业及监管报送、数据治理等核心场景,分析行业发展趋势(如金融监管数字化转型加速、数据治理要求趋严、穿透式监管升级等内容);排除项:依托具体监管文件的解读、含产品关联的场景描述、客户痛点问题。'
        },
        {
          name: '监管相关要求',
          code: 'regulatory_requirements',
          sortOrder: 3,
          description: '聚焦于外部监管机构(如人民银行、国家金融监督管理总局、外汇局等)针对报送或者系统建设提出的合规性、安全性、功能性要求;包括合规报送要求(数据报送的格式、频率、范围、校验规则)、安全防护要求、功能覆盖要求、数据治理要求等,归类于监管要求类别。'
        }
      ]
    }
  },
  // ========== 一级分类：产品解决方案 ==========
  {
    level1: {
      name: '产品解决方案',
      code: 'product_solutions',
      sortOrder: 4,
      description: '产品解决方案相关信息分类',
      children: [
        {
          name: '客户痛点/难点',
          code: 'customer_pain_points',
          sortOrder: 1,
          description: '聚焦产品相关业务场景,用具体现象或数据客观描述客户实际问题(如报送效率低、报送时间紧等),归类于客户痛点类别;排除项:产品适配逻辑、解决方案、项目实施难点、泛化行业问题。'
        },
        {
          name: '解决方案概述',
          code: 'solution_overview',
          sortOrder: 2,
          description: '产品简介、方案说明,仅说明方案核心解决逻辑及预期目标;排除项:技术架构、功能模块、实施步骤、产品与场景的适配关系。'
        },
        {
          name: '产品架构设计',
          code: 'product_architecture_design',
          sortOrder: 3,
          description: '系统性地阐述产品设计架构,内容包括业务架构、数据架构、部署架构、技术架构、应用架构、系统架构等架构中的任意一类;含层级区分及模块关联(用标题/箭头等标识);排除项:具体功能操作、技术研发能力描述、架构细节参数。'
        },
        {
          name: '产品功能详解',
          code: 'product_function_details',
          sortOrder: 4,
          description: '产品功能的具体操作、产品页面截图;明确"数据补录""校验结果查询"等具体功能点,包含"报文生成-数据校验-报文打包"等操作流程,且说明功能具体价值,面向业务使用者的内容,归类于产品功能详解类别。'
        },
        {
          name: 'Demo 与交互演示',
          code: 'demo_interactive_presentation',
          sortOrder: 5,
          description: '以视频/原型/投屏等载体,聚焦核心功能/场景的直观演示;排除项:静态功能说明、无交互的图片展示、具体客户案例。'
        },
        {
          name: '产品优势说明',
          code: 'product_advantage_description',
          sortOrder: 6,
          description: '从功能、技术、体验等维度提炼产品差异化优势,并将优势转化为"报送效率提升 XXX""全面信创支持"等客户可感知价值的内容;排除项:单纯功能罗列、场景适配逻辑、案例成效数据。'
        },
        {
          name: '产品应用场景',
          code: 'product_application_scenarios',
          sortOrder: 7,
          description: '1. 场景三要素:行业(如银行)、具体情境(如反洗钱现场检查)、核心需求(如缩短周期);2. 适配逻辑:产品功能/方案与需求的匹配关系(如"自动化功能适配高频报送");排除项:具体客户案例、方案核心逻辑、泛化行业趋势、纯问题陈述。'
        },
        {
          name: '软硬件资源需求',
          code: 'software_hardware_requirements',
          sortOrder: 8,
          description: '明确本地化/云部署场景下的硬件(服务器参数)、软件(操作系统)要求;排除项:兼容性测试、采购成本、实施流程、技术架构。'
        }
      ]
    }
  },
  // ========== 一级分类：部署实施及售后保障 ==========
  {
    level1: {
      name: '部署实施及售后保障',
      code: 'deployment_after_sales',
      sortOrder: 5,
      description: '部署实施及售后保障相关信息分类',
      children: [
        {
          name: '实施服务流程',
          code: 'implementation_service_process',
          sortOrder: 1,
          description: '按时间顺序梳理"调研→部署→验收"等步骤,含核心工作、责任人、周期及客户配合事项;排除项:售后维护、交付团队能力描述、技术问题解决。'
        },
        {
          name: '售后服务保障',
          code: 'after_sales_service_guarantee',
          sortOrder: 2,
          description: '含售后响应机制、技术支持、维护、培训、巡检等信息;排除项:实施阶段服务、产品功能问题解答、资源需求说明。'
        }
      ]
    }
  },
  // ========== 一级分类：其他 ==========
  {
    level1: {
      name: '其他',
      code: 'other',
      sortOrder: 6,
      description: '其他无法归类的内容',
      children: [
        {
          name: '其他',
          code: 'other_content',
          sortOrder: 1,
          description: '1、封面、目录、章节过渡页、角落品牌LOGO等,删除后不影响方案理解;2、无法归类于以上类别的内容;排除项:含核心业务信息的任何内容。'
        }
      ]
    }
  }
]

async function main() {
  console.log('🌱 开始初始化产品目录数据...')

  try {
    // ========== 步骤 1: 获取或创建通用产品 ==========
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    let generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      generalProduct = await prisma.products.create({
        data: {
          id: randomUUID(),
          name: '通用PPT内容分类',
          code: GENERAL_PRODUCT_CODE,
          description: '通用的PPT内容分类标准，适用于所有产品的内容分析',
          category: 'system',
          tags: ['通用', 'PPT分类', '内容分析'],
          sort_order: 0,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      })
      console.log(`✅ 创建通用产品: ${generalProduct.name} (${generalProduct.id})`)
    } else {
      console.log(`✅ 使用通用产品: ${generalProduct.name} (${generalProduct.id})`)
    }
    console.log('')
    
    // ========== 步骤 2: 检查是否已有数据 ==========
    const existingCatalogs = await prisma.product_catalogs.findMany({
      where: { product_id: generalProduct.id }
    })
    
    if (existingCatalogs.length > 0) {
      console.log(`⚠️  已有 ${existingCatalogs.length} 条分类数据，先清空旧数据...`)
      await prisma.product_catalogs.deleteMany({
        where: { product_id: generalProduct.id }
      })
      console.log('✅ 旧数据已清空\n')
    }

    // ========== 步骤 3: 创建分类数据 ==========
    // 遍历所有分类数据
    for (const categoryGroup of categoriesData) {
      const { level1 } = categoryGroup
      
      // 创建一级分类
      const parentId = randomUUID()
      const parentCategory = await prisma.product_catalogs.create({
        data: {
          id: parentId,
          product_id: generalProduct.id, // 🔧 修复：关联到通用产品
          parent_id: null,
          name: level1.name,
          code: level1.code,
          level: 1,
          description: level1.description,
          sort_order: level1.sortOrder,
          is_active: true,
          updated_at: new Date()
        }
      })
      
      console.log(`✅ 创建一级目录: ${level1.name} (${level1.code})`)

      // 创建二级分类
      for (const child of level1.children) {
        const childId = randomUUID()
        await prisma.product_catalogs.create({
          data: {
            id: childId,
            product_id: generalProduct.id, // 🔧 修复：关联到通用产品
            parent_id: parentId,
            name: child.name,
            code: child.code,
            level: 2,
            description: child.description,
            sort_order: child.sortOrder,
            is_active: true,
            updated_at: new Date()
          }
        })
        
        console.log(`  ✅ 创建二级目录: ${child.name} (${child.code})`)
      }
    }

    console.log('\n🎉 产品目录数据初始化完成！')
    console.log(`📊 统计: ${categoriesData.length} 个一级目录, ${categoriesData.reduce((sum, item) => sum + item.level1.children.length, 0)} 个二级目录`)

  } catch (error) {
    console.error('❌ 初始化失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

