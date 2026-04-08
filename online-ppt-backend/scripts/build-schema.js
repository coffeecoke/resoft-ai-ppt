#!/usr/bin/env node
/**
 * 合并 prisma/base.prisma + prisma/modules/*.prisma => prisma/schema.prisma
 * 使用方式：node scripts/build-schema.js
 */

import { readFileSync, writeFileSync, readdirSync, watch } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PRISMA_DIR = join(ROOT, 'prisma')
const MODULES_DIR = join(PRISMA_DIR, 'modules')
const OUTPUT = join(PRISMA_DIR, 'schema.prisma')

const HEADER = `// ⚠️  此文件由 scripts/build-schema.js 自动生成，请勿手动编辑
// 请在 prisma/base.prisma 或 prisma/modules/ 下修改

`

function buildSchema() {
  const base = readFileSync(join(PRISMA_DIR, 'base.prisma'), 'utf-8')
  const moduleFiles = readdirSync(MODULES_DIR)
    .filter(f => f.endsWith('.prisma'))
    .sort()
  const moduleParts = moduleFiles.map(f => readFileSync(join(MODULES_DIR, f), 'utf-8'))
  const merged = HEADER + base + '\n' + moduleParts.join('\n')
  writeFileSync(OUTPUT, merged, 'utf-8')
  const modelCount = (merged.match(/^model\s+\w+\s*\{/gm) || []).length
  console.log(`✅ [${new Date().toLocaleTimeString()}] schema.prisma 已生成（${modelCount} 个 model）`)
}

buildSchema()

// --watch 模式：监听 modules 目录变化自动重新合并
if (process.argv.includes('--watch')) {
  console.log(`👀 监听 prisma/modules/ 变化...`)
  let debounceTimer = null
  watch(MODULES_DIR, (eventType, filename) => {
    if (!filename?.endsWith('.prisma')) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      console.log(`🔄 检测到 ${filename} 变化，重新合并...`)
      buildSchema()
    }, 100)
  })
}
