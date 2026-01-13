/**
 * 语音转文本页面 - 集成到AI后台管理系统
 */

// 使用相对路径，支持本地和远程访问
const ST_API_BASE = (window.location.origin || 'http://localhost:3000') + '/api';
let st_selectedFile = null;
let st_currentTranscriptionId = null;
let st_audioPlayer = null;
let st_autoScrollEnabled = false;
let st_currentDialogues = [];
let st_originalDialogues = []; // 存储原始对话（从 transcriptions 表）
let st_mergedDialogues = []; // 存储第一次合并后的对话（从 dialogue_adjustments 表，note1='合并相邻同一说话人的对话'）
let st_correctedDialogues = []; // 存储AI修正后的对话（从 dialogue_adjustments 表，note1='AI错别字修正'）
let st_reMergedDialogues = []; // 存储再次合并后的对话（从 dialogue_adjustments 表，note1='再次合并对话'）
let st_currentTab = 'original'; // 当前显示的标签页：'original'、'merged'、'corrected'、'remerged' 或 'qa'
let st_editedDialogues = new Map(); // 存储编辑过的对话
let st_isEditMode = false;
let st_currentAudioPath = null;
let st_speakerRoles = {}; // 存储角色设置，格式：{ "SPEAKER_1": "customer", "SPEAKER_2": "our_side" }
let st_aiCorrectionResult = null; // 存储 AI 修正结果
let st_qaPairs = []; // 存储问答对数据
// 分页状态
let st_currentPage = 1; // 当前页码
let st_pageSize = 20; // 每页数量
let st_totalPages = 1; // 总页数
let st_totalFiles = 0; // 总文件数

// AI 修正设置（从 localStorage 读取）
function loadAiCorrectionSettings() {
  const settings = {
    batchSize: parseInt(localStorage.getItem('aiCorrection_batchSize')) || 50,
    modelName: localStorage.getItem('aiCorrection_modelName') || ''
  };
  return settings;
}

function saveAiCorrectionSettingsToStorage(settings) {
  localStorage.setItem('aiCorrection_batchSize', settings.batchSize);
  if (settings.modelName) {
    localStorage.setItem('aiCorrection_modelName', settings.modelName);
  } else {
    localStorage.removeItem('aiCorrection_modelName');
  }
}

// ==================== 角色判断设置管理 ====================
function loadRoleJudgmentSettings() {
  return {
    modelName: localStorage.getItem('roleJudgment_modelName') || '',
    promptId: localStorage.getItem('roleJudgment_promptId') || ''
  };
}

function saveRoleJudgmentSettingsToStorage(settings) {
  if (settings.modelName) {
    localStorage.setItem('roleJudgment_modelName', settings.modelName);
  } else {
    localStorage.removeItem('roleJudgment_modelName');
  }
  if (settings.promptId) {
    localStorage.setItem('roleJudgment_promptId', settings.promptId);
  } else {
    localStorage.removeItem('roleJudgment_promptId');
  }
}

// ==================== 问答对提取设置管理 ====================
function loadQAExtractionSettings() {
  return {
    modelName: localStorage.getItem('qaExtraction_modelName') || '',
    promptId: localStorage.getItem('qaExtraction_promptId') || ''
  };
}

