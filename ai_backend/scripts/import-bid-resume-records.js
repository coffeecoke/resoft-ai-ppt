/**
 * 将 resume_split_extract.py 的 manifest 入库：
 *  - bid_resume_records：章节/切片级
 *  - bid_resume_persons：person_entries 每人一行（姓名/学历/手机等列字段）
 *
 * 用法：
 *   node scripts/import-bid-resume-records.js <manifest.json>
 *   node scripts/import-bid-resume-records.js --latest
 */

const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('../../online-ppt-backend/node_modules/@prisma/client')

const prisma = new PrismaClient()

const CREATE_RECORDS_SQL = `
CREATE TABLE IF NOT EXISTS \`bid_resume_records\` (
  \`id\` VARCHAR(50) NOT NULL,
  \`run_batch_id\` VARCHAR(50) NULL,
  \`source_docx_path\` VARCHAR(800) NOT NULL,
  \`source_docx_basename\` VARCHAR(255) NOT NULL,
  \`source_docx_modified_at\` DATETIME(3) NULL,
  \`h1_section_title\` VARCHAR(500) NOT NULL,
  \`l2_section_title\` VARCHAR(500) NULL,
  \`person_name\` VARCHAR(100) NULL,
  \`role_title\` VARCHAR(200) NULL,
  \`raw_text\` LONGTEXT NULL,
  \`extracted_json\` JSON NULL,
  \`split_docx_path\` VARCHAR(500) NULL,
  \`manifest_path\` VARCHAR(800) NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_bidresume_batch\` (\`run_batch_id\`),
  KEY \`idx_bidresume_srcbase\` (\`source_docx_basename\`),
  KEY \`idx_bidresume_person\` (\`person_name\`),
  KEY \`idx_bidresume_src_mtime\` (\`source_docx_modified_at\`),
  KEY \`idx_bidresume_created\` (\`created_at\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`

const CREATE_PERSONS_SQL = `
CREATE TABLE IF NOT EXISTS \`bid_resume_persons\` (
  \`id\` VARCHAR(50) NOT NULL,
  \`resume_record_id\` VARCHAR(50) NULL,
  \`run_batch_id\` VARCHAR(50) NULL,
  \`source_docx_basename\` VARCHAR(255) NOT NULL,
  \`source_docx_modified_at\` DATETIME(3) NULL,
  \`h1_section_title\` VARCHAR(500) NOT NULL,
  \`l2_section_title\` VARCHAR(500) NULL,
  \`sort_order\` INT NOT NULL DEFAULT 0,
  \`role_label\` VARCHAR(120) NULL,
  \`person_name\` VARCHAR(80) NULL,
  \`gender\` VARCHAR(20) NULL,
  \`age\` VARCHAR(32) NULL,
  \`education_level\` VARCHAR(80) NULL,
  \`major\` VARCHAR(200) NULL,
  \`graduate_school\` VARCHAR(200) NULL,
  \`work_years_hint\` VARCHAR(64) NULL,
  \`work_duration_text\` VARCHAR(64) NULL,
  \`phone\` VARCHAR(50) NULL,
  \`email\` VARCHAR(120) NULL,
  \`id_card\` VARCHAR(24) NULL,
  \`degree\` VARCHAR(40) NULL,
  \`employer\` VARCHAR(200) NULL,
  \`proposed_project_role\` VARCHAR(120) NULL,
  \`project_experience\` LONGTEXT NULL,
  \`raw_fragment\` LONGTEXT NULL,
  \`structured_json\` JSON NULL,
  \`education_cert_image_paths\` JSON NULL,
  \`work_proof_image_paths\` JSON NULL,
  \`other_image_paths\` JSON NULL,
  \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (\`id\`),
  KEY \`idx_bidresperson_parent\` (\`resume_record_id\`),
  KEY \`idx_bidresperson_batch\` (\`run_batch_id\`),
  KEY \`idx_bidresperson_name\` (\`person_name\`),
  KEY \`idx_bidresperson_src_mtime\` (\`source_docx_modified_at\`),
  KEY \`idx_bidresperson_name_mtime\` (\`person_name\`, \`source_docx_modified_at\`),
  KEY \`idx_bidresperson_created\` (\`created_at\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`

function newId (prefix) {
  const p = prefix || 'bidres'
  return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function findLatestManifest (rootDir) {
  if (!fs.existsSync(rootDir)) return null
  let best = null
  let bestTime = 0
  for (const name of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!name.isDirectory()) continue
    const p = path.join(rootDir, name.name, 'manifest.json')
    if (!fs.existsSync(p)) continue
    const t = fs.statSync(p).mtimeMs
    if (t > bestTime) {
      bestTime = t
      best = p
    }
  }
  return best
}

/** manifest.source_docx_modified_at（Python 写入）优先，否则对源文件 stat mtime */
function resolveSourceDocMtime (manifest, sourcePath) {
  const raw = manifest.source_docx_modified_at
  if (raw != null && String(raw).trim() !== '') {
    const d = new Date(String(raw).trim())
    if (!Number.isNaN(d.getTime())) return d
  }
  try {
    const abs = path.resolve(sourcePath)
    if (fs.existsSync(abs)) return fs.statSync(abs).mtime
  } catch (_) { /* ignore */ }
  return null
}

