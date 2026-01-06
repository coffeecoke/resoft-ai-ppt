/**
 * 语音转文本页面 - 集成到AI后台管理系统
 */

const ST_API_BASE = 'http://localhost:3000/api';
let st_selectedFile = null;
let st_currentTranscriptionId = null;
let st_audioPlayer = null;
let st_autoScrollEnabled = true;
let st_currentDialogues = [];
let st_editedDialogues = new Map(); // 存储编辑过的对话
let st_isEditMode = false;
let st_currentAudioPath = null;

// 页面初始化 - 等待DOM完全加载
(async function() {
  console.log('🎤 语音转文本页面初始化...');
  
  // ✅ 等待关键DOM元素存在
  await waitForElement('st-uploadArea');
  
  await initSpeechToText();
})();

// 等待DOM元素加载完成
function waitForElement(id, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.getElementById(id);
      if (element) {
        console.log(`✅ DOM元素 #${id} 已加载`);
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        console.error(`❌ 等待DOM元素 #${id} 超时`);
        reject(new Error(`元素 #${id} 加载超时`));
      } else {
        setTimeout(check, 50);
      }
    };
    
    check();
  });
}

// ==================== 初始化 ====================
async function initSpeechToText() {
  console.log('🔧 初始化语音转文本功能...');
  initEventListeners();
  initScanEventListeners(); // ✅ 添加扫描相关监听器
  await loadProducts();
  await loadSessions();
  await loadHistory();
  await loadScanConfig(); // ✅ 加载扫描配置
}

function initEventListeners() {
  // 文件选择
  const selectFileBtn = document.getElementById('st-selectFileBtn');
  const audioInput = document.getElementById('st-audioInput');
  const removeFileBtn = document.getElementById('st-removeFileBtn');
  const uploadBtn = document.getElementById('st-uploadBtn');
  
  selectFileBtn.addEventListener('click', () => audioInput.click());
  audioInput.addEventListener('change', handleFileSelect);
  removeFileBtn.addEventListener('click', removeFile);
  uploadBtn.addEventListener('click', uploadAndTranscribe);
  
  // 拖拽上传
  const uploadArea = document.getElementById('st-uploadArea');
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
  });
  
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('drag-over');
  });
  
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    
    const file = e.dataTransfer.files[0];
    if (file && isValidAudioFile(file)) {
      st_selectedFile = file;
      displayFileInfo(file);
    } else {
      showToast('请上传有效的音频文件', 'error');
    }
  });
  
  // 产品和场次管理
  document.getElementById('st-addProductBtn').addEventListener('click', () => {
    showToast('产品管理功能即将开放', 'info');
  });
  document.getElementById('st-refreshProductsBtn').addEventListener('click', loadProducts);
  document.getElementById('st-addSessionBtn').addEventListener('click', () => {
    showToast('场次管理功能即将开放', 'info');
  });
  document.getElementById('st-refreshSessionsBtn').addEventListener('click', loadSessions);
  
  // 结果操作
  document.getElementById('st-copyAllBtn').addEventListener('click', copyAllDialogues);
  document.getElementById('st-downloadBtn').addEventListener('click', downloadResult);
  document.getElementById('st-newTranscriptionBtn').addEventListener('click', resetForm);
  
  // 历史记录
  document.getElementById('st-refreshHistoryBtn').addEventListener('click', loadHistory);
  
  // ✅ 音频播放器相关
  st_audioPlayer = document.getElementById('st-audioPlayer');
  if (st_audioPlayer) {
    st_audioPlayer.addEventListener('timeupdate', handleAudioTimeUpdate);
    st_audioPlayer.addEventListener('loadedmetadata', handleAudioLoaded);
  }
  
  document.getElementById('st-toggleAutoScrollBtn')?.addEventListener('click', toggleAutoScroll);
  
  // ✅ 编辑功能相关
  document.getElementById('st-batchReplaceSpeakerBtn')?.addEventListener('click', showBatchReplaceDialog);
  document.getElementById('st-saveEditBtn')?.addEventListener('click', saveEdits);
  document.getElementById('st-cancelEditBtn')?.addEventListener('click', cancelEdits);
  
  // ✅ 对话列表的事件委托（点击定位、编辑按钮）
  document.getElementById('st-dialoguesList')?.addEventListener('click', handleDialogueClick);
}

