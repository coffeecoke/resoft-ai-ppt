/**
 * 售前分析 · 视频生成
 */
const PV_API = (window.location.origin || 'http://localhost:3000') + '/api'

/**
 * 与 AI_BACKEND_BASE_PATH 一致：lib 须走 /{prefix}/lib（网关只转发 /ai_backend 时根路径 /lib 会 404）。
 * - 独立页：/{prefix}/pages/presales-video.html
 * - 嵌入 admin 壳：/{prefix}/admin.html#presales-video（pathname 无 /pages/，须按 admin.html 解析前缀）
 */
function pvLibRoot() {
  const pathname = window.location.pathname || ''
  const pagesIdx = pathname.indexOf('/pages/')
  if (pagesIdx > 0) {
    return `${pathname.slice(0, pagesIdx)}/lib`
  }
  const adminTail = '/admin.html'
  if (pathname.endsWith(adminTail)) {
    const adminIdx = pathname.length - adminTail.length
    if (adminIdx > 0) {
      return `${pathname.slice(0, adminIdx)}/lib`
    }
  }
  return '/lib'
}

/** 推送对话 / 提交工作流 返回信息较长，Toast 多停留一会（毫秒） */
const PV_PUSH_WORKFLOW_TOAST_MS = 10000

/** 与 presalesVideoWecomPushService 建群默认名规则一致 */
const PV_WECOM_PRESALES_CHAT_SUFFIX = '-售前分析'

function pvResolveWecomPushCategoryFromXsfl(xsfl) {
  const t = String(xsfl || '').trim()
  if (t === '新产品') return 'newProduct'
  if (t === '新客户') return 'newCustomer'
  return 'upgrade'
}

function pvWecomChatNamePrefixForCategory(category) {
  if (category === 'newProduct') return '【新品】'
  if (category === 'newCustomer') return '【新客】'
  return '【升级】'
}

/** 与后端 stripLeadingTimeFromLabel 一致 */
function pvStripLeadingTimeFromLabel(name) {
  let s = String(name || '').trim()
  if (!s) return ''
  const patterns = [
    /^(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?\s*[_\-—．.\s]*/,
    /^(\d{4})(\d{2})(\d{2})\s*[_\-—．.\s]*/,
    /^(\d{4}-\d{2}-\d{2})(?:\s+\d{1,2}[:：]\d{2}(?::\d{2})?)?\s*[_\-—．.\s]*/
  ]
  for (const re of patterns) {
    if (re.test(s)) {
      s = s.replace(re, '').trim()
      break
    }
  }
  return s || String(name || '').trim()
}

function pvTrimToLength(s, max) {
  const arr = Array.from(String(s || '').trim())
  const m = max > 0 ? max : 40
  return arr.length <= m ? arr.join('') : `${arr.slice(0, m - 1).join('')}…`
}

/**
 * 【新品|新客|升级】+ lead_name + -售前分析（与后端 buildDefaultWecomPresalesChatName 对齐）
 * @param {string|null|undefined} leadNameRaw 对应 communication_reports.lead_name
 * @param {string|null|undefined} xsfl 线索类型，与 resolveClueSummary.clueType 一致
 */
function pvBuildDefaultPushVideoChatName(leadNameRaw, xsfl) {
  const category = pvResolveWecomPushCategoryFromXsfl(xsfl)
  const prefix = pvWecomChatNamePrefixForCategory(category)
  const leadRaw = leadNameRaw != null ? String(leadNameRaw).trim() : ''
  const stripped = pvStripLeadingTimeFromLabel(leadRaw)
  const bodySource = stripped || leadRaw || '售前'
  const maxBody = Math.max(
    4,
    48 - Array.from(prefix).length - Array.from(PV_WECOM_PRESALES_CHAT_SUFFIX).length
  )
  const body = pvTrimToLength(bodySource, maxBody)
  return `${prefix}${body}${PV_WECOM_PRESALES_CHAT_SUFFIX}`
}

/** 与后端 stripMarkdownHashForWecomAnalysisBody 一致：只去掉行首 ATX 标题的 # */
function pvStripHashForAnalysisPush(text) {
  const raw = String(text || '')
  const lines = raw.split(/\r?\n/)
  const out = lines.map((line) =>
    line.replace(/^(\s{0,3})(#{1,6})(?:\s+(.*)|$)/, (_, indent, _h, rest) => indent + (rest || ''))
  )
  return out.join('\n').trim()
}

/** 与 presales_video_tasks.pipeline_status 一致（含「无记录」） */
const PV_PIPELINE_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: '__none__', label: '无流水线记录' },
  { value: '角色确认中', label: '角色确认中' },
  { value: '角色已确认', label: '角色已确认' },
  { value: '已确认', label: '已确认（旧数据）' },
  { value: '推送对话', label: '推送对话' },
  { value: '提交工作流', label: '提交工作流' },
  { value: '分析中', label: '分析中' },
  { value: '分析完成', label: '分析完成' },
  { value: '分析失败', label: '分析失败' },
  { value: '推送分析文件', label: '推送分析文件' },
  { value: '视频生成', label: '视频生成' },
  { value: '视频生成失败', label: '视频生成失败' }
]

const pvState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  list: [],
  /** 「推送报告」编辑弹窗当前转录 id */
  pushReportTranscriptionId: null,
  /** 流水线筛选：all | __none__ | 具体状态 */
  pipelineStatus: 'all',
  /** 列表名称模糊查询（与接口 name 参数一致） */
  nameQuery: '',
  /** 创建时间起止 YYYY-MM-DD，与接口 dateFrom / dateTo 一致 */
  dateFrom: '',
  dateTo: '',
  /** 推送对话成功后缓存，供「提交工作流」传 Coze meeting-analysis：{ [transcriptionId]: { fileId, fileName } } */
  cozeUploadById: {},
  /** 「角色确认」弹窗当前转录 id */
  roleConfirmTranscriptionId: null,
  /** 「服务端流水线」弹窗当前转录 id */
  pipelineTranscriptionId: null
}

/** 本地日历日格式化为 YYYY-MM-DD（与 input[type=date] 一致） */
function pvFormatLocalYmd(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 近 n 个自然日（含今天）的 dateFrom / dateTo */
function pvDefaultLastNDaysRange(n) {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - (n - 1))
  return { dateFrom: pvFormatLocalYmd(start), dateTo: pvFormatLocalYmd(end) }
}

function pvToast(msg, type, durationMs) {
  if (typeof window.showMessage === 'function') {
    if (durationMs != null && durationMs > 0) {
      window.showMessage(msg, type || 'info', durationMs)
    } else {
      window.showMessage(msg, type || 'info')
    }
  } else {
    alert(msg)
  }
}

/** 列表接口返回的 videoTask 回填内存，刷新后仍可提交工作流 */
function pvSyncCozeCacheFromList(rows) {
  ;(rows || []).forEach((row) => {
    const vt = row.videoTask
    if (vt && vt.cozeFileId && String(vt.cozeFileName || '').trim()) {
      pvState.cozeUploadById[row.id] = {
        fileId: vt.cozeFileId,
        fileName: String(vt.cozeFileName).trim()
      }
    }
  })
}

function pvShowOverlay(show, text) {
  const el = document.getElementById('pv-overlay')
  const t = document.getElementById('pv-overlay-text')
  if (el) el.style.display = show ? 'flex' : 'none'
  if (t && text) t.textContent = text
}

