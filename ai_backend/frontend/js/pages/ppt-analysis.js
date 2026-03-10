/**
 * PPT AI 内容分析页面
 * 完整的JavaScript实现
 */

// 使用相对路径，支持本地和远程访问
const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api';
const PPT_API_BASE = API_BASE + '/ppt-analysis';
const ADMIN_API_BASE = API_BASE + '/admin';

// 缩略图服务地址（如果缩略图服务在不同端口，需要配置）
// 注意：缩略图服务在5001端口（online-ppt-backend），需要根据实际部署情况调整
function getThumbnailServerBase() {
  const origin = window.location.origin || 'http://localhost:3000';
  // 如果是localhost，使用localhost:5001
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return 'http://localhost:5001';
  }
  // 远程环境：尝试替换端口为5001，或使用相同主机名
  const hostname = window.location.hostname;
  return `${window.location.protocol}//${hostname}:5001`;
}
const THUMBNAIL_SERVER_BASE = getThumbnailServerBase();
let pptCurrentDocument = null;
let pptDocuments = [];
let pptAnalysisResults = [];
let pptStatistics = null;
let pptCategories = [];
let pptModelConfig = null;  // 当前场景的模型配置
let pptPromptConfig = null; // 当前场景的提示词配置
let pptAllFiles = []; // 所有文件列表（包含分析状态）

// 页面初始化 - 等待DOM完全加载
(async function() {
  console.log('🤖 PPT分析页面初始化...');
  
  // ✅ 等待关键DOM元素存在
  await waitForElement('ppt-document-select');
  
  await loadPptConfig();
  await loadPptDocuments();
  await loadPptCategories();
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
        setTimeout(check, 50); // 每50ms检查一次
      }
    };
    
    check();
  });
}

// ==================== 加载配置 ====================

// 加载PPT分析场景的配置
async function loadPptConfig() {
  try {
    console.log('⚙️ 加载PPT分析配置...');

    // 获取PPT分析场景的默认模型
    console.log('📡 请求模型配置: GET /api/admin/models/default/ppt_analysis');
    const modelResponse = await fetch(`${ADMIN_API_BASE}/models/default/ppt_analysis`);
    console.log('📦 模型配置响应状态:', modelResponse.status);
    
    const modelResult = await modelResponse.json();
    console.log('📦 模型配置响应数据:', modelResult);

    if (modelResult.success && modelResult.data) {
      pptModelConfig = modelResult.data;
      console.log('✅ 模型配置已加载:', pptModelConfig);
    } else {
      console.warn('⚠️ 未找到PPT分析场景的默认模型配置');
      console.warn('⚠️ 错误信息:', modelResult.error || '无');
      pptShowToast('未配置PPT分析模型，请先在模型配置中为"PPT分析"场景设置默认模型', 'warning');
    }

    // 获取PPT分析场景的激活提示词
    console.log('📡 请求提示词配置: GET /api/admin/prompts/scenes/ppt_analysis');
    const promptResponse = await fetch(`${ADMIN_API_BASE}/prompts/scenes/ppt_analysis`);
    console.log('📦 提示词配置响应状态:', promptResponse.status);
    
    const promptResult = await promptResponse.json();
    console.log('📦 提示词配置响应数据:', promptResult);

    if (promptResult.success && promptResult.data && promptResult.data.length > 0) {
      // 取第一个激活的提示词
      pptPromptConfig = promptResult.data.find(p => p.is_active) || promptResult.data[0];
      console.log('✅ 提示词配置已加载:', pptPromptConfig);
    } else {
      console.warn('⚠️ 未找到PPT分析场景的提示词配置');
      console.warn('⚠️ 错误信息:', promptResult.error || '无');
      pptShowToast('未配置PPT分析提示词，请先在提示词管理中为"PPT分析"场景设置提示词', 'warning');
    }

  } catch (error) {
    console.error('❌ 加载配置失败:', error);
    pptShowToast('加载配置失败: ' + error.message, 'error');
  }
}

// 显示配置信息
function displayPptConfig() {
  const configDiv = document.getElementById('ppt-config-info');
  
  if (!pptModelConfig && !pptPromptConfig) {
    configDiv.style.display = 'none';
    return;
  }

  // 显示模型配置
  if (pptModelConfig) {
    document.getElementById('ppt-config-model-name').textContent = 
      `${pptModelConfig.name} (${pptModelConfig.model_name})`;
    document.getElementById('ppt-config-provider').textContent = 
      pptModelConfig.provider || '-';
    document.getElementById('ppt-config-temperature').textContent = 
      pptModelConfig.temperature || '-';
  } else {
    document.getElementById('ppt-config-model-name').textContent = '未配置';
    document.getElementById('ppt-config-model-name').style.color = '#f5222d';
  }

  // 显示提示词配置
  if (pptPromptConfig) {
    document.getElementById('ppt-config-prompt-name').textContent = 
      `${pptPromptConfig.name} (v${pptPromptConfig.version || '1.0'})`;
  } else {
    document.getElementById('ppt-config-prompt-name').textContent = '未配置';
    document.getElementById('ppt-config-prompt-name').style.color = '#f5222d';
  }

  configDiv.style.display = 'block';
}

// 跳转到模型配置页面
function goToModelConfig() {
  loadPage('model-config');
  // 切换侧边栏菜单
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector('.menu-item[data-page="model-config"]')?.classList.add('active');
}

// 跳转到提示词管理页面
function goToPromptConfig() {
  loadPage('prompt-templates');
  // 切换侧边栏菜单
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector('.menu-item[data-page="prompt-templates"]')?.classList.add('active');
}