// ==================== 音频播放器功能 ====================
function initAudioPlayer(audioPath) {
  if (!audioPath) {
    console.log('⚠️ 无音频文件路径');
    return;
  }

  const audioPlayerContainer = document.getElementById('st-audioPlayerContainer');
  const audioPlayer = document.getElementById('st-audioPlayer');
  const audioSource = document.getElementById('st-audioSource');
  
  if (!audioPlayer || !audioSource) {
    console.error('❌ 未找到音频播放器元素');
    return;
  }

  // ✅ 使用转录ID构建音频URL（后端会处理文件路径）
  const audioUrl = `${ST_API_BASE}/transcription/${st_currentTranscriptionId}/audio`;
  console.log('🎵 加载音频:', audioUrl);
  
  audioSource.src = audioUrl;
  audioPlayer.load();
  audioPlayerContainer.style.display = 'block';
  
  showToast('音频已加载，可以播放预览', 'info');
}

function handleAudioLoaded() {
  const totalTime = document.getElementById('st-totalTime');
  if (st_audioPlayer && totalTime) {
    totalTime.textContent = formatTimeFromSeconds(st_audioPlayer.duration);
  }
}

function handleAudioTimeUpdate() {
  if (!st_audioPlayer || !st_autoScrollEnabled) return;
  
  const currentTime = st_audioPlayer.currentTime;
  document.getElementById('st-currentTime').textContent = formatTimeFromSeconds(currentTime);
  
  // 找到当前播放时间对应的对话
  const dialogueItems = document.querySelectorAll('.dialogue-item');
  let activeIndex = -1;
  
  dialogueItems.forEach((item, index) => {
    const startTime = parseFloat(item.getAttribute('data-start')) || 0;
    const nextItem = dialogueItems[index + 1];
    const endTime = nextItem ? parseFloat(nextItem.getAttribute('data-start')) : Infinity;
    
    // 移除所有高亮
    item.classList.remove('active');
    
    // 检查当前时间是否在此对话区间
    if (currentTime >= startTime && currentTime < endTime) {
      item.classList.add('active');
      activeIndex = index;
    }
  });
  
  // 自动滚动到当前对话
  if (activeIndex >= 0 && st_autoScrollEnabled) {
    const activeItem = dialogueItems[activeIndex];
    activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function toggleAutoScroll() {
  st_autoScrollEnabled = !st_autoScrollEnabled;
  const icon = document.getElementById('st-autoScrollIcon');
  if (icon) {
    icon.textContent = st_autoScrollEnabled ? '✅' : '⬜';
  }
  showToast(st_autoScrollEnabled ? '已启用自动定位' : '已关闭自动定位', 'info');
}

// 将时间字符串 "00:00:12" 转换为秒数
function parseTimeToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return 0;
}

// 将秒数转换为时间字符串 "00:00:12"
function formatTimeFromSeconds(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ==================== 编辑功能 ====================
function handleDialogueClick(e) {
  const editBtn = e.target.closest('.dialogue-edit-btn');
  if (editBtn) {
    const index = parseInt(editBtn.getAttribute('data-index'));
    startEditDialogue(index);
    return;
  }
  
  // 点击对话项定位音频播放位置
  const dialogueItem = e.target.closest('.dialogue-item');
  if (dialogueItem && st_audioPlayer) {
    const startTime = parseFloat(dialogueItem.getAttribute('data-start')) || 0;
    st_audioPlayer.currentTime = startTime;
    if (st_audioPlayer.paused) {
      st_audioPlayer.play();
    }
  }
}

function startEditDialogue(index) {
  const dialogue = st_currentDialogues[index];
  if (!dialogue) return;
  
  const dialogueItem = document.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem) return;
  
  // 切换为编辑模式
  dialogueItem.classList.add('editing');
  dialogueItem.innerHTML = `
    <div class="edit-controls">
      <label style="font-weight: 500; margin-bottom: 5px; display: block;">说话人</label>
      <input type="text" class="edit-input" value="${escapeHtml(dialogue.speaker)}" style="width: 150px; margin-bottom: 10px;" data-field="speaker">
      
      <label style="font-weight: 500; margin-bottom: 5px; display: block;">对话内容</label>
      <textarea class="edit-textarea" data-field="text" style="margin-bottom: 10px;">${escapeHtml(dialogue.text)}</textarea>
      
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-sm btn-success" onclick="saveDialogueEdit(${index})">💾 保存</button>
        <button class="btn btn-sm btn-secondary" onclick="cancelDialogueEdit(${index})">❌ 取消</button>
      </div>
    </div>
  `;
  
  // 显示全局保存按钮
  document.getElementById('st-saveEditBtn').style.display = 'inline-block';
  document.getElementById('st-cancelEditBtn').style.display = 'inline-block';
}

function saveDialogueEdit(index) {
  const dialogueItem = document.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem) return;
  
  const newSpeaker = dialogueItem.querySelector('[data-field="speaker"]').value.trim();
  const newText = dialogueItem.querySelector('[data-field="text"]').value.trim();
  
  if (!newText) {
    showToast('对话内容不能为空', 'error');
    return;
  }
  
  // 保存到编辑记录
  st_editedDialogues.set(index, {
    ...st_currentDialogues[index],
    speaker: newSpeaker || st_currentDialogues[index].speaker,
    text: newText
  });
  
  // 更新内存中的对话数据
  st_currentDialogues[index].speaker = newSpeaker || st_currentDialogues[index].speaker;
  st_currentDialogues[index].text = newText;
  
  // 重新渲染该对话项
  renderSingleDialogue(index);
  
  showToast('修改已记录，请点击"保存修改"按钮提交', 'info');
}

