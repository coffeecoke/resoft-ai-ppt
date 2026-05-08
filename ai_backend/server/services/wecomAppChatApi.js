/**
 * 企业微信 HTTP：gettoken + appchat 建群 + 群发 Markdown / 文本卡片 / 视频；
 * 以及自建应用 message/send（成员 textcard / markdown，售前视频「说话人角色确认」与超时提醒）。
 * 需自建应用 Secret（与智能机器人 WebSocket Secret 不同），且应用可见范围内包含所选成员。
 * @see https://developer.work.weixin.qq.com/document/path/90245
 * @see https://developer.work.weixin.qq.com/document/path/90253 上传临时素材
 * @see https://developer.work.weixin.qq.com/document/path/90236 message/send
 */
const fs = require('fs')
const path = require('path')
const https = require('https')
const { URL } = require('url')
const FormData = require('form-data')
const logger = require('../utils/logger')

let tokenCache = { token: null, expireAtMs: 0 }

function httpsGetJson(urlString) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const opts = { hostname: u.hostname, port: 443, path: `${u.pathname}${u.search}`, method: 'GET' }
    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function httpsPostJson(urlString, bodyObj) {
  const data = JSON.stringify(bodyObj)
  return new Promise((resolve, reject) => {
    const u = new URL(urlString)
    const opts = {
      hostname: u.hostname,
      port: 443,
      path: `${u.pathname}${u.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(data, 'utf8')
      }
    }
    const req = https.request(opts, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
        } catch (e) {
          reject(e)
        }
      })
    })
    req.on('error', reject)
    req.write(data, 'utf8')
    req.end()
  })
}

/**
 * 企微接口 errcode 补充中文说明（常见运维问题）
 * @see https://developer.work.weixin.qq.com/document/path/90313 全局错误码
 */
function formatQyApiError(context, j) {
  const code = Number(j.errcode)
  const raw = j.errmsg != null ? String(j.errmsg) : String(j.errcode)
  const head = `${context}: ${raw}`
  if (code === 60020) {
    return (
      `${head}\n【60020 可信 IP】管理后台 → 应用管理 → 与 WECOM_APPCHAT_SECRET 对应的自建应用 → 企业可信 IP，将报错里的 from ip（本服务访问 qyapi.weixin.qq.com 的出口公网 IP）加入白名单。云主机填公网/弹性 IP；本地开发填当前出口 IP；IP 常变需固定出口或使用具备固定 IP 的中转。文档：https://developer.work.weixin.qq.com/document/path/90313`
    )
  }
  return head
}

function isAppChatConfigured() {
  const id = process.env.WECOM_CORP_ID && String(process.env.WECOM_CORP_ID).trim()
  const sec = process.env.WECOM_APPCHAT_SECRET && String(process.env.WECOM_APPCHAT_SECRET).trim()
  return Boolean(id && sec)
}

/** @returns {number|null} 自建应用 AgentId，未配置或非法时返回 null */
function getApplicationAgentId() {
  const raw = String(process.env.WECOM_AGENT_ID || '').trim()
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** 是否可调用 message/send（角色确认 textcard、超时提醒 markdown） */
function isApplicationMessageConfigured() {
  return isAppChatConfigured() && getApplicationAgentId() != null
}

async function getAccessToken() {
  const corpId = String(process.env.WECOM_CORP_ID || '').trim()
  const secret = String(process.env.WECOM_APPCHAT_SECRET || '').trim()
  if (!corpId || !secret) {
    throw new Error('未配置 WECOM_CORP_ID 或 WECOM_APPCHAT_SECRET，无法调用企业微信 appchat 接口')
  }
  const now = Date.now()
  if (tokenCache.token && now < tokenCache.expireAtMs - 60_000) {
    return tokenCache.token
  }
  const url = `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${encodeURIComponent(corpId)}&corpsecret=${encodeURIComponent(secret)}`
  const j = await httpsGetJson(url)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('企业微信 gettoken 失败', j))
  }
  if (!j.access_token) {
    throw new Error('企业微信 gettoken 未返回 access_token')
  }
  const expiresIn = Number(j.expires_in) || 7200
  tokenCache = { token: j.access_token, expireAtMs: now + expiresIn * 1000 }
  return tokenCache.token
}