// ==================== 标签切换 ====================
function switchPptTab(tabName) {
  // 更新标签按钮状态
  document.querySelectorAll('.nav-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add('active');

  // 更新标签内容显示
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`ppt-${tabName}-tab`)?.classList.add('active');

  // 根据标签加载数据
  if (tabName === 'all-files') {
    loadAllPptFiles();
  } else if (tabName === 'results') {
    refreshPptResults();  // 分析结果页始终刷新，支持全量展示
  } else if (tabName === 'statistics' && pptCurrentDocument) {
    refreshPptStatistics();
  }
}

// ==================== 所有文件 ====================

// 加载所有文件列表（包含分析状态）
async function loadAllPptFiles() {
  try {
    console.log('📡 加载所有文件列表...');
    
    const loadingEl = document.getElementById('ppt-all-files-loading');
    const emptyEl = document.getElementById('ppt-all-files-empty');
    const contentEl = document.getElementById('ppt-all-files-content');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';
    
    // 获取所有文档
    const response = await fetch(`${API_BASE}/documents/list?page=1&pageSize=1000`);
    const result = await response.json();

    if (result.success && result.data && result.data.list) {
      const documents = result.data.list;
      console.log(`✅ 获取到 ${documents.length} 个文档`);
      
      // 检查每个文档的分析状态
      pptAllFiles = [];
      for (const doc of documents) {
        const analysisStatus = await checkDocumentAnalysisStatus(doc.id);
        pptAllFiles.push({
          ...doc,
          isAnalyzed: analysisStatus.isAnalyzed,
          analyzedCount: analysisStatus.analyzedCount,
          totalSlides: doc.slide_count || doc.extracted_count || 0
        });
      }
      
      // 渲染文件列表
      renderAllPptFiles();
      
      if (loadingEl) loadingEl.style.display = 'none';
      if (pptAllFiles.length === 0) {
        if (emptyEl) emptyEl.style.display = 'block';
      } else {
        if (contentEl) contentEl.style.display = 'block';
      }
      
      pptShowToast(`已加载 ${pptAllFiles.length} 个文件`, 'success');
    } else {
      console.error('❌ 加载文件列表失败:', result.error);
      pptShowToast('加载文件列表失败: ' + (result.error || '未知错误'), 'error');
      if (loadingEl) loadingEl.style.display = 'none';
      if (emptyEl) emptyEl.style.display = 'block';
    }
  } catch (error) {
    console.error('❌ 加载文件列表失败:', error);
    pptShowToast('网络错误: ' + error.message, 'error');
    const loadingEl = document.getElementById('ppt-all-files-loading');
    const emptyEl = document.getElementById('ppt-all-files-empty');
    if (loadingEl) loadingEl.style.display = 'none';
    if (emptyEl) emptyEl.style.display = 'block';
  }
}

// 检查文档的分析状态
async function checkDocumentAnalysisStatus(documentId) {
  try {
    const response = await fetch(`${PPT_API_BASE}/results/${documentId}`);
    const result = await response.json();
    
    if (result.success && result.results && result.results.length > 0) {
      return {
        isAnalyzed: true,
        analyzedCount: result.results.length
      };
    } else {
      return {
        isAnalyzed: false,
        analyzedCount: 0
      };
    }
  } catch (error) {
    console.error(`❌ 检查文档 ${documentId} 分析状态失败:`, error);
    return {
      isAnalyzed: false,
      analyzedCount: 0
    };
  }
}

// 渲染所有文件列表
function renderAllPptFiles() {
  const contentEl = document.getElementById('ppt-all-files-content');
  if (!contentEl) return;
  
  if (pptAllFiles.length === 0) {
    contentEl.innerHTML = '<div class="empty-state"><p>暂无文件</p></div>';
    return;
  }
  
  contentEl.innerHTML = pptAllFiles.map(file => {
    const statusClass = !file.is_extracted || file.extracted_count === 0 
      ? 'no-extract' 
      : file.isAnalyzed 
        ? 'analyzed' 
        : 'unanalyzed';
    
    const statusText = !file.is_extracted || file.extracted_count === 0
      ? '未提取'
      : file.isAnalyzed
        ? '已分析'
        : '未分析';
    
    const extractedCount = file.extracted_count || 0;
    const analyzedCount = file.isAnalyzed ? file.analyzedCount : 0;
    
    return `
      <div class="file-item">
        <div class="file-info">
          <div class="file-name">
            <span>📄 ${file.name || '未命名文档'}</span>
            <span class="file-status ${statusClass}">${statusText}</span>
          </div>
          <div class="file-meta">
            <div class="file-meta-item">
              <span>📊 总页数:</span>
              <strong>${file.slide_count || 0}</strong>
            </div>
            <div class="file-meta-item">
              <span>📝 已提取:</span>
              <strong>${extractedCount}</strong>
            </div>
            ${file.isAnalyzed ? `
            <div class="file-meta-item">
              <span>✅ 已分析:</span>
              <strong>${analyzedCount}</strong>
            </div>
            ` : ''}
            <div class="file-meta-item">
              <span>🆔 ID:</span>
              <code style="font-size: 12px; color: var(--primary-color);">${file.id}</code>
            </div>
          </div>
        </div>
        <div class="file-actions">
          ${file.is_extracted && extractedCount > 0 ? (
            file.isAnalyzed ? (
              `<button class="btn btn-primary" onclick="viewFileResults('${file.id}', '${file.name}')">
                📊 查看结果
              </button>`
            ) : (
              `<button class="btn btn-primary" onclick="startFileAnalysis('${file.id}', '${file.name}')">
                🚀 开始分析
              </button>`
            )
          ) : (
            `<button class="btn btn-secondary" onclick="extractDocumentForAnalysis('${file.id}', '${file.name}')" title="点击提取文档内容">
              📝 提取文档
            </button>`
          )}
        </div>
      </div>
    `;
  }).join('');
}

