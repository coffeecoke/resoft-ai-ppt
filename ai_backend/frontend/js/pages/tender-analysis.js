/**
 * 招标文件分析页面
 */
const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api'

let tenderState = {
  list: [],
  total: 0,
  page: 1,
  selectedFile: null,
}

// ==================== 初始化 ====================
;(async function () {
  console.log('📋 招标文件分析页面初始化...')
  bindDropzone()
  await loadTenderList()
})()

function bindDropzone() {
  const dropzone = document.getElementById('tender-dropzone')
  const fileInput = document.getElementById('tender-file-input')
  if (!dropzone || !fileInput) return

  dropzone.addEventListener('click', () => fileInput.click())
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary,#4F46E5)' })
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--border-color,#ddd)' })
  dropzone.addEventListener('drop', e => {
    e.preventDefault()
    dropzone.style.borderColor = 'var(--border-color,#ddd)'
    if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', e => { if (e.target.files.length) handleFileSelect(e.target.files[0]) })
}

function handleFileSelect(file) {
  tenderState.selectedFile = file
  document.getElementById('tender-selected-file').style.display = 'block'
  document.getElementById('tender-file-name').textContent = file.name
  document.getElementById('tender-file-size').textContent = formatSize(file.size)
  document.getElementById('tender-upload-btn').disabled = false
}

// ==================== 上传 ====================
window.showUploadDialog = function () {
  tenderState.selectedFile = null
  document.getElementById('tender-selected-file').style.display = 'none'
  document.getElementById('tender-upload-btn').disabled = true
  document.getElementById('tender-file-input').value = ''
  document.getElementById('tender-upload-dialog').showModal()
}
window.closeUploadDialog = function () { document.getElementById('tender-upload-dialog').close() }

window.doUpload = async function () {
  if (!tenderState.selectedFile) return
  const fd = new FormData()
  fd.append('file', tenderState.selectedFile)
  try {
    document.getElementById('tender-upload-btn').disabled = true
    document.getElementById('tender-upload-btn').textContent = '上传中...'
    const res = await fetch(`${API_BASE}/tender-analysis/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast('上传成功', 'success')
    closeUploadDialog()
    await loadTenderList()
  } catch (err) {
    showToast('上传失败: ' + err.message, 'error')
  } finally {
    document.getElementById('tender-upload-btn').disabled = false
    document.getElementById('tender-upload-btn').textContent = '上传'
  }
}

// ==================== 列表 ====================
window.loadTenderList = async function () {
  try {
    document.getElementById('tender-loading').style.display = 'block'
    document.getElementById('tender-table').style.display = 'none'
    document.getElementById('tender-empty').style.display = 'none'

    const res = await fetch(`${API_BASE}/tender-analysis/list?page=${tenderState.page}&pageSize=20`)
    const data = await res.json()
    if (!data.success) throw new Error(data.message)

    tenderState.list = data.list || []
    tenderState.total = data.total || 0
    document.getElementById('tender-total-count').textContent = `共 ${tenderState.total} 条`

    if (tenderState.list.length === 0) {
      document.getElementById('tender-empty').style.display = 'block'
    } else {
      renderList()
      document.getElementById('tender-table').style.display = 'table'
    }
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error')
    document.getElementById('tender-empty').style.display = 'block'
  } finally {
    document.getElementById('tender-loading').style.display = 'none'
  }
}

function renderList() {
  const tbody = document.getElementById('tender-list-tbody')
  if (!tbody) return
  tbody.innerHTML = tenderState.list.map(item => {
    const statusMap = {
      uploaded: '<span class="badge badge-secondary">待分析</span>',
      extracting: '<span class="badge badge-warning">提取中</span>',
      analyzing: '<span class="badge badge-warning">分析中</span>',
      completed: '<span class="badge badge-success">已完成</span>',
      failed: '<span class="badge badge-error">失败</span>',
    }
    const dirCount = item._count?.bid_directory_items || 0
    return `<tr>
      <td title="${item.name}">${truncate(item.name, 30)}</td>
      <td>${item.project_name || '-'}</td>
      <td>${statusMap[item.status] || item.status}</td>
      <td>${dirCount}</td>
      <td>${formatDate(item.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${item.status === 'uploaded' || item.status === 'failed' ? `<button class="btn btn-sm btn-primary" onclick="startAnalyze('${item.id}')">AI 分析</button>` : ''}
          ${item.status === 'completed' ? `<button class="btn btn-sm btn-primary" onclick="viewDirectory('${item.id}','${escape(item.name)}')">📄 在线预览</button>` : ''}
          ${item.status === 'completed' ? `<button class="btn btn-sm btn-secondary" onclick="exportDocx('${item.id}')">📥 下载Word</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteTender('${item.id}')">删除</button>
        </div>
      </td>
    </tr>`
  }).join('')
}

// ==================== AI 分析（SSE） ====================
window.startAnalyze = function (tenderId) {
  const dialog = document.getElementById('tender-progress-dialog')
  const logEl = document.getElementById('tender-progress-log')
  const barEl = document.getElementById('tender-progress-bar')
  logEl.innerHTML = ''
  barEl.style.width = '0%'
  dialog.showModal()

  const es = new EventSource(`${API_BASE}/tender-analysis/analyze/${tenderId}`)
  es.onmessage = function (event) {
    const d = JSON.parse(event.data)
    if (d.type === 'step' || d.type === 'info') {
      logEl.innerHTML += `<div>📌 ${d.message}</div>`
    } else if (d.type === 'fill_progress') {
      const pct = Math.round((d.current / d.total) * 100)
      barEl.style.width = pct + '%'
      logEl.innerHTML += `<div style="color:var(--text-secondary);">  ✏️ [${d.current}/${d.total}] ${d.title}</div>`
    } else if (d.type === 'complete') {
      barEl.style.width = '100%'
      logEl.innerHTML += `<div style="color:green;font-weight:600;">✅ 分析完成！生成 ${d.result?.directoryItemCount || 0} 个目录项，填充 ${d.result?.filledCount || 0} 个章节</div>`
      es.close()
      setTimeout(() => { dialog.close(); loadTenderList() }, 2000)
    } else if (d.type === 'error') {
      logEl.innerHTML += `<div style="color:red;">❌ ${d.message}</div>`
      es.close()
    }
    logEl.scrollTop = logEl.scrollHeight
  }
  es.onerror = function () {
    logEl.innerHTML += `<div style="color:red;">❌ 连接中断</div>`
    es.close()
  }
}

// ==================== 在线预览 / 导出 Word ====================

let currentDocxBlob = null
let currentDocxFileName = ''

/**
 * 查看目录 → 在线预览 Word 文档
 * 流程：请求后端生成 .docx → 用 docx-preview 在浏览器中渲染
 */
window.viewDirectory = async function (tenderId, name) {
  const dialog = document.getElementById('tender-directory-dialog')
  const loadingEl = document.getElementById('tender-docx-loading')
  const errorEl = document.getElementById('tender-docx-error')
  const previewEl = document.getElementById('tender-docx-preview')
  const downloadBtn = document.getElementById('tender-download-btn')

  document.getElementById('tender-dir-title').textContent = `📄 ${unescape(name)} — 投标文件预览`
  loadingEl.style.display = 'block'
  errorEl.style.display = 'none'
  previewEl.innerHTML = ''
  downloadBtn.style.display = 'none'
  currentDocxBlob = null
  dialog.showModal()

  try {
    const res = await fetch(`${API_BASE}/tender-analysis/${tenderId}/export-docx`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '生成失败' }))
      throw new Error(err.message)
    }

    const blob = await res.blob()
    currentDocxBlob = blob

    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename\*=UTF-8''(.+)/)
    currentDocxFileName = match ? decodeURIComponent(match[1]) : `投标文件_${tenderId}.docx`

    // 用 docx-preview 渲染
    if (window.docx && window.docx.renderAsync) {
      await window.docx.renderAsync(blob, previewEl, null, {
        className: 'docx-preview-wrapper',
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        ignoreFonts: false,
        breakPages: true,
        ignoreLastRenderedPageBreak: true,
        experimental: false,
      })
    } else {
      previewEl.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary);">'
        + '<p style="font-size:48px;">📄</p>'
        + '<p>Word 预览组件加载失败，请直接下载查看</p></div>'
    }

    downloadBtn.style.display = 'inline-flex'
  } catch (err) {
    errorEl.textContent = '预览失败: ' + err.message
    errorEl.style.display = 'block'
  } finally {
    loadingEl.style.display = 'none'
  }
}

