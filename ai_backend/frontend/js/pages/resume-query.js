/**
 * 简历查询管理：单人列表 + 源文档式详情
 */
;(function () {
  const API_BASE = (window.location.origin || '') + '/api'

  function apiUrl (p) {
    return API_BASE + p
  }

  let rqState = { page: 1, pageSize: 20, total: 0, currentPersonId: null }

  async function rqFetchJson (url) {
    const res = await fetch(url)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || body.message || 'HTTP ' + res.status)
    return body
  }

  /** 章节列：h1 / l2 相同时不重复显示 */
  function sectionLabel (row) {
    const h1 = (row.h1_section_title || '').trim()
    const l2 = (row.l2_section_title || '').trim()
    if (!h1 && !l2) return '—'
    if (h1 && l2 && h1 === l2) return h1
    return [h1, l2].filter(Boolean).join(' / ') || '—'
  }

  function esc (s) {
    if (s == null) return ''
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function escAttr (s) {
    return esc(s).replace(/'/g, '&#39;')
  }

  function arrPaths (v) {
    if (v == null) return []
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
    return []
  }

  function fileUrl (personId, kind, idx) {
    const q = new URLSearchParams({ kind, idx: String(idx) })
    return apiUrl('/bid-resume-records/persons/' + encodeURIComponent(personId) + '/file?' + q.toString())
  }

  /* 从 raw 中 startKw 之后截取到任一 endKw 之前 */
  function personStructured (p) {
    const j = p && p.structured_json
    if (j && typeof j === 'object') return j
    if (typeof j === 'string') {
      try {
        return JSON.parse(j)
      } catch (_) {
        return {}
      }
    }
    return {}
  }

  function sliceBetween (raw, startKw, endKws) {
    if (!raw) return ''
    const i = raw.indexOf(startKw)
    if (i === -1) return ''
    let tail = raw.slice(i + startKw.length)
    let cut = tail.length
    for (let k = 0; k < endKws.length; k++) {
      const j = tail.indexOf(endKws[k])
      if (j !== -1 && j < cut) cut = j
    }
    tail = tail.slice(0, cut)
    return tail.replace(/^\s*[：:\t]\s*/m, '').replace(/^\s+/m, '').trim()
  }

  /** 详情页兜底：从 raw_fragment 全文扫常见键（与后端 _loose_scan 对齐，旧数据无需重跑即可多看一些） */
  function looseKvsFromRaw (raw) {
    const o = {}
    if (!raw || typeof raw !== 'string') return o
    let m = raw.match(/(?:身份证号码|身份证号|证件号码)\s*[：:\t]?\s*([0-9Xx*]{15,22})/i)
    if (m) o.id_card = m[1].trim()
    m = raw.match(/(?:手机号码|移动电话|联系电话|办公电话)\s*[：:\t]\s*([0-9+\s\-–—]{6,26})/)
    if (m) o.phone = m[1].replace(/\s+/g, '').trim()
    m = raw.match(/(?:电子邮箱|E-mail|Email|电子信箱)\s*[：:\t]\s*([\w.\-+@]{4,120})/i)
    if (m) o.email = m[1].trim()
    m = raw.match(/(?:现所在单位|工作单位|所在单位|单位名称)\s*[：:\t]\s*([^\t\n]{2,200})/)
    if (m) o.employer = m[1].trim()
    m = raw.match(/学位\s*[：:\t]\s*([^\t\n\r]{1,24})/)
    if (m) o.degree = m[1].trim()
    m = raw.match(/籍贯\s*[：:\t]\s*([^\t\n\r]{2,40})/)
    if (m) o.native_place = m[1].trim()
    m = raw.match(/民族\s*[：:\t]\s*([^\t\n\r]{1,12})/)
    if (m) o.ethnicity = m[1].trim()
    m = raw.match(/职称\s*[：:\t]\s*([^\t\n\r]{1,40})/)
    if (m) o.professional_title = m[1].trim()
    return o
  }

  function professionalText (p) {
    const raw = p.raw_fragment || ''
    const ends = ['\n工作经验', '\n工作简历', '\n工作履历', '\n主要经历', '\n工作履历承诺', '\n姓名\t', '\n手机', '\n邮箱']
    let t = sliceBetween(raw, '专业能力', ends)
    if (!t) t = sliceBetween(raw, '专业能力', ['工作经验', '工作简历', '工作履历'])
    if (!t) t = sliceBetween(raw, '专业特长', ends)
    if (!t) t = sliceBetween(raw, '技术能力', ends)
    if (!t) t = sliceBetween(raw, '技术优势', ends)
    if (!t && raw.length > 20) {
      const cut = raw.indexOf('毕业学校')
      if (cut !== -1) {
        const tail = raw.slice(cut, cut + 6000)
        const j = tail.search(/\n[^\n]{0,30}(?:工作经验|工作简历|工作履历|主要经历)/)
        t = j === -1 ? tail.trim() : tail.slice(0, j).trim()
      }
    }
    if (t && t.length > 8000) t = t.slice(0, 8000) + '…'
    return t || '—'
  }

  function experienceText (p) {
    if (p.project_experience && String(p.project_experience).trim()) return String(p.project_experience).trim()
    const raw = p.raw_fragment || ''
    let t = sliceBetween(raw, '主要经历', ['\n手机', '\n \t手机', '\n邮箱', '\n工作履历承诺', '\n资质证书', '\n学历', '\n工作经验', '\n姓名\t'])
    if (!t) t = sliceBetween(raw, '工作履历', ['\n手机', '\n \t手机', '\n邮箱', '\n工作履历承诺', '\n资质证书', '\n学历', '\n工作经验', '\n姓名\t'])
    if (!t) t = sliceBetween(raw, '工作经验', ['\n手机', '\n \t手机', '\n邮箱', '\n工作履历承诺', '\n资质证书', '\n学历'])
    if (!t) t = sliceBetween(raw, '工作简历', ['\n手机', '\n邮箱', '\n工作履历承诺'])
    if (!t || t.replace(/\s/g, '').length < 12) {
      const m = raw.match(/工作简历[\s\S]{0,4000}/)
      if (m) {
        const s = m[0].replace(/^工作简历\s*/, '').trim()
        if (s.length > (t || '').length) t = s
      }
    }
    if (t && t.length > 20000) t = t.slice(0, 20000) + '…'
    return t || '—'
  }

  function birthOrAgeCell (p) {
    const a = (p.age || '').trim()
    if (!a) return '—'
    if (/^\d{4}[.\-/]\d{1,2}/.test(a)) return a
    return a
  }

  /** 第三列表头：Word 常见为「年龄」或「出生年月」 */
  function birthOrAgeLabel (p) {
    const sj = personStructured(p)
    if (sj.birth_date) return '出生年月'
    const a = (p.age || '').trim()
    if (/^\d{4}[.\-/年]\d{1,2}/.test(a)) return '出生年月'
    if (/^\d{1,3}$/.test(a) && Number(a) < 130) return '年龄'
    return '年龄/出生'
  }

  function renderDocTable (p) {
    const sj = personStructured(p)
    const raw = p.raw_fragment || ''
    const loose = looseKvsFromRaw(raw)
    const duty = (sj.duty_line || '').trim()
    const profTitle = (sj.professional_title || loose.professional_title || '').trim()
    const native = (sj.native_place || loose.native_place || '').trim()
    const ethnic = (sj.ethnicity || loose.ethnicity || '').trim()
    const idCard = String(p.id_card || sj.id_card || loose.id_card || '').trim()
    const degreeStr = String(p.degree || sj.degree || loose.degree || '').trim()
    const employerStr = String(p.employer || sj.employer || loose.employer || '').trim()
    const proposedRole = String(p.proposed_project_role || sj.proposed_project_role || '').trim()
    const workDur = String(p.work_duration_text || sj.work_duration_text || '').trim()
    const phoneDisp = String(p.phone || loose.phone || '').trim()
    const emailDisp = String(p.email || loose.email || '').trim()
    const proposedExtraRow =
      proposedRole && proposedRole !== duty
        ? '<tr><td class="rq-doc-label">拟在本项目担任职务</td><td colspan="5">' + esc(proposedRole) + '</td></tr>'
        : ''
    const wyHint = String(p.work_years_hint || '').trim()
    const workYearsCell =
      wyHint && workDur && wyHint !== workDur
        ? wyHint + '；工作时间：' + workDur
        : wyHint || workDur || '—'
    const headerRole = (p.role_label || '').trim()
    const name = esc(p.person_name || '—')
    const h1 = esc(p.h1_section_title || '')
    const title = (headerRole && (p.person_name || '').trim()) ? (esc(headerRole) + '-' + name) : (name !== '—' ? name : '简历')
    const ageLabel = birthOrAgeLabel(p)

    return (
      '<div class="rq-doc-wrap">' +
      (h1 ? '<div class="rq-doc-h1" style="color:#444;font-size:13px;margin-bottom:6px;">' + h1 + '</div>' : '') +
      '<div class="rq-doc-h1">' + title + '</div>' +
      '<table class="rq-doc-table">' +
      '<colgroup><col style="width:14%"><col style="width:19%"><col style="width:14%"><col style="width:19%"><col style="width:14%"><col style="width:20%"></colgroup>' +
      '<tr><td class="rq-doc-label">姓名</td><td>' + name + '</td><td class="rq-doc-label">性别</td><td>' + esc(p.gender || '—') + '</td><td class="rq-doc-label">' + esc(ageLabel) + '</td><td>' + esc(birthOrAgeCell(p)) + '</td></tr>' +
      '<tr><td class="rq-doc-label">籍贯</td><td>' + esc(native || '—') + '</td><td class="rq-doc-label">民族</td><td>' + esc(ethnic || '—') + '</td><td class="rq-doc-label">学历</td><td>' + esc(p.education_level || '—') + '</td></tr>' +
      '<tr><td class="rq-doc-label">专业</td><td colspan="5">' + esc(p.major || '—') + '</td></tr>' +
      '<tr><td class="rq-doc-label">毕业学校</td><td colspan="5">' + esc(p.graduate_school || '—') + '</td></tr>' +
      '<tr><td class="rq-doc-label">学位</td><td>' + esc(degreeStr || '—') + '</td><td class="rq-doc-label">身份证号码</td><td colspan="3" style="word-break:break-all;">' + esc(idCard || '—') + '</td></tr>' +
      '<tr><td class="rq-doc-label">现所在单位</td><td colspan="5">' + esc(employerStr || '—') + '</td></tr>' +
      proposedExtraRow +
      '<tr><td class="rq-doc-label">职务</td><td>' + esc(duty || proposedRole || '—') + '</td><td class="rq-doc-label">职称</td><td>' + esc(profTitle || '—') + '</td><td class="rq-doc-label">工作年限/时间</td><td>' + esc(workYearsCell) + '</td></tr>' +
      '<tr><td class="rq-doc-label">手机</td><td>' + esc(phoneDisp || '—') + '</td><td class="rq-doc-label">邮箱</td><td colspan="3">' + esc(emailDisp || '—') + '</td></tr>' +
      '<tr><td class="rq-doc-label">专业能力</td><td colspan="5" style="line-height:1.6;">' + esc(professionalText(p)) + '</td></tr>' +
      '<tr><td class="rq-doc-label">工作经验</td><td colspan="5" style="line-height:1.65;white-space:pre-wrap;">' + esc(experienceText(p)) + '</td></tr>' +
      '</table>' +
      renderProofBlock('学历 / 学位证书等材料', p.id, arrPaths(p.education_cert_image_paths), 'education') +
      renderProofBlock('工作 / 项目证明等材料', p.id, arrPaths(p.work_proof_image_paths), 'work') +
      (arrPaths(p.other_image_paths).length
        ? renderProofBlock('其他图片', p.id, arrPaths(p.other_image_paths), 'other')
        : '') +
      '</div>'
    )
  }

  function renderProofBlock (label, personId, list, kind) {
    if (!list.length) {
      return '<div class="rq-proof-title">' + esc(label) + '</div><p style="font-size:13px;color:#666;">无</p>'
    }
    const imgs = list.map(function (_, i) {
      const u = fileUrl(personId, kind, i)
      return (
        '<div class="rq-proof-item">' +
        '<a href="' + u + '&download=1" target="_blank" rel="noopener">下载</a>' +
        '<img src="' + u + '" alt="" loading="lazy" onerror="this.style.visibility=\'hidden\'">' +
        '</div>'
      )
    }).join('')
    return '<div class="rq-proof-title">' + esc(label) + '</div><div class="rq-proof-grid">' + imgs + '</div>'
  }

  window.rqLoadList = async function (page) {
    rqState.page = page || rqState.page
    const basename = (document.getElementById('rq-filter-basename') || {}).value || ''
    const personName = (document.getElementById('rq-filter-person') || {}).value || ''
    const batchId = (document.getElementById('rq-filter-batch') || {}).value || ''
    const q = new URLSearchParams({
      page: String(rqState.page),
      pageSize: String(rqState.pageSize),
    })
    if (basename) q.set('basename', basename)
    if (personName) q.set('personName', personName)
    if (batchId) q.set('batchId', batchId)

    const tbody = document.getElementById('rq-tbody')
    const summary = document.getElementById('rq-summary')
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;">加载中…</td></tr>'
    try {
      const body = await rqFetchJson(apiUrl('/bid-resume-records/persons?' + q.toString()))
      if (!body.success || !body.data) throw new Error(body.error || '无数据')
      const d = body.data
      const list = d.list
      const total = d.total
      const p = d.page
      const pageSize = d.pageSize
      const totalPages = d.totalPages || 1
      rqState.total = total
      if (summary) summary.textContent = '共 ' + total + ' 人 · 第 ' + p + '/' + Math.max(1, totalPages) + ' 页'
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;color:var(--text-secondary);">暂无人员记录。请先执行简历抽取与 npm run resume-import 入库。</td></tr>'
      } else {
        tbody.innerHTML = list.map(function (row) {
          const t = row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : '—'
          const sec = sectionLabel(row)
          const secTitle = esc(sec)
          const secTip = escAttr(sec)
          return (
            '<tr>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);" title="' + escAttr(row.source_docx_basename || '') + '">' + esc(row.source_docx_parent_folder || row.source_docx_basename || '—') + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);">' + esc(row.person_name || '—') + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);">' + esc(row.role_label || '—') + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);font-size:12px;" title="' + secTip + '">' + secTitle + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);font-size:12px;">' + esc(row.run_batch_id || '—') + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);font-size:12px;">' + esc(t) + '</td>' +
            '<td style="padding:8px;border:1px solid var(--border-color,#ddd);">' +
            '<button class="btn btn-sm btn-primary" onclick="rqOpenDetail(\'' + String(row.id).replace(/'/g, '') + '\')">详情</button>' +
            '</td></tr>'
          )
        }).join('')
      }
      rqRenderPager(totalPages)
    } catch (e) {
      console.error(e)
      if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:16px;color:#c00;">加载失败：' + esc(e.message) + '</td></tr>'
    }
  }

  function rqRenderPager (totalPages) {
    const el = document.getElementById('rq-pager')
    if (!el) return
    const p = rqState.page
    el.innerHTML =
      '<button class="btn btn-sm btn-secondary" ' + (p <= 1 ? 'disabled' : '') + ' onclick="rqLoadList(' + (p - 1) + ')">上一页</button>' +
      '<span style="font-size:13px;">第 ' + p + ' / ' + totalPages + ' 页</span>' +
      '<button class="btn btn-sm btn-secondary" ' + (p >= totalPages ? 'disabled' : '') + ' onclick="rqLoadList(' + (p + 1) + ')">下一页</button>' +
      '<label style="font-size:13px;margin-left:8px;">每页<select onchange="rqSetPageSize(this.value)" style="padding:4px;">' +
      '<option value="10"' + (rqState.pageSize === 10 ? ' selected' : '') + '>10</option>' +
      '<option value="20"' + (rqState.pageSize === 20 ? ' selected' : '') + '>20</option>' +
      '<option value="50"' + (rqState.pageSize === 50 ? ' selected' : '') + '>50</option></select></label>'
  }

  window.rqSetPageSize = function (n) {
    rqState.pageSize = parseInt(n, 10) || 20
    rqState.page = 1
    rqLoadList(1)
  }

  window.rqResetFilters = function () {
    ;['rq-filter-basename', 'rq-filter-person', 'rq-filter-batch'].forEach(function (id) {
      const el = document.getElementById(id)
      if (el) el.value = ''
    })
    rqState.page = 1
    rqLoadList(1)
  }

  window.rqDownloadSplit = function (recordId) {
    if (!recordId) return
    window.open(apiUrl('/bid-resume-records/records/' + encodeURIComponent(recordId) + '/split-docx'), '_blank')
  }

  window.rqDownloadZipRecord = function (recordId) {
    if (!recordId) return
    window.open(apiUrl('/bid-resume-records/records/' + encodeURIComponent(recordId) + '/download-bundle'), '_blank')
  }

  window.rqDownloadZipPerson = function (personId) {
    window.open(apiUrl('/bid-resume-records/persons/' + encodeURIComponent(personId) + '/download-bundle'), '_blank')
  }

  window.rqCloseDetail = function () {
    const d = document.getElementById('rq-detail-dialog')
    if (d) d.close()
    rqState.currentPersonId = null
  }

  window.rqOpenDetail = async function (personId) {
    rqState.currentPersonId = personId
    const dlg = document.getElementById('rq-detail-dialog')
    const titleEl = document.getElementById('rq-detail-title')
    const root = document.getElementById('rq-doc-root')
    const btnSplit = document.getElementById('rq-btn-split')
    const btnZipR = document.getElementById('rq-btn-zip-record')
    const btnZipP = document.getElementById('rq-btn-zip-person')
    if (!dlg || !root) return
    root.innerHTML = '<p>加载中…</p>'
    dlg.showModal()
    try {
      const body = await rqFetchJson(apiUrl('/bid-resume-records/persons/' + encodeURIComponent(personId)))
      if (!body.success || !body.data) throw new Error(body.error || '无数据')
      const person = body.data.person
      const parent = body.data.parentRecord

      if (titleEl) {
        const proj = (person.source_docx_parent_folder || '').trim()
        const base = (person.source_docx_basename || '').trim()
        const nm = (person.person_name || '').trim()
        titleEl.textContent = [proj, base, nm].filter(Boolean).join(' · ') + ' · 简历详情'
      }

      if (parent && parent.id) {
        btnSplit.style.display = 'inline-block'
        btnZipR.style.display = 'inline-block'
        btnSplit.onclick = function () { rqDownloadSplit(parent.id) }
        btnZipR.onclick = function () { rqDownloadZipRecord(parent.id) }
      } else {
        btnSplit.style.display = 'none'
        btnZipR.style.display = 'none'
      }
      btnZipP.onclick = function () { rqDownloadZipPerson(personId) }

      root.innerHTML = renderDocTable(person)
    } catch (e) {
      console.error(e)
      root.innerHTML = '<p style="color:#c00;">' + esc(e.message) + '</p>'
    }
  }

  rqLoadList(1)
})()
