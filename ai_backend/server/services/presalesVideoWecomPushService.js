/**
 * 售前视频：企微应用群发会话推送「交流报备摘要 + 售前视频文本卡片」
 * 卡片 URL：优先 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE（{id}、{chatId}、{timestape}/{timestamp}=推送时刻 Unix 毫秒时间戳）；否则「基址+playlist/path」拼接
 */
const crypto = require('crypto')
const wecomAppChatApi = require('./wecomAppChatApi')
const presalesVideoTaskService = require('./presalesVideoTaskService')
const presalesVideoGroupSettingsService = require('./presalesVideoGroupSettingsService')
const logger = require('../utils/logger')

/** 与 push-report 一致：短音频为 duration < 返回值（默认 600s=10 分钟） */
const REPORT_DURATION_SPLIT_DEFAULT_SEC = 10 * 60
const REPORT_DURATION_SPLIT_MAX_SEC = 86400

function getPushVideoReportSplitSec() {
  const raw = process.env.PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC
  if (raw == null || String(raw).trim() === '') {
    return REPORT_DURATION_SPLIT_DEFAULT_SEC
  }
  const n = parseInt(String(raw).trim(), 10)
  if (Number.isNaN(n) || n < 1) {
    return REPORT_DURATION_SPLIT_DEFAULT_SEC
  }
  if (n > REPORT_DURATION_SPLIT_MAX_SEC) {
    return REPORT_DURATION_SPLIT_MAX_SEC
  }
  return n
}

/** 企微 appchat markdown 单条约 4000 字，长文拆多条 */
const APPCHAT_MARKDOWN_CHUNK = 3500

async function sendAppChatMarkdownChunked(chatid, fullMarkdown) {
  const s = String(fullMarkdown || '')
  if (!String(s).trim()) return
  for (let i = 0; i < s.length; i += APPCHAT_MARKDOWN_CHUNK) {
    await wecomAppChatApi.sendAppChatMarkdown(chatid, s.slice(i, i + APPCHAT_MARKDOWN_CHUNK))
  }
}

function escapeMdLine(s) {
  return String(s || '')
    .replace(/\r?\n/g, ' ')
    .replace(/</g, '＜')
    .replace(/>/g, '＞')
    .trim()
}

function parseUserIds(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))]
  }
  return [
    ...new Set(
      String(raw)
        .split(/[,，、;；\s]+/)
        .map((x) => x.trim())
        .filter(Boolean)
    )
  ]
}

function getExcludeUserIdsFromEnv() {
  const raw = process.env.PRESALES_VIDEO_GROUP_EXCLUDE_USERIDS
  if (raw == null || String(raw).trim() === '') return []
  return parseUserIds(String(raw))
}

function applyExcludedUsers(userIds) {
  const excludes = new Set(getExcludeUserIdsFromEnv())
  if (excludes.size === 0) return userIds
  return (userIds || []).filter((u) => !excludes.has(String(u || '').trim()))
}

function diffExcludedUsers(before, after) {
  const keep = new Set((after || []).map((x) => String(x || '').trim()).filter(Boolean))
  return (before || []).filter((x) => {
    const id = String(x || '').trim()
    return id && !keep.has(id)
  })
}

function trimToLength(s, max = 40) {
  const arr = Array.from(String(s || '').trim())
  return arr.length <= max ? arr.join('') : `${arr.slice(0, max - 1).join('')}…`
}

function stripFileSuffix(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  return s.replace(/\.[^./\\]{1,10}$/g, '').trim()
}

async function collectLeaderChainUserIds(prisma, startUserId) {
  const start = String(startUserId || '').trim()
  if (!start) return []
  const ids = []
  const visited = new Set()
  let cursor = start
  for (let i = 0; i < 20; i++) {
    if (!cursor || visited.has(cursor)) break
    visited.add(cursor)
    const row = await prisma.org_user.findUnique({
      where: { user_id: cursor },
      select: {
        user_id: true,
        leader_id: true,
        org_id: true,
        is_deleted: true
      }
    })
    if (!row || row.is_deleted) break
    ids.push({
      userId: String(row.user_id || '').trim(),
      leaderId: row.leader_id ? String(row.leader_id).trim() : '',
      orgId: row.org_id ? String(row.org_id).trim() : ''
    })
    cursor = row.leader_id ? String(row.leader_id).trim() : ''
  }
  if (ids.length === 0) return []
  const orgIds = [...new Set(ids.map((x) => x.orgId).filter(Boolean))]
  let activeOrg = new Set()
  if (orgIds.length > 0) {
    const deps = await prisma.departments.findMany({
      where: { id: { in: orgIds }, status: 'active' },
      select: { id: true }
    })
    activeOrg = new Set(deps.map((d) => String(d.id)))
  }
  return ids
    .filter((x) => !x.orgId || activeOrg.has(x.orgId))
    .map((x) => x.userId)
    .filter(Boolean)
}

async function buildAutoUserIds(prisma, transcription, fixedMembers) {
  const fromUser = transcription && transcription.created_by ? String(transcription.created_by).trim() : ''
  const chain = await collectLeaderChainUserIds(prisma, fromUser)
  const fixed = presalesVideoGroupSettingsService.normalizeUserIds(fixedMembers)
  let reportParticipants = []
  try {
    const report = await resolveCommunicationReportForTranscription(prisma, transcription)
    if (report && report.our_participants) {
      const names = splitParticipantNames(report.our_participants)
      reportParticipants = await resolveParticipantNamesToUserIds(prisma, names)
    }
  } catch (e) {
    logger.warn(`[presales-video] 报备 our_participants 转 userid 失败: ${e && e.message}`)
  }
  return [...new Set([...chain, ...fixed, ...reportParticipants, 'rxkf01'].filter(Boolean))]
}

