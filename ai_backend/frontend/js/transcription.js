/**
 * 语音转文本 - 前端交互逻辑
 */

// ==================== 全局状态 ====================
let selectedFile = null;
let currentTranscriptionId = null;
/** 当前转录对应的音频显示名（下载 txt 与音频名一致） */
let currentAudioDisplayName = '';

// ==================== DOM 元素 ====================
const elements = {
  // 上传区域
  uploadArea: document.getElementById('uploadArea'),
  audioInput: document.getElementById('audioInput'),
  selectFileBtn: document.getElementById('selectFileBtn'),
  fileInfo: document.getElementById('fileInfo'),
  fileName: document.getElementById('fileName'),
  fileSize: document.getElementById('fileSize'),
  removeFileBtn: document.getElementById('removeFileBtn'),
  optionalFields: document.getElementById('optionalFields'),
  uploadBtn: document.getElementById('uploadBtn'),
  
  // 可选字段
  audioName: document.getElementById('audioName'),
  customerName: document.getElementById('customerName'),
  productSelect: document.getElementById('productSelect'),
  sessionSelect: document.getElementById('sessionSelect'),
  addProductBtn: document.getElementById('addProductBtn'),
  refreshProductsBtn: document.getElementById('refreshProductsBtn'),
  addSessionBtn: document.getElementById('addSessionBtn'),
  refreshSessionsBtn: document.getElementById('refreshSessionsBtn'),
  
  // 进度区域
  progressSection: document.getElementById('progressSection'),
  progressTitle: document.getElementById('progressTitle'),
  progressDesc: document.getElementById('progressDesc'),
  progressFill: document.getElementById('progressFill'),
  progressPercentage: document.getElementById('progressPercentage'),
  
  // 结果区域
  resultSection: document.getElementById('resultSection'),
  speakerCount: document.getElementById('speakerCount'),
  dialogueCount: document.getElementById('dialogueCount'),
  audioDuration: document.getElementById('audioDuration'),
  transcriptionTime: document.getElementById('transcriptionTime'),
  dialoguesList: document.getElementById('dialoguesList'),
  copyAllBtn: document.getElementById('copyAllBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  newTranscriptionBtn: document.getElementById('newTranscriptionBtn'),
  
  // 历史记录
  historyList: document.getElementById('historyList'),
  refreshHistoryBtn: document.getElementById('refreshHistoryBtn')
};

// ==================== 初始化 ====================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadProducts();
  loadSessions();
  loadHistory();
});

function initEventListeners() {
  // 文件选择
  elements.selectFileBtn.addEventListener('click', () => elements.audioInput.click());
  elements.audioInput.addEventListener('change', handleFileSelect);
  elements.removeFileBtn.addEventListener('click', removeFile);
  
  // 拖拽上传
  elements.uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.add('drag-over');
  });
  
  elements.uploadArea.addEventListener('dragleave', () => {
    elements.uploadArea.classList.remove('drag-over');
  });
  
  elements.uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && isValidAudioFile(file)) {
      selectedFile = file;
      displayFileInfo(file);
    } else {
      showToast('请上传有效的音频文件', 'error');
    }
  });
  
  // 上传按钮
  elements.uploadBtn.addEventListener('click', uploadAndTranscribe);
  
  // 产品和场次管理
  elements.addProductBtn.addEventListener('click', showAddProductDialog);
  elements.refreshProductsBtn.addEventListener('click', loadProducts);
  elements.addSessionBtn.addEventListener('click', showAddSessionDialog);
  elements.refreshSessionsBtn.addEventListener('click', loadSessions);
  
  // 结果操作
  elements.copyAllBtn.addEventListener('click', copyAllDialogues);
  elements.downloadBtn.addEventListener('click', downloadResult);
  elements.newTranscriptionBtn.addEventListener('click', resetForm);
  
  // 历史记录
  elements.refreshHistoryBtn.addEventListener('click', loadHistory);
}

// ==================== 文件处理 ====================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && isValidAudioFile(file)) {
    selectedFile = file;
    displayFileInfo(file);
  } else {
    showToast('请上传有效的音频文件', 'error');
  }
}

function isValidAudioFile(file) {
  const validAudioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg'];
  const validVideoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.webm', '.3gp', '.3g2'];
  const fileName = file.name.toLowerCase();
  return validAudioExtensions.some(ext => fileName.endsWith(ext)) || 
         validVideoExtensions.some(ext => fileName.endsWith(ext));
}