/** 群名最多约 50 utf8 字符（企微文档） */
function truncateChatName(name) {
  const s = String(name || '售前视频群')
  const arr = Array.from(s)
  return arr.length <= 50 ? s : arr.slice(0, 47).join('') + '…'
}

/**
 * @param {{ name: string, ownerUserId: string, userIds: string[] }} opts userIds 去重后须含 owner，且至少 2 人
 * @returns {Promise<{ chatid: string }>}
 */
async function createAppChat(opts) {
  const token = await getAccessToken()
  const userlist = [...new Set((opts.userIds || []).map((u) => String(u).trim()).filter(Boolean))]
  const owner = String(opts.ownerUserId || '').trim()
  if (!owner || !userlist.includes(owner)) {
    throw new Error('群主必须包含在成员列表中')
  }
  if (userlist.length < 2) {
    throw new Error('企业微信应用群发会话至少需要 2 名成员（含群主）')
  }
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/create?access_token=${encodeURIComponent(token)}`
  const body = {
    name: truncateChatName(opts.name),
    owner,
    userlist
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('appchat/create 失败', j))
  }
  if (!j.chatid) {
    throw new Error('appchat/create 未返回 chatid')
  }
  return { chatid: j.chatid }
}

/**
 * 修改群发会话成员（向已有群追加成员）。
 * 企微对整条 `add_user_list` 校验：任一 userid 无效（60111）则整批失败，故改为逐个添加；
 * 60111 仅记录警告并跳过（userid 不存在、已离职、不在自建应用可见范围等）。
 * @see https://developer.work.weixin.qq.com/document/path/90246
 * @param {string} chatid
 * @param {string[]} userIds 本次推送完整成员列表
 * @returns {Promise<{ ok: true, addedCount: number, skipped60111: string[] }>}
 */
async function updateAppChatAddMembers(chatid, userIds) {
  const ids = [...new Set((userIds || []).map((u) => String(u).trim()).filter(Boolean))]
  if (ids.length === 0) {
    throw new Error('appchat/update：成员列表为空')
  }
  const chatidStr = String(chatid).trim()
  const skipped60111 = []
  let addedCount = 0
  for (const uid of ids) {
    const token = await getAccessToken()
    const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/update?access_token=${encodeURIComponent(token)}`
    const body = {
      chatid: chatidStr,
      add_user_list: uid
    }
    const j = await httpsPostJson(url, body)
    if (j.errcode == null || j.errcode === 0) {
      addedCount += 1
      continue
    }
    const code = Number(j.errcode)
    /** userid 不存在或不在应用可见范围内等，跳过此人其余人仍可进群 */
    if (code === 60111) {
      skipped60111.push(uid)
      logger.warn(
        `[wecom-appchat] appchat/update 跳过无效 userid=${uid} chatid=${chatidStr}: ${j.errmsg || code}`
      )
      continue
    }
    throw new Error(formatQyApiError(`appchat/update 添加成员失败 userid=${uid}`, j))
  }
  if (skipped60111.length > 0) {
    logger.warn(
      `[wecom-appchat] 本次复用群追加成员：成功 ${addedCount} 人，跳过 ${skipped60111.length} 人（60111）：${skipped60111.join(', ')}`
    )
  } else {
    logger.info(`[wecom-appchat] appchat/update 追加成员完成 chatid=${chatidStr} count=${addedCount}`)
  }
  return { ok: true, addedCount, skipped60111 }
}

/**
 * @param {string} chatid
 * @param {string} markdownContent
 */