function cancelDialogueEdit(index) {
  renderSingleDialogue(index);
}

function renderSingleDialogue(index) {
  const dialogue = st_currentDialogues[index];
  const dialogueItem = document.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem || !dialogue) return;
  
  dialogueItem.classList.remove('editing');
  const timeRange = dialogue.timeRange || dialogue.startTime || '';
  const speaker = dialogue.speaker || '说话人' + (index + 1);
  const text = dialogue.text || '';
  
  dialogueItem.innerHTML = `
    <div class="dialogue-header">
      <span class="dialogue-time">${timeRange}</span>
      <span class="speaker-name">${escapeHtml(speaker)}</span>
      <span style="color: #333;">：</span>
      <span class="dialogue-text-inline">${escapeHtml(text)}</span>
      <button class="btn btn-sm btn-secondary dialogue-edit-btn" data-index="${index}" style="margin-left: auto;">✏️</button>
    </div>
  `;
}

function showBatchReplaceDialog() {
  // 获取所有独特的说话人
  const speakers = [...new Set(st_currentDialogues.map(d => d.speaker))];
  
  const html = `
    <!-- 背景遮罩 -->
    <div class="modal-backdrop" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 998;" onclick="closeBatchReplaceDialog()"></div>
    
    <!-- 对话框内容 -->
    <div class="modal-content" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 500px; width: 90%; z-index: 999;" onclick="event.stopPropagation()">
      <h3 style="margin-top: 0;">🔄 批量替换说话人</h3>
      
      <div class="form-group" style="margin-bottom: 15px;">
        <label style="font-weight: 500; display: block; margin-bottom: 5px;">原说话人</label>
        <select id="batch-from-speaker" class="form-control">
          <option value="">-- 请选择 --</option>
          ${speakers.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      
      <div class="form-group" style="margin-bottom: 20px;">
        <label style="font-weight: 500; display: block; margin-bottom: 5px;">新说话人名称</label>
        <input type="text" id="batch-to-speaker" class="form-control" placeholder="例如: 张三">
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button class="btn btn-secondary" onclick="closeBatchReplaceDialog()">取消</button>
        <button class="btn btn-primary" onclick="executeBatchReplace()">✔️ 确认替换</button>
      </div>
    </div>
  `;
  
  const modal = document.createElement('div');
  modal.id = 'batch-replace-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 999;';
  modal.innerHTML = html;
  document.body.appendChild(modal);
}

function closeBatchReplaceDialog() {
  const modal = document.getElementById('batch-replace-modal');
  if (modal) {
    modal.remove();
  }
}

