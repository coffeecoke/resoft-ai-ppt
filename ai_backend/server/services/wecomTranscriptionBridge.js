/**
 * 企业微信机器人收到的音频 → 讯飞转录 → transcriptions 表，created_by = 企微 userid
 */
const path = require('path')
const fs = require('fs').promises
const transcriptionService = require('./transcriptionService')
const { getUploadBaseDir } = require('../utils/pathHelper')

const AUDIO_EXT = new Set([
  '.mp3',
  '.wav',
  '.m4a',
  '.flac',
  '.aac',
  '.wma',
  '.ogg',
  '.amr',
  '.silk',
  '.opus'
])

function isAudioFilePath(filePath) {
  const ext = path.extname(filePath || '').toLowerCase()
  return AUDIO_EXT.has(ext)
}

function normalizeCreatedBy(userid) {
  const s = userid != null ? String(userid).trim() : ''
  if (!s || s === '-') return null
  return s.length <= 50 ? s : s.slice(0, 50)
}

function senderLabelFromBody(b) {
  const from = b.from || {}
  const name = from.name != null ? String(from.name).trim() : ''
  const uid = from.userid != null ? String(from.userid).trim() : ''
  if (name && uid) return `${name}_${uid}`
  return uid || name || 'unknown'
}

/**
 * 下载后的音频文件走讯飞转录并落库
 * @param {object} opts
 * @param {string} opts.absoluteAudioPath
 * @param {string} [opts.createdByUserId] 企微 from.userid
 * @param {string} [opts.originalFileName]
 * @param {string} [opts.displayName] transcriptions.name
 */
async function transcribeWecomAudioAndSave({
  absoluteAudioPath,
  createdByUserId,
  originalFileName,
  displayName
}) {
  const createdBy = normalizeCreatedBy(createdByUserId)
  const result = await transcriptionService.transcribeAudio(absoluteAudioPath)
  const st = await fs.stat(absoluteAudioPath)
  const baseName = originalFileName || path.basename(absoluteAudioPath)
  return transcriptionService.saveTranscription({
    name: displayName || baseName,
    originalFileName: baseName,
    audioFilePath: absoluteAudioPath,
    audioFileSize: st.size,
    audioFormat:
      result.audioFormat || path.extname(absoluteAudioPath).replace(/^\./, '').toLowerCase() || 'unknown',
    audioDuration: result.audioDuration ?? null,
    resultFilePath: result.resultFilePath || null,
    dialogues: result.dialogues || [],
    fullText: result.fullText || null,
    speakerCount: result.speakerCount || 0,
    createdBy
  })
}

/**
 * 仅收到企微自带语音识别文案（无音频文件）时落库：占位文件 + 单说话人对话
 */
async function saveWecomVoiceAsrOnly({ text, createdByUserId, msgid, body }) {
  const createdBy = normalizeCreatedBy(createdByUserId)
  const label = senderLabelFromBody(body || {})
  const base = getUploadBaseDir()
  const dir = path.join(base, 'wecom_bot', 'voice_asr_placeholder')
  await fs.mkdir(dir, { recursive: true })
  const safeId = String(msgid || `t${Date.now()}`).replace(/[^\w-]/g, '_').slice(0, 80)
  const artifactPath = path.join(dir, `${safeId}_wecom_asr.txt`)
  const fileBody = `[企微语音识别]\n${text}`
  await fs.writeFile(artifactPath, fileBody, 'utf8')
  const dialogues = [{ timeRange: '00:00-00:00', speaker: 'SPEAKER_1', text: String(text).trim() }]
  return transcriptionService.saveTranscription({
    name: `企微语音_${label}`,
    originalFileName: `wecom_voice_${safeId}.txt`,
    audioFilePath: artifactPath,
    audioFileSize: Buffer.byteLength(fileBody, 'utf8'),
    audioFormat: 'wecom_asr',
    audioDuration: null,
    resultFilePath: null,
    dialogues,
    fullText: String(text).trim(),
    speakerCount: 1,
    createdBy
  })
}

function wecomTranscriptionEnabled() {
  if (process.env.WECOM_DISABLE_TRANSCRIPTION === '1' || process.env.WECOM_DISABLE_TRANSCRIPTION === 'true') {
    return false
  }
  return true
}

module.exports = {
  isAudioFilePath,
  normalizeCreatedBy,
  transcribeWecomAudioAndSave,
  saveWecomVoiceAsrOnly,
  senderLabelFromBody,
  wecomTranscriptionEnabled
}