window.pvLoadList = async function () {
  const loading = document.getElementById('pv-loading')
  const empty = document.getElementById('pv-empty')
  const list = document.getElementById('pv-list')
  const pag = document.getElementById('pv-pagination')
  if (loading) loading.style.display = 'block'
  if (empty) empty.style.display = 'none'
  if (list) list.style.display = 'none'
  if (pag) pag.style.display = 'none'

  try {
    const qInput0 = document.getElementById('pv-name-query')
    if (qInput0) pvState.nameQuery = String(qInput0.value || '').trim()
    const df0 = document.getElementById('pv-date-from')
    const dt0 = document.getElementById('pv-date-to')
    if (df0) pvState.dateFrom = String(df0.value || '').trim()
    if (dt0) pvState.dateTo = String(dt0.value || '').trim()
    const ps0 = document.getElementById('pv-pipeline-status')
    if (ps0) pvState.pipelineStatus = String(ps0.value || 'all').trim() || 'all'

    const nameParam =
      pvState.nameQuery && String(pvState.nameQuery).trim()
        ? `&name=${encodeURIComponent(String(pvState.nameQuery).trim())}`
        : ''
    const df = pvState.dateFrom && String(pvState.dateFrom).trim()
    const dt = pvState.dateTo && String(pvState.dateTo).trim()
    const dateParam =
      (df ? `&dateFrom=${encodeURIComponent(df)}` : '') + (dt ? `&dateTo=${encodeURIComponent(dt)}` : '')
    const pipeParam =
      pvState.pipelineStatus && pvState.pipelineStatus !== 'all'
        ? `&pipelineStatus=${encodeURIComponent(pvState.pipelineStatus)}`
        : ''
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions?page=${pvState.page}&pageSize=${pvState.pageSize}${nameParam}${dateParam}${pipeParam}`
    )
    const data = await res.json()
    if (!data.success) throw new Error(data.error || '加载失败')

    pvState.list = data.data.list || []
    pvSyncCozeCacheFromList(pvState.list)
    pvState.total = data.data.total || 0
    pvState.totalPages = data.data.totalPages || 1
    if (data.data.nameQuery != null) {
      pvState.nameQuery = data.data.nameQuery
    }
    if (data.data.dateFrom != null) {
      pvState.dateFrom = data.data.dateFrom
    }
    if (data.data.dateTo != null) {
      pvState.dateTo = data.data.dateTo
    }
    if (data.data.pipelineStatus != null) {
      pvState.pipelineStatus = data.data.pipelineStatus || 'all'
    }

    const totalEl = document.getElementById('pv-total-count')
    if (totalEl) {
      const q = pvState.nameQuery && String(pvState.nameQuery).trim()
      const df = pvState.dateFrom && String(pvState.dateFrom).trim()
      const dt = pvState.dateTo && String(pvState.dateTo).trim()
      let extra = ''
      if (q) extra += `（名称含「${pvState.nameQuery.trim()}」）`
      if (df || dt) {
        extra += `（创建 ${df || '不限'}～${dt || '不限'}）`
      }
      totalEl.textContent = `共 ${pvState.total} 条${extra}`
    }

    const qInput = document.getElementById('pv-name-query')
    if (qInput && document.activeElement !== qInput) {
      qInput.value = pvState.nameQuery || ''
    }
    const dfInput = document.getElementById('pv-date-from')
    const dtInput = document.getElementById('pv-date-to')
    if (dfInput && document.activeElement !== dfInput) {
      dfInput.value = pvState.dateFrom || ''
    }
    if (dtInput && document.activeElement !== dtInput) {
      dtInput.value = pvState.dateTo || ''
    }
    const psInput = document.getElementById('pv-pipeline-status')
    if (psInput && document.activeElement !== psInput) {
      psInput.value = pvState.pipelineStatus || 'all'
    }

    const emptyHint = document.getElementById('pv-empty-hint')
    if (emptyHint) {
      const hasFilter =
        (pvState.nameQuery && String(pvState.nameQuery).trim()) ||
        (pvState.dateFrom && String(pvState.dateFrom).trim()) ||
        (pvState.dateTo && String(pvState.dateTo).trim())
      emptyHint.textContent = hasFilter
        ? '当前查询条件下没有匹配记录，可点击「清除」后重试'
        : '暂无转录记录，请先在「语音转文本」中完成转录'
    }

    pvRenderTable()
    pvUpdatePagination()

    if (pvState.list.length === 0) {
      if (empty) empty.style.display = 'block'
    } else {
      if (list) list.style.display = 'block'
      if (pag) pag.style.display = 'flex'
    }
  } catch (e) {
    console.error(e)
    pvToast('加载失败: ' + e.message, 'error')
    if (empty) empty.style.display = 'block'
  } finally {
    if (loading) loading.style.display = 'none'
  }
}

/** 查询：回到第 1 页（条件在 pvLoadList 内从输入框同步） */
window.pvSearch = function () {
  pvState.page = 1
  pvLoadList()
}

/** 清除名称与日期条件并重新加载 */
window.pvClearNameSearch = function () {
  pvState.nameQuery = ''
  pvState.dateFrom = ''
  pvState.dateTo = ''
  pvState.pipelineStatus = 'all'
  const input = document.getElementById('pv-name-query')
  if (input) input.value = ''
  const df = document.getElementById('pv-date-from')
  const dt = document.getElementById('pv-date-to')
  if (df) df.value = ''
  if (dt) dt.value = ''
  const ps = document.getElementById('pv-pipeline-status')
  if (ps) ps.value = 'all'
  pvState.page = 1
  pvLoadList()
}

function pvEscapeHtml(text) {
  if (text == null) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/** 用于 title="" 等 HTML 属性 */
function pvEscapeAttr(text) {
  if (text == null) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function pvFormatDate(s) {
  if (!s) return '-'
  return new Date(s).toLocaleString('zh-CN')
}

/** 音频时长（秒）→ 显示 M:SS 或 H:MM:SS */
function pvFormatAudioDuration(sec) {
  if (sec == null || sec === '') return '-'
  const n = Number(sec)
  if (!Number.isFinite(n) || n < 0) return '-'
  const s = Math.floor(n)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
  }
  return `${m}:${String(r).padStart(2, '0')}`
}

function pvRenderTable() {
  const tbody = document.getElementById('pv-tbody')
  if (!tbody) return

  tbody.innerHTML = pvState.list
    .map((row) => {
      const name = row.originalFileName || row.name || '未命名'
      const customer = row.customerName || '-'
      const reportBadge = row.hasPresalesReport
        ? '<span class="badge badge-success">有</span>'
        : '<span class="badge badge-secondary">无</span>'
      const pipe = row.videoTask && row.videoTask.pipelineStatus
      const pipeTitle = pipe
        ? pvEscapeAttr(
            `${pipe}${row.videoTask.lastError ? ' | ' + row.videoTask.lastError : ''}`
          )
        : ''
      const pipeCell = pipe
        ? `<span class="pv-pipeline-badge" title="${pipeTitle}">${pvEscapeHtml(pipe)}</span>`
        : '<span class="pv-cell-muted">-</span>'
      return `
      <tr>
        <td class="pv-col-name" title="${pvEscapeAttr(name)}">
          <span class="pv-ellipsis">${pvEscapeHtml(name)}</span>
        </td>
        <td class="pv-col-customer" title="${pvEscapeAttr(customer)}">
          <span class="pv-cell-muted">${pvEscapeHtml(customer)}</span>
        </td>
        <td class="pv-col-duration" title="${row.audioDuration != null ? String(row.audioDuration) + ' 秒' : ''}"><span class="pv-time">${pvEscapeHtml(pvFormatAudioDuration(row.audioDuration))}</span></td>
        <td class="pv-col-time"><span class="pv-time">${pvEscapeHtml(pvFormatDate(row.createdAt))}</span></td>
        <td class="pv-col-pipeline">${pipeCell}</td>
        <td class="pv-col-report">${reportBadge}</td>
        <td class="pv-col-actions">
          <div class="pv-actions">
            <button type="button" class="btn btn-sm btn-outline pv-act-info" title="新标签页打开与企微角色确认相同的页面：查看/修改对话与说话人角色并保存" onclick="pvOpenCommunicationInfo('${row.id}')">查看信息</button>
            <button type="button" class="btn btn-sm btn-outline" style="border:1px solid var(--primary-color,#1890ff);color:var(--primary-color,#1890ff);background:transparent;" title="选择企微接收人并推送角色确认卡片（默认创建人 userid）" onclick="pvOpenRoleConfirmDialog('${row.id}')">角色确认</button>
            <button type="button" class="btn btn-sm btn-primary" title="打开弹窗：预览并下载合并 txt，再保存并尝试 Coze 上传（字段 file）；会议分析请点右侧「提交工作流」" onclick="pvPushDialogue('${row.id}')">推送对话</button>
            <button type="button" class="btn btn-sm pv-act-workflow" title="Coze：用「推送对话」缓存的 fileId/fileName 调 meeting-analysis 取 execute_id；或通用工作流 URL" onclick="pvSubmitWorkflow('${row.id}')">提交工作流</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="先打开可编辑报告正文，保存后再调用推送接口（异步 md 或旧版 JSON）" onclick="pvPushReport('${row.id}')">推送报告</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="填写企微 userid 建应用群发会话，推送报备摘要与视频" onclick="pvOpenPushVideoDialog('${row.id}')">推送视频</button>
            <button type="button" class="btn btn-sm btn-secondary" title="服务端自动串联：角色确认→推送对话→提交工作流→（等回调）→推送报告→推送视频；可不关页面" onclick="pvOpenPipelineDialog('${row.id}')">服务端流水线</button>
            <button type="button" class="btn btn-sm btn-outline pv-act-delete" title="删除本条转录及流水线数据；不删 CRM 源录音、问答对；跑批状态重置为待处理" onclick="pvDeleteTranscription('${row.id}')">删除</button>
          </div>
        </td>
      </tr>`
    })
    .join('')
}

window.pvDeleteTranscription = async function (id) {
  if (!id) return
  const row = (pvState.list || []).find((r) => r.id === id)
  const name = (row && (row.name || row.originalFileName)) || id
  const pipe = row && row.videoTask && row.videoTask.pipelineStatus
  const pipeHint = pipe ? `\n当前流水线：${pipe}` : ''
  const ok = window.confirm(
    `确定删除「${name}」整条转录记录？\n\n将删除：转录主表、角色/对话调整、售前视频任务、流水线记录、本地 txt/md（若非 CRM 源路径）、视频元数据（若有）。\n不会删除：CRM 源录音文件、问答对 concerns、交流报备/场次。\n对应 CRM 跑批状态会重置为待处理，重新语音转文本后可再关联报备。${pipeHint}\n\n此操作不可恢复。`
  )
  if (!ok) return
  pvShowOverlay(true, '正在删除…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'ngrok-skip-browser-warning': 'true' }
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) {
      pvToast((json && json.error) || `删除失败 HTTP ${res.status}`, 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    pvToast('已删除', 'success')
    if (pvState.list.length <= 1 && pvState.page > 1) {
      pvState.page -= 1
    }
    pvLoadList()
  } catch (e) {
    pvToast((e && e.message) || '删除失败', 'error')
  } finally {
    pvShowOverlay(false)
  }
}

function pvUpdatePagination() {
  const info = document.getElementById('pv-pagination-info')
  const pageInfo = document.getElementById('pv-page-info')
  const prev = document.getElementById('pv-prev')
  const next = document.getElementById('pv-next')
  if (info) {
    info.textContent = `共 ${pvState.total} 条，每页 ${pvState.pageSize} 条`
  }
  if (pageInfo) {
    pageInfo.textContent = `第 ${pvState.page} / ${Math.max(1, pvState.totalPages)} 页`
  }
  if (prev) prev.disabled = pvState.page <= 1
  if (next) next.disabled = pvState.page >= pvState.totalPages
}

window.pvChangePage = function (delta) {
  const next = pvState.page + delta
  if (next < 1 || next > pvState.totalPages) return
  pvState.page = next
  pvLoadList()
}

window.pvOpenCommunicationInfo = async function (id) {
  if (!id) return
  pvShowOverlay(true, '正在打开…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/speaker-confirm-link`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) {
      pvToast((json && json.error) || `打开失败 HTTP ${res.status}`, 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const path = json.data && json.data.pagePath
    if (!path) {
      pvToast('接口未返回页面路径', 'error')
      return
    }
    const url = (window.location.origin || '') + path
    window.open(url, '_blank', 'noopener,noreferrer')
    pvToast('已在新标签页打开（与「角色确认」外链同一页面，可保存）', 'info', 5000)
  } catch (e) {
    pvToast((e && e.message) || '请求失败', 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvOpenRoleConfirmDialog = function (id) {
  const dlg = document.getElementById('pv-role-confirm-dialog')
  const input = document.getElementById('pv-role-confirm-userid')
  if (!dlg || !input) {
    pvToast('页面缺少角色确认弹窗', 'error')
    return
  }
  pvState.roleConfirmTranscriptionId = id
  const row = (pvState.list || []).find((r) => r.id === id)
  const def =
    row && row.createdBy != null && String(row.createdBy).trim() ? String(row.createdBy).trim() : ''
  input.value = def
  if (typeof dlg.showModal === 'function') dlg.showModal()
  else dlg.setAttribute('open', '')
}

window.pvCloseRoleConfirmDialog = function () {
  const dlg = document.getElementById('pv-role-confirm-dialog')
  if (dlg) {
    if (typeof dlg.close === 'function') dlg.close()
    else dlg.removeAttribute('open')
  }
  pvState.roleConfirmTranscriptionId = null
}

window.pvOpenPipelineDialog = function (id) {
  const dlg = document.getElementById('pv-pipeline-dialog')
  const wx = document.getElementById('pv-pipeline-wecom')
  const pv = document.getElementById('pv-pipeline-push-users')
  const hint = document.getElementById('pv-pipeline-push-users-preview')
  const sk = document.getElementById('pv-pipeline-skip-role')
  if (!dlg || !pv) {
    pvToast('页面缺少服务端流水线弹窗', 'error')
    return
  }
  pvState.pipelineTranscriptionId = id
  const row = (pvState.list || []).find((r) => r.id === id)
  const defWx =
    row && row.createdBy != null && String(row.createdBy).trim() ? String(row.createdBy).trim() : ''
  if (wx) wx.value = defWx
  pv.value = ''
  if (hint) hint.textContent = '正在加载自动推送人员...'
  if (sk) sk.checked = false
  if (typeof dlg.showModal === 'function') dlg.showModal()
  else dlg.setAttribute('open', '')
  pvLoadPipelinePushUsersPreview(id)
}

window.pvClosePipelineDialog = function () {
  const dlg = document.getElementById('pv-pipeline-dialog')
  if (dlg) {
    if (typeof dlg.close === 'function') dlg.close()
    else dlg.removeAttribute('open')
  }
  pvState.pipelineTranscriptionId = null
}

window.pvSubmitPipelineRun = async function () {
  const id = pvState.pipelineTranscriptionId
  const wxEl = document.getElementById('pv-pipeline-wecom')
  const pvEl = document.getElementById('pv-pipeline-push-users')
  const skEl = document.getElementById('pv-pipeline-skip-role')
  const wecomUserId = wxEl ? String(wxEl.value || '').trim() : ''
  const pushVideoUserIds = pvEl ? String(pvEl.value || '').trim() : ''
  const skipRoleConfirm = skEl ? Boolean(skEl.checked) : false
  if (!id) {
    pvToast('未选择转录', 'error')
    return
  }
  if (!skipRoleConfirm && !wecomUserId) {
    pvToast('请填写接收人企微 userid，或勾选跳过角色确认', 'error')
    return
  }
  pvClosePipelineDialog()
  pvShowOverlay(true, '正在启动服务端流水线…')
  try {
    const body = {
      transcriptionId: id,
      skipRoleConfirm
    }
    if (wecomUserId) body.wecomUserId = wecomUserId
    if (pushVideoUserIds) body.pushVideoUserIds = pushVideoUserIds
    const res = await fetch(`${PV_API}/presales-video/pipeline-runs/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '启动失败', 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const run = data.data && data.data.run
    const phase = run && run.phase != null ? run.phase : '-'
    const st = run && run.run_status != null ? run.run_status : '-'
    pvToast(`服务端流水线已启动（状态 ${st}，阶段 ${phase}）。可关闭页面，后台将按定时任务与回调继续推进。`, 'success', PV_PUSH_WORKFLOW_TOAST_MS)
    if (typeof window.pvLoadList === 'function') window.pvLoadList()
  } catch (e) {
    pvToast('启动失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvSubmitRoleConfirm = async function () {
  const id = pvState.roleConfirmTranscriptionId
  const input = document.getElementById('pv-role-confirm-userid')
  const wecomUserId = input ? String(input.value || '').trim() : ''
  if (!id) {
    pvToast('未选择转录', 'error')
    return
  }
  if (!wecomUserId) {
    pvToast('请填写接收人企微 userid', 'error')
    return
  }
  pvCloseRoleConfirmDialog()
  pvShowOverlay(true, '正在推送角色确认…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/notify-role-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wecomUserId })
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '推送失败', 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const d = data.data || {}
    pvToast(
      `已推送至：${d.wecomUserId || wecomUserId}，对话条数：${d.dialogueCount ?? '-'}`,
      'success',
      PV_PUSH_WORKFLOW_TOAST_MS
    )
    if (typeof window.pvLoadList === 'function') window.pvLoadList()
  } catch (e) {
    pvToast('推送失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

/** 推送对话弹窗：预览/下载用缓存（与 GET push-dialogue-preview 一致） */
let pvPushDialogueTranscriptionId = null
let pvPushDialoguePreview = { txt: '', fileName: '' }

window.pvPushDialogue = async function (id) {
  pvPushDialogueTranscriptionId = id
  pvPushDialoguePreview = { txt: '', fileName: '' }
  const ta = document.getElementById('pv-push-dialogue-preview')
  const st = document.getElementById('pv-push-dialogue-status')
  const dl = document.getElementById('pv-push-dialogue-download')
  const sub = document.getElementById('pv-push-dialogue-submit')
  if (ta) {
    ta.value = ''
    ta.placeholder = '加载中…'
  }
  if (st) st.textContent = '正在加载合并对话…'
  if (dl) dl.disabled = true
  if (sub) sub.disabled = true
  document.getElementById('pv-push-dialogue-dialog')?.showModal()

  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-dialogue-preview`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      const err = data.error || '无法加载合并对话'
      if (st) st.textContent = err
      pvToast(err, 'error')
      return
    }
    const d = data.data || {}
    pvPushDialoguePreview = {
      txt: d.txt != null ? String(d.txt) : '',
      fileName: d.txtFileName ? String(d.txtFileName) : 'dialogue.txt'
    }
    if (ta) {
      ta.value = pvPushDialoguePreview.txt
      ta.placeholder = '加载完成后显示全文'
    }
    if (st) {
      let msg = '已就绪'
      if (d.dialogueSource) msg += `。来源：${d.dialogueSource}`
      if (Array.isArray(d.speakers) && d.speakers.length) msg += `；说话人 ${d.speakers.length} 个`
      st.textContent = msg
    }
    if (dl) dl.disabled = !pvPushDialoguePreview.txt
    if (sub) sub.disabled = false
  } catch (e) {
    if (st) st.textContent = e.message || String(e)
    pvToast('加载预览失败: ' + e.message, 'error')
  }
}

window.pvClosePushDialogueDialog = function () {
  document.getElementById('pv-push-dialogue-dialog')?.close()
  pvPushDialogueTranscriptionId = null
  pvPushDialoguePreview = { txt: '', fileName: '' }
}

window.pvDownloadPushDialogueTxt = function () {
  const txt = pvPushDialoguePreview.txt
  const name = pvPushDialoguePreview.fileName || 'dialogue.txt'
  if (!txt) {
    pvToast('暂无可下载内容，请先等待预览加载成功', 'error')
    return
  }
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

window.pvSubmitPushDialogue = async function () {
  const id = pvPushDialogueTranscriptionId
  if (!id) return
  pvShowOverlay(true, '正在生成 txt 并尝试上传…')
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-dialogue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      }
    )
    const data = await res.json().catch(() => ({}))
    const d = data.data || {}

    if (!res.ok) {
      const step = d.step ? ` [${d.step}]` : ''
      const loc = d.localPath ? ` 本地已保存: ${d.localPath}` : ''
      pvToast(
        (data.error || '推送失败') + step + loc,
        d.localPath ? 'warning' : 'error',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
      console.log('[presales-video] push-dialogue error', data)
      return
    }

    if (!data.success) {
      pvToast(
        `${data.error || '未完成'}（${d.step || '未知步骤'}）${d.localPath ? ` 本地：${d.localPath}` : ''} ${String(d.remoteBody || '').slice(0, 80)}`,
        'warning',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
      return
    }

    if (d.uploadSkipped) {
      pvToast(
        `已保存本地 txt（未配置上传 URL）。\n${d.localPath || ''}`,
        'info',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
      console.log('[presales-video] push-dialogue', d)
      pvClosePushDialogueDialog()
      return
    }

    const vtPush = d.videoTask
    if (vtPush && vtPush.cozeFileId && String(vtPush.cozeFileName || '').trim()) {
      pvState.cozeUploadById[id] = {
        fileId: vtPush.cozeFileId,
        fileName: String(vtPush.cozeFileName).trim()
      }
    } else if (d.cozeFileId) {
      pvState.cozeUploadById[id] = {
        fileId: d.cozeFileId,
        fileName: d.cozeFileName || d.txtFileName || ''
      }
    }
    const fid = d.cozeFileId ? `file_id: ${d.cozeFileId}` : ''
    const fn = d.cozeFileName ? ` file_name: ${d.cozeFileName}` : ''
    pvToast(
      `上传完成。${fid}${fn}。就绪后可点「提交工作流」`.trim(),
      'success',
      PV_PUSH_WORKFLOW_TOAST_MS
    )
    console.log('[presales-video] push-dialogue', d)
    pvClosePushDialogueDialog()
  } catch (e) {
    pvToast('推送失败: ' + e.message, 'error', PV_PUSH_WORKFLOW_TOAST_MS)
  } finally {
    pvShowOverlay(false)
  }
}

/** markdown-it 脚本只加载一次 */
let pvMarkdownItLoadPromise = null
let pvMarkdownRenderer = null

function pvLoadMarkdownItOnce() {
  if (typeof window.markdownit === 'function') {
    return Promise.resolve()
  }
  if (pvMarkdownItLoadPromise) {
    return pvMarkdownItLoadPromise
  }
  pvMarkdownItLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${pvLibRoot()}/markdown-it/markdown-it.min.js`
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      pvMarkdownItLoadPromise = null
      reject(new Error('无法加载 markdown-it'))
    }
    document.head.appendChild(s)
  })
  return pvMarkdownItLoadPromise
}

function pvLoadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('脚本加载失败: ' + src))
    document.head.appendChild(s)
  })
}

function pvEnsureCmStyles() {
  if (document.getElementById('pv-codemirror-base-css')) return
  const base = document.createElement('link')
  base.id = 'pv-codemirror-base-css'
  base.rel = 'stylesheet'
  base.href = `${pvLibRoot()}/codemirror/lib/codemirror.css`
  document.head.appendChild(base)
  const theme = document.createElement('link')
  theme.id = 'pv-codemirror-theme-css'
  theme.rel = 'stylesheet'
  theme.href = `${pvLibRoot()}/codemirror/theme/darcula.css`
  document.head.appendChild(theme)
}

let pvCmMarkdownPromise = null
let pvCodeMirrorInstance = null
let pvReportCmResizeObs = null
let pvReportCmResizeRaf = 0

function pvCmMarkdownModeReady() {
  if (typeof window.CodeMirror !== 'function') return false
  try {
    const m = window.CodeMirror.getMode({ indentUnit: 2, tabSize: 2 }, 'markdown')
    return !!(m && m.name && m.name !== 'null')
  } catch (_) {
    return false
  }
}

function pvDisconnectReportCmResize() {
  cancelAnimationFrame(pvReportCmResizeRaf)
  pvReportCmResizeRaf = 0
  if (pvReportCmResizeObs) {
    pvReportCmResizeObs.disconnect()
    pvReportCmResizeObs = null
  }
}

function pvObserveReportCmResize() {
  const wrap = document.querySelector('.pv-report-cm-wrap')
  const cm = pvCodeMirrorInstance
  if (!wrap || !cm) return
  pvDisconnectReportCmResize()
  pvReportCmResizeObs = new ResizeObserver(function (entries) {
    cancelAnimationFrame(pvReportCmResizeRaf)
    pvReportCmResizeRaf = requestAnimationFrame(function () {
      for (let i = 0; i < entries.length; i++) {
        const h = Math.max(220, Math.floor(entries[i].contentRect.height))
        cm.setSize(null, h)
      }
      cm.refresh()
    })
  })
  pvReportCmResizeObs.observe(wrap)
}

function pvDisposeReportCodeMirrorIfStale() {
  const cm = pvCodeMirrorInstance
  if (!cm) return
  let wrapEl
  try {
    wrapEl = cm.getWrapperElement()
  } catch (_) {
    pvCodeMirrorInstance = null
    return
  }
  if (wrapEl && document.body.contains(wrapEl)) return
  pvDisconnectReportCmResize()
  try {
    cm.toTextArea()
  } catch (_) {}
  pvCodeMirrorInstance = null
}

function pvEnsureCodeMirrorMarkdown() {
  if (pvCmMarkdownModeReady()) {
    return Promise.resolve()
  }
  if (pvCmMarkdownPromise) {
    return pvCmMarkdownPromise
  }
  pvCmMarkdownPromise = (async function () {
    pvEnsureCmStyles()
    if (typeof window.CodeMirror !== 'function') {
      await pvLoadScript(`${pvLibRoot()}/codemirror/lib/codemirror.js`)
    }
    if (!pvCmMarkdownModeReady()) {
      await pvLoadScript(`${pvLibRoot()}/codemirror/mode/xml/xml.js`)
      await pvLoadScript(`${pvLibRoot()}/codemirror/mode/markdown/markdown.js`)
    }
    if (!pvCmMarkdownModeReady()) {
      pvCmMarkdownPromise = null
      throw new Error('CodeMirror Markdown 模式加载失败')
    }
  })().catch(function (e) {
    pvCmMarkdownPromise = null
    throw e
  })
  return pvCmMarkdownPromise
}

/**
 * 与后端一致：把误存成的字面量 \\n（反斜杠+n）还原为真换行，否则整篇一行、编辑器无法折行。
 */
function pvUnescapeReportBodyNewlines(s) {
  const str = s != null ? String(s) : ''
  if (!str.includes('\\n')) return str
  const literalCount = (str.match(/\\n/g) || []).length
  const realNewlines = (str.match(/\n/g) || []).length
  if (literalCount < 2) return str
  const shouldUnescape =
    (realNewlines <= 2 && literalCount >= realNewlines + 1) ||
    literalCount > realNewlines * 3 ||
    (literalCount >= 8 && realNewlines * 4 < literalCount)
  if (!shouldUnescape) return str
  let out = str.replace(/\\r\\n/g, '\n').replace(/\\r/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t')
  if (out.includes('\\n')) {
    out = out.replace(/\\\\n/g, '\n')
  }
  return out
}

function pvGetReportEditorValue() {
  const cm = pvCodeMirrorInstance
  if (cm) {
    try {
      const w = cm.getWrapperElement()
      if (w && document.body.contains(w)) {
        return cm.getValue()
      }
    } catch (_) {}
  }
  const ta = document.getElementById('pv-report-editor')
  return ta ? String(ta.value || '') : ''
}

function pvGetMarkdownRenderer() {
  if (typeof window.markdownit !== 'function') {
    return null
  }
  if (!pvMarkdownRenderer) {
    pvMarkdownRenderer = window.markdownit({
      html: false,
      linkify: true,
      breaks: true,
      typographer: true
    })
  }
  return pvMarkdownRenderer
}

let pvReportPreviewTimer = null

function pvRenderReportPreviewNow() {
  const wrap = document.getElementById('pv-report-preview')
  if (!wrap) return
  const md = pvGetMarkdownRenderer()
  if (!md) {
    wrap.innerHTML = '<p class="pv-md-preview-empty">正在加载预览引擎…</p>'
    return
  }
  const raw = pvGetReportEditorValue()
  if (!raw.trim()) {
    wrap.innerHTML = '<p class="pv-md-preview-empty">（暂无内容）</p>'
    return
  }
  try {
    wrap.innerHTML = md.render(raw)
  } catch (e) {
    wrap.innerHTML =
      '<p class="pv-md-preview-error">预览解析失败：' +
      pvEscapeHtml((e && e.message) || String(e)) +
      '</p>'
  }
}

function pvScheduleReportPreview() {
  if (pvReportPreviewTimer) {
    clearTimeout(pvReportPreviewTimer)
  }
  pvReportPreviewTimer = setTimeout(function () {
    pvReportPreviewTimer = null
    pvRenderReportPreviewNow()
  }, 140)
}

window.pvSetReportLayout = function (layout) {
  const panels = document.getElementById('pv-report-panels')
  if (!panels) return
  const norm = layout === 'edit' || layout === 'preview' ? layout : 'split'
  panels.setAttribute('data-layout', norm)
  document.querySelectorAll('.pv-report-layout-btn').forEach(function (btn) {
    const active = btn.getAttribute('data-layout') === norm
    btn.classList.toggle('is-active', active)
    btn.setAttribute('aria-pressed', active ? 'true' : 'false')
  })
  pvRenderReportPreviewNow()
}

window.pvCloseReportDialog = function () {
  pvDisconnectReportCmResize()
  const dlg = document.getElementById('pv-report-dialog')
  if (dlg) {
    if (typeof dlg.close === 'function') dlg.close()
    else dlg.removeAttribute('open')
  }
  pvState.pushReportTranscriptionId = null
}

async function pvOpenPushReportEditor(id, content) {
  await pvEnsureCodeMirrorMarkdown()
  const dlg = document.getElementById('pv-report-dialog')
  const ta = document.getElementById('pv-report-editor')
  if (!dlg || !ta || typeof window.CodeMirror !== 'function') {
    pvToast('页面缺少报告编辑弹窗或 CodeMirror 未加载', 'error')
    return
  }
  pvDisposeReportCodeMirrorIfStale()
  pvState.pushReportTranscriptionId = id
  const text = pvUnescapeReportBodyNewlines(content != null ? String(content) : '')

  let cm = pvCodeMirrorInstance
  const reuse = cm && document.body.contains(cm.getWrapperElement())
  if (!reuse) {
    if (cm) {
      try {
        cm.toTextArea()
      } catch (_) {}
      pvCodeMirrorInstance = null
    }
    cm = window.CodeMirror.fromTextArea(ta, {
      mode: 'markdown',
      theme: 'darcula',
      lineNumbers: true,
      /** 软换行：超长一行在编辑区内自动折行显示，不会在正文里插入换行符 */
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      viewportMargin: 120
    })
    pvCodeMirrorInstance = cm
    if (!cm._pvPreviewBound) {
      cm.on('change', pvScheduleReportPreview)
      cm._pvPreviewBound = true
    }
  }
  cm.setValue(text)
  window.pvSetReportLayout('split')
  pvRenderReportPreviewNow()
  if (typeof dlg.showModal === 'function') dlg.showModal()
  else dlg.setAttribute('open', '')
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      const wrap = document.querySelector('.pv-report-cm-wrap')
      if (wrap) {
        const h = Math.max(220, Math.floor(wrap.getBoundingClientRect().height))
        if (h > 0) cm.setSize(null, h)
      }
      cm.refresh()
      pvObserveReportCmResize()
    })
  })
}

window.pvCopyReport = async function () {
  const t = pvGetReportEditorValue()
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
    pvToast('已复制', 'success')
  } catch {
    pvToast('复制失败', 'error')
  }
}

/** 将当前报告 Markdown 另存为 .md（与「仅保存」内容来源一致，下载为本地文件） */
window.pvDownloadReport = function () {
  const t = pvGetReportEditorValue()
  if (!String(t).trim()) {
    pvToast('暂无内容可下载', 'error')
    return
  }
  const id = pvState.pushReportTranscriptionId
  let base = 'presales_report'
  if (id) {
    const row = pvState.list.find((r) => r.id === id)
    const raw = row && (row.originalFileName || row.name) ? String(row.originalFileName || row.name) : ''
    if (raw) {
      base = raw.replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 120)
    } else {
      base = `presales_report_${id}`
    }
  }
  if (!/\.md$/i.test(base)) {
    base += '.md'
  }
  const blob = new Blob([t], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = base
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  pvToast('已开始下载', 'success')
}

/** 调用服务端推送报告（不在此弹窗内保存正文） */
async function pvDoPushReport(id) {
  pvShowOverlay(true, '正在推送报告...')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      pvToast(data.error || '请求失败', 'error')
      return
    }
    const d = data.data || {}
    if (!data.success) {
      pvToast(
        `第三方 HTTP ${d.remoteStatus || '-'}：${String(d.remoteBody || '').slice(0, 120)}`,
        'warning'
      )
      return
    }
    const okMsg =
      d.mode === 'async_task'
        ? `异步任务已提交（HTTP ${d.remoteStatus}）`
        : d.mode === 'subtitle_video_async'
          ? `字幕视频任务已提交（HTTP ${d.remoteStatus}）`
          : `推送报告成功（HTTP ${d.remoteStatus}）`
    pvToast(okMsg, 'success')
    console.log('[presales-video] push-report', d)
    if (typeof window.pvLoadList === 'function') window.pvLoadList()
  } catch (e) {
    pvToast('推送报告失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvSavePushReportOnly = async function () {
  const id = pvState.pushReportTranscriptionId
  if (!id) {
    pvToast('未选择转录', 'error')
    return
  }
  pvShowOverlay(true, '正在保存…')
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/analysis-for-push`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: pvGetReportEditorValue() })
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '保存失败', 'error')
      return
    }
    pvToast('已保存到服务器（md 与库已同步）', 'success')
    if (typeof window.pvLoadList === 'function') window.pvLoadList()
  } catch (e) {
    pvToast('保存失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvSavePushReportAndPush = async function () {
  const id = pvState.pushReportTranscriptionId
  if (!id) {
    pvToast('未选择转录', 'error')
    return
  }
  pvShowOverlay(true, '正在保存…')
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/analysis-for-push`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: pvGetReportEditorValue() })
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '保存失败', 'error')
      return
    }
  } catch (e) {
    pvToast('保存失败: ' + e.message, 'error')
    return
  } finally {
    pvShowOverlay(false)
  }
  pvCloseReportDialog()
  await pvDoPushReport(id)
}

window.pvPushReport = async function (id) {
  if (!id) return
  pvShowOverlay(true, '正在加载报告…')
  try {
    await Promise.all([pvLoadMarkdownItOnce(), pvEnsureCodeMirrorMarkdown()])
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/analysis-for-push`
    )
    const data = await res.json().catch(() => ({}))
    if (res.ok && data.success && data.data && typeof data.data.content === 'string') {
      await pvOpenPushReportEditor(id, data.data.content)
      return
    }
  } catch (e) {
    const msg = e && e.message ? String(e.message) : ''
    if (msg.includes('markdown-it') || msg.includes('CodeMirror') || msg.includes('脚本加载')) {
      pvToast(msg || '资源加载失败', 'error')
      return
    }
    console.warn('[presales-video] analysis-for-push GET', e)
  } finally {
    pvShowOverlay(false)
  }

  if (
    !confirm(
      '未能从服务器加载可编辑的分析正文（无主任务、分析尚未回调或仅有旧版售前 JSON 时会出现）。\n\n' +
        '是否跳过编辑，直接调用「推送报告」接口？\n' +
        '· 异步：需 md 路径（reserve_3）与 execute_id；\n' +
        '· 旧版：需本地售前分析 JSON。'
    )
  ) {
    return
  }
  await pvDoPushReport(id)
}