function saveQAExtractionSettingsToStorage(settings) {
  if (settings.modelName) {
    localStorage.setItem('qaExtraction_modelName', settings.modelName);
  } else {
    localStorage.removeItem('qaExtraction_modelName');
  }
  if (settings.promptId) {
    localStorage.setItem('qaExtraction_promptId', settings.promptId);
  } else {
    localStorage.removeItem('qaExtraction_promptId');
  }
}

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
  
  // 结果操作（使用可选链，避免元素不存在时报错）
  document.getElementById('st-copyAllBtn')?.addEventListener('click', copyAllDialogues);
  document.getElementById('st-downloadBtn')?.addEventListener('click', downloadResult);
  document.getElementById('st-newTranscriptionBtn')?.addEventListener('click', resetForm);
  
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
  document.getElementById('st-roleJudgmentBtn')?.addEventListener('click', startRoleJudgment);
  document.getElementById('st-aiCorrectionBtn')?.addEventListener('click', startAiCorrection);
  document.getElementById('st-qaExtractionBtn')?.addEventListener('click', startQAExtraction);
  document.getElementById('st-roleSettingsBtn')?.addEventListener('click', showRoleSettings);
  document.getElementById('st-batchReplaceSpeakerBtn')?.addEventListener('click', showBatchReplaceDialog);
  document.getElementById('st-saveEditBtn')?.addEventListener('click', saveEdits);
  document.getElementById('st-cancelEditBtn')?.addEventListener('click', cancelEdits);
  
  // ✅ 角色设置相关
  document.getElementById('st-saveRoleSettingsBtn')?.addEventListener('click', saveRoleSettings);
  document.getElementById('st-cancelRoleSettingsBtn')?.addEventListener('click', hideRoleSettings);
  
  // ✅ AI 修正相关
  document.getElementById('st-applyCorrectionsBtn')?.addEventListener('click', applyAiCorrections);
  
  // ✅ 对话列表的事件委托（点击定位、编辑按钮）
  // 为所有页签的对话列表容器绑定点击事件
  const dialogueListContainers = [
    'st-dialoguesList-original',
    'st-dialoguesList-merged',
    'st-dialoguesList-corrected',
    'st-dialoguesList-remerged', // 再次合并后的对话列表
    'st-dialoguesList-qa' // 问答对列表
  ];
  
  dialogueListContainers.forEach(containerId => {
    const container = document.getElementById(containerId);
    if (container) {
      container.addEventListener('click', handleDialogueClick);
      console.log(`✅ 已为容器 ${containerId} 绑定点击事件`);
    }
  });
  
  // 兼容旧版本：如果存在 st-dialoguesList，也绑定事件
  const oldContainer = document.getElementById('st-dialoguesList');
  if (oldContainer) {
    oldContainer.addEventListener('click', handleDialogueClick);
  }
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
  const currentTimeEl = document.getElementById('st-currentTime');
  if (currentTimeEl) {
    currentTimeEl.textContent = formatTimeFromSeconds(currentTime);
  }
  
  // 根据当前标签页，只查找当前显示的对话列表
  let currentListId = 'st-dialoguesList-original';
  if (st_currentTab === 'merged') {
    currentListId = 'st-dialoguesList-merged';
  } else if (st_currentTab === 'corrected') {
    currentListId = 'st-dialoguesList-corrected';
  }
  
  const currentList = document.getElementById(currentListId);
  if (!currentList) return;
  
  // 只查找当前显示的对话列表中的对话项
  const dialogueItems = currentList.querySelectorAll('.dialogue-item');
  let activeIndex = -1;
  
  dialogueItems.forEach((item, index) => {
    const startTime = parseFloat(item.getAttribute('data-start')) || 0;
    const nextItem = dialogueItems[index + 1];
    const endTime = nextItem ? parseFloat(nextItem.getAttribute('data-start')) : Infinity;
    
    // 移除所有高亮（只移除当前列表中的）
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

// 将秒数转换为时间字符串 "00:00:12" 或 "01:50:49"（HH:MM:SS格式）
function formatTimeFromSeconds(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  if (!dialogue) {
    console.error(`对话索引 ${index} 不存在`);
    return;
  }
  
  // ✅ 在当前活动页签的对话列表容器中查找对话项
  const currentContainerId = `st-dialoguesList-${st_currentTab || 'original'}`;
  const container = document.getElementById(currentContainerId);
  if (!container) {
    console.error(`容器 ${currentContainerId} 不存在`);
    return;
  }
  
  const dialogueItem = container.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem) {
    console.error(`在容器 ${currentContainerId} 中找不到对话项，索引: ${index}`);
    return;
  }
  
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
  // ✅ 在当前活动页签的对话列表容器中查找对话项
  const currentContainerId = `st-dialoguesList-${st_currentTab || 'original'}`;
  const container = document.getElementById(currentContainerId);
  if (!container) {
    console.error(`容器 ${currentContainerId} 不存在`);
    return;
  }
  
  const dialogueItem = container.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem) {
    console.error(`在容器 ${currentContainerId} 中找不到对话项，索引: ${index}`);
    return;
  }
  
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
  if (!dialogue) {
    console.error(`对话索引 ${index} 不存在`);
    return;
  }
  
  // ✅ 在当前活动页签的对话列表容器中查找对话项
  const currentContainerId = `st-dialoguesList-${st_currentTab || 'original'}`;
  const container = document.getElementById(currentContainerId);
  if (!container) {
    console.error(`容器 ${currentContainerId} 不存在`);
    return;
  }
  
  const dialogueItem = container.querySelector(`.dialogue-item[data-index="${index}"]`);
  if (!dialogueItem) {
    console.error(`在容器 ${currentContainerId} 中找不到对话项，索引: ${index}`);
    return;
  }
  
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
  renderDialogues(st_currentDialogues, `st-dialoguesList-${st_currentTab || 'original'}`);
  
  // 显示保存按钮
  document.getElementById('st-saveEditBtn').style.display = 'inline-block';
  document.getElementById('st-cancelEditBtn').style.display = 'inline-block';
  
  // ✅ 检测是否需要重新合并（相邻的相同说话人）
  if (checkNeedsReMergeLocally(st_currentDialogues)) {
    document.getElementById('st-reMergeBtn').style.display = 'inline-block';
    closeBatchReplaceDialog();
    showToast(`已替换 ${count} 条对话的说话人。检测到相邻的相同说话人，可以点击"重新合并"按钮进行合并`, 'success');
  } else {
    document.getElementById('st-reMergeBtn').style.display = 'none';
    closeBatchReplaceDialog();
    showToast(`已替换 ${count} 条对话的说话人，请点击"保存修改"提交`, 'success');
  }
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
    // ✅ 使用新的API，保存到 dialogue_adjustments 表
    // 传递 tabType 参数，用于确定更新哪个 adjustment 记录
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/dialogues`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        dialogues: st_currentDialogues,
        tabType: st_currentTab || 'original' // 传递当前页签类型
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '保存失败');
    }
    
    st_editedDialogues.clear();
    document.getElementById('st-saveEditBtn').style.display = 'none';
    document.getElementById('st-cancelEditBtn').style.display = 'none';
    
    showToast('保存成功！对话已保存到 dialogue_adjustments 表', 'success');
    
    // ✅ 检测是否需要重新合并（保存后可能有相邻的相同说话人）
    // 先重新加载数据，然后检测
    if (st_currentTranscriptionId) {
      await loadTranscriptionById(st_currentTranscriptionId);
      
      // 重新加载后，检测当前页签的对话是否需要重新合并
      let currentDialogues = [];
      if (st_currentTab === 'original') {
        currentDialogues = st_originalDialogues || [];
      } else if (st_currentTab === 'merged') {
        currentDialogues = st_mergedDialogues || [];
      } else if (st_currentTab === 'corrected') {
        currentDialogues = st_correctedDialogues || [];
      } else if (st_currentTab === 'remerged') {
        currentDialogues = st_reMergedDialogues || []; // ✅ 支持再次合并页签
      }
      
      if (checkNeedsReMergeLocally(currentDialogues)) {
        document.getElementById('st-reMergeBtn').style.display = 'inline-block';
        showToast('检测到相邻的相同说话人，可以点击"重新合并"按钮进行合并', 'info');
      } else {
        document.getElementById('st-reMergeBtn').style.display = 'none';
      }
    }
    
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
  document.getElementById('st-reMergeBtn').style.display = 'none'; // 隐藏重新合并按钮
  
  showToast('已取消所有修改', 'info');
}

/**
 * 检测是否需要重新合并（前端快速检测）
 * @param {Array} dialogues - 对话列表
 * @returns {boolean} 是否需要重新合并
 */
function checkNeedsReMergeLocally(dialogues) {
  if (!Array.isArray(dialogues) || dialogues.length < 2) {
    return false;
  }
  
  // 检测是否有相邻的相同说话人
  for (let i = 0; i < dialogues.length - 1; i++) {
    const current = dialogues[i];
    const next = dialogues[i + 1];
    
    if (current && next && current.speaker && next.speaker && current.speaker === next.speaker) {
      return true; // 发现相邻的相同说话人，需要合并
    }
  }
  
  return false;
}

/**
 * 触发重新合并对话
 */
async function triggerReMerge() {
  if (!st_currentTranscriptionId) {
    showToast('没有当前转录记录', 'error');
    return;
  }
  
  try {
    showToast('正在重新合并对话...', 'info');
    
    // 使用当前页签类型作为数据来源
    const tabType = st_currentTab || 'original';
    
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/re-merge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tabType: tabType
        // ✅ 不再传递 autoMerge 参数，后端总是创建新记录（note1='再次合并对话'）
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '重新合并失败');
    }
    
    const { originalCount, mergedCount } = result.data;
    
    showToast(
      `重新合并成功：${originalCount} 条 → ${mergedCount} 条（已创建再次合并记录）`,
      'success'
    );
    
    // 隐藏重新合并按钮
    document.getElementById('st-reMergeBtn').style.display = 'none';
    
    // ✅ 重新加载当前转录记录，刷新数据
    if (st_currentTranscriptionId) {
      await loadTranscriptionById(st_currentTranscriptionId);
      
      // ✅ 切换到"再次合并后的对话"页签，显示合并结果
      setTimeout(() => {
        if (st_reMergedDialogues && st_reMergedDialogues.length > 0) {
          // 确保"再次合并"页签显示
          const reMergedTab = document.getElementById('st-tab-remerged');
          if (reMergedTab) {
            reMergedTab.style.display = 'block';
          }
          switchDialogueTab('remerged');
        } else {
          showToast('⚠️ 未找到再次合并后的对话', 'warning');
          // 如果再次合并页签不存在，切换到合并页签
          if (st_mergedDialogues && st_mergedDialogues.length > 0) {
            switchDialogueTab('merged');
          }
        }
      }, 300);
    }
    
  } catch (error) {
    console.error('重新合并失败:', error);
    showToast('重新合并失败: ' + error.message, 'error');
  }
}

// ==================== 角色判断功能 ====================
async function startRoleJudgment() {
  if (!st_currentTranscriptionId) {
    showToast('没有当前转录记录', 'error');
    return;
  }
  
  // 优先使用AI修正后的对话，如果没有则使用当前标签页的对话
  let dialoguesToSend = [];
  let dialogueSource = '';
  
  // 优先使用AI修正后的对话（根据用户需求）
  if (st_correctedDialogues && st_correctedDialogues.length > 0) {
    dialoguesToSend = st_correctedDialogues;
    dialogueSource = 'AI修正后的对话';
  } else {
    // 如果没有AI修正后的对话，根据当前标签页决定
    if (st_currentTab === 'original') {
      dialoguesToSend = st_originalDialogues || [];
      dialogueSource = '原始对话';
    } else if (st_currentTab === 'merged') {
      dialoguesToSend = st_mergedDialogues || [];
      dialogueSource = '合并后的对话';
    } else if (st_currentTab === 'corrected') {
      dialoguesToSend = st_correctedDialogues || [];
      dialogueSource = 'AI修正后的对话';
    }
  }
  
  if (!dialoguesToSend || dialoguesToSend.length === 0) {
    showToast(`请先加载对话内容（优先使用AI修正后的对话）`, 'warning');
    return;
  }
  
  // 显示加载提示
  showToast(`🤖 AI 正在分析角色（使用${dialogueSource}）...`, 'info');
  
  try {
    // 读取设置
    const settings = loadRoleJudgmentSettings();
    
    // 调用后端API
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/role-judgment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modelName: settings.modelName || undefined,
        promptId: settings.promptId || undefined,
        dialogues: dialoguesToSend
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '角色判断失败');
    }
    
    // 更新角色设置
    if (result.data && result.data.speakerRoles) {
      st_speakerRoles = result.data.speakerRoles;
      
      // 根据当前标签页重新渲染对话列表以显示角色标签
      let currentDialogues = [];
      if (st_currentTab === 'original') {
        currentDialogues = st_originalDialogues;
      } else if (st_currentTab === 'merged') {
        currentDialogues = st_mergedDialogues;
      } else if (st_currentTab === 'corrected') {
        currentDialogues = st_correctedDialogues;
      } else if (st_currentTab === 'remerged') {
        currentDialogues = st_reMergedDialogues; // ✅ 支持再次合并页签
      }
      
      if (currentDialogues && currentDialogues.length > 0) {
        renderDialogues(currentDialogues, `st-dialoguesList-${st_currentTab}`);
      }
      
      showToast('✅ 角色判断完成！', 'success');
    } else {
      showToast('⚠️ 未获取到角色判断结果', 'warning');
    }
    
  } catch (error) {
    console.error('角色判断失败:', error);
    showToast('角色判断失败: ' + error.message, 'error');
  }
}

// ==================== 问答对提取功能 ====================
async function startQAExtraction() {
  if (!st_currentTranscriptionId) {
    showToast('没有当前转录记录', 'error');
    return;
  }

  // ✅ 优先使用最后一次合并完成后的内容（再次合并 > AI修正 > 第一次合并 > 原始对话）
  let dialoguesToSend = [];
  let dialogueSource = '';

  // 1. 最优先使用再次合并后的对话（最后合并完成的内容）
  if (st_reMergedDialogues && st_reMergedDialogues.length > 0) {
    dialoguesToSend = st_reMergedDialogues;
    dialogueSource = '再次合并后的对话';
  } 
  // 2. 其次使用AI修正后的对话
  else if (st_correctedDialogues && st_correctedDialogues.length > 0) {
    dialoguesToSend = st_correctedDialogues;
    dialogueSource = 'AI修正后的对话';
  } 
  // 3. 再次使用第一次合并后的对话
  else if (st_mergedDialogues && st_mergedDialogues.length > 0) {
    dialoguesToSend = st_mergedDialogues;
    dialogueSource = '第一次合并后的对话';
  } 
  // 4. 最后使用原始对话
  else if (st_originalDialogues && st_originalDialogues.length > 0) {
    dialoguesToSend = st_originalDialogues;
    dialogueSource = '原始对话';
  }

  if (!dialoguesToSend || dialoguesToSend.length === 0) {
    showToast(`请先加载对话内容`, 'warning');
    return;
  }

  // 检查是否有角色信息
  if (!st_speakerRoles || Object.keys(st_speakerRoles).length === 0) {
    if (!window.confirm('未找到角色信息，问答对提取需要先进行角色判断。是否现在进行角色判断？')) {
      return;
    }
    // 触发角色判断
    await startRoleJudgment();
    // 角色判断完成后，重新检查角色信息
    if (!st_speakerRoles || Object.keys(st_speakerRoles).length === 0) {
      showToast('角色判断未完成或失败，无法进行问答对提取', 'error');
      return;
    }
  }

  // 显示遮罩
  const overlay = document.getElementById('st-qaExtractionOverlay');
  const body = document.getElementById('st-qaExtractionBody');
  
  body.innerHTML = `
    <div class="ai-correction-loading">
      <div class="ai-correction-spinner"></div>
      <p>🤖 AI 正在提取问答对（使用${dialogueSource}）...</p>
      <p style="font-size: 12px; color: #999;">这可能需要一些时间</p>
      <p style="font-size: 11px; color: #999; margin-top: 10px;">对话数量：${dialoguesToSend.length} 条</p>
    </div>
  `;
  
  overlay.style.display = 'flex';

  try {
    // 读取设置
    const settings = loadQAExtractionSettings();

    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/qa-extraction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        modelName: settings.modelName || undefined,
        promptId: settings.promptId || undefined,
        dialogues: dialoguesToSend
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '问答对提取失败');
    }
    
    // 隐藏遮罩
    overlay.style.display = 'none';
    
    // 更新问答对数据
    if (result.data && result.data.qaPairs) {
      st_qaPairs = result.data.qaPairs;
      
      // 切换到问答对页签并显示结果
      switchDialogueTab('qa');
      renderQAPairs(st_qaPairs, 'st-dialoguesList-qa');
      
      const summary = result.summary || {};
      showToast(
        `✅ 问答对提取完成！共提取 ${summary.totalPairs || 0} 个问答对（已回答: ${summary.answeredPairs || 0}，待回答: ${summary.pendingPairs || 0}）`,
        'success'
      );
    } else {
      showToast('⚠️ 未提取到问答对', 'warning');
    }
    
  } catch (error) {
    // 隐藏遮罩
    overlay.style.display = 'none';
    console.error('问答对提取失败:', error);
    showToast('问答对提取失败: ' + error.message, 'error');
  }
}

// 关闭问答对提取遮罩
function closeQAExtractionOverlay() {
  const overlay = document.getElementById('st-qaExtractionOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// 暴露到全局，供HTML调用
window.closeQAExtractionOverlay = closeQAExtractionOverlay;

/**
 * 加载问答对（从 concerns 表查询）
 */
async function loadQAPairs(transcriptionId) {
  if (!transcriptionId) {
    return;
  }

  try {
    const response = await fetch(`${ST_API_BASE}/transcription/${transcriptionId}/qa-pairs`);
    const result = await response.json();
    
    if (result.success && result.data && result.data.qaPairs) {
      st_qaPairs = result.data.qaPairs;
      
      // 调试：输出第一个问答对的数据结构
      if (st_qaPairs.length > 0) {
        console.log('📋 加载的问答对数据示例（第一个）:', JSON.stringify(st_qaPairs[0], null, 2));
        console.log('   - time_range:', st_qaPairs[0].time_range);
        console.log('   - time_range1:', st_qaPairs[0].time_range1);
        console.log('   - time_range2:', st_qaPairs[0].time_range2);
      }
      
      // 如果当前在问答对页签，刷新显示
      if (st_currentTab === 'qa') {
        renderQAPairs(st_qaPairs, 'st-dialoguesList-qa');
      }
    } else {
      st_qaPairs = [];
      // 如果当前在问答对页签，显示提示
      if (st_currentTab === 'qa') {
        const qaContainer = document.getElementById('st-dialoguesList-qa');
        if (qaContainer) {
          qaContainer.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无问答对，请点击"问答对提取"按钮提取</p>';
        }
      }
    }
  } catch (error) {
    console.error('加载问答对失败:', error);
    st_qaPairs = [];
  }
}

/**
 * 解析时间范围字符串，返回开始时间和结束时间的秒数
 * 支持格式: "[00:10-00:30]" 或 "01:50:49-01:51:33"
 */
function parseTimeRange(timeRangeStr) {
  if (!timeRangeStr) return { startSeconds: 0, endSeconds: 0, startTime: '', endTime: '' };
  
  // 移除方括号（如果有）
  let cleanStr = timeRangeStr.replace(/[\[\]]/g, '').trim();
  
  // 分割开始和结束时间
  const parts = cleanStr.split('-').map(s => s.trim());
  if (parts.length !== 2) {
    return { startSeconds: 0, endSeconds: 0, startTime: '', endTime: '' };
  }
  
  const [startTime, endTime] = parts;
  
  // 转换为秒数
  const startSeconds = parseTimeToSeconds(startTime);
  const endSeconds = parseTimeToSeconds(endTime);
  
  return { startSeconds, endSeconds, startTime, endTime };
}

/**
 * 渲染问答对列表
 */
function renderQAPairs(qaPairs, containerId = 'st-dialoguesList-qa') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`容器 ${containerId} 不存在`);
    return;
  }
  
  if (!qaPairs || qaPairs.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无问答对，请点击"问答对提取"按钮提取</p>';
    return;
  }
  
  container.innerHTML = qaPairs.map((qa, index) => {
    const qaIndex = index + 1;
    
    // ✅ 使用新的格式：time_range1 和 time_range2（问题和回答分别的时间范围）
    // ✅ 兼容旧格式：time_range（整体时间范围）
    const questionTimeRangeStr = qa.time_range1 || qa.time_range || null;
    const answerTimeRangeStr = qa.time_range2 || null;
    
    // 调试：输出每个问答对的时间范围
    if (index === 0) {
      console.log(`🔍 渲染问答对 ${qaIndex}:`, {
        'qa.time_range': qa.time_range,
        'qa.time_range1': qa.time_range1,
        'qa.time_range2': qa.time_range2,
        'questionTimeRangeStr': questionTimeRangeStr,
        'answerTimeRangeStr': answerTimeRangeStr
      });
    }
    
    // 解析问题时间范围
    const questionTimeRange = parseTimeRange(questionTimeRangeStr);
    // 解析回答时间范围
    const answerTimeRange = parseTimeRange(answerTimeRangeStr);
    
    // 格式化时间显示（去掉方括号，转换为标准格式）
    const formatTimeDisplay = (timeStr) => {
      if (!timeStr) return '';
      // 移除方括号（如果有）
      let cleaned = String(timeStr).replace(/[\[\]]/g, '').trim();
      // 确保格式正确：应该包含 "-" 分隔符
      if (cleaned && cleaned.includes('-')) {
        return cleaned;
      }
      // 如果格式不对，尝试修复或返回原始值
      return cleaned || '';
    };
    
    // 计算问题时间显示（如果存在 time_range1，使用它；否则兼容旧格式）
    let questionTimeDisplay = '';
    if (questionTimeRangeStr) {
      questionTimeDisplay = formatTimeDisplay(questionTimeRangeStr);
      if (!questionTimeDisplay && index === 0) {
        console.warn(`⚠️ 问答对 ${qaIndex} 问题时间范围解析失败:`, questionTimeRangeStr);
      }
    } else if (index === 0) {
      console.warn(`⚠️ 问答对 ${qaIndex} 没有问题时间范围字段 (time_range1/time_range 均为空)`);
    }
    
    // 计算回答时间显示（如果存在 time_range2，使用它）
    let answerTimeDisplay = '';
    if (answerTimeRangeStr) {
      answerTimeDisplay = formatTimeDisplay(answerTimeRangeStr);
      if (!answerTimeDisplay && index === 0 && qa.answer && qa.answer.length > 0) {
        console.warn(`⚠️ 问答对 ${qaIndex} 回答时间范围解析失败:`, answerTimeRangeStr);
      }
    } else if (qa.answer && qa.answer.length > 0 && index === 0) {
      console.warn(`⚠️ 问答对 ${qaIndex} 有回答但没有回答时间范围字段 (time_range2 为空)`);
    }
    
    // ✅ 计算完整的播放时间范围（从问题开始到回答结束，包含5秒冗余）
    let playStartSeconds = 0;
    let playEndSeconds = 0;
    
    if (questionTimeRange.startSeconds >= 0) {
      // 从问题的开始时间播放
      playStartSeconds = questionTimeRange.startSeconds;
      
      // 如果有回答时间范围，播放到回答的结束时间；否则播放到问题的结束时间
      if (answerTimeRange.endSeconds > 0) {
        playEndSeconds = answerTimeRange.endSeconds;
      } else if (questionTimeRange.endSeconds > 0) {
        playEndSeconds = questionTimeRange.endSeconds;
      } else {
        // 默认播放30秒
        playEndSeconds = playStartSeconds + 30;
      }
    } else if (qa.time_range) {
      // 兼容旧格式：使用整体的 time_range
      const oldTimeRange = parseTimeRange(qa.time_range);
      playStartSeconds = oldTimeRange.startSeconds || 0;
      playEndSeconds = oldTimeRange.endSeconds || (playStartSeconds + 30);
    }
    
    return `
      <div class="qa-pair-item" data-qa-index="${index}" data-play-start="${playStartSeconds}" data-play-end="${playEndSeconds}" style="margin-bottom: 15px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; background: #fff; cursor: pointer; transition: all 0.2s;" 
           onmouseover="this.style.background='#f0f7ff'; this.style.borderColor='#1890ff';" 
           onmouseout="this.style.background='#fff'; this.style.borderColor='#e0e0e0';"
           onclick="playQAAudio(${index})">
        <div style="font-weight: bold; color: #1890ff; font-size: 16px; margin-bottom: 10px;">Q${qaIndex}</div>
        <div style="margin-bottom: ${qa.answer && qa.answer.length > 0 ? '8px' : '0'}; line-height: 1.8; color: #333; font-size: 14px;">
          ${questionTimeDisplay ? `<span style="color: #666; font-size: 13px; font-family: monospace; margin-right: 8px;">${escapeHtml(questionTimeDisplay)}</span>` : ''}
          ${qa.question_speaker ? `<span style="color: #1890ff; font-size: 13px; font-weight: 500; margin-right: 8px;">${escapeHtml(qa.question_speaker)}</span>` : ''}
          <span style="font-weight: 500; color: #333;">问题：</span>
          <span style="color: #333;">${escapeHtml(qa.question)}</span>
        </div>
        ${qa.answer && qa.answer.length > 0 ? `
          <div style="margin-top: 8px; line-height: 1.8; color: #333; font-size: 14px;">
            ${answerTimeDisplay ? `<span style="color: #666; font-size: 13px; font-family: monospace; margin-right: 8px;">${escapeHtml(answerTimeDisplay)}</span>` : ''}
            ${qa.answer_speaker ? `<span style="color: #52c41a; font-size: 13px; font-weight: 500; margin-right: 8px;">${escapeHtml(qa.answer_speaker)}</span>` : ''}
            <span style="font-weight: 500; color: #333;">回答：</span>
            <span style="color: #333;">${escapeHtml(qa.answer)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // 如果容器是问答对列表，确保它在当前页签中显示
  if (containerId === 'st-dialoguesList-qa' && st_currentTab === 'qa') {
    container.style.display = 'block';
  }
}

/**
 * 播放问答对的音频片段（包含问题和回答的完整时间段）
 */
function playQAAudio(qaIndex) {
  if (!st_audioPlayer) {
    showToast('请先加载音频文件', 'warning');
    return;
  }
  
  const qa = st_qaPairs[qaIndex];
  if (!qa) {
    showToast('问答对不存在', 'error');
    return;
  }
  
  // ✅ 优先使用 time_range1 和 time_range2（新的格式）
  // ✅ 兼容旧格式：time_range（整体时间范围）
  let playStartSeconds = 0;
  let playEndSeconds = 0;
  
  const questionTimeRangeStr = qa.time_range1 || qa.time_range || null;
  const answerTimeRangeStr = qa.time_range2 || null;
  
  if (questionTimeRangeStr) {
    // 解析问题时间范围
    const questionTimeRange = parseTimeRange(questionTimeRangeStr);
    playStartSeconds = questionTimeRange.startSeconds || 0;
    
    // 如果有回答时间范围，播放到回答的结束时间；否则播放到问题的结束时间
    if (answerTimeRangeStr) {
      const answerTimeRange = parseTimeRange(answerTimeRangeStr);
      playEndSeconds = answerTimeRange.endSeconds || (playStartSeconds + 30);
    } else if (questionTimeRange.endSeconds > 0) {
      playEndSeconds = questionTimeRange.endSeconds;
    } else {
      playEndSeconds = playStartSeconds + 30;
    }
  } else {
    // 兼容旧格式：从DOM元素获取播放时间范围（如果存在）
    const qaItem = document.querySelector(`.qa-pair-item[data-qa-index="${qaIndex}"]`);
    if (qaItem) {
      playStartSeconds = parseFloat(qaItem.getAttribute('data-play-start')) || 0;
      playEndSeconds = parseFloat(qaItem.getAttribute('data-play-end')) || 0;
    }
    
    // 如果还是没有，使用默认值
    if (playStartSeconds === 0 && playEndSeconds === 0) {
      playEndSeconds = 30;
    }
  }
  
  // ✅ 添加5秒冗余缓冲（上下各5秒）
  const BUFFER_SECONDS = 5;
  const actualStartSeconds = Math.max(0, playStartSeconds - BUFFER_SECONDS); // 开始时间减去5秒，但不能小于0
  const audioDuration = st_audioPlayer.duration || Infinity;
  const actualEndSeconds = Math.min(audioDuration, playEndSeconds + BUFFER_SECONDS); // 结束时间加上5秒，但不能超过音频总长度
  
  console.log(`播放问答对 Q${qaIndex + 1}: 原始范围 ${playStartSeconds}s-${playEndSeconds}s, 实际播放 ${actualStartSeconds}s-${actualEndSeconds}s`);
  
  // 准备显示信息用的时间字符串
  const questionTimeDisplay = questionTimeRangeStr ? questionTimeRangeStr.replace(/[\[\]]/g, '') : '';
  const answerTimeDisplay = answerTimeRangeStr ? answerTimeRangeStr.replace(/[\[\]]/g, '') : '';
  const timeRangeDisplay = questionTimeDisplay && answerTimeDisplay 
    ? `问题: ${questionTimeDisplay}, 回答: ${answerTimeDisplay}` 
    : questionTimeDisplay || qa.time_range ? (qa.time_range || questionTimeRangeStr || '').replace(/[\[\]]/g, '') : '';
  
  // 移除之前的停止监听器（如果存在）
  if (st_audioPlayer._qaStopHandler) {
    st_audioPlayer.removeEventListener('timeupdate', st_audioPlayer._qaStopHandler);
    st_audioPlayer._qaStopHandler = null;
  }
  
  // 设置播放位置（从缓冲后的开始时间播放）
  st_audioPlayer.currentTime = actualStartSeconds;
  
  // 创建停止监听器（在缓冲后的结束时间停止）
  const stopAtEnd = () => {
    if (st_audioPlayer && st_audioPlayer.currentTime >= actualEndSeconds) {
      st_audioPlayer.pause();
      st_audioPlayer.removeEventListener('timeupdate', stopAtEnd);
      st_audioPlayer._qaStopHandler = null;
      showToast(`问答对 Q${qaIndex + 1} 播放完成（包含问题和回答）`, 'success');
    }
  };
  
  // 保存监听器引用，方便后续移除
  st_audioPlayer._qaStopHandler = stopAtEnd;
  st_audioPlayer.addEventListener('timeupdate', stopAtEnd);
  
  // 播放音频
  st_audioPlayer.play().catch(err => {
    console.error('播放音频失败:', err);
    showToast('播放音频失败', 'error');
    // 移除监听器
    if (st_audioPlayer._qaStopHandler) {
      st_audioPlayer.removeEventListener('timeupdate', st_audioPlayer._qaStopHandler);
      st_audioPlayer._qaStopHandler = null;
    }
  });
  
  // 高亮当前问答对
  const qaContainer = document.getElementById('st-dialoguesList-qa');
  if (qaContainer) {
    const qaItems = qaContainer.querySelectorAll('.qa-pair-item');
    qaItems.forEach((item, index) => {
      if (index === qaIndex) {
        item.style.background = '#e6f7ff';
        item.style.borderColor = '#1890ff';
        item.style.borderWidth = '2px';
      } else {
        item.style.background = '#fff';
        item.style.borderColor = '#e0e0e0';
        item.style.borderWidth = '1px';
      }
    });
    
    // 滚动到当前问答对
    const currentItem = qaItems[qaIndex];
    if (currentItem) {
      currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  // 显示播放信息（使用之前已声明的变量）
  const startTimeDisplay = formatTimeFromSeconds(actualStartSeconds);
  const endTimeDisplay = formatTimeFromSeconds(actualEndSeconds);
  showToast(`正在播放问答对 Q${qaIndex + 1} ${timeRangeDisplay}（缓冲范围：${startTimeDisplay}-${endTimeDisplay}）`, 'info');
}

// 角色判断设置对话框管理
function openRoleJudgmentSettings() {
  try {
    const modal = document.getElementById('st-roleJudgmentSettingsModal');
    if (!modal) {
      showToast('设置对话框未找到', 'error');
      return;
    }
    
    const settings = loadRoleJudgmentSettings();
    document.getElementById('st-roleJudgmentModel').value = settings.modelName || '';
    document.getElementById('st-roleJudgmentPrompt').value = settings.promptId || '';
    
    // 加载提示词模板列表
    loadRoleJudgmentPrompts();
    
    modal.style.display = 'flex';
  } catch (error) {
    console.error('打开角色判断设置失败:', error);
    showToast('打开设置失败', 'error');
  }
}

function closeRoleJudgmentSettings() {
  try {
    const modal = document.getElementById('st-roleJudgmentSettingsModal');
    if (modal) {
      modal.style.display = 'none';
    }
  } catch (error) {
    console.error('关闭设置对话框失败:', error);
  }
}

async function loadRoleJudgmentPrompts() {
  try {
    // 尝试使用 role_judgment 场景，如果不存在则使用 transcription_correction
    let response = await fetch(`${ADMIN_API_BASE}/prompts/scenes/role_judgment`);
    let result = await response.json();
    
    // 如果 role_judgment 场景不存在，尝试使用 transcription_correction 场景
    if (!result.success || !result.data || result.data.length === 0) {
      response = await fetch(`${ADMIN_API_BASE}/prompts/scenes/transcription_correction`);
      result = await response.json();
    }
    
    const select = document.getElementById('st-roleJudgmentPrompt');
    if (!select) return;
    
    // 保留第一个选项（使用默认提示词）
    select.innerHTML = '<option value="">使用默认提示词</option>';
    
    if (result.success && result.data && result.data.length > 0) {
      result.data.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.id;
        option.textContent = prompt.name + (prompt.is_active ? ' (启用)' : '');
        select.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载提示词模板失败:', error);
  }
}

function saveRoleJudgmentSettings() {
  const modelName = document.getElementById('st-roleJudgmentModel').value;
  const promptId = document.getElementById('st-roleJudgmentPrompt').value;
  
  saveRoleJudgmentSettingsToStorage({
    modelName: modelName,
    promptId: promptId
  });
  
  showToast('✅ 设置已保存', 'success');
  closeRoleJudgmentSettings();
}

// 全局函数
window.openRoleJudgmentSettings = openRoleJudgmentSettings;
window.closeRoleJudgmentSettings = closeRoleJudgmentSettings;
window.saveRoleJudgmentSettings = saveRoleJudgmentSettings;

// ==================== AI 错别字修正功能 ====================
async function startAiCorrection() {
  if (!st_currentTranscriptionId) {
    showToast('没有当前转录记录', 'error');
    return;
  }
  
  // 根据当前标签页决定发送哪个对话内容
  let dialoguesToSend = [];
  let dialogueSource = '';
  
  if (st_currentTab === 'original') {
    // 原始对话标签页：发送原始对话内容
    dialoguesToSend = st_originalDialogues || [];
    dialogueSource = '原始对话';
  } else if (st_currentTab === 'merged') {
    // 合并后的对话标签页：发送合并后的对话内容
    dialoguesToSend = st_mergedDialogues || [];
    dialogueSource = '合并后的对话';
  } else if (st_currentTab === 'corrected') {
    // AI修正后的对话标签页：发送AI修正后的对话内容
    dialoguesToSend = st_correctedDialogues || [];
    dialogueSource = 'AI修正后的对话';
  }
  
  if (!dialoguesToSend || dialoguesToSend.length === 0) {
    showToast(`请先加载${dialogueSource}内容`, 'warning');
    return;
  }
  
  // 显示加载界面
  const overlay = document.getElementById('st-aiCorrectionOverlay');
  const body = document.getElementById('st-aiCorrectionBody');
  const applyBtn = document.getElementById('st-applyCorrectionsBtn');
  
  body.innerHTML = `
    <div class="ai-correction-loading">
      <div class="ai-correction-spinner"></div>
      <p>🤖 AI 正在分析${dialogueSource}内容...</p>
      <p style="font-size: 12px; color: #999;">正在修正错别字并判断说话人角色</p>
      <p style="font-size: 12px; color: #999;">这可能需要几秒钟时间</p>
      <p style="font-size: 11px; color: #999; margin-top: 10px;">当前处理：${dialogueSource}（${dialoguesToSend.length} 条）</p>
    </div>
  `;
  
  overlay.style.display = 'flex';
  applyBtn.style.display = 'none';
  
  try {
    // 读取设置
    const settings = loadAiCorrectionSettings();
    
    // 准备请求体，包含对话内容
    // 确保对话格式正确：每个对话至少包含 timeRange, speaker, text 字段
    const formattedDialogues = dialoguesToSend.map(d => ({
      timeRange: d.timeRange || d.startTime || '',
      speaker: d.speaker || d.speakerName || '未知说话人',
      text: d.text || d.correctedText || d.originalText || ''
    }));
    
    const requestBody = {
      modelName: settings.modelName || undefined, // 如果为空则不传，使用默认模型
      batchSize: settings.batchSize, // 每批处理的对话数量
      dialogues: formattedDialogues // 发送格式化后的对话内容
    };
    
    console.log(`📤 发送${dialogueSource}给AI修正，共 ${formattedDialogues.length} 条`);
    console.log(`📤 对话示例:`, formattedDialogues.slice(0, 2)); // 打印前2条作为示例
    
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/ai-correction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    // 检查响应状态
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || result.message || 'AI 修正失败');
    }
    
    // 保存修正结果
    st_aiCorrectionResult = result.data;
    
    // 如果AI修正已自动保存（autoSave=true），刷新转录记录以显示新的修正内容
    if (result.data.saved) {
      console.log('✅ AI修正已自动保存，刷新转录记录...');
      // 关闭加载界面
      overlay.style.display = 'none';
      // 重新加载转录记录，以显示新的AI修正页签
      await viewTranscription(st_currentTranscriptionId);
      // 切换到AI修正后的对话标签页
      setTimeout(() => {
        switchDialogueTab('corrected');
        showToast('✅ AI修正完成并已保存！', 'success');
      }, 500);
    } else {
      // 显示对比界面（手动应用模式）
      renderAiCorrectionResult(result.data);
      applyBtn.style.display = 'inline-block';
    }
    
  } catch (error) {
    console.error('AI 修正失败:', error);
    // 确保加载界面显示错误信息，而不是一直转圈
    body.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <p style="color: #e53935; font-size: 18px;">❌ AI 修正失败</p>
        <p style="color: #666;">${error.message}</p>
        <button class="btn btn-primary" onclick="closeAiCorrectionModal()">关闭</button>
      </div>
    `;
    // 注意：这里不关闭 overlay，让用户看到错误信息，用户可以点击关闭按钮
  }
}

