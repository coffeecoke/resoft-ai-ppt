/**
 * 一表通 concerns 问答对统计分析 + AI 筛选有价值问题
 * 用法: node scripts/analyze-yibiatong-concerns.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const fs = require('fs').promises
const path = require('path')
const prisma = require('../server/utils/prisma')
const { OpenAI } = require('openai')
const XLSX = require('xlsx')

const PRODUCT = '一表通'
const BATCH_SIZE = 50 // 每批送 AI 的问题数
const AI_SAMPLE_FOR_FULL = process.env.AI_FULL !== '1' // 默认先抽样 200 条做 AI，设 AI_FULL=1 跑全量

function createEnvOpenAIClient() {
  const apiKey = (process.env.ai_key || process.env.CUSTOM_OPENAI_API_KEY || '').trim()
  const baseURL = (process.env.ai_url || process.env.CUSTOM_OPENAI_BASE_URL || '').trim()
  const model = (process.env.ai_model || 'glm-5').trim()
  if (!apiKey || !baseURL) throw new Error('缺少 .env 中 ai_key / ai_url')
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model
  }
}

function parseSpeakerRoles(raw) {
  if (!raw) return null
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return null
  }
}

function isCustomerQuestion(concern, rolesMap) {
  if (!concern.question_speaker || !concern.transcription_id) return null
  const roles = rolesMap[concern.transcription_id]
  if (!roles) return null
  const role = roles[concern.question_speaker]
  if (role === 'customer') return true
  if (role === 'our_side') return false
  return null
}

async function loadSpeakerRolesMap(transcriptionIds) {
  const map = {}
  if (!transcriptionIds.length) return map

  const transcriptions = await prisma.transcriptions.findMany({
    where: { id: { in: transcriptionIds } },
    select: { id: true, speaker_roles: true }
  })
  for (const t of transcriptions) {
    const r = parseSpeakerRoles(t.speaker_roles)
    if (r) map[t.id] = r
  }

  const adjustments = await prisma.dialogue_adjustments.findMany({
    where: {
      transcription_id: { in: transcriptionIds },
      speaker_roles: { not: null }
    },
    select: { transcription_id: true, speaker_roles: true },
    orderBy: { created_at: 'desc' }
  })
  for (const adj of adjustments) {
    if (!map[adj.transcription_id]) {
      const r = parseSpeakerRoles(adj.speaker_roles)
      if (r) map[adj.transcription_id] = r
    }
  }
  return map
}

async function fetchYibiatongConcerns() {
  const transcriptions = await prisma.transcriptions.findMany({
    where: { product_name: PRODUCT },
    select: {
      id: true,
      name: true,
      session_id: true,
      customer_name: true,
      meeting_type: true
    }
  })
  const transcriptionMap = Object.fromEntries(transcriptions.map(t => [t.id, t]))
  const transcriptionIds = transcriptions.map(t => t.id)

  const concerns = await prisma.concerns.findMany({
    where: { transcription_id: { in: transcriptionIds } },
    select: {
      id: true,
      question: true,
      answer: true,
      category_code: true,
      intent_code: true,
      status: true,
      review_status: true,
      transcription_id: true,
      question_speaker: true,
      answer_speaker: true,
      created_at: true
    },
    orderBy: { created_at: 'asc' }
  })

  return { concerns, transcriptionMap, transcriptions }
}

/** 从交流场次/文件名解析客户（机构）名称 */
function extractCustomerFromSession(sessionName) {
  const raw = String(sessionName || '').trim()
  if (!raw) return '未知'
  const base = raw.replace(/\.(m4a|mp3|MP3|wav|WAV|aac)$/i, '').trim()
  const dashParts = base.split('-').map(s => s.trim()).filter(Boolean)
  if (dashParts.length >= 3 && /^\d{8}$/.test(dashParts[0])) {
    const candidate = dashParts[2]
    if (candidate && candidate.length >= 2 && candidate.length <= 30) return candidate
  }
  const patterns = [
    /[\u4e00-\u9fa5]{2,20}(?:银行|农商行|商行|农信|农信社|银监局|银保监|资产|信托|电网|财务公司|财务)/,
    /[\u4e00-\u9fa5]{2,12}农商/
  ]
  for (const re of patterns) {
    const m = base.match(re)
    if (m) return m[0]
  }
  const cn = base.match(/^[\u4e00-\u9fa5]{2,20}/)
  if (cn) return cn[0]
  return '未知'
}