function displayFileInfo(file) {
  elements.fileName.textContent = file.name;
  elements.fileSize.textContent = formatFileSize(file.size);
  elements.fileInfo.style.display = 'flex';
  elements.optionalFields.style.display = 'block';
  elements.uploadBtn.disabled = false;
  elements.uploadArea.style.display = 'none';
}

function removeFile() {
  selectedFile = null;
  elements.audioInput.value = '';
  elements.fileInfo.style.display = 'none';
  elements.optionalFields.style.display = 'none';
  elements.uploadBtn.disabled = true;
  elements.uploadArea.style.display = 'block';
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// ==================== 上传与转录 ====================
async function uploadAndTranscribe() {
  if (!selectedFile) {
    showToast('请先选择音频文件', 'error');
    return;
  }

  // 隐藏上传区域，显示进度
  elements.fileInfo.style.display = 'none';
  elements.optionalFields.style.display = 'none';
  elements.uploadBtn.style.display = 'none';
  elements.resultSection.style.display = 'none';
  elements.progressSection.style.display = 'block';

  // 准备表单数据
  const formData = new FormData();
  formData.append('audio', selectedFile);
  
  // 音频名称（如果用户自定义）
  const audioName = elements.audioName.value.trim();
  if (audioName) {
    formData.append('name', audioName);
  }
  
  // 客户名称
  if (elements.customerName.value.trim()) {
    formData.append('customerName', elements.customerName.value.trim());
  }
  
  // 关联产品
  if (elements.productSelect.value) {
    formData.append('productId', elements.productSelect.value);
  }
  
  // 关联场次
  if (elements.sessionSelect.value) {
    formData.append('sessionId', elements.sessionSelect.value);
  }

  try {
    // 模拟上传进度
    updateProgress('⏫ 正在上传音频文件...', '请稍候，文件上传中', 30);

    const response = await fetch('/api/transcription/upload', {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '转录失败');
    }

    // 转录成功
    updateProgress('✅ 转录成功！', '正在准备结果显示...', 100);
    
    setTimeout(() => {
      displayResult(result.data);
      loadHistory(); // 刷新历史记录
    }, 500);

  } catch (error) {
    console.error('转录失败:', error);
    showToast('转录失败: ' + error.message, 'error');
    resetForm();
  }
}

function updateProgress(title, desc, percentage) {
  elements.progressTitle.textContent = title;
  elements.progressDesc.textContent = desc;
  elements.progressFill.style.width = percentage + '%';
  elements.progressPercentage.textContent = percentage + '%';
}

// ==================== 结果显示 ====================
function displayResult(data) {
  currentTranscriptionId = data.id;
  currentAudioDisplayName =
    (data.original_file_name && String(data.original_file_name).trim()) ||
    (data.originalFileName && String(data.originalFileName).trim()) ||
    (data.fileName && String(data.fileName).trim()) ||
    (data.name && String(data.name).trim()) ||
    (selectedFile && selectedFile.name) ||
    '';

  // 隐藏进度，显示结果
  elements.progressSection.style.display = 'none';
  elements.resultSection.style.display = 'block';
  
  // 更新统计信息
  elements.speakerCount.textContent = data.speakerCount || '-';
  elements.dialogueCount.textContent = data.dialogues?.length || '-';
  elements.audioDuration.textContent = formatDuration(data.duration);
  elements.transcriptionTime.textContent = formatDateTime(data.createdAt);
  
  // 渲染对话列表
  renderDialogues(data.dialogues || []);
  
  showToast('转录成功！', 'success');
}

function renderDialogues(dialogues) {
  if (!dialogues || dialogues.length === 0) {
    elements.dialoguesList.innerHTML = '<p class="no-data">暂无对话内容</p>';
    return;
  }

  elements.dialoguesList.innerHTML = dialogues.map((dialogue, index) => `
    <div class="dialogue-item" data-speaker="${dialogue.speaker}">
      <div class="dialogue-header">
        <span class="dialogue-speaker">${dialogue.speaker}</span>
        <span class="dialogue-time">${dialogue.timeRange}</span>
        <button class="btn-copy-dialogue" onclick="copyDialogue(${index})">📋</button>
      </div>
      <div class="dialogue-text">${escapeHtml(dialogue.text)}</div>
    </div>
  `).join('');
}

// ==================== 工具函数 ====================
function formatDuration(seconds) {
  if (!seconds) return '-';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${minutes}:${pad(secs)}`;
}

function pad(num) {
  return String(num).padStart(2, '0');
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ==================== 复制功能 ====================
function copyAllDialogues() {
  const dialogues = Array.from(elements.dialoguesList.querySelectorAll('.dialogue-item'));
  const text = dialogues.map(item => {
    const speaker = item.querySelector('.dialogue-speaker').textContent;
    const time = item.querySelector('.dialogue-time').textContent;
    const content = item.querySelector('.dialogue-text').textContent;
    return `[${time}] ${speaker}: ${content}`;
  }).join('\n\n');
  
  copyToClipboard(text);
  showToast('已复制全部对话', 'success');
}

function copyDialogue(index) {
  const dialogue = elements.dialoguesList.querySelectorAll('.dialogue-item')[index];
  const speaker = dialogue.querySelector('.dialogue-speaker').textContent;
  const time = dialogue.querySelector('.dialogue-time').textContent;
  const content = dialogue.querySelector('.dialogue-text').textContent;
  const text = `[${time}] ${speaker}: ${content}`;
  
  copyToClipboard(text);
  showToast('已复制对话', 'success');
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text);
  } else {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

// ==================== 下载功能 ====================
function buildTranscriptionDownloadFilename(displayName) {
  let raw = (displayName && String(displayName).trim()) || '';
  raw = raw.replace(/^.*[/\\]/, '');
  if (!raw) {
    return `转录结果_${Date.now()}.txt`;
  }
  const stem = raw.replace(
    /\.(mp3|wav|m4a|flac|aac|wma|ogg|mp4|avi|mov|mkv|flv|wmv|webm|3gp|3g2|txt)$/i,
    ''
  );
  const base = (stem.trim() || raw)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/^\.+/, '')
    .trim()
    .substring(0, 180);
  return `${base || `转录结果_${Date.now()}`}.txt`;
}

function downloadResult() {
  if (!currentTranscriptionId) return;
  
  const dialogues = Array.from(elements.dialoguesList.querySelectorAll('.dialogue-item'));
  const text = dialogues.map(item => {
    const speaker = item.querySelector('.dialogue-speaker').textContent;
    const time = item.querySelector('.dialogue-time').textContent;
    const content = item.querySelector('.dialogue-text').textContent;
    return `[${time}] ${speaker}: ${content}`;
  }).join('\n\n');
  
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = buildTranscriptionDownloadFilename(currentAudioDisplayName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('下载成功', 'success');
}

// ==================== 历史记录 ====================
async function loadHistory() {
  elements.historyList.innerHTML = '<p class="loading-text">加载中...</p>';
  
  try {
    const response = await fetch('/api/transcription?page=1&pageSize=10');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载失败');
    }
    
    renderHistory(result.data.list);
    
  } catch (error) {
    console.error('加载历史失败:', error);
    elements.historyList.innerHTML = '<p class="no-data">加载失败</p>';
  }
}

function renderHistory(list) {
  if (!list || list.length === 0) {
    elements.historyList.innerHTML = '<p class="no-data">暂无转录记录</p>';
    return;
  }
  
  elements.historyList.innerHTML = list.map(item => `
    <div class="history-item">
      <div class="history-icon">🎙️</div>
      <div class="history-content">
        <h4 class="history-title">${escapeHtml(item.name)}</h4>
        <div class="history-meta">
          <span>🎤 ${item.speaker_count} 人</span>
          <span>💬 ${JSON.parse(item.dialogues || '[]').length} 条</span>
          <span>⏱️ ${formatDuration(item.audio_duration)}</span>
          <span>📅 ${formatDateTime(item.created_at)}</span>
        </div>
      </div>
      <div class="history-actions">
        <button class="btn-view" onclick="viewTranscription('${item.id}')">查看</button>
        <button class="btn-delete" onclick="deleteTranscription('${item.id}')">删除</button>
      </div>
    </div>
  `).join('');
}

async function viewTranscription(id) {
  try {
    const response = await fetch(`/api/transcription/${id}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载失败');
    }
    
    displayResult(result.data);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
  } catch (error) {
    console.error('加载转录详情失败:', error);
    showToast('加载失败: ' + error.message, 'error');
  }
}