function renderAiCorrectionResult(data) {
  // 兼容后端返回格式：可能没有 original 字段
  const { original, corrected, summary } = data;
  const body = document.getElementById('st-aiCorrectionBody');
  const summaryDiv = document.getElementById('st-correctionSummary');
  
  // 确保 corrected 存在且是数组
  if (!corrected || !Array.isArray(corrected)) {
    console.error('❌ AI修正结果格式错误:', data);
    body.innerHTML = `
      <div style="text-align: center; padding: 40px;">
        <p style="color: #e53935; font-size: 18px;">❌ 数据格式错误</p>
        <p style="color: #666;">修正结果格式不正确，请重试</p>
        <button class="btn btn-primary" onclick="closeAiCorrectionModal()">关闭</button>
      </div>
    `;
    return;
  }
  
  // 渲染摘要信息（只显示错别字修正统计）
  if (summaryDiv) {
    summaryDiv.innerHTML = `
      <span style="font-weight: 500;">📊 统计：</span>
      <span>共 ${summary?.totalDialogues || corrected.length} 条对话</span>
      <span style="margin-left: 15px; color: #ff9800;">需要修正 ${summary?.correctedCount || 0} 条</span>
    `;
  }
  
  // 渲染对比列表（只显示错别字修正）
  const html = corrected.map((item, index) => {
    const hasTextChange = item.originalText !== item.correctedText;
    const itemClass = hasTextChange ? 'has-changes' : '';
    
    return `
      <div class="correction-item ${itemClass}">
        <div class="correction-header">
          <div>
            <span class="correction-time">${item.timeRange}</span>
            <span class="correction-speaker">${escapeHtml(item.speaker)}</span>
          </div>
          ${hasTextChange ? '<span style="color: #ff9800; font-size: 12px;">✏️ 已修正</span>' : '<span style="color: #52c41a; font-size: 12px;">✓ 无需修正</span>'}
        </div>
        
        ${hasTextChange ? `
          <div class="correction-changes">
            <div class="correction-column">
              <div class="correction-label">原始文本</div>
              <div class="correction-text original">${escapeHtml(item.originalText)}</div>
            </div>
            <div class="correction-column">
              <div class="correction-label">修正后文本</div>
              <div class="correction-text corrected">${escapeHtml(item.correctedText)}</div>
            </div>
          </div>
          ${item.changes && item.changes.length > 0 ? `
            <div style="margin-top: 10px;">
              <div class="correction-label">修改详情</div>
              <div>
                ${item.changes.map(change => `<span class="change-tag">${escapeHtml(change)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        ` : `
          <div style="margin-top: 10px;">
            <div class="correction-text">${escapeHtml(item.correctedText)}</div>
          </div>
        `}
      </div>
    `;
  }).join('');
  
  body.innerHTML = html || '<p style="text-align: center; padding: 40px; color: #999;">没有需要修正的内容</p>';
}

function closeAiCorrectionModal() {
  document.getElementById('st-aiCorrectionOverlay').style.display = 'none';
  st_aiCorrectionResult = null;
}

async function applyAiCorrections() {
  if (!st_aiCorrectionResult) {
    showToast('没有修正结果', 'error');
    return;
  }
  
  if (!window.confirm('确认应用所有 AI 修正？这将更新对话内容。')) {
    return;
  }
  
  try {
    const { corrected, summary } = st_aiCorrectionResult;
    
    // 构建修正后的对话数组
    const correctedDialogues = corrected.map(item => ({
      timeRange: item.timeRange,
      speaker: item.speaker,
      text: item.correctedText
    }));
    
    // 调用应用接口（只传递修正后的对话，不包含角色设置）
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/apply-corrections`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        correctedDialogues
      })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '应用修正失败');
    }
    
    // 更新本地状态
    st_currentDialogues = correctedDialogues;
    
    // 根据当前标签页更新对应的对话列表
    if (st_currentTab === 'original') {
      // 更新原始对话
      st_originalDialogues = correctedDialogues;
      renderDialogues(correctedDialogues, 'st-dialoguesList-original');
    } else if (st_currentTab === 'merged') {
      // 更新合并后的对话
      st_mergedDialogues = correctedDialogues;
      renderDialogues(correctedDialogues, 'st-dialoguesList-merged');
    } else if (st_currentTab === 'corrected') {
      // 更新AI修正后的对话
      st_correctedDialogues = correctedDialogues;
      renderDialogues(correctedDialogues, 'st-dialoguesList-corrected');
    }
    
    // 关闭模态框
    closeAiCorrectionModal();
    
    showToast(`✅ 修正已应用！修正了 ${summary.correctedCount} 条对话`, 'success');
    
  } catch (error) {
    console.error('应用修正失败:', error);
    showToast('应用修正失败: ' + error.message, 'error');
  }
}

// 全局函数供 HTML onclick 调用
window.closeAiCorrectionModal = closeAiCorrectionModal;

// ==================== AI 修正设置功能 ====================

/**
 * 打开 AI 修正设置对话框
 */
function openAiCorrectionSettings() {
  try {
    console.log('🔧 打开AI修正设置对话框');
    const modal = document.getElementById('st-aiCorrectionSettingsModal');
    if (!modal) {
      console.error('❌ 未找到设置模态框元素: st-aiCorrectionSettingsModal');
      showToast('设置对话框未找到', 'error');
      return;
    }
    
    const settings = loadAiCorrectionSettings();
    console.log('📋 当前设置:', settings);
    
    // 填充当前设置
    const batchSizeInput = document.getElementById('st-batchSize');
    const modelSelect = document.getElementById('st-aiModel');
    
    if (batchSizeInput) {
      batchSizeInput.value = settings.batchSize;
    } else {
      console.error('❌ 未找到 batchSize 输入框');
    }
    
    if (modelSelect) {
      modelSelect.value = settings.modelName || '';
    } else {
      console.error('❌ 未找到 modelSelect 选择框');
    }
    
    // 显示模态框
    modal.style.display = 'flex';
    console.log('✅ 设置对话框已显示');
  } catch (error) {
    console.error('❌ 打开设置对话框失败:', error);
    showToast('打开设置失败: ' + error.message, 'error');
  }
}

/**
 * 关闭 AI 修正设置对话框
 */
function closeAiCorrectionSettings() {
  try {
    const modal = document.getElementById('st-aiCorrectionSettingsModal');
    if (modal) {
      modal.style.display = 'none';
      console.log('✅ 设置对话框已关闭');
    }
  } catch (error) {
    console.error('❌ 关闭设置对话框失败:', error);
  }
}

/**
 * 保存 AI 修正设置
 */
function saveAiCorrectionSettings() {
  const batchSize = parseInt(document.getElementById('st-batchSize').value);
  const modelName = document.getElementById('st-aiModel').value;
  
  // 验证
  if (isNaN(batchSize) || batchSize < 10 || batchSize > 200) {
    showToast('每批对话数量必须在 10-200 之间', 'error');
    return;
  }
  
  // 保存到 localStorage
  saveAiCorrectionSettingsToStorage({
    batchSize: batchSize,
    modelName: modelName
  });
  
  showToast('✅ 设置已保存', 'success');
  closeAiCorrectionSettings();
}

// 全局函数
window.openAiCorrectionSettings = openAiCorrectionSettings;
window.closeAiCorrectionSettings = closeAiCorrectionSettings;
window.saveAiCorrectionSettings = saveAiCorrectionSettings;

// 确保按钮事件绑定（备用方案）
setTimeout(() => {
  const settingsBtn = document.getElementById('st-aiCorrectionSettingsBtn');
  if (settingsBtn) {
    // 移除旧的 onclick，使用 addEventListener
    settingsBtn.removeAttribute('onclick');
    settingsBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔧 设置按钮被点击（通过事件监听器）');
      if (typeof openAiCorrectionSettings === 'function') {
        openAiCorrectionSettings();
      } else {
        console.error('❌ openAiCorrectionSettings 函数未定义');
        showToast('设置功能未加载，请刷新页面', 'error');
      }
    });
    console.log('✅ 设置按钮事件监听器已绑定');
  } else {
    console.warn('⚠️ 未找到设置按钮元素: st-aiCorrectionSettingsBtn');
  }
}, 500);

// ==================== 角色设置功能 ====================
function showRoleSettings() {
  if (!st_currentDialogues || st_currentDialogues.length === 0) {
    showToast('请先加载转录内容', 'warning');
    return;
  }
  
  // 获取所有唯一的说话人
  const speakers = [...new Set(st_currentDialogues.map(d => d.speaker))];
  
  if (speakers.length === 0) {
    showToast('没有找到说话人', 'warning');
    return;
  }
  
  // 渲染角色设置界面
  const container = document.getElementById('st-roleSettingsList');
  container.innerHTML = speakers.map(speaker => {
    const currentRole = st_speakerRoles[speaker] || '';
    return `
      <div style="display: flex; align-items: center; gap: 15px; background: white; padding: 10px 15px; border-radius: 6px; border: 1px solid #ddd;">
        <span style="min-width: 120px; font-weight: 500; color: #333;">${escapeHtml(speaker)}</span>
        <div style="display: flex; gap: 10px; flex: 1;">
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="radio" name="role-${escapeHtml(speaker)}" value="customer" ${currentRole === 'customer' ? 'checked' : ''}>
            <span>👤 客户</span>
          </label>
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="radio" name="role-${escapeHtml(speaker)}" value="our_side" ${currentRole === 'our_side' ? 'checked' : ''}>
            <span>👔 我方</span>
          </label>
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
            <input type="radio" name="role-${escapeHtml(speaker)}" value="" ${!currentRole ? 'checked' : ''}>
            <span style="color: #999;">未设置</span>
          </label>
        </div>
      </div>
    `;
  }).join('');
  
  // 显示角色设置容器
  document.getElementById('st-roleSettingsContainer').style.display = 'block';
  
  // 滚动到角色设置区域
  document.getElementById('st-roleSettingsContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideRoleSettings() {
  document.getElementById('st-roleSettingsContainer').style.display = 'none';
}

async function saveRoleSettings() {
  if (!st_currentTranscriptionId) {
    showToast('没有当前转录记录', 'error');
    return;
  }
  
  // 收集所有角色设置
  const speakers = [...new Set(st_currentDialogues.map(d => d.speaker))];
  const newRoles = {};
  
  speakers.forEach(speaker => {
    const radioName = `role-${escapeHtml(speaker)}`;
    const selected = document.querySelector(`input[name="${radioName}"]:checked`);
    if (selected && selected.value) {
      newRoles[speaker] = selected.value;
    }
  });
  
  // 验证是否有设置
  if (Object.keys(newRoles).length === 0) {
    showToast('请至少设置一个说话人的角色', 'warning');
    return;
  }
  
  try {
    // ✅ 使用新的API，保存到 dialogue_adjustments 表
    const response = await fetch(`${ST_API_BASE}/transcription/${st_currentTranscriptionId}/role-settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        speaker_roles: newRoles // 直接传递对象，后端会处理JSON序列化
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '保存失败');
    }
    
    // 更新本地状态
    st_speakerRoles = newRoles;
    
    // 重新渲染对话列表，显示角色标签
    let currentDialogues = [];
    if (st_currentTab === 'original') {
      currentDialogues = st_originalDialogues;
    } else if (st_currentTab === 'merged') {
      currentDialogues = st_mergedDialogues;
    } else if (st_currentTab === 'corrected') {
      currentDialogues = st_correctedDialogues;
    } else if (st_currentTab === 'remerged') {
      currentDialogues = st_reMergedDialogues; // ✅ 支持再次合并页签
    }
    
    if (currentDialogues && currentDialogues.length > 0) {
      renderDialogues(currentDialogues, `st-dialoguesList-${st_currentTab}`);
    }
    
    hideRoleSettings();
    showToast('角色设置已保存到 dialogue_adjustments 表！', 'success');
    
  } catch (error) {
    console.error('保存角色设置失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  }
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
  
  // ✅ 更新音频名称显示
  const audioNameDisplay = document.getElementById('st-audioNameDisplay');
  if (audioNameDisplay) {
    const audioName = data.name || data.original_file_name || '';
    audioNameDisplay.textContent = audioName ? `(${audioName})` : '';
  }
  
  // 解析原始对话（从 transcriptions 表）
  let originalDialogues = data.original_dialogues || data.dialogues || [];
  if (typeof originalDialogues === 'string') {
    try {
      originalDialogues = JSON.parse(originalDialogues);
    } catch (e) {
      originalDialogues = [];
    }
  }
  
  // 解析合并后的对话（从 dialogue_adjustments 表，note1='合并相邻同一说话人的对话'）- 第一次合并
  let mergedDialogues = [];
  // 解析AI修正后的对话（从 dialogue_adjustments 表，note1='AI错别字修正'）
  let correctedDialogues = [];
  // ✅ 解析再次合并后的对话（从 dialogue_adjustments 表，note1='再次合并对话'）
  let reMergedDialogues = [];
  
  // ✅ 优先从 mergeAdjustment 字段获取第一次合并记录（如果后端单独返回）
  if (data.mergeAdjustment && data.mergeAdjustment.adjusted_dialogues) {
    mergedDialogues = Array.isArray(data.mergeAdjustment.adjusted_dialogues)
      ? data.mergeAdjustment.adjusted_dialogues
      : (typeof data.mergeAdjustment.adjusted_dialogues === 'string'
        ? JSON.parse(data.mergeAdjustment.adjusted_dialogues)
        : []);
  }
  
  // ✅ 从 reMergeAdjustment 字段获取再次合并记录（如果后端单独返回）
  if (data.reMergeAdjustment && data.reMergeAdjustment.adjusted_dialogues) {
    reMergedDialogues = Array.isArray(data.reMergeAdjustment.adjusted_dialogues)
      ? data.reMergeAdjustment.adjusted_dialogues
      : (typeof data.reMergeAdjustment.adjusted_dialogues === 'string'
        ? JSON.parse(data.reMergeAdjustment.adjusted_dialogues)
        : []);
    console.log('✅ 再次合并后的对话已加载，共', reMergedDialogues.length, '条');
  }
  
  // 如果有调整记录，需要区分是合并、AI修正还是再次合并
  if (data.adjustment) {
    const note1 = data.adjustment.note1 || '';
    
    if (note1 === '合并相邻同一说话人的对话' && data.adjustment.adjusted_dialogues) {
      // 第一次合并后的对话（如果 mergeAdjustment 没有数据，使用 adjustment）
      if (mergedDialogues.length === 0) {
        mergedDialogues = Array.isArray(data.adjustment.adjusted_dialogues)
          ? data.adjustment.adjusted_dialogues
          : (typeof data.adjustment.adjusted_dialogues === 'string'
            ? JSON.parse(data.adjustment.adjusted_dialogues)
            : []);
      }
    } else if (note1 === '再次合并对话' && data.adjustment.adjusted_dialogues) {
      // ✅ 再次合并后的对话（如果 reMergeAdjustment 没有数据，使用 adjustment）
      if (reMergedDialogues.length === 0) {
        reMergedDialogues = Array.isArray(data.adjustment.adjusted_dialogues)
          ? data.adjustment.adjusted_dialogues
          : (typeof data.adjustment.adjusted_dialogues === 'string'
            ? JSON.parse(data.adjustment.adjusted_dialogues)
            : []);
        console.log('✅ 再次合并后的对话已从 adjustment 加载，共', reMergedDialogues.length, '条');
      }
    } else if (note1 === 'AI错别字修正' && data.adjustment.adjusted_dialogues) {
      // AI修正后的对话
      correctedDialogues = Array.isArray(data.adjustment.adjusted_dialogues)
        ? data.adjustment.adjusted_dialogues
        : (typeof data.adjustment.adjusted_dialogues === 'string'
          ? JSON.parse(data.adjustment.adjusted_dialogues)
          : []);
      
      // ✅ 兼容旧数据格式：如果只有 text 字段，需要转换为 correctedText
      // 旧格式：{ text: "修正后的文本" }
      // 新格式：{ originalText: "原始文本", correctedText: "修正后的文本", text: "修正后的文本" }
      correctedDialogues = correctedDialogues.map(dialogue => {
        // 如果已经有 correctedText 字段，直接返回
        if (dialogue.correctedText) {
          return dialogue;
        }
        // 如果只有 text 字段（旧格式），将其作为 correctedText
        if (dialogue.text && !dialogue.correctedText) {
          return {
            ...dialogue,
            originalText: dialogue.text, // 旧数据没有原始文本，暂时用 text 代替
            correctedText: dialogue.text, // 将 text 作为 correctedText
            text: dialogue.text // 保留 text 字段
          };
        }
        return dialogue;
      });
      
      console.log('✅ AI修正后的对话已加载，共', correctedDialogues.length, '条');
      if (correctedDialogues.length > 0) {
        console.log('📋 第一条对话示例:', correctedDialogues[0]);
      }
    }
  }
  
  // ✅ 加载角色设置（优先从 dialogue_adjustments 表的 adjustment 记录中获取）
  // 后端会优先返回包含 speaker_roles 的 adjustment 记录（AI修正记录或角色判断记录）
  // 如果没有 adjustment 记录，才从 transcriptions 表读取（兼容旧数据）
  if (data.adjustment && data.adjustment.speaker_roles) {
    try {
      st_speakerRoles = typeof data.adjustment.speaker_roles === 'string' 
        ? JSON.parse(data.adjustment.speaker_roles) 
        : data.adjustment.speaker_roles;
      console.log(`✅ 角色设置已从 dialogue_adjustments 表加载（${data.adjustment.note1 || '调整记录'}）`);
    } catch (e) {
      console.error('解析 dialogue_adjustments 表的角色设置失败:', e);
      st_speakerRoles = {};
    }
  } else if (data.speaker_roles) {
    // 兼容旧数据：从 transcriptions 表读取（不推荐，已废弃）
    try {
      st_speakerRoles = typeof data.speaker_roles === 'string' 
        ? JSON.parse(data.speaker_roles) 
        : data.speaker_roles;
      console.warn('⚠️ 角色设置从 transcriptions 表读取（旧数据，建议迁移到 dialogue_adjustments 表）');
    } catch (e) {
      console.error('解析 transcriptions 表的角色设置失败:', e);
      st_speakerRoles = {};
    }
  } else {
    st_speakerRoles = {};
    console.log('ℹ️ 未找到角色设置');
  }
  
  // 保存所有对话版本
  st_originalDialogues = originalDialogues;
  st_mergedDialogues = mergedDialogues;
  st_correctedDialogues = correctedDialogues;
  st_reMergedDialogues = reMergedDialogues; // ✅ 保存再次合并后的对话
  st_currentDialogues = originalDialogues; // 默认显示原始对话
  
  // 更新对话数量（显示原始对话的数量）
  document.getElementById('st-dialogueCount').textContent = (originalDialogues?.length || 0);
  document.getElementById('st-audioDuration').textContent = formatDuration(
    data.audio_duration || data.audioDuration || data.duration  // ✅ 兼容三种命名
  );
  document.getElementById('st-transcriptionTime').textContent = formatDateTime(data.created_at || data.createdAt);
  
  // ✅ 初始化音频播放器
  initAudioPlayer(st_currentAudioPath);
  
  // 渲染所有对话列表
  renderDialogues(originalDialogues || [], 'st-dialoguesList-original');
  
  // 始终显示"合并后的对话"标签页（第一次合并），即使没有数据也显示（显示空状态）
  renderDialogues(mergedDialogues || [], 'st-dialoguesList-merged');
  document.getElementById('st-tab-merged').style.display = 'block';
  
  // 始终显示"AI修正后的对话"标签页，即使没有数据也显示（显示空状态）
  renderDialogues(correctedDialogues || [], 'st-dialoguesList-corrected');
  document.getElementById('st-tab-corrected').style.display = 'block';
  
  // ✅ 如果有再次合并的记录，显示"再次合并后的对话"标签页
  if (reMergedDialogues && reMergedDialogues.length > 0) {
    renderDialogues(reMergedDialogues || [], 'st-dialoguesList-remerged');
    document.getElementById('st-tab-remerged').style.display = 'block';
  } else {
    document.getElementById('st-tab-remerged').style.display = 'none';
    renderDialogues([], 'st-dialoguesList-remerged'); // 渲染空列表
  }
  
  // 默认显示原始对话标签页
  switchDialogueTab('original');
  
  // ✅ 重新绑定按钮事件（确保按钮可用）
  bindResultButtons();
  
  // ✅ 加载问答对（异步，不阻塞页面显示）
  if (st_currentTranscriptionId) {
    loadQAPairs(st_currentTranscriptionId).catch(error => {
      console.error('加载问答对失败:', error);
      // 静默失败，不影响主流程
    });
  }
  
  showToast('转录成功！', 'success');
}

// 绑定结果区域的按钮事件
function bindResultButtons() {
  const copyBtn = document.getElementById('st-copyAllBtn');
  const downloadBtn = document.getElementById('st-downloadBtn');
  const newBtn = document.getElementById('st-newTranscriptionBtn');
  
  // 移除旧的事件监听器（如果存在）
  if (copyBtn) {
    copyBtn.replaceWith(copyBtn.cloneNode(true));
    document.getElementById('st-copyAllBtn').addEventListener('click', copyAllDialogues);
  }
  
  if (downloadBtn) {
    downloadBtn.replaceWith(downloadBtn.cloneNode(true));
    document.getElementById('st-downloadBtn').addEventListener('click', downloadResult);
  }
  
  if (newBtn) {
    newBtn.replaceWith(newBtn.cloneNode(true));
    document.getElementById('st-newTranscriptionBtn').addEventListener('click', resetForm);
  }
}

// 切换对话标签页
function switchDialogueTab(tab) {
  st_currentTab = tab;
  
  // 更新标签页按钮样式
  const originalTab = document.getElementById('st-tab-original');
  const mergedTab = document.getElementById('st-tab-merged');
  const correctedTab = document.getElementById('st-tab-corrected');
  const reMergedTab = document.getElementById('st-tab-remerged');
  const qaTab = document.getElementById('st-tab-qa');
  const originalList = document.getElementById('st-dialoguesList-original');
  const mergedList = document.getElementById('st-dialoguesList-merged');
  const correctedList = document.getElementById('st-dialoguesList-corrected');
  const reMergedList = document.getElementById('st-dialoguesList-remerged');
  const qaList = document.getElementById('st-dialoguesList-qa');
  
  // 重置所有标签页样式
  [originalTab, mergedTab, correctedTab, reMergedTab, qaTab].forEach(t => {
    if (t) {
      t.classList.remove('active');
      t.style.borderBottomColor = 'transparent';
      t.style.color = '#666';
    }
  });
  
  // 隐藏所有列表
  [originalList, mergedList, correctedList, reMergedList, qaList].forEach(list => {
    if (list) {
      list.style.display = 'none';
    }
  });
  
  if (tab === 'original') {
    if (originalTab) {
      originalTab.classList.add('active');
      originalTab.style.borderBottomColor = 'var(--primary)';
      originalTab.style.color = 'var(--primary)';
    }
    if (originalList) {
      originalList.style.display = 'block';
    }
    st_currentDialogues = st_originalDialogues;
  } else if (tab === 'merged') {
    if (mergedTab) {
      mergedTab.classList.add('active');
      mergedTab.style.borderBottomColor = 'var(--primary)';
      mergedTab.style.color = 'var(--primary)';
    }
    if (mergedList) {
      mergedList.style.display = 'block';
    }
    st_currentDialogues = st_mergedDialogues;
  } else if (tab === 'corrected') {
    if (correctedTab) {
      correctedTab.classList.add('active');
      correctedTab.style.borderBottomColor = 'var(--primary)';
      correctedTab.style.color = 'var(--primary)';
    }
    if (correctedList) {
      correctedList.style.display = 'block';
    }
    st_currentDialogues = st_correctedDialogues;
  } else if (tab === 'remerged') {
    // ✅ 再次合并后的对话页签
    if (reMergedTab) {
      reMergedTab.classList.add('active');
      reMergedTab.style.borderBottomColor = 'var(--primary)';
      reMergedTab.style.color = 'var(--primary)';
    }
    if (reMergedList) {
      reMergedList.style.display = 'block';
    }
    st_currentDialogues = st_reMergedDialogues;
  } else if (tab === 'qa') {
    if (qaTab) {
      qaTab.classList.add('active');
      qaTab.style.borderBottomColor = 'var(--primary)';
      qaTab.style.color = 'var(--primary)';
    }
    if (qaList) {
      qaList.style.display = 'block';
      // 如果问答对列表为空，重新加载
      if (!st_qaPairs || st_qaPairs.length === 0) {
        loadQAPairs(st_currentTranscriptionId);
      } else {
        renderQAPairs(st_qaPairs, 'st-dialoguesList-qa');
      }
    }
  }
}

function renderDialogues(dialogues, containerId = 'st-dialoguesList-original') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`容器 ${containerId} 不存在`);
    return;
  }
  
  if (!dialogues || dialogues.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">暂无对话内容</p>';
    return;
  }
  
  // 判断是否是AI修正后的对话列表
  const isCorrectedTab = containerId === 'st-dialoguesList-corrected';
  
  container.innerHTML = dialogues.map((dialogue, index) => {
    const timeRange = dialogue.timeRange || dialogue.startTime || '';
    const speaker = dialogue.speaker || '说话人' + (index + 1);
    
    // 对于AI修正后的对话，优先使用 correctedText，否则使用 text
    let text = '';
    if (isCorrectedTab) {
      text = dialogue.correctedText || dialogue.text || '';
    } else {
      text = dialogue.text || '';
    }
    
    // 获取角色标签
    const role = st_speakerRoles[speaker];
    let roleTag = '';
    if (role === 'customer') {
      roleTag = '<span class="role-badge role-customer">👤 客户</span>';
    } else if (role === 'our_side') {
      roleTag = '<span class="role-badge role-our-side">👔 我方</span>';
    }
    
    // 对于AI修正后的对话，如果有修改，显示修改说明
    // 格式：对话文本 【原文--修正文】
    let changesDisplay = '';
    if (isCorrectedTab && dialogue.changes && Array.isArray(dialogue.changes) && dialogue.changes.length > 0) {
      // 解析 changes 数组，格式可能是：
      // - ["原文--修正文"] 或 ["伊斯特--east"]
      // - ["原文 → 修正文"]
      // - ["修改说明"]
      const changeItems = dialogue.changes
        .map(change => {
          if (typeof change === 'string') {
            // 如果已经是 "原文--修正文" 格式，直接使用
            if (change.includes('--')) {
              return change; // 保留完整格式：原文--修正文
            }
            // 如果是 "原文 → 修正文" 格式，转换为 "--" 格式
            if (change.includes('→')) {
              const parts = change.split('→');
              if (parts.length === 2) {
                return `${parts[0].trim()}--${parts[1].trim()}`;
              }
            }
            // 如果是其他格式，直接使用
            return change;
          }
          return String(change);
        })
        .filter(c => c && c.trim()); // 过滤空值
      
      if (changeItems.length > 0) {
        // 将所有修改项格式化为 【原文--修正文】 的形式，多个修改用空格分隔
        const changesStr = changeItems
          .map(item => `【${item}】`)
          .join(' ');
        changesDisplay = ` <span style="color: #ff9800; font-weight: 500;">${escapeHtml(changesStr)}</span>`;
      }
    }
    
    return `
      <div class="dialogue-item" data-index="${index}" data-start="${parseTimeToSeconds(timeRange.split('-')[0])}">
        <div class="dialogue-header">
          <span class="dialogue-time">${timeRange}</span>
          <span class="speaker-name">${escapeHtml(speaker)}</span>
          ${roleTag}
          <span style="color: #333;">：</span>
          <span class="dialogue-text-inline">${escapeHtml(text)}${changesDisplay}</span>
          <button class="btn btn-sm btn-secondary dialogue-edit-btn" data-index="${index}" style="margin-left: auto;">✏️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 操作功能 ====================
function copyAllDialogues() {
  // 根据当前标签页获取对话列表
  let currentListId = 'st-dialoguesList-original';
  if (st_currentTab === 'merged') {
    currentListId = 'st-dialoguesList-merged';
  } else if (st_currentTab === 'corrected') {
    currentListId = 'st-dialoguesList-corrected';
  }
  const dialogues = document.querySelectorAll(`#${currentListId} .dialogue-item`);
  
  if (dialogues.length === 0) {
    showToast('没有可复制的内容', 'error');
    return;
  }
  
  // 从对话项中提取时间戳、说话人和文本
  const text = Array.from(dialogues).map(dialogue => {
    const timeEl = dialogue.querySelector('.dialogue-time');
    const timeRange = timeEl?.textContent || '';
    const speaker = dialogue.querySelector('.speaker-name')?.textContent || '未知说话人';
    const textEl = dialogue.querySelector('.dialogue-text-inline') || dialogue.querySelector('.dialogue-text');
    const text = textEl?.textContent || '';
    
    // 格式：[时间戳] 【说话人】文本
    if (timeRange) {
      return `[${timeRange}] 【${speaker}】\n${text}`;
    } else {
      return `【${speaker}】\n${text}`;
    }
  }).join('\n\n');
  
  if (!text || text.trim().length === 0) {
    showToast('没有可复制的内容', 'error');
    return;
  }
  
  navigator.clipboard.writeText(text).then(() => {
    showToast('已复制到剪贴板', 'success');
  }).catch(err => {
    console.error('复制失败:', err);
    // 降级方案：使用传统方法
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showToast('已复制到剪贴板', 'success');
    } catch (e) {
      showToast('复制失败，请手动复制', 'error');
    }
    document.body.removeChild(textarea);
  });
}

