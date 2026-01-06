/**
 * 文档管理页面
 * 完整的JavaScript实现
 */

const DOC_API_BASE = 'http://localhost:3000/api';
let docCurrentPage = 1;
let docPageSize = 20;
let docTotalPages = 1;
let docDocuments = [];

// 页面初始化
(async function() {
  console.log('📁 文档管理页面初始化...');
  await loadDocumentList();
})();

// 加载文档列表
async function loadDocumentList() {
  const keyword = document.getElementById('doc-keyword')?.value || '';
  const status = document.getElementById('doc-status')?.value || '';
  const category = document.getElementById('doc-category')?.value || '';

  const params = new URLSearchParams({
    page: docCurrentPage,
    pageSize: docPageSize,
  });
  if (keyword) params.append('keyword', keyword);
  if (status) params.append('status', status);
  if (category) params.append('category', category);

  const loadingEl = document.getElementById('doc-loading');
  const tableEl = document.getElementById('doc-table-container');
  
  if (loadingEl) loadingEl.style.display = 'block';
  if (tableEl) tableEl.style.display = 'none';

  try {
    console.log('📡 正在请求:', `${DOC_API_BASE}/documents/list?${params}`);
    const response = await fetch(`${DOC_API_BASE}/documents/list?${params}`);
    const result = await response.json();

    console.log('📦 收到响应:', result);

    if (result.success) {
      docDocuments = result.data.list;
      docTotalPages = Math.ceil(result.data.total / docPageSize);
      renderDocumentList(docDocuments);
      updateDocPagination();
    } else {
      docShowToast('加载失败: ' + result.error, 'error');
      document.getElementById('doc-document-list').innerHTML = 
        '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">加载失败: ' + result.error + '</td></tr>';
    }
  } catch (error) {
    console.error('❌ 加载文档列表失败:', error);
    docShowToast('网络错误: ' + error.message, 'error');
    
    // 显示错误提示
    const tbody = document.getElementById('doc-document-list');
    if (tbody) {
      tbody.innerHTML = 
        '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">加载失败，请检查网络连接</td></tr>';
    }
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (tableEl) tableEl.style.display = 'block';
  }
}

