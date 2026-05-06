/**
 * 命令行执行与前台「简历拆解提取」相同的批量逻辑。
 *
 * 用法（在 ai_backend 目录）：
 *   node scripts/run-resume-batch-root.js "E:\toubiao\某项目文件夹"
 * 遍历该根下所有子目录（任意深度）且各目录内直接含有 .docx 的文件夹，逐一跑批：
 *   node scripts/run-resume-batch-root.js "F:\toubiao" --recursive
 *
 * 依赖：已配置 .env 中 DATABASE_URL（入库脚本）；本机可执行 python；AI 见 ai_key/ai_url/ai_model、RESUME_EXTRACT_USE_AI。
 */
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const {
  resolveAndValidateRoot,
  runResumeBatchScan,
} = require('../server/services/resumeBatchScanService')

async function main () {
  const argv = process.argv.slice(2)
  const recursive = argv.includes('--recursive')
  const root = argv.find((a) => a && !a.startsWith('--'))
  if (!root) {
    console.error('用法: node scripts/run-resume-batch-root.js <根文件夹绝对路径> [--recursive]')
    process.exit(1)
  }
  const abs = resolveAndValidateRoot(root)
  await runResumeBatchScan(
    abs,
    { onLine: (s) => console.log(s) },
    { recursiveUnits: recursive },
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