function executeBatchReplace() {
  const fromSpeaker = document.getElementById('batch-from-speaker').value;
  const toSpeaker = document.getElementById('batch-to-speaker').value.trim();
  
  if (!fromSpeaker || !toSpeaker) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  if (fromSpeaker === toSpeaker) {
    showToast('新旧说话人名称相同，无需替换', 'warning');
    return;
  }
  
  let count = 0;
  st_currentDialogues.forEach((dialogue, index) => {
    if (dialogue.speaker === fromSpeaker) {
      st_currentDialogues[index].speaker = toSpeaker;
      st_editedDialogues.set(index, { ...dialogue, speaker: toSpeaker });
      count++;
    }
  });
  
  // 重新渲染所有对话
  renderDialogues(st_currentDialogues);
  
  // 显示保存按钮
  document.getElementById('st-saveEditBtn').style.display = 'inline-block';
  document.getElementById('st-cancelEditBtn').style.display = 'inline-block';
  
  closeBatchReplaceDialog();
  showToast(`已替换 ${count} 条对话的说话人，请点击"保存修改"提交`, 'success');
}

async function saveEdits() {
  if (st_editedDialogues.size === 0) {
    showToast('没有需要保存的修改', 'info');
    return;
  }
  
  if (!window.confirm(`确认保存 ${st_editedDialogues.size} 条修改？`)) {
    return;
  }
  
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dialogues: st_currentDialogues
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '保存失败');
    }
    
    st_editedDialogues.clear();
    document.getElementById('st-saveEditBtn').style.display = 'none';
    document.getElementById('st-cancelEditBtn').style.display = 'none';
    
    showToast('保存成功！', 'success');
    await loadHistory(); // 刷新历史记录
    
  } catch (error) {
    console.error('保存编辑失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  }
}

function cancelEdits() {
  if (!window.confirm('确认放弃所有修改？')) {
    return;
  }
  
  // 重新加载原始数据
  if (st_currentTranscriptionId) {
    loadTranscriptionById(st_currentTranscriptionId);
  }
  
  st_editedDialogues.clear();
  document.getElementById('st-saveEditBtn').style.display = 'none';
  document.getElementById('st-cancelEditBtn').style.display = 'none';
  
  showToast('已取消所有修改', 'info');
}

async function loadTranscriptionById(id) {
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/${id}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载失败');
    }
    
    displayResult(result.data);
    
  } catch (error) {
    console.error('加载转录失败:', error);
    showToast('加载失败: ' + error.message, 'error');
  }
}

// ==================== 文件处理 ====================
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file && isValidAudioFile(file)) {
    st_selectedFile = file;
    displayFileInfo(file);
  } else {
    showToast('请上传有效的音频文件', 'error');
  }
}

function isValidAudioFile(file) {
  const validExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.wma', '.ogg'];
  const fileName = file.name.toLowerCase();
  return validExtensions.some(ext => fileName.endsWith(ext));
}

function displayFileInfo(file) {
  document.getElementById('st-fileName').textContent = file.name;
  document.getElementById('st-fileSize').textContent = formatFileSize(file.size);
  document.getElementById('st-fileInfo').style.display = 'flex';
  document.getElementById('st-optionalFields').style.display = 'block';
  document.getElementById('st-uploadBtn').disabled = false;
  document.getElementById('st-uploadArea').style.display = 'none';
}

function removeFile() {
  st_selectedFile = null;
  document.getElementById('st-audioInput').value = '';
  document.getElementById('st-fileInfo').style.display = 'none';
  document.getElementById('st-optionalFields').style.display = 'none';
  document.getElementById('st-uploadBtn').disabled = true;
  document.getElementById('st-uploadArea').style.display = 'block';
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
  if (!st_selectedFile) {
    showToast('请先选择音频文件', 'error');
    return;
  }

  // 隐藏上传区域，显示进度
  document.getElementById('st-fileInfo').style.display = 'none';
  document.getElementById('st-optionalFields').style.display = 'none';
  document.getElementById('st-uploadBtn').style.display = 'none';
  document.getElementById('st-resultSection').style.display = 'none';
  document.getElementById('st-progressSection').style.display = 'block';

  // 准备表单数据
  const formData = new FormData();
  formData.append('audio', st_selectedFile);
  
  const audioName = document.getElementById('st-audioName').value.trim();
  if (audioName) formData.append('name', audioName);
  
  const customerName = document.getElementById('st-customerName').value.trim();
  if (customerName) formData.append('customerName', customerName);
  
  const productId = document.getElementById('st-productSelect').value;
  if (productId) formData.append('productId', productId);
  
  const sessionId = document.getElementById('st-sessionSelect').value;
  if (sessionId) formData.append('sessionId', sessionId);

  try {
    updateProgress('⏫ 正在上传音频文件...', '请稍候，文件上传中', 30);

    const response = await fetch(`${ST_API_BASE}/transcription/upload`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || '转录失败');
    }

    updateProgress('✅ 转录成功！', '正在准备结果显示...', 100);
    
    setTimeout(() => {
      displayResult(result.data);
      loadHistory();
    }, 500);

  } catch (error) {
    console.error('转录失败:', error);
    showToast('转录失败: ' + error.message, 'error');
    resetForm();
  }
}

