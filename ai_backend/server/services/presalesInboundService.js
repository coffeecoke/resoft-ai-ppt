/**
 * 售前报备 HTTP 接入：远程/本地音频落盘 + 转录入库，与 wecom 报备解析复用同一套落库逻辑
 */
const fs = require('fs').promises
const fsSync = require('fs')
const path = require('path')
const http = require('http')
const https = require('https')
const { URL, fileURLToPath } = require('url')
const { v4: uuidv4 } = require('uuid')
const prisma = require('../utils/prisma')
const transcriptionService = require('./transcriptionService')
const {
  coerceReportPayloadToDbRow,
  persistInboundCommunicationReport
} = require('./wecomCommunicationReportService')
const { getUploadBaseDir, toRelativePath } = require('../utils/pathHelper')


function getInboundAudioDir() {
  const env = process.env.PRESALES_INBOUND_AUDIO_DIR
  if (env != null && String(env).trim() !== '') {
    return path.resolve(String(env).trim())
  }
  return path.join(getUploadBaseDir(), 'presales_inbound', 'audio')
}

function getMaxBytes() {
  const n = parseInt(process.env.PRESALES_INBOUND_AUDIO_MAX_BYTES || '', 10)
  if (Number.isFinite(n) && n > 0) return n
  return 500 * 1024 * 1024
}

function inferExtFromUrl(urlStr) {
  try {
    const p = new URL(urlStr).pathname
    const e = path.extname(p)
    return e || '.mp3'
  } catch {
    return '.mp3'
  }
}

function isPathInsideDir(filePath, dirPath) {
  const f = path.resolve(filePath)
  const d = path.resolve(dirPath)
  if (f === d) return true
  const prefix = d.endsWith(path.sep) ? d : d + path.sep
  return f.startsWith(prefix)
}

/**
 * HTTP(S) 下载到目标文件（含重定向，单文件大小上限）
 */
function downloadHttpToFile(urlStr, destPath, maxBytes, redirectLeft = 5) {
  if (redirectLeft < 0) {
    return Promise.reject(new Error('重定向次数过多'))
  }
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(urlStr)
    } catch {
      return reject(new Error('无效的音频 URL'))
    }
    const lib = parsed.protocol === 'https:' ? https : http
    const file = fsSync.createWriteStream(destPath)
    let received = 0

    const cleanupFail = (err) => {
      file.close(() => {
        fs.unlink(destPath).catch(() => {})
        reject(err)
      })
    }

    const req = lib.get(urlStr, { timeout: 600000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(() => {
          fs.unlink(destPath)
            .catch(() => {})
            .then(() => {
              const next = new URL(res.headers.location, urlStr).href
              downloadHttpToFile(next, destPath, maxBytes, redirectLeft - 1).then(resolve).catch(reject)
            })
        })
        return
      }
      if (res.statusCode !== 200) {
        return cleanupFail(new Error(`下载失败 HTTP ${res.statusCode}`))
      }
      const len = res.headers['content-length']
      if (len && parseInt(len, 10) > maxBytes) {
        res.resume()
        return cleanupFail(new Error('远程文件超过大小上限'))
      }
      res.on('data', (chunk) => {
        received += chunk.length
        if (received > maxBytes) {
          res.destroy()
          file.destroy()
          fs.unlink(destPath).catch(() => {})
          reject(new Error('下载超过大小上限'))
        }
      })
      res.pipe(file)
      file.on('finish', () => file.close(() => resolve()))
    })
    req.on('error', (e) => cleanupFail(e))
    req.on('timeout', () => {
      req.destroy()
      cleanupFail(new Error('下载超时'))
    })
  })
}

/**
 * 将远程路径对应文件拷贝/下载到入站音频目录
 * @param {string} remotePath http(s) URL、file://、本机绝对路径、或相对 UPLOAD_BASE_DIR 的路径
 * @param {string} [originalFileName] 用于保留扩展名
 */