window.pvSubmitWorkflow = async function (id) {
  const cached = pvState.cozeUploadById[id]
  const row = pvState.list.find((r) => r.id === id)
  const vt = row && row.videoTask
  const hasDbCoze =
    vt && vt.cozeFileId && String(vt.cozeFileName || '').trim()
  const hasMemCoze = cached && cached.fileId && String(cached.fileName || '').trim()
  const hasCozePair = !!(hasMemCoze || hasDbCoze)
  const bodyObj = hasMemCoze
    ? { fileId: cached.fileId, fileName: String(cached.fileName).trim() }
    : {}

  if (hasMemCoze) {
    if (
      !confirm(
        `将使用当前缓存（含列表同步）的 Coze 参数提交会议分析：\nfileId=${cached.fileId}\nfileName=${cached.fileName}\n\n需配置 PRESALES_VIDEO_COZE_MEETING_ANALYSIS_URL。\n确定？`
      )
    ) {
      return
    }
  } else if (hasDbCoze) {
    if (
      !confirm(
        `本页内存无缓存，但数据库已有上传记录，将传空 body 由后端从 presales_video_tasks 读取：\nfileId=${vt.cozeFileId}\nfileName=${vt.cozeFileName}\n\n需配置 Coze 会议分析 URL。\n确定？`
      )
    ) {
      return
    }
  } else {
    if (
      !confirm(
        '无 Coze fileId/fileName（请先「推送对话」成功并落库）。\n若仅配置通用 PRESALES_VIDEO_WORKFLOW_SUBMIT_URL，可不传 body 走通用工作流。\n仍要尝试提交？'
      )
    ) {
      return
    }
  }

  pvShowOverlay(true, '正在提交工作流…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/submit-workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const step = data.data && data.data.step ? ` [${data.data.step}]` : ''
      const le = data.data && data.data.videoTask && data.data.videoTask.lastError
      pvToast(
        (data.error || '请求失败') + step + (le ? `\n${le}` : ''),
        'error',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
      if (data.data && data.data.videoTask) pvSyncCozeCacheFromList([{ id, videoTask: data.data.videoTask }])
      pvLoadList()
      return
    }
    const d = data.data || {}
    if (!data.success) {
      const step = d.step ? ` [${d.step}]` : ''
      const le = d.videoTask && d.videoTask.lastError
      pvToast(
        (data.error || '未完成') +
          step +
          (le ? `\n${le}` : '') +
          (d.remoteBody ? ` ${String(d.remoteBody).slice(0, 100)}` : ''),
        'warning',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
      if (d.videoTask) pvSyncCozeCacheFromList([{ id, videoTask: d.videoTask }])
      pvLoadList()
      return
    }
    if (d.mode === 'coze_meeting_analysis' && d.executeId) {
      pvToast(
        `会议分析已提交，execute_id: ${d.executeId}`,
        'success',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
    } else if (d.remoteStatus != null) {
      pvToast(
        `工作流已提交（HTTP ${d.remoteStatus}）`,
        'success',
        PV_PUSH_WORKFLOW_TOAST_MS
      )
    } else {
      pvToast('工作流已提交', 'success', PV_PUSH_WORKFLOW_TOAST_MS)
    }
    if (d.videoTask) pvSyncCozeCacheFromList([{ id, videoTask: d.videoTask }])
    pvLoadList()
    console.log('[presales-video] submit-workflow', d)
  } catch (e) {
    pvToast('提交工作流失败: ' + e.message, 'error', PV_PUSH_WORKFLOW_TOAST_MS)
  } finally {
    pvShowOverlay(false)
  }
}

let pvPushVideoTranscriptionId = null
/** 推送视频弹窗：psv_video_info.url，供「新窗口播放」 */
let pvPushVideoPsvUrl = null
/** 当前转录是否短于「推送报告」分界时长（与 PRESALES_VIDEO_REPORT_DURATION_SPLIT_SEC 一致） */
let pvPushVideoIsShort = false

/** 与后端 stripFileSuffix 一致：去掉末尾扩展名，作卡片标题默认值 */
function pvStripFileSuffix(name) {
  const s = String(name || '').trim()
  if (!s) return ''
  return s.replace(/\.[^./\\]{1,10}$/g, '').trim()
}

async function pvLoadPushVideoPlayUrl(id) {
  const statusEl = document.getElementById('pv-push-video-url-status')
  const btn = document.getElementById('pv-push-video-play-btn')
  pvPushVideoPsvUrl = null
  if (!statusEl || !btn) return
  btn.style.display = 'none'
  btn.textContent = ''
  btn.removeAttribute('title')
  statusEl.textContent = '正在加载视频地址…'
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/psv-video-info`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      statusEl.textContent = data.error || '加载失败'
      return
    }
    const d = data.data || {}
    const url = d.url != null && String(d.url).trim() ? String(d.url).trim() : ''
    if (!url) {
      statusEl.textContent = d.message || '暂无播放地址'
      return
    }
    pvPushVideoPsvUrl = url
    const title = d.title ? String(d.title) : ''
    statusEl.textContent = title ? `标题：${title}` : '点击下方链接在新窗口打开播放'
    const short = url.length > 96 ? url.slice(0, 94) + '…' : url
    btn.textContent = short
    btn.title = url
    btn.style.display = 'inline-block'
  } catch (e) {
    statusEl.textContent = e.message || String(e)
  }
}

window.pvOpenPsvVideoPlayWindow = function () {
  const u = pvPushVideoPsvUrl
  if (!u) {
    pvToast('无可播放地址', 'error')
    return
  }
  const w = window.open(
    u,
    'pvPsvVideoPlay',
    'noopener,noreferrer,width=1150,height=720,scrollbars=yes,resizable=yes'
  )
  if (w) {
    try {
      w.focus()
    } catch (_) {}
  } else {
    pvToast('无法打开新窗口，请检查浏览器是否拦截弹窗', 'warning', 6000)
  }
}

function pvSetPushDealMembersNote(deal) {
  const textEl = document.getElementById('pv-push-deal-members-text')
  if (!textEl) return
  const ids = Array.isArray(deal && deal.fixedDealtIds)
    ? deal.fixedDealtIds.map((u) => String(u || '').trim()).filter(Boolean)
    : []
  if (ids.length === 0) {
    textEl.textContent = '此轮发牌人员：暂无（请检查固定成员池或发牌状态）'
    return
  }
  textEl.textContent = `此轮发牌人员：${ids.join(',')}`
}

async function pvLoadPipelinePushUsersPreview(id) {
  const ta = document.getElementById('pv-pipeline-push-users')
  const hint = document.getElementById('pv-pipeline-push-users-preview')
  if (!ta) return
  if (hint) hint.textContent = '正在按全部固定成员+参与人+上级计算…'
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-video-users`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      throw new Error(data.error || '加载推送人员失败')
    }
    const d = data.data || {}
    const users = Array.isArray(d.suggestedSubmitUserIds)
      ? d.suggestedSubmitUserIds
      : Array.isArray(d.userIds)
        ? d.userIds
        : []
    ta.value = users.join(',')
    const excluded = Array.isArray(d.excludedUserIds) ? d.excludedUserIds : []
    const deal = d.deal || {}
    if (hint) {
      const part1 = `已反显 ${users.length} 人（含全部固定成员）`
      const part2 = excluded.length > 0 ? `；env 已排除：${excluded.join(',')}` : ''
      const dealHint =
        deal.fixedDealtIds && deal.fixedDealtIds.length > 0
          ? `；本步发牌：${deal.fixedDealtIds.join(',')}`
          : ''
      hint.textContent = part1 + part2 + dealHint
    }
  } catch (e) {
    if (hint) hint.textContent = `自动反显失败：${e.message || e}；可手动填写 userid`
    ta.value = ''
  }
}

