/**
 * 合并对话解析与导出（与语音转写页「再次合并 > AI修正 > 第一次合并 > 原始」优先级一致）
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const path = require('path')
const fs = require('fs').promises

const prisma = new PrismaClient()

const NOTE_REMerged = '再次合并对话'
const NOTE_AI = 'AI错别字修正'
const NOTE_MERGE = '合并相邻同一说话人的对话'

async function findLatestAdjustment(transcriptionId, note1) {
  return prisma.dialogue_adjustments.findFirst({
    where: { transcription_id: transcriptionId, note1 },
    orderBy: { created_at: 'desc' }
  })
}

function parseDialogues(raw) {
  if (!raw) return []
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

/**
 * @returns {Promise<{ transcription: object, dialogues: object[], source: string }|null>}
 */
async function resolveMergedDialoguesForTranscription(transcriptionId) {
  const transcription = await prisma.transcriptions.findUnique({
    where: { id: transcriptionId }
  })
  if (!transcription) return null

  let source = 'original'
  let dialogues = []

  const re = await findLatestAdjustment(transcriptionId, NOTE_REMerged)
  if (re?.adjusted_dialogues) {
    dialogues = parseDialogues(re.adjusted_dialogues)
    if (dialogues.length) source = 'remerged'
  }
  if (!dialogues.length) {
    const ai = await findLatestAdjustment(transcriptionId, NOTE_AI)
    if (ai?.adjusted_dialogues) {
      dialogues = parseDialogues(ai.adjusted_dialogues)
      if (dialogues.length) source = 'ai_corrected'
    }
  }
  if (!dialogues.length) {
    const m = await findLatestAdjustment(transcriptionId, NOTE_MERGE)
    if (m?.adjusted_dialogues) {
      dialogues = parseDialogues(m.adjusted_dialogues)
      if (dialogues.length) source = 'merged'
    }
  }
  if (!dialogues.length && transcription.dialogues) {
    dialogues = parseDialogues(transcription.dialogues)
    source = 'original'
  }

  return { transcription, dialogues, source }
}

function uniqueSpeakers(dialogues) {
  const set = new Set()
  for (const d of dialogues) {
    const s = d.speaker ?? d.role
    if (s != null && String(s).trim()) set.add(String(s).trim())
  }
  return [...set]
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '-'
  const s = Math.floor(Number(seconds))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDateTime(d) {
  if (!d) return '-'
  const x = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(x.getTime())) return '-'
  return x.toLocaleString('zh-CN', { hour12: false })
}

function buildMergedDialogueTxt(transcription, dialogues) {
  const speakerList = uniqueSpeakers(dialogues)
  let content = '语音转文本结果\n\n'
  content += `转录时间: ${formatDateTime(transcription.created_at)}\n`
  content += `说话人数: ${speakerList.length}\n`
  content += `对话数量: ${dialogues.length}\n`
  content += `音频时长: ${formatDuration(transcription.audio_duration)}\n\n`
  content += `${'='.repeat(50)}\n\n`

  for (const d of dialogues) {
    const timeRange = d.timeRange || d.startTime || ''
    const speaker = d.speaker || d.role || '未知说话人'
    const text = d.text || d.correctedText || d.originalText || ''
    if (timeRange) {
      content += `[${timeRange}] 【${speaker}】\n${text}\n\n`
    } else {
      content += `【${speaker}】\n${text}\n\n`
    }
  }
  return content
}

function buildSafeTxtFilename(displayName) {
  let raw = (displayName && String(displayName).trim()) || ''
  raw = raw.replace(/^.*[/\\]/, '')
  if (!raw) {
    return `转录结果_${Date.now()}.txt`
  }
  const stem = raw.replace(
    /\.(mp3|wav|m4a|flac|aac|wma|ogg|mp4|avi|mov|mkv|flv|wmv|webm|3gp|3g2|txt)$/i,
    ''
  )
  const base = (stem.trim() || raw)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .substring(0, 180)
  return `${base || `转录结果_${Date.now()}`}.txt`
}

/**
 * 曾有过「合并」或「再次合并」步骤的转录 ID（去重）
 */
async function listTranscriptionIdsWithMergeStep() {
  const rows = await prisma.dialogue_adjustments.findMany({
    where: {
      note1: { in: [NOTE_MERGE, NOTE_REMerged] },
      adjusted_dialogues: { not: null }
    },
    select: { transcription_id: true }
  })
  return [...new Set(rows.map((r) => r.transcription_id).filter(Boolean))]
}

/**
 * @param {string} dir - 绝对或相对目录
 * @param {string} fileName - 安全文件名
 * @param {string} utf8Content
 * @returns {Promise<string>} 写入后的绝对路径
 */
async function writeDialogueFile(dir, fileName, utf8Content) {
  const absDir = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir)
  await fs.mkdir(absDir, { recursive: true })
  const absPath = path.join(absDir, fileName)
  await fs.writeFile(absPath, utf8Content, 'utf8')
  return absPath
}

module.exports = {
  resolveMergedDialoguesForTranscription,
  uniqueSpeakers,
  buildMergedDialogueTxt,
  buildSafeTxtFilename,
  listTranscriptionIdsWithMergeStep,
  writeDialogueFile,
  NOTE_MERGE,
  NOTE_REMerged
}
