/**
 * 将 bid_resume_persons 按规则合并写入：
 *   bid_resume_person_canonical（每人/每聚类一行）
 *   bid_resume_person_canonical_source（溯源：哪些原始 person 行并入）
 *
 * 规则：
 *   - 聚类键：身份证 > 规范化手机 > 姓名；皆无则 solo:原行 id（不与他人合并）
 *   - 组内排序：source_docx_modified_at 新在前；NULL 视为最旧；再按 created_at 新在前
 *   - 字段：主行（最新文档）非空优先；仍空则按上述顺序从历史行补全
 *
 * 用法：
 *   node scripts/merge-bid-resume-person-canonical.js
 *   node scripts/merge-bid-resume-person-canonical.js --dry-run
 *   node scripts/merge-bid-resume-person-canonical.js --ensure-tables   # 无 migrate 时尝试 CREATE IF NOT EXISTS（仅开发兜底）
 */

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const { PrismaClient } = require('../../online-ppt-backend/node_modules/@prisma/client')

const prisma = new PrismaClient()

const SLICE = {
  h1_section_title: 500,
  l2_section_title: 500,
  source_docx_basename: 255,
  role_label: 120,
  person_name: 80,
  gender: 20,
  age: 32,
  education_level: 80,
  major: 200,
  graduate_school: 200,
  work_years_hint: 64,
  work_duration_text: 64,
  phone: 50,
  email: 120,
  id_card: 24,
  degree: 40,
  employer: 200,
  proposed_project_role: 120,
  resume_record_id: 50,
  run_batch_id: 50,
}

const STRING_MERGE_KEYS = [
  'resume_record_id',
  'run_batch_id',
  'source_docx_basename',
  'h1_section_title',
  'l2_section_title',
  'role_label',
  'person_name',
  'gender',
  'age',
  'education_level',
  'major',
  'graduate_school',
  'work_years_hint',
  'work_duration_text',
  'phone',
  'email',
  'id_card',
  'degree',
  'employer',
  'proposed_project_role',
  'project_experience',
  'raw_fragment',
]

const JSON_MERGE_KEYS = [
  'structured_json',
  'education_cert_image_paths',
  'work_proof_image_paths',
  'other_image_paths',
]

