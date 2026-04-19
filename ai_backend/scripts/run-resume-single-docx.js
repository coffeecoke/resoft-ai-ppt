/**
 * 对单个 .docx 执行简历拆解 + 入库（不依赖「根目录多文件探测」逻辑）。
 *
 * 用法（在 ai_backend 目录）：
 *   node scripts/run-resume-single-docx.js "E:\path\to\某项目.docx"
 */
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
require('dotenv').config({ path: path.join(__dirname, '../.env') })

const AI_BACKEND_ROOT = path.join(__dirname, '..')
const RESUME_SCRIPT = path.join(AI_BACKEND_ROOT, 'python_services', 'resume_split', 'resume_split_extract.py')
const IMPORT_SCRIPT = path.join(AI_BACKEND_ROOT, 'scripts', 'import-bid-resume-records.js')

function spawnCmd (command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: AI_BACKEND_ROOT,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
    child.stderr.on('data', (d) => { stderr += d.toString('utf8') })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error((stderr || stdout || `exit ${code}`).trim().slice(0, 2000)))
    })
  })
}

function pythonExe () {
  return (process.env.PYTHON_EXE || process.env.PYTHON || 'python').trim() || 'python'
}

async function main () {
  const arg = (process.argv[2] || '').trim()
  if (!arg) {
    console.error('用法: node scripts/run-resume-single-docx.js <文件.docx 绝对路径>')
    process.exit(1)
  }
  const docx = path.resolve(arg)
  if (!fs.existsSync(docx) || !fs.statSync(docx).isFile()) {
    console.error('文件不存在或不是文件:', docx)
    process.exit(1)
  }
  if (!/\.docx$/i.test(docx)) {
    console.error('请提供 .docx 文件')
    process.exit(1)
  }
  const prefix = (process.env.RESUME_BATCH_ALLOWED_PREFIX || '').trim()
  if (prefix) {
    const preAbs = path.resolve(prefix)
    const a = docx.replace(/[/\\]+$/, '').toLowerCase()
    const b = preAbs.replace(/[/\\]+$/, '').toLowerCase()
    if (a !== b && !a.startsWith(b + path.sep)) {
      console.error('出于安全限制，文件须在 RESUME_BATCH_ALLOWED_PREFIX 之下:', preAbs)
      process.exit(1)
    }
  }

  console.log('拆解:', docx)
  const { stdout } = await spawnCmd(pythonExe(), [RESUME_SCRIPT, docx])
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
  const line = lines[lines.length - 1]
  let out
  try {
    out = JSON.parse(line)
  } catch (e) {
    console.error('抽取输出无法解析:', (line || '').slice(0, 800))
    process.exit(1)
  }
  if (!out.ok || !out.output_dir) {
    console.error('抽取失败:', JSON.stringify(out).slice(0, 1500))
    process.exit(1)
  }
  const manifestPath = path.join(out.output_dir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    console.error('缺少 manifest:', manifestPath)
    process.exit(1)
  }
  console.log('入库:', manifestPath)
  await spawnCmd(process.execPath, [IMPORT_SCRIPT, manifestPath])
  console.log('完成。output_dir=', out.output_dir)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