async function ensureTables () {
  const one = (sql) => prisma.$executeRawUnsafe(sql.replace(/\s+/g, ' ').trim())
  await one(CREATE_RECORDS_SQL)
  await one(CREATE_PERSONS_SQL)
  // 若表已存在但无 FK，尝试补外键（忽略已存在错误）
  try {
    await prisma.$executeRawUnsafe(
      'ALTER TABLE `bid_resume_persons` ADD CONSTRAINT `bid_resume_persons_resume_record_id_fkey` ' +
        'FOREIGN KEY (`resume_record_id`) REFERENCES `bid_resume_records`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
    )
  } catch (_) {
    /* 已存在 */
  }
  const alters = [
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `education_cert_image_paths` JSON NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `work_proof_image_paths` JSON NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `other_image_paths` JSON NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `work_duration_text` VARCHAR(64) NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `id_card` VARCHAR(24) NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `degree` VARCHAR(40) NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `employer` VARCHAR(200) NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `proposed_project_role` VARCHAR(120) NULL',
    'ALTER TABLE `bid_resume_records` ADD COLUMN `source_docx_modified_at` DATETIME(3) NULL',
    'ALTER TABLE `bid_resume_persons` ADD COLUMN `source_docx_modified_at` DATETIME(3) NULL',
  ]
  for (const sql of alters) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (_) {
      /* 列已存在 */
    }
  }
  console.log('已确认表 bid_resume_records、bid_resume_persons')
}

function mapPersonRow (p, common, sortOrder) {
  return {
    id: newId('bidper'),
    resume_record_id: common.parentId,
    run_batch_id: common.batchId,
    source_docx_basename: common.basename,
    source_docx_modified_at: common.docMtime,
    h1_section_title: common.h1,
    l2_section_title: common.l2,
    sort_order: sortOrder,
    role_label: p.role_label || null,
    person_name: p.person_name || null,
    gender: p.gender || null,
    age: p.age || null,
    education_level: p.education_level || null,
    major: p.major || null,
    graduate_school: p.graduate_school || null,
    work_years_hint: p.work_years_hint || null,
    work_duration_text: p.work_duration_text || null,
    phone: p.phone || null,
    email: p.email || null,
    id_card: p.id_card || null,
    degree: p.degree || null,
    employer: p.employer || null,
    proposed_project_role: p.proposed_project_role || null,
    project_experience: p.project_experience || null,
    raw_fragment: p.raw_fragment || null,
    structured_json: p.structured_json ?? undefined,
    education_cert_image_paths: p.education_cert_image_paths ?? undefined,
    work_proof_image_paths: p.work_proof_image_paths ?? undefined,
    other_image_paths: p.other_image_paths ?? undefined,
  }
}

async function main () {
  let manifestPath = process.argv[2]
  if (manifestPath === '--latest') {
    manifestPath = findLatestManifest(path.join(__dirname, '../data/resume-extract-output'))
    if (!manifestPath) {
      console.error('未在 data/resume-extract-output 下找到 manifest.json')
      process.exit(1)
    }
    console.log('使用 manifest:', manifestPath)
  }
  if (!manifestPath || !fs.existsSync(manifestPath)) {
    console.error('用法: node scripts/import-bid-resume-records.js <manifest.json> | --latest')
    process.exit(1)
  }

  await ensureTables()

  const raw = fs.readFileSync(manifestPath, 'utf-8')
  const manifest = JSON.parse(raw)
  const batchId = manifest.batch_id || null
  const sourcePath = manifest.source_docx || ''
  const docMtime = resolveSourceDocMtime(manifest, sourcePath)
  const base = path.basename(sourcePath)
  const outDir = manifest.output_dir || path.dirname(manifestPath)
  const records = manifest.records || []

  if (records.length === 0) {
    console.log('manifest 中无 records，跳过入库')
    await prisma.$disconnect()
    return
  }

  let sectionCount = 0
  let personCount = 0

  await prisma.$transaction(async (tx) => {
    for (const rec of records) {
      const ex = rec.extracted || {}
      const parentId = newId('bidres')
      await tx.bid_resume_records.create({
        data: {
          id: parentId,
          run_batch_id: batchId,
          source_docx_path: sourcePath.slice(0, 800),
          source_docx_basename: base.slice(0, 255),
          source_docx_modified_at: docMtime,
          h1_section_title: (rec.h1_section_title || '').slice(0, 500),
          l2_section_title: rec.l2_section_title ? String(rec.l2_section_title).slice(0, 500) : null,
          person_name: ex.person_name ? String(ex.person_name).slice(0, 100) : null,
          role_title: ex.role_title ? String(ex.role_title).slice(0, 200) : null,
          raw_text: rec.raw_text || null,
          extracted_json: ex,
          split_docx_path: rec.split_docx_path ? String(rec.split_docx_path).slice(0, 500) : null,
          manifest_path: manifestPath.slice(0, 800),
        },
      })
      sectionCount++

      const persons = rec.person_entries || []
      const common = {
        parentId,
        batchId,
        basename: base.slice(0, 255),
        docMtime,
        h1: (rec.h1_section_title || '').slice(0, 500),
        l2: rec.l2_section_title ? String(rec.l2_section_title).slice(0, 500) : null,
      }
      for (let i = 0; i < persons.length; i++) {
        await tx.bid_resume_persons.create({
          data: mapPersonRow(persons[i], common, i),
        })
        personCount++
      }
    }
  })

  console.log(`已写入 bid_resume_records: ${sectionCount} 条，bid_resume_persons: ${personCount} 条，批次 ${batchId}`)
  console.log(`输出目录: ${outDir}`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