// 查看文件分析结果
function viewFileResults(documentId, documentName) {
  // 设置当前文档
  const doc = pptAllFiles.find(d => d.id === documentId);
  if (doc) {
    pptCurrentDocument = doc;
  } else {
    // 如果不在列表中，创建一个临时对象
    pptCurrentDocument = {
      id: documentId,
      name: documentName
    };
  }
  
  // 切换到分析结果标签
  switchPptTab('results');
}

// 开始分析文件
async function startFileAnalysis(documentId, documentName) {
  // 设置当前文档
  const doc = pptAllFiles.find(d => d.id === documentId);
  if (doc) {
    pptCurrentDocument = doc;
  } else {
    pptCurrentDocument = {
      id: documentId,
      name: documentName
    };
  }
  
  // 切换到批量分析标签并开始分析
  switchPptTab('batch');
  
  // 等待DOM更新后自动开始分析
  setTimeout(async () => {
    // 更新文档选择下拉框
    const select = document.getElementById('ppt-document-select');
    if (select) {
      select.value = documentId;
      onPptDocumentChange();
      
      // 等待配置加载后开始分析
      await new Promise(resolve => setTimeout(resolve, 500));
      startPptBatchAnalysis();
    }
  }, 300);
}

// 提取文档（用于分析）
async function extractDocumentForAnalysis(documentId, documentName) {
  if (!confirm(`确定要提取文档 "${documentName}" 的内容吗？\n\n提取完成后即可进行AI分析。`)) {
    return;
  }

  pptShowToast('正在提取文档内容...', 'info');

  try {
    const response = await fetch(`${API_BASE}/documents/${documentId}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        extract_method: 'auto',
        force: false
      })
    });

    const result = await response.json();

    if (result.success) {
      pptShowToast(`提取成功！共提取 ${result.data.extracted_count} 页，可以开始分析了`, 'success');
      
      // 刷新文件列表
      setTimeout(() => {
        loadAllPptFiles();
      }, 1000);
    } else {
      pptShowToast('提取失败: ' + (result.error || '未知错误'), 'error');
    }
  } catch (error) {
    console.error('❌ 提取文档失败:', error);
    pptShowToast('网络错误: ' + error.message, 'error');
  }
}

// ==================== 批量分析 ====================

// 加载文档列表
async function loadPptDocuments() {
  try {
    console.log('📡 加载文档列表...');
    
    // 调用文档管理API获取已提取文本的文档
    const response = await fetch(`${API_BASE}/documents/list?page=1&pageSize=100`);
    const result = await response.json();

    if (result.success) {
      // 只显示已提取的文档
      pptDocuments = result.data.list.filter(doc => doc.is_extracted && doc.extracted_count > 0);
      
      const select = document.getElementById('ppt-document-select');
      select.innerHTML = '<option value="">-- 请选择文档 --</option>';
      
      pptDocuments.forEach(doc => {
        const option = document.createElement('option');
        option.value = doc.id;
        option.textContent = `${doc.name} (${doc.extracted_count} 页已提取)`;
        select.appendChild(option);
      });

      pptShowToast(`已加载 ${pptDocuments.length} 个文档`, 'success');
    } else {
      pptShowToast('加载文档列表失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 加载文档列表失败:', error);
    pptShowToast('网络错误: ' + error.message, 'error');
  }
}

// 文档选择变化
function onPptDocumentChange() {
  const select = document.getElementById('ppt-document-select');
  const docId = select.value;

  if (!docId) {
    document.getElementById('ppt-document-info').style.display = 'none';
    document.getElementById('ppt-config-info').style.display = 'none';
    document.getElementById('ppt-start-btn').disabled = true;
    document.getElementById('ppt-view-results-btn').disabled = true;
    document.getElementById('ppt-view-stats-btn').disabled = true;
    pptCurrentDocument = null;
    return;
  }

  const doc = pptDocuments.find(d => d.id === docId);
  if (!doc) return;

  pptCurrentDocument = doc;

  // 显示文档信息
  document.getElementById('ppt-doc-name').textContent = doc.name;
  document.getElementById('ppt-doc-total').textContent = doc.slide_count || doc.extracted_count;
  document.getElementById('ppt-doc-extracted').textContent = doc.extracted_count;
  document.getElementById('ppt-doc-id').textContent = doc.id;
  document.getElementById('ppt-document-info').style.display = 'block';
  
  // 显示配置信息
  displayPptConfig();

  // 启用按钮
  document.getElementById('ppt-start-btn').disabled = false;
  document.getElementById('ppt-view-results-btn').disabled = false;
  document.getElementById('ppt-view-stats-btn').disabled = false;

  console.log('📄 选中文档:', doc);
}

// 开始批量分析
async function startPptBatchAnalysis() {
  if (!pptCurrentDocument) {
    pptShowToast('请先选择文档', 'error');
    return;
  }

  // 检查配置
  if (!pptModelConfig) {
    pptShowToast('未配置PPT分析模型，请先在模型配置中设置默认模型', 'error');
    return;
  }

  if (!pptPromptConfig) {
    pptShowToast('未配置PPT分析提示词，请先在提示词管理中设置', 'warning');
    // 提示词不是必须的，可以继续
  }

  const docId = pptCurrentDocument.id;

  const confirmMsg = `确定要使用以下配置分析文档 "${pptCurrentDocument.name}" 吗？\n\n` +
    `📄 文档：${pptCurrentDocument.extracted_count} 页\n` +
    `🤖 模型：${pptModelConfig.name} (${pptModelConfig.model_name})\n` +
    `📝 提示词：${pptPromptConfig ? pptPromptConfig.name : '默认'}\n` +
    `💡 如需修改配置，请点击"取消"后前往模型配置或提示词管理页面`;

  if (!window.confirm(confirmMsg)) {
    return;
  }

  // 显示进度
  document.getElementById('ppt-progress').style.display = 'block';
  document.getElementById('ppt-batch-result').style.display = 'none';
  document.getElementById('ppt-start-btn').disabled = true;

  // 初始化进度显示
  const progressBar = document.querySelector('#ppt-progress .progress-fill');
  const progressText = document.querySelector('#ppt-progress .progress-text');
  progressBar.style.width = '0%';
  progressText.textContent = '0%';

  try {
    console.log('🚀 开始批量分析:', { 
      docId, 
      model: pptModelConfig.model_name,
      prompt: pptPromptConfig?.code 
    });

    // 使用EventSource接收实时进度
    // ✅ 传递实际的模型标识符（model_name），如 gpt-4o
    const eventSource = new EventSource(`${PPT_API_BASE}/analyze/${docId}?modelName=${encodeURIComponent(pptModelConfig.model_name || 'gpt-4o')}`);
    
    let results = {
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📦 收到进度更新:', data);

        if (data.type === 'start') {
          console.log('▶️ 分析开始:', data.message);
          pptShowToast(data.message, 'info');
        } 
        else if (data.type === 'progress') {
          // 更新进度条
          const progress = data.progress || 0;
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `${progress}% (${data.current}/${data.total})`;
          
          console.log(`📊 进度: ${progress}% (${data.current}/${data.total}) - ${data.slideId}`);
        } 
        else if (data.type === 'complete') {
          console.log('✅ 分析完成!');
          
          // 获取最终结果
          if (data.results) {
            results = data.results;
          }
          
          // 显示结果
          document.getElementById('ppt-result-total').textContent = results.total || 0;
          document.getElementById('ppt-result-success').textContent = results.success || 0;
          document.getElementById('ppt-result-failed').textContent = results.failed || 0;
          document.getElementById('ppt-result-skipped').textContent = results.skipped || 0;
          
          document.getElementById('ppt-progress').style.display = 'none';
          document.getElementById('ppt-batch-result').style.display = 'block';
          
          pptShowToast(`✅ 分析完成！成功: ${results.success}, 失败: ${results.failed}`, 'success');
          
          // 关闭EventSource
          eventSource.close();
          
          // 自动切换到"分析结果"标签并刷新数据
          setTimeout(() => {
            switchPptTab('results');
          }, 1000);
        } 
        else if (data.type === 'error') {
          console.error('❌ 分析失败:', data.message);
          pptShowToast('分析失败: ' + data.message, 'error');
          document.getElementById('ppt-progress').style.display = 'none';
          eventSource.close();
        }
      } catch (err) {
        console.error('❌ 解析进度数据失败:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('❌ EventSource错误:', error);
      pptShowToast('网络连接中断，请重试', 'error');
      document.getElementById('ppt-progress').style.display = 'none';
      eventSource.close();
      document.getElementById('ppt-start-btn').disabled = false;
    };

  } catch (error) {
    console.error('❌ 批量分析失败:', error);
    pptShowToast('启动分析失败: ' + error.message, 'error');
    document.getElementById('ppt-progress').style.display = 'none';
    document.getElementById('ppt-start-btn').disabled = false;
  }
}

// ==================== 分析结果 ====================

// 刷新分析结果（全量：不传 documentId 则加载所有文档的分析结果）
async function refreshPptResults() {
  try {
    console.log('📡 加载分析结果（全量）...');
    const url = pptCurrentDocument
      ? `${PPT_API_BASE}/results/${pptCurrentDocument.id}`
      : `${PPT_API_BASE}/results`;
    const response = await fetch(url);
    const result = await response.json();
    console.log('📦 分析结果响应:', result);

    if (result.success && result.results && result.results.length > 0) {
      pptAnalysisResults = result.results;
      console.log('✅ 加载了', pptAnalysisResults.length, '条分析结果');
      // 按文档加载缩略图（多文档时按 documentId 分别请求）
      const docIds = [...new Set(pptAnalysisResults.map(r => r.documentId).filter(Boolean))];
      for (const docId of docIds) {
        const hasThumbnails = pptAnalysisResults.some(r => r.documentId === docId && r.thumbnailUrl);
        if (!hasThumbnails) await loadPptThumbnails(docId);
      }
      renderPptResults();
      updatePptResultsSummary();
      document.getElementById('ppt-results-empty').style.display = 'none';
      document.getElementById('ppt-results-table').style.display = 'block';
    } else {
      pptAnalysisResults = [];
      console.log('⚠️ 暂无分析结果');
      document.getElementById('ppt-results-empty').style.display = 'block';
      document.getElementById('ppt-results-table').style.display = 'none';
      document.getElementById('ppt-results-summary').textContent = '';
      document.getElementById('ppt-batch-approve-btn').style.display = 'none';
      document.getElementById('ppt-batch-reject-btn').style.display = 'none';
    }
  } catch (error) {
    console.error('❌ 加载分析结果失败:', error);
    pptShowToast('加载失败: ' + error.message, 'error');
  }
}

// 更新分析结果汇总（待审核数、已通过数等）
function updatePptResultsSummary() {
  const pending = pptAnalysisResults.filter(r => (r.reviewStatus || r.review_status) === 'pending').length;
  const approved = pptAnalysisResults.filter(r => (r.reviewStatus || r.review_status) === 'approved').length;
  const rejected = pptAnalysisResults.filter(r => (r.reviewStatus || r.review_status) === 'rejected').length;
  const el = document.getElementById('ppt-results-summary');
  if (el) el.textContent = `共 ${pptAnalysisResults.length} 条 · 待审核 ${pending} · 已通过 ${approved} · 已拒绝 ${rejected}`;
  const showBatch = pending > 0;
  document.getElementById('ppt-batch-approve-btn').style.display = showBatch ? 'inline-block' : 'none';
  document.getElementById('ppt-batch-reject-btn').style.display = showBatch ? 'inline-block' : 'none';
}

// 渲染分析结果（含 PPT 名称、审核状态、批量勾选、审核操作）
function renderPptResults() {
  const tbody = document.getElementById('ppt-results-tbody');
  const docIdForThumb = pptCurrentDocument ? pptCurrentDocument.id : null;

  tbody.innerHTML = pptAnalysisResults.map(result => {
    const slideIndex = result.slideIndex !== undefined ? result.slideIndex : result.slide_index;
    const slideId = result.slideId || result.slide_id;
    const documentId = result.documentId || result.document_id || docIdForThumb;
    const documentName = result.documentName || result.document_name || (pptCurrentDocument && pptCurrentDocument.name) || '未命名';
    const categoryName = result.categoryName || result.category_name || '-';
    const categoryCode = result.categoryCode || result.category_code || '-';
    const confidence = ((result.confidence || 0) * 100).toFixed(0);
    const analyzedAt = result.analyzedAt || result.analyzed_at;
    const analyzedTime = analyzedAt ? new Date(analyzedAt).toLocaleString('zh-CN') : '-';
    const reviewStatus = result.reviewStatus || result.review_status || 'pending';
    const statusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[reviewStatus] || reviewStatus;
    const statusClass = { pending: 'review-pending', approved: 'review-approved', rejected: 'review-rejected' }[reviewStatus] || '';
    const isPending = reviewStatus === 'pending';
    const thumbnailId = result.thumbnailId || result.thumbnail_id || '';

    let thumbnailUrl = result.thumbnailUrl || (documentId ? getThumbnailUrl(documentId, slideId) : null);
    if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
      thumbnailUrl = `${THUMBNAIL_SERVER_BASE}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
    }
    const thumbnailDisplay = thumbnailUrl
      ? `<img src="${thumbnailUrl}" class="thumbnail-img" alt="缩略图" onclick="viewThumbnail('${thumbnailUrl}', ${slideIndex + 1})" title="点击查看大图">`
      : '<span class="text-muted">无缩略图</span>';

    const checkbox = isPending
      ? `<input type="checkbox" class="ppt-result-cb" data-thumbnail-id="${thumbnailId}" data-doc-id="${documentId}" data-slide-id="${slideId}">`
      : '<input type="checkbox" disabled>';
    const reanalyzeArg = documentId ? `'${slideId}', ${slideIndex + 1}, '${documentId}'` : `'${slideId}', ${slideIndex + 1}`;
    const actions = isPending
      ? `<button class="btn btn-sm btn-success" onclick="singleReviewPpt('${thumbnailId}', 'approve')" title="通过">通过</button>
         <button class="btn btn-sm btn-danger" onclick="singleReviewPpt('${thumbnailId}', 'reject')" title="拒绝">拒绝</button>
         <button class="btn btn-sm btn-warning" onclick="openModifyApproveModal('${thumbnailId}', '${slideId}', ${slideIndex + 1}, '${documentId}', '${(documentName || '').toString().replace(/'/g, "\\'")}', '${categoryCode}', '${(categoryName || '').toString().replace(/'/g, "\\'")}')" title="修改分类后通过">修改后通过</button>
         <button class="btn btn-sm btn-secondary" onclick="reanalyzeSingleSlide(${reanalyzeArg})" title="纠偏分类">🔄 纠偏</button>`
      : `<button class="btn btn-sm btn-secondary" onclick="reanalyzeSingleSlide(${reanalyzeArg})" title="纠偏分类">🔄 纠偏</button>`;

    return `
      <tr>
        <td>${checkbox}</td>
        <td><span class="doc-name-cell">${documentName}</span></td>
        <td>${slideIndex + 1}</td>
        <td class="thumbnail-cell">${thumbnailDisplay}</td>
        <td class="code">${slideId}</td>
        <td><strong>${categoryName}</strong></td>
        <td class="code">${categoryCode}</td>
        <td>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${confidence}%"></div>
            <span class="confidence-text">${confidence}%</span>
          </div>
        </td>
        <td><span class="review-status-badge ${statusClass}">${statusText}</span></td>
        <td>${analyzedTime}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

// 全选/反选（仅勾选待审核项）
function togglePptResultsSelectAll() {
  const all = document.getElementById('ppt-results-select-all');
  const checkboxes = document.querySelectorAll('.ppt-result-cb');
  checkboxes.forEach(cb => { cb.checked = all ? all.checked : false; });
}

// 单条审核：通过 / 拒绝
async function singleReviewPpt(thumbnailId, action) {
  try {
    const response = await fetch(`${PPT_API_BASE}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnailId, action })
    });
    const result = await response.json();
    if (result.success) {
      pptShowToast(action === 'approve' ? '已通过' : '已拒绝', 'success');
      refreshPptResults();
    } else {
      pptShowToast(result.message || '操作失败', 'error');
    }
  } catch (error) {
    pptShowToast('网络错误: ' + error.message, 'error');
  }
}