async function pvLoadPushVideoUsersPreview(id) {
  const ta = document.getElementById('pv-push-video-users')
  const hint = document.getElementById('pv-push-video-preview')
  if (!ta) return
  if (hint) hint.textContent = '正在按全部固定成员+参与人+上级计算建群名单…'
  const dealTextEl = document.getElementById('pv-push-deal-members-text')
  if (dealTextEl) dealTextEl.textContent = '正在加载此轮发牌人员…'
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-video-users`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      throw new Error(data.error || '加载推送人员失败')
    }
    const d = data.data || {}
    const users = Array.isArray(d.suggestedSubmitUserIds)
      ? d.suggestedSubmitUserIds
      : Array.isArray(d.userIds)
        ? d.userIds
        : []
    ta.value = users.join(',')
    const excluded = Array.isArray(d.excludedUserIds) ? d.excludedUserIds : []
    const deal = d.deal || {}
    pvSetPushDealMembersNote(deal)
    if (hint) {
      const part1 = `已反显建群/同步 ${users.length} 人（含全部固定成员；保存时以文本框为准）`
      const part2 = excluded.length > 0 ? `；env 已排除：${excluded.join(',')}` : ''
      hint.textContent = part1 + part2
    }
  } catch (e) {
    if (hint) hint.textContent = `自动反显失败：${e.message || e}；可手动填写 userid`
    if (dealTextEl) dealTextEl.textContent = '此轮发牌人员：加载失败'
    ta.value = ''
  }
}

async function pvLoadPushMarkdownPreview(id) {
  const clueTa = document.getElementById('pv-push-md-clue')
  const reportTa = document.getElementById('pv-push-md-report')
  const st = document.getElementById('pv-push-md-preview-status')
  if (!clueTa || !reportTa) return
  clueTa.value = ''
  reportTa.value = ''
  if (st) st.textContent = '正在加载群内纯文本预览…'
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-content-preview`
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      throw new Error(data.error || '加载预览失败')
    }
    const d = data.data || {}
    clueTa.value = d.clueMarkdown != null ? String(d.clueMarkdown) : ''
    reportTa.value = d.reportMarkdown != null ? String(d.reportMarkdown) : ''
    const splitSec = d.splitSec != null && !Number.isNaN(Number(d.splitSec)) ? Number(d.splitSec) : 600
    const dur = d.audioDurationSec != null && !Number.isNaN(Number(d.audioDurationSec)) ? Number(d.audioDurationSec) : null
    pvPushVideoIsShort = Boolean(d.isShortAudio)
    const block = document.getElementById('pv-push-report-analysis-block')
    const taAnalysis = document.getElementById('pv-push-md-report-analysis')
    const hintAnalysis = document.getElementById('pv-push-report-analysis-hint')
    if (block && taAnalysis) {
      if (d.isShortAudio) {
        block.style.display = 'block'
        taAnalysis.value =
          d.reportAnalysisMarkdown != null
            ? pvStripHashForAnalysisPush(String(d.reportAnalysisMarkdown))
            : ''
        if (hintAnalysis) {
          const durTxt =
            dur != null && !Number.isNaN(dur) ? `当前录音约 ${Math.round(dur)} 秒` : '未获取到录音时长'
          const err = d.reportAnalysisLoadError ? ` 加载正文：${String(d.reportAnalysisLoadError)}` : ''
          hintAnalysis.textContent = `${durTxt}；短于分界 ${splitSec} 秒时，本节将单独发入群（在报备摘要之后）。${err}`
        }
      } else {
        block.style.display = 'none'
        taAnalysis.value = ''
        if (hintAnalysis) hintAnalysis.textContent = ''
      }
    }
    const reuse = d.willReuseChat
      ? '本次将复用已有群：首段「线索说明」不会发送。'
      : '本次若为新建群：先发①（若非空），再发②。'
    const miss = d.reportMatched === false ? ' 未匹配到报备时② 为系统提示文案，请核对。' : ''
    const chatNameEl = document.getElementById('pv-push-video-chat-name')
    if (chatNameEl && d.defaultChatName) {
      chatNameEl.value = String(d.defaultChatName)
    }
    const catHint =
      d.wecomPushCategory === 'newProduct'
        ? '（新品）'
        : d.wecomPushCategory === 'newCustomer'
          ? '（新客）'
          : d.wecomPushCategory === 'upgrade'
            ? '（升级）'
            : ''
    if (st) st.textContent = reuse + miss + (catHint ? ` 默认群名/卡片样式：${catHint}` : '')
  } catch (e) {
    if (st) {
      st.textContent = `预览加载失败：${e.message || e}；保存时将改用服务端自动生成正文（若不刷新预览）。`
    }
  }
}