window.closeDirectoryDialog = function () {
  document.getElementById('tender-directory-dialog').close()
}

window.downloadCurrentDocx = function () {
  if (!currentDocxBlob) return showToast('没有可下载的文件', 'error')
  const url = URL.createObjectURL(currentDocxBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = currentDocxFileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  showToast('Word 文档已下载', 'success')
}

/**
 * 直接下载 Word（不打开预览）
 */
window.exportDocx = async function (tenderId) {
  try {
    showToast('正在生成 Word 文档...', 'info')
    const res = await fetch(`${API_BASE}/tender-analysis/${tenderId}/export-docx`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: '导出失败' }))
      throw new Error(err.message)
    }
    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename\*=UTF-8''(.+)/)
    const fileName = match ? decodeURIComponent(match[1]) : `投标文件_${tenderId}.docx`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast('Word 文档已下载', 'success')
  } catch (err) {
    showToast('导出失败: ' + err.message, 'error')
  }
}

// ==================== 删除 ====================
window.deleteTender = async function (id) {
  if (!confirm('确定要删除该招标文件及所有分析结果吗？')) return
  try {
    const res = await fetch(`${API_BASE}/tender-analysis/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast('删除成功', 'success')
    await loadTenderList()
  } catch (err) {
    showToast('删除失败: ' + err.message, 'error')
  }
}

// ==================== 工具 ====================
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}
function formatDate(str) {
  if (!str) return '-'
  const d = new Date(str)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function truncate(str, len) {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '...' : str
}

function showToast(message, type = 'info') {
  const existing = document.querySelector('.tender-toast')
  if (existing) existing.remove()

  const colors = {
    success: '#10B981', error: '#EF4444', info: '#3B82F6', warning: '#F59E0B',
  }
  const toast = document.createElement('div')
  toast.className = 'tender-toast'
  toast.style.cssText = `
    position:fixed;top:20px;right:20px;z-index:10000;
    padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;
    background:${colors[type] || colors.info};
    box-shadow:0 4px 12px rgba(0,0,0,0.15);
    animation:fadeIn .3s ease;
    max-width:400px;word-break:break-all;
  `
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity .3s'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}
