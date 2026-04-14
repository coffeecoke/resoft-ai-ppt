/**
 * 售前视频：企微应用群发会话推送「交流报备摘要 + 售前视频文本卡片」
 * 卡片 URL：优先 PRESALES_VIDEO_WECOM_CARD_URL_TEMPLATE（{id}=execute_id/psv_video_info.id；{chatId}=本次会话 chatid 或从 reserve_4 解析）；否则「基址+playlist/path」拼接
 */
const wecomAppChatApi = require('./wecomAppChatApi')
const presalesVideoTaskService = require('./presalesVideoTaskService')
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

function formatReportMarkdown(report) {
  if (!report) {
    return (
      '**交流报备**\n' +
      '> 未匹配到报备记录。\n' +
      '> 常见原因：① 转录「客户名称」为空，且文件名/标题与报备里的客户或线索名称无重合；② 库中尚无对应交流报备。\n' +
      '> 处理：在语音转写里补全该转录的客户名称，或保证企微报备中的客户/线索名与文件名中的客户关键词一致；也可先在企微发送标准「交流报备」模板入库后再推送。'
    )
  }
  const rd = report.report_date ? new Date(report.report_date) : null
  const rdStr = rd && !Number.isNaN(rd.getTime()) ? rd.toLocaleString('zh-CN', { hour12: false }) : '-'
  const lines = [
    '**交流报备**（自动关联）',
    `客户名称：${escapeMdLine(report.customer_name)}`,
    report.lead_name ? `线索名称：${escapeMdLine(report.lead_name)}` : null,
    report.communication_form ? `交流形式：${escapeMdLine(report.communication_form)}` : null,
    `交流日期：${escapeMdLine(rdStr)}`,
    report.client_participants ? `客户方人员：${escapeMdLine(report.client_participants)}` : null,
    report.our_participants ? `我方人员：${escapeMdLine(report.our_participants)}` : null,
    report.report_note ? `备注：${escapeMdLine(report.report_note)}` : null
  ].filter(Boolean)
  return lines.join('\n')
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
 * 卡片 H5 地址模板：{id} = psv_video_info.id（与 presales_video_tasks.execute_id 一致），{chatId} 可选
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
 * @param {{ chatId?: string, reserve4?: string|null }} [opts]
 * {chatId} 替换顺序：优先从 reserve4 解析（与 presales_video_tasks.reserve_4 落库格式一致）；否则 opts.chatId；再否则 PRESALES_VIDEO_WECOM_CARD_CHAT_ID。
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
  return String(tpl)
    .split('{id}')
    .join(encodeURIComponent(executeId))
    .split('{chatId}')
    .join(encodeURIComponent(chatId))
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

  const userIds = parseUserIds(userIdsRaw)
  if (userIds.length < 2) {
    throw new Error('至少需要 2 个企业微信成员 userid（逗号分隔），且须在该应用可见范围内')
  }

  const tr = await prisma.transcriptions.findUnique({ where: { id: transcriptionId } })
  if (!tr) {
    throw new Error('转录不存在')
  }

  let videoTask = null
  try {
    videoTask = await prisma.presales_video_tasks.findUnique({
      where: { transcription_id: transcriptionId }
    })
  } catch {
    /* optional table */
  }

  const report = await findLatestMatchingReport(prisma, tr)
  const chatName = `售前视频-${escapeMdLine(tr.original_file_name || tr.name || transcriptionId).slice(0, 40)}`
  const ownerUserId = userIds[0]
  const { chatid } = await wecomAppChatApi.createAppChat({
    name: chatName,
    ownerUserId,
    userIds
  })

  const reserve4Stamp = `wecom_appchat:${chatid}@${new Date().toISOString()}`.slice(0, 500)
  try {
    await prisma.presales_video_tasks.updateMany({
      where: { transcription_id: transcriptionId },
      data: { reserve_4: reserve4Stamp }
    })
  } catch (e) {
    logger.warn('[presales-video] 推送前回写 reserve_4 失败:', e && e.message)
  }

  const md1 = formatReportMarkdown(report)
  await wecomAppChatApi.sendAppChatMarkdown(chatid, md1)

  const rawLink = pickRawVideoLinkForWecomCard(videoTask)
  const execId =
    videoTask && videoTask.execute_id != null ? String(videoTask.execute_id).trim() : ''
  const cardTpl = resolveWecomCardUrlTemplate()
  let videoPushedAsCard = false

  async function sendCardWithUrl(cardUrl) {
    const title = String(tr.original_file_name || tr.name || '售前视频').trim() || '售前视频'
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
        reserve4: reserve4Stamp
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
    reportMatched: Boolean(report),
    userCount: userIds.length,
    videoPushedAsMedia: false,
    videoPushedAsCard
  }
}

module.exports = {
  parseUserIds,
  findLatestMatchingReport,
  formatReportMarkdown,
  formatVideoMarkdown,
  extractWecomAppChatIdFromReserve4,
  fillWecomCardUrlTemplate,
  pushPresalesVideoToWecomAppChat
}