/**
 * 推送视频弹窗打开瞬间的默认群名：优先列表接口下发的 defaultPushVideoChatName（与后端一致）。
 */
function pvDefaultPushVideoChatName(row) {
  if (row && row.defaultPushVideoChatName != null && String(row.defaultPushVideoChatName).trim()) {
    return String(row.defaultPushVideoChatName).trim()
  }
  return pvBuildDefaultPushVideoChatName(null, null)
}

window.pvOpenPushVideoDialog = function (id) {
  pvPushVideoTranscriptionId = id
  pvPushVideoIsShort = false
  const block = document.getElementById('pv-push-report-analysis-block')
  const taAnalysis = document.getElementById('pv-push-md-report-analysis')
  const hintAnalysis = document.getElementById('pv-push-report-analysis-hint')
  if (block) block.style.display = 'none'
  if (taAnalysis) taAnalysis.value = ''
  if (hintAnalysis) hintAnalysis.textContent = ''
  const ta = document.getElementById('pv-push-video-users')
  const hint = document.getElementById('pv-push-video-preview')
  const cardTitleEl = document.getElementById('pv-push-video-card-title')
  const chatNameEl = document.getElementById('pv-push-video-chat-name')
  if (ta) ta.value = ''
  if (hint) hint.textContent = '正在加载自动推送人员...'
  const dealTextEl = document.getElementById('pv-push-deal-members-text')
  if (dealTextEl) dealTextEl.textContent = '正在加载此轮发牌人员…'
  const row = pvState.list.find((r) => r.id === id)
  if (cardTitleEl) {
    const raw = row && (row.originalFileName || row.name) ? String(row.originalFileName || row.name) : ''
    const defTitle = pvStripFileSuffix(raw) || '售前视频'
    cardTitleEl.value = defTitle
  }
  if (chatNameEl) {
    chatNameEl.value = pvDefaultPushVideoChatName(row)
  }
  document.getElementById('pv-push-video-dialog')?.showModal()
  pvLoadPushVideoUsersPreview(id)
  pvLoadPushMarkdownPreview(id)
  pvLoadPushVideoPlayUrl(id)
}

