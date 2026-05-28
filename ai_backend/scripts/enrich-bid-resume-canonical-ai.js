/**
 * 对 bid_resume_person_canonical.raw_fragment 调用 AI，提炼「专业技能」「工作履历」
 * 写入 ai_professional_skills、ai_work_history，并记录 ai_enriched_at / ai_enrichment_model。
 *
 * 模型来源（优先级）：
 *   1) .env 中 ai_key + ai_url + ai_model 均非空时，直接用 OpenAI 兼容 HTTP 调用（与简历 Python 补缺一致）
 *   2) 否则：ai_model_configs，场景 BID_RESUME_CANONICAL_AI_SCENE（默认 ppt_analysis），或 BID_RESUME_CANONICAL_AI_MODEL_ID
 *   强制走库：设置 BID_RESUME_CANONICAL_USE_DB_MODEL=1
 *
 * 依赖：Prisma 已含新列（migrate deploy 后 prisma:generate）
 *
 * 用法：
 *   node scripts/enrich-bid-resume-canonical-ai.js
 *   node scripts/enrich-bid-resume-canonical-ai.js --dry-run --limit 3
 *   node scripts/enrich-bid-resume-canonical-ai.js --force
 *   node scripts/enrich-bid-resume-canonical-ai.js --sleep-ms 500
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const prisma = require('../server/utils/prisma')
const aiService = require('../server/services/aiServiceUnified')
const { OpenAI } = require('openai')

const SCENE = process.env.BID_RESUME_CANONICAL_AI_SCENE || 'ppt_analysis'
const MODEL_ID = process.env.BID_RESUME_CANONICAL_AI_MODEL_ID || null
const FORCE_DB_MODEL = String(process.env.BID_RESUME_CANONICAL_USE_DB_MODEL || '').trim() === '1'
const RAW_MAX = Math.min(
  parseInt(process.env.BID_RESUME_CANONICAL_RAW_MAX_CHARS || '24000', 10) || 24000,
  120000
)
const OUT_MAX = 65000

/** 与 resume_ai_enrich.py 一致：读 .env 的 ai_key / ai_url / ai_model（兼容大写 env 名） */
function readEnvOpenAiCompat () {
  const apiKey = (process.env.ai_key || process.env.AI_KEY || '').trim()
  let baseURL = (process.env.ai_url || process.env.AI_URL || '').trim()
  const model = (process.env.ai_model || process.env.AI_MODEL || '').trim()
  if (!apiKey || !baseURL || !model) return null
  if (typeof baseURL === 'string' && baseURL.includes('volces.com') && /\/responses\/?(\?|$)/i.test(baseURL)) {
    baseURL = baseURL.replace(/\/responses\/?(?=\?|$)/i, '')
  }
  if (!baseURL.endsWith('/')) baseURL += '/'
  return { apiKey, baseURL, model }
}

/** 与 Python resume_ai_enrich 一致：直接扫 .env 文件（解决 BOM、仅文件有值、加载顺序等问题） */
function parseEnvFileForAi (envPath) {
  try {
    if (!fs.existsSync(envPath)) return null
    const text = fs.readFileSync(envPath, 'utf8')
    const kv = {}
    for (const raw of text.split(/\r?\n/)) {
      const s = raw.trim()
      if (!s || s.startsWith('#')) continue
      const eq = s.indexOf('=')
      if (eq < 0) continue
      const key = s.slice(0, eq).trim().replace(/^\uFEFF/, '').toLowerCase()
      const val = s.slice(eq + 1).trim()
      if (key === 'ai_key' || key === 'ai_url' || key === 'ai_model') kv[key] = val
    }
    const apiKey = (kv.ai_key || '').trim()
    let baseURL = (kv.ai_url || '').trim()
    const model = (kv.ai_model || '').trim()
    if (!apiKey || !baseURL || !model) return null
    if (typeof baseURL === 'string' && baseURL.includes('volces.com') && /\/responses\/?(\?|$)/i.test(baseURL)) {
      baseURL = baseURL.replace(/\/responses\/?(?=\?|$)/i, '')
    }
    if (!baseURL.endsWith('/')) baseURL += '/'
    return { apiKey, baseURL, model }
  } catch {
    return null
  }
}

let _envAiResolved = false
let _envAiCached = null

/** 每次运行只解析一次；优先 process.env，失败再读 .env 文件 */
function getEnvAi () {
  if (_envAiResolved) return _envAiCached
  _envAiResolved = true
  require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true })
  let cfg = readEnvOpenAiCompat()
  if (!cfg) cfg = parseEnvFileForAi(path.join(__dirname, '../.env'))
  _envAiCached = cfg
  return _envAiCached
}

const SYSTEM = `你是投标文件中的「人员简历」信息抽取助手。用户将提供从 Word 简历中截取的一段原文（可能含表格转文本的杂乱格式）。
请只根据这段原文推断，不要编造原文中不存在的信息。
输出必须是合法 JSON 对象，且只包含两个键，不要 markdown 代码围栏，不要解释：
{
  "professional_skills": "字符串：归纳「专业技能、技术栈、资质证书、熟悉工具/平台」等，可用分号或换行分条；若无则空字符串",
  "work_history": "字符串：归纳「工作单位、岗位、时间段、参与项目/职责」等工作履历；若无则空字符串"
}
要求：使用简体中文；简洁有条理；无依据时对应字段用空字符串。`