function updateProgress(title, desc, percentage) {
  document.getElementById('st-progressTitle').textContent = title;
  document.getElementById('st-progressDesc').textContent = desc;
  document.getElementById('st-progressFill').style.width = percentage + '%';
  document.getElementById('st-progressPercentage').textContent = percentage + '%';
}

// ==================== 结果显示 ====================
function displayResult(data) {
  st_currentTranscriptionId = data.id;
  st_currentAudioPath = data.audio_file_path; // 保存音频路径
  
  document.getElementById('st-progressSection').style.display = 'none';
  document.getElementById('st-resultSection').style.display = 'block';
  
  // ✅ 修复字段名匹配（使用数据库字段名 + Python返回的驼峰命名）
  document.getElementById('st-speakerCount').textContent = data.speaker_count || data.speakerCount || '-';
  
  // 解析 dialogues（如果是字符串）
  let dialogues = data.dialogues;
  if (typeof dialogues === 'string') {
    try {
      dialogues = JSON.parse(dialogues);
    } catch (e) {
      dialogues = [];
    }
  }
  
  document.getElementById('st-dialogueCount').textContent = (dialogues?.length || 0);
  document.getElementById('st-audioDuration').textContent = formatDuration(
    data.audio_duration || data.audioDuration || data.duration  // ✅ 兼容三种命名
  );
  document.getElementById('st-transcriptionTime').textContent = formatDateTime(data.created_at || data.createdAt);
  
  // ✅ 初始化音频播放器
  initAudioPlayer(st_currentAudioPath);
  
  renderDialogues(dialogues || []);
  
  showToast('转录成功！', 'success');
}

