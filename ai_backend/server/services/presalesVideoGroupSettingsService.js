const fs = require('fs').promises
const path = require('path')

const SETTINGS_PATH = path.join(__dirname, '../config/presalesVideoGroupSettings.json')
const DEFAULT_SETTINGS = {
  fixedMembers: [],
  leadChats: {}
}

function normalizeUserIds(input) {
  const arr = Array.isArray(input)
    ? input
    : String(input || '')
      .split(/[,，、;；\s]+/)
      .map((s) => s.trim())
  return [...new Set(arr.map((x) => String(x || '').trim()).filter(Boolean))]
}

async function ensureParentDir() {
  await fs.mkdir(path.dirname(SETTINGS_PATH), { recursive: true })
}

async function readSettings() {
  try {
    const raw = await fs.readFile(SETTINGS_PATH, 'utf8')
    const parsed = JSON.parse(raw)
    const fixedMembers = normalizeUserIds(parsed && parsed.fixedMembers)
    const leadChats =
      parsed && parsed.leadChats && typeof parsed.leadChats === 'object' ? parsed.leadChats : {}
    return {
      fixedMembers,
      leadChats
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function writeSettings(next) {
  await ensureParentDir()
  const data = {
    fixedMembers: normalizeUserIds(next && next.fixedMembers),
    leadChats: next && next.leadChats && typeof next.leadChats === 'object' ? next.leadChats : {}
  }
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2), 'utf8')
  return data
}

async function updateFixedMembers(input) {
  const current = await readSettings()
  current.fixedMembers = normalizeUserIds(input)
  return writeSettings(current)
}

function makeLeadKey(report) {
  if (report && report.lead_id) return `lead_id:${String(report.lead_id).trim()}`
  if (report && report.lead_name) return `lead_name:${String(report.lead_name).trim()}`
  if (report && report.id) return `report_id:${String(report.id).trim()}`
  return ''
}

async function getLeadChatByKey(leadKey) {
  const key = String(leadKey || '').trim()
  if (!key) return null
  const settings = await readSettings()
  return settings.leadChats[key] || null
}

async function setLeadChatByKey(leadKey, value) {
  const key = String(leadKey || '').trim()
  if (!key) return
  const settings = await readSettings()
  if (!settings.leadChats || typeof settings.leadChats !== 'object') {
    settings.leadChats = {}
  }
  settings.leadChats[key] = {
    chatid: value && value.chatid ? String(value.chatid).trim() : '',
    name: value && value.name ? String(value.name).trim() : '',
    updatedAt: new Date().toISOString()
  }
  await writeSettings(settings)
}

async function removeLeadChatByKey(leadKey) {
  const key = String(leadKey || '').trim()
  if (!key) return false
  const settings = await readSettings()
  if (!settings.leadChats || typeof settings.leadChats !== 'object') {
    return false
  }
  if (!settings.leadChats[key]) return false
  delete settings.leadChats[key]
  await writeSettings(settings)
  return true
}

module.exports = {
  readSettings,
  writeSettings,
  updateFixedMembers,
  makeLeadKey,
  getLeadChatByKey,
  setLeadChatByKey,
  removeLeadChatByKey,
  normalizeUserIds
}
