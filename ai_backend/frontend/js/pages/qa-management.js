/**
 * 问答对管理页面
 */

const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api';

// 状态管理
let qaState = {
  currentPage: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  filters: {
    transcriptionName: '',
    classificationStatus: '',
    category: '',
    intent: '',
    questionSource: '',
    reviewStatus: '' // 审核状态：pending | approved | rejected
  },
  selectedIds: new Set(),
  allSelected: false,
  // 分类映射表（用于显示中文名称）
  categoryMap: new Map(), // code -> {name, description}
  intentMap: new Map(),   // code -> {name, description}
  categoriesFullList: null, // 完整分类列表（用于重新分类下拉）
  currentDetailQA: null    // 当前查看详情的问答对（用于重新分类后刷新）
};

// 先声明全局函数占位符，确保onclick可以调用
// 使用标志位防止递归调用
let _qaFunctionsInitialized = false;

window.startBatchClassification = function() {
  console.log('[批量分类] onclick触发');
  if (!_qaFunctionsInitialized) {
    console.warn('[批量分类] 函数尚未初始化，等待初始化...');
    // 等待初始化完成
    const checkInterval = setInterval(() => {
      if (_qaFunctionsInitialized && window.startBatchClassification) {
        clearInterval(checkInterval);
        console.log('[批量分类] 函数已初始化，重新调用');
        window.startBatchClassification();
      }
    }, 50);
    // 最多等待2秒
    setTimeout(() => {
      clearInterval(checkInterval);
      if (!_qaFunctionsInitialized) {
        alert('批量分类功能正在加载，请稍后再试');
      }
    }, 2000);
    return;
  }
  // 如果已初始化，调用实际函数
  if (window._startBatchClassificationImpl) {
    window._startBatchClassificationImpl();
  } else {
    console.error('[批量分类] 实现函数不存在');
    alert('批量分类功能未正确加载，请刷新页面');
  }
};

window.selectAllQAs = function() {
  console.log('[全选] onclick触发');
  if (!_qaFunctionsInitialized) {
    console.warn('[全选] 函数尚未初始化，等待初始化...');
    const checkInterval = setInterval(() => {
      if (_qaFunctionsInitialized && window.selectAllQAs) {
        clearInterval(checkInterval);
        window.selectAllQAs();
      }
    }, 50);
    setTimeout(() => clearInterval(checkInterval), 2000);
    return;
  }
  if (window._selectAllQAsImpl) {
    window._selectAllQAsImpl();
  }
};

window.classifyAllQAs = function() {
  console.log('[全部处理] onclick触发');
  if (!_qaFunctionsInitialized) {
    console.warn('[全部处理] 函数尚未初始化，等待初始化...');
    const checkInterval = setInterval(() => {
      if (_qaFunctionsInitialized && window.classifyAllQAs) {
        clearInterval(checkInterval);
        window.classifyAllQAs();
      }
    }, 50);
    setTimeout(() => clearInterval(checkInterval), 2000);
    return;
  }
  if (window._classifyAllQAsImpl) {
    window._classifyAllQAsImpl();
  }
};

// 页面初始化
(async function() {
  console.log('🏷️ 问答对管理页面初始化...');
  
  try {
    await initQAManagement();
    
    // 确保函数在全局作用域（覆盖占位符）
    // 保存实现函数
    window._selectAllQAsImpl = selectAllQAs;
    window._classifyAllQAsImpl = classifyAllQAs;
    window._startBatchClassificationImpl = startBatchClassification;
    
    // 覆盖占位符函数
    window.selectAllQAs = selectAllQAs;
    window.classifyAllQAs = classifyAllQAs;
    window.startBatchClassification = startBatchClassification;
  window.confirmBatchClassification = confirmBatchClassification;
  window.closeClassificationSettings = closeClassificationSettings;
  window.closeClassificationOverlay = closeClassificationOverlay;
  window.closeQADetail = closeQADetail;
  window.classifySingleQA = classifySingleQA;
  window.viewQADetail = viewQADetail;
  window.showReclassifyPanel = showReclassifyPanel;
  window.hideReclassifyPanel = hideReclassifyPanel;
  window.saveReclassify = saveReclassify;
    window.toggleSelectAll = toggleSelectAll;
    window.toggleSelectQA = toggleSelectQA;
  window.applyFilters = applyFilters;
  window.resetFilters = resetFilters;
  window.changePage = changePage;
  window.changePageSize = changePageSize;
  window.exportQAList = exportQAList;
  window.openQAReview = openQAReview;
  window.closeQAReview = closeQAReview;
  window.submitQAReview = submitQAReview;
  window.batchApprove = batchApprove;
  window.batchReject = batchReject;
    
    // 标记初始化完成
    _qaFunctionsInitialized = true;
    
    console.log('[问答对管理] 所有函数已注册到全局作用域');
    console.log('[问答对管理] 初始化完成，函数可用:', {
      startBatchClassification: typeof window.startBatchClassification,
      selectAllQAs: typeof window.selectAllQAs,
      classifyAllQAs: typeof window.classifyAllQAs
    });
  } catch (error) {
    console.error('[问答对管理] 初始化失败:', error);
    _qaFunctionsInitialized = true; // 即使失败也标记为已初始化，避免无限等待
  }
})();

/**
 * 初始化
 */
async function initQAManagement() {
  // 加载分类数据（同时用于映射表和筛选框）
  const categoriesData = await initCategoryMaps();
  
  // 使用已加载的数据填充筛选框（避免重复请求）
  if (categoriesData) {
    loadCategoryOptionsFromData(categoriesData);
  } else {
    // 如果加载失败，尝试单独加载
    await loadCategoryOptions();
  }
  
  // 加载问答对列表
  await loadQAList();
  
  // 绑定事件
  bindEvents();
}

/**
 * 初始化分类映射表（同时返回数据供筛选框使用）
 * @returns {Promise<Array|null>} 分类数据数组，失败时返回null
 */
async function initCategoryMaps() {
  try {
    console.log('[分类映射] 开始加载分类数据...');
    const response = await fetch(`${API_BASE}/qa/categories`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('获取分类数据失败');
    }
    
    // 构建映射表并保存完整列表（供重新分类下拉使用）
    qaState.categoriesFullList = result.data;
    result.data.forEach(cat => {
      if (cat.level === 2) {
        // 分类类别（level=2）
        qaState.categoryMap.set(cat.code, {
          name: cat.name,
          description: cat.description || ''
        });
      } else if (cat.level === 3) {
        // 问题性质（level=3）
        qaState.intentMap.set(cat.code, {
          name: cat.name,
          description: cat.description || ''
        });
      }
    });
    
    console.log(`[分类映射] 加载完成: 类别=${qaState.categoryMap.size}个, 性质=${qaState.intentMap.size}个`);
    
    // 返回数据供筛选框使用
    return result.data;
    
  } catch (error) {
    console.error('[分类映射] 加载失败:', error);
    // 失败时使用空映射表，不影响主流程
    return null;
  }
}

/**
 * 获取 intent_code 的中文名称
 */
function getIntentName(intentCode) {
  if (!intentCode) return '';
  const intent = qaState.intentMap.get(intentCode);
  return intent ? intent.name : intentCode; // 找不到时返回原始代码
}

/**
 * 获取 category_code 的中文名称
 */
function getCategoryName(categoryCode) {
  if (!categoryCode) return '';
  const category = qaState.categoryMap.get(categoryCode);
  return category ? category.name : categoryCode; // 找不到时返回原始代码
}

/**
 * 绑定事件
 */
