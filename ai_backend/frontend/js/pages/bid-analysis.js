/**
 * 投标文件分析页面
 */
const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api'

let bidState = {
  list: [],
  total: 0,
  page: 1,
  selectedFile: null,
  sectionTypes: [],
  activeTab: 'files',
}

// ==================== 初始化 ====================
;(async function () {
  console.log('📑 投标文件分析页面初始化...')
  bindBidDropzone()
  await Promise.all([loadBidList(), loadSectionTypes()])
})()

function bindBidDropzone() {
  const dropzone = document.getElementById('bid-dropzone')
  const fileInput = document.getElementById('bid-file-input')
  if (!dropzone || !fileInput) return
  dropzone.addEventListener('click', () => fileInput.click())
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = 'var(--primary,#4F46E5)' })
  dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = 'var(--border-color,#ddd)' })
  dropzone.addEventListener('drop', e => {
    e.preventDefault()
    dropzone.style.borderColor = 'var(--border-color,#ddd)'
    if (e.dataTransfer.files.length) handleBidFileSelect(e.dataTransfer.files[0])
  })
  fileInput.addEventListener('change', e => { if (e.target.files.length) handleBidFileSelect(e.target.files[0]) })
}

function handleBidFileSelect(file) {
  bidState.selectedFile = file
  document.getElementById('bid-selected-file').style.display = 'block'
  document.getElementById('bid-file-name').textContent = file.name
  document.getElementById('bid-file-size').textContent = formatSize(file.size)
  document.getElementById('bid-upload-btn').disabled = false
}

// ==================== Tab 切换 ====================
window.switchBidTab = function (tab) {
  bidState.activeTab = tab
  document.getElementById('bid-files-panel').style.display = tab === 'files' ? 'block' : 'none'
  document.getElementById('bid-sections-panel').style.display = tab === 'sections' ? 'block' : 'none'
  document.getElementById('bid-types-panel').style.display = tab === 'types' ? 'block' : 'none'
  document.getElementById('tab-files').style.fontWeight = tab === 'files' ? '600' : '400'
  document.getElementById('tab-sections').style.fontWeight = tab === 'sections' ? '600' : '400'
  document.getElementById('tab-types').style.fontWeight = tab === 'types' ? '600' : '400'
  if (tab === 'types') loadSectionTypeList()
}

// ==================== 上传 ====================
window.showBidUploadDialog = function () {
  bidState.selectedFile = null
  document.getElementById('bid-selected-file').style.display = 'none'
  document.getElementById('bid-upload-btn').disabled = true
  document.getElementById('bid-file-input').value = ''
  document.getElementById('bid-source-info').value = ''
  document.getElementById('bid-industry').value = ''
  document.getElementById('bid-project-type').value = ''
  document.getElementById('bid-upload-dialog').showModal()
}
window.closeBidUploadDialog = function () { document.getElementById('bid-upload-dialog').close() }