async function sendAppChatMarkdown(chatid, markdownContent) {
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${encodeURIComponent(token)}`
  const content = String(markdownContent || '').slice(0, 4000)
  const body = {
    chatid: String(chatid).trim(),
    msgtype: 'markdown',
    markdown: { content }
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('appchat/send 失败', j))
  }
  return true
}

/** 企微限制：title 约 128 字节、description 约 512 字节（UTF-8） */
function truncateUtf8Bytes(str, maxBytes) {
  const b = Buffer.from(String(str || ''), 'utf8')
  if (b.length <= maxBytes) return String(str || '')
  let end = maxBytes
  while (end > 0 && (b[end] & 0xc0) === 0x80) end -= 1
  return b.slice(0, end).toString('utf8')
}

/**
 * 文本卡片（可点击跳转链接）
 * @param {string} chatid
 * @param {{ title: string, description: string, url: string, btntxt?: string }} opts
 */
async function sendAppChatTextCard(chatid, opts) {
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${encodeURIComponent(token)}`
  const o = opts && typeof opts === 'object' ? opts : {}
  const title = truncateUtf8Bytes(o.title || '售前视频', 128)
  const description = truncateUtf8Bytes(o.description || '<div class="normal">点击查看</div>', 512)
  const jump = String(o.url || '').trim()
  if (!jump) {
    throw new Error('textcard 缺少 url')
  }
  const btntxt = truncateUtf8Bytes((o.btntxt != null ? String(o.btntxt) : '详情') || '详情', 12).slice(0, 4)
  const body = {
    chatid: String(chatid).trim(),
    msgtype: 'textcard',
    textcard: {
      title,
      description,
      url: jump,
      btntxt: btntxt || '详情'
    },
    safe: 0
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('appchat/send(textcard) 失败', j))
  }
  return true
}

/**
 * 自建应用 message/send → 成员 textcard（单聊 touser=userid）
 * @param {string} touser
 * @param {{ title: string, description: string, url: string, btntxt?: string }} opts
 */
async function sendApplicationTextCardToUser(touser, opts) {
  const agentid = getApplicationAgentId()
  if (!agentid) {
    throw new Error('未配置 WECOM_AGENT_ID，无法发送应用消息 textcard')
  }
  const uid = String(touser || '').trim()
  if (!uid) {
    throw new Error('缺少接收人 userid')
  }
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`
  const o = opts && typeof opts === 'object' ? opts : {}
  const title = truncateUtf8Bytes(o.title || '通知', 128)
  const description = truncateUtf8Bytes(o.description || '<div class="normal">点击查看</div>', 512)
  const jump = String(o.url || '').trim()
  if (!jump) {
    throw new Error('textcard 缺少 url')
  }
  const btntxt = truncateUtf8Bytes((o.btntxt != null ? String(o.btntxt) : '详情') || '详情', 12)
  const body = {
    touser: uid,
    msgtype: 'textcard',
    agentid,
    textcard: {
      title,
      description,
      url: jump,
      btntxt: btntxt || '详情'
    },
    safe: 0,
    enable_id_trans: 0
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('message/send(textcard) 失败', j))
  }
  return true
}

/**
 * 自建应用 message/send → 成员 markdown
 * @param {string} touser
 * @param {string} markdownContent 最长约 4096 字节（UTF-8）
 */
async function sendApplicationMarkdownToUser(touser, markdownContent) {
  const agentid = getApplicationAgentId()
  if (!agentid) {
    throw new Error('未配置 WECOM_AGENT_ID，无法发送应用消息 markdown')
  }
  const uid = String(touser || '').trim()
  if (!uid) {
    throw new Error('缺少接收人 userid')
  }
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${encodeURIComponent(token)}`
  const content = truncateUtf8Bytes(markdownContent || '', 4096)
  const body = {
    touser: uid,
    msgtype: 'markdown',
    agentid,
    markdown: { content },
    safe: 0,
    enable_id_trans: 0
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('message/send(markdown) 失败', j))
  }
  return true
}

/** 企微文档：视频临时素材约 10MB；普通文件约 20MB */
const TEMP_VIDEO_MAX_BYTES = 10 * 1024 * 1024
const TEMP_FILE_MAX_BYTES = 20 * 1024 * 1024

/**
 * 上传本地视频为临时素材（media/upload type=video）
 * @param {string} absoluteFilePath
 * @returns {Promise<string>} media_id
 */