function bindEvents() {
  console.log('[问答对管理] 绑定事件');
  
  // 筛选输入框回车事件
  const filterInput = document.getElementById('qa-filter-transcription-name');
  if (filterInput) {
    filterInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        applyFilters();
      }
    });
  }
  
  // 批量分类按钮事件（确保绑定）
  const batchClassifyBtn = document.getElementById('qa-batch-classify-btn');
  const selectAllBtn = document.getElementById('qa-select-all-btn');
  const classifyAllBtn = document.getElementById('qa-classify-all-btn');
  
  console.log('[问答对管理] 查找按钮:', { 
    batchClassifyBtn: !!batchClassifyBtn, 
    selectAllBtn: !!selectAllBtn, 
    classifyAllBtn: !!classifyAllBtn 
  });
  
  // 批量分类选中项按钮 - 保留onclick，同时添加事件监听器
  if (batchClassifyBtn) {
    // 不移除onclick，作为备用
    batchClassifyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[批量分类] 按钮点击事件触发（通过事件监听器）');
      // 优先使用全局函数
      if (window.startBatchClassification && typeof window.startBatchClassification === 'function') {
        console.log('[批量分类] 调用全局函数');
        window.startBatchClassification();
      } else if (typeof startBatchClassification === 'function') {
        console.log('[批量分类] 调用局部函数');
        startBatchClassification();
      } else {
        console.error('[批量分类] startBatchClassification函数未定义');
        console.error('[批量分类] window.startBatchClassification:', window.startBatchClassification);
        alert('批量分类功能未加载，请刷新页面重试');
      }
    });
    console.log('[问答对管理] 批量分类按钮事件已绑定');
  } else {
    console.warn('[问答对管理] 找不到批量分类按钮元素');
  }
  
  // 全选按钮
  if (selectAllBtn) {
    selectAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[全选] 按钮点击事件触发');
      if (typeof selectAllQAs === 'function') {
        selectAllQAs();
      } else if (window.selectAllQAs && typeof window.selectAllQAs === 'function') {
        window.selectAllQAs();
      }
    });
    console.log('[问答对管理] 全选按钮事件已绑定');
  }
  
  // 处理全部按钮
  if (classifyAllBtn) {
    classifyAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('[全部处理] 按钮点击事件触发');
      if (typeof classifyAllQAs === 'function') {
        classifyAllQAs();
      } else if (window.classifyAllQAs && typeof window.classifyAllQAs === 'function') {
        window.classifyAllQAs();
      }
    });
    console.log('[问答对管理] 处理全部按钮事件已绑定');
  }
  
  // 延迟查找（如果DOM还没加载完）
  if (!batchClassifyBtn || !selectAllBtn || !classifyAllBtn) {
    console.warn('[问答对管理] 部分按钮未找到，尝试延迟查找...');
    setTimeout(() => {
      const btn1 = document.getElementById('qa-batch-classify-btn');
      const btn2 = document.getElementById('qa-select-all-btn');
      const btn3 = document.getElementById('qa-classify-all-btn');
      
      if (btn1 && !batchClassifyBtn) {
        btn1.addEventListener('click', () => {
          if (window.startBatchClassification) window.startBatchClassification();
        });
        console.log('[问答对管理] 批量分类按钮事件已绑定（延迟）');
      }
      if (btn2 && !selectAllBtn) {
        btn2.addEventListener('click', () => {
          if (window.selectAllQAs) window.selectAllQAs();
        });
        console.log('[问答对管理] 全选按钮事件已绑定（延迟）');
      }
      if (btn3 && !classifyAllBtn) {
        btn3.addEventListener('click', () => {
          if (window.classifyAllQAs) window.classifyAllQAs();
        });
        console.log('[问答对管理] 处理全部按钮事件已绑定（延迟）');
      }
    }, 500);
  }
}

/**
 * 从已加载的数据填充分类选项（避免重复请求）
 * @param {Array} categoriesData - 分类数据数组
 */
function loadCategoryOptionsFromData(categoriesData) {
  try {
    const categorySelect = document.getElementById('qa-filter-category');
    if (!categorySelect) return;
    
    // 筛选出 level=2 的分类类别（用于筛选框）
    const categoryOptions = categoriesData
      .filter(cat => cat.level === 2) // 只显示分类类别
      .sort((a, b) => {
        // 按代码排序（确保 1.1, 1.2, 2.1, 2.2 这样的顺序）
        const codeA = a.code.split('.').map(Number);
        const codeB = b.code.split('.').map(Number);
        for (let i = 0; i < Math.max(codeA.length, codeB.length); i++) {
          const numA = codeA[i] || 0;
          const numB = codeB[i] || 0;
          if (numA !== numB) {
            return numA - numB;
          }
        }
        return 0;
      });
    
    console.log(`[分类选项] 填充了 ${categoryOptions.length} 个分类类别`);
    
    // 清空现有选项（保留"全部"选项）
    categorySelect.innerHTML = '<option value="">全部</option>';
    
    // 添加分类选项
    categoryOptions.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.code;
      option.textContent = `${cat.code} ${cat.name}`;
      categorySelect.appendChild(option);
    });
    
    console.log('[分类选项] 分类类别选项已更新');
    
  } catch (error) {
    console.error('[分类选项] 填充失败:', error);
    // 失败时显示错误提示
    const categorySelect = document.getElementById('qa-filter-category');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">加载失败，请刷新页面</option>';
    }
  }
}

/**
 * 加载分类选项（从API获取，作为备用方案）
 */
async function loadCategoryOptions() {
  try {
    const categorySelect = document.getElementById('qa-filter-category');
    if (!categorySelect) return;
    
    console.log('[分类选项] 开始从API加载分类类别...');
    
    // 从API获取分类数据
    const response = await fetch(`${API_BASE}/qa/categories`);
    
    if (!response.ok) {
      throw new Error(`HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error('获取分类数据失败');
    }
    
    // 使用统一的数据填充函数
    loadCategoryOptionsFromData(result.data);
    
  } catch (error) {
    console.error('[分类选项] 加载失败:', error);
    // 失败时显示错误提示，但不影响主流程
    const categorySelect = document.getElementById('qa-filter-category');
    if (categorySelect) {
      categorySelect.innerHTML = '<option value="">加载失败，请刷新页面</option>';
    }
  }
}

/**
 * 加载问答对列表
 */
async function loadQAList() {
  const tbody = document.getElementById('qa-list-tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '<tr><td colspan="10" class="loading">加载中...</td></tr>';
  
  try {
    // 构建查询参数
    const params = new URLSearchParams({
      page: qaState.currentPage,
      pageSize: qaState.pageSize
    });
    
    if (qaState.filters.transcriptionName) {
      params.append('transcriptionName', qaState.filters.transcriptionName);
    }
    if (qaState.filters.classificationStatus) {
      params.append('classificationStatus', qaState.filters.classificationStatus);
    }
    if (qaState.filters.category) {
      params.append('category', qaState.filters.category);
    }
    if (qaState.filters.intent) {
      params.append('intent', qaState.filters.intent);
    }
    if (qaState.filters.questionSource) {
      params.append('questionSource', qaState.filters.questionSource);
    }
    if (qaState.filters.reviewStatus) {
      params.append('reviewStatus', qaState.filters.reviewStatus);
    }
    
    const response = await fetch(`${API_BASE}/qa/concerns?${params.toString()}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '加载失败');
    }
    
    const { list, total, page, pageSize, totalPages } = result.data;
    
    // 更新状态
    qaState.total = total;
    qaState.totalPages = totalPages;
    qaState.currentPage = page;
    qaState.pageSize = pageSize;
    qaState.list = list; // 保存列表数据，供详情查看使用
    
    // 渲染列表
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="11" style="text-align: center; padding: 40px; color: #999;">暂无问答对数据</td></tr>';
      document.getElementById('qa-pagination').style.display = 'none';
      return;
    }
    
    tbody.innerHTML = list.map((qa, index) => {
      const rowIndex = (qaState.currentPage - 1) * qaState.pageSize + index + 1;
      const isSelected = qaState.selectedIds.has(qa.id);
      
      // 分类信息
      const categoryInfo = qa.concern_categories ? 
        `<span class="classification-badge badge-category" title="${escapeHtml(qa.concern_categories.code || '')} - ${escapeHtml(qa.concern_categories.description || '')}">${escapeHtml(qa.concern_categories.code || '')} ${escapeHtml(qa.concern_categories.name || '')}</span>` : 
        (qa.category ? `<span class="classification-badge badge-category" title="${escapeHtml(qa.category)}">${escapeHtml(getCategoryName(qa.category))}</span>` : 
        '<span class="classification-badge badge-unclassified">未分类</span>');
      
      // 问题性质 - 显示中文名称，tooltip显示代码和描述
      const intentInfo = qa.intent_code ? 
        `<span class="classification-badge badge-intent" title="${escapeHtml(qa.intent_code)} - ${escapeHtml(qaState.intentMap.get(qa.intent_code)?.description || '')}">${escapeHtml(getIntentName(qa.intent_code))}</span>` : 
        '<span class="classification-badge badge-unclassified">未分类</span>';
      
      // 时间范围
      const timeRange = qa.time_range1 || qa.time_range || '-';
      const timeRangeDisplay = timeRange.replace(/[\[\]]/g, '');
      
      // 创建时间
      const createdAt = qa.createdAt ? new Date(qa.createdAt).toLocaleString('zh-CN') : '-';
      
      // 审核状态
      const reviewStatus = qa.review_status || 'pending';
      const reviewStatusText = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[reviewStatus] || reviewStatus;
      const reviewBadge = `<span class="classification-badge badge-review-${reviewStatus}">${escapeHtml(reviewStatusText)}</span>`;
      
      // 问题/回答截断
      const questionText = qa.question ? (qa.question.length > 50 ? qa.question.substring(0, 50) + '...' : qa.question) : '-';
      const answerText = qa.answer ? (qa.answer.length > 50 ? qa.answer.substring(0, 50) + '...' : qa.answer) : '-';
      
      return `
        <tr class="qa-pair-row ${isSelected ? 'selected' : ''}" data-qa-id="${qa.id}">
          <td>
            <input type="checkbox" class="qa-select-checkbox" data-qa-id="${qa.id}" 
                   ${isSelected ? 'checked' : ''} 
                   onchange="toggleSelectQA('${qa.id}')">
          </td>
          <td>${rowIndex}</td>
          <td title="${escapeHtml(qa.question || '')}">${escapeHtml(questionText)}</td>
          <td title="${escapeHtml(qa.answer || '')}">${escapeHtml(answerText)}</td>
          <td>${categoryInfo}</td>
          <td>${intentInfo}</td>
          <td title="${qa.transcription_id ? escapeHtml(qa.transcription_id) : ''}">${qa.transcription_name ? escapeHtml(qa.transcription_name) : '-'}</td>
          <td>${escapeHtml(timeRangeDisplay)}</td>
          <td>${reviewBadge}</td>
          <td>${escapeHtml(createdAt)}</td>
          <td>
            <button class="btn btn-sm btn-primary" onclick="openQAReview('${qa.id}')" title="审核">📋</button>
            <button class="btn btn-sm btn-primary" onclick="classifySingleQA('${qa.id}')" title="单独分类">🏷️</button>
            <button class="btn btn-sm btn-info" onclick="viewQADetail('${qa.id}')" title="查看详情">👁️</button>
          </td>
        </tr>
      `;
    }).join('');
    
    // 更新分页
    updatePagination();
    
  } catch (error) {
    console.error('加载问答对列表失败:', error);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: #f5222d;">加载失败: ${error.message}</td></tr>`;
    showToast('加载失败: ' + error.message, 'error');
  }
}