async function deleteTranscription(id) {
  if (!confirm('确定删除这条转录记录吗？')) return;
  
  try {
    const response = await fetch(`/api/transcription/${id}`, { method: 'DELETE' });
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '删除失败');
    }
    
    showToast('删除成功', 'success');
    loadHistory();
    
    // 如果删除的是当前显示的记录，重置表单
    if (currentTranscriptionId === id) {
      resetForm();
    }
    
  } catch (error) {
    console.error('删除失败:', error);
    showToast('删除失败: ' + error.message, 'error');
  }
}

// ==================== 重置表单 ====================
function resetForm() {
  selectedFile = null;
  currentTranscriptionId = null;
  currentAudioDisplayName = '';
  elements.audioInput.value = '';
  elements.audioName.value = '';
  elements.customerName.value = '';
  elements.productSelect.value = '';
  elements.sessionSelect.value = '';
  elements.fileInfo.style.display = 'none';
  elements.optionalFields.style.display = 'none';
  elements.uploadBtn.disabled = true;
  elements.uploadBtn.style.display = 'block';
  elements.uploadArea.style.display = 'block';
  elements.progressSection.style.display = 'none';
  elements.resultSection.style.display = 'none';
}

// ==================== 产品管理 ====================
async function loadProducts() {
  try {
    const response = await fetch('/api/products?isActive=true&limit=100');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载产品列表失败');
    }
    
    const products = result.data.products || [];
    elements.productSelect.innerHTML = '<option value="">-- 无关联（可选）--</option>';
    
    products.forEach(product => {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = `${product.name}${product.code ? ` (${product.code})` : ''}`;
      elements.productSelect.appendChild(option);
    });
    
    console.log(`✅ 已加载 ${products.length} 个产品`);
  } catch (error) {
    console.error('加载产品列表失败:', error);
    showToast('加载产品列表失败', 'error');
  }
}