// 打开「修改后通过」弹窗（选新分类后调用审核接口）
function openModifyApproveModal(thumbnailId, slideId, slideIndex, documentId, documentName, currentCategoryCode, currentCategoryName) {
  const doc = pptCurrentDocument || { id: documentId, name: documentName };
  const currentResult = pptAnalysisResults.find(r => (r.slideId || r.slide_id) === slideId && (r.documentId || r.document_id) === documentId);
  let thumbnailUrl = currentResult && (currentResult.thumbnailUrl || getThumbnailUrl(documentId, slideId));
  if (thumbnailUrl && !thumbnailUrl.startsWith('http')) thumbnailUrl = `${THUMBNAIL_SERVER_BASE}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
  if (!pptCategories || pptCategories.length === 0) loadPptCategories().then(() => showModifyApproveModal(thumbnailId, slideIndex, thumbnailUrl, currentCategoryCode, currentCategoryName));
  else showModifyApproveModal(thumbnailId, slideIndex, thumbnailUrl, currentCategoryCode, currentCategoryName);
}

function showModifyApproveModal(thumbnailId, slideIndex, thumbnailUrl, currentCategoryCode, currentCategoryName) {
  const categoryOptions = [];
  if (pptCategories && pptCategories.length > 0) {
    pptCategories.forEach(level1 => {
      categoryOptions.push({ code: level1.code, name: level1.name, level: 1 });
      if (level1.children && level1.children.length > 0) {
        level1.children.forEach(level2 => {
          categoryOptions.push({ code: level2.code, name: `${level1.name} > ${level2.name}`, level: 2 });
        });
      }
    });
  }
  const categorySelectOptions = categoryOptions.map(cat =>
    `<option value="${cat.code}" ${cat.code === currentCategoryCode ? 'selected' : ''}>${cat.name}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'ppt-modify-approve-modal';
  modal.className = 'ppt-modal-overlay';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
  const modalContent = document.createElement('div');
  modalContent.style.cssText = 'background:white;border-radius:8px;padding:24px;max-width:600px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);';
  modalContent.innerHTML = `
    <h2 style="margin:0 0 16px 0;font-size:18px;">修改后通过 - 第 ${slideIndex} 页</h2>
    ${thumbnailUrl ? `<div style="text-align:center;margin-bottom:16px;"><img src="${thumbnailUrl}" style="max-width:100%;max-height:300px;border-radius:4px;" alt="缩略图"></div>` : ''}
    <div style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:8px;font-weight:500;">当前分类：</label>
      <div style="padding:8px 12px;background:#f5f5f5;border-radius:4px;">${currentCategoryName} (${currentCategoryCode})</div>
    </div>
    <div style="margin-bottom:20px;">
      <label style="display:block;margin-bottom:8px;font-weight:500;">选择新分类：</label>
      <select id="ppt-modify-category-select" class="form-control" style="width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:4px;">${categorySelectOptions}</select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button id="ppt-modify-cancel" class="btn btn-secondary">取消</button>
      <button id="ppt-modify-submit" class="btn btn-primary">确定（修改后通过）</button>
    </div>
  `;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  document.getElementById('ppt-modify-cancel').onclick = () => modal.remove();
  document.getElementById('ppt-modify-submit').onclick = async () => {
    const categoryCode = document.getElementById('ppt-modify-category-select').value;
    if (!categoryCode) { pptShowToast('请选择分类', 'error'); return; }
    document.getElementById('ppt-modify-submit').disabled = true;
    try {
      const response = await fetch(`${PPT_API_BASE}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailId, action: 'modify_approve', categoryCode })
      });
      const result = await response.json();
      if (result.success) {
        pptShowToast('已修改并通过', 'success');
        modal.remove();
        refreshPptResults();
      } else {
        pptShowToast(result.message || '操作失败', 'error');
        document.getElementById('ppt-modify-submit').disabled = false;
      }
    } catch (error) {
      pptShowToast('网络错误: ' + error.message, 'error');
      document.getElementById('ppt-modify-submit').disabled = false;
    }
  };
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// 批量审核
async function batchReviewPptResults(action) {
  const checkboxes = document.querySelectorAll('.ppt-result-cb:checked');
  const thumbnailIds = [...checkboxes].map(cb => cb.getAttribute('data-thumbnail-id')).filter(Boolean);
  if (thumbnailIds.length === 0) {
    pptShowToast('请先勾选待审核项', 'warning');
    return;
  }
  if (!confirm(`确定要批量${action === 'approve' ? '通过' : '拒绝'}选中的 ${thumbnailIds.length} 条记录吗？`)) return;
  try {
    const response = await fetch(`${PPT_API_BASE}/review/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thumbnailIds, action })
    });
    const result = await response.json();
    if (result.success) {
      pptShowToast(`已批量${action === 'approve' ? '通过' : '拒绝'} ${result.count} 条`, 'success');
      refreshPptResults();
    } else {
      pptShowToast(result.message || '操作失败', 'error');
    }
  } catch (error) {
    pptShowToast('网络错误: ' + error.message, 'error');
  }
}

