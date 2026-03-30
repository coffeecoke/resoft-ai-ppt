/**
 * 默认消息处理（与 saler-agent/src/main.ts 行为一致）
 * 接收资源保存目录基于 UPLOAD_BASE_DIR/wecom_bot/received/
 */
const fs = require('fs').promises
const path = require('path')
const { getUploadBaseDir } = require('../utils/pathHelper')
const { getLogger } = require('./logger')
const wecomTranscriptionBridge = require('../services/wecomTranscriptionBridge')
const wecomCommunicationReportService = require('../services/wecomCommunicationReportService')

/**
 * 从 frame.body 提取发送方信息，便于日志区分「谁、在哪个会话」发的。
 * chat_type: 文档里常见 1=单聊 2=群聊；缺省按单聊展示。
 */
function describeSender(b) {
  const from = b.from || {}
  const userid = from.userid != null ? String(from.userid).trim() : ''
  const name = from.name != null ? String(from.name).trim() : ''
  const chatid = b.chatid != null ? String(b.chatid).trim() : ''
  const ct = b.chat_type
  const isGroup = ct === 2 || ct === '2'
  const scene = isGroup ? '群聊' : '单聊'
  const who =
    name && userid ? `${name}<${userid}>` : userid || name || '(未知发送者)'
  return {
    scene,
    isGroup,
    chatid: chatid || '-',
    userid: userid || '-',
    name: name || '-',
    msgid: b.msgid != null ? String(b.msgid) : '-',
    /** 单行摘要，直接拼进日志 */
    line: `${scene} chatid=${chatid || '-'} sender=${who} msgid=${b.msgid != null ? b.msgid : '-'}`
  }
}

