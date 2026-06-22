/**
 * 售前视频 push · 关联人员包（参与人 + 直属上级 + rxkf01 + 发牌固定成员）
 */
const { v4: uuidv4 } = require('uuid')
const presalesVideoGroupDealService = require('./presalesVideoGroupDealService')
const logger = require('../utils/logger')

/** 企微群群主 / 必选入群；固定 rxkf01，不参与发牌（与 PRESALES_VIDEO_RXKF_USERID 无关） */
const GROUP_OWNER_USERID = presalesVideoGroupDealService.GROUP_OWNER_USERID

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

function getExcludeUserIdsFromEnv() {
  const raw = process.env.PRESALES_VIDEO_GROUP_EXCLUDE_USERIDS
  if (raw == null || String(raw).trim() === '') return []
  return parseUserIds(String(raw))
}

function applyExcludedUsers(userIds) {
  const excludes = new Set(getExcludeUserIdsFromEnv())
  if (excludes.size === 0) return userIds
  return (userIds || []).filter((u) => !excludes.has(String(u || '').trim()))
}

function diffExcludedUsers(before, after) {
  const keep = new Set((after || []).map((x) => String(x || '').trim()).filter(Boolean))
  return (before || []).filter((x) => {
    const id = String(x || '').trim()
    return id && !keep.has(id)
  })
}

function splitParticipantNames(raw) {
  return String(raw || '')
    .split(/[，,、;；\n\r]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function resolveParticipantNamesToUserIds(prisma, names) {
  const unique = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))]
  if (unique.length === 0) return []
  const rows = await prisma.org_user.findMany({
    where: {
      user_name: { in: unique },
      is_deleted: false
    },
    select: { user_id: true, user_name: true }
  })
  const seen = new Set()
  const out = []
  for (const row of rows) {
    const uid = row.user_id && String(row.user_id).trim()
    if (!uid || seen.has(uid)) continue
    seen.add(uid)
    out.push(uid)
  }
  return out
}

/** 参与人各自直属上级（仅一层） */
async function collectDirectLeaderUserIds(prisma, participantUserIds) {
  const ids = [...new Set((participantUserIds || []).map((u) => String(u || '').trim()).filter(Boolean))]
  if (ids.length === 0) return []
  const rows = await prisma.org_user.findMany({
    where: { user_id: { in: ids }, is_deleted: false },
    select: { user_id: true, leader_id: true }
  })
  const leaders = new Set()
  for (const row of rows) {
    const lid = row.leader_id ? String(row.leader_id).trim() : ''
    if (lid) leaders.add(lid)
  }
  return [...leaders]
}

/**
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {object|null} ctx.report
 * @param {string[]} ctx.fixedDealtIds 本步发牌固定成员（审计 role=fixed_dealt）
 * @param {string[]} ctx.fullFixedPool 全部固定成员（建群时全入）
 */
async function buildAssociationMemberMap(ctx) {
  const { prisma, report, fixedDealtIds, fullFixedPool } = ctx
  const roleByUser = new Map()
  const dealtSet = new Set((fixedDealtIds || []).map((u) => String(u || '').trim()).filter(Boolean))

  const add = (uid, role) => {
    const id = String(uid || '').trim()
    if (!id) return
    if (!roleByUser.has(id)) roleByUser.set(id, role)
  }

  add(GROUP_OWNER_USERID, 'rxkf01')

  let participants = []
  if (report && report.our_participants) {
    const names = splitParticipantNames(report.our_participants)
    try {
      participants = await resolveParticipantNamesToUserIds(prisma, names)
    } catch (e) {
      logger.warn(`[presales-video] 报备 our_participants 转 userid 失败: ${e && e.message}`)
    }
  }
  for (const uid of participants) add(uid, 'participant')

  const directLeaders = await collectDirectLeaderUserIds(prisma, participants)
  for (const uid of directLeaders) add(uid, 'direct_leader')

  for (const uid of fullFixedPool || []) add(uid, 'fixed_member')
  for (const uid of dealtSet) roleByUser.set(uid, 'fixed_dealt')

  let associationUserIds = [...roleByUser.keys()]
  const beforeExclude = [...associationUserIds]
  const afterExclude = applyExcludedUsers(beforeExclude)
  const excludedUserIds = diffExcludedUsers(beforeExclude, afterExclude)
  for (const uid of excludedUserIds) {
    roleByUser.delete(uid)
  }

  /** 群主必选入群，不受 PRESALES_VIDEO_GROUP_EXCLUDE_USERIDS 影响 */
  add(GROUP_OWNER_USERID, 'rxkf01')
  associationUserIds = [...roleByUser.keys()]

  return {
    roleByUser,
    participants,
    directLeaders,
    fixedDealtIds: [...dealtSet],
    associationUserIds,
    excludedUserIds
  }
}

/**
 * @param {object} ctx
 * @param {import('@prisma/client').PrismaClient} ctx.prisma
 * @param {object} ctx.transcription
 * @param {object|null} ctx.report
 * @param {string[]} ctx.fixedDealtIds
 * @param {string|string[]|null} [ctx.userIdsRaw] 手动提交；空则 auto
 */
