/**
 * 命令行执行与前台「简历拆解提取」相同的批量逻辑。
 *
 * 用法（在 ai_backend 目录）：
 *   node scripts/run-resume-batch-root.js "E:\toubiao\某项目文件夹"
 *
 * 依赖：已配置 .env 中 DATABASE_URL（入库脚本）；本机可执行 python。
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const {
  resolveAndValidateRoot,
  runResumeBatchScan,
} = require('../server/services/resumeBatchScanService')

async function main () {
  const root = process.argv[2]
  if (!root) {
    console.error('用法: node scripts/run-resume-batch-root.js <根文件夹绝对路径>')
    process.exit(1)
  }
  const abs = resolveAndValidateRoot(root)
  await runResumeBatchScan(abs, { onLine: (s) => console.log(s) })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
