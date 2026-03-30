/**
 * 企微文本「交流报备」：解析 → 写 JSON 快照 → communication_report_inbox + communication_reports
 */
const fs = require('fs').promises
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const { getUploadBaseDir } = require('../utils/pathHelper')
const { getLogger } = require('../wecomBot/logger')

const prisma = new PrismaClient()
const SOURCE_WECOM = 'wecom_bot'
/** HTTP 接口接入（售前报备 + 远程音频转录） */
const SOURCE_API_INBOUND = 'api_inbound'

function log() {
  return getLogger()
}

/** 是否像标准交流报备模板 */
function isWecomCommunicationReportTemplate(text) {
  const t = String(text || '').trim()
  if (!t) return false
  if (!/交流报备/.test(t)) return false
  if (!/\d+\s*[、.．]/.test(t)) return false
  return true
}

/**
 * 按行解析「1、xxx：yyy」或「5、无冒号整段」
 * @returns {Array<{ order: number, label: string, value: string }>}
 */
function parseNumberedLines(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const out = []
  for (const line of lines) {
    const m = line.match(/^(\d+)\s*[、.．]\s*(.+)$/)
    if (!m) continue
    const order = parseInt(m[1], 10)
    const rest = m[2].trim()
    const colon = rest.indexOf('：') >= 0 ? rest.indexOf('：') : rest.indexOf(':')
    if (colon > 0) {
      out.push({
        order,
        label: rest.slice(0, colon).trim(),
        value: rest.slice(colon + 1).trim()
      })
    } else {
      out.push({ order, label: rest, value: '' })
    }
  }
  return out.sort((a, b) => a.order - b.order)
}

function findField(items, labelIncludes) {
  const keys = Array.isArray(labelIncludes) ? labelIncludes : [labelIncludes]
  for (const it of items) {
    for (const k of keys) {
      if (it.label.includes(k)) return it
    }
  }
  return null
}

/** @returns {{ y: number, mo: number, d: number } | null} */
function parseChineseDateParts(str) {
  const m = String(str || '').match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y, mo, d }
}