async function buildPushMemberContext(ctx) {
  const { prisma, transcription, report, fixedDealtIds, userIdsRaw } = ctx
  const fromInput = parseUserIds(userIdsRaw)
  const pushSource = fromInput.length > 0 ? 'manual' : 'auto'

  const fullFixedPoolRaw = await presalesVideoGroupDealService.getFixedPoolFromSettings()
  const fullFixedPool = applyExcludedUsers(fullFixedPoolRaw)

  const fixedDealtForAudit = [...new Set((fixedDealtIds || []).map((u) => String(u || '').trim()).filter(Boolean))].filter(
    (u) => u !== GROUP_OWNER_USERID
  )

  const assoc = await buildAssociationMemberMap({
    prisma,
    report,
    fixedDealtIds: fixedDealtForAudit,
    fullFixedPool
  })

  let submittedUserIds
  if (pushSource === 'manual') {
    submittedUserIds = applyExcludedUsers(fromInput)
  } else {
    submittedUserIds = [...assoc.associationUserIds]
    if (!submittedUserIds.includes(GROUP_OWNER_USERID)) {
      submittedUserIds.push(GROUP_OWNER_USERID)
    }
    submittedUserIds = [...new Set(submittedUserIds.filter(Boolean))]
  }

  return {
    pushSource,
    transcription,
    report,
    ...assoc,
    fullFixedPool,
    suggestedSubmitUserIds: [...assoc.associationUserIds],
    submittedUserIds,
    groupOwnerUserId: GROUP_OWNER_USERID
  }
}

/**
 * 推断 wecom_action（不含已在群检测，由调用方合并）
 */
function inferWecomActions(memberCtx, { isNewChat, skipped60111 = [] } = {}) {
  const skipped = new Set(skipped60111 || [])
  const submittedSet = new Set(memberCtx.submittedUserIds || [])
  const assocSet = new Set(memberCtx.associationUserIds || [])
  const actions = new Map()

  for (const uid of assocSet) {
    if (!submittedSet.has(uid)) {
      actions.set(uid, 'not_submitted')
      continue
    }
    if (skipped.has(uid)) {
      actions.set(uid, 'skipped_invalid')
      continue
    }
    if (isNewChat) {
      actions.set(uid, 'create_in')
    } else {
      actions.set(uid, 'appended')
    }
  }

  for (const uid of submittedSet) {
    if (actions.has(uid)) continue
    if (skipped.has(uid)) {
      actions.set(uid, 'skipped_invalid')
    } else if (isNewChat) {
      actions.set(uid, 'create_in')
    } else {
      actions.set(uid, 'appended')
    }
  }

  return actions
}

/**
 * 写入 push 主记录与成员明细
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function writePushEventAndMembers(tx, opts) {
  const {
    transcriptionId,
    leadKey,
    chatid,
    isNewChat,
    memberCtx,
    deal,
    wecomSkipped60111,
    pushedAt
  } = opts
  const pushEventId = uuidv4()
  const at = pushedAt || new Date()
  const submittedSet = new Set(memberCtx.submittedUserIds || [])
  const actions = inferWecomActions(memberCtx, {
    isNewChat,
    skipped60111: wecomSkipped60111 || []
  })

  await tx.presales_video_push_events.create({
    data: {
      id: pushEventId,
      transcription_id: transcriptionId,
      lead_key: leadKey || null,
      chatid: chatid || null,
      is_new_chat: Boolean(isNewChat),
      push_source: memberCtx.pushSource,
      pushed_at: at,
      deal_round_id: deal.dealRoundId,
      deal_round: deal.dealRound,
      deal_step: deal.dealStep,
      deal_size: deal.dealSize,
      fixed_dealt_ids: deal.fixedDealtIds,
      deck_order_snapshot: deal.deckOrder,
      association_user_ids: memberCtx.associationUserIds,
      submitted_user_ids: memberCtx.submittedUserIds
    }
  })

  const memberRows = []
  const seen = new Set()

  for (const [uid, role] of memberCtx.roleByUser.entries()) {
    seen.add(uid)
    memberRows.push({
      id: uuidv4(),
      push_event_id: pushEventId,
      user_id: uid,
      role,
      in_association: true,
      in_submitted: submittedSet.has(uid),
      wecom_action: actions.get(uid) || (submittedSet.has(uid) ? 'not_submitted' : 'not_submitted'),
      pushed_at: at
    })
  }

  for (const uid of memberCtx.submittedUserIds || []) {
    if (seen.has(uid)) continue
    seen.add(uid)
    memberRows.push({
      id: uuidv4(),
      push_event_id: pushEventId,
      user_id: uid,
      role: 'manual_extra',
      in_association: false,
      in_submitted: true,
      wecom_action: actions.get(uid) || 'appended',
      pushed_at: at
    })
  }

  if (memberRows.length > 0) {
    await tx.presales_video_push_members.createMany({ data: memberRows })
  }

  return { pushEventId }
}

module.exports = {
  GROUP_OWNER_USERID,
  parseUserIds,
  applyExcludedUsers,
  splitParticipantNames,
  resolveParticipantNamesToUserIds,
  collectDirectLeaderUserIds,
  buildAssociationMemberMap,
  buildPushMemberContext,
  inferWecomActions,
  writePushEventAndMembers
}