async function resolvePushVideoUserIds(ctx) {
  const { prisma, transcriptionId, userIdsRaw } = ctx
  const tr = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!tr) throw new Error('转录不存在')

  const settings = await presalesVideoGroupSettingsService.readSettings()
  const fixedMembers = settings.fixedMembers || []
  const fromInput = parseUserIds(userIdsRaw)

  let beforeExclude = []
  let source = 'auto'
  if (fromInput.length > 0) {
    source = 'manual'
    // 手动名单为准：仅采用文本框内的 userid，不再并入固定成员 / rxkf01（固定成员也可删掉）
    beforeExclude = [...new Set(fromInput.filter(Boolean))]
  } else {
    beforeExclude = await buildAutoUserIds(prisma, tr, fixedMembers)
  }

  let userIds = applyExcludedUsers(beforeExclude)
  // 自动规则仍保证 rxkf01；手动模式完全尊重用户输入（若未包含 rxkf01 则不加）
  if (source !== 'manual' && !userIds.includes('rxkf01')) userIds.push('rxkf01')
  userIds = [...new Set(userIds.filter(Boolean))]

  return {
    transcription: tr,
    userIds,
    source,
    excludedUserIds: diffExcludedUsers(beforeExclude, userIds),
    fixedMembers: presalesVideoGroupSettingsService.normalizeUserIds(fixedMembers)
  }
}

/**
 * 从转录提取可用于匹配报备的关键词（客户名、产品名、文件名按分隔符拆开等）
 */
function collectReportMatchNeedles(tr) {
  const set = new Set()
  const push = (s) => {
    const t = String(s || '').trim()
    if (t.length >= 2 && t.length <= 80) set.add(t)
  }
  push(tr.customer_name)
  const pn = tr.product_name && String(tr.product_name).trim()
  if (pn && pn !== '一表通') push(pn)

  const blobs = [tr.name, tr.original_file_name]
  for (const blob of blobs) {
    const b = String(blob || '').replace(/\.[a-zA-Z0-9]{2,5}$/g, '')
    for (const part of b.split(/[-_/，,、\s]+/)) {
      const p = part.trim()
      if (p.length < 2 || p.length > 40) continue
      if (/^\d{1,6}$/.test(p)) continue
      if (/^20\d{2}年?$/.test(p)) continue
      push(p)
    }
  }
  return [...set].slice(0, 24)
}

function transcriptionHaystack(tr) {
  return [tr.customer_name, tr.name, tr.original_file_name, tr.product_name]
    .map((x) => String(x || '').toLowerCase())
    .join('\n')
}

/**
 * 匹配交流报备：
 * 1）关键词 ∈ 报备的客户名/线索名（双向子串的一种：报备字段包含关键词）
 * 2）若仍无：报备的客户名/线索名（足够长）出现在转录标题/文件名里（解决「转录未填客户名但文件名含银行名」）
 */
async function findLatestMatchingReport(prisma, tr) {
  const needles = collectReportMatchNeedles(tr)
  const orConds = []
  for (const n of needles) {
    orConds.push({ customer_name: { contains: n } })
    orConds.push({ lead_name: { contains: n } })
  }
  if (orConds.length > 0) {
    const hit = await prisma.communication_reports.findFirst({
      where: { OR: orConds },
      orderBy: { created_at: 'desc' }
    })
    if (hit) return hit
  }

  const hay = transcriptionHaystack(tr)
  if (!hay.trim()) return null

  const recent = await prisma.communication_reports.findMany({
    orderBy: { created_at: 'desc' },
    take: 60
  })
  for (const r of recent) {
    const cn = (r.customer_name && String(r.customer_name).trim()) || ''
    const ln = (r.lead_name && String(r.lead_name).trim()) || ''
    if (cn.length >= 2 && hay.includes(cn.toLowerCase())) return r
    if (ln.length >= 2 && hay.includes(ln.toLowerCase())) return r
  }
  return null
}

function normalizeReportId(value) {
  const id = String(value || '').trim()
  return id || ''
}

async function findReportByKnownIds(prisma, tr) {
  const reportId = normalizeReportId(tr && tr.report_id)
  if (reportId) {
    const report = await prisma.communication_reports.findUnique({ where: { id: reportId } })
    if (report) return report
  }
  const sid = normalizeReportId(tr && tr.session_id)
  if (sid) {
    const report = await prisma.communication_reports.findUnique({ where: { id: sid } })
    if (report) return report
  }
  return null
}

async function findReportBySyncLog(prisma, transcriptionId) {
  const tid = String(transcriptionId || '').trim()
  if (!tid) return null
  const rows = await prisma.log_sync_status.findMany({
    where: { sync_type: 'crm_video_batch' },
    orderBy: { id: 'desc' },
    take: 300,
    select: { sync_params: true }
  })
  for (const row of rows) {
    const params = row && row.sync_params && typeof row.sync_params === 'object' ? row.sync_params : null
    if (!params) continue
    const pTid = String(params.transcription_id || '').trim()
    if (!pTid || pTid !== tid) continue
    const reportId = normalizeReportId(params.report_id)
    if (!reportId) return null
    const report = await prisma.communication_reports.findUnique({ where: { id: reportId } })
    if (report) return report
    return null
  }
  return null
}

/**
 * 与推送视频、报备摘要一致：优先转录 report_id / session_id，再 CRM 跑批 sync 日志，再关键词匹配最近报备
 */
async function resolveCommunicationReportForTranscription(prisma, tr) {
  let report = await findReportByKnownIds(prisma, tr)
  if (!report) report = await findReportBySyncLog(prisma, tr.id)
  if (!report) report = await findLatestMatchingReport(prisma, tr)
  return report
}

/**
 * communication_reports.our_participants 中的中文姓名 → org_user.user_id（按 user_name 精确匹配、未删除）
 */
async function resolveParticipantNamesToUserIds(prisma, names) {
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))]
  if (unique.length === 0) return []
  const rows = await prisma.org_user.findMany({
    where: {
      user_name: { in: unique },
      is_deleted: false
    },
    select: { user_id: true, user_name: true }
  })
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const uid = row.user_id && String(row.user_id).trim()
    if (!uid || seen.has(uid)) continue
    seen.add(uid)
    out.push(uid)
  }
  return out
}

