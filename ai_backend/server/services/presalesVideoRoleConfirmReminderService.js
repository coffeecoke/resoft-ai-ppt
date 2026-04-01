/**
 * 角色确认超时提醒：流水线长期处于「角色确认中」时，按固定间隔向卡片接收人重复发企微提醒，直至对方确认。
 * 间隔（分钟）由环境变量配置，默认 30。
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const logger = require('../utils/logger')
const { getWeComBotClient } = require('./wecomBotService')
const presalesVideoTaskService = require('./presalesVideoTaskService')

const prisma = new PrismaClient()

const DEFAULT_INTERVAL_MINUTES = 30
const DEFAULT_REMINDER_TEXT = '您好，需要尽快点击卡片确认，交流对话中的人员'

/**
 * 提醒间隔（分钟）：首次在发卡片后满该间隔发第 1 条，之后每隔该间隔再发，直到流水线离开「角色确认中」。
 * 优先读 PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_INTERVAL_MINUTES，未配则兼容旧名 AFTER_MINUTES。
 */
function reminderIntervalMinutes() {
  const interval = parseInt(process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_INTERVAL_MINUTES || '', 10)
  const after = parseInt(process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_AFTER_MINUTES || '', 10)
  if (Number.isFinite(interval) && interval > 0) return interval
  if (Number.isFinite(after) && after > 0) return after
  return DEFAULT_INTERVAL_MINUTES
}

function reminderMarkdown(transcriptionLabel) {
  const base =
    process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_TEXT != null &&
    String(process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_TEXT).trim() !== ''
      ? String(process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_TEXT).trim()
      : DEFAULT_REMINDER_TEXT
  if (transcriptionLabel && String(transcriptionLabel).trim()) {
    return `**售前视频 · 说话人确认提醒**\n\n${base}\n\n关联录音：${String(transcriptionLabel).trim()}`
  }
  return `**售前视频 · 说话人确认提醒**\n\n${base}`
}

/**
 * 扫描并发送超时提醒（由 app 定时器调用）
 */
async function tickRoleConfirmReminders() {
  if (
    process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_DISABLED != null &&
    String(process.env.PRESALES_VIDEO_ROLE_CONFIRM_REMINDER_DISABLED).trim().toLowerCase() === 'true'
  ) {
    return
  }

  const bot = getWeComBotClient()
  if (!bot || !bot.isConnected()) {
    return
  }

  const minutes = reminderIntervalMinutes()
  const cutoff = new Date(Date.now() - minutes * 60 * 1000)
  const status = presalesVideoTaskService.PipelineStatus.ROLE_CONFIRMING

  const rows = await prisma.presales_video_tasks.findMany({
    where: {
      pipeline_status: status,
      OR: [
        {
          role_confirm_reminder_sent_at: null,
          OR: [
            { role_confirm_card_sent_at: { lte: cutoff } },
            { AND: [{ role_confirm_card_sent_at: null }, { updated_at: { lte: cutoff } }] }
          ]
        },
        { role_confirm_reminder_sent_at: { lte: cutoff } }
      ]
    },
    take: 40,
    include: {
      transcription: {
        select: { id: true, created_by: true, name: true, original_file_name: true }
      }
    }
  })

  for (const row of rows) {
    const wxFromRow =
      row.role_confirm_wecom_userid != null && String(row.role_confirm_wecom_userid).trim()
        ? String(row.role_confirm_wecom_userid).trim()
        : ''
    const wxFromTr =
      row.transcription?.created_by != null && String(row.transcription.created_by).trim()
        ? String(row.transcription.created_by).trim()
        : ''
    const wxUser = wxFromRow || wxFromTr
    if (!wxUser) {
      logger.warn(
        `[presales-video] 角色确认超时提醒跳过 transcription=${row.transcription_id}：无 userid`
      )
      continue
    }

    const label =
      (row.transcription?.original_file_name && String(row.transcription.original_file_name).trim()) ||
      (row.transcription?.name && String(row.transcription.name).trim()) ||
      row.transcription_id

    const md = reminderMarkdown(label)
    try {
      await bot.sendMsg(wxUser, md, 'text')
      await prisma.presales_video_tasks.update({
        where: { id: row.id },
        data: { role_confirm_reminder_sent_at: new Date() }
      })
      logger.info(
        `[presales-video] 角色确认提醒已发送 transcription=${row.transcription_id} -> ${wxUser}（间隔 ${minutes} 分钟重复直至确认）`
      )
    } catch (e) {
      logger.warn(
        `[presales-video] 角色确认超时提醒发送失败 transcription=${row.transcription_id} -> ${wxUser}:`,
        e.message || e
      )
    }
  }
}

module.exports = {
  tickRoleConfirmReminders,
  reminderIntervalMinutes,
  /** @deprecated 请用 reminderIntervalMinutes；行为相同 */
  reminderAfterMinutes: reminderIntervalMinutes
}