async function uploadTempMediaVideo(absoluteFilePath) {
  const resolved = path.resolve(String(absoluteFilePath || '').trim())
  if (!fs.existsSync(resolved)) {
    throw new Error(`视频文件不存在: ${resolved}`)
  }
  const st = fs.statSync(resolved)
  if (!st.isFile()) {
    throw new Error(`不是文件: ${resolved}`)
  }
  if (st.size > TEMP_VIDEO_MAX_BYTES) {
    throw new Error(
      `视频超过企业微信临时素材上限（约 10MB），当前 ${Math.round(st.size / 1024 / 1024)}MB，请先压缩或改用可下载链接`
    )
  }
  const token = await getAccessToken()
  const urlPath = `/cgi-bin/media/upload?access_token=${encodeURIComponent(token)}&type=video`
  const form = new FormData()
  form.append('media', fs.createReadStream(resolved), {
    filename: path.basename(resolved) || 'video.mp4'
  })

  const j = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'qyapi.weixin.qq.com',
        port: 443,
        path: urlPath,
        method: 'POST',
        headers: form.getHeaders()
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
    form.pipe(req)
  })

  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('media/upload(video) 失败', j))
  }
  if (!j.media_id) {
    throw new Error('media/upload 未返回 media_id')
  }
  return j.media_id
}

/**
 * 上传本地文件为临时素材（media/upload type=file，约 20MB）
 * @param {string} absoluteFilePath
 * @returns {Promise<string>} media_id
 */
async function uploadTempMediaFile(absoluteFilePath) {
  const resolved = path.resolve(String(absoluteFilePath || '').trim())
  if (!fs.existsSync(resolved)) {
    throw new Error(`文件不存在: ${resolved}`)
  }
  const st = fs.statSync(resolved)
  if (!st.isFile()) {
    throw new Error(`不是文件: ${resolved}`)
  }
  if (st.size > TEMP_FILE_MAX_BYTES) {
    throw new Error(
      `文件超过企业微信临时素材上限（约 20MB），当前 ${Math.round(st.size / 1024 / 1024)}MB`
    )
  }
  if (st.size < 5) {
    throw new Error('文件过小，企微要求大于 5 字节')
  }
  const token = await getAccessToken()
  const urlPath = `/cgi-bin/media/upload?access_token=${encodeURIComponent(token)}&type=file`
  const form = new FormData()
  form.append('media', fs.createReadStream(resolved), {
    filename: path.basename(resolved) || 'video.mp4'
  })

  const j = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'qyapi.weixin.qq.com',
        port: 443,
        path: urlPath,
        method: 'POST',
        headers: form.getHeaders()
      },
      (res) => {
        const chunks = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
          } catch (e) {
            reject(e)
          }
        })
      }
    )
    req.on('error', reject)
    form.pipe(req)
  })

  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('media/upload(file) 失败', j))
  }
  if (!j.media_id) {
    throw new Error('media/upload(file) 未返回 media_id')
  }
  return j.media_id
}

async function sendAppChatFile(chatid, mediaId) {
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${encodeURIComponent(token)}`
  const body = {
    chatid: String(chatid).trim(),
    msgtype: 'file',
    file: {
      media_id: String(mediaId).trim()
    }
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('appchat/send(file) 失败', j))
  }
  return true
}

/**
 * 群发会话发送视频消息（需先 uploadTempMediaVideo）
 * @param {string} chatid
 * @param {string} mediaId
 * @param {{ title?: string, description?: string }} [opts]
 */
async function sendAppChatVideo(chatid, mediaId, opts) {
  const token = await getAccessToken()
  const url = `https://qyapi.weixin.qq.com/cgi-bin/appchat/send?access_token=${encodeURIComponent(token)}`
  const o = opts && typeof opts === 'object' ? opts : {}
  const video = { media_id: String(mediaId).trim() }
  if (o.title) video.title = String(o.title).slice(0, 128)
  if (o.description) video.description = String(o.description).slice(0, 512)
  const body = {
    chatid: String(chatid).trim(),
    msgtype: 'video',
    video
  }
  const j = await httpsPostJson(url, body)
  if (j.errcode != null && j.errcode !== 0) {
    throw new Error(formatQyApiError('appchat/send(video) 失败', j))
  }
  return true
}

module.exports = {
  isAppChatConfigured,
  isApplicationMessageConfigured,
  getApplicationAgentId,
  getAccessToken,
  createAppChat,
  updateAppChatAddMembers,
  sendAppChatMarkdown,
  sendAppChatTextCard,
  sendApplicationTextCardToUser,
  sendApplicationMarkdownToUser,
  sendAppChatVideo,
  sendAppChatFile,
  uploadTempMediaVideo,
  uploadTempMediaFile,
  truncateChatName,
  TEMP_VIDEO_MAX_BYTES,
  TEMP_FILE_MAX_BYTES
}