// 获取缩略图URL（多文档时按 documentId_slideId 缓存）
function getThumbnailUrl(documentId, slideId) {
  if (!documentId || !slideId) return null;
  const key = `${documentId}_${slideId}`;
  if (pptThumbnailCache && pptThumbnailCache[key]) {
    let url = pptThumbnailCache[key];
    if (url && !url.startsWith('http')) {
      url = `${THUMBNAIL_SERVER_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
    }
    return url;
  }
  return null;
}

// 缩略图缓存 key: documentId_slideId
let pptThumbnailCache = {};

// 加载指定文档的缩略图（合并到缓存，不清空其他文档）
async function loadPptThumbnails(documentId) {
  try {
    const response = await fetch(`${THUMBNAIL_SERVER_BASE}/api/thumbnails/document/${documentId}`);
    const result = await response.json();
    if (result.success && result.data && result.data.thumbnails) {
      result.data.thumbnails.forEach(thumb => {
        pptThumbnailCache[`${documentId}_${thumb.slideId}`] = thumb.url;
      });
      console.log('✅ 加载了文档', documentId, '的', result.data.thumbnails.length, '个缩略图');
    }
  } catch (error) {
    console.error('❌ 加载缩略图失败:', error);
  }
}

// 查看缩略图大图
function viewThumbnail(url, slideIndex) {
  // 创建模态框显示大图
  const modal = document.createElement('div');
  modal.className = 'thumbnail-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    cursor: pointer;
  `;
  
  const img = document.createElement('img');
  img.src = url;
  img.style.cssText = `
    max-width: 90%;
    max-height: 90%;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  `;
  img.alt = `第 ${slideIndex} 页`;
  
  modal.appendChild(img);
  document.body.appendChild(modal);
  
  // 点击关闭
  modal.onclick = () => {
    document.body.removeChild(modal);
  };
}

// 手动纠偏单个页面（人为调整分类）。documentId 可选，全量结果页时必传以定位文档
async function reanalyzeSingleSlide(slideId, slideIndex, documentId) {
  const docId = documentId || (pptCurrentDocument && pptCurrentDocument.id);
  if (!docId) {
    pptShowToast('无法定位文档', 'error');
    return;
  }
  const currentDoc = pptCurrentDocument && pptCurrentDocument.id === docId
    ? pptCurrentDocument
    : { id: docId, name: (pptAnalysisResults.find(r => (r.documentId || r.document_id) === docId) || {}).documentName || '未命名' };

  const currentResult = pptAnalysisResults.find(r =>
    (r.slideId || r.slide_id) === slideId && (r.documentId || r.document_id) === docId
  );
  if (!currentResult) {
    pptShowToast('未找到该页面的分析结果', 'error');
    return;
  }

  let thumbnailUrl = currentResult.thumbnailUrl || getThumbnailUrl(docId, slideId);
  if (thumbnailUrl && !thumbnailUrl.startsWith('http')) {
    thumbnailUrl = `${THUMBNAIL_SERVER_BASE}${thumbnailUrl.startsWith('/') ? '' : '/'}${thumbnailUrl}`;
  }
  const currentCategoryCode = currentResult.categoryCode || currentResult.category_code || '';
  const currentCategoryName = currentResult.categoryName || currentResult.category_name || '未知分类';

  if (!pptCategories || pptCategories.length === 0) await loadPptCategories();
  const categoryOptions = [];
  if (pptCategories && pptCategories.length > 0) {
    pptCategories.forEach(level1 => {
      categoryOptions.push({ code: level1.code, name: level1.name, level: 1 });
      if (level1.children && level1.children.length > 0) {
        level1.children.forEach(level2 => {
          categoryOptions.push({
            code: level2.code,
            name: `${level1.name} > ${level2.name}`,
            level: 2
          });
        });
      }
    });
  }

  showCorrectCategoryModal({
    slideId,
    slideIndex,
    thumbnailUrl,
    currentCategoryCode,
    currentCategoryName,
    categoryOptions,
    documentId: docId,
    documentName: currentDoc.name
  });
}

// 显示纠偏分类对话框
function showCorrectCategoryModal({ slideId, slideIndex, thumbnailUrl, currentCategoryCode, currentCategoryName, categoryOptions, documentId, documentName }) {
  const docId = documentId || (pptCurrentDocument && pptCurrentDocument.id);
  // 创建模态框
  const modal = document.createElement('div');
  modal.id = 'ppt-correct-modal';
  modal.className = 'ppt-modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const modalContent = document.createElement('div');
  modalContent.className = 'ppt-modal-content';
  modalContent.style.cssText = `
    background: white;
    border-radius: 8px;
    padding: 24px;
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  `;
  
  // 构建分类选择下拉框
  const categorySelectOptions = categoryOptions.map(cat => 
    `<option value="${cat.code}" ${cat.code === currentCategoryCode ? 'selected' : ''}>${cat.name}</option>`
  ).join('');
  
  modalContent.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #333;">🔄 纠偏分类 - 第 ${slideIndex} 页</h2>
      
      ${thumbnailUrl ? `
        <div style="text-align: center; margin-bottom: 16px;">
          <img src="${thumbnailUrl}" style="max-width: 100%; max-height: 300px; border-radius: 4px; border: 1px solid #ddd;" alt="缩略图">
        </div>
      ` : ''}
      
      <div style="margin-bottom: 16px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #666;">当前分类：</label>
        <div style="padding: 8px 12px; background: #f5f5f5; border-radius: 4px; color: #333;">
          <strong>${currentCategoryName}</strong> <span style="color: #999; font-size: 12px;">(${currentCategoryCode})</span>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #666;">选择新分类：</label>
        <select id="ppt-correct-category-select" class="form-control" style="width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          ${categorySelectOptions}
        </select>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="ppt-correct-cancel-btn" class="btn btn-secondary" style="padding: 8px 16px;">取消</button>
        <button id="ppt-correct-submit-btn" class="btn btn-primary" style="padding: 8px 16px;">确定纠偏</button>
      </div>
    </div>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // 绑定事件
  document.getElementById('ppt-correct-cancel-btn').onclick = () => {
    document.body.removeChild(modal);
  };
  
  document.getElementById('ppt-correct-submit-btn').onclick = async () => {
    const selectedCategoryCode = document.getElementById('ppt-correct-category-select').value;
    
    if (!selectedCategoryCode) {
      pptShowToast('请选择分类', 'error');
      return;
    }
    
    if (selectedCategoryCode === currentCategoryCode) {
      pptShowToast('分类未改变，无需纠偏', 'info');
      document.body.removeChild(modal);
      return;
    }
    
    const selectedCategory = categoryOptions.find(cat => cat.code === selectedCategoryCode);
    const selectedCategoryName = selectedCategory ? selectedCategory.name : '未知分类';
    
    // 提交纠偏
    document.getElementById('ppt-correct-submit-btn').disabled = true;
    document.getElementById('ppt-correct-submit-btn').textContent = '提交中...';
    
    try {
      const response = await fetch(`${PPT_API_BASE}/correct-single`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: docId,
          slideId: slideId,
          categoryCode: selectedCategoryCode
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        pptShowToast(`✅ 纠偏成功！新分类：${result.result.categoryName}`, 'success');
        document.body.removeChild(modal);
        
        // 刷新分析结果
        setTimeout(() => {
          refreshPptResults();
        }, 500);
      } else {
        pptShowToast('纠偏失败: ' + (result.message || '未知错误'), 'error');
        document.getElementById('ppt-correct-submit-btn').disabled = false;
        document.getElementById('ppt-correct-submit-btn').textContent = '确定纠偏';
      }
    } catch (error) {
      console.error('❌ 纠偏失败:', error);
      pptShowToast('网络错误: ' + error.message, 'error');
      document.getElementById('ppt-correct-submit-btn').disabled = false;
      document.getElementById('ppt-correct-submit-btn').textContent = '确定纠偏';
    }
  };
  
  // 点击背景关闭
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}

// ==================== 统计报表 ====================

// 刷新统计数据
async function refreshPptStatistics() {
  if (!pptCurrentDocument) {
    pptShowToast('请先选择文档', 'error');
    return;
  }

  try {
    console.log('📡 加载统计数据...');

    const response = await fetch(`${PPT_API_BASE}/statistics/${pptCurrentDocument.id}`);
    const result = await response.json();
    
    console.log('📦 统计数据响应:', result);

    if (result.success && result.summary) {
      pptStatistics = {
        summary: result.summary,
        categoryStats: result.categoryStats || []
      };
      console.log('✅ 加载统计数据成功');
      renderPptStatistics();
      document.getElementById('ppt-stats-empty').style.display = 'none';
      document.getElementById('ppt-stats-content').style.display = 'block';
    } else {
      console.log('⚠️ 暂无统计数据');
      document.getElementById('ppt-stats-empty').style.display = 'block';
      document.getElementById('ppt-stats-content').style.display = 'none';
    }
  } catch (error) {
    console.error('❌ 加载统计数据失败:', error);
    pptShowToast('加载失败: ' + error.message, 'error');
  }
}

// 渲染统计数据
function renderPptStatistics() {
  const stats = pptStatistics;

  // 概览数据 - 兼容两种命名方式
  document.getElementById('ppt-stat-total').textContent = 
    stats.summary.totalSlides || stats.summary.total_slides || 0;
  document.getElementById('ppt-stat-analyzed').textContent = 
    stats.summary.analyzedSlides || stats.summary.analyzed_slides || 0;
  document.getElementById('ppt-stat-unanalyzed').textContent = 
    stats.summary.unanalyzedSlides || stats.summary.unanalyzed_slides || 0;
  
  const avgConfidence = stats.summary.avgConfidence || stats.summary.avg_confidence || 0;
  document.getElementById('ppt-stat-confidence').textContent = 
    (avgConfidence * 100).toFixed(1) + '%';

  // 分类分布
  const categoryStatsDiv = document.getElementById('ppt-category-stats');
  const categoryStats = stats.categoryStats || stats.category_stats || [];

  if (categoryStats.length === 0) {
    categoryStatsDiv.innerHTML = '<div class="empty-state"><p>暂无分类统计数据</p></div>';
    return;
  }

  categoryStatsDiv.innerHTML = categoryStats.map(cat => {
    const categoryName = cat.categoryName || cat.category_name || '-';
    const categoryCode = cat.categoryCode || cat.category_code || '-';
    const count = cat.count || 0;
    const percentage = cat.percentage || 0;
    const avgConfidence = ((cat.avgConfidence || cat.avg_confidence || 0) * 100).toFixed(1);

    return `
      <div class="category-item">
        <div class="category-header">
          <span class="category-name">${categoryName}</span>
          <span class="category-count">${count} 页 (${percentage}%)</span>
        </div>
        <div class="category-bar">
          <div class="category-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="category-footer">
          <span class="category-code">${categoryCode}</span>
          <span class="category-confidence">平均置信度: ${avgConfidence}%</span>
        </div>
      </div>
    `;
  }).join('');
}

// ==================== 分类标准 ====================

// 加载分类标准
async function loadPptCategories() {
  try {
    console.log('📡 加载分类标准...');

    document.getElementById('ppt-categories-loading').style.display = 'block';
    document.getElementById('ppt-categories-content').style.display = 'none';

    const response = await fetch(`${PPT_API_BASE}/categories`);
    
    // 先检查HTTP状态
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ HTTP错误:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('📦 API响应:', result);

    if (result.success && result.categories) {
      pptCategories = result.categories;
      console.log('✅ 加载了', pptCategories.length, '个分类');
      renderPptCategories();
      document.getElementById('ppt-categories-loading').style.display = 'none';
      document.getElementById('ppt-categories-content').style.display = 'block';
    } else {
      console.error('❌ API返回失败:', result);
      pptShowToast('加载分类标准失败: ' + (result.message || result.error || '未知错误'), 'error');
      document.getElementById('ppt-categories-loading').innerHTML = 
        '<div class="empty-state"><p>❌ 加载失败: ' + (result.message || result.error || '未知错误') + '</p></div>';
    }
  } catch (error) {
    console.error('❌ 加载分类标准失败:', error);
    pptShowToast('加载失败: ' + error.message, 'error');
    document.getElementById('ppt-categories-loading').innerHTML = 
      '<div class="empty-state"><p>❌ 加载失败: ' + error.message + '</p><button onclick="loadPptCategories()" class="btn btn-primary">🔄 重试</button></div>';
  }
}

// 渲染分类标准
function renderPptCategories() {
  const contentDiv = document.getElementById('ppt-categories-content');

  contentDiv.innerHTML = pptCategories.map(cat => {
    const children = cat.children || [];
    
    return `
      <div class="category-level1">
        <div class="category-header-l1">
          <h3>${cat.name}</h3>
          <span class="category-code">${cat.code}</span>
        </div>
        <p class="category-desc">${cat.description || ''}</p>
        
        ${children.length > 0 ? `
          <div class="category-children">
            ${children.map(child => `
              <div class="category-level2">
                <div class="category-header-l2">
                  <h4>${child.name}</h4>
                  <span class="category-code">${child.code}</span>
                </div>
                <p class="category-desc">${child.description || ''}</p>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// ==================== Toast提示 ====================

function pptShowToast(message, type = 'info') {
  // 移除已有的 toast
  const existingToast = document.querySelector('.ppt-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建新 toast
  const toast = document.createElement('div');
  toast.className = `ppt-toast ppt-toast-${type}`;
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

console.log('✅ PPT分析页面JS已加载');

