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
    questionSource: '' // 新增：问题发起方筛选
  },
  selectedIds: new Set(),
  allSelected: false,
  // 分类映射表（用于显示中文名称）
  categoryMap: new Map(), // code -> {name, description}
  intentMap: new Map()    // code -> {name, description}
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
    window.toggleSelectAll = toggleSelectAll;
    window.toggleSelectQA = toggleSelectQA;
    window.applyFilters = applyFilters;
    window.resetFilters = resetFilters;
    window.changePage = changePage;
    window.changePageSize = changePageSize;
    
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
  // 加载分类映射表（用于显示中文名称）
  await initCategoryMaps();
  
  // 加载分类选项
  await loadCategoryOptions();
  
  // 加载问答对列表
  await loadQAList();
  
  // 绑定事件
  bindEvents();
}

/**
 * 初始化分类映射表
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
    
    // 构建映射表
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
    
  } catch (error) {
    console.error('[分类映射] 加载失败:', error);
    // 失败时使用空映射表，不影响主流程
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
 * 加载分类选项
 */
async function loadCategoryOptions() {
  try {
    // 这里可以从API获取分类列表，暂时先硬编码主要分类
    const categorySelect = document.getElementById('qa-filter-category');
    if (!categorySelect) return;
    
    // 可以后续从API获取
    const categories = [
      { code: '1.1', name: '1.1 资质与案例' },
      { code: '1.2', name: '1.2 公司规模与背景' },
      { code: '1.3', name: '1.3 合作模式' },
      { code: '1.4', name: '1.4 监管资源与协作' },
      { code: '2.1', name: '2.1 性能与效率' },
      { code: '2.2', name: '2.2 产品架构' },
      { code: '2.3', name: '2.3 产品功能' },
      { code: '2.4', name: '2.4 兼容性与接口扩展' },
      { code: '3.1', name: '3.1 监管政策适配' },
      { code: '3.2', name: '3.2 数据安全与合规治理' },
      { code: '3.3', name: '3.3 业务适配与定制化' },
      { code: '4.1', name: '4.1 预算与报价' },
      { code: '4.2', name: '4.2 价格竞争力与优惠政策' },
      { code: '5.1', name: '5.1 POC' },
      { code: '5.2', name: '5.2 项目周期' },
      { code: '5.3', name: '5.3 项目团队与管控' },
      { code: '5.4', name: '5.4 资源配置' },
      { code: '5.5', name: '5.5 数据迁移' },
      { code: '6.1', name: '6.1 运维支撑' },
      { code: '6.2', name: '6.2 培训服务' },
      { code: '6.3', name: '6.3 安全支撑' },
      { code: '6.4', name: '6.4 其他售后保障' }
    ];
    
    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.code;
      option.textContent = cat.name;
      categorySelect.appendChild(option);
    });
  } catch (error) {
    console.error('加载分类选项失败:', error);
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
      params.append('questionSource', qaState.filters.questionSource); // 新增
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
      tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px; color: #999;">暂无问答对数据</td></tr>';
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
          <td>${escapeHtml(createdAt)}</td>
          <td>
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
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: #f5222d;">加载失败: ${error.message}</td></tr>`;
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
  qaState.filters.questionSource = document.getElementById('qa-filter-question-source')?.value || ''; // 新增
  qaState.currentPage = 1; // 重置到第一页
  qaState.selectedIds.clear(); // 清空选择
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
  document.getElementById('qa-filter-question-source').value = ''; // 新增
  qaState.filters = {
    transcriptionName: '',
    classificationStatus: '',
    category: '',
    intent: '',
    questionSource: '' // 新增
  };
  qaState.currentPage = 1;
  qaState.selectedIds.clear();
  loadQAList();
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
    
    // 渲染详情内容
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
      <button onclick="classifySingleQA('${qa.id}')" class="btn btn-primary" style="padding: 8px 20px;">
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
  const modal = document.getElementById('qa-detail-modal');
  if (modal) {
    modal.style.display = 'none';
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