function newId (prefix) {
  const p = prefix || 'bidcan'
  return `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeIdCard (s) {
  if (s == null || typeof s !== 'string') return null
  const t = s.replace(/\s/g, '').toUpperCase()
  if (/^\d{17}[\dX]$/.test(t) || /^\d{15}$/.test(t)) return t.slice(0, 24)
  return null
}

function normalizePhone (s) {
  if (s == null || typeof s !== 'string') return null
  const d = s.replace(/\D/g, '')
  if (d.length < 8) return null
  return d.slice(0, 32)
}

function normalizePersonName (s) {
  if (s == null || typeof s !== 'string') return null
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length < 2) return null
  return t.slice(0, 80)
}

function mergeKeyForRow (row) {
  const idc = normalizeIdCard(row.id_card)
  if (idc) return { merge_key_type: 'id_card', merge_key: `idc:${idc}` }
  const ph = normalizePhone(row.phone)
  if (ph) return { merge_key_type: 'phone', merge_key: `ph:${ph}` }
  const nm = normalizePersonName(row.person_name)
  if (nm) return { merge_key_type: 'person_name', merge_key: `nm:${nm}` }
  return { merge_key_type: 'solo', merge_key: `solo:${row.id}` }
}

function compareNewestFirst (a, b) {
  const at = a.source_docx_modified_at ? a.source_docx_modified_at.getTime() : null
  const bt = b.source_docx_modified_at ? b.source_docx_modified_at.getTime() : null
  if (at != null && bt != null) return bt - at
  if (at != null && bt == null) return -1
  if (at == null && bt != null) return 1
  return b.created_at.getTime() - a.created_at.getTime()
}

function isNonEmptyStr (v) {
  return v != null && String(v).trim() !== ''
}

function sliceField (key, val) {
  if (val == null) return null
  const n = SLICE[key]
  if (typeof val !== 'string') return val
  return n ? val.slice(0, n) : val
}

function mergeStringField (orderedRows, key) {
  const p = orderedRows[0][key]
  if (isNonEmptyStr(p)) return sliceField(key, String(p).trim())
  for (let i = 1; i < orderedRows.length; i++) {
    const v = orderedRows[i][key]
    if (isNonEmptyStr(v)) return sliceField(key, String(v).trim())
  }
  return sliceField(key, p)
}

function jsonMeaningful (v) {
  if (v == null || v === undefined) return false
  if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return false
  if (Array.isArray(v) && v.length === 0) return false
  return true
}

function mergeJsonField (orderedRows, key) {
  const p = orderedRows[0][key]
  if (jsonMeaningful(p)) return p
  for (let i = 1; i < orderedRows.length; i++) {
    const v = orderedRows[i][key]
    if (jsonMeaningful(v)) return v
  }
  return null
}

function buildMergedRow (orderedRows) {
  const primary = orderedRows[0]
  const out = {}
  for (const key of STRING_MERGE_KEYS) {
    out[key] = mergeStringField(orderedRows, key)
  }
  for (const key of JSON_MERGE_KEYS) {
    out[key] = mergeJsonField(orderedRows, key)
  }
  out.sort_order = primary.sort_order != null ? primary.sort_order : 0
  out.source_docx_modified_at = primary.source_docx_modified_at ?? null
  if (!isNonEmptyStr(out.h1_section_title)) {
    out.h1_section_title = sliceField('h1_section_title', '(未分类)')
  }
  if (!isNonEmptyStr(out.source_docx_basename)) {
    out.source_docx_basename = sliceField('source_docx_basename', primary.source_docx_basename || 'unknown')
  }
  return out
}

async function loadAllPersons () {
  const pageSize = 4000
  const out = []
  let cursor = null
  for (;;) {
    const batch = await prisma.bid_resume_persons.findMany({
      take: pageSize,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor.id } } : {}),
    })
    if (batch.length === 0) break
    out.push(...batch)
    cursor = batch[batch.length - 1]
    if (batch.length < pageSize) break
  }
  return out
}

const ENSURE_SQL = `
CREATE TABLE IF NOT EXISTS \`bid_resume_person_canonical\` (
    \`id\` VARCHAR(50) NOT NULL,
    \`merge_key\` VARCHAR(200) NOT NULL,
    \`merge_key_type\` VARCHAR(24) NOT NULL,
    \`resume_record_id\` VARCHAR(50) NULL,
    \`run_batch_id\` VARCHAR(50) NULL,
    \`source_docx_basename\` VARCHAR(255) NOT NULL,
    \`source_docx_modified_at\` DATETIME(3) NULL,
    \`h1_section_title\` VARCHAR(500) NOT NULL,
    \`l2_section_title\` VARCHAR(500) NULL,
    \`sort_order\` INTEGER NOT NULL DEFAULT 0,
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
    \`winning_person_id\` VARCHAR(50) NOT NULL,
    \`source_row_count\` INTEGER NOT NULL DEFAULT 0,
    \`merged_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE INDEX \`bid_resume_person_canonical_merge_key_key\`(\`merge_key\`),
    INDEX \`idx_bidrescanon_keytype\`(\`merge_key_type\`),
    INDEX \`idx_bidrescanon_name\`(\`person_name\`),
    INDEX \`idx_bidrescanon_winner\`(\`winning_person_id\`),
    INDEX \`idx_bidrescanon_resume_record\`(\`resume_record_id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`bid_resume_person_canonical_source\` (
    \`id\` VARCHAR(50) NOT NULL,
    \`canonical_id\` VARCHAR(50) NOT NULL,
    \`person_id\` VARCHAR(50) NOT NULL,
    \`source_docx_modified_at\` DATETIME(3) NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE INDEX \`uq_bidrescanonsrc_canon_person\`(\`canonical_id\`, \`person_id\`),
    INDEX \`idx_bidrescanonsrc_person\`(\`person_id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`

async function ensureTables () {
  const parts = ENSURE_SQL.split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (const sql of parts) {
    await prisma.$executeRawUnsafe(sql)
  }
  const fkCanon = 'ALTER TABLE `bid_resume_person_canonical` ADD CONSTRAINT `bid_resume_person_canonical_resume_record_id_fkey` FOREIGN KEY (`resume_record_id`) REFERENCES `bid_resume_records`(`id`) ON DELETE SET NULL ON UPDATE CASCADE'
  const fkSrcCanon = 'ALTER TABLE `bid_resume_person_canonical_source` ADD CONSTRAINT `bid_resume_person_canonical_source_canonical_id_fkey` FOREIGN KEY (`canonical_id`) REFERENCES `bid_resume_person_canonical`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
  const fkSrcPerson = 'ALTER TABLE `bid_resume_person_canonical_source` ADD CONSTRAINT `bid_resume_person_canonical_source_person_id_fkey` FOREIGN KEY (`person_id`) REFERENCES `bid_resume_persons`(`id`) ON DELETE CASCADE ON UPDATE CASCADE'
  for (const sql of [fkCanon, fkSrcCanon, fkSrcPerson]) {
    try {
      await prisma.$executeRawUnsafe(sql)
    } catch (_) {
      /* 已存在 */
    }
  }
  console.log('已确认表 bid_resume_person_canonical、bid_resume_person_canonical_source（含尽力补外键）')
}

async function main () {
  const dryRun = process.argv.includes('--dry-run')
  const ensure = process.argv.includes('--ensure-tables')

  if (ensure) {
    await ensureTables()
  }

  try {
    await prisma.bid_resume_persons.findFirst({ select: { id: true } })
  } catch (e) {
    console.error('无法读取 bid_resume_persons：', e.message)
    process.exit(1)
  }

  console.log('加载 bid_resume_persons …')
  const persons = await loadAllPersons()
  console.log(`共 ${persons.length} 条 person 行`)

  const byMerge = new Map()
  for (const row of persons) {
    const { merge_key, merge_key_type } = mergeKeyForRow(row)
    if (!byMerge.has(merge_key)) byMerge.set(merge_key, { merge_key_type, rows: [] })
    byMerge.get(merge_key).rows.push(row)
  }

  const clusters = []
  for (const [merge_key, { merge_key_type, rows }] of byMerge) {
    const ordered = [...rows].sort(compareNewestFirst)
    clusters.push({ merge_key, merge_key_type, ordered })
  }

  const multi = clusters.filter((c) => c.ordered.length > 1).length
  console.log(`聚类数 ${clusters.length}，其中多行合并 ${multi} 组`)

  if (dryRun) {
    console.log('(--dry-run) 不写库，结束')
    await prisma.$disconnect()
    return
  }

  if (!ensure) {
    try {
      await prisma.bid_resume_person_canonical.count()
    } catch (e) {
      console.error('读取 bid_resume_person_canonical 失败。请在 online-ppt-backend 执行：npx prisma migrate deploy')
      console.error('或加 --ensure-tables（仅建议开发环境）')
      console.error(e.message)
      process.exit(1)
    }
  }

  console.log('清空旧 canonical / source …')
  await prisma.$transaction([
    prisma.bid_resume_person_canonical_source.deleteMany(),
    prisma.bid_resume_person_canonical.deleteMany(),
  ])

  const CHUNK = 60
  let written = 0
  for (let i = 0; i < clusters.length; i += CHUNK) {
    const part = clusters.slice(i, i + CHUNK)
    await prisma.$transaction(async (tx) => {
      for (const { merge_key, merge_key_type, ordered } of part) {
        const merged = buildMergedRow(ordered)
        const winning = ordered[0]
        const canonicalId = newId('bidcan')
        await tx.bid_resume_person_canonical.create({
          data: {
            id: canonicalId,
            merge_key,
            merge_key_type,
            winning_person_id: winning.id,
            source_row_count: ordered.length,
            resume_record_id: merged.resume_record_id,
            run_batch_id: merged.run_batch_id,
            source_docx_basename: merged.source_docx_basename,
            source_docx_modified_at: merged.source_docx_modified_at,
            h1_section_title: merged.h1_section_title,
            l2_section_title: merged.l2_section_title,
            sort_order: merged.sort_order,
            role_label: merged.role_label,
            person_name: merged.person_name,
            gender: merged.gender,
            age: merged.age,
            education_level: merged.education_level,
            major: merged.major,
            graduate_school: merged.graduate_school,
            work_years_hint: merged.work_years_hint,
            work_duration_text: merged.work_duration_text,
            phone: merged.phone,
            email: merged.email,
            id_card: merged.id_card,
            degree: merged.degree,
            employer: merged.employer,
            proposed_project_role: merged.proposed_project_role,
            project_experience: merged.project_experience,
            raw_fragment: merged.raw_fragment,
            structured_json: merged.structured_json ?? undefined,
            education_cert_image_paths: merged.education_cert_image_paths ?? undefined,
            work_proof_image_paths: merged.work_proof_image_paths ?? undefined,
            other_image_paths: merged.other_image_paths ?? undefined,
          },
        })
        const srcRows = ordered.map((r) => ({
          id: newId('bidcns'),
          canonical_id: canonicalId,
          person_id: r.id,
          source_docx_modified_at: r.source_docx_modified_at,
        }))
        await tx.bid_resume_person_canonical_source.createMany({ data: srcRows })
        written++
      }
    })
    if ((i + CHUNK) % 600 === 0 || i + CHUNK >= clusters.length) {
      console.log(`已写入 canonical ${Math.min(i + CHUNK, clusters.length)} / ${clusters.length}`)
    }
  }

  console.log(`完成：写入 ${written} 条 bid_resume_person_canonical 及对应 source 映射`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  prisma.$disconnect()
  process.exit(1)
})
