/**
 * 投标响应「简历抽取」结果查询
 * - 列表：按 bid_resume_persons（源文件 + 人名）
 * - 详情：单人 + 父级切片信息；附件下载
 */

const express = require('express')
const fs = require('fs')
const path = require('path')
const JSZip = require('jszip')
const prisma = require('../utils/prisma')

const router = express.Router()

function getResumeOutputRoots () {
  const roots = []
  if (process.env.RESUME_EXTRACT_OUTPUT_DIR) {
    roots.push(path.normalize(process.env.RESUME_EXTRACT_OUTPUT_DIR))
  }
  roots.push(path.normalize(path.join(__dirname, '../../data/resume-extract-output')))
  return [...new Set(roots)]
}

function isUnderRoot (absPath, root) {
  const a = path.normalize(absPath)
  const r = path.normalize(root)
  return a === r || a.startsWith(r + path.sep)
}

function isAllowedAbsolutePath (absPath) {
  if (!absPath || typeof absPath !== 'string') return false
  const p = path.normalize(absPath)
  if (!path.isAbsolute(p)) return false
  return getResumeOutputRoots().some((root) => isUnderRoot(p, root))
}

/** docx 所在父目录名（如投标项目文件夹），用于列表第一列展示 */
function sourceDocxParentFolderLabel (docxPath) {
  if (!docxPath || typeof docxPath !== 'string') return ''
  const norm = path.normalize(docxPath.trim())
  const dir = path.dirname(norm)
  if (!dir || dir === norm || dir === '.') return ''
  const leaf = path.basename(dir)
  if (!leaf || leaf === '.' || leaf === '..') return ''
  if (/^[a-zA-Z]:$/.test(dir)) return ''
  return leaf
}

function attachSourceParentFolder (personRow, docxPath) {
  const folder = sourceDocxParentFolderLabel(docxPath)
  return {
    ...personRow,
    source_docx_parent_folder: folder || personRow.source_docx_basename || '',
  }
}