function previewText(s, max = 120) {
  const t = String(s || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** 落库 transcriptions.created_by = 企微 from.userid（50 字内） */
function getCreatedByUserId(b) {
  const from = b.from || {}
  const u = from.userid != null ? String(from.userid).trim() : ''
  return u || null
}

function trim255(s) {
  const t = String(s || '')
  return t.length <= 255 ? t : `${t.slice(0, 251)}…`
}

function resourceAesKey(frame, fromField) {
  if (fromField && fromField.aeskey) return fromField.aeskey
  const fallback =
    process.env.WECOM_RESOURCE_AESKEY ||
    process.env.WECOM_ENCODING_AES_KEY ||
    process.env.WECOM_CALLBACK_ENCODING_AES_KEY
  return (fallback && String(fallback).trim()) || null
}

function bodyOf(frame) {
  return frame.body || {}
}

function sanitizeFileBasename(name, fallbackStem, defaultSuffix) {
  let base = String(name).replace(/^.*[/\\]/, '').trim() || ''
  base = base.replace(/[\x00-\x1f<>:"/\\|?*]/g, '_').replace(/\s+$/g, '')
  const extMatch = base.match(/(\.[a-zA-Z0-9]{1,10})$/)
  const ext = extMatch ? extMatch[1] : defaultSuffix
  let stem = extMatch ? base.slice(0, -ext.length) : base
  stem = stem.replace(/\.+$/g, '').trim()
  if (!stem || /^[_.\s-]+$/.test(stem)) {
    stem = String(fallbackStem).replace(/[^\w.-]/g, '_').slice(0, 80) || `file_${Date.now()}`
  }
  const dotExt = ext.startsWith('.') ? ext : `.${ext}`
  const out = `${stem}${dotExt}`
  return out.length > 200 ? `${stem.slice(0, 100)}${dotExt}` : out
}

async function saveDecrypted(dir, msgid, defaultSuffix, filenameHint, buffer) {
  await fs.mkdir(dir, { recursive: true })
  const fallbackStem = String(msgid ?? `t${Date.now()}`).replace(/[^\w-]/g, '_')
  const base =
    (filenameHint && String(filenameHint).trim()) ||
    `${fallbackStem}${defaultSuffix.startsWith('.') ? defaultSuffix : `.${defaultSuffix}`}`
  const safe = sanitizeFileBasename(
    base,
    fallbackStem,
    defaultSuffix.startsWith('.') ? defaultSuffix : `.${defaultSuffix}`
  )
  const savePath = path.join(dir, safe)
  await fs.writeFile(savePath, buffer)
  return savePath
}

function createDeduper() {
  const seenMsgIds = new Set()
  return function dedupe(msgid) {
    if (!msgid) return false
    if (seenMsgIds.has(msgid)) return true
    seenMsgIds.add(msgid)
    if (seenMsgIds.size > 5000) {
      const it = seenMsgIds.values()
      for (let i = 0; i < 1000; i++) seenMsgIds.delete(it.next().value)
    }
    return false
  }
}

function getReceivedDirs() {
  const root = path.join(getUploadBaseDir(), 'wecom_bot', 'received')
  return {
    images: path.join(root, 'images'),
    files: path.join(root, 'files'),
    videos: path.join(root, 'videos'),
    audio: path.join(root, 'audio')
  }
}

/** @param {object} client WeComBotClient 实例 */
function registerDefaultMessageHandlers(client) {
  const log = getLogger()
  const dedupe = createDeduper()
  const { images: DIR_IMAGES, files: DIR_FILES, videos: DIR_VIDEOS, audio: DIR_AUDIO } = getReceivedDirs()

  async function downloadResource(url, aeskey, msgid, dir, defaultSuffix, bodyFilename) {
    const { buffer, filename } = await client.downloadFile(url, aeskey)
    const hint = (bodyFilename && String(bodyFilename).trim()) || (filename && String(filename).trim())
    const p = await saveDecrypted(dir, msgid, defaultSuffix, hint, buffer)
    return { bytes: buffer.length, path: p }
  }

  /**
   * 音频文件落盘后：讯飞转录 + transcriptions，created_by = 企微 userid
   */
  async function transcribeSavedAudioAndReply(client, frame, who, b, savedPath, originalFileName) {
    const uid = getCreatedByUserId(b)
    if (!wecomTranscriptionBridge.wecomTranscriptionEnabled()) {
      log.info(`[wecom-bot] 已跳过转录（WECOM_DISABLE_TRANSCRIPTION）| ${who.line}`)
      await client.replyText(
        frame,
        `已收到音频（${path.basename(savedPath)}），当前已关闭自动转录。`
      )
      return
    }
    try {
      const label = trim255(`企微_${wecomTranscriptionBridge.senderLabelFromBody(b)}`)
      const row = await wecomTranscriptionBridge.transcribeWecomAudioAndSave({
        absoluteAudioPath: savedPath,
        createdByUserId: uid,
        originalFileName: originalFileName || path.basename(savedPath),
        displayName: label
      })
      log.info(`[wecom-bot] 转录落库成功 id=${row.id} created_by=${uid || '(空)'} | ${who.line}`)
      await client.replyText(
        frame,
        `转录已完成，记录 id：${row.id}${uid ? `，已关联发送人 ${uid}` : ''}`
      )
    } catch (e) {
      log.error(`[wecom-bot] 转录失败 | ${who.line}`, e)
      await client.replyText(
        frame,
        `音频已保存，转录失败：${(e && e.message) || String(e)}`
      )
    }
  }

  client.onMessage('text', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][text] 重复消息已忽略 | ${who.line}`)
      return
    }
    const text = (b.text && b.text.content && String(b.text.content).trim()) || ''
    const quote = b.quote
    let quoteHint = ''
    if (quote && quote.msgtype === 'text' && quote.text && quote.text.content) {
      quoteHint = ` [引用: ${String(quote.text.content).slice(0, 80)}…]`
    }
    if (!text && !quoteHint) return
    log.info(`[wecom-bot][recv][text] ${who.line} | content=${previewText(text || quoteHint)}`)

    if (text && wecomCommunicationReportService.isWecomCommunicationReportTemplate(text)) {
      try {
        const r = await wecomCommunicationReportService.ingestWecomCommunicationReport({
          rawText: text,
          wecomMsgId: b.msgid != null ? String(b.msgid) : null,
          wecomUserId: getCreatedByUserId(b),
          senderLabel:
            who.name !== '-' && who.userid !== '-'
              ? `${who.name}<${who.userid}>`
              : who.userid !== '-'
                ? who.userid
                : who.name
        })
        if (r.duplicate) {
          await client.replyText(
            frame,
            `该交流报备已收录（报备 id：${r.reportId}），无需重复提交。`
          )
          return
        }
        if (r.ok && r.reportId) {
          await client.replyText(
            frame,
            `交流报备已生成 JSON 并入库。\n报备 id：${r.reportId}\n快照：${r.jsonPath || '-'}`
          )
          return
        }
      } catch (e) {
        log.error(`[wecom-bot][recv][text] 交流报备处理失败 | ${who.line}`, e)
        await client.replyText(
          frame,
          `交流报备解析/入库失败：${(e && e.message) || String(e)}（原文仍可按普通文本处理请重试或联系管理员）`
        )
        return
      }
    }

    await client.replyText(frame, `收到文本${quoteHint}：${text || '(仅引用)'}`)
  })

  client.onMessage('image', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][image] 重复消息已忽略 | ${who.line}`)
      return
    }
    const image = b.image || {}
    const aes = resourceAesKey(frame, image)
    if (!image.url || !aes) {
      log.warn(`[wecom-bot][recv][image] 缺 url 或密钥 | ${who.line}`)
      await client.replyText(
        frame,
        '图片缺少 url 或解密密钥；若回调体无 aeskey，请配置 WECOM_RESOURCE_AESKEY（与回调加解密 AESKey 一致）'
      )
      return
    }
    try {
      const { bytes, path: savedPath } = await downloadResource(image.url, aes, b.msgid, DIR_IMAGES, '.png')
      log.info(`[wecom-bot][recv][image] ${who.line} | bytes=${bytes} saved=${savedPath}`)
      await client.replyText(frame, `已收到图片（${bytes} 字节），已保存到 wecom_bot/received/images`)
    } catch (e) {
      log.error(`[wecom-bot][recv][image] 下载失败 | ${who.line}`, e)
      await client.replyText(frame, '图片下载或解密失败（url 约 5 分钟内有效）')
    }
  })

  client.onMessage('file', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][file] 重复消息已忽略 | ${who.line}`)
      return
    }
    const file = b.file || {}
    const aes = resourceAesKey(frame, file)
    if (!file.url || !aes) {
      log.warn(`[wecom-bot][recv][file] 缺 url 或密钥 | ${who.line}`)
      await client.replyText(frame, '文件缺少 url 或解密密钥，请配置 WECOM_RESOURCE_AESKEY')
      return
    }
    try {
      const bodyName = file.filename
      const hintExt = bodyName ? path.extname(String(bodyName)).toLowerCase() : ''
      const defaultSuffix =
        wecomTranscriptionBridge.isAudioFilePath(`x${hintExt}`) && hintExt ? hintExt : '.bin'
      const saveDir = wecomTranscriptionBridge.isAudioFilePath(`x${hintExt}`) ? DIR_AUDIO : DIR_FILES
      const { bytes, path: savedPath } = await downloadResource(
        file.url,
        aes,
        b.msgid,
        saveDir,
        defaultSuffix,
        bodyName
      )
      log.info(
        `[wecom-bot][recv][file] ${who.line} | name=${bodyName || '?'} bytes=${bytes} saved=${savedPath}`
      )
      if (wecomTranscriptionBridge.isAudioFilePath(savedPath)) {
        await transcribeSavedAudioAndReply(client, frame, who, b, savedPath, bodyName)
      } else {
        await client.replyText(frame, `已收到文件（${bytes} 字节），已保存到 wecom_bot/received/files`)
      }
    } catch (e) {
      log.error(`[wecom-bot][recv][file] 下载失败 | ${who.line}`, e)
      await client.replyText(frame, '文件下载或解密失败')
    }
  })

  client.onMessage('video', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][video] 重复消息已忽略 | ${who.line}`)
      return
    }
    const video = b.video || {}
    const aes = resourceAesKey(frame, video)
    if (!video.url || !aes) {
      log.warn(`[wecom-bot][recv][video] 缺 url 或密钥 | ${who.line}`)
      await client.replyText(frame, '视频缺少 url 或解密密钥，请配置 WECOM_RESOURCE_AESKEY')
      return
    }
    try {
      const { bytes, path: savedPath } = await downloadResource(video.url, aes, b.msgid, DIR_VIDEOS, '.mp4')
      log.info(`[wecom-bot][recv][video] ${who.line} | bytes=${bytes} saved=${savedPath}`)
      await client.replyText(frame, `已收到视频（${bytes} 字节），已保存到 wecom_bot/received/videos`)
    } catch (e) {
      log.error(`[wecom-bot][recv][video] 下载失败 | ${who.line}`, e)
      await client.replyText(frame, '视频下载或解密失败')
    }
  })

  client.onMessage('voice', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][voice] 重复消息已忽略 | ${who.line}`)
      return
    }
    const v = b.voice || {}
    const uid = getCreatedByUserId(b)
    const aes = resourceAesKey(frame, v)

    if (v.url && aes) {
      const extFromName = v.filename ? path.extname(String(v.filename)).toLowerCase() : ''
      const defaultSuffix =
        extFromName && extFromName.length > 1 ? extFromName : '.amr'
      try {
        const { bytes, path: savedPath } = await downloadResource(
          v.url,
          aes,
          b.msgid,
          DIR_AUDIO,
          defaultSuffix,
          v.filename
        )
        log.info(`[wecom-bot][recv][voice] ${who.line} | bytes=${bytes} saved=${savedPath}`)
        await transcribeSavedAudioAndReply(client, frame, who, b, savedPath, v.filename)
      } catch (e) {
        log.error(`[wecom-bot][recv][voice] 下载/转录 | ${who.line}`, e)
        await client.replyText(frame, `语音文件处理失败：${(e && e.message) || String(e)}`)
      }
      return
    }

    const content = (v.content && String(v.content).trim()) || ''
    if (content && wecomTranscriptionBridge.wecomTranscriptionEnabled()) {
      try {
        const row = await wecomTranscriptionBridge.saveWecomVoiceAsrOnly({
          text: content,
          createdByUserId: uid,
          msgid: b.msgid,
          body: b
        })
        log.info(
          `[wecom-bot][recv][voice] 企微ASR文案落库 id=${row.id} created_by=${uid || '(空)'} | ${who.line}`
        )
        await client.replyText(
          frame,
          `已生成转录记录 id：${row.id}${uid ? `，发送人 ${uid}` : ''}。摘要：${previewText(content, 100)}`
        )
      } catch (e) {
        log.error(`[wecom-bot][recv][voice] ASR 落库失败 | ${who.line}`, e)
        await client.replyText(frame, `收到语音（识别）：${content}`)
      }
      return
    }

    log.info(`[wecom-bot][recv][voice] ${who.line} | asr=${previewText(content, 200)}`)
    await client.replyText(
      frame,
      content ? `收到语音（识别）：${content}` : '收到语音（无识别文本且无可用音频下载链接）'
    )
  })

  client.onMessage('mixed', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][mixed] 重复消息已忽略 | ${who.line}`)
      return
    }
    const mixed = b.mixed || {}
    const items = mixed.msg_item || []
    const textParts = []
    let imageCount = 0
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (it.msgtype === 'text' && it.text && it.text.content) {
        textParts.push(it.text.content)
      }
      if (it.msgtype === 'image') {
        const img = it.image || {}
        const aes = img.aeskey || resourceAesKey(frame, img)
        if (img.url && aes) {
          try {
            await downloadResource(img.url, aes, `${String(b.msgid)}_${i}`, DIR_IMAGES, '.png')
            imageCount++
          } catch (e) {
            log.error(`[wecom-bot][recv][mixed] 子图下载失败 | ${who.line} idx=${i}`, e)
          }
        }
      }
    }
    const summary = [
      textParts.length ? `文本：${textParts.join(' / ')}` : '',
      imageCount ? `图片 ${imageCount} 张已保存 wecom_bot/received/images` : ''
    ]
      .filter(Boolean)
      .join('；')
    log.info(
      `[wecom-bot][recv][mixed] ${who.line} | textParts=${textParts.length} imagesSaved=${imageCount} | ${previewText(summary, 200)}`
    )
    await client.replyText(frame, summary || '收到图文混排（无文本或未解析到图片）')
  })

  client.onMessage('location', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    if (dedupe(b.msgid)) {
      log.info(`[wecom-bot][recv][location] 重复消息已忽略 | ${who.line}`)
      return
    }
    const loc = b.location || {}
    const label = loc.label || loc.name || '位置'
    const addr = loc.address || ''
    const lat = loc.latitude !== undefined && loc.latitude !== null ? loc.latitude : ''
    const lng = loc.longitude !== undefined && loc.longitude !== null ? loc.longitude : ''
    const line = [label, addr, lat !== '' && lng !== '' ? `${lat},${lng}` : ''].filter(Boolean).join(' ')
    log.info(`[wecom-bot][recv][location] ${who.line} | ${previewText(line, 200)}`)
    await client.replyText(frame, line ? `收到定位：${line}` : '收到定位消息。')
  })

  client.onMessage('stream', async (_data, frame) => {
    const b = bodyOf(frame)
    const who = describeSender(b)
    const streamId = b.stream && b.stream.id
    if (!streamId) {
      log.warn(`[wecom-bot][recv][stream] 缺少 stream.id | ${who.line}`)
      return
    }
    log.info(`[wecom-bot][recv][stream] ${who.line} | streamId=${streamId}`)
    try {
      await client.replyStream(
        frame,
        streamId,
        '（流式刷新已收到，此处为示例回复。可接大模型流式输出。）',
        true
      )
    } catch (e) {
      log.error(`[wecom-bot][recv][stream] replyStream 失败 | ${who.line}`, e)
    }
  })
}

module.exports = { registerDefaultMessageHandlers, getReceivedDirs, describeSender }
