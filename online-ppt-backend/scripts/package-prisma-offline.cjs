/**
 * 离线发布用：将 Prisma 生成物打成 zip，便于在无外网生产机解压到 node_modules 下。
 * 包含：.prisma、@prisma（兼容 npm 扁平与 pnpm：.prisma 可能在 .pnpm/.../node_modules/.prisma）
 *
 * 用法（在 online-ppt-backend 目录）：
 *   pnpm install
 *   npx prisma generate
 *   pnpm run pack:prisma-offline
 *
 * 生产解压（在 online-ppt-backend 下）：
 *   unzip -o prisma-offline-node_modules-*.zip -d node_modules
 */

const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const AdmZip = require('adm-zip')

const root = path.join(__dirname, '..')
const nm = path.join(root, 'node_modules')
const outDir = path.join(root, 'dist')

function safeRealpath(p) {
  try {
    return fs.realpathSync(p)
  } catch {
    return p
  }
}

/** 判断是否为 Prisma 生成的 .prisma 目录（含 client 与引擎或入口） */
function isLikelyPrismaDot(dir) {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false
    const client = path.join(dir, 'client')
    if (!fs.existsSync(client) || !fs.statSync(client).isDirectory()) return false
    const names = fs.readdirSync(client)
    if (names.length === 0) return false
    return names.some(
      (n) =>
        n.endsWith('.js') ||
        n.endsWith('.mjs') ||
        n.endsWith('.node') ||
        n.includes('query_engine') ||
        n.includes('libquery_engine')
    )
  } catch {
    return false
  }
}

/**
 * 在 node_modules 下查找 .prisma（优先浅层：根目录、.pnpm 下 @prisma+client 包内）
 * @returns {string|null}
 */
function findDotPrismaDir() {
  const flat = path.join(nm, '.prisma')
  if (isLikelyPrismaDot(flat)) return flat

  const pnpmRoot = path.join(nm, '.pnpm')
  if (!fs.existsSync(pnpmRoot)) return null

  let entries
  try {
    entries = fs.readdirSync(pnpmRoot, { withFileTypes: true })
  } catch {
    return null
  }

  for (const e of entries) {
    if (!e.isDirectory()) continue
    if (!e.name.includes('prisma')) continue
    const candidate = path.join(pnpmRoot, e.name, 'node_modules', '.prisma')
    if (isLikelyPrismaDot(candidate)) return candidate
  }

  // 再扫一层：.pnpm/<pkg>/node_modules/<sub>/node_modules/.prisma
  for (const e of entries) {
    if (!e.isDirectory()) continue
    const nm1 = path.join(pnpmRoot, e.name, 'node_modules')
    if (!fs.existsSync(nm1)) continue
    let sub
    try {
      sub = fs.readdirSync(nm1, { withFileTypes: true })
    } catch {
      continue
    }
    for (const s of sub) {
      if (!s.isDirectory()) continue
      const nested = path.join(nm1, s.name, 'node_modules', '.prisma')
      if (isLikelyPrismaDot(nested)) return nested
    }
  }

  return null
}

/**
 * @returns {{ prismaDot: string, prismaAt: string } | null}
 */
function resolvePrismaPaths() {
  const flatAt = path.join(nm, '@prisma')
  const prismaDot = findDotPrismaDir()
  if (!prismaDot) return null

  let prismaAt = null
  if (fs.existsSync(flatAt)) {
    prismaAt = flatAt
  } else {
    let clientDir
    try {
      const req = createRequire(path.join(root, 'package.json'))
      clientDir = path.dirname(req.resolve('@prisma/client/package.json'))
    } catch {
      return null
    }
    // .../node_modules/@prisma/client -> .../node_modules/@prisma（勿再拼 /@prisma）
    const scopedAt = path.dirname(clientDir)
    if (fs.existsSync(scopedAt)) prismaAt = scopedAt
  }

  if (!prismaAt) return null

  return {
    prismaDot: safeRealpath(prismaDot),
    prismaAt: safeRealpath(prismaAt)
  }
}

function main() {
  const resolved = resolvePrismaPaths()
  if (!resolved) {
    console.error('[pack-prisma-offline] 未找到可用的 .prisma 或 @prisma 目录。')
    console.error('请先在本目录执行: pnpm install && npx prisma generate')
    console.error(`node_modules 路径: ${nm}`)
    process.exit(1)
  }

  const { prismaDot, prismaAt } = resolved
  console.log(`[pack-prisma-offline] .prisma  <- ${prismaDot}`)
  console.log(`[pack-prisma-offline] @prisma <- ${prismaAt}`)

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const outZip = path.join(outDir, `prisma-offline-node_modules-${stamp}.zip`)

  const zip = new AdmZip()
  zip.addLocalFolder(prismaDot, '.prisma')
  zip.addLocalFolder(prismaAt, '@prisma')

  const readme = [
    'Prisma 离线包（.prisma + @prisma）',
    '',
    '解压到 online-ppt-backend/node_modules/ 目录下：',
    '  unzip -o prisma-offline-node_modules-*.zip -d node_modules',
    '',
    '会得到 node_modules/.prisma 与 node_modules/@prisma（与 npm 扁平布局一致，便于 ai_backend 引用）。',
    '打包环境需与生产 Linux / OpenSSL 大版本尽量一致，否则 query engine 可能不兼容。',
    ''
  ].join('\n')
  zip.addFile('README-prisma-offline.txt', Buffer.from(readme, 'utf8'))

  zip.writeZip(outZip)
  const stat = fs.statSync(outZip)
  console.log(`[pack-prisma-offline] 已生成: ${outZip}`)
  console.log(`[pack-prisma-offline] 大小约: ${(stat.size / 1024 / 1024).toFixed(2)} MB`)
}

main()