function showAddProductDialog() {
  const name = prompt('请输入产品名称:');
  if (!name || !name.trim()) return;
  
  const code = prompt('请输入产品代码（可选，留空则自动生成）:');
  
  createProduct(name.trim(), code ? code.trim() : null);
}

async function createProduct(name, code) {
  try {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        code: code || `PROD_${Date.now()}`,
        isActive: true
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '创建产品失败');
    }
    
    showToast(`产品 "${name}" 创建成功！`, 'success');
    await loadProducts();
    
    // 自动选中新创建的产品
    elements.productSelect.value = result.data.id;
  } catch (error) {
    console.error('创建产品失败:', error);
    showToast('创建产品失败: ' + error.message, 'error');
  }
}

// ==================== 场次管理 ====================
async function loadSessions() {
  try {
    const response = await fetch('/api/sessions?limit=100');
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载场次列表失败');
    }
    
    const sessions = result.data.sessions || [];
    elements.sessionSelect.innerHTML = '<option value="">-- 无关联（可选）--</option>';
    
    sessions.forEach(session => {
      const option = document.createElement('option');
      option.value = session.id;
      const dateStr = new Date(session.session_date).toLocaleDateString('zh-CN');
      option.textContent = `${session.title} - ${session.customer_name} (${dateStr})`;
      elements.sessionSelect.appendChild(option);
    });
    
    console.log(`✅ 已加载 ${sessions.length} 个场次`);
  } catch (error) {
    console.error('加载场次列表失败:', error);
    showToast('加载场次列表失败', 'error');
  }
}

function showAddSessionDialog() {
  const title = prompt('请输入会议主题:');
  if (!title || !title.trim()) return;
  
  const customerName = prompt('请输入客户名称:');
  if (!customerName || !customerName.trim()) return;
  
  const sessionDate = prompt('请输入会议时间 (格式: YYYY-MM-DD):', 
                             new Date().toISOString().split('T')[0]);
  if (!sessionDate) return;
  
  createSession(title.trim(), customerName.trim(), sessionDate);
}

async function createSession(title, customerName, sessionDate) {
  try {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title,
        customerName,
        sessionDate: new Date(sessionDate).toISOString(),
        status: 'draft'
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '创建场次失败');
    }
    
    showToast(`场次 "${title}" 创建成功！`, 'success');
    await loadSessions();
    
    // 自动选中新创建的场次
    elements.sessionSelect.value = result.data.id;
  } catch (error) {
    console.error('创建场次失败:', error);
    showToast('创建场次失败: ' + error.message, 'error');
  }
}

// ==================== 提示消息 ====================
function showToast(message, type = 'info') {
  // 创建 Toast 元素
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // 显示动画
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3秒后移除
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => document.body.removeChild(toast), 300);
  }, 3000);
}