/**
 * 更新分页
 */
function updatePagination() {
  const pagination = document.getElementById('qa-pagination');
  if (!pagination) return;
  
  pagination.style.display = 'flex';
  
  // 更新分页信息
  document.getElementById('qa-pagination-info').textContent = 
    `共 ${qaState.total} 条，每页 ${qaState.pageSize} 条`;
  document.getElementById('qa-page-info').textContent = 
    `第 ${qaState.currentPage} 页 / 共 ${qaState.totalPages} 页`;
  
  // 更新按钮状态
  document.getElementById('qa-prev-btn').disabled = qaState.currentPage <= 1;
  document.getElementById('qa-next-btn').disabled = qaState.currentPage >= qaState.totalPages;
  
  // 更新每页数量
  const pageSizeSelect = document.getElementById('qa-page-size');
  if (pageSizeSelect) {
    pageSizeSelect.value = qaState.pageSize;
  }
}

/**
 * 切换页面
 */
function changePage(delta) {
  const newPage = qaState.currentPage + delta;
  if (newPage < 1 || newPage > qaState.totalPages) {
    return;
  }
  qaState.currentPage = newPage;
  loadQAList();
}

/**
 * 改变每页数量
 */
changePageSize = function() {
  const pageSizeSelect = document.getElementById('qa-page-size');
  if (pageSizeSelect) {
    qaState.pageSize = parseInt(pageSizeSelect.value);
    qaState.currentPage = 1; // 重置到第一页
    loadQAList();
  }
}

/**
 * 应用筛选
 */
applyFilters = function() {
  qaState.filters.transcriptionName = document.getElementById('qa-filter-transcription-name')?.value || '';
  qaState.filters.classificationStatus = document.getElementById('qa-filter-classification-status')?.value || '';
  qaState.filters.category = document.getElementById('qa-filter-category')?.value || '';
  qaState.filters.intent = document.getElementById('qa-filter-intent')?.value || '';
  qaState.filters.questionSource = document.getElementById('qa-filter-question-source')?.value || '';
  qaState.filters.reviewStatus = document.getElementById('qa-filter-review-status')?.value || '';
  qaState.currentPage = 1;
  qaState.selectedIds.clear();
  loadQAList();
}

/**
 * 重置筛选
 */
resetFilters = function() {
  document.getElementById('qa-filter-transcription-name').value = '';
  document.getElementById('qa-filter-classification-status').value = '';
  document.getElementById('qa-filter-category').value = '';
  document.getElementById('qa-filter-intent').value = '';
  document.getElementById('qa-filter-question-source').value = '';
  const reviewEl = document.getElementById('qa-filter-review-status');
  if (reviewEl) reviewEl.value = '';
  qaState.filters = {
    transcriptionName: '',
    classificationStatus: '',
    category: '',
    intent: '',
    questionSource: '',
    reviewStatus: ''
  };
  qaState.currentPage = 1;
  qaState.selectedIds.clear();
  loadQAList();
}

/**
 * 导出当前筛选条件下的问答对，格式可选 CSV 或 TXT（完整问题与解答）
 */
async function exportQAList() {
  const btn = document.getElementById('qa-export-btn');
  const formatSelect = document.getElementById('qa-export-format');
  const format = (formatSelect && formatSelect.value) || 'csv';
  if (btn) {
    btn.disabled = true;
    btn.textContent = '导出中...';
  }
  try {
    const params = new URLSearchParams();
    if (qaState.filters.transcriptionName) {
      params.append('transcriptionName', qaState.filters.transcriptionName);
    }
    if (qaState.filters.classificationStatus) {
      params.append('classificationStatus', qaState.filters.classificationStatus);
    }
    if (qaState.filters.category) {
      params.append('category', qaState.filters.category);
    }
    if (qaState.filters.intent) {
      params.append('intent', qaState.filters.intent);
    }
    if (qaState.filters.questionSource) {
      params.append('questionSource', qaState.filters.questionSource);
    }
    if (qaState.filters.reviewStatus) {
      params.append('reviewStatus', qaState.filters.reviewStatus);
    }
    const response = await fetch(`${API_BASE}/qa/concerns/export?${params.toString()}`);
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || '导出失败');
    }
    const list = result.data?.list || [];
    if (list.length === 0) {
      showToast('当前筛选条件下没有数据可导出', 'warning');
      return;
    }
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-');
    if (format === 'txt') {
      const lines = [];
      list.forEach((qa, index) => {
        const categoryName = qa.concern_categories ? (qa.concern_categories.code + ' ' + (qa.concern_categories.name || '')) : (qa.category || '');
        const intentName = getIntentName(qa.intent_code) || qa.intent_code || '';
        const timeRange = (qa.time_range1 || qa.time_range || '').replace(/[\[\]]/g, '');
        const createdAt = qa.createdAt ? new Date(qa.createdAt).toLocaleString('zh-CN') : '';
        lines.push('======== 问答对 ' + (index + 1) + ' ========');
        lines.push('问题：' + (qa.question || ''));
        lines.push('回答：' + (qa.answer || ''));
        lines.push('分类类别：' + categoryName);
        lines.push('问题性质：' + intentName);
        lines.push('音频名称：' + (qa.transcription_name || ''));
        lines.push('时间范围：' + timeRange);
        lines.push('创建时间：' + createdAt);
        lines.push('');
      });
      const txtContent = '\uFEFF' + lines.join('\r\n');
      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `问答对导出_${timestamp}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const escapeCsv = (v) => {
        const s = (v == null ? '' : String(v)).replace(/\r/g, ' ').replace(/\n/g, ' ');
        if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
        return s;
      };
      const rows = [
        ['序号', '问题', '回答', '分类类别', '问题性质', '音频名称', '时间范围', '创建时间'].map(escapeCsv).join(',')
      ];
      list.forEach((qa, index) => {
        const categoryName = qa.concern_categories ? (qa.concern_categories.code + ' ' + (qa.concern_categories.name || '')) : (qa.category || '');
        const intentName = getIntentName(qa.intent_code) || qa.intent_code || '';
        const timeRange = (qa.time_range1 || qa.time_range || '').replace(/[\[\]]/g, '');
        const createdAt = qa.createdAt ? new Date(qa.createdAt).toLocaleString('zh-CN') : '';
        rows.push([
          index + 1,
          qa.question || '',
          qa.answer || '',
          categoryName,
          intentName,
          qa.transcription_name || '',
          timeRange,
          createdAt
        ].map(escapeCsv).join(','));
      });
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `问答对导出_${timestamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    showToast(`已导出 ${list.length} 条问答对（${format.toUpperCase()}）`, 'success');
  } catch (error) {
    console.error('导出问答对失败:', error);
    showToast('导出失败: ' + (error.message || '未知错误'), 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span class="icon">📥</span> 导出';
    }
  }
}

