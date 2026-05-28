/**
 * 查看一表通全量 AI 分析进度
 * 用法: node scripts/check-yibiatong-analysis-progress.js
 */
const fs = require('fs')
const path = require('path')

const dir = path.join(__dirname, '../data/yibiatong-concerns-analysis')
const totalBatches = 33
const totalItems = 1626

function findLatestProgress() {
  if (!fs.existsSync(dir)) return null
  const files = fs.readdirSync(dir).filter(f => f.startsWith('ai_progress_') && f.endsWith('.json'))
  if (!files.length) return null
  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs)
  return path.join(dir, files[0])
}

const progressFile = findLatestProgress()
if (!progressFile) {
  console.log('未找到进度文件 ai_progress_*.json')
  console.log('目录:', dir)
  process.exit(0)
}

const data = JSON.parse(fs.readFileSync(progressFile, 'utf8'))
const done = data.completedBatches || 0
const valuable = (data.valuable || []).length
const high = (data.valuable || []).filter(v => v.value === 'high').length
const pct = ((done / totalBatches) * 100).toFixed(1)
const updated = data.updatedAt ? new Date(data.updatedAt) : null
const ago = updated ? Math.round((Date.now() - updated.getTime()) / 1000) : null

console.log('=== 一表通 AI 分析进度 ===\n')
console.log('进度文件:', progressFile)
console.log('')
console.log(`批次进度:  ${done} / ${totalBatches}  (${pct}%)`)
console.log(`问题总量:  ${data.totalItems || totalItems} 条（规则预筛客户问）`)
console.log(`已认定有价值: ${valuable} 条（高价值 ${high}，中价值 ${valuable - high}）`)
if (updated) {
  console.log(`最后更新:  ${updated.toLocaleString('zh-CN')}  (${ago} 秒前)`)
  if (ago > 180) {
    console.log('\n⚠ 超过 3 分钟无更新，可能正在等待 AI 响应，或进程已中断。')
    console.log('  可检查是否有 node 进程: Get-Process node | Where-Object {$_.StartTime -gt (Get-Date).AddHours(-2)}')
  } else {
    console.log('\n✓ 任务仍在推进（每批约 1～3 分钟，批间日志才会写入 run_full.log）')
  }
}
console.log('')
if (done >= totalBatches) {
  const fullJson = fs.readdirSync(dir).find(f => f.includes('_full.json'))
  const fullXlsx = fs.readdirSync(dir).find(f => f.includes('_full.xlsx'))
  console.log('状态: 已完成')
  if (fullJson) console.log('  JSON:', path.join(dir, fullJson))
  if (fullXlsx) console.log('  Excel:', path.join(dir, fullXlsx))
} else {
  const remain = totalBatches - done
  console.log(`状态: 进行中，预计还剩约 ${remain}～${remain * 2} 分钟`)
}