/** 规则预筛：去掉明显无信息量的短句/寒暄 */
function ruleFilterValuable(customerQuestions, transcriptionMap) {
  const noise = /^(嗯|啊|对|好|是的|可以|明白|了解|谢谢|没问题|继续|然后|那个|这个|就是说|嗯嗯|对对)$/
  const valuable = []
  const keywords = /一表通|报送|监管|数据|接口|架构|实施|部署|性能|数据库|国产化|信创|ETL|校验|台账|制度|需求|方案|招标|选型|竞品|预算|周期|组织|分工|运维|安全|容灾|备份|升级|迁移|模块|功能|试点|上线|培训/
  for (const c of customerQuestions) {
    const q = (c.question || '').trim()
    if (q.length < 6 || noise.test(q)) continue
    if (q.length >= 12 || keywords.test(q) || c.category_code || c.intent_code) {
      const tr = transcriptionMap[c.transcription_id] || {}
      const sessionName = tr.name || c.transcription_id || ''
      const bankFromName = (tr.customer_name || '').trim() || extractCustomerFromSession(sessionName)
      valuable.push({
        id: c.id,
        transcription_id: c.transcription_id,
        customer: bankFromName,
        session: sessionName,
        question: q,
        answer: (c.answer || '').trim().slice(0, 2000),
        category: c.category_code || '',
        intent: c.intent_code || '',
        source: 'rule'
      })
    }
  }
  return valuable
}

