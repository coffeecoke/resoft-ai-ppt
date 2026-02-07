// 首先加载环境变量（必须在 Prisma Client 初始化之前）
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envPath = path.join(__dirname, '..', '..', '.env')
dotenv.config({ path: envPath })

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// 问答对模板（用于造数，前端右侧 QA 展示）
const QA_TEMPLATES = [
  { q: '一表通在数据报送方面支持哪些监管口径？', a: '支持1104、人行等多口径报送，支持配置化扩展，可根据监管要求灵活接入。' },
  { q: '实施周期大概多久？需要客户配合哪些资源？', a: '标准实施一般3到6个月，需要贵方提供业务、科技接口人及测试环境。' },
  { q: '贵司在金融行业有哪些成功案例？', a: '已服务多家城商行、农商行，包括某某银行一表通项目已验收上线。' },
  { q: '数据安全与合规方面如何保障？', a: '满足等保要求，支持数据脱敏与权限管控，可与行内安全体系对接。' },
  { q: '是否支持与现有报表系统对接？', a: '支持标准接口与文件交换，可与现有数仓、报表平台对接。' },
  { q: '后续运维与升级如何安排？', a: '提供驻场或远程运维，版本升级按合同约定交付，支持需求定制。' },
  { q: '产品是否支持多机构类型？', a: '支持商业银行、农商、信托等多类型机构，按监管口径配置即可。' },
  { q: '实施团队规模和项目经验如何？', a: '专职实施团队数十人，具备多个同类项目交付经验。' },
  { q: '如何提升全国/股份制/政策性银行在资质与案例方面的业务敏捷性？', a: '针对全国/股份制/政策性银行在资质与案例方面的痛点，我们建议采用以下方案：1. 加强监管合规性管理；2. 优化实施路径；3. 提升业务效益。' },
  { q: '针对监管要求，城商行在合作模式模块的技术路径选择是什么？', a: '面对监管要求，城商行在合作模式方面需要重点关注：1. 建立完善的监管合规体系；2. 结合实际情况制定个性化的实施路径；3. 持续跟踪业务效益。' },
  { q: '产品性能如何优化？系统支持多大并发？', a: '产品支持千万级数据处理，单表查询响应时间<100ms，批量处理支持并发，系统可用性达到99.9%以上。' },
  { q: '项目实施流程是什么？需要多长时间？', a: '项目实施流程包括需求调研、方案设计、开发实施、测试验收、上线部署、培训交付等阶段，每个阶段都有明确的交付物。' }
]

// 时间范围示例（用于 time_range1）
const TIME_RANGES = ['[00:15-00:45]', '[01:20-02:10]', '[03:00-03:30]', '[05:10-06:00]', '[08:00-08:40]']

// 问题本质代码（I1-I5）
const INTENT_CODES = ['I1', 'I2', 'I3', 'I4', 'I5']

// 专家审核人
const EXPERT_REVIEWERS = ['张明', '李芳', '王强', '陈芳', '赵敏']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🌱 开始初始化 concerns（问答对）假数据...')

  const transcriptions = await prisma.transcriptions.findMany({
    take: 50,
    select: { id: true, industry: true, customer_name: true },
    orderBy: { created_at: 'desc' }
  })
  if (transcriptions.length === 0) {
    console.warn('⚠️ 未找到 transcriptions 数据，请先执行 seed-transcriptions.js')
    await prisma.$disconnect()
    return
  }

  const categories = await prisma.concern_categories.findMany({
    where: { level: 2, is_active: true },
    select: { code: true },
    take: 20
  })
  const categoryCodes = categories.length > 0 ? categories.map((c) => c.code) : ['1.1', '1.2', '2.1', '2.2', '3.1']

  let created = 0
  for (const row of transcriptions) {
    const count = 3 + Math.floor(Math.random() * 5) // 每个 transcription 生成 3-7 条问题
    for (let i = 0; i < count; i++) {
      const template = pick(QA_TEMPLATES)
      const id = `con_${randomUUID().slice(0, 8)}`
      const hasExpertAnswer = Math.random() > 0.6 // 40% 有专家答案

      try {
        const code = pick(categoryCodes)
        await prisma.concerns.create({
          data: {
            id,
            question: template.q,
            answer: template.a,
            category_code: code,
            intent_code: pick(INTENT_CODES),
            transcription_id: row.id,
            time_range1: pick(TIME_RANGES),
            status: 'answered',
            likes: randomInt(10, 200),
            expert_approved: hasExpertAnswer,
            expert_advice: hasExpertAnswer ? `作为行业专家，我认为这个问题需要重点关注以下几个方面：首先，要建立完善的监管合规体系；其次，要结合实际情况制定个性化的实施路径；最后，要持续跟踪业务效益，及时调整策略。` : null,
            expert_reviewer: hasExpertAnswer ? pick(EXPERT_REVIEWERS) : null
          }
        })
        created++
      } catch (e) {
        console.warn(`创建 concern ${id} 失败:`, e.message)
      }
    }
  }

  console.log(`\n🎉 concerns 假数据初始化完成，共 ${created} 条`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
