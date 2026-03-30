/**
 * 售前视频：企微应用群发会话推送「交流报备摘要 + 视频信息」
 */
const fs = require('fs')
const path = require('path')
const os = require('os')
const http = require('http')
const https = require('https')
const { URL } = require('url')
const wecomAppChatApi = require('./wecomAppChatApi')

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

function resolveLocalVideoFile(v) {
  const s = String(v || '').trim()
  if (!s || /^https?:\/\//i.test(s)) return null
  const abs = path.resolve(s)
  try {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs
  } catch {
    return null
  }
  return null
}

/**
 * 将 http(s) 视频下载到临时文件（不超过 maxBytes）
 * @returns {Promise<string>} 临时文件绝对路径，调用方负责 unlink
 */
function downloadVideoToTempFile(urlString, maxBytes) {
  return new Promise((resolve, reject) => {
    let u
    try {
      u = new URL(urlString)
    } catch {
      reject(new Error('无效的视频 URL'))
      return
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      reject(new Error('仅支持 http/https 视频地址'))
      return
    }
    const lib = u.protocol === 'https:' ? https : http
    const tmp = path.join(
      os.tmpdir(),
      `wecom_pv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}.mp4`
    )
    const req = lib.get(
      urlString,
      { headers: { 'User-Agent': 'presales-video-wecom-push/1.0' } },
      (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载视频失败 HTTP ${res.statusCode}`))
          return
        }
        const cl = parseInt(res.headers['content-length'] || '0', 10)
        if (cl > maxBytes) {
          reject(new Error(`视频过大（约 ${Math.round(cl / 1024 / 1024)}MB），超过企微临时素材约 10MB 上限`))
          return
        }
        const w = fs.createWriteStream(tmp)
        let received = 0
        res.on('data', (chunk) => {
          received += chunk.length
          if (received > maxBytes) {
            res.destroy()
            w.destroy()
            try {
              fs.unlinkSync(tmp)
            } catch {}
            reject(new Error(`视频超过 ${maxBytes} 字节（企微临时素材上限约 10MB）`))
          }
        })
        res.pipe(w)
        w.on('finish', () => w.close(() => resolve(tmp)))
        w.on('error', (e) => {
          try {
            fs.unlinkSync(tmp)
          } catch {}
          reject(e)
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(180000, () => {
      req.destroy()
      try {
        fs.unlinkSync(tmp)
      } catch {}
      reject(new Error('下载视频超时'))
    })
  })
}

/**
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {string} ctx.transcriptionId
 * @param {string|string[]} ctx.userIdsRaw 逗号分隔或数组
 * @returns {Promise<{ chatid: string, reportMatched: boolean, userCount: number, videoPushedAsMedia?: boolean }>}
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

  const md1 = formatReportMarkdown(report)
  await wecomAppChatApi.sendAppChatMarkdown(chatid, md1)

  const v = videoTask && videoTask.video_address && String(videoTask.video_address).trim()
  const maxDownload = wecomAppChatApi.TEMP_FILE_MAX_BYTES
  let videoPushedAsMedia = false
  let tempDownloadPath = null

  if (v) {
    try {
      let filePath = resolveLocalVideoFile(v)
      if (!filePath && /^https?:\/\//i.test(v)) {
        tempDownloadPath = await downloadVideoToTempFile(v, maxDownload)
        filePath = tempDownloadPath
      }
      if (filePath) {
        const st = fs.statSync(filePath)
        if (st.size > wecomAppChatApi.TEMP_FILE_MAX_BYTES) {
          throw new Error(
            `文件约 ${Math.round(st.size / 1024 / 1024)}MB，超过企微临时素材上限（约 20MB）`
          )
        }
        const title = String(tr.original_file_name || tr.name || '售前视频').slice(0, 128)
        if (st.size <= wecomAppChatApi.TEMP_VIDEO_MAX_BYTES) {
          const mediaId = await wecomAppChatApi.uploadTempMediaVideo(filePath)
          await wecomAppChatApi.sendAppChatVideo(chatid, mediaId, {
            title,
            description: '售前视频 · 请在客户端播放'
          })
        } else {
          const mediaId = await wecomAppChatApi.uploadTempMediaFile(filePath)
          await wecomAppChatApi.sendAppChatFile(chatid, mediaId)
        }
        videoPushedAsMedia = true
        const cap =
          st.size <= wecomAppChatApi.TEMP_VIDEO_MAX_BYTES
            ? `**售前视频**\n转录：${escapeMdLine(title)}\n> 上方为视频消息，请在企业微信内直接播放。`
            : `**售前视频**\n转录：${escapeMdLine(title)}\n> 文件大于 10MB，已以「文件」消息发送，请下载后播放。`
        await wecomAppChatApi.sendAppChatMarkdown(chatid, cap)
      } else {
        await wecomAppChatApi.sendAppChatMarkdown(chatid, formatVideoMarkdown(tr, videoTask))
      }
    } catch (e) {
      const errLine = escapeMdLine((e && e.message) || String(e))
      await wecomAppChatApi.sendAppChatMarkdown(
        chatid,
        `${formatVideoMarkdown(tr, videoTask)}\n> 以视频/文件推送失败：${errLine}\n> 请确认本机路径可读、mp4 优先；单段不超过约 20MB（大于 10MB 时将走文件消息）；http 链接需可下载且同限制。`
      )
    } finally {
      if (tempDownloadPath) {
        try {
          fs.unlinkSync(tempDownloadPath)
        } catch {
          /* ignore */
        }
      }
    }
  } else {
    await wecomAppChatApi.sendAppChatMarkdown(chatid, formatVideoMarkdown(tr, videoTask))
  }

  return {
    chatid,
    reportMatched: Boolean(report),
    userCount: userIds.length,
    videoPushedAsMedia
  }
}

module.exports = {
  parseUserIds,
  findLatestMatchingReport,
  formatReportMarkdown,
  formatVideoMarkdown,
  pushPresalesVideoToWecomAppChat
}
