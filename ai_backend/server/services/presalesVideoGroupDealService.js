/**
 * 售前视频 · 固定成员全局发牌（洗牌 + 3,3,2,2,2 或按 N 自动生成 pattern）
 */
const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const presalesVideoGroupSettingsService = require('./presalesVideoGroupSettingsService')
const logger = require('../utils/logger')

const DECK_STATE_ID = 'global'
const ROUND_STEPS = 5
/** 企微 appchat 群主 / 必选入群成员，固定 rxkf01（与 PRESALES_VIDEO_RXKF_USERID「发送给小R」无关） */
const GROUP_OWNER_USERID = 'rxkf01'

function parseJsonArray(val) {
  if (val == null) return []
  if (Array.isArray(val)) return val.map((x) => String(x || '').trim()).filter(Boolean)
  try {
    const p = typeof val === 'string' ? JSON.parse(val) : val
    return Array.isArray(p) ? p.map((x) => String(x || '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

/** 从配置读取固定池（不含 rxkf01） */
async function getFixedPoolFromSettings() {
  const settings = await presalesVideoGroupSettingsService.readSettings()
  const all = presalesVideoGroupSettingsService.normalizeUserIds(settings.fixedMembers || [])
  return all.filter((u) => u && u !== GROUP_OWNER_USERID)
}

/**
 * @param {number} poolSize
 * @returns {number[]}
 */
function buildDealPattern(poolSize) {
  const N = Number(poolSize)
  if (!Number.isFinite(N) || N < 1) {
    throw new Error('固定成员池为空，无法发牌')
  }
  if (N < ROUND_STEPS) {
    return Array.from({ length: N }, () => 1)
  }
  const base = Math.floor(N / ROUND_STEPS)
  const rem = N % ROUND_STEPS
  return Array.from({ length: ROUND_STEPS }, (_, i) => base + (i < rem ? 1 : 0))
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function roundStepsForPattern(pattern) {
  return (pattern || []).filter((n) => Number(n) > 0).length
}

function arraysEqual(a, b) {
  const x = [...(a || [])].sort()
  const y = [...(b || [])].sort()
  if (x.length !== y.length) return false
  for (let i = 0; i < x.length; i++) {
    if (x[i] !== y[i]) return false
  }
  return true
}

async function lockDeckState(tx) {
  const existing = await tx.presales_video_group_deck_state.findUnique({
    where: { id: DECK_STATE_ID },
    select: { id: true }
  })
  if (existing) {
    await tx.$executeRaw`SELECT id FROM presales_video_group_deck_state WHERE id = ${DECK_STATE_ID} FOR UPDATE`
  }
}

async function getNextDealRoundNumber(tx) {
  const agg = await tx.presales_video_group_deck_rounds.aggregate({
    _max: { deal_round: true }
  })
  const max = agg._max.deal_round
  return (max != null ? Number(max) : 0) + 1
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {{ fixedPool: string[], triggerReason: string }} opts
 */
async function createNewDeckRound(tx, opts) {
  const fixedPool = [...new Set((opts.fixedPool || []).filter(Boolean))]
  if (fixedPool.length < 1) {
    throw new Error('固定成员池为空，请在 video-batch-settings 配置 fixedMembers（除 rxkf01 外至少 1 人）')
  }
  const dealRoundNum = await getNextDealRoundNumber(tx)
  const deckOrder = shuffleArray(fixedPool)
  const dealPattern = buildDealPattern(fixedPool.length)
  const roundId = uuidv4()
  const now = new Date()

  await tx.presales_video_group_deck_rounds.updateMany({
    where: { status: 'active' },
    data: { status: 'completed', completed_at: now }
  })

  await tx.presales_video_group_deck_rounds.create({
    data: {
      id: roundId,
      deal_round: dealRoundNum,
      pool_size: fixedPool.length,
      fixed_pool: fixedPool,
      deck_order: deckOrder,
      deal_pattern: dealPattern,
      status: 'active',
      trigger_reason: opts.triggerReason || 'init',
      shuffled_at: now
    }
  })

  await tx.presales_video_group_deck_state.upsert({
    where: { id: DECK_STATE_ID },
    create: {
      id: DECK_STATE_ID,
      active_round_id: roundId,
      deal_step: 0,
      deck_cursor: 0
    },
    update: {
      active_round_id: roundId,
      deal_step: 0,
      deck_cursor: 0
    }
  })

  return { roundId, dealRoundNum, deckOrder, dealPattern, fixedPool }
}

/**
 * 确保 deck 已初始化；固定池变更则新开一轮
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} prisma
 */
async function ensureDeckInitialized(prisma) {
  const fixedPool = await getFixedPoolFromSettings()
  const run = async (tx) => {
    await lockDeckState(tx).catch(() => {
      /* 首次无行 */
    })
    let state = await tx.presales_video_group_deck_state.findUnique({
      where: { id: DECK_STATE_ID },
      include: { active_round: true }
    })
    if (!state || !state.active_round) {
      await createNewDeckRound(tx, { fixedPool, triggerReason: 'init' })
      state = await tx.presales_video_group_deck_state.findUnique({
        where: { id: DECK_STATE_ID },
        include: { active_round: true }
      })
      return state
    }
    const roundPool = parseJsonArray(state.active_round.fixed_pool)
    if (!arraysEqual(roundPool, fixedPool)) {
      logger.info(
        `[presales-video-deal] 固定池变更，新开一轮 old=${roundPool.length} new=${fixedPool.length}`
      )
      await createNewDeckRound(tx, { fixedPool, triggerReason: 'pool_changed' })
      state = await tx.presales_video_group_deck_state.findUnique({
        where: { id: DECK_STATE_ID },
        include: { active_round: true }
      })
    }
    return state
  }

  if (typeof prisma.$transaction === 'function') {
    return prisma.$transaction(run)
  }
  return run(prisma)
}

function buildPeekFromState(state) {
  const round = state.active_round
  const deckOrder = parseJsonArray(round.deck_order)
  const dealPattern = parseJsonArray(round.deal_pattern).map((n) => Number(n))
  const step = Number(state.deal_step) || 0
  const cursor = Number(state.deck_cursor) || 0
  const dealSize = dealPattern[step] != null ? Number(dealPattern[step]) : 0
  const fixedDealtIds =
    dealSize > 0 ? deckOrder.slice(cursor, cursor + dealSize) : []
  const stepsInRound = roundStepsForPattern(dealPattern)

  return {
    dealRound: round.deal_round,
    dealRoundId: round.id,
    dealStep: step,
    dealSize,
    fixedDealtIds,
    deckOrder,
    deckCursor: cursor,
    dealPattern,
    poolSize: round.pool_size,
    fixedPool: parseJsonArray(round.fixed_pool),
    stepsInRound,
    roundStatus: round.status
  }
}

async function peekNextDeal(prisma) {
  const state = await ensureDeckInitialized(prisma)
  return buildPeekFromState(state)
}

/**
 * 消耗下一步发牌（须在事务内调用，且已 lockDeckState）
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
async function consumeNextDeal(tx) {
  await lockDeckState(tx)
  const fixedPool = await getFixedPoolFromSettings()
  let state = await tx.presales_video_group_deck_state.findUnique({
    where: { id: DECK_STATE_ID },
    include: { active_round: true }
  })
  if (!state || !state.active_round) {
    await createNewDeckRound(tx, { fixedPool, triggerReason: 'init' })
    state = await tx.presales_video_group_deck_state.findUnique({
      where: { id: DECK_STATE_ID },
      include: { active_round: true }
    })
  } else {
    const roundPool = parseJsonArray(state.active_round.fixed_pool)
    if (!arraysEqual(roundPool, fixedPool)) {
      await createNewDeckRound(tx, { fixedPool, triggerReason: 'pool_changed' })
      state = await tx.presales_video_group_deck_state.findUnique({
        where: { id: DECK_STATE_ID },
        include: { active_round: true }
      })
    }
  }

  const peek = buildPeekFromState(state)
  if (peek.dealSize < 1) {
    throw new Error('发牌步长无效，请检查固定成员池与 deal_pattern')
  }

  const newCursor = peek.deckCursor + peek.dealSize
  let newStep = peek.dealStep + 1
  const pattern = peek.dealPattern
  const stepsInRound = roundStepsForPattern(pattern)

  if (newStep >= stepsInRound || newCursor >= peek.poolSize) {
    await tx.presales_video_group_deck_rounds.update({
      where: { id: peek.dealRoundId },
      data: { status: 'completed', completed_at: new Date() }
    })
    await createNewDeckRound(tx, { fixedPool, triggerReason: 'round_complete' })
  } else {
    await tx.presales_video_group_deck_state.update({
      where: { id: DECK_STATE_ID },
      data: { deal_step: newStep, deck_cursor: newCursor }
    })
  }

  const roundCompleted = newStep >= stepsInRound || newCursor >= peek.poolSize

  return {
    ...peek,
    consumed: true,
    roundCompleted
  }
}

/**
 * 企微同步失败时回滚最近一次 consume（仅支持本轮未结束发牌的情况）
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ dealStep: number, deckCursor: number, dealSize: number, roundCompleted?: boolean }} dealPeek
 */
async function rollbackDealConsume(prisma, dealPeek) {
  if (!dealPeek || dealPeek.roundCompleted) {
    logger.warn(
      '[presales-video-deal] 跳过发牌回滚：本轮已结束或缺少快照（需人工核对 deck_state）'
    )
    return { ok: false, skipped: true }
  }
  const step = Number(dealPeek.dealStep)
  const cursor = Number(dealPeek.deckCursor)
  if (!Number.isFinite(step) || !Number.isFinite(cursor)) {
    return { ok: false, skipped: true }
  }

  await prisma.$transaction(async (tx) => {
    await lockDeckState(tx)
    await tx.presales_video_group_deck_state.update({
      where: { id: DECK_STATE_ID },
      data: { deal_step: step, deck_cursor: cursor }
    })
  })

  logger.info(
    `[presales-video-deal] 已回滚发牌 consume step=${step} cursor=${cursor} size=${dealPeek.dealSize}`
  )
  return { ok: true }
}

async function getCurrentDeckPublic(prisma) {
  const peek = await peekNextDeal(prisma)
  return {
    dealRound: peek.dealRound,
    dealRoundId: peek.dealRoundId,
    dealStep: peek.dealStep,
    dealSize: peek.dealSize,
    nextFixedDealtPreview: peek.fixedDealtIds,
    deckOrder: peek.deckOrder,
    deckCursor: peek.deckCursor,
    dealPattern: peek.dealPattern,
    poolSize: peek.poolSize,
    fixedPool: peek.fixedPool,
    stepsInRound: peek.stepsInRound
  }
}

async function listDeckRounds(prisma, { page = 1, pageSize = 20 } = {}) {
  const take = Math.min(Math.max(Number(pageSize) || 20, 1), 100)
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take
  const [rows, total] = await Promise.all([
    prisma.presales_video_group_deck_rounds.findMany({
      orderBy: { deal_round: 'desc' },
      skip,
      take
    }),
    prisma.presales_video_group_deck_rounds.count()
  ])
  return { rows, total, page: Math.max(Number(page) || 1, 1), pageSize: take }
}

async function getDeckRoundByNumber(prisma, dealRound) {
  const n = Number(dealRound)
  if (!Number.isFinite(n)) return null
  return prisma.presales_video_group_deck_rounds.findUnique({
    where: { deal_round: n }
  })
}

module.exports = {
  GROUP_OWNER_USERID,
  ROUND_STEPS,
  getFixedPoolFromSettings,
  buildDealPattern,
  shuffleArray,
  ensureDeckInitialized,
  peekNextDeal,
  consumeNextDeal,
  rollbackDealConsume,
  getCurrentDeckPublic,
  listDeckRounds,
  getDeckRoundByNumber,
  parseJsonArray
}