window.doBidUpload = async function () {
  if (!bidState.selectedFile) return
  const fd = new FormData()
  fd.append('file', bidState.selectedFile)
  fd.append('sourceInfo', document.getElementById('bid-source-info').value)
  fd.append('industry', document.getElementById('bid-industry').value)
  fd.append('projectType', document.getElementById('bid-project-type').value)
  try {
    document.getElementById('bid-upload-btn').disabled = true
    document.getElementById('bid-upload-btn').textContent = '上传中...'
    const res = await fetch(`${API_BASE}/bid-analysis/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast('上传成功', 'success')
    closeBidUploadDialog()
    await loadBidList()
  } catch (err) {
    showToast('上传失败: ' + err.message, 'error')
  } finally {
    document.getElementById('bid-upload-btn').disabled = false
    document.getElementById('bid-upload-btn').textContent = '上传'
  }
}

// ==================== 文件列表 ====================
window.loadBidList = async function () {
  try {
    document.getElementById('bid-loading').style.display = 'block'
    document.getElementById('bid-table').style.display = 'none'
    document.getElementById('bid-empty').style.display = 'none'

    const res = await fetch(`${API_BASE}/bid-analysis/list?page=${bidState.page}&pageSize=20`)
    const data = await res.json()
    if (!data.success) throw new Error(data.message)

    bidState.list = data.list || []
    bidState.total = data.total || 0
    document.getElementById('bid-total-count').textContent = `共 ${bidState.total} 条`

    if (bidState.list.length === 0) {
      document.getElementById('bid-empty').style.display = 'block'
    } else {
      renderBidList()
      document.getElementById('bid-table').style.display = 'table'
    }
  } catch (err) {
    showToast('加载失败: ' + err.message, 'error')
    document.getElementById('bid-empty').style.display = 'block'
  } finally {
    document.getElementById('bid-loading').style.display = 'none'
  }
}

function renderBidList() {
  const tbody = document.getElementById('bid-list-tbody')
  if (!tbody) return
  tbody.innerHTML = bidState.list.map(item => {
    const statusMap = {
      uploaded: '<span class="badge badge-secondary">待拆分</span>',
      extracting: '<span class="badge badge-warning">提取中</span>',
      splitting: '<span class="badge badge-warning">拆分中</span>',
      completed: '<span class="badge badge-success">已完成</span>',
      failed: '<span class="badge badge-error">失败</span>',
    }
    return `<tr>
      <td title="${item.name}">${truncate(item.name, 25)}</td>
      <td>${item.industry || '-'}</td>
      <td>${item.project_type || '-'}</td>
      <td>${statusMap[item.status] || item.status}</td>
      <td>${item.section_count || 0}</td>
      <td>${formatDate(item.created_at)}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${item.status === 'uploaded' || item.status === 'failed' ? `<button class="btn btn-sm btn-primary" onclick="startSplit('${item.id}')">AI 拆分</button>` : ''}
          ${item.status === 'completed' ? `<button class="btn btn-sm btn-secondary" onclick="viewSections('${item.id}','${escape(item.name)}')">查看章节</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="deleteBidDoc('${item.id}')">删除</button>
        </div>
      </td>
    </tr>`
  }).join('')
}

// ==================== AI 拆分（SSE） ====================
window.startSplit = function (bidDocId) {
  const logEl = document.getElementById('bid-progress-log')
  const barEl = document.getElementById('bid-progress-bar')
  logEl.innerHTML = ''
  barEl.style.width = '0%'
  document.getElementById('bid-progress-dialog').showModal()

  const es = new EventSource(`${API_BASE}/bid-analysis/analyze/${bidDocId}`)
  es.onmessage = function (event) {
    const d = JSON.parse(event.data)
    if (d.type === 'step' || d.type === 'info') {
      logEl.innerHTML += `<div>📌 ${d.message}</div>`
    } else if (d.type === 'split_progress') {
      const pct = Math.round((d.current / d.total) * 100)
      barEl.style.width = pct + '%'
      logEl.innerHTML += `<div style="color:var(--text-secondary);">  📄 [${d.current}/${d.total}] ${d.title} → ${d.sectionType}</div>`
    } else if (d.type === 'complete') {
      barEl.style.width = '100%'
      logEl.innerHTML += `<div style="color:green;font-weight:600;">✅ 拆分完成！共 ${d.result?.savedSections || 0} 个章节</div>`
      es.close()
      setTimeout(() => { document.getElementById('bid-progress-dialog').close(); loadBidList() }, 2000)
    } else if (d.type === 'error') {
      logEl.innerHTML += `<div style="color:red;">❌ ${d.message}</div>`
      es.close()
    }
    logEl.scrollTop = logEl.scrollHeight
  }
  es.onerror = function () { logEl.innerHTML += `<div style="color:red;">❌ 连接中断</div>`; es.close() }
}

// ==================== 查看章节 ====================
window.viewSections = async function (bidDocId, name) {
  try {
    document.getElementById('bid-sections-title').textContent = `📑 ${unescape(name)} — 章节列表`
    document.getElementById('bid-sections-container').innerHTML = '<div class="loading">加载中...</div>'
    document.getElementById('bid-sections-dialog').showModal()

    const res = await fetch(`${API_BASE}/bid-analysis/${bidDocId}/sections`)
    const data = await res.json()
    if (!data.success) throw new Error(data.message)

    renderSectionCards(data.data, 'bid-sections-container')
  } catch (err) {
    document.getElementById('bid-sections-container').innerHTML = `<p style="color:red;">加载失败: ${err.message}</p>`
  }
}
window.closeSectionsDialog = function () { document.getElementById('bid-sections-dialog').close() }

function renderSectionCards(sections, containerId) {
  const container = document.getElementById(containerId)
  if (!sections || sections.length === 0) {
    container.innerHTML = '<p style="color:var(--text-secondary);">暂无章节</p>'
    return
  }
  container.innerHTML = sections.map(sec => {
    const qualityColor = (sec.quality_score || 0) >= 0.8 ? 'green' : (sec.quality_score || 0) >= 0.5 ? 'orange' : 'red'
    const tags = Array.isArray(sec.tags) ? sec.tags.map(t => `<span class="badge badge-secondary" style="font-size:11px;">${t}</span>`).join(' ') : ''
    return `
    <div style="border:1px solid var(--border-color,#e0e0e0);border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <strong>${sec.title}</strong>
        <div style="display:flex;gap:6px;align-items:center;">
          <span class="badge badge-secondary">${sec.section_type}</span>
          ${sec.quality_score !== null ? `<span style="color:${qualityColor};font-size:12px;font-weight:600;">${(sec.quality_score * 100).toFixed(0)}分</span>` : ''}
          ${sec.is_reusable ? '<span style="font-size:11px;color:green;">♻可复用</span>' : ''}
        </div>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);max-height:60px;overflow:hidden;margin-bottom:6px;">${truncate(sec.content, 200)}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">${tags}</div>
    </div>`
  }).join('')
}

// ==================== 章节类型 + 搜索 ====================
async function loadSectionTypes() {
  try {
    const res = await fetch(`${API_BASE}/bid-analysis/section-types`)
    const data = await res.json()
    if (data.success) {
      bidState.sectionTypes = data.data
      const select = document.getElementById('bid-search-type')
      if (select) {
        data.data.forEach(t => {
          const opt = document.createElement('option')
          opt.value = t.code
          opt.textContent = t.name
          select.appendChild(opt)
        })
      }
    }
  } catch (err) {
    console.warn('加载章节类型失败:', err)
  }
}

window.searchSections = async function () {
  const keyword = document.getElementById('bid-search-keyword').value
  const sectionType = document.getElementById('bid-search-type').value
  const container = document.getElementById('bid-search-results')
  container.innerHTML = '<div class="loading">搜索中...</div>'
  try {
    const params = new URLSearchParams()
    if (keyword) params.set('keyword', keyword)
    if (sectionType) params.set('sectionType', sectionType)
    params.set('pageSize', '50')

    const res = await fetch(`${API_BASE}/bid-analysis/sections/search?${params}`)
    const data = await res.json()
    if (!data.success) throw new Error(data.message)

    if (data.list.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">未找到匹配的章节</p>'
    } else {
      container.innerHTML = `<p style="margin-bottom:12px;color:var(--text-secondary);">共找到 ${data.total} 个章节</p>`
      const cards = data.list.map(sec => {
        const docName = sec.bid_documents?.name || ''
        const qualityColor = (sec.quality_score || 0) >= 0.8 ? 'green' : (sec.quality_score || 0) >= 0.5 ? 'orange' : 'red'
        const tags = Array.isArray(sec.tags) ? sec.tags.map(t => `<span class="badge badge-secondary" style="font-size:11px;">${t}</span>`).join(' ') : ''
        return `
        <div style="border:1px solid var(--border-color,#e0e0e0);border-radius:8px;padding:14px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <strong>${sec.title}</strong>
            <span class="badge badge-secondary">${sec.section_type}</span>
          </div>
          <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px;">来源: ${docName} | 质量: <span style="color:${qualityColor};font-weight:600;">${sec.quality_score !== null ? (sec.quality_score * 100).toFixed(0) + '分' : '-'}</span></div>
          <div style="font-size:12px;color:var(--text-secondary);max-height:60px;overflow:hidden;margin-bottom:6px;">${truncate(sec.content, 200)}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;">${tags}</div>
        </div>`
      }).join('')
      container.innerHTML += cards
    }
  } catch (err) {
    container.innerHTML = `<p style="color:red;">搜索失败: ${err.message}</p>`
  }
}

// ==================== 删除 ====================
window.deleteBidDoc = async function (id) {
  if (!confirm('确定要删除该投标文件及所有拆分章节吗？')) return
  try {
    const res = await fetch(`${API_BASE}/bid-analysis/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast('删除成功', 'success')
    await loadBidList()
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

// ==================== 分类管理 ====================

async function loadSectionTypeList() {
  try {
    const res = await fetch(`${API_BASE}/bid-analysis/section-types`)
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    renderTypeTable(data.data)
  } catch (err) {
    showToast('加载分类失败: ' + err.message, 'error')
  }
}

function renderTypeTable(types) {
  const tbody = document.getElementById('types-table-body')
  if (!types.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-secondary);padding:32px;">暂无分类，点击右上角新增</td></tr>'
    return
  }
  tbody.innerHTML = types.map(t => `
    <tr>
      <td style="text-align:center;">${t.sort_order}</td>
      <td><code style="background:var(--bg-secondary,#f5f5f5);padding:2px 6px;border-radius:4px;font-size:12px;">${t.code}</code></td>
      <td><strong>${t.name}</strong></td>
      <td style="color:var(--text-secondary);font-size:13px;">${t.description}</td>
      <td style="text-align:center;">
        <span style="color:${t.is_active ? 'green' : '#999'};font-size:12px;">${t.is_active ? '✅ 启用' : '⏸ 停用'}</span>
      </td>
      <td style="text-align:center;">
        <button class="btn btn-secondary" style="padding:4px 8px;font-size:12px;" onclick="showEditTypeDialog(${t.id},'${t.code}','${t.name.replace(/'/g, "\\'")}','${t.description.replace(/'/g, "\\'")}',${t.sort_order})">编辑</button>
        <button class="btn" style="padding:4px 8px;font-size:12px;background:${t.is_active ? '#fee2e2' : '#d1fae5'};color:${t.is_active ? '#dc2626' : '#059669'};" onclick="toggleTypeActive(${t.id},${!t.is_active})">${t.is_active ? '停用' : '启用'}</button>
      </td>
    </tr>
  `).join('')
}

window.showAddTypeDialog = function () {
  document.getElementById('type-dialog-title').textContent = '新增分类'
  document.getElementById('type-edit-id').value = ''
  document.getElementById('type-code').value = ''
  document.getElementById('type-code').disabled = false
  document.getElementById('type-name').value = ''
  document.getElementById('type-description').value = ''
  document.getElementById('type-sort').value = '50'
  document.getElementById('type-dialog').showModal()
}

window.showEditTypeDialog = function (id, code, name, description, sortOrder) {
  document.getElementById('type-dialog-title').textContent = '编辑分类'
  document.getElementById('type-edit-id').value = id
  document.getElementById('type-code').value = code
  document.getElementById('type-code').disabled = true // 代码不可修改
  document.getElementById('type-name').value = name
  document.getElementById('type-description').value = description
  document.getElementById('type-sort').value = sortOrder
  document.getElementById('type-dialog').showModal()
}

window.closeTypeDialog = function () {
  document.getElementById('type-dialog').close()
}

window.saveType = async function () {
  const id = document.getElementById('type-edit-id').value
  const code = document.getElementById('type-code').value.trim()
  const name = document.getElementById('type-name').value.trim()
  const description = document.getElementById('type-description').value.trim()
  const sort_order = parseInt(document.getElementById('type-sort').value) || 0

  if (!code || !name || !description) {
    showToast('代码、名称、说明均为必填', 'error')
    return
  }

  try {
    let res
    if (id) {
      res = await fetch(`${API_BASE}/bid-analysis/section-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, sort_order }),
      })
    } else {
      res = await fetch(`${API_BASE}/bid-analysis/section-types`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, description, sort_order }),
      })
    }
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast(id ? '修改成功' : '新增成功', 'success')
    closeTypeDialog()
    loadSectionTypeList()
  } catch (err) {
    showToast('保存失败: ' + err.message, 'error')
  }
}

window.toggleTypeActive = async function (id, isActive) {
  try {
    const res = await fetch(`${API_BASE}/bid-analysis/section-types/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.message)
    showToast(isActive ? '已启用' : '已停用', 'success')
    loadSectionTypeList()
  } catch (err) {
    showToast('操作失败: ' + err.message, 'error')
  }
}
