#!/usr/bin/env node
/**
 * 本地调试：拉「线索完整信息」接口并打印摘要字段（与企微群头 6 行一致）。
 * 规则（与 presalesVideoWecomPushService.resolveClueSummary 一致）：
 *   - 阶段：followUpList 里时间最新一条的 XSJD，空则「日常跟进」；无 followUpList 或 clue 为空时亦为「日常跟进」
 *   - 221信息：followUpLogList 全部 ACTIONTYPE，中文逗号拼接；无则暂无
 *
 * 必传（二选一）：
 *   1) 命令行第一个参数：线索编号 xsbh（与 communication_reports.lead_code / lead_id 一致）
 *   2) 环境变量 TEST_XSBH
 *
 * 依赖 .env（与线上推送相同）：
 *   PRESALES_VIDEO_CLUE_FULL_INFO_URL   例如 http://host/api/getClueFullInfo（脚本会追加 ?xsbh=）
 *   PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY  请求头 X-API-Key
 *   PRESALES_VIDEO_CLUE_FULL_INFO_TIMEOUT_MS 可选，默认 5000
 *
 * 可选：
 *   VERBOSE=1 或 命令行加 --verbose  打印完整 clueRaw（可能很大）
 *
 * 用法：
 *   node scripts/test-clue-221-info.js 3110000006260007
 *   npm run test:clue-221 -- 3110000006260007
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const { resolveClueSummary } = require('../server/services/presalesVideoWecomPushService')

function usage() {
  console.error(`
用法:
  node scripts/test-clue-221-info.js <线索编号xsbh>
  或: TEST_XSBH=<线索编号> node scripts/test-clue-221-info.js

环境变量（.env）:
  PRESALES_VIDEO_CLUE_FULL_INFO_URL       必填，GET 接口基址
  PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY   必填，X-API-Key
  PRESALES_VIDEO_CLUE_FULL_INFO_TIMEOUT_MS 可选

可选: VERBOSE=1 或加 --verbose 输出完整 clueRaw JSON
`)
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--verbose')
  const verbose =
    process.env.VERBOSE === '1' || process.env.VERBOSE === 'true' || process.argv.includes('--verbose')
  const xsbh = (argv[0] || process.env.TEST_XSBH || '').trim()
  if (!xsbh) {
    usage()
    process.exit(1)
  }
  const url = String(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_URL || '').trim()
  const key = String(process.env.PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY || '').trim()
  if (!url || !key) {
    console.error('缺少环境变量: PRESALES_VIDEO_CLUE_FULL_INFO_URL 或 PRESALES_VIDEO_CLUE_FULL_INFO_API_KEY')
    usage()
    process.exit(1)
  }

  console.log('请求线索编号 xsbh =', xsbh)
  console.log('PRESALES_VIDEO_CLUE_FULL_INFO_URL =', url)

  const report = { lead_code: xsbh }
  const summary = await resolveClueSummary(report)
  if (!summary) {
    console.error('resolveClueSummary 返回 null（xsbh 为空或不应发生）')
    process.exit(2)
  }

  console.log('\n======== 221信息（info221）========')
  console.log(summary.info221)

  console.log('\n======== 摘要其它字段（不含 clueRaw）========')
  const { clueRaw, ...rest } = summary
  console.log(JSON.stringify(rest, null, 2))

  if (verbose && clueRaw) {
    console.log('\n======== clueRaw（完整）========')
    try {
      console.log(JSON.stringify(clueRaw, null, 2))
    } catch (e) {
      console.log(String(clueRaw))
    }
  } else if (clueRaw) {
    console.log('\n（clueRaw 已省略，需完整 JSON 请加 --verbose 或 VERBOSE=1）')
  } else {
    console.log('\n（接口未返回可解析对象，clueRaw 为空）')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(99)
})