function parsePathArray (val) {
  if (val == null) return []
  if (Array.isArray(val)) return val.filter((x) => typeof x === 'string' && x.trim())
  if (typeof val === 'string') {
    try {
      const j = JSON.parse(val)
      return Array.isArray(j) ? j.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  return []
}

/** GET /persons 单人列表（分页） */
router.get('/persons', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20))
    const skip = (page - 1) * pageSize
    const { basename, batchId, personName } = req.query

    const conditions = []
    if (basename) {
      const q = String(basename)
      conditions.push({
        OR: [
          { source_docx_basename: { contains: q } },
          { bid_resume_records: { source_docx_path: { contains: q } } },
        ],
      })
    }
    if (batchId) conditions.push({ run_batch_id: String(batchId) })
    if (personName) conditions.push({ person_name: { contains: String(personName) } })
    const where = conditions.length ? { AND: conditions } : {}

    const [rawList, total] = await Promise.all([
      prisma.bid_resume_persons.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          resume_record_id: true,
          run_batch_id: true,
          source_docx_basename: true,
          person_name: true,
          role_label: true,
          h1_section_title: true,
          l2_section_title: true,
          created_at: true,
          bid_resume_records: { select: { source_docx_path: true } },
        },
      }),
      prisma.bid_resume_persons.count({ where }),
    ])

    const list = rawList.map((row) => {
      const docPath = row.bid_resume_records?.source_docx_path
      const { bid_resume_records: _br, ...rest } = row
      return attachSourceParentFolder(rest, docPath)
    })

    res.json({
      success: true,
      data: {
        list,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    })
  } catch (e) {
    console.error('[bid-resume-records] persons list', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

/** 必须在 /persons/:personId 之前 */
router.get('/persons/:personId/file', async (req, res) => {
  try {
    const { personId } = req.params
    const kind = String(req.query.kind || 'education')
    const idx = Math.max(0, parseInt(req.query.idx, 10) || 0)

    const person = await prisma.bid_resume_persons.findUnique({ where: { id: personId } })
    if (!person) return res.status(404).json({ success: false, error: '人员记录不存在' })

    let arr = []
    if (kind === 'work') arr = parsePathArray(person.work_proof_image_paths)
    else if (kind === 'other') arr = parsePathArray(person.other_image_paths)
    else arr = parsePathArray(person.education_cert_image_paths)

    const filePath = arr[idx]
    if (!filePath) return res.status(404).json({ success: false, error: '附件不存在' })
    if (!isAllowedAbsolutePath(filePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '文件不可访问或已删除' })
    }

    const download = req.query.download === '1' || req.query.download === 'true'
    const base = path.basename(filePath)
    res.setHeader('Content-Type', 'application/octet-stream')
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(base)}`)
    } else {
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(base)}`)
    }
    fs.createReadStream(filePath).pipe(res)
  } catch (e) {
    console.error('[bid-resume-records] file', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

/** 单人证明材料 ZIP */
router.get('/persons/:personId/download-bundle', async (req, res) => {
  try {
    const { personId } = req.params
    const person = await prisma.bid_resume_persons.findUnique({ where: { id: personId } })
    if (!person) return res.status(404).json({ success: false, error: '人员记录不存在' })

    const zip = new JSZip()
    const addFileSafe = (diskPath, entryName) => {
      if (!diskPath || !fs.existsSync(diskPath)) return
      if (!isAllowedAbsolutePath(diskPath)) return
      zip.file(entryName, fs.readFileSync(diskPath))
    }
    const safe = (person.person_name || person.role_label || person.id).replace(/[/\\?%*:|"<>]/g, '_')
    parsePathArray(person.education_cert_image_paths).forEach((fp, i) => {
      addFileSafe(fp, `学历学位_${i + 1}${path.extname(fp) || '.bin'}`)
    })
    parsePathArray(person.work_proof_image_paths).forEach((fp, i) => {
      addFileSafe(fp, `工作证明_${i + 1}${path.extname(fp) || '.bin'}`)
    })
    parsePathArray(person.other_image_paths).forEach((fp, i) => {
      addFileSafe(fp, `其他_${i + 1}${path.extname(fp) || '.bin'}`)
    })

    if (!Object.keys(zip.files).length) {
      return res.status(404).json({ success: false, error: '该人员没有可打包的本地图片' })
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const zipName = `${person.source_docx_basename || 'resume'}_${safe}_${person.run_batch_id || person.id}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`)
    res.send(buf)
  } catch (e) {
    console.error('[bid-resume-records] person bundle', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

/** 单人详情 + 父级 record（用于切片下载等） */
router.get('/persons/:personId', async (req, res) => {
  try {
    const { personId } = req.params
    const person = await prisma.bid_resume_persons.findUnique({ where: { id: personId } })
    if (!person) return res.status(404).json({ success: false, error: '人员记录不存在' })

    let parentRecord = null
    if (person.resume_record_id) {
      parentRecord = await prisma.bid_resume_records.findUnique({
        where: { id: person.resume_record_id },
        select: {
          id: true,
          run_batch_id: true,
          source_docx_basename: true,
          source_docx_path: true,
          h1_section_title: true,
          l2_section_title: true,
          split_docx_path: true,
          manifest_path: true,
          raw_text: true,
          created_at: true,
        },
      })
    }

    const docPath = parentRecord?.source_docx_path
    const personOut = attachSourceParentFolder(person, docPath)

    res.json({ success: true, data: { person: personOut, parentRecord } })
  } catch (e) {
    console.error('[bid-resume-records] person detail', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

/** 章节切片 DOCX */
router.get('/records/:recordId/split-docx', async (req, res) => {
  try {
    const { recordId } = req.params
    const record = await prisma.bid_resume_records.findUnique({ where: { id: recordId } })
    if (!record?.split_docx_path) return res.status(404).json({ success: false, error: '无切片文件' })
    const filePath = record.split_docx_path
    if (!isAllowedAbsolutePath(filePath) || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '切片文件不存在' })
    }
    const base = path.basename(filePath)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(base)}`)
    fs.createReadStream(filePath).pipe(res)
  } catch (e) {
    console.error('[bid-resume-records] split-docx', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

/** 章节下所有人材料 + 切片 ZIP */
router.get('/records/:recordId/download-bundle', async (req, res) => {
  try {
    const { recordId } = req.params
    const record = await prisma.bid_resume_records.findUnique({
      where: { id: recordId },
      include: { bid_resume_persons: { orderBy: { sort_order: 'asc' } } },
    })
    if (!record) return res.status(404).json({ success: false, error: '记录不存在' })

    const zip = new JSZip()
    const addFileSafe = (diskPath, entryName) => {
      if (!diskPath || !fs.existsSync(diskPath)) return
      if (!isAllowedAbsolutePath(diskPath)) return
      zip.file(entryName, fs.readFileSync(diskPath))
    }

    if (record.split_docx_path) {
      addFileSafe(record.split_docx_path, `切片_${path.basename(record.split_docx_path)}`)
    }

    record.bid_resume_persons.forEach((p, pi) => {
      const safe = (p.person_name || p.role_label || p.id).replace(/[/\\?%*:|"<>]/g, '_')
      const prefix = `人员${pi + 1}_${safe}`
      parsePathArray(p.education_cert_image_paths).forEach((fp, i) => {
        addFileSafe(fp, `${prefix}/学历学位_${i + 1}${path.extname(fp) || '.bin'}`)
      })
      parsePathArray(p.work_proof_image_paths).forEach((fp, i) => {
        addFileSafe(fp, `${prefix}/工作证明_${i + 1}${path.extname(fp) || '.bin'}`)
      })
      parsePathArray(p.other_image_paths).forEach((fp, i) => {
        addFileSafe(fp, `${prefix}/其他_${i + 1}${path.extname(fp) || '.bin'}`)
      })
    })

    if (!Object.keys(zip.files).length) {
      return res.status(404).json({ success: false, error: '没有可打包的本地文件' })
    }

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const zipName = `${record.source_docx_basename || 'resume'}_${record.run_batch_id || recordId}.zip`
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(zipName)}`)
    res.send(buf)
  } catch (e) {
    console.error('[bid-resume-records] record bundle', e)
    res.status(500).json({ success: false, error: e.message })
  }
})

module.exports = router
