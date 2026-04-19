/**
 * 简历批量扫描/探测/抽取/入库（与 resumeBatchRoutes 前台跑批一致）
 */

const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const AI_BACKEND_ROOT = path.join(__dirname, '..', '..')
const RESUME_SCRIPT = path.join(AI_BACKEND_ROOT, 'python_services', 'resume_split', 'resume_split_extract.py')
const IMPORT_SCRIPT = path.join(AI_BACKEND_ROOT, 'scripts', 'import-bid-resume-records.js')

function resolveAndValidateRoot (input) {
  if (!input || typeof input !== 'string') throw new Error('请提供 rootPath（文件夹绝对路径）')
  const abs = path.resolve(input.trim())
  if (!fs.existsSync(abs)) throw new Error('路径不存在: ' + abs)
  const st = fs.statSync(abs)
  if (!st.isDirectory()) throw new Error('请提供文件夹路径，不是文件')
  const prefix = (process.env.RESUME_BATCH_ALLOWED_PREFIX || '').trim()
  if (prefix) {
    const preAbs = path.resolve(prefix)
    const a = abs.replace(/[/\\]+$/, '').toLowerCase()
    const b = preAbs.replace(/[/\\]+$/, '').toLowerCase()
    if (a !== b && !a.startsWith(b + path.sep)) {
      throw new Error(`出于安全限制，路径须在 RESUME_BATCH_ALLOWED_PREFIX 之下: ${preAbs}`)
    }
  }
  return abs
}

function collectFolderUnits (rootResolved) {
  const dirents = fs.readdirSync(rootResolved, { withFileTypes: true })
  const subs = dirents
    .filter((d) => d.isDirectory())
    .map((d) => path.join(rootResolved, d.name))
  if (subs.length > 0) return subs
  return [rootResolved]
}

function walkDocxFiles (dir, acc) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walkDocxFiles(full, acc)
    else if (e.isFile() && /\.docx$/i.test(e.name)) acc.push(full)
  }
  return acc
}

function listDocxSortedBySizeDesc (folderPath) {
  const paths = walkDocxFiles(folderPath, [])
  const withSize = []
  for (const f of paths) {
    try {
      const st = fs.statSync(f)
      withSize.push({ path: f, size: st.size })
    } catch (_) { /* skip */ }
  }
  withSize.sort((a, b) => b.size - a.size)
  return withSize
}

function spawnCmd (command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: AI_BACKEND_ROOT,
      env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8' },
      ...options,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString('utf8') })
    child.stderr.on('data', (d) => { stderr += d.toString('utf8') })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error((stderr || stdout || `进程退出码 ${code}`).trim().slice(0, 2000)))
    })
  })
}

function pythonExe () {
  return (process.env.PYTHON_EXE || process.env.PYTHON || 'python').trim() || 'python'
}

async function probeDocx (docxPath) {
  const { stdout } = await spawnCmd(pythonExe(), [RESUME_SCRIPT, '--probe-docx', docxPath])
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
  const line = lines[lines.length - 1]
  return JSON.parse(line)
}

async function extractDocx (docxPath) {
  const { stdout, stderr } = await spawnCmd(pythonExe(), [RESUME_SCRIPT, docxPath])
  const lines = stdout.trim().split(/\r?\n/).filter(Boolean)
  const line = lines[lines.length - 1]
  try {
    return JSON.parse(line)
  } catch {
    throw new Error('抽取脚本输出无法解析为 JSON: ' + (line || stderr).slice(0, 500))
  }
}

async function importManifest (manifestPath) {
  await spawnCmd(process.execPath, [IMPORT_SCRIPT, manifestPath])
}

/**
 * @param {string} rootResolved 已 resolve 的根目录
 * @param {{ onLine?: (s:string)=>void, onProgress?: (p:{percent:number,unitIndex:number,totalUnits:number,currentFolder:string})=>void }} hooks
 * @returns {Promise<{ results: object[], logs: string[] }>}
 */
async function runResumeBatchScan (rootResolved, hooks = {}) {
  const logs = []
  const log = (line) => {
    logs.push(line)
    if (hooks.onLine) hooks.onLine(line)
    else console.log(line)
  }
  const results = []

  log(`根目录: ${rootResolved}`)
  const units = collectFolderUnits(rootResolved)
  log(`共 ${units.length} 个文件夹待扫描（每夹内 .docx 按体积从大到小探测，命中简历后再抽取）`)

  for (let i = 0; i < units.length; i++) {
    const folder = units[i]
    const folderName = path.basename(folder)
    if (hooks.onProgress) {
      hooks.onProgress({
        percent: Math.round((i / Math.max(1, units.length)) * 95),
        unitIndex: i + 1,
        totalUnits: units.length,
        currentFolder: folderName,
      })
    }
    log(`—— 文件夹 [${i + 1}/${units.length}] ${folderName}`)

    const docList = listDocxSortedBySizeDesc(folder)
    if (!docList.length) {
      log('  无 .docx，跳过')
      results.push({ folder: folderName, action: 'skipped_no_docx' })
      continue
    }

    log(`  共 ${docList.length} 个 .docx，按体积从大到小依次探测简历大纲`)

    let picked = null
    let lastProbeOk = null
    for (let j = 0; j < docList.length; j++) {
      const item = docList[j]
      log(`  [${j + 1}/${docList.length}] 探测 ${path.basename(item.path)} (${Math.round(item.size / 1024 / 1024)} MB)`)
      let probe
      try {
        probe = await probeDocx(item.path)
      } catch (e) {
        log(`    探测失败: ${e.message}`)
        continue
      }
      lastProbeOk = probe
      if (probe.ok && probe.has_resume) {
        picked = item
        log('    → 含简历相关大纲，选用本文件做拆解')
        break
      }
      log('    → 无简历相关大纲，继续下一个较小文件')
    }

    if (!picked) {
      log('  已遍历本目录全部 .docx，均无简历相关大纲，跳过本文件夹')
      results.push({
        folder: folderName,
        action: 'skipped_no_resume',
        triedCount: docList.length,
        lastProbe: lastProbeOk,
      })
      continue
    }

    log(`  开始拆解抽取: ${path.basename(picked.path)}`)
    let out
    try {
      out = await extractDocx(picked.path)
    } catch (e) {
      log(`  抽取失败: ${e.message}`)
      results.push({ folder: folderName, action: 'error_extract', file: picked.path, detail: e.message })
      continue
    }

    if (!out.ok || !out.output_dir) {
      log('  抽取未返回 output_dir，跳过入库')
      results.push({ folder: folderName, action: 'error_extract', detail: JSON.stringify(out) })
      continue
    }

    const manifestPath = path.join(out.output_dir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) {
      log('  manifest.json 不存在，跳过入库')
      results.push({ folder: folderName, action: 'error_no_manifest', output_dir: out.output_dir })
      continue
    }

    try {
      await importManifest(manifestPath)
      log(`  已入库: ${manifestPath}`)
      results.push({
        folder: folderName,
        action: 'imported',
        file: picked.path,
        manifest: manifestPath,
        output_dir: out.output_dir,
      })
    } catch (e) {
      log(`  入库失败: ${e.message}`)
      results.push({ folder: folderName, action: 'error_import', detail: e.message })
    }
  }

  if (hooks.onProgress) {
    hooks.onProgress({
      percent: 100,
      unitIndex: units.length,
      totalUnits: units.length,
      currentFolder: '',
    })
  }
  log('=== 批量任务结束 ===')
  return { results, logs }
}

module.exports = {
  resolveAndValidateRoot,
  runResumeBatchScan,
  AI_BACKEND_ROOT,
}