/** 本地时区下的日历日时刻（避免 UTC 把「当天」写成前一天） */
function localDateTime(y, mo, d, hh, mm) {
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00.000`
  return new Date(iso)
}

/** 在同一天上解析 10:00-11:25（可带「上午」等前缀） */
function parseTimeRangeOnParts(ymd, timeSegment) {
  if (!ymd || !timeSegment) return { start_at: null, end_at: null }
  const seg = String(timeSegment).replace(/[上午下午晚上夜间]/g, ' ')
  const m = seg.match(/(\d{1,2})\s*:\s*(\d{2})\s*[-–~至到]\s*(\d{1,2})\s*:\s*(\d{2})/)
  if (!m) return { start_at: null, end_at: null }
  const { y, mo, d } = ymd
  const sh = parseInt(m[1], 10)
  const sm = parseInt(m[2], 10)
  const eh = parseInt(m[3], 10)
  const em = parseInt(m[4], 10)
  const start_at = localDateTime(y, mo, d, sh, sm)
  const end_at = localDateTime(y, mo, d, eh, em)
  return { start_at, end_at }
}

/** 从「形式与时间」混写串里拆形式、日期、时段 */
function splitFormAndTime(raw) {
  const s = String(raw || '').trim()
  const dateMatch = s.match(/(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/)
  const dateParts = dateMatch ? parseChineseDateParts(dateMatch[1]) : null
  let report_date = dateParts ? localDateTime(dateParts.y, dateParts.mo, dateParts.d, 0, 0) : null
  let communication_form = s
  let timeTail = ''
  if (dateMatch) {
    const idx = s.indexOf(dateMatch[1])
    communication_form = s.slice(0, idx).replace(/[，,、]\s*$/g, '').trim()
    timeTail = s.slice(idx + dateMatch[1].length).replace(/^[，,、\s]+/g, '').trim()
  }
  const timeRange = parseTimeRangeOnParts(dateParts, timeTail || s)
  return {
    communication_form: (communication_form || '').slice(0, 50) || null,
    report_date,
    dateParts,
    timeTail,
    ...timeRange
  }
}

/** 去掉「N人，」前缀 */
function stripHeadcountPrefix(text) {
  return String(text || '').replace(/^\d+\s*人\s*[，,、]?\s*/u, '').trim()
}

function tryParseHeadcount(text) {
  const m = String(text || '').match(/^(\d+)\s*人/)
  return m ? parseInt(m[1], 10) : null
}

/**
 * @param {string} rawText
 * @returns {{ structured: object, dbRow: object, warnings: string[] }}
 */
function parseCommunicationReportText(rawText) {
  const warnings = []
  const items = parseNumberedLines(rawText)
  if (items.length === 0) warnings.push('未识别到编号条目')

  const f1 = findField(items, ['客户及线索', '客户与线索'])
  const f2 = findField(items, ['交流与沟通形式', '沟通形式'])
  const f3 = findField(items, ['客户方人员'])
  const f4 = findField(items, ['我方人员'])
  const f5 = findField(items, ['录音', '录屏', '发送'])

  const customerLead = (f1 && f1.value) || (f1 && f1.label) || ''
  const customer_name = (customerLead || '（未填写客户/线索名称）').slice(0, 255)
  const lead_name = customerLead ? customerLead.slice(0, 255) : null

  const formRaw = (f2 && f2.value) || ''
  const ft = splitFormAndTime(formRaw)
  let report_date = ft.report_date
  if (!report_date) {
    const now = new Date()
    report_date = localDateTime(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0)
    warnings.push('未能解析交流日期，已使用当天日期')
  }

  let start_at = ft.start_at
  let end_at = ft.end_at
  if (!start_at || !end_at) {
    start_at = null
    end_at = null
    if (formRaw) warnings.push('未能解析具体起止时刻')
  }

  const clientRaw = (f3 && f3.value) || ''
  const client_headcount = tryParseHeadcount(clientRaw)
  const client_participants = stripHeadcountPrefix(clientRaw) || null

  const ourRaw = (f4 && f4.value) || ''
  const our_headcount = tryParseHeadcount(ourRaw)
  const our_participants = stripHeadcountPrefix(ourRaw) || null

  let record_note = ''
  if (f5) {
    record_note = [f5.label, f5.value].filter(Boolean).join('：').trim()
  }
  const report_note = [
    record_note || null,
    client_headcount != null ? `客户方人数（解析）：${client_headcount}` : null,
    our_headcount != null ? `我方人数（解析）：${our_headcount}` : null
  ]
    .filter(Boolean)
    .join('\n') || null

  const rdStr = `${report_date.getFullYear()}-${String(report_date.getMonth() + 1).padStart(2, '0')}-${String(report_date.getDate()).padStart(2, '0')}`
  const structured = {
    type: '交流报备',
    items,
    customer_and_lead_name: customerLead || null,
    communication_form_and_time_raw: formRaw || null,
    communication_form: ft.communication_form,
    report_date: rdStr,
    start_at: start_at ? start_at.toISOString() : null,
    end_at: end_at ? end_at.toISOString() : null,
    client_side: {
      headcount: client_headcount,
      personnel: client_participants
    },
    our_side: {
      headcount: our_headcount,
      names: our_participants
    },
    recording_or_extra: record_note || null,
    parse_warnings: warnings
  }

  const dbRow = {
    customer_name,
    lead_name,
    report_date,
    start_at,
    end_at,
    communication_form: ft.communication_form,
    client_participants,
    our_participants,
    record_method: /录音/.test(record_note) ? '录音' : null,
    report_note,
    lead_code: null,
    lead_id: null,
    speaker: null,
    main_content: null,
    system_name: null,
    objectives: null
  }

  return { structured, dbRow, warnings }
}

/**
 * @param {object} opts
 * @param {string} opts.rawText
 * @param {string} [opts.wecomMsgId]
 * @param {string} [opts.wecomUserId]
 * @param {string} [opts.senderLabel]
 * @returns {Promise<{ ok: boolean, reportId?: string, jsonPath?: string, duplicate?: boolean, error?: string }>}
 */
async function ingestWecomCommunicationReport(opts) {
  const { rawText, wecomMsgId, wecomUserId, senderLabel } = opts
  const logger = log()

  if (!isWecomCommunicationReportTemplate(rawText)) {
    return { ok: false, error: 'not_template' }
  }

  if (wecomMsgId) {
    const existing = await prisma.communication_reports.findFirst({
      where: { wecom_msg_id: String(wecomMsgId) },
      select: { id: true }
    })
    if (existing) {
      logger.info(`[wecom-comm-report] 重复 msgid，已忽略 | ${wecomMsgId}`)
      return { ok: true, duplicate: true, reportId: existing.id }
    }
  }

  const { structured, dbRow, warnings } = parseCommunicationReportText(rawText)
  structured.parse_warnings = [...(structured.parse_warnings || []), ...warnings]

  const uploadRoot = getUploadBaseDir()
  const relDir = path.join('wecom_bot', 'received', 'communication_reports')
  const absDir = path.join(uploadRoot, relDir)
  await fs.mkdir(absDir, { recursive: true })

  const safeMsg = (wecomMsgId && String(wecomMsgId).replace(/[^\w-]/g, '_').slice(0, 80)) || `noid_${Date.now()}`
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const fileName = `${day}_${safeMsg}.json`
  const absJson = path.join(absDir, fileName)
  const snapshotRel = path.relative(uploadRoot, absJson).split(path.sep).join('/')

  const inboxId = uuidv4()
  const reportId = uuidv4()
  const sender = (senderLabel || wecomUserId || 'unknown').slice(0, 100)

  await prisma.$transaction([
    prisma.communication_report_inbox.create({
      data: {
        id: inboxId,
        sender,
        sent_at: new Date(),
        content: rawText
      }
    }),
    prisma.communication_reports.create({
      data: {
        id: reportId,
        ...dbRow,
        created_by: (wecomUserId && String(wecomUserId).slice(0, 50)) || null,
        source_channel: SOURCE_WECOM,
        wecom_msg_id: wecomMsgId ? String(wecomMsgId).slice(0, 100) : null,
        snapshot_json_path: snapshotRel
      }
    })
  ])

  const payload = {
    version: 1,
    source: SOURCE_WECOM,
    report_id: reportId,
    inbox_id: inboxId,
    wecom_msg_id: wecomMsgId || null,
    wecom_user_id: wecomUserId || null,
    sender_label: senderLabel || null,
    ingested_at: new Date().toISOString(),
    snapshot_json_path: snapshotRel,
    structured
  }

  await fs.writeFile(absJson, JSON.stringify(payload, null, 2), 'utf8')

  logger.info(`[wecom-comm-report] 已入库 report=${reportId} json=${snapshotRel}`)
  return { ok: true, reportId, jsonPath: snapshotRel, duplicate: false }
}

function parseOptInboundDate(v) {
  if (v == null || v === '') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 将调用方 JSON 映射为 communication_reports 行（与 parseCommunicationReportText 的 dbRow 字段对齐）
 */
function mapInboundJsonToDbRow(o) {
  const s = o && typeof o === 'object' ? o : {}
  const str = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : '')
  const customerRaw =
    str(s.customer_name) ||
    str(s.customerName) ||
    str(s.customer_and_lead_name) ||
    str(s['客户及线索名称'])
  const customer_name = (customerRaw || '（未填写客户/线索名称）').slice(0, 255)
  const leadRaw = str(s.lead_name) || str(s.leadName) || str(s['线索名称'])
  const lead_name = leadRaw ? leadRaw.slice(0, 255) : null

  let report_date = parseOptInboundDate(s.report_date || s.reportDate)
  if (!report_date) {
    const now = new Date()
    report_date = localDateTime(now.getFullYear(), now.getMonth() + 1, now.getDate(), 0, 0)
  }

  const comm = str(s.communication_form) || str(s.communicationForm) || str(s['交流形式'])
  return {
    customer_name,
    lead_name,
    report_date,
    start_at: parseOptInboundDate(s.start_at || s.startAt),
    end_at: parseOptInboundDate(s.end_at || s.endAt),
    communication_form: comm ? comm.slice(0, 50) : null,
    client_participants:
      str(s.client_participants) || str(s.clientParticipants) || str(s['客户方人员']) || null,
    our_participants: str(s.our_participants) || str(s.ourParticipants) || str(s['我方人员']) || null,
    record_method: (str(s.record_method) || str(s.recordMethod)).slice(0, 50) || null,
    report_note: str(s.report_note) || str(s.reportNote) || null,
    lead_code: str(s.lead_code) || str(s.leadCode) ? (str(s.lead_code) || str(s.leadCode)).slice(0, 100) : null,
    lead_id: str(s.lead_id) || str(s.leadId) ? (str(s.lead_id) || str(s.leadId)).slice(0, 50) : null,
    speaker: str(s.speaker) ? str(s.speaker).slice(0, 100) : null,
    main_content: str(s.main_content) || str(s.mainContent) ? (str(s.main_content) || str(s.mainContent)).slice(0, 500) : null,
    system_name: str(s.system_name) || str(s.systemName) ? (str(s.system_name) || str(s.systemName)).slice(0, 255) : null,
    objectives: str(s.objectives) || null
  }
}

/**
 * @param {string|object} payload 文本走编号模板解析；对象走 JSON 映射
 * @returns {{ dbRow: object, structured: object, rawText: string, warnings: string[] }}
 */
function coerceReportPayloadToDbRow(payload) {
  if (payload == null) {
    throw new Error('report 不能为空')
  }
  if (typeof payload === 'string') {
    const t = payload.trim()
    if (!t) throw new Error('report 文本为空')
    const { dbRow, structured, warnings } = parseCommunicationReportText(t)
    return { dbRow, structured, rawText: t, warnings: warnings || [] }
  }
  if (typeof payload === 'object') {
    const dbRow = mapInboundJsonToDbRow(payload)
    return { dbRow, structured: payload, rawText: JSON.stringify(payload), warnings: [] }
  }
  throw new Error('report 须为字符串或 JSON 对象')
}

/**
 * 接口接入：报备入库 + JSON 快照（无企微 msgid 去重）
 */
async function persistInboundCommunicationReport(opts) {
  const { dbRow, structured, rawText, createdBy, extraReportNote } = opts
  const logger = log()
  const reportId = uuidv4()
  const inboxId = uuidv4()
  const uploadRoot = getUploadBaseDir()
  const relDir = path.join('presales_inbound', 'communication_reports')
  const absDir = path.join(uploadRoot, relDir)
  await fs.mkdir(absDir, { recursive: true })
  const fileName = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${reportId.slice(0, 8)}.json`
  const absJson = path.join(absDir, fileName)
  const snapshotRel = path.relative(uploadRoot, absJson).split(path.sep).join('/')

  const inboxContent = (rawText && rawText.length > 60000 ? rawText.slice(0, 60000) + '…' : rawText) || ''
  const noteMerge = [dbRow.report_note, extraReportNote].filter(Boolean).join('\n') || null

  await prisma.$transaction([
    prisma.communication_report_inbox.create({
      data: {
        id: inboxId,
        sender: 'api_inbound',
        sent_at: new Date(),
        content: inboxContent || JSON.stringify(structured || {})
      }
    }),
    prisma.communication_reports.create({
      data: {
        id: reportId,
        ...dbRow,
        report_note: noteMerge,
        created_by: createdBy ? String(createdBy).slice(0, 50) : null,
        source_channel: SOURCE_API_INBOUND,
        wecom_msg_id: null,
        snapshot_json_path: snapshotRel
      }
    })
  ])

  const payload = {
    version: 1,
    source: SOURCE_API_INBOUND,
    report_id: reportId,
    inbox_id: inboxId,
    ingested_at: new Date().toISOString(),
    snapshot_json_path: snapshotRel,
    structured
  }
  await fs.writeFile(absJson, JSON.stringify(payload, null, 2), 'utf8')
  logger.info(`[presales-inbound] 报备已入库 report=${reportId}`)
  return { reportId, snapshotRel }
}

module.exports = {
  isWecomCommunicationReportTemplate,
  parseCommunicationReportText,
  ingestWecomCommunicationReport,
  coerceReportPayloadToDbRow,
  mapInboundJsonToDbRow,
  persistInboundCommunicationReport,
  SOURCE_WECOM,
  SOURCE_API_INBOUND
}