function renderDialogues(dialogues) {
  const container = document.getElementById('st-dialoguesList');
  
  if (!dialogues || dialogues.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无对话内容</p>';
    return;
  }
  
  // 保存原始对话数据
  st_currentDialogues = dialogues;
  
  container.innerHTML = dialogues.map((dialogue, index) => {
    const timeRange = dialogue.timeRange || dialogue.startTime || '';
    const speaker = dialogue.speaker || '说话人' + (index + 1);
    const text = dialogue.text || '';
    
    return `
      <div class="dialogue-item" data-index="${index}" data-start="${parseTimeToSeconds(timeRange.split('-')[0])}">
        <div class="dialogue-header">
          <span class="dialogue-time">${timeRange}</span>
          <span class="speaker-name">${escapeHtml(speaker)}</span>
          <span style="color: #333;">：</span>
          <span class="dialogue-text-inline">${escapeHtml(text)}</span>
          <button class="btn btn-sm btn-secondary dialogue-edit-btn" data-index="${index}" style="margin-left: auto;">✏️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 操作功能 ====================
function copyAllDialogues() {
  const dialogues = document.querySelectorAll('.dialogue-text');
  const text = Array.from(dialogues).map(d => d.textContent).join('\n\n');
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板', 'success');
  }).catch(err => {
    console.error('复制失败:', err);
    showToast('复制失败', 'error');
  });
}

function downloadResult() {
  if (!st_currentTranscriptionId) {
    showToast('没有可下载的结果', 'error');
    return;
  }
  
  const dialogues = document.querySelectorAll('.dialogue-item');
  let content = `语音转文本结果\n\n`;
  content += `转录时间: ${document.getElementById('st-transcriptionTime').textContent}\n`;
  content += `说话人数: ${document.getElementById('st-speakerCount').textContent}\n`;
  content += `对话数量: ${document.getElementById('st-dialogueCount').textContent}\n`;
  content += `音频时长: ${document.getElementById('st-audioDuration').textContent}\n\n`;
  content += `${'='.repeat(50)}\n\n`;
  
  dialogues.forEach(dialogue => {
    const speaker = dialogue.querySelector('.speaker-name').textContent;
    const text = dialogue.querySelector('.dialogue-text').textContent;
    content += `【${speaker}】\n${text}\n\n`;
  });
  
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `转录结果_${new Date().getTime()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('下载成功', 'success');
}

function resetForm() {
  st_selectedFile = null;
  st_currentTranscriptionId = null;
  
  document.getElementById('st-audioInput').value = '';
  document.getElementById('st-audioName').value = '';
  document.getElementById('st-customerName').value = '';
  document.getElementById('st-productSelect').value = '';
  document.getElementById('st-sessionSelect').value = '';
  
  document.getElementById('st-fileInfo').style.display = 'none';
  document.getElementById('st-optionalFields').style.display = 'none';
  document.getElementById('st-uploadBtn').style.display = 'block';
  document.getElementById('st-uploadBtn').disabled = true;
  document.getElementById('st-progressSection').style.display = 'none';
  document.getElementById('st-resultSection').style.display = 'none';
  document.getElementById('st-uploadArea').style.display = 'block';
}

// ==================== 数据加载 ====================
async function loadProducts() {
  try {
    const response = await fetch(`${ST_API_BASE}/products`);
    const result = await response.json();
    
    const select = document.getElementById('st-productSelect');
    select.innerHTML = '<option value="">-- 无关联（可选）--</option>';
    
    if (result.success && result.data) {
      result.data.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.textContent = product.name;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载产品列表失败:', error);
  }
}

async function loadSessions() {
  try {
    const response = await fetch(`${ST_API_BASE}/sessions/recent`);
    const result = await response.json();
    
    const select = document.getElementById('st-sessionSelect');
    select.innerHTML = '<option value="">-- 无关联（可选）--</option>';
    
    if (result.success && result.data) {
      result.data.forEach(session => {
        const option = document.createElement('option');
        option.value = session.id;
        option.textContent = `${session.name} (${formatDate(session.date)})`;
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载场次列表失败:', error);
  }
}

async function loadHistory() {
  const container = document.getElementById('st-historyList');
  container.innerHTML = '<p class="loading">加载中...</p>';
  
  try {
    const response = await fetch(`${ST_API_BASE}/transcription`);
    const result = await response.json();
    
    if (!result.success || !result.data || result.data.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无转录历史</p>';
      return;
    }
    
    container.innerHTML = result.data.map(item => `
      <div class="history-item" onclick="viewTranscription('${item.id}')">
        <div class="history-header">
          <p class="history-title">${escapeHtml(item.name)}</p>
          <span class="history-date">${formatDateTime(item.createdAt)}</span>
        </div>
        <p class="history-meta">
          ${item.customerName ? `客户: ${escapeHtml(item.customerName)} | ` : ''}
          时长: ${formatDuration(item.duration)} | 
          对话数: ${item.dialogues?.length || 0}
        </p>
      </div>
    `).join('');
  } catch (error) {
    console.error('加载历史记录失败:', error);
    container.innerHTML = '<p style="text-align: center; color: var(--error); padding: 20px;">加载失败</p>';
  }
}

async function viewTranscription(id) {
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/${id}`);
    const result = await response.json();
    
    if (result.success && result.data) {
      displayResult(result.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error('加载转录详情失败:', error);
    showToast('加载失败', 'error');
  }
}

// ==================== 全局函数暴露（供HTML调用）====================
window.saveDialogueEdit = saveDialogueEdit;
window.cancelDialogueEdit = cancelDialogueEdit;
window.closeBatchReplaceDialog = closeBatchReplaceDialog;
window.executeBatchReplace = executeBatchReplace;

// ==================== 工具函数 ====================
function formatDuration(seconds) {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTime(seconds) {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDateTime(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const existingToast = document.querySelector('.st-toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `st-toast st-toast-${type}`;
  toast.textContent = message;
  
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
    font-size: 14px;
    border-left: 4px solid ${type === 'success' ? '#52c41a' : type === 'error' ? '#f5222d' : '#1890ff'};
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== Tab 切换 ====================
function st_switchTab(tab) {
  const uploadTab = document.getElementById('st-uploadTab');
  const scanTab = document.getElementById('st-scanTab');
  const tabs = document.querySelectorAll('.tab-btn');
  
  tabs.forEach(t => t.classList.remove('active'));
  
  if (tab === 'upload') {
    uploadTab.style.display = 'block';
    scanTab.style.display = 'none';
    tabs[0].classList.add('active');
  } else if (tab === 'scan') {
    uploadTab.style.display = 'none';
    scanTab.style.display = 'block';
    tabs[1].classList.add('active');
    loadScanFiles(); // 自动加载文件列表
  }
}

// ==================== 扫描功能 ====================
function initScanEventListeners() {
  // 保存配置
  document.getElementById('st-saveScanConfigBtn').addEventListener('click', saveScanConfig);
  
  // 刷新文件列表
  document.getElementById('st-refreshFilesBtn').addEventListener('click', loadScanFiles);
}

async function loadScanConfig() {
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/scan/config`);
    const result = await response.json();
    
    if (result.success && result.data) {
      document.getElementById('st-scanDirectory').value = result.data.scanDirectory || '';
    }
  } catch (error) {
    console.error('加载扫描配置失败:', error);
  }
}

async function saveScanConfig() {
  try {
    const scanDirectory = document.getElementById('st-scanDirectory').value.trim();
    
    if (!scanDirectory) {
      showToast('请输入扫描目录路径', 'error');
      return;
    }
    
    const response = await fetch(`${ST_API_BASE}/transcription/scan/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scanDirectory })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('配置已保存', 'success');
      loadScanFiles(); // 保存后自动刷新文件列表
    } else {
      showToast('保存失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('保存扫描配置失败:', error);
    showToast('保存失败', 'error');
  }
}

async function loadScanFiles() {
  const tbody = document.getElementById('st-fileList');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">正在扫描...</td></tr>';
  
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/scan/files`);
    const result = await response.json();
    
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="error">${result.error}</td></tr>`;
      document.getElementById('st-fileCount').textContent = '总计: 0 个文件';
      return;
    }
    
    const files = result.data || [];
    document.getElementById('st-fileCount').textContent = `总计: ${files.length} 个文件`;
    
    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">目录中没有找到音频文件</td></tr>';
      return;
    }
    
    tbody.innerHTML = files.map((file, index) => `
      <tr data-file-index="${index}">
        <td>
          <strong>${escapeHtml(file.fileName)}</strong>
          <br>
          <small style="color: var(--text-secondary);">${escapeHtml(file.relativePath)}</small>
        </td>
        <td><span class="badge badge-info">${file.format.toUpperCase()}</span></td>
        <td>${formatFileSize(file.fileSize)}</td>
        <td>${formatDateTime(file.modifiedTime)}</td>
        <td>
          ${file.transcribed 
            ? `<span class="badge badge-success">✅ 已转录</span>` 
            : `<span class="badge badge-secondary">⏳ 待转录</span>`
          }
        </td>
        <td>
          ${file.transcribed
            ? `<button class="btn btn-sm btn-secondary" onclick="viewTranscription('${file.transcriptionId}')">✏️ 核查纠偏</button>`
            : `<button class="btn btn-sm btn-primary" data-file-index="${index}">🎤 转录</button>`
          }
        </td>
      </tr>
    `).join('');
    
    // ✅ 使用事件委托处理转录按钮点击
    tbody.querySelectorAll('button[data-file-index]').forEach(btn => {
      btn.addEventListener('click', function() {
        const index = parseInt(this.getAttribute('data-file-index'));
        const file = files[index];
        st_transcribeFile(file.filePath, file.fileName);
      });
    });
  } catch (error) {
    console.error('加载文件列表失败:', error);
    tbody.innerHTML = `<tr><td colspan="6" class="error">加载失败: ${error.message}</td></tr>`;
    document.getElementById('st-fileCount').textContent = '总计: 0 个文件';
  }
}

async function st_transcribeFile(filePath, fileName) {
  if (!window.confirm(`确定要转录文件 "${fileName}" 吗？`)) {
    return;
  }
  
  showToast('开始转录...', 'info');
  
  try {
    const response = await fetch(`${ST_API_BASE}/transcription/scan/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath, fileName })
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('转录成功！', 'success');
      loadScanFiles(); // 刷新列表
      loadHistory(); // 刷新历史记录
    } else {
      showToast('转录失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('转录失败:', error);
    showToast('转录失败: ' + error.message, 'error');
  }
}