/**
 * 全选/取消全选
 */
toggleSelectAll = function() {
  const selectAllCheckbox = document.getElementById('qa-select-all');
  const checkboxes = document.querySelectorAll('.qa-select-checkbox');
  
  qaState.allSelected = selectAllCheckbox.checked;
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = qaState.allSelected;
    const qaId = checkbox.dataset.qaId;
    if (qaState.allSelected) {
      qaState.selectedIds.add(qaId);
    } else {
      qaState.selectedIds.delete(qaId);
    }
  });
  
  // 更新行样式
  document.querySelectorAll('.qa-pair-row').forEach(row => {
    if (qaState.allSelected) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  });
}

/**
 * 切换单个问答对选择
 */
toggleSelectQA = function(qaId) {
  if (qaState.selectedIds.has(qaId)) {
    qaState.selectedIds.delete(qaId);
  } else {
    qaState.selectedIds.add(qaId);
  }
  
  // 更新行样式
  const row = document.querySelector(`.qa-pair-row[data-qa-id="${qaId}"]`);
  if (row) {
    if (qaState.selectedIds.has(qaId)) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  }
  
  // 更新全选状态
  const selectAllCheckbox = document.getElementById('qa-select-all');
  const checkboxes = document.querySelectorAll('.qa-select-checkbox');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  selectAllCheckbox.checked = checkedCount === checkboxes.length && checkboxes.length > 0;
}

/**
 * 全选当前页的问答对
 */
const selectAllQAs = function() {
  console.log('[全选] 全选当前页');
  const checkboxes = document.querySelectorAll('.qa-select-checkbox');
  const selectAllCheckbox = document.getElementById('qa-select-all');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    const qaId = checkbox.dataset.qaId;
    qaState.selectedIds.add(qaId);
  });
  
  if (selectAllCheckbox) {
    selectAllCheckbox.checked = true;
  }
  
  // 更新行样式
  document.querySelectorAll('.qa-pair-row').forEach(row => {
    row.classList.add('selected');
  });
  
  const selectedCount = qaState.selectedIds.size;
  showToast(`已全选当前页，共 ${selectedCount} 个问答对`, 'success');
  console.log(`[全选] 已选择 ${selectedCount} 个问答对`);
}

/**
 * 处理全部问答对（分批处理）
 */
const classifyAllQAs = async function() {
  console.log('[全部处理] 开始处理全部问答对');
  
  if (qaState.total === 0) {
    showToast('当前没有问答对数据', 'warning');
    return;
  }
  
  if (!window.confirm(`确定要处理全部 ${qaState.total} 个问答对吗？\n将自动分批处理，每批50个。`)) {
    return;
  }
  
  // 获取所有问答对的ID（需要分页获取）
  const allIds = [];
  let currentPage = 1;
  let hasMore = true;
  
  showToast('正在获取所有问答对ID...', 'info');
  
  while (hasMore) {
    try {
      const params = new URLSearchParams({
        page: currentPage,
        pageSize: 100  // 每页获取100个，减少请求次数
      });
      
      // 应用当前筛选条件
      if (qaState.filters.transcriptionName) {
        params.append('transcriptionName', qaState.filters.transcriptionName);
      }
      if (qaState.filters.classificationStatus) {
        params.append('classificationStatus', qaState.filters.classificationStatus);
      }
      if (qaState.filters.category) {
        params.append('category', qaState.filters.category);
      }
      if (qaState.filters.intent) {
        params.append('intent', qaState.filters.intent);
      }
      
      const response = await fetch(`${API_BASE}/qa/concerns?${params.toString()}`);
      const result = await response.json();
      
      if (!result.success || !result.data || !result.data.list) {
        throw new Error(result.error || '获取问答对列表失败');
      }
      
      const { list, totalPages } = result.data;
      list.forEach(qa => allIds.push(qa.id));
      
      if (currentPage >= totalPages) {
        hasMore = false;
      } else {
        currentPage++;
      }
    } catch (error) {
      console.error('[全部处理] 获取问答对ID失败:', error);
      showToast('获取问答对列表失败: ' + error.message, 'error');
      return;
    }
  }
  
  console.log(`[全部处理] 共获取 ${allIds.length} 个问答对ID`);
  showToast(`共找到 ${allIds.length} 个问答对，开始分批处理...`, 'info');
  
  // 打开设置对话框，然后开始处理
  await showClassificationSettings();
  
  // 等待用户确认后，使用所有ID进行分批处理
  // 这里需要修改confirmBatchClassification来支持传入ID列表
  // 暂时先直接调用performBatchClassification
  const settings = {
    modelId: '',
    promptCode: '',
    concurrency: 3,
    batchSize: 50  // 每批50个
  };
  
  // 直接开始处理（不等待用户确认，因为已经确认过了）
  closeClassificationSettings();
  await performBatchClassification(allIds, settings);
}

/**
 * 开始批量分类（处理选中的问答对）
 */
const startBatchClassification = function() {
  console.log('[批量分类] 点击批量分类按钮');
  console.log('[批量分类] 当前选中的问答对数量:', qaState.selectedIds.size);
  console.log('[批量分类] 选中的ID列表:', Array.from(qaState.selectedIds));
  
  if (qaState.selectedIds.size === 0) {
    console.warn('[批量分类] 没有选中的问答对');
    showToast('请先选择要分类的问答对', 'warning');
    return;
  }
  
  // 确认分类
  if (!window.confirm(`确定要对选中的 ${qaState.selectedIds.size} 个问答对进行分类吗？\n将使用系统默认的模型和提示词配置。`)) {
    return;
  }
  
  console.log('[批量分类] 直接开始分类，使用默认配置');
  
  // 直接开始分类，使用默认配置
  const concernIds = Array.from(qaState.selectedIds);
  const settings = {
    modelId: '', // 使用默认模型（scene_type=qa_classification）
    promptCode: 'qa_classification', // 使用您创建的提示词模板
    concurrency: 3,
    batchSize: 50
  };
  
  performBatchClassification(concernIds, settings);
}

/**
 * 显示分类设置对话框
 */