// 渲染文档列表
function renderDocumentList(docs) {
  const tbody = document.getElementById('doc-document-list');
  
  if (!tbody) {
    console.error('❌ 找不到 doc-document-list 元素');
    return;
  }
  
  if (docs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">暂无文档数据</td></tr>';
    return;
  }

  tbody.innerHTML = docs.map(doc => {
    const fileSize = ((doc.file_size || 0) / 1024).toFixed(2) + ' KB';
    const createdAt = new Date(doc.created_at).toLocaleString('zh-CN');
    const coverUrl = doc.cover ? `http://localhost:5001${doc.cover}` : '';

    return `
      <tr>
        <td><input type="checkbox" class="doc-checkbox" value="${doc.id}"></td>
        <td>${coverUrl ? `<img src="${coverUrl}" class="doc-cover-img" alt="封面">` : '-'}</td>
        <td><strong>${doc.name || '未命名'}</strong></td>
        <td>${doc.customer_name || '-'}</td>
        <td>${doc.slide_count || 0}</td>
        <td>${fileSize}</td>
        <td><span class="badge badge-info">${doc.status || 'draft'}</span></td>
        <td>
          <span class="doc-status-badge ${doc.is_extracted ? 'extracted' : 'not-extracted'}">
            ${doc.is_extracted ? `✅ 已提取 (${doc.extracted_count || 0})` : '⏳ 未提取'}
          </span>
        </td>
        <td>${createdAt}</td>
        <td class="doc-actions">
          <button class="btn btn-sm ${doc.is_extracted ? 'btn-secondary' : 'btn-success'}" 
            onclick="extractSingleDocument('${doc.id}')">
            ${doc.is_extracted ? '重新提取' : '提取'}
          </button>
          ${doc.is_extracted ? `<button class="btn btn-sm btn-primary" onclick="viewExtractedContent('${doc.id}')">查看</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// 搜索文档
function searchDocuments() {
  console.log('🔍 开始搜索...');
  docCurrentPage = 1;
  loadDocumentList();
}

// 提取单个文档
async function extractSingleDocument(docId) {
  const doc = docDocuments.find(d => d.id === docId);
  const force = doc?.is_extracted || false;

  if (force && !confirm('该文档已提取过，是否重新提取？')) {
    return;
  }

  docShowToast('正在提取文档...', 'info');

  try {
    const response = await fetch(`${DOC_API_BASE}/documents/${docId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        extract_method: 'auto',
        force: force
      })
    });

    const result = await response.json();

    if (result.success) {
      docShowToast(`提取成功！共提取 ${result.data.extracted_count} 页`, 'success');
      loadDocumentList();
    } else {
      docShowToast('提取失败: ' + result.error, 'error');
    }
  } catch (error) {
    docShowToast('网络错误: ' + error.message, 'error');
  }
}

// 批量提取
async function batchExtractDocuments() {
  const checkboxes = document.querySelectorAll('.doc-checkbox:checked');
  const docIds = Array.from(checkboxes).map(cb => cb.value);

  if (docIds.length === 0) {
    docShowToast('请先选择要提取的文档', 'error');
    return;
  }

  if (!confirm(`确定要批量提取 ${docIds.length} 个文档吗？`)) {
    return;
  }

  docShowToast('正在批量提取...', 'info');

  try {
    const response = await fetch(`${DOC_API_BASE}/documents/batch-extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_ids: docIds,
        extract_method: 'auto',
        force: false
      })
    });

    const result = await response.json();

    if (result.success) {
      const { success_count, skipped_count, failed_count } = result.data;
      docShowToast(`批量提取完成！成功: ${success_count}, 跳过: ${skipped_count}, 失败: ${failed_count}`, 'success');
      loadDocumentList();
    } else {
      docShowToast('批量提取失败: ' + result.error, 'error');
    }
  } catch (error) {
    docShowToast('网络错误: ' + error.message, 'error');
  }
}

// 查看提取内容
function viewExtractedContent(docId) {
  docShowToast('查看功能开发中...', 'info');
}

// 全选/取消全选
function toggleSelectAllDocs() {
  const selectAll = document.getElementById('doc-select-all');
  const checkboxes = document.querySelectorAll('.doc-checkbox');
  checkboxes.forEach(cb => cb.checked = selectAll.checked);
}

// 分页
function prevDocPage() {
  if (docCurrentPage > 1) {
    docCurrentPage--;
    loadDocumentList();
  }
}

function nextDocPage() {
  if (docCurrentPage < docTotalPages) {
    docCurrentPage++;
    loadDocumentList();
  }
}

function updateDocPagination() {
  const pageInfo = document.getElementById('doc-page-info');
  if (pageInfo) {
    pageInfo.textContent = `第 ${docCurrentPage} 页 / 共 ${docTotalPages} 页`;
  }
  
  const buttons = document.querySelectorAll('#doc-table-container .pagination button');
  if (buttons.length >= 2) {
    buttons[0].disabled = docCurrentPage === 1;
    buttons[1].disabled = docCurrentPage === docTotalPages;
  }
}

// Toast 提示框（独立实现，不依赖common.js）
function docShowToast(message, type = 'info') {
  // 移除已有的 toast
  const existingToast = document.querySelector('.doc-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建新 toast
  const toast = document.createElement('div');
  toast.className = `doc-toast doc-toast-${type}`;
  toast.textContent = message;
  
  // 设置样式
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
    word-wrap: break-word;
  `;
  
  // 根据类型设置边框颜色
  if (type === 'success') {
    toast.style.borderLeft = '4px solid #28a745';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #dc3545';
  } else if (type === 'info') {
    toast.style.borderLeft = '4px solid #17a2b8';
  }
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 添加动画样式
if (!document.getElementById('doc-toast-style')) {
  const style = document.createElement('style');
  style.id = 'doc-toast-style';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

console.log('✅ 文档管理页面JS已加载');