function splitParticipantNames(raw) {
  return String(raw || '')
    .split(/[，,、;；\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function formatDateOnlyZh(raw) {
  const s = String(raw || '').trim()
  if (!s) return '暂无'
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function inferDayPeriod(report) {
  const pick = report && (report.start_at || report.report_date)
  if (!pick) return ''
  const t = Date.parse(String(pick))
  if (Number.isNaN(t)) return ''
  const h = new Date(t).getHours()
  if (h < 6) return '凌晨'
  if (h < 12) return '上午'
  if (h < 14) return '中午'
  if (h < 19) return '下午'
  return '晚上'
}

async function calcLeadReportNth(prisma, report) {
  if (!report) return null
  const reportDate = report.report_date ? new Date(report.report_date) : null
  const createdAt = report.created_at ? new Date(report.created_at) : null

  const keyWhere = report.lead_id
    ? { lead_id: String(report.lead_id).trim() }
    : report.lead_code
      ? { lead_code: String(report.lead_code).trim() }
      : report.lead_name
        ? { lead_name: String(report.lead_name).trim() }
        : report.customer_name
          ? { customer_name: String(report.customer_name).trim() }
          : null
  if (!keyWhere) return null

  const timeWhere =
    reportDate && !Number.isNaN(reportDate.getTime())
      ? { report_date: { lte: reportDate } }
      : createdAt && !Number.isNaN(createdAt.getTime())
        ? { created_at: { lte: createdAt } }
        : {}

  const n = await prisma.communication_reports.count({
    where: {
      ...keyWhere,
      ...timeWhere
    }
  })
  return Number.isFinite(n) && n > 0 ? n : null
}

function formatReportMarkdown(report, nth) {
  if (!report) {
    return (
      '**交流报备**\n' +
      '> 未匹配到报备记录。\n' +
      '> 常见原因：① 转录「客户名称」为空，且文件名/标题与报备里的客户或线索名称无重合；② 库中尚无对应交流报备。\n' +
      '> 处理：在语音转写里补全该转录的客户名称，或保证企微报备中的客户/线索名与文件名中的客户关键词一致；也可先在企微发送标准「交流报备」模板入库后再推送。'
    )
  }
  const rawContent = String(report.main_content || '').trim()
  const nthText = Number.isFinite(nth) && nth > 0 ? nth : 'N'
  const reportBody = rawContent || '（该报备无 main_content 原文）'
  const lines = [
    `此为该线索的第${nthText}次交流报备`,
    '现将与客户交流的报告发至群内，请大家查阅关注',
    '',
    reportBody,
    '',
    '注：交流报备次数统计自市场序列群'
  ]
  return lines.join('\n')
}

function safeObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null
}

function pickFirstValue(obj, keys) {
  if (!obj) return ''
  for (const k of keys) {
    const v = obj[k]
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

function pickFirstValueFromObjects(objs, keys) {
  for (const obj of objs || []) {
    const v = pickFirstValue(obj, keys)
    if (v) return v
  }
  return ''
}

function pickAnyMeaningfulField(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return ''
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const key = String(k || '').toLowerCase()
    if (key.includes('id') || key.includes('time') || key.includes('date')) continue
    const text = String(v).trim()
    if (text) return text
  }
  return ''
}

function extractInfo221FromFollowUpLogList(clue) {
  const root = clue && typeof clue === 'object' ? clue : null
  if (!root) return ''
  const followUpLogList = Array.isArray(root.followUpLogList)
    ? root.followUpLogList
    : Array.isArray(root.follow_up_log_list)
      ? root.follow_up_log_list
      : Array.isArray(root.FOLLOWUPLOGLIST)
        ? root.FOLLOWUPLOGLIST
        : []
  if (followUpLogList.length === 0) return ''
  // 通常最后一条是最新跟进，优先展示最新一条内容
  const latest = followUpLogList[followUpLogList.length - 1]
  if (latest == null) return ''
  if (typeof latest === 'string' || typeof latest === 'number') {
    return String(latest).trim()
  }
  const hit = pickFirstValue(latest, [
    'FOLLOWUPCONTENT',
    'followUpContent',
    'follow_up_content',
    'CONTENT',
    'content',
    'REMARK',
    'remark',
    'NOTE',
    'note',
    'DESCRIPTION',
    'description',
    'SUMMARY',
    'summary'
  ])
  if (hit) return hit
  return pickAnyMeaningfulField(latest)
}

function formatDateZh(raw) {
  const s = String(raw || '').trim()
  if (!s) return '暂无'
  const t = Date.parse(s)
  if (Number.isNaN(t)) return s
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function resolveClueInfoApiConfig() {
  const url = String(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_URL || '').trim()
  const apiKey = String(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY || '').trim()
  const timeoutMsRaw = Number(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_TIMEOUT_MS || 5000)
  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw >= 1000 && timeoutMsRaw <= 30000
      ? timeoutMsRaw
      : 5000
  return { url, apiKey, timeoutMs }
}

function resolveClueChatGroupSaveApiConfig() {
  // URL 独立配置；key/timeout 复用线索完整信息接口配置
  const url = String(process.env.PRESALES_VIDEO_CLUE_CHAT_GROUP_SAVE_URL || '').trim()
  const apiKey = String(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY || '').trim()
  const timeoutMsRaw = Number(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_TIMEOUT_MS || 5000)
  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw >= 1000 && timeoutMsRaw <= 30000
      ? timeoutMsRaw
      : 5000
  return { url, apiKey, timeoutMs }
}

async function saveClueChatGroupToThirdParty({ chatId, xsbh, chatName }) {
  const cfg = resolveClueChatGroupSaveApiConfig()
  if (!cfg.url || !cfg.apiKey) {
    logger.info('[presales-video] saveClueChatGroup 跳过：未配置 URL 或 API Key')
    return { skipped: true }
  }
  const payload = {
    chatId: String(chatId || '').trim(),
    xsbh: String(xsbh || '').trim(),
    chatName: String(chatName || '').trim()
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiKey
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    const bodyText = await res.text()
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${bodyText.slice(0, 300)}`)
    }
    logger.info(
      `[presales-video] saveClueChatGroup 成功 chatId=${payload.chatId} xsbh=${payload.xsbh} chatName=${payload.chatName} body=${bodyText.slice(0, 300)}`
    )
    return { skipped: false, ok: true }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchClueFullInfo(xsbh) {
  const cfg = resolveClueInfoApiConfig()
  if (!cfg.url || !cfg.apiKey) return null
  const u = new URL(cfg.url)
  u.searchParams.set('xsbh', String(xsbh || '').trim())
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  try {
    const res = await fetch(u.toString(), {
      method: 'GET',
      headers: { 'X-API-Key': cfg.apiKey },
      signal: controller.signal
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    const json = await res.json()
    const root = safeObj(json)
    const lvl1 =
      safeObj(root && root.data) ||
      safeObj(root && root.result) ||
      safeObj(root && root.payload) ||
      root ||
      null
    const lvl2 = safeObj(lvl1 && lvl1.data) || safeObj(lvl1 && lvl1.result) || lvl1
    return safeObj(lvl2) || null
  } finally {
    clearTimeout(timer)
  }
}

async function buildClueSummaryMarkdown(report) {
  const summary = report && typeof report === 'object' && report.__clueSummary ? report.__clueSummary : null
  if (!summary) return ''

  return [
    `此群为线索【${escapeMdLine(summary.leadName)}】售前交流分析群`,
    `线索立项时间：${escapeMdLine(formatDateZh(summary.setupTimeRaw))}`,
    `线索类型：【${escapeMdLine(summary.clueType)}】`,
    `当前线索已到【${escapeMdLine(summary.stage)}】阶段`,
    `221信息：${escapeMdLine(summary.info221)}`,
    `线索编号：${escapeMdLine(summary.xsbhFinal)}`
  ].join('\n')
}

async function resolveClueSummary(report) {
  if (!report) return null
  const xsbh = String(report.lead_code || report.lead_id || '').trim()
  if (!xsbh) return null

  let clue = null
  try {
    clue = await fetchClueFullInfo(xsbh)
  } catch (e) {
    logger.warn(`[presales-video] 获取线索完整信息失败 xsbh=${xsbh}: ${e && e.message}`)
  }

  const baseInfo = safeObj(clue && clue.baseInfo) || safeObj(clue && clue.base_info) || null
  const candidates = [baseInfo, clue].filter(Boolean)
  const leadName =
    pickFirstValueFromObjects(candidates, ['XSMC', 'leadName', 'lead_name', 'clueName', 'xsmc']) ||
    String(report.lead_name || report.customer_name || '').trim() ||
    '未知线索'
  const setupTimeRaw = pickFirstValueFromObjects(candidates, [
    'LXSJ',
    'projectCreateTime',
    'project_create_time',
    'leadCreateTime',
    'lead_create_time',
    'createTime',
    'create_time',
    'lxsj'
  ])
  const clueType =
    pickFirstValueFromObjects(candidates, [
      'XSFL',
      'leadType',
      'lead_type',
      'leadTypeName',
      'lead_type_name',
      'clueType',
      'xslx'
    ]) || '暂无'
  const stage =
    pickFirstValueFromObjects(candidates, [
      'MQJDNAME',
      'stageName',
      'stage_name',
      'currentStage',
      'current_stage',
      'phaseName',
      'jdmc'
    ]) || '暂无'
  const info221FromLogs = extractInfo221FromFollowUpLogList(clue)
  const info221 =
    info221FromLogs ||
    pickFirstValueFromObjects(candidates, ['INFO221', 'info221', 'info_221', 'x221', 'i221']) ||
    '暂无'
  const xsbhFinal =
    pickFirstValueFromObjects(candidates, ['XSBH', 'xsbh', 'leadCode', 'lead_code', 'clueNum']) || xsbh
  return { leadName, setupTimeRaw, clueType, stage, info221, xsbhFinal, clueRaw: clue }
}

function formatReportMarkdownForExistingChat(report, nth, clueSummary) {
  if (!report) return formatReportMarkdown(report, nth)
  const nthText = Number.isFinite(nth) && nth > 0 ? nth : 'N'
  const leadName = String(report.lead_name || report.customer_name || '未知').trim()
  const communicationForm = String(report.communication_form || '暂无').trim()
  const dateZh = formatDateOnlyZh(report.report_date)
  const period = inferDayPeriod(report)
  const datePart = period ? `${dateZh},${period}` : dateZh
  const clientNames = splitParticipantNames(report.client_participants)
  const clientCount = clientNames.length > 0 ? `${clientNames.length}人` : '暂无'
  const clientDetail = clientNames.length > 0 ? clientNames.join('、') : '暂无'
  const ourNames = splitParticipantNames(report.our_participants)
  const ourDetail = ourNames.length > 0 ? ourNames.join('，') : '暂无'
  const stage = clueSummary && clueSummary.stage ? clueSummary.stage : '暂无'
  const info221 = clueSummary && clueSummary.info221 ? clueSummary.info221 : '暂无'
  const xsbh = clueSummary && clueSummary.xsbhFinal ? clueSummary.xsbhFinal : String(report.lead_code || report.lead_id || '').trim() || '暂无'
  return [
    `当前线索已到【${escapeMdLine(stage)}】阶段`,
    `221信息：${escapeMdLine(info221)}`,
    `此为该线索的第${nthText}次交流报备`,
    '现将与客户交流的报告发至群内，请大家查阅关注',
    '',
    '【交流报备】',
    `1、客户及线索名称：${escapeMdLine(leadName)}`,
    `2、交流与沟通形式与发生时间：${escapeMdLine(communicationForm)},${escapeMdLine(datePart)}`,
    `3、客户方人员数量及主要人员：${escapeMdLine(clientCount)},${escapeMdLine(clientDetail)}`,
    `4、我方人员姓名：${escapeMdLine(ourDetail)}`,
    `5、线索编号：${escapeMdLine(xsbh)}`
  ].join('\n')
}

function formatVideoMarkdown(transcription, videoTask) {
  const name = escapeMdLine(transcription.original_file_name || transcription.name || '转录')
  const v = videoTask && videoTask.video_address && String(videoTask.video_address).trim()
  if (!v) {
    return `**售前视频**\n转录：${name}\n> 当前无 \`video_address\`（请确认工作流 video 回调已写入库）。`
  }
  if (/^https?:\/\//i.test(v)) {
    return `**售前视频**\n转录：${name}\n视频链接：[点击打开](${v})`
  }
  return `**售前视频**\n转录：${name}\n服务器路径：\`${escapeMdLine(v)}\``
}

/** 卡片跳转用原始串：优先 http(s) 的 reserve_5（如 m3u8），否则 video_address */
function pickRawVideoLinkForWecomCard(videoTask) {
  if (!videoTask) return ''
  const r5 = videoTask.reserve_5 != null ? String(videoTask.reserve_5).trim() : ''
  const va = videoTask.video_address != null ? String(videoTask.video_address).trim() : ''
  if (r5 && /^https?:\/\//i.test(r5)) return r5
  if (va) return va
  return r5 || va
}

function isWindowsStyleFilePath(s) {
  return /^[a-zA-Z]:[\\/]/.test(String(s || '').trim())
}

/**
 * 从 presales_video_tasks.reserve_4 解析企微 appchat 的 chatid。
 * 落库格式：wecom_appchat:{chatid}@{ISO8601}，只返回中间 chatid；无前缀则按第一个 @ 截断取前段。
 */
function extractWecomAppChatIdFromReserve4(reserve4) {
  const s = String(reserve4 || '').trim()
  if (!s) return ''
  const prefix = 'wecom_appchat:'
  if (s.startsWith(prefix)) {
    const rest = s.slice(prefix.length)
    const at = rest.indexOf('@')
    if (at <= 0) return rest.trim()
    return rest.slice(0, at).trim()
  }
  const at = s.indexOf('@')
  return (at === -1 ? s : s.slice(0, at)).trim()
}

/** 「发送给小R」专用：伪 chatId，前缀 old + 8 位随机数字，供卡片模板 {chatId} 与 reserve_4 解析 */
function generateRxkfPseudoAppChatId() {
  const n = crypto.randomInt(0, 100_000_000)
  return `old${String(n).padStart(8, '0')}`
}

/**
 * 卡片 H5 地址模板：{id} = psv_video_info.id（与 presales_video_tasks.execute_id 一致）；{chatId}；{timestape} 或 {timestamp} = 推送时刻 Unix 毫秒（如 1776061188343，非库读）
 * 优先 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE；否则若 PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL 含 {id} 也视为模板（兼容旧键名）
 */
function resolveWecomCardUrlTemplate() {
  const a = process.env.PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE
  if (a != null && String(a).trim() !== '') return String(a).trim()
  const b = process.env.PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL
  if (b != null && String(b).trim() !== '' && String(b).includes('{id}')) return String(b).trim()
  return null
}

/** 路径拼接模式下的对外基址（不含 {id} 占位符时） */
function wecomCardPublicOriginOverride() {
  const w = process.env.PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL
  if (w != null && String(w).trim() !== '' && !String(w).includes('{id}')) return String(w).trim()
  return undefined
}

/**
 * @param {string} tpl
 * @param {string} executeId
 * @param {{ chatId?: string, reserve4?: string|null, pushAt?: Date }} [opts]
 * {chatId} 替换顺序：优先从 reserve4 解析（与 presales_video_tasks.reserve_4 落库格式一致）；否则 opts.chatId；再否则 PRESALES_VIDEO_WECOM_CARD_CHAT_ID。
 * {timestape} / {timestamp}：opts.pushAt 或当前时间的 getTime() 毫秒字符串（如 state=1776061188343），不经库表。
 */
function fillWecomCardUrlTemplate(tpl, executeId, opts = {}) {
  let chatId = ''
  if (opts.reserve4 != null && String(opts.reserve4).trim()) {
    chatId = extractWecomAppChatIdFromReserve4(opts.reserve4)
  }
  if (!chatId && opts.chatId != null) {
    chatId = String(opts.chatId).trim()
  }
  if (!chatId && process.env.PRESALES_VIDEO_WECOM_CARD_CHAT_ID != null) {
    chatId = String(process.env.PRESALES_VIDEO_WECOM_CARD_CHAT_ID).trim()
  }
  const pushAt =
    opts.pushAt instanceof Date && !Number.isNaN(opts.pushAt.getTime()) ? opts.pushAt : new Date()
  const stateMs = String(pushAt.getTime())
  return String(tpl)
    .split('{id}')
    .join(encodeURIComponent(executeId))
    .split('{chatId}')
    .join(encodeURIComponent(chatId))
    .split('{timestape}')
    .join(stateMs)
    .split('{timestamp}')
    .join(stateMs)
}

function defaultCardDescription() {
  const fromEnv = process.env.PRESALES_VIDEO_WECOM_CARD_DESCRIPTION
  if (fromEnv != null && String(fromEnv).trim() !== '') {
    return String(fromEnv).trim()
  }
  return '<div class="gray">售前视频</div><div class="normal">点击下方按钮在浏览器中打开播放页</div>'
}

function defaultCardBtntxt() {
  const b = process.env.PRESALES_VIDEO_WECOM_CARD_BTNTXT
  if (b != null && String(b).trim() !== '') return String(b).trim().slice(0, 4)
  return '播放'
}

/**
 * 与即将发往群内的两段 Markdown 一致（不含视频文本卡片，卡片仍由服务端生成）。
 * @returns {Promise<{ willReuseChat: boolean, reportMatched: boolean, clueMarkdown: string, reportMarkdown: string, sendsClueBlockFirst: boolean }>}
 */
async function getPresalesVideoPushMarkdownPreview({ prisma, transcriptionId }) {
  const tr = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!tr) throw new Error('转录不存在')

  let report = await findReportByKnownIds(prisma, tr)
  if (!report) report = await findReportBySyncLog(prisma, transcriptionId)
  if (!report) report = await findLatestMatchingReport(prisma, tr)

  const leadKey = presalesVideoGroupSettingsService.makeLeadKey(report)
  const mappedChat = leadKey
    ? await presalesVideoGroupSettingsService.getLeadChatByKey(leadKey)
    : null
  const chatid = mappedChat && mappedChat.chatid ? String(mappedChat.chatid).trim() : ''
  const willReuseChat = Boolean(chatid)

  const nth = await calcLeadReportNth(prisma, report)
  const clueSummary = await resolveClueSummary(report)
  const reportWithSummary =
    report && clueSummary ? { ...report, __clueSummary: clueSummary } : report
  const clueMarkdown = (await buildClueSummaryMarkdown(reportWithSummary)) || ''
  const reportMarkdown = willReuseChat
    ? formatReportMarkdownForExistingChat(report, nth, clueSummary)
    : formatReportMarkdown(report, nth)

  return {
    willReuseChat,
    reportMatched: Boolean(report),
    clueMarkdown,
    reportMarkdown,
    sendsClueBlockFirst: !willReuseChat && Boolean(clueMarkdown.trim())
  }
}

/**
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {string} ctx.transcriptionId
 * @param {string|string[]} ctx.userIdsRaw 逗号分隔或数组
 * @param {string} [ctx.cardTitle] 可选，企微 textcard 的 title；不传则用转录音频文件名（去后缀）或「售前视频」
 * @param {string} [ctx.chatName] 可选，新建应用群发会话的名称；不传则「线索/客户名或文件名」截断 + 「-售前分析」
 * @param {string} [ctx.clueMarkdown] 若调用方传入该键，则以传入文本作为首段线索 Markdown（新建群时先发）；空字符串表示跳过首段
 * @param {string} [ctx.reportMarkdown] 若调用方传入该键，则以传入文本作为报备摘要 Markdown（必发第二条）
 * @param {string} [ctx.reportAnalysisMarkdown] 可选；音频时长 < splitSec（默认 10 分钟）时作为「推送报告」正文单独发群（可多条）；若未传且为短音频则服务端尝试 readAnalysisForPushEdit
 * @returns {Promise<{ chatid: string, reportMatched: boolean, userCount: number, videoPushedAsMedia?: boolean, videoPushedAsCard?: boolean }>}
 */
async function pushPresalesVideoToWecomAppChat(ctx) {
  const {
    prisma,
    transcriptionId,
    userIdsRaw,
    cardTitle: cardTitleRaw,
    chatName: chatNameRaw
  } = ctx
  const cardTitleOverride =
    cardTitleRaw != null && String(cardTitleRaw).trim() !== ''
      ? String(cardTitleRaw).trim()
      : null
  if (!wecomAppChatApi.isAppChatConfigured()) {
    throw new Error(
      '未配置企业微信应用群发会话：请在环境变量中设置 WECOM_CORP_ID、WECOM_APPCHAT_SECRET（自建应用 Secret，非智能机器人 Secret）'
    )
  }

  const resolvedUsers = await resolvePushVideoUserIds({ prisma, transcriptionId, userIdsRaw })
  const tr = resolvedUsers.transcription
  const userIds = resolvedUsers.userIds
  if (userIds.length < 2) {
    throw new Error('自动建群成员不足：至少需要2个成员（已强制包含 rxkf01）')
  }

  let videoTask = null
  try {
    videoTask = await prisma.presales_video_tasks.findUnique({
      where: { transcription_id: transcriptionId }
    })
  } catch {
    /* optional table */
  }

  let report = await findReportByKnownIds(prisma, tr)
  if (!report) {
    report = await findReportBySyncLog(prisma, transcriptionId)
  }
  if (!report) {
    report = await findLatestMatchingReport(prisma, tr)
  }

  const leadKey = presalesVideoGroupSettingsService.makeLeadKey(report)
  const mappedChat = leadKey
    ? await presalesVideoGroupSettingsService.getLeadChatByKey(leadKey)
    : null
  const preferredLeadName =
    (report && report.lead_name && String(report.lead_name).trim()) ||
    (report && report.customer_name && String(report.customer_name).trim()) ||
    escapeMdLine(tr.original_file_name || tr.name || transcriptionId)
  const defaultChatName = `${trimToLength(preferredLeadName, 36)}-售前分析`
  const chatNameOverride =
    chatNameRaw != null && String(chatNameRaw).trim() !== ''
      ? String(chatNameRaw).trim()
      : null
  const chatName = chatNameOverride || defaultChatName
  const ownerUserId = 'rxkf01'
  let chatid = mappedChat && mappedChat.chatid ? String(mappedChat.chatid).trim() : ''
  let reusedExistingChat = false
  if (!chatid) {
    const created = await wecomAppChatApi.createAppChat({
      name: chatName,
      ownerUserId,
      userIds
    })
    chatid = created.chatid
    if (leadKey) {
      await presalesVideoGroupSettingsService.setLeadChatByKey(leadKey, {
        chatid,
        name: chatName
      })
    }
    const xsbh = String((report && report.lead_code) || (report && report.lead_id) || '').trim()
    if (xsbh) {
      try {
        await saveClueChatGroupToThirdParty({
          chatId: chatid,
          xsbh,
          chatName
        })
      } catch (e) {
        logger.warn(
          `[presales-video] saveClueChatGroup 失败 chatId=${chatid} xsbh=${xsbh} chatName=${chatName} err=${e && e.message}`
        )
      }
    } else {
      logger.info(`[presales-video] saveClueChatGroup 跳过：未找到 xsbh（lead_code/lead_id） chatId=${chatid}`)
    }
  } else {
    reusedExistingChat = true
    /** 复用线索已有群时，必须把本次推送名单同步进会话，否则新 userid 收不到群内消息 */
    try {
      const sync = await wecomAppChatApi.updateAppChatAddMembers(chatid, userIds)
      const skip = sync.skipped60111 || []
      logger.info(
        `[presales-video] 复用群成员已同步 chatid=${chatid} 列表=${userIds.length}人 企微确认追加=${sync.addedCount} 跳过60111=${skip.length}` +
          (skip.length ? ` (${skip.join(',')})` : '')
      )
    } catch (e) {
      logger.error(
        `[presales-video] 复用群追加成员失败 chatid=${chatid}:`,
        e && e.message
      )
      throw e
    }
  }

  const pushMoment = new Date()
  const reserve4Stamp = `wecom_appchat:${chatid}@${pushMoment.toISOString()}`.slice(0, 500)
  try {
    await prisma.presales_video_tasks.updateMany({
      where: { transcription_id: transcriptionId },
      data: { reserve_4: reserve4Stamp }
    })
  } catch (e) {
    logger.warn('[presales-video] 推送前回写 reserve_4 失败:', e && e.message)
  }

  const nth = await calcLeadReportNth(prisma, report)
  const clueSummary = await resolveClueSummary(report)
  const reportWithSummary =
    report && clueSummary ? { ...report, __clueSummary: clueSummary } : report
  let clueMd = await buildClueSummaryMarkdown(reportWithSummary)
  let md1 = reusedExistingChat
    ? formatReportMarkdownForExistingChat(report, nth, clueSummary)
    : formatReportMarkdown(report, nth)

  if (Object.prototype.hasOwnProperty.call(ctx, 'clueMarkdown')) {
    clueMd = ctx.clueMarkdown == null ? '' : String(ctx.clueMarkdown)
  }
  if (Object.prototype.hasOwnProperty.call(ctx, 'reportMarkdown')) {
    md1 = ctx.reportMarkdown == null ? '' : String(ctx.reportMarkdown)
  }

  if (!reusedExistingChat && clueMd && String(clueMd).trim()) {
    await wecomAppChatApi.sendAppChatMarkdown(chatid, clueMd)
  }
  await wecomAppChatApi.sendAppChatMarkdown(chatid, md1)

  const splitSec = getPushVideoReportSplitSec()
  const durSec = tr.audio_duration != null ? Number(tr.audio_duration) : NaN
  const durationOk = !Number.isNaN(durSec) && durSec >= 0
  const isShortAudio = durationOk && durSec < splitSec

  let analysisExtra = ''
  const hasExplicitAnalysis = Object.prototype.hasOwnProperty.call(ctx, 'reportAnalysisMarkdown')
  if (hasExplicitAnalysis) {
    const v = ctx.reportAnalysisMarkdown
    analysisExtra = v == null ? '' : String(v).trim()
  } else if (isShortAudio) {
    const ar = await presalesVideoTaskService.readAnalysisForPushEdit(transcriptionId)
    if (ar.ok && ar.content) analysisExtra = String(ar.content).trim()
  }
  if (isShortAudio && analysisExtra) {
    const head = '## 售前分析报告（与「推送报告」正文一致）\n\n'
    await sendAppChatMarkdownChunked(chatid, head + analysisExtra)
    logger.info(
      `[presales-video] 短音频(<${splitSec}s)已追加分析报告 Markdown 入群 transcription=${transcriptionId} chatid=${chatid} len=${analysisExtra.length}`
    )
  }

  const rawLink = pickRawVideoLinkForWecomCard(videoTask)
  const execId =
    videoTask && videoTask.execute_id != null ? String(videoTask.execute_id).trim() : ''
  const cardTpl = resolveWecomCardUrlTemplate()
  let videoPushedAsCard = false

  async function sendCardWithUrl(cardUrl) {
    const titleBase =
      cardTitleOverride ||
      stripFileSuffix(tr.original_file_name || tr.name || '售前视频')
    const title = titleBase || '售前视频'
    logger.info(
      `[presales-video] 推送视频卡片链接 transcription=${transcriptionId} chatid=${chatid} url=${cardUrl}`
    )
    try {
      await wecomAppChatApi.sendAppChatTextCard(chatid, {
        title,
        description: defaultCardDescription(),
        url: cardUrl,
        btntxt: defaultCardBtntxt()
      })
      videoPushedAsCard = true
    } catch (e) {
      const errLine = escapeMdLine((e && e.message) || String(e))
      await wecomAppChatApi.sendAppChatMarkdown(
        chatid,
        `${formatVideoMarkdown(tr, videoTask)}\n> 发送文本卡片失败：${errLine}`
      )
    }
  }

  if (cardTpl) {
    if (!execId) {
      await wecomAppChatApi.sendAppChatMarkdown(
        chatid,
        `${formatVideoMarkdown(tr, videoTask)}\n> 卡片链接模板需要 \`execute_id\`（与库表 \`psv_video_info.id\` 一致）。请先**提交工作流**并等待 \`video_create\` 回调写入后再推送。`
      )
    } else {
      const idForCard = presalesVideoTaskService.clipExecuteIdForPsvVideoInfo(execId)
      const cardUrl = fillWecomCardUrlTemplate(cardTpl, idForCard, {
        reserve4: reserve4Stamp,
        pushAt: pushMoment
      })
      if (/^https?:\/\//i.test(cardUrl)) {
        await sendCardWithUrl(cardUrl)
      } else {
        await wecomAppChatApi.sendAppChatMarkdown(
          chatid,
          `${formatVideoMarkdown(tr, videoTask)}\n> 卡片 URL 模板展开后不是合法 http(s) 链接，请检查环境变量。`
        )
      }
    }
  } else if (rawLink) {
    if (isWindowsStyleFilePath(rawLink) && !/^https?:\/\//i.test(rawLink)) {
      await wecomAppChatApi.sendAppChatMarkdown(
        chatid,
        `${formatVideoMarkdown(tr, videoTask)}\n> 当前为 Windows 本地路径，无法在卡片中作为可点击链接。请改为 http(s) 地址，或配置 \`PRESALES_VIDEO_PSV_INFO_BASE_URL\` / \`PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL\` 做路径拼接；或使用 \`PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE\`（\`{id}\` = execute_id）。`
      )
    } else {
      const originOv = wecomCardPublicOriginOverride()
      const cardUrl = presalesVideoTaskService.buildPresalesVideoPublicPlayUrl(rawLink, originOv)
      if (/^https?:\/\//i.test(cardUrl)) {
        await sendCardWithUrl(cardUrl)
      } else {
        await wecomAppChatApi.sendAppChatMarkdown(
          chatid,
          `${formatVideoMarkdown(tr, videoTask)}\n> 无法生成 http(s) 卡片链接。请配置 \`PRESALES_VIDEO_PSV_INFO_BASE_URL\`（或 HOST+PORT+SCHEME），或 \`PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL\` 做路径拼接；或使用带 \`{id}\` 的播放页模板。`
        )
      }
    }
  } else {
    await wecomAppChatApi.sendAppChatMarkdown(chatid, formatVideoMarkdown(tr, videoTask))
  }

  return {
    chatid,
    reusedExistingChat,
    leadKey: leadKey || null,
    reportMatched: Boolean(report),
    userCount: userIds.length,
    videoPushedAsMedia: false,
    videoPushedAsCard
  }
}

/** 接收「小R」售前视频卡片的企微 userid，默认 rxkf01 */
const PRESALES_VIDEO_RXKF_USERID =
  String(process.env.PRESALES_VIDEO_RXKF_USERID || 'rxkf01').trim() || 'rxkf01'

/**
 * 不建群、不调外部报备/线索接口：仅向指定成员（默认 rxkf01）发送与群内推送相同的可点击文本卡片（同一套 URL 解析逻辑）。
 * 会写入 reserve_4：伪 chatId（前缀 old + 8 位随机数），供卡片模板 {chatId} 从 reserve_4 解析。
 * 依赖自建应用 message/send，需 WECOM_AGENT_ID。
 */
async function sendPresalesVideoCardToRxkfOnly(ctx) {
  const { prisma, transcriptionId, cardTitle: cardTitleRaw } = ctx

  if (!wecomAppChatApi.isAppChatConfigured()) {
    throw new Error(
      '未配置企业微信自建应用：请在环境变量中设置 WECOM_CORP_ID、WECOM_APPCHAT_SECRET'
    )
  }
  if (!wecomAppChatApi.isApplicationMessageConfigured()) {
    throw new Error('未配置 WECOM_AGENT_ID，无法向成员单发应用消息 textcard')
  }

  const tr = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!tr) throw new Error('转录不存在')

  let videoTask = null
  try {
    videoTask = await prisma.presales_video_tasks.findUnique({
      where: { transcription_id: transcriptionId }
    })
  } catch (_) {
    /* optional table */
  }

  const cardTitleOverride =
    cardTitleRaw != null && String(cardTitleRaw).trim() !== ''
      ? String(cardTitleRaw).trim()
      : null

  const rawLink = pickRawVideoLinkForWecomCard(videoTask)
  const execId =
    videoTask && videoTask.execute_id != null ? String(videoTask.execute_id).trim() : ''
  const cardTpl = resolveWecomCardUrlTemplate()
  const pushMoment = new Date()

  const pseudoChatId = generateRxkfPseudoAppChatId()
  const reserve4Stamp = `wecom_appchat:${pseudoChatId}@${pushMoment.toISOString()}`.slice(0, 500)
  try {
    await prisma.presales_video_tasks.updateMany({
      where: { transcription_id: transcriptionId },
      data: { reserve_4: reserve4Stamp }
    })
  } catch (e) {
    logger.warn('[presales-video] 单发小R：回写 reserve_4 失败:', e && e.message)
  }

  let cardUrl = ''
  if (cardTpl) {
    if (!execId) {
      throw new Error(
        '卡片链接模板需要 execute_id（请先提交工作流并等待 video_create 回调写入 presales_video_tasks）。'
      )
    }
    const idForCard = presalesVideoTaskService.clipExecuteIdForPsvVideoInfo(execId)
    cardUrl = fillWecomCardUrlTemplate(cardTpl, idForCard, {
      reserve4: reserve4Stamp,
      pushAt: pushMoment
    })
    if (!/^https?:\/\//i.test(cardUrl)) {
      throw new Error('卡片 URL 模板展开后不是合法 http(s) 链接，请检查环境变量')
    }
  } else if (rawLink) {
    if (isWindowsStyleFilePath(rawLink) && !/^https?:\/\//i.test(rawLink)) {
      throw new Error(
        '当前视频地址为本地路径，无法作为卡片链接。请改为 http(s)，或配置 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE / 公共基址。'
      )
    }
    const originOv = wecomCardPublicOriginOverride()
    cardUrl = presalesVideoTaskService.buildPresalesVideoPublicPlayUrl(rawLink, originOv)
    if (!/^https?:\/\//i.test(cardUrl)) {
      throw new Error(
        '无法生成 http(s) 卡片链接。请配置 PRESALES_VIDEO_PSV_INFO_BASE_URL 或 PRESALES_VIDEO_WECOM_PUSH_PUBLIC_BASE_URL 等。'
      )
    }
  } else {
    throw new Error(
      '无可用卡片链接：请确认已有 execute_id / video_address，或配置 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE。'
    )
  }

  const titleBase =
    cardTitleOverride ||
    stripFileSuffix(tr.original_file_name || tr.name || '售前视频')
  const title = titleBase || '售前视频'

  await wecomAppChatApi.sendApplicationTextCardToUser(PRESALES_VIDEO_RXKF_USERID, {
    title,
    description: defaultCardDescription(),
    url: cardUrl,
    btntxt: defaultCardBtntxt()
  })

  logger.info(
    `[presales-video] 已向 ${PRESALES_VIDEO_RXKF_USERID} 单发售前视频卡片 transcription=${transcriptionId} pseudoChatId=${pseudoChatId}`
  )

  return {
    touser: PRESALES_VIDEO_RXKF_USERID,
    videoPushedAsCard: true,
    chatId: pseudoChatId,
    reserve_4: reserve4Stamp
  }
}

module.exports = {
  parseUserIds,
  resolvePushVideoUserIds,
  findLatestMatchingReport,
  formatReportMarkdown,
  formatVideoMarkdown,
  extractWecomAppChatIdFromReserve4,
  fillWecomCardUrlTemplate,
  getPresalesVideoPushMarkdownPreview,
  pushPresalesVideoToWecomAppChat,
  sendPresalesVideoCardToRxkfOnly
}