async function fetchRemoteAudioToInboundDir(remotePath, originalFileName) {
  const destDir = getInboundAudioDir()
  await fs.mkdir(destDir, { recursive: true })
  const trimmed = String(remotePath || '').trim()
  if (!trimmed) throw new Error('audioRemotePath 为空')

  const extFromName = originalFileName ? path.extname(String(originalFileName)) : ''
  const destExt = extFromName || inferExtFromUrl(trimmed)
  const destName = `${Date.now()}_${uuidv4().slice(0, 8)}${destExt}`
  const destAbs = path.join(destDir, destName)
  const maxBytes = getMaxBytes()

  if (/^https?:\/\//i.test(trimmed)) {
    await downloadHttpToFile(trimmed, destAbs, maxBytes)
    return destAbs
  }

  let localSrc = trimmed
  if (trimmed.startsWith('file://')) {
    localSrc = fileURLToPath(trimmed)
  }

  if (path.isAbsolute(localSrc)) {
    const stat = await fs.stat(localSrc).catch(() => null)
    if (!stat || !stat.isFile()) throw new Error('本地音频路径不存在或不是文件')
    if (stat.size > maxBytes) throw new Error('本地音频超过大小上限')
    await fs.copyFile(localSrc, destAbs)
    return destAbs
  }

  const base = getUploadBaseDir()
  const resolved = path.resolve(path.join(base, localSrc))
  if (!isPathInsideDir(resolved, base)) {
    throw new Error('相对路径仅能位于 UPLOAD_BASE_DIR 之下')
  }
  const stat = await fs.stat(resolved).catch(() => null)
  if (!stat || !stat.isFile()) throw new Error('音频文件不存在')
  if (stat.size > maxBytes) throw new Error('本地音频超过大小上限')
  await fs.copyFile(resolved, destAbs)
  return destAbs
}

/**
 * 解析报备入库 → 拉取音频 → 转录 → 写 transcriptions → 回写报备备注
 */
async function runReportAndTranscribe({ reportPayload, audioRemotePath, originalFileName, createdBy }) {
  const { dbRow, structured, rawText, warnings } = coerceReportPayloadToDbRow(reportPayload)
  const extraReportNote =
    warnings && warnings.length ? `解析提示：${warnings.join('；')}` : null

  const { reportId, snapshotRel } = await persistInboundCommunicationReport({
    dbRow,
    structured,
    rawText,
    createdBy,
    extraReportNote
  })

  const localAudioPath = await fetchRemoteAudioToInboundDir(audioRemotePath, originalFileName)

  const result = await transcriptionService.transcribeAudio(localAudioPath)
  let st
  try {
    st = await fs.stat(localAudioPath)
  } catch {
    st = { size: 0 }
  }
  const baseName =
    originalFileName != null && String(originalFileName).trim() !== ''
      ? path.basename(String(originalFileName))
      : path.basename(localAudioPath)

  const cust =
    dbRow.customer_name && !String(dbRow.customer_name).startsWith('（未')
      ? dbRow.customer_name
      : null

  const transcription = await transcriptionService.saveTranscription({
    name: cust ? `${cust}_${baseName}` : baseName,
    originalFileName: baseName,
    audioFilePath: localAudioPath,
    audioFileSize: result.audioFileSize != null ? result.audioFileSize : st.size,
    audioFormat:
      path.extname(localAudioPath).replace('.', '') ||
      path.extname(baseName).replace('.', '') ||
      '',
    audioDuration: result.audioDuration ?? null,
    resultFilePath: null,
    dialogues: result.dialogues,
    fullText: result.fullText,
    speakerCount: result.speakerCount,
    customerName: cust,
    createdBy: createdBy != null ? String(createdBy) : null
  })

  const relAudio = toRelativePath(localAudioPath)
  const append = `【接口接入】关联转录ID: ${transcription.id}\n本地音频(相对上传根): ${relAudio || localAudioPath}`

  const current = await prisma.communication_reports.findUnique({
    where: { id: reportId },
    select: { report_note: true }
  })
  await prisma.communication_reports.update({
    where: { id: reportId },
    data: {
      report_note: [current && current.report_note, append].filter(Boolean).join('\n')
    }
  })

  return {
    reportId,
    snapshotRel,
    transcriptionId: transcription.id,
    localAudioPath,
    warnings: warnings || []
  }
}

module.exports = {
  getInboundAudioDir,
  fetchRemoteAudioToInboundDir,
  runReportAndTranscribe
}