function downloadResult() {
  if (!st_currentTranscriptionId) {
    showToast('没有可下载的结果', 'error');
    return;
  }
  
  // 根据当前标签页获取对话列表
  let currentListId = 'st-dialoguesList-original';
  if (st_currentTab === 'merged') {
    currentListId = 'st-dialoguesList-merged';
  } else if (st_currentTab === 'corrected') {
    currentListId = 'st-dialoguesList-corrected';
  }
  const dialogues = document.querySelectorAll(`#${currentListId} .dialogue-item`);
  
  if (dialogues.length === 0) {
    showToast('没有可下载的内容', 'error');
    return;
  }
  
  let content = `语音转文本结果\n\n`;
  content += `转录时间: ${document.getElementById('st-transcriptionTime')?.textContent || '-'}\n`;
  content += `说话人数: ${document.getElementById('st-speakerCount')?.textContent || '-'}\n`;
  content += `对话数量: ${document.getElementById('st-dialogueCount')?.textContent || '-'}\n`;
  content += `音频时长: ${document.getElementById('st-audioDuration')?.textContent || '-'}\n\n`;
  content += `${'='.repeat(50)}\n\n`;
  
  dialogues.forEach(dialogue => {
    const timeEl = dialogue.querySelector('.dialogue-time');
    const timeRange = timeEl?.textContent || '';
    const speaker = dialogue.querySelector('.speaker-name')?.textContent || '未知说话人';
    const textEl = dialogue.querySelector('.dialogue-text-inline') || dialogue.querySelector('.dialogue-text');
    const text = textEl?.textContent || '';
    
    // 格式：[时间戳] 【说话人】文本
    if (timeRange) {
      content += `[${timeRange}] 【${speaker}】\n${text}\n\n`;
    } else {
      content += `【${speaker}】\n${text}\n\n`;
    }
  });
  
  if (content.trim().length === 0) {
    showToast('没有可下载的内容', 'error');
    return;
  }
  
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `转录结果_${new Date().getTime()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('下载成功', 'success');
  } catch (error) {
    console.error('下载失败:', error);
    showToast('下载失败: ' + error.message, 'error');
  }
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
      // 后端已经返回了：
      // - result.data.dialogues: 原始对话（从 transcriptions 表）
      // - result.data.original_dialogues: 原始对话的备份
      // - result.data.adjustment.adjusted_dialogues: 合并后的对话（从 dialogue_adjustments 表，如果有）
      
      // 确保 original_dialogues 存在（从 transcriptions 表获取的原始对话）
      if (!result.data.original_dialogues) {
        result.data.original_dialogues = result.data.dialogues || [];
      }
      
      // 如果有调整记录，标记为已调整
      if (result.data.adjustment && result.data.adjustment.adjusted_dialogues) {
        result.data.isAdjusted = true;
      } else {
        result.data.isAdjusted = false;
      }
      
      displayResult(result.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } catch (error) {
    console.error('加载转录详情失败:', error);
    showToast('加载失败', 'error');
  }
}

// 合并对话功能
async function mergeDialogues(transcriptionId) {
  if (!window.confirm('确定要合并相邻同一说话人的对话吗？此操作将创建一条调整记录。')) {
    return;
  }
  
  try {
    showToast('正在合并对话...', 'info');
    
    const response = await fetch(`${ST_API_BASE}/transcription/${transcriptionId}/merge-dialogues`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (result.success) {
      showToast('合并成功！', 'success');
      // 刷新文件列表
      await loadScanFiles();
      // 自动打开核查纠偏页面
      setTimeout(() => {
        viewTranscription(transcriptionId);
      }, 500);
    } else {
      showToast(result.error || '合并失败', 'error');
    }
  } catch (error) {
    console.error('合并对话失败:', error);
    showToast('合并失败: ' + error.message, 'error');
  }
}

// ==================== 全局函数暴露（供HTML调用）====================
// 注意：这里只暴露已定义的函数，其他函数在文件末尾统一暴露
window.saveDialogueEdit = saveDialogueEdit;
window.cancelDialogueEdit = cancelDialogueEdit;
window.closeBatchReplaceDialog = closeBatchReplaceDialog;
window.executeBatchReplace = executeBatchReplace;
window.mergeDialogues = mergeDialogues;

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
  const paginationEl = document.getElementById('st-pagination');
  tbody.innerHTML = '<tr><td colspan="6" class="loading">正在扫描...</td></tr>';
  
  if (paginationEl) {
    paginationEl.style.display = 'none';
  }
  
  try {
    // 添加分页参数
    const response = await fetch(`${ST_API_BASE}/transcription/scan/files?page=${st_currentPage}&pageSize=${st_pageSize}`);
    const result = await response.json();
    
    if (!result.success) {
      tbody.innerHTML = `<tr><td colspan="6" class="error">${result.error}</td></tr>`;
      document.getElementById('st-fileCount').textContent = '总计: 0 个文件';
      if (paginationEl) {
        paginationEl.style.display = 'none';
      }
      return;
    }
    
    const files = result.data || [];
    const pagination = result.pagination || {};
    
    // 更新分页状态
    st_totalFiles = pagination.total || files.length;
    st_totalPages = pagination.totalPages || 1;
    st_currentPage = pagination.page || st_currentPage;
    
    // 更新文件总数显示
    document.getElementById('st-fileCount').textContent = `总计: ${st_totalFiles} 个文件`;
    
    if (files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty">目录中没有找到音频文件</td></tr>';
      if (paginationEl) {
        paginationEl.style.display = 'none';
      }
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
            ? `<div style="display: flex; gap: 5px;">
                <button class="btn btn-sm btn-info" onclick="mergeDialogues('${file.transcriptionId}')" title="合并相邻同一说话人的对话">🔗 合并对话</button>
                <button class="btn btn-sm btn-secondary" onclick="viewTranscription('${file.transcriptionId}')">✏️ 核查纠偏</button>
              </div>`
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
    
    // 更新分页UI
    updateStPagination();
  } catch (error) {
    console.error('加载文件列表失败:', error);
    tbody.innerHTML = `<tr><td colspan="6" class="error">加载失败: ${error.message}</td></tr>`;
    document.getElementById('st-fileCount').textContent = '总计: 0 个文件';
    if (paginationEl) {
      paginationEl.style.display = 'none';
    }
  }
}

// 分页控制函数
function st_prevPage() {
  if (st_currentPage > 1) {
    st_currentPage--;
    loadScanFiles();
  }
}

function st_nextPage() {
  if (st_currentPage < st_totalPages) {
    st_currentPage++;
    loadScanFiles();
  }
}

function updateStPagination() {
  const paginationEl = document.getElementById('st-pagination');
  const pageInfoEl = document.getElementById('st-page-info');
  const prevBtn = document.getElementById('st-prev-page');
  const nextBtn = document.getElementById('st-next-page');
  
  if (!paginationEl || !pageInfoEl) {
    return;
  }
  
  // 如果只有一页或没有数据，隐藏分页组件
  if (st_totalPages <= 1 || st_totalFiles === 0) {
    paginationEl.style.display = 'none';
    return;
  }
  
  // 显示分页组件
  paginationEl.style.display = 'flex';
  
  // 更新分页信息
  pageInfoEl.textContent = `第 ${st_currentPage} 页 / 共 ${st_totalPages} 页`;
  
  // 更新按钮状态
  if (prevBtn) {
    prevBtn.disabled = st_currentPage === 1;
  }
  if (nextBtn) {
    nextBtn.disabled = st_currentPage === st_totalPages;
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

// ==================== 全局函数暴露（供HTML调用）====================
// ✅ 在文件末尾统一暴露所有需要全局访问的函数（确保函数已定义）
window.st_switchTab = st_switchTab; // ✅ 暴露到全局作用域，供 HTML onclick="st_switchTab('scan')" 使用
window.switchDialogueTab = switchDialogueTab; // ✅ 暴露到全局作用域，供 HTML onclick 使用
window.triggerReMerge = triggerReMerge; // ✅ 暴露到全局作用域，供 HTML onclick="triggerReMerge()" 使用
window.startQAExtraction = startQAExtraction; // ✅ 暴露到全局作用域，供 HTML onclick 使用
window.playQAAudio = playQAAudio; // ✅ 暴露到全局作用域，供 HTML onclick="playQAAudio(index)" 使用
window.checkNeedsReMergeLocally = checkNeedsReMergeLocally;