function extractJsonObject (text) {
  if (!text || typeof text !== 'string') return null
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  try {
    return JSON.parse(s)
  } catch {
    const i = s.indexOf('{')
    const j = s.lastIndexOf('}')
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(s.slice(i, j + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function clip (s, max) {
  if (s == null) return null
  const t = typeof s === 'string' ? s : Array.isArray(s) ? s.filter(Boolean).join('\n') : String(s)
  const u = t.trim()
  if (!u) return null
  return u.length > max ? u.slice(0, max) : u
}

function parseArgs () {
  const dryRun = process.argv.includes('--dry-run')
  const force = process.argv.includes('--force')
  let limit = null
  let sleepMs = parseInt(process.env.BID_RESUME_CANONICAL_AI_SLEEP_MS || '400', 10) || 400
  const li = process.argv.indexOf('--limit')
  if (li >= 0 && process.argv[li + 1]) limit = Math.max(1, parseInt(process.argv[li + 1], 10) || 0) || null
  const si = process.argv.indexOf('--sleep-ms')
  if (si >= 0 && process.argv[si + 1]) sleepMs = Math.max(0, parseInt(process.argv[si + 1], 10) || 0)
  return { dryRun, force, limit, sleepMs }
}

function sleep (ms) {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * @param {{ role: string, content: string }[]} messages
 * @returns {Promise<{ content: string, modelLabel: string }>}
 */
async function callResumeEnrichAi (messages) {
  const envAi = getEnvAi()
  if (!FORCE_DB_MODEL && envAi) {
    const client = new OpenAI({
      apiKey: envAi.apiKey,
      baseURL: envAi.baseURL,
    })
    const res = await client.chat.completions.create({
      model: envAi.model,
      messages,
      temperature: 0.15,
      max_tokens: 8192,
    })
    const content = res.choices[0]?.message?.content || ''
    return { content, modelLabel: envAi.model }
  }

  const content = await aiService.chat(SCENE, '[简历canonical提炼：实际内容在 messages]', {
    modelId: MODEL_ID || undefined,
    messages,
    temperature: 0.15,
    max_tokens: 8192,
  })
  const { config } = await aiService.getClient(SCENE, MODEL_ID || undefined)
  const modelLabel = (config && (config.name || config.model_name)) || 'unknown'
  return { content, modelLabel: String(modelLabel) }
}

function describeModelSource () {
  if (FORCE_DB_MODEL) return `db scene=${SCENE}${MODEL_ID ? ` modelId=${MODEL_ID}` : ''}`
  const envAi = getEnvAi()
  if (envAi) {
    return `.env ai_model=${envAi.model} (${envAi.baseURL.slice(0, 48)}…)`
  }
  return `db scene=${SCENE}${MODEL_ID ? ` modelId=${MODEL_ID}` : ''}`
}

async function main () {
  const { dryRun, force, limit, sleepMs } = parseArgs()
  getEnvAi()

  const where = {
    raw_fragment: { not: null },
    NOT: { raw_fragment: { equals: '' } },
  }
  if (!force) {
    where.AND = [
      {
        OR: [
          { ai_professional_skills: null },
          { ai_professional_skills: '' },
          { ai_work_history: null },
          { ai_work_history: '' },
        ],
      },
    ]
  }

  const rows = await prisma.bid_resume_person_canonical.findMany({
    where,
    select: {
      id: true,
      person_name: true,
      raw_fragment: true,
      merge_key: true,
    },
    orderBy: { merged_at: 'desc' },
    ...(limit ? { take: limit } : {}),
  })

  console.log(`待处理 ${rows.length} 条（模型：${describeModelSource()} dryRun=${dryRun} force=${force}）`)

  if (dryRun) {
    console.log(rows.slice(0, 5).map((r) => ({ id: r.id, name: r.person_name, merge_key: r.merge_key })))
    await prisma.$disconnect()
    return
  }

  let ok = 0
  let err = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const raw = row.raw_fragment || ''
    const body = raw.length > RAW_MAX ? raw.slice(0, RAW_MAX) + '\n\n（原文已截断，仅前 ' + RAW_MAX + ' 字符参与分析）' : raw

    const userMsg =
      `以下为简历原文片段，请抽取 professional_skills 与 work_history：\n\n` + body

    try {
      const { content, modelLabel } = await callResumeEnrichAi([
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userMsg },
      ])

      const obj = extractJsonObject(content)
      if (!obj || typeof obj !== 'object') {
        console.warn(`[${row.id}] JSON 解析失败，跳过`)
        err++
        continue
      }

      const skills = clip(obj.professional_skills ?? obj.专业技能, OUT_MAX)
      const history = clip(obj.work_history ?? obj.工作履历, OUT_MAX)

      await prisma.bid_resume_person_canonical.update({
        where: { id: row.id },
        data: {
          ai_professional_skills: skills,
          ai_work_history: history,
          ai_enriched_at: new Date(),
          ai_enrichment_model: String(modelLabel).slice(0, 120),
        },
      })
      ok++
      if ((i + 1) % 10 === 0 || i === rows.length - 1) {
        console.log(`进度 ${i + 1}/${rows.length} ok=${ok} err=${err}`)
      }
    } catch (e) {
      err++
      console.error(`[${row.id}]`, e.message || e)
    }

    if (sleepMs > 0 && i < rows.length - 1) await sleep(sleepMs)
  }

  console.log(`结束：成功 ${ok}，失败 ${err}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
