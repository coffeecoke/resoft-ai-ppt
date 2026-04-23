/**
 * 售前视频：企微应用群发会话推送「交流报备摘要 + 售前视频文本卡片」
 * 卡片 URL：优先 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE（{id}、{chatId}、{timestape}/{timestamp}=推送时刻 Unix 毫秒时间戳）；否则「基址+playlist/path」拼接
 */
const wecomAppChatApi = require('./wecomAppChatApi')
const presalesVideoTaskService = require('./presalesVideoTaskService')
const presalesVideoGroupSettingsService = require('./presalesVideoGroupSettingsService')
const logger = require('../utils/logger')

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
  return [...new Set([...chain, ...fixed, 'rxkf01'].filter(Boolean))]
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
    beforeExclude = [...new Set([...fromInput, ...fixedMembers, 'rxkf01'].filter(Boolean))]
  } else {
    beforeExclude = await buildAutoUserIds(prisma, tr, fixedMembers)
  }

  let userIds = applyExcludedUsers(beforeExclude)
  // 管理员/必选人员不允许被排除
  if (!userIds.includes('rxkf01')) userIds.push('rxkf01')
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
  if (!report) return ''
  const xsbh = String(report.lead_code || report.lead_id || '').trim()
  if (!xsbh) return ''

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
    String(report.lead_name || '').trim() ||
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

  return [
    `此群为线索【${escapeMdLine(leadName)}】售前交流分析群`,
    `线索立项时间：${escapeMdLine(formatDateZh(setupTimeRaw))}`,
    `线索类型：【${escapeMdLine(clueType)}】`,
    `当前线索已到【${escapeMdLine(stage)}】阶段`,
    `221信息：${escapeMdLine(info221)}`,
    `线索编号：${escapeMdLine(xsbhFinal)}`
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
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {string} ctx.transcriptionId
 * @param {string|string[]} ctx.userIdsRaw 逗号分隔或数组
 * @returns {Promise<{ chatid: string, reportMatched: boolean, userCount: number, videoPushedAsMedia?: boolean, videoPushedAsCard?: boolean }>}
 */
async function pushPresalesVideoToWecomAppChat(ctx) {
  const { prisma, transcriptionId, userIdsRaw } = ctx
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
  const chatName = `${trimToLength(preferredLeadName, 36)}-售前分析`
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
  const md1 = formatReportMarkdown(report, nth)
  const clueMd = await buildClueSummaryMarkdown(report)
  if (clueMd) {
    await wecomAppChatApi.sendAppChatMarkdown(chatid, clueMd)
  }
  await wecomAppChatApi.sendAppChatMarkdown(chatid, md1)

  const rawLink = pickRawVideoLinkForWecomCard(videoTask)
  const execId =
    videoTask && videoTask.execute_id != null ? String(videoTask.execute_id).trim() : ''
  const cardTpl = resolveWecomCardUrlTemplate()
  let videoPushedAsCard = false

  async function sendCardWithUrl(cardUrl) {
    const titleBase = stripFileSuffix(tr.original_file_name || tr.name || '售前视频')
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

module.exports = {
  parseUserIds,
  resolvePushVideoUserIds,
  findLatestMatchingReport,
  formatReportMarkdown,
  formatVideoMarkdown,
  extractWecomAppChatIdFromReserve4,
  fillWecomCardUrlTemplate,
  pushPresalesVideoToWecomAppChat
}
