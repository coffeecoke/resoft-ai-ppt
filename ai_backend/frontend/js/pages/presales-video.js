/**
 * 售前分析 · 视频生成
 */
const PV_API = (window.location.origin || 'http://localhost:3000') + '/api'

/** 推送对话 / 提交工作流 返回信息较长，Toast 多停留一会（毫秒） */
const PV_PUSH_WORKFLOW_TOAST_MS = 10000

const pvState = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  list: [],
  lastReportText: '',
  /** 列表名称模糊查询（与接口 name 参数一致） */
  nameQuery: '',
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
    const nameParam =
      pvState.nameQuery && String(pvState.nameQuery).trim()
        ? `&name=${encodeURIComponent(String(pvState.nameQuery).trim())}`
        : ''
    const res = await fetch(
      `${PV_API}/presales-video/transcriptions?page=${pvState.page}&pageSize=${pvState.pageSize}${nameParam}`
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

    const totalEl = document.getElementById('pv-total-count')
    if (totalEl) {
      const q = pvState.nameQuery && String(pvState.nameQuery).trim()
      totalEl.textContent = q ? `共 ${pvState.total} 条（名称含「${pvState.nameQuery.trim()}」）` : `共 ${pvState.total} 条`
    }

    const qInput = document.getElementById('pv-name-query')
    if (qInput && document.activeElement !== qInput) {
      qInput.value = pvState.nameQuery || ''
    }

    const emptyHint = document.getElementById('pv-empty-hint')
    if (emptyHint) {
      emptyHint.textContent =
        pvState.nameQuery && String(pvState.nameQuery).trim()
          ? '当前名称条件下没有匹配记录，可点击「清除」后重试'
          : '请先在「语音转文本」中完成转录，并执行「合并相邻同一说话人」或「再次合并」'
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

/** 名称查询：从输入框同步关键词并回到第 1 页 */
window.pvSearch = function () {
  const input = document.getElementById('pv-name-query')
  pvState.nameQuery = input ? String(input.value || '').trim() : ''
  pvState.page = 1
  pvLoadList()
}

/** 清除名称条件并重新加载 */
window.pvClearNameSearch = function () {
  pvState.nameQuery = ''
  const input = document.getElementById('pv-name-query')
  if (input) input.value = ''
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
            <button type="button" class="btn btn-sm btn-primary" title="仅 Coze 文件上传（字段 file），返回 file_id/file_name；会议分析请点「提交工作流」" onclick="pvPushDialogue('${row.id}')">推送对话</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="拉取报告（本地售前结果或远程 URL）" onclick="pvFetchReport('${row.id}')">获取报告</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="将本地售前分析 JSON 推送到第三方" onclick="pvPushReport('${row.id}')">推送报告</button>
            <button type="button" class="btn btn-sm pv-act-secondary" title="请求第三方返回视频或下载链接" onclick="pvFetchVideo('${row.id}')">获取视频</button>
            <button type="button" class="btn btn-sm pv-act-workflow" title="Coze：用「推送对话」缓存的 fileId/fileName 调 meeting-analysis 取 execute_id；或通用工作流 URL" onclick="pvSubmitWorkflow('${row.id}')">提交工作流</button>
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

window.pvFetchReport = async function (id) {
  pvShowOverlay(true, '正在获取报告...')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/report`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) {
      pvToast(data.error || '获取失败', 'error')
      return
    }
    const payload = data.data
    let text = ''
    if (payload.source === 'remote') {
      text =
        typeof payload.body === 'string'
          ? payload.body
          : JSON.stringify(payload.body, null, 2)
    } else {
      text = JSON.stringify(payload, null, 2)
    }
    pvState.lastReportText = text
    const pre = document.getElementById('pv-report-pre')
    if (pre) pre.textContent = text
    const dlg = document.getElementById('pv-report-dialog')
    if (dlg) dlg.showModal()
  } catch (e) {
    pvToast('获取报告失败: ' + e.message, 'error')
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
  if (!confirm('将本地售前分析结果以 JSON POST 到第三方（需配置 PRESALES_VIDEO_REPORT_PUSH_URL），确定？')) {
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
    pvToast(`推送报告成功（HTTP ${d.remoteStatus}）`, 'success')
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

window.pvFetchVideo = async function (id) {
  pvShowOverlay(true, '正在获取视频...')
  try {
    const res = await fetch(`${PV_API}/presales-video/transcriptions/${id}/video`)
    const ct = res.headers.get('content-type') || ''

    if (ct.includes('application/json')) {
      const data = await res.json()
      if (!data.success) {
        pvToast(data.error || '获取失败', 'error')
        return
      }
      const inner = data.data || {}
      if (inner.json && inner.json.url) {
        window.open(inner.json.url, '_blank')
        pvToast('已打开视频链接', 'success')
      } else if (inner.text) {
        pvState.lastReportText = inner.text
        const pre = document.getElementById('pv-report-pre')
        if (pre) pre.textContent = inner.text
        document.getElementById('pv-report-dialog')?.showModal()
      } else {
        pvToast('已返回 JSON，请查看控制台', 'info')
        console.log(inner)
      }
      return
    }

    const blob = await res.blob()
    if (!res.ok) {
      pvToast('获取视频失败: HTTP ' + res.status, 'error')
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `video_${id}.bin`
    a.click()
    URL.revokeObjectURL(url)
    pvToast('已开始下载视频文件', 'success')
  } catch (e) {
    pvToast('获取视频失败: ' + e.message, 'error')
  } finally {
    pvShowOverlay(false)
  }
}

;(async function initPv() {
  try {
    await window.pvLoadList()
  } catch (e) {
    console.error(e)
    pvToast('页面初始化失败: ' + e.message, 'error')
  }
})()
