/**
 * 一次性校验：某 run_batch_id 在 bid_resume_* 中的行数
 * 用法: node scripts/check-resume-batch-in-db.js 20260418_171640
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('../../online-ppt-backend/node_modules/@prisma/client')

const batchId = process.argv[2]
if (!batchId) {
  console.error('用法: node scripts/check-resume-batch-in-db.js <run_batch_id>')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main () {
  if (!/^[a-zA-Z0-9_]+$/.test(batchId)) {
    console.error('run_batch_id 仅允许字母数字下划线')
    process.exit(1)
  }
  const r = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM bid_resume_records WHERE run_batch_id = '${batchId}'`
  )
  const p = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM bid_resume_persons WHERE run_batch_id = '${batchId}'`
  )
  const out = {
    batchId,
    bid_resume_records: Number(r[0].c),
    bid_resume_persons: Number(p[0].c),
  }
  console.log(JSON.stringify(out, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