window.pvClosePushVideoDialog = function () {
  document.getElementById('pv-push-video-dialog')?.close()
  pvPushVideoTranscriptionId = null
  pvPushVideoPsvUrl = null
  pvPushVideoIsShort = false
  const block = document.getElementById('pv-push-report-analysis-block')
  const taAnalysis = document.getElementById('pv-push-md-report-analysis')
  const hintAnalysis = document.getElementById('pv-push-report-analysis-hint')
  if (block) block.style.display = 'none'
  if (taAnalysis) taAnalysis.value = ''
  if (hintAnalysis) hintAnalysis.textContent = ''
  const st = document.getElementById('pv-push-video-url-status')
  const btn = document.getElementById('pv-push-video-play-btn')
  if (st) st.textContent = '—'
  if (btn) {
    btn.style.display = 'none'
    btn.textContent = ''
    btn.removeAttribute('title')
  }
}

/** 不建群：仅向 rxkf01（或后端配置的「小R」）单发售前视频文本卡片 */
window.pvSubmitPushVideoCardToRxkf = async function () {
  const id = pvPushVideoTranscriptionId
  if (!id) return
  const cardTitleRaw =
    (document.getElementById('pv-push-video-card-title') &&
      document.getElementById('pv-push-video-card-title').value) ||
    ''
  const cardTitleTrim = String(cardTitleRaw).trim()
  pvShowOverlay(true, '正在向小R发送卡片…')
  try {
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-video-card-to-rxkf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(cardTitleTrim ? { cardTitle: cardTitleTrim } : {})
        })
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '发送失败', 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const d = data.data || {}
    const cid = d.chatId != null && String(d.chatId).trim() ? String(d.chatId).trim() : ''
    pvToast(
      cid
        ? `已向 ${d.touser || 'rxkf01'} 发送售前视频卡片（未建群）；伪 chatId=${cid}（已写入 reserve_4）。`
        : `已向 ${d.touser || 'rxkf01'} 发送售前视频卡片（未建群）。`,
      'success',
      PV_PUSH_WORKFLOW_TOAST_MS
    )
  } catch (e) {
    pvToast('发送失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvSubmitPushVideo = async function () {
  const id = pvPushVideoTranscriptionId
  if (!id) return
  const raw = (document.getElementById('pv-push-video-users') && document.getElementById('pv-push-video-users').value) || ''
  if (!String(raw).trim()) {
    pvToast('请填写推送人员名单（企微 userid，逗号分隔）', 'error')
    return
  }
  const cardTitleRaw =
    (document.getElementById('pv-push-video-card-title') &&
      document.getElementById('pv-push-video-card-title').value) ||
    ''
  const cardTitleTrim = String(cardTitleRaw).trim()
  const chatNameRaw =
    (document.getElementById('pv-push-video-chat-name') &&
      document.getElementById('pv-push-video-chat-name').value) ||
    ''
  const chatNameTrim = String(chatNameRaw).trim()
  const clueMd =
    (document.getElementById('pv-push-md-clue') && document.getElementById('pv-push-md-clue').value) != null
      ? String(document.getElementById('pv-push-md-clue').value)
      : ''
    const reportMd =
    (document.getElementById('pv-push-md-report') && document.getElementById('pv-push-md-report').value) != null
      ? String(document.getElementById('pv-push-md-report').value)
      : ''
  if (!String(reportMd).trim()) {
    pvToast('「交流报备摘要」不能为空，请在下方②中填写或等待预览加载完成', 'error')
    return
  }
  pvShowOverlay(true, '正在创建企微群发会话并推送…')
  try {
    const bodyObj = {
      userIds: raw.trim(),
      ...(cardTitleTrim ? { cardTitle: cardTitleTrim } : {}),
      ...(chatNameTrim ? { chatName: chatNameTrim } : {}),
      clueMarkdown: clueMd,
      reportMarkdown: reportMd
    }
    if (pvPushVideoIsShort) {
      const ra = document.getElementById('pv-push-md-report-analysis')
      bodyObj.reportAnalysisMarkdown = ra ? pvStripHashForAnalysisPush(String(ra.value || '')) : ''
    }
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions/${encodeURIComponent(id)}/push-video`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyObj)
      }
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '推送失败', 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const d = data.data || {}
    pvToast(
      `已推送。企微群发会话 chatid：${d.chatid || '-'}，成员 ${d.userCount ?? '-'} 人` +
        (d.reportMatched ? '（已关联报备）' : '（未匹配到报备）') +
        (d.videoPushedAsMedia ? '；已向群内发送视频/文件消息。' : ''),
      'success',
      PV_PUSH_WORKFLOW_TOAST_MS
    )
    pvClosePushVideoDialog()
    pvLoadList()
  } catch (e) {
    pvToast('推送失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

function pvInitPipelineSelect() {
  const sel = document.getElementById('pv-pipeline-status')
  if (!sel || sel.getAttribute('data-pv-inited') === '1') return
  sel.setAttribute('data-pv-inited', '1')
  sel.innerHTML = PV_PIPELINE_OPTIONS.map((o) => {
    const v = pvEscapeAttr(o.value)
    const lab = pvEscapeHtml(o.label)
    return `<option value="${v}">${lab}</option>`
  }).join('')
  sel.value = 'all'
}

;(async function initPv() {
  try {
    pvInitPipelineSelect()
    const df = document.getElementById('pv-date-from')
    const dt = document.getElementById('pv-date-to')
    if (df && dt && !String(df.value || '').trim() && !String(dt.value || '').trim()) {
      const { dateFrom, dateTo } = pvDefaultLastNDaysRange(3)
      df.value = dateFrom
      dt.value = dateTo
      pvState.dateFrom = dateFrom
      pvState.dateTo = dateTo
    }
    await window.pvLoadList()
    Promise.all([pvLoadMarkdownItOnce(), pvEnsureCodeMirrorMarkdown()]).catch(function () {})
  } catch (e) {
    console.error(e)
    pvToast('页面初始化失败: ' + e.message, 'error')
  }
})()
