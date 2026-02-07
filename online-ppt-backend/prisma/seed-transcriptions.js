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

// 中文筛选项（与前端 VideoPageView 一致）
const INDUSTRIES = ['全国/股份制/政策性银行', '城商行', '外资行', '农商', '财务公司', '信托公司', '汽车/消费金融', '金融租赁']
const MEETING_TYPES = ['首次交流', '需求调研', '方案讲解', '技术答疑', '投标澄清', '高层汇报']
const CUSTOMER_TYPES = ['新客户新产品', '老客户新产品', '老客户老产品']
const AUDIENCES = ['业务', '科技', '业务领导', '科技领导']
const LANGUAGES = ['中文', '英文']

const CUSTOMERS = ['北京银行', '上海农商银行', '招商银行', '渤海银行', '潍坊银行', '中信信托', '工商银行', '建设银行']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function sampleDialogues() {
  return JSON.stringify([
    { speaker: '客户', content: '想了解一下贵司一表通产品在数据报送方面的能力。', start_time: 0 },
    { speaker: '我方', content: '一表通支持多监管口径的报送，包括1104、人行等，支持配置化扩展。', start_time: 15 },
    { speaker: '客户', content: '实施周期大概多久？需要配合哪些资源？', start_time: 42 },
    { speaker: '我方', content: '标准实施一般3到6个月，需要贵方提供业务、科技接口人及测试环境。', start_time: 58 }
  ])
}

function buildFullText(dialoguesJson) {
  try {
    const arr = JSON.parse(dialoguesJson || '[]')
    return arr.map((d) => d.content).join(' ')
  } catch {
    return ''
  }
}

async function main() {
  console.log('🌱 开始初始化交流会议（transcriptions）假数据...')

  const products = await prisma.products.findMany({ take: 5, select: { id: true } })
  if (products.length === 0) {
    console.warn('⚠️ 未找到产品数据，请先执行 seed-products.js')
    await prisma.$disconnect()
    return
  }

  const count = 18
  const now = new Date()
  let created = 0

  for (let i = 0; i < count; i++) {
    const id = `tr_${randomUUID().slice(0, 8)}`
    const dialogues = sampleDialogues()
    const fullText = buildFullText(dialogues)
    const isCompleted = i < 14
    const status = isCompleted ? 'completed' : (i === 14 ? 'processing' : i === 15 ? 'failed' : 'pending')
    const completedAt = isCompleted ? new Date(now.getTime() - (count - i) * 86400000) : null

    const customerName = pick(CUSTOMERS)
    const productId = products[i % products.length].id

    await prisma.transcriptions.create({
      data: {
        id,
        name: `${customerName}${pick(MEETING_TYPES)}会议_${i + 1}`,
        original_file_name: `meeting_${20250101 + i}.mp3`,
        audio_file_path: `/uploads/audio/${id}.mp3`,
        audio_file_size: 1024000 * (5 + (i % 10)),
        audio_format: 'mp3',
        audio_duration: 300 + (i % 60) * 60,
        result_file_path: isCompleted ? `/results/${id}.json` : null,
        dialogues,
        full_text: fullText,
        speaker_count: 2,
        has_role_separation: true,
        speaker_roles: '{"SPEAKER_1":"customer","SPEAKER_2":"our_side"}',
        products: { connect: { id: productId } },
        customer_name: customerName,
        industry: pick(INDUSTRIES),
        meeting_type: pick(MEETING_TYPES),
        customer_type: pick(CUSTOMER_TYPES),
        audience: pick(AUDIENCES),
        language: pick(LANGUAGES),
        status,
        progress: isCompleted ? 100 : status === 'processing' ? 50 : 0,
        error_message: status === 'failed' ? '转录服务暂时不可用' : null,
        created_at: new Date(now.getTime() - (count - i) * 86400000),
        updated_at: now,
        completed_at: completedAt
      }
    })
    created++
    console.log(`✅ 创建转录: ${id} ${customerName}`)
  }

  console.log(`\n🎉 transcriptions 假数据初始化完成，共 ${created} 条`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
