#!/usr/bin/env node
/**
 * 初始化售前视频发牌表（需已执行 manual_presales_video_group_deck.sql）
 * 用法：node scripts/init-presales-video-group-deck.js
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const prisma = require(path.join(__dirname, '../server/utils/prisma'))
const dealService = require(path.join(__dirname, '../server/services/presalesVideoGroupDealService'))

async function main() {
  const peek = await dealService.peekNextDeal(prisma)
  console.log('[init-presales-video-group-deck] 发牌状态已就绪')
  console.log(JSON.stringify(peek, null, 2))
}

main()
  .catch((e) => {
    console.error('[init-presales-video-group-deck] 失败:', e.message || e)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await prisma.$disconnect()
    } catch {
      /* ignore */
    }
  })