const showClassificationSettings = async function() {
  console.log('[批量分类] 显示分类设置对话框');
  const modal = document.getElementById('qa-classification-settings-modal');
  if (!modal) {
    console.error('[批量分类] 找不到分类设置对话框元素');
    showToast('找不到分类设置对话框', 'error');
    return;
  }
  
  console.log('[批量分类] 找到对话框元素，开始加载模型和提示词列表');
  
  // 加载模型列表
  try {
    const modelsResponse = await fetch(`${API_BASE}/admin/models?scene_type=qa_classification`);
    const modelsResult = await modelsResponse.json();
    const modelSelect = document.getElementById('qa-classification-model');
    if (modelSelect && modelsResult.success && modelsResult.data) {
      modelSelect.innerHTML = '<option value="">使用默认模型</option>';
      modelsResult.data.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = `${model.name}${model.is_default ? ' (默认)' : ''}`;
        modelSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('加载模型列表失败:', error);
  }
  
  // 加载提示词列表
  try {
    const promptsResponse = await fetch(`${API_BASE}/admin/prompts?scene_type=qa_classification&is_active=true`);
    const promptsResult = await promptsResponse.json();
    const promptSelect = document.getElementById('qa-classification-prompt');
    if (promptSelect && promptsResult.success && promptsResult.data) {
      promptSelect.innerHTML = '<option value="">使用默认提示词</option>';
      promptsResult.data.forEach(prompt => {
        const option = document.createElement('option');
        option.value = prompt.code;
        option.textContent = `${prompt.name}${prompt.version ? ` (v${prompt.version})` : ''}`;
        promptSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error('[批量分类] 加载提示词列表失败:', error);
  }
  
  console.log('[批量分类] 显示对话框');
  // 设置display和添加show类
  modal.style.display = 'flex';
  modal.classList.add('show');
  console.log('[批量分类] 对话框已显示, classes:', modal.className);
}

/**
 * 关闭分类设置对话框
 */
closeClassificationSettings = function() {
  const modal = document.getElementById('qa-classification-settings-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * 确认批量分类
 */
confirmBatchClassification = async function() {
  const modelSelect = document.getElementById('qa-classification-model');
  const promptSelect = document.getElementById('qa-classification-prompt');
  const concurrencyInput = document.getElementById('qa-classification-concurrency');
  
  const settings = {
    modelId: modelSelect?.value || '',
    promptCode: promptSelect?.value || '',
    concurrency: parseInt(concurrencyInput?.value) || 3,
    batchSize: 50  // 每批50个
  };
  
  closeClassificationSettings();
  
  // 获取要处理的ID列表
  const concernIds = Array.from(qaState.selectedIds);
  
  if (concernIds.length === 0) {
    showToast('请先选择要分类的问答对', 'warning');
    return;
  }
  
  console.log(`[批量分类] 确认分类: ${concernIds.length} 个问答对`);
  
  // 开始分类
  await performBatchClassification(concernIds, settings);
}

/**
 * 执行批量分类（后端自动分批处理）
 */
async function performBatchClassification(concernIds, settings) {
  const overlay = document.getElementById('qa-classification-overlay');
  const body = document.getElementById('qa-classification-body');
  
  if (!overlay || !body) return;
  
  const total = concernIds.length;
  const batchSize = settings.batchSize || 50;  // 每批50个（后端自动处理）
  
  console.log(`[批量分类] 开始处理: 总数=${total}, 后端每批=${batchSize}`);
  
  body.innerHTML = `
    <div class="ai-correction-loading">
      <div class="ai-correction-spinner"></div>
      <p>正在对 ${total} 个问答对进行分类...</p>
      <p style="font-size: 12px; color: #999;">${total > batchSize ? `后端将自动分 ${Math.ceil(total / batchSize)} 批处理，每批 ${batchSize} 个` : '这可能需要一些时间'}</p>
      <p id="qa-classification-progress" style="font-size: 11px; color: #999; margin-top: 10px;">正在处理...</p>
    </div>
  `;
  
  overlay.style.display = 'flex';
  
  try {
    // 构建请求参数
    const requestBody = {
      concernIds: concernIds,  // 一次性发送所有ID，后端自动分批处理
      batchSize: batchSize      // 告诉后端每批处理多少个
    };
    
    // 添加可选参数
    if (settings.modelId) requestBody.modelId = settings.modelId;
    if (settings.promptCode) requestBody.promptCode = settings.promptCode;
    if (settings.concurrency) requestBody.concurrency = settings.concurrency;
    
    console.log(`[批量分类] 发送请求:`, {
      concernCount: concernIds.length,
      batchSize: batchSize,
      promptCode: settings.promptCode
    });
    
    // 一次性发送所有ID到后端
    const response = await fetch(`${API_BASE}/transcription/concerns/batch-classification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP错误: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || '批量分类失败');
    }
    
    const totalSuccess = result.data?.successCount || 0;
    const totalError = result.data?.errorCount || 0;
    
    console.log(`[批量分类] 完成: 成功 ${totalSuccess}, 失败 ${totalError}`);
    
    overlay.style.display = 'none';
    
    showToast(`分类完成：成功 ${totalSuccess}/${total} 个${totalError > 0 ? `，失败 ${totalError} 个` : ''}`, 'success');
    
    // 清空选择
    qaState.selectedIds.clear();
    const selectAllCheckbox = document.getElementById('qa-select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
    }
    
    // 重新加载列表
    await loadQAList();
    
  } catch (error) {
    console.error('[批量分类] 失败:', error);
    overlay.style.display = 'none';
    showToast('批量分类失败: ' + error.message, 'error');
  }
}

/**
 * 单独分类单个问答对
 */
classifySingleQA = async function(concernId) {
  if (!window.confirm('确定要对这个问答对进行分类吗？\n将使用系统默认的模型和提示词配置。')) {
    return;
  }
  
  await performBatchClassification([concernId], {
    modelId: '', // 使用默认模型
    promptCode: 'qa_classification', // 使用您创建的提示词模板
    concurrency: 1,
    batchSize: 50
  });
}

/**
 * 查看问答对详情
 */
viewQADetail = async function(concernId) {
  const modal = document.getElementById('qa-detail-modal');
  const body = document.getElementById('qa-detail-body');
  
  if (!modal || !body) return;
  
  // 显示加载状态
  body.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">加载中...</div>';
  modal.style.display = 'flex';
  
  try {
    // 从当前列表中查找数据（避免额外请求）
    let qaData = qaState.list ? qaState.list.find(qa => qa.id === concernId) : null;
    
    console.log('[详情] 查找数据:', concernId, qaData);
    console.log('[详情] 转录ID:', qaData?.transcription_id);
    console.log('[详情] speaker_roles:', qaData?.transcription_speaker_roles);
    
    // 如果列表中没有，则从服务器获取
    if (!qaData) {
      const response = await fetch(`${API_BASE}/qa/concerns/${concernId}`);
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || '获取详情失败');
      }
      
      qaData = result.data;
      console.log('[详情] 从服务器获取:', qaData);
    }
    
    qaState.currentDetailQA = qaData;
    renderQADetail(qaData);
    
  } catch (error) {
    console.error('加载问答对详情失败:', error);
    body.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ff4d4f;">
        <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
        <div style="font-size: 16px;">${escapeHtml(error.message || '加载失败')}</div>
        <button onclick="closeQADetail()" class="btn btn-secondary" style="margin-top: 20px;">关闭</button>
      </div>
    `;
  }
}

/**
 * 渲染问答对详情
 */
function renderQADetail(qa) {
  const body = document.getElementById('qa-detail-body');
  if (!body) return;
  
  console.log('[渲染详情] 开始渲染:', qa);
  console.log('[渲染详情] question_speaker:', qa.question_speaker);
  console.log('[渲染详情] answer_speaker:', qa.answer_speaker);
  console.log('[渲染详情] transcription_speaker_roles:', qa.transcription_speaker_roles);
  
  // 分类信息
  const categoryInfo = qa.concern_categories 
    ? `<span class="classification-badge badge-category">${escapeHtml(qa.concern_categories.code)} ${escapeHtml(qa.concern_categories.name)}</span>`
    : (qa.category 
      ? `<span class="classification-badge badge-category">${escapeHtml(getCategoryName(qa.category))}</span>` 
      : '<span class="classification-badge badge-unclassified">未分类</span>');
  
  const intentInfo = qa.intent_code 
    ? `<span class="classification-badge badge-intent">${escapeHtml(getIntentName(qa.intent_code))}</span>` 
    : '<span class="classification-badge badge-unclassified">未分类</span>';
  
  // 解析对话人角色
  let questionSpeakerRole = '';
  let answerSpeakerRole = '';
  
  console.log('[渲染详情] 开始解析角色...');
  
  if (qa.transcription_speaker_roles) {
    console.log('[渲染详情] 找到 transcription_speaker_roles');
    try {
      const roles = JSON.parse(qa.transcription_speaker_roles);
      console.log('[渲染详情] 解析后的 roles:', roles);
      
      if (qa.question_speaker && roles[qa.question_speaker]) {
        const role = roles[qa.question_speaker];
        questionSpeakerRole = role === 'customer' ? '客户方' : (role === 'our_side' ? '我方' : role);
        console.log('[渲染详情] questionSpeakerRole:', questionSpeakerRole);
      }
      
      if (qa.answer_speaker && roles[qa.answer_speaker]) {
        const role = roles[qa.answer_speaker];
        answerSpeakerRole = role === 'customer' ? '客户方' : (role === 'our_side' ? '我方' : role);
        console.log('[渲染详情] answerSpeakerRole:', answerSpeakerRole);
      }
    } catch (e) {
      console.warn('[渲染详情] 解析 speaker_roles 失败:', e);
    }
  } else {
    console.warn('[渲染详情] transcription_speaker_roles 为空');
  }
  
  // 时间格式化
  const createdAt = qa.createdAt ? new Date(qa.createdAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : '-';
  
  const updatedAt = qa.updatedAt ? new Date(qa.updatedAt).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) : '-';
  
  body.innerHTML = `
    <div style="background: #f5f5f5; border-radius: 4px; padding: 16px; margin-bottom: 20px;">
      <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px; font-size: 14px;">
        <div style="color: #666; font-weight: 500;">问答对ID：</div>
        <div style="font-family: monospace; font-size: 13px; color: #1890ff;">${escapeHtml(qa.id)}</div>
        
        <div style="color: #666; font-weight: 500;">音频名称：</div>
        <div>${qa.transcription_name ? escapeHtml(qa.transcription_name) : '-'}</div>
        
        <div style="color: #666; font-weight: 500;">时间范围：</div>
        <div>${qa.time_range1 || qa.time_range || '-'}</div>
        
        <div style="color: #666; font-weight: 500;">提问者：</div>
        <div>
          ${qa.question_speaker ? `<span style="font-family: monospace; color: #666;">${escapeHtml(qa.question_speaker)}</span>` : '-'}
          ${questionSpeakerRole ? `<span class="badge badge-${questionSpeakerRole === '客户方' ? 'primary' : 'success'}" style="margin-left: 8px;">${questionSpeakerRole}</span>` : ''}
        </div>
        
        <div style="color: #666; font-weight: 500;">回答者：</div>
        <div>
          ${qa.answer_speaker ? `<span style="font-family: monospace; color: #666;">${escapeHtml(qa.answer_speaker)}</span>` : '-'}
          ${answerSpeakerRole ? `<span class="badge badge-${answerSpeakerRole === '客户方' ? 'primary' : 'success'}" style="margin-left: 8px;">${answerSpeakerRole}</span>` : ''}
        </div>
        
        <div style="color: #666; font-weight: 500;">创建时间：</div>
        <div>${createdAt}</div>
        
        <div style="color: #666; font-weight: 500;">更新时间：</div>
        <div>${updatedAt}</div>
      </div>
    </div>
    
    <div style="margin-bottom: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #262626; display: flex; align-items: center;">
        <span style="margin-right: 8px;">❓</span> 问题内容
        ${questionSpeakerRole ? `<span class="badge badge-${questionSpeakerRole === '客户方' ? 'primary' : 'success'}" style="margin-left: 8px; font-size: 12px;">${questionSpeakerRole}提问</span>` : ''}
      </h4>
      <div style="background: #fff; border: 1px solid #d9d9d9; border-radius: 4px; padding: 16px; min-height: 60px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6;">
        ${escapeHtml(qa.question || '（无）')}
      </div>
    </div>
    
    <div style="margin-bottom: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #262626; display: flex; align-items: center;">
        <span style="margin-right: 8px;">💬</span> 回答内容
        ${answerSpeakerRole ? `<span class="badge badge-${answerSpeakerRole === '客户方' ? 'primary' : 'success'}" style="margin-left: 8px; font-size: 12px;">${answerSpeakerRole}回答</span>` : ''}
      </h4>
      <div style="background: #fff; border: 1px solid #d9d9d9; border-radius: 4px; padding: 16px; min-height: 60px; white-space: pre-wrap; word-wrap: break-word; line-height: 1.6;">
        ${escapeHtml(qa.answer || '（无）')}
      </div>
    </div>
    
    <div style="margin-bottom: 24px;">
      <h4 style="margin: 0 0 12px 0; font-size: 16px; color: #262626; display: flex; align-items: center;">
        <span style="margin-right: 8px;">🏷️</span> 分类信息
      </h4>
      <div style="background: #fafafa; border: 1px solid #e8e8e8; border-radius: 4px; padding: 16px;">
        <div style="display: grid; grid-template-columns: 100px 1fr; gap: 12px; font-size: 14px;">
          <div style="color: #666; font-weight: 500;">分类类别：</div>
          <div>${categoryInfo}</div>
          
          <div style="color: #666; font-weight: 500;">问题性质：</div>
          <div>${intentInfo}</div>
          
          <div style="color: #666; font-weight: 500;">优先级：</div>
          <div>${qa.priority ? `<span class="badge badge-${qa.priority === 'high' ? 'danger' : (qa.priority === 'medium' ? 'warning' : 'info')}">${qa.priority}</span>` : '-'}</div>
          
          <div style="color: #666; font-weight: 500;">状态：</div>
          <div>${qa.status ? `<span class="badge badge-${qa.status === 'answered' ? 'success' : 'secondary'}">${qa.status === 'answered' ? '已回答' : '待回答'}</span>` : '-'}</div>
        </div>
      </div>
    </div>
    
    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e8e8e8; display: flex; justify-content: flex-end; gap: 12px;">
      <button onclick="showReclassifyPanel()" class="btn btn-primary" style="padding: 8px 20px;">
        🏷️ 重新分类
      </button>
      <button onclick="closeQADetail()" class="btn btn-secondary" style="padding: 8px 20px;">
        关闭
      </button>
    </div>
  `;
}

/**
 * 关闭问答对详情弹窗
 */
closeQADetail = function() {
  hideReclassifyPanel();
  const modal = document.getElementById('qa-detail-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * 显示重新分类面板（手动纠偏：选择类型后保存，不调用AI）
 */
showReclassifyPanel = async function() {
  const qa = qaState.currentDetailQA;
  if (!qa) return;

  const body = document.getElementById('qa-detail-body');
  if (!body) return;

  let list = qaState.categoriesFullList;
  if (!list || list.length === 0) {
    const res = await fetch(`${API_BASE}/qa/categories`);
    const result = await res.json();
    if (result.success && result.data) {
      list = result.data;
      qaState.categoriesFullList = list;
    }
  }
  if (!list || list.length === 0) {
    showToast('无法加载分类列表，请刷新页面重试', 'error');
    return;
  }

  const categoryList = list.filter(c => c.level === 2).sort((a, b) => {
    const codeA = (a.code || '').split('.').map(Number);
    const codeB = (b.code || '').split('.').map(Number);
    for (let i = 0; i < Math.max(codeA.length, codeB.length); i++) {
      const n = (codeA[i] || 0) - (codeB[i] || 0);
      if (n !== 0) return n;
    }
    return 0;
  });
  const intentList = list.filter(c => c.level === 3).sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  const currentCategory = qa.concern_categories ? qa.concern_categories.code : (qa.category || '');
  const currentIntent = qa.intent_code || '';

  const categoryOptions = categoryList.map(c => `<option value="${escapeHtml(c.code)}" ${c.code === currentCategory ? 'selected' : ''}>${escapeHtml(c.code)} ${escapeHtml(c.name)}</option>`).join('');
  const intentOptions = intentList.map(c => `<option value="${escapeHtml(c.code)}" ${c.code === currentIntent ? 'selected' : ''}>${escapeHtml(c.code)} ${escapeHtml(c.name)}</option>`).join('');

  const existing = document.getElementById('qa-reclassify-panel');
  if (existing) {
    existing.remove();
  }

  const panel = document.createElement('div');
  panel.id = 'qa-reclassify-panel';
  panel.style.cssText = 'margin-top: 20px; padding: 20px; background: #fafafa; border: 1px solid #e8e8e8; border-radius: 8px;';
  panel.innerHTML = `
    <h4 style="margin: 0 0 16px 0; font-size: 16px; color: #262626;">✏️ 手动重新分类</h4>
    <p style="margin: 0 0 16px 0; font-size: 13px; color: #666;">选择分类类别和问题性质后点击保存，不调用AI。</p>
    <div style="display: grid; gap: 12px; margin-bottom: 16px;">
      <div>
        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">分类类别</label>
        <select id="qa-reclassify-category" class="form-control" style="width: 100%; max-width: 400px;">
          <option value="">-- 请选择或留空 --</option>
          ${categoryOptions}
        </select>
      </div>
      <div>
        <label style="display: block; margin-bottom: 4px; font-weight: 500; color: #333;">问题性质</label>
        <select id="qa-reclassify-intent" class="form-control" style="width: 100%; max-width: 400px;">
          <option value="">-- 请选择或留空 --</option>
          ${intentOptions}
        </select>
      </div>
    </div>
    <div style="display: flex; gap: 12px;">
      <button onclick="saveReclassify()" class="btn btn-primary" style="padding: 8px 20px;">保存</button>
      <button onclick="hideReclassifyPanel()" class="btn btn-secondary" style="padding: 8px 20px;">取消</button>
    </div>
  `;
  body.appendChild(panel);
}

/**
 * 隐藏重新分类面板
 */
hideReclassifyPanel = function() {
  const panel = document.getElementById('qa-reclassify-panel');
  if (panel) panel.remove();
}

/**
 * 保存手动重新分类
 */
saveReclassify = async function() {
  const qa = qaState.currentDetailQA;
  if (!qa) return;

  const categorySelect = document.getElementById('qa-reclassify-category');
  const intentSelect = document.getElementById('qa-reclassify-intent');
  if (!categorySelect || !intentSelect) return;

  const categoryCode = (categorySelect.value != null ? categorySelect.value : '').trim();
  const intentCode = (intentSelect.value != null ? intentSelect.value : '').trim();
  if (!categoryCode && !intentCode) {
    showToast('请至少选择分类类别或问题性质之一', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/qa/concerns/${qa.id}/classification`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryCode: categoryCode || null,
        intentCode: intentCode || null
      })
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || '保存失败');
    }
    showToast('分类已更新', 'success');
    hideReclassifyPanel();
    const categoryVal = categoryCode || null;
    const intentVal = intentCode || null;
    qa.intent_code = intentVal;
    if (categoryVal) {
      const list = qaState.categoriesFullList || [];
      const cat = list.find(c => c.level === 2 && c.code === categoryVal);
      if (cat) {
        qa.concern_categories = { code: cat.code, name: cat.name, level: cat.level };
        qa.category = cat.code;
        qa.category_id = cat.id;
      }
    } else {
      qa.concern_categories = null;
      qa.category = null;
      qa.category_id = null;
    }
    renderQADetail(qa);
    // 若列表中有该项，同步更新列表行（下次刷新或翻页会一致）
    if (qaState.list) {
      const idx = qaState.list.findIndex(item => item.id === qa.id);
      if (idx >= 0) {
        qaState.list[idx] = { ...qaState.list[idx], ...qa };
      }
    }
  } catch (err) {
    console.error('保存重新分类失败:', err);
    showToast(err.message || '保存失败', 'error');
  }
}

/**
 * 关闭分类进度遮罩
 */
closeClassificationOverlay = function() {
  const overlay = document.getElementById('qa-classification-overlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

// ---------- 审核：打开审核弹窗、渲染上下文、提交审核、批量通过/拒绝 ----------
let qaReviewCurrentId = null;

/**
 * 打开审核弹窗，加载审核上下文（来源对话上3+本+下4）
 */
async function openQAReview(concernId) {
  const modal = document.getElementById('qa-review-modal');
  const body = document.getElementById('qa-review-body');
  if (!modal || !body) return;
  qaReviewCurrentId = concernId;
  body.innerHTML = '<div style="text-align: center; padding: 40px; color: #999;">加载中...</div>';
  modal.style.display = 'flex';
  try {
    const res = await fetch(`${API_BASE}/qa/concerns/${concernId}/review-context`);
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || '获取审核上下文失败');
    }
    renderQAReviewBody(result.data);
  } catch (err) {
    console.error('加载审核上下文失败:', err);
    body.innerHTML = `<div style="text-align: center; padding: 40px; color: #f5222d;">${escapeHtml(err.message || '加载失败')}</div><button class="btn btn-secondary" onclick="closeQAReview()" style="margin-top: 12px;">关闭</button>`;
  }
}

function closeQAReview() {
  qaReviewCurrentId = null;
  const modal = document.getElementById('qa-review-modal');
  if (modal) modal.style.display = 'none';
}

/**
 * 渲染审核弹窗内容：对话上下文（上3+本+下4）+ 问答对内容 + 通过/拒绝/修改后通过
 */
function renderQAReviewBody(data) {
  const body = document.getElementById('qa-review-body');
  if (!body) return;
  const concern = data.concern || {};
  const dialogueContext = data.dialogueContext || [];
  const transcriptionName = data.transcriptionName || '';

  const dialogueHtml = dialogueContext.map((d, i) => {
    const cls = d.isSource ? 'qa-review-dialogue-source' : '';
    const label = d.isSource ? ' [来源]' : '';
    return `
      <div class="${cls}" style="padding: 10px 12px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #e8e8e8;">
        <div style="font-size: 12px; color: #666; margin-bottom: 4px;">
          ${escapeHtml(d.timeRange || '')} · ${escapeHtml(d.speaker || '')}${label}
        </div>
        <div style="white-space: pre-wrap; word-break: break-word;">${escapeHtml(d.text || '')}</div>
      </div>
    `;
  }).join('');

  const reviewStatus = concern.review_status || 'pending';
  const canReview = reviewStatus === 'pending';
  const categoryLabel = concern.concern_categories ? `${concern.concern_categories.code} ${concern.concern_categories.name}` : (concern.category_code || '未分类');
  const intentLabel = concern.intent_code ? (qaState.intentMap.get(concern.intent_code)?.name || concern.intent_code) : '未分类';
  const currentCategory = concern.concern_categories ? concern.concern_categories.code : (concern.category_code || '');
  const currentIntent = concern.intent_code || '';

  const list = qaState.categoriesFullList || [];
  const categoryList = list.filter(c => c.level === 2).sort((a, b) => {
    const codeA = (a.code || '').split('.').map(Number);
    const codeB = (b.code || '').split('.').map(Number);
    for (let i = 0; i < Math.max(codeA.length, codeB.length); i++) {
      const n = (codeA[i] || 0) - (codeB[i] || 0);
      if (n !== 0) return n;
    }
    return 0;
  });
  const intentList = list.filter(c => c.level === 3).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const categoryOptions = categoryList.map(c => `<option value="${escapeHtml(c.code)}" ${c.code === currentCategory ? 'selected' : ''}>${escapeHtml(c.code)} ${escapeHtml(c.name)}</option>`).join('');
  const intentOptions = intentList.map(c => `<option value="${escapeHtml(c.code)}" ${c.code === currentIntent ? 'selected' : ''}>${escapeHtml(c.code)} ${escapeHtml(c.name)}</option>`).join('');

  body.innerHTML = `
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #262626;">📎 来源对话片段（上3条 · 本片段 · 下4条） · ${escapeHtml(transcriptionName)}</h4>
      <div style="max-height: 220px; overflow-y: auto; background: #fafafa; border-radius: 6px; padding: 12px;">
        ${dialogueHtml || '<div style="color: #999;">暂无对话上下文</div>'}
      </div>
    </div>
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #262626;">❓ 问题</h4>
      <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px; min-height: 50px;" id="qa-review-question-display">${escapeHtml(concern.question || '')}</div>
      <textarea id="qa-review-question-edit" style="display: none; width: 100%; min-height: 60px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px;" placeholder="修改后通过时在此编辑问题">${escapeHtml(concern.question || '')}</textarea>
    </div>
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #262626;">💬 回答</h4>
      <div style="background: #fff; border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px; min-height: 50px;" id="qa-review-answer-display">${escapeHtml(concern.answer || '')}</div>
      <textarea id="qa-review-answer-edit" style="display: none; width: 100%; min-height: 80px; padding: 10px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 14px;" placeholder="修改后通过时在此编辑回答">${escapeHtml(concern.answer || '')}</textarea>
    </div>
    <div style="margin-bottom: 20px;">
      <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #262626;">🏷️ 问题类型</h4>
      <div id="qa-review-type-display" style="background: #fafafa; border: 1px solid #e8e8e8; border-radius: 4px; padding: 12px; font-size: 13px;">
        分类类别：${escapeHtml(categoryLabel)} · 问题性质：${escapeHtml(intentLabel)}
        ${reviewStatus !== 'pending' ? ` · 审核状态：<span class="classification-badge badge-review-${reviewStatus}">${reviewStatus === 'approved' ? '已通过' : '已拒绝'}</span>` : ''}
      </div>
      <div id="qa-review-type-edit" style="display: none; gap: 10px;">
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">分类类别</label>
          <select id="qa-review-category-edit" class="form-control" style="width: 100%; max-width: 400px; padding: 8px;">
            <option value="">-- 请选择或留空 --</option>
            ${categoryOptions}
          </select>
        </div>
        <div>
          <label style="display: block; margin-bottom: 4px; font-weight: 500; font-size: 13px;">问题性质</label>
          <select id="qa-review-intent-edit" class="form-control" style="width: 100%; max-width: 400px; padding: 8px;">
            <option value="">-- 请选择或留空 --</option>
            ${intentOptions}
          </select>
        </div>
      </div>
    </div>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; padding-top: 16px; border-top: 1px solid #e8e8e8;">
      ${canReview ? `
        <button type="button" class="btn btn-success" onclick="submitQAReview('approve')">✅ 通过</button>
        <button type="button" class="btn btn-warning" onclick="submitQAReview('reject')">❌ 拒绝</button>
        <button type="button" class="btn btn-primary" id="qa-review-modify-btn" onclick="toggleQAReviewEdit(true)">✏️ 修改后通过</button>
        <div id="qa-review-modify-actions" style="display: none;">
          <button type="button" class="btn btn-primary" onclick="submitQAReview('modify_approve')">确认修改并通过</button>
          <button type="button" class="btn btn-secondary" onclick="toggleQAReviewEdit(false)">取消</button>
        </div>
      ` : ''}
      <button type="button" class="btn btn-secondary" onclick="closeQAReview()">关闭</button>
    </div>
  `;
}

function toggleQAReviewEdit(show) {
  const displayQ = document.getElementById('qa-review-question-display');
  const editQ = document.getElementById('qa-review-question-edit');
  const displayA = document.getElementById('qa-review-answer-display');
  const editA = document.getElementById('qa-review-answer-edit');
  const typeDisplay = document.getElementById('qa-review-type-display');
  const typeEdit = document.getElementById('qa-review-type-edit');
  const modifyBtn = document.getElementById('qa-review-modify-btn');
  const actions = document.getElementById('qa-review-modify-actions');
  if (!editQ || !editA) return;
  if (show) {
    if (displayQ) displayQ.style.display = 'none';
    if (displayA) displayA.style.display = 'none';
    editQ.style.display = 'block';
    editA.style.display = 'block';
    if (typeDisplay) typeDisplay.style.display = 'none';
    if (typeEdit) { typeEdit.style.display = 'grid'; }
    if (modifyBtn) modifyBtn.style.display = 'none';
    if (actions) actions.style.display = 'inline-flex';
  } else {
    if (displayQ) displayQ.style.display = 'block';
    if (displayA) displayA.style.display = 'block';
    editQ.style.display = 'none';
    editA.style.display = 'none';
    if (typeDisplay) typeDisplay.style.display = 'block';
    if (typeEdit) typeEdit.style.display = 'none';
    if (modifyBtn) modifyBtn.style.display = 'inline-block';
    if (actions) actions.style.display = 'none';
  }
}

/**
 * 提交审核：approve | reject | modify_approve
 */
async function submitQAReview(action) {
  if (!qaReviewCurrentId) return;
  if (action === 'reject' && !window.confirm('确定拒绝该问答对吗？')) return;
  const body = {
    action: action === 'modify_approve' ? 'modify_approve' : action,
    remark: undefined
  };
  if (action === 'modify_approve') {
    const qEdit = document.getElementById('qa-review-question-edit');
    const aEdit = document.getElementById('qa-review-answer-edit');
    const catEdit = document.getElementById('qa-review-category-edit');
    const intentEdit = document.getElementById('qa-review-intent-edit');
    body.content_after = {
      question: qEdit ? qEdit.value : undefined,
      answer: aEdit ? aEdit.value : undefined,
      category_code: catEdit && catEdit.value !== '' ? catEdit.value : null,
      intent_code: intentEdit && intentEdit.value !== '' ? intentEdit.value : null
    };
  }
  try {
    const res = await fetch(`${API_BASE}/qa/concerns/${qaReviewCurrentId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || '提交失败');
    }
    showToast(result.message || '操作成功', 'success');
    closeQAReview();
    loadQAList();
  } catch (err) {
    console.error('提交审核失败:', err);
    showToast(err.message || '提交失败', 'error');
  }
}

/**
 * 批量通过选中的问答对
 */
async function batchApprove() {
  const ids = Array.from(qaState.selectedIds);
  if (ids.length === 0) {
    showToast('请先勾选要通过的问答对', 'warning');
    return;
  }
  if (!window.confirm(`确定通过选中的 ${ids.length} 条问答对吗？`)) return;
  try {
    const res = await fetch(`${API_BASE}/qa/review/batch-approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concernIds: ids })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || '操作失败');
    showToast(result.message || '已批量通过', 'success');
    qaState.selectedIds.clear();
    document.querySelectorAll('.qa-select-checkbox').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('qa-select-all');
    if (selectAll) selectAll.checked = false;
    loadQAList();
  } catch (err) {
    showToast(err.message || '批量通过失败', 'error');
  }
}

/**
 * 批量拒绝选中的问答对
 */
async function batchReject() {
  const ids = Array.from(qaState.selectedIds);
  if (ids.length === 0) {
    showToast('请先勾选要拒绝的问答对', 'warning');
    return;
  }
  if (!window.confirm(`确定拒绝选中的 ${ids.length} 条问答对吗？`)) return;
  try {
    const res = await fetch(`${API_BASE}/qa/review/batch-reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concernIds: ids })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.error || '操作失败');
    showToast(result.message || '已批量拒绝', 'success');
    qaState.selectedIds.clear();
    document.querySelectorAll('.qa-select-checkbox').forEach(cb => { cb.checked = false; });
    const selectAll = document.getElementById('qa-select-all');
    if (selectAll) selectAll.checked = false;
    loadQAList();
  } catch (err) {
    showToast(err.message || '批量拒绝失败', 'error');
  }
}

/**
 * 工具函数：转义HTML
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 工具函数：显示Toast提示
 */
function showToast(message, type = 'info') {
  // 使用common.js中的showMessage函数
  if (window.showMessage && typeof window.showMessage === 'function') {
    window.showMessage(message, type);
    return;
  }
  
  // 简单的toast实现（如果showMessage不存在）
  const colors = {
    success: '#52c41a',
    error: '#f5222d',
    warning: '#faad14',
    info: '#1890ff',
  };
  
  // 确保CSS动画样式存在
  if (!document.getElementById('qa-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'qa-toast-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(100%);
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
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    max-width: 400px;
    word-wrap: break-word;
  `;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