async function analyzeValuableWithAI(itemsToAnalyze, progressPath) {
  const { client, model } = createEnvOpenAIClient()
  const items = itemsToAnalyze.map((c, i) => ({
    idx: i + 1,
    id: c.id,
    transcription_id: c.transcription_id,
    customer: c.customer || '未知',
    session: c.session || '',
    question: (c.question || '').trim().slice(0, 500),
    answer: c.answer || '',
    category: c.category || c.category_code || '',
    intent: c.intent || c.intent_code || ''
  }))

  let allValuable = []
  let startBatch = 0
  if (progressPath) {
    try {
      const saved = JSON.parse(await fs.readFile(progressPath, 'utf8'))
      if (saved.totalItems === items.length && Array.isArray(saved.valuable)) {
        allValuable = saved.valuable
        startBatch = saved.completedBatches || 0
        console.log(`  断点续跑: 已完成 ${startBatch} 批，已有 ${allValuable.length} 条有价值问题`)
      }
    } catch { /* 无断点 */ }
  }

  const totalBatches = Math.ceil(items.length / BATCH_SIZE)
  for (let i = startBatch * BATCH_SIZE; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE)
    const listText = batch.map(x =>
      `[${x.idx}] 客户:${x.customer} | 交流:${x.session}\n问:${x.question}`
    ).join('\n\n')

    const prompt = `你是金融监管科技（一表通/监管报送）售前专家。下面是从多场银行客户售前交流转录中提取的客户提问（编号从${batch[0].idx}到${batch[batch.length - 1].idx}）。

请筛选「对售前、产品、方案有价值」的问题，排除：
- 纯寒暄、确认听见、重复无信息
- 过于笼统无法行动（如「介绍一下」且无具体点）
- 明显是内部讨论或非业务问题

有价值标准（满足其一即可）：
- 涉及一表通功能、架构、实施、数据、报送、监管对接
- 涉及竞品对比、选型决策、预算周期
- 涉及客户现状、痛点、时间计划、组织分工
- 技术细节（数据库、性能、接口、安全、运维）

仅输出 JSON 数组，每项：{"idx":编号,"value":"high|medium","theme":"一句话主题","reason":"为何有价值"}
不要输出其它文字。

问题列表：
${listText}`

    const batchNo = Math.floor(i / BATCH_SIZE) + 1
    const totalB = Math.ceil(items.length / BATCH_SIZE)
    const batchMsg = `  AI 分析批次 ${batchNo}/${totalB} (${batch.length} 条, model=${model})...`
    console.log(batchMsg)
    process.stdout.write(batchMsg + '\n') // 尽量及时刷到重定向日志
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 8000
      })
      const raw = resp.choices[0]?.message?.content || ''
      const jsonMatch = raw.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        for (const v of parsed) {
          const src = batch.find(b => b.idx === v.idx)
          if (src) {
            allValuable.push({
              ...src,
              value: v.value || 'medium',
              theme: v.theme || '',
              reason: v.reason || '',
              source: 'ai'
            })
          }
        }
      }
      if (progressPath) {
        const completed = Math.floor(i / BATCH_SIZE) + 1
        await fs.writeFile(progressPath, JSON.stringify({
          totalItems: items.length,
          totalBatches: Math.ceil(items.length / BATCH_SIZE),
          completedBatches: completed,
          valuable: allValuable,
          updatedAt: new Date().toISOString()
        }), 'utf8')
        console.log(`  ✓ 批次 ${completed}/${Math.ceil(items.length / BATCH_SIZE)} 完成，累计有价值 ${allValuable.length} 条`)
      }
    } catch (e) {
      console.warn(`  批次失败: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 300))
  }
  return allValuable
}

function buildThemeSummary(valuable) {
  const m = {}
  for (const v of valuable) {
    const k = v.theme || '未分类'
    if (!m[k]) m[k] = { theme: k, count: 0, high: 0, medium: 0 }
    m[k].count++
    if (v.value === 'high') m[k].high++
    else m[k].medium++
  }
  return Object.values(m).sort((a, b) => b.count - a.count)
}

async function exportExcel(outDir, ts, stats, valuable, themeSummary) {
  const wb = XLSX.utils.book_new()

  const statsRows = [
    ['指标', '数值', '说明'],
    ['产品', stats.product, ''],
    ['一表通转录总量', stats.transcriptionTotal, '条'],
    ['含问答交流场次', stats.meetingCountWithQa, '以转录录音为一场'],
    ['问答对总数', stats.qaPairTotal, '条'],
    ['客户提问', stats.customerQuestions, '有角色标注'],
    ['我方提问', stats.ourSideQuestions, ''],
    ['发起方未知', stats.unknownSourceQuestions, ''],
    ['规则预筛客户问', stats.ruleValuableCustomerQuestions, '条'],
    ['AI认定有价值', valuable.length, '条'],
    ['其中高价值', valuable.filter(v => v.value === 'high').length, '条'],
    ['其中中价值', valuable.filter(v => v.value !== 'high').length, '条'],
    ['已回答', stats.answeredCount, ''],
    ['审核通过', stats.approvedCount, '']
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(statsRows), '统计汇总')

  const themeRows = [
    ['主题', '合计', '高价值', '中价值'],
    ...themeSummary.map(t => [t.theme, t.count, t.high, t.medium])
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(themeRows), '主题分类汇总')

  const listRows = valuable.map((v, i) => ({
    序号: i + 1,
    价值等级: v.value === 'high' ? '高' : '中',
    主题: v.theme || '',
    客户: v.customer || extractCustomerFromSession(v.session),
    文件名: v.session || '',
    交流场次: v.session || '',
    问题: v.question || '',
    回答: v.answer || '',
    分类代码: v.category || '',
    性质代码: v.intent || '',
    有价值原因: v.reason || '',
    问题ID: v.id || ''
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(listRows), '有价值问题清单')

  const xlsxPath = path.join(outDir, `一表通有价值问题_${ts}.xlsx`)
  XLSX.writeFile(wb, xlsxPath)
  return xlsxPath
}

async function main() {
  console.log('=== 一表通 concerns 问答对分析 ===\n')

  const { concerns, transcriptionMap, transcriptions } = await fetchYibiatongConcerns()
  const transcriptionIds = [...new Set(concerns.map(c => c.transcription_id).filter(Boolean))]
  const rolesMap = await loadSpeakerRolesMap(transcriptionIds)

  const sessionIds = new Set(
    transcriptions.filter(t => t.session_id).map(t => t.session_id)
  )
  const transcriptionWithConcerns = new Set(concerns.map(c => c.transcription_id))
  const customerNames = new Set(
    transcriptions
      .filter(t => transcriptionWithConcerns.has(t.id) && t.customer_name)
      .map(t => t.customer_name.trim())
  )

  let customerCount = 0
  let ourSideCount = 0
  let unknownSource = 0
  const customerQuestions = []

  for (const c of concerns) {
    const isCust = isCustomerQuestion(c, rolesMap)
    if (isCust === true) {
      customerCount++
      customerQuestions.push(c)
    } else if (isCust === false) {
      ourSideCount++
    } else {
      unknownSource++
    }
  }

  const ruleValuable = ruleFilterValuable(customerQuestions, transcriptionMap)

  const stats = {
    product: PRODUCT,
    transcriptionTotal: transcriptions.length,
    /** 含问答对的交流场次（以转录/录音为一场） */
    meetingCountWithQa: transcriptionWithConcerns.size,
    /** sessions 表关联场次（当前多数未绑定 session_id） */
    sessionCountLinked: sessionIds.size,
    uniqueCustomerCount: customerNames.size,
    qaPairTotal: concerns.length,
    customerQuestions: customerCount,
    ourSideQuestions: ourSideCount,
    unknownSourceQuestions: unknownSource,
    ruleValuableCustomerQuestions: ruleValuable.length,
    answeredCount: concerns.filter(c => c.status === 'answered').length,
    approvedCount: concerns.filter(c => c.review_status === 'approved').length
  }

  console.log('【统计】')
  console.log(JSON.stringify(stats, null, 2))
  console.log('')

  console.log(`【规则预筛】有价值客户问题约 ${ruleValuable.length} 条`)

  console.log('【AI 筛选有价值客户问题】')
  let aiInput = ruleValuable
  if (AI_SAMPLE_FOR_FULL && aiInput.length > 200) {
    console.log(`  抽样 200 条送 AI（设 AI_FULL=1 可跑全量 ${aiInput.length} 条）`)
    aiInput = aiInput.slice(0, 200)
  }
  const outDir = path.join(__dirname, '../data/yibiatong-concerns-analysis')
  await fs.mkdir(outDir, { recursive: true })
  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const progressPath = path.join(outDir, `ai_progress_${ts}.json`)

  const valuable = await analyzeValuableWithAI(aiInput, progressPath)
  const high = valuable.filter(v => v.value === 'high')
  const medium = valuable.filter(v => v.value !== 'high')
  const themeSummary = buildThemeSummary(valuable)

  stats.aiValuableCount = valuable.length
  stats.aiHighValueCount = high.length
  stats.aiMediumValueCount = medium.length

  console.log(`\n有价值问题: ${valuable.length} / ${ruleValuable.length} 条规则预筛客户问`)
  console.log(`  - 高价值: ${high.length}`)
  console.log(`  - 中价值: ${medium.length}`)

  const suffix = AI_SAMPLE_FOR_FULL ? '_sample' : '_full'
  const outFile = path.join(outDir, `analysis_${ts}${suffix}.json`)
  await fs.writeFile(outFile, JSON.stringify({
    generatedAt: new Date().toISOString(),
    fullRun: !AI_SAMPLE_FOR_FULL,
    stats,
    themeSummary,
    aiValuableQuestions: valuable,
    valuableByTheme: groupByTheme(valuable)
  }, null, 2), 'utf8')
  console.log(`\nJSON 已写入: ${outFile}`)

  const xlsxPath = await exportExcel(outDir, ts + (AI_SAMPLE_FOR_FULL ? '_sample' : '_full'), stats, valuable, themeSummary)
  console.log(`Excel 已写入: ${xlsxPath}`)

  console.log('\n【高价值问题 TOP 20 预览】')
  high.slice(0, 20).forEach((v, i) => {
    console.log(`${i + 1}. [${v.customer}] ${v.theme}`)
    console.log(`   Q: ${v.question.slice(0, 120)}${v.question.length > 120 ? '...' : ''}`)
  })

  await prisma.$disconnect()
}

function groupByTheme(list) {
  const m = {}
  for (const item of list) {
    const k = item.theme || '未分类'
    if (!m[k]) m[k] = []
    m[k].push(item)
  }
  return m
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
