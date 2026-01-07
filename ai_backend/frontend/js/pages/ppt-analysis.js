/**
 * PPT AI 内容分析页面
 * 完整的JavaScript实现
 */

const PPT_API_BASE = 'http://localhost:3000/api/ppt-analysis';
const ADMIN_API_BASE = 'http://localhost:3000/api/admin';
let pptCurrentDocument = null;
let pptDocuments = [];
let pptAnalysisResults = [];
let pptStatistics = null;
let pptCategories = [];
let pptModelConfig = null;  // 当前场景的模型配置
let pptPromptConfig = null; // 当前场景的提示词配置

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
  if (tabName === 'results' && pptCurrentDocument) {
    refreshPptResults();
  } else if (tabName === 'statistics' && pptCurrentDocument) {
    refreshPptStatistics();
  }
}

// ==================== 批量分析 ====================

// 加载文档列表
async function loadPptDocuments() {
  try {
    console.log('📡 加载文档列表...');
    
    // 调用文档管理API获取已提取文本的文档
    const response = await fetch('http://localhost:3000/api/documents/list?page=1&pageSize=100');
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

// 刷新分析结果
async function refreshPptResults() {
  if (!pptCurrentDocument) {
    pptShowToast('请先选择文档', 'error');
    return;
  }

  try {
    console.log('📡 加载分析结果...');

    const response = await fetch(`${PPT_API_BASE}/results/${pptCurrentDocument.id}`);
    const result = await response.json();
    
    console.log('📦 分析结果响应:', result);

    if (result.success && result.results && result.results.length > 0) {
      pptAnalysisResults = result.results;
      console.log('✅ 加载了', pptAnalysisResults.length, '条分析结果');
      renderPptResults();
      document.getElementById('ppt-results-empty').style.display = 'none';
      document.getElementById('ppt-results-table').style.display = 'block';
    } else {
      console.log('⚠️ 暂无分析结果');
      document.getElementById('ppt-results-empty').style.display = 'block';
      document.getElementById('ppt-results-table').style.display = 'none';
    }
  } catch (error) {
    console.error('❌ 加载分析结果失败:', error);
    pptShowToast('加载失败: ' + error.message, 'error');
  }
}

// 渲染分析结果
function renderPptResults() {
  const tbody = document.getElementById('ppt-results-tbody');
  
  tbody.innerHTML = pptAnalysisResults.map(result => {
    // 使用正确的字段名(根据后端API返回的数据结构)
    const slideIndex = result.slideIndex !== undefined ? result.slideIndex : result.slide_index;
    const slideId = result.slideId || result.slide_id;
    const categoryName = result.categoryName || result.category_name || '-';
    const categoryCode = result.categoryCode || result.category_code || '-';
    const confidence = ((result.confidence || 0) * 100).toFixed(0);
    const analyzedAt = result.analyzedAt || result.analyzed_at;
    const analyzedTime = analyzedAt ? new Date(analyzedAt).toLocaleString('zh-CN') : '-';

    return `
      <tr>
        <td>${slideIndex + 1}</td>
        <td class="code">${slideId}</td>
        <td><strong>${categoryName}</strong></td>
        <td class="code">${categoryCode}</td>
        <td>
          <div class="confidence-bar">
            <div class="confidence-fill" style="width: ${confidence}%"></div>
            <span class="confidence-text">${confidence}%</span>
          </div>
        </td>
        <td>${analyzedTime}</td>
      </tr>
    `;
  }).join('');
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

