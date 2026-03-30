/**
 * 售前分析 · 视频生成
 */
const PV_API = (window.location.origin || 'http://localhost:3000') + '/api'

/** 推送对话 / 提交工作流 返回信息较长，Toast 多停留一会（毫秒） */
const PV_PUSH_WORKFLOW_TOAST_MS = 10000

/** 与 presales_video_tasks.pipeline_status 一致（含「无记录」） */
const PV_PIPELINE_OPTIONS = [
  { value: 'all', label: '全部状态' },
  { value: '__none__', label: '无流水线记录' },
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
  lastReportText: '',
  /** 流水线筛选：all | __none__ | 具体状态 */
  pipelineStatus: 'all',
  /** 列表名称模糊查询（与接口 name 参数一致） */
  nameQuery: '',
  /** 创建时间起止 YYYY-MM-DD，与接口 dateFrom / dateTo 一致 */
  dateFrom: '',
  dateTo: '',
  /** 推送对话成功后缓存，供「提交工作流」传 Coze meeting-analysis：{ [transcriptionId]: { fileId, fileName } } */
  cozeUploadById: {}
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
        <td class="pv-col-time"><span class="pv-time">${pvEscapeHtml(pvFormatDate(row.createdAt))}</span></td>
        <td class="pv-col-pipeline">${pipeCell}</td>
        <td class="pv-col-report">${reportBadge}</td>
        <td class="pv-col-actions">
          <div class="pv-actions">
            <button type="button" class="btn btn-sm btn-outline" style="border:1px solid var(--primary-color,#1890ff);color:var(--primary-color,#1890ff);background:transparent;" title="向转录 created_by（企微用户）推送 Markdown 卡片链接，打开后可核对/批量修改说话人" onclick="pvNotifyRoleConfirm('${row.id}')">角色确认</button>
            <button type="button" class="btn btn-sm btn-primary" title="仅 Coze 文件上传（字段 file），返回 file_id/file_name；会议分析请点右侧「提交工作流」" onclick="pvPushDialogue('${row.id}')">推送对话</button>
            <button type="button" class="btn btn-sm pv-act-workflow" title="Coze：用「推送对话」缓存的 fileId/fileName 调 meeting-analysis 取 execute_id；或通用工作流 URL" onclick="pvSubmitWorkflow('${row.id}')">提交工作流</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="优先：POST 异步任务（md 路径 reserve_3 + execute_id）；未配异步地址时推送本地售前 JSON" onclick="pvPushReport('${row.id}')">推送报告</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="填写企微 userid 建应用群发会话，推送报备摘要与视频" onclick="pvOpenPushVideoDialog('${row.id}')">推送视频</button>
          </div>
        </td>
      </tr>`
    })
    .join('')
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

window.pvNotifyRoleConfirm = async function (id) {
  if (
    !confirm(
      '将向该转录的「创建人/企微 userid」（created_by）发送一条 Markdown，内含「角色确认」外链。\n需：机器人已连接、已配置 PRESALES_VIDEO_PUBLIC_BASE_URL 与 PRESALES_VIDEO_SPEAKER_LINK_SECRET。\n确定发送？'
    )
  ) {
    return
  }
  pvShowOverlay(true, '正在推送角色确认…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/notify-role-confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '推送失败', 'error', PV_PUSH_WORKFLOW_TOAST_MS)
      return
    }
    const d = data.data || {}
    pvToast(
      `已推送。对方企微账号：${d.wecomUserId || '-'}，对话条数：${d.dialogueCount ?? '-'}`,
      'success',
      PV_PUSH_WORKFLOW_TOAST_MS
    )
  } catch (e) {
    pvToast('推送失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

window.pvPushDialogue = async function (id) {
  if (
    !confirm(
      '将先生成合并对话 txt 并保存到服务器目录，再尝试 Coze 上传（未配置或连不上 URL 时仍会保留本地 txt）。\n上传成功后请再点「提交工作流」。确定执行？'
    )
  ) {
    return
  }
  pvShowOverlay(true, '正在生成 txt 并尝试上传…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/push-dialogue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    })
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
  } catch (e) {
    pvToast('推送失败: ' + e.message, 'error', PV_PUSH_WORKFLOW_TOAST_MS)
  } finally {
    pvShowOverlay(false)
  }
}

window.pvCloseReportDialog = function () {
  const dlg = document.getElementById('pv-report-dialog')
  if (dlg) dlg.close()
}

window.pvCopyReport = async function () {
  const t = pvState.lastReportText || ''
  if (!t) return
  try {
    await navigator.clipboard.writeText(t)
    pvToast('已复制', 'success')
  } catch {
    pvToast('复制失败', 'error')
  }
}

window.pvPushReport = async function (id) {
  if (
    !confirm(
      '将调用服务端「推送报告」：\n' +
        '· 若已配置 PRESALES_VIDEO_REPORT_ASYNC_URL：POST 异步任务，参数为 name（md 文件名）、execute_id（工作流 ID）、filePaths（库中 reserve_3 的 md 路径）。需已提交工作流且分析回调已落盘 md。\n' +
        '· 否则：按旧逻辑 POST 本地售前分析 JSON（PRESALES_VIDEO_REPORT_PUSH_URL）。\n' +
        '确定执行？'
    )
  ) {
    return
  }
  pvShowOverlay(true, '正在推送报告...')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/push-report`, {
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
        : `推送报告成功（HTTP ${d.remoteStatus}）`
    pvToast(okMsg, 'success')
    console.log('[presales-video] push-report', d)
  } catch (e) {
    pvToast('推送报告失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
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

window.pvOpenPushVideoDialog = function (id) {
  pvPushVideoTranscriptionId = id
  const ta = document.getElementById('pv-push-video-users')
  if (ta) ta.value = ''
  document.getElementById('pv-push-video-dialog')?.showModal()
}

window.pvClosePushVideoDialog = function () {
  document.getElementById('pv-push-video-dialog')?.close()
  pvPushVideoTranscriptionId = null
}

window.pvSubmitPushVideo = async function () {
  const id = pvPushVideoTranscriptionId
  if (!id) return
  const raw = (document.getElementById('pv-push-video-users') && document.getElementById('pv-push-video-users').value) || ''
  if (!String(raw).trim()) {
    pvToast('请填写推送人员名单（企微 userid，逗号分隔）', 'error')
    return
  }
  pvShowOverlay(true, '正在创建企微群发会话并推送…')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/push-video`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: raw.trim() })
    })
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
    await window.pvLoadList()
  } catch (e) {
    console.error(e)
    pvToast('页面初始化失败: ' + e.message, 'error')
  }
})()
