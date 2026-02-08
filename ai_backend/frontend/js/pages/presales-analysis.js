/**
 * 售前交流综合分析页面
 */

const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api';

// 状态管理
let presalesState = {
  currentPage: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
  transcriptions: [],
  currentResult: null,
  /** 每条转录的前置内容：{ [transcriptionId]: string } */
  prependContentByTranscriptionId: {},
  /** 当前正在编辑前置内容的转录 ID（弹窗用） */
  editingPrependTranscriptionId: null
};

// 页面初始化
(async function() {
  console.log('💬 售前交流综合分析页面初始化...');
  
  try {
    await loadTranscriptionList();
    console.log('✅ 售前交流综合分析页面初始化完成');
  } catch (error) {
    console.error('❌ 售前交流综合分析页面初始化失败:', error);
    showToast('页面初始化失败: ' + error.message, 'error');
  }
})();

/**
 * 加载转录记录列表
 */
window.loadTranscriptionList = async function() {
  try {
    showLoading(true);
    hideEmpty();
    hideList();

    const response = await fetch(`${API_BASE}/presales-analysis/transcriptions?page=${presalesState.currentPage}&pageSize=${presalesState.pageSize}`);
    const data = await response.json();

    if (data.success && data.data) {
      presalesState.transcriptions = data.data.list || [];
      presalesState.total = data.data.total || 0;
      presalesState.totalPages = data.data.totalPages || 1;

      updatePagination();
      renderTranscriptionList();
      
      if (presalesState.transcriptions.length === 0) {
        showEmpty();
      } else {
        showList();
      }
    } else {
      throw new Error(data.error || '加载失败');
    }
  } catch (error) {
    console.error('加载转录记录列表失败:', error);
    showToast('加载失败: ' + error.message, 'error');
    showEmpty();
  } finally {
    showLoading(false);
  }
};

/**
 * 渲染转录记录列表
 */
function renderTranscriptionList() {
  const tbody = document.getElementById('presales-list-tbody');
  if (!tbody) return;

  if (presalesState.transcriptions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无数据</td></tr>';
    return;
  }

  tbody.innerHTML = presalesState.transcriptions.map(transcription => {
    const hasAnalysis = transcription.hasAnalysis;
    const analysisStatus = hasAnalysis 
      ? '<span class="badge badge-success">已分析</span>'
      : '<span class="badge badge-secondary">未分析</span>';
    
    const analyzeBtn = hasAnalysis
      ? '<button class="btn btn-sm btn-warning" onclick="reAnalyze(\'' + transcription.id + '\')">🔄 重新分析</button>'
      : '<button class="btn btn-sm btn-primary" onclick="analyzeTranscription(\'' + transcription.id + '\')">🚀 分析</button>';
    
    const viewBtn = hasAnalysis
      ? '<button class="btn btn-sm btn-info" onclick="viewResult(\'' + transcription.id + '\')">📊 查看结果</button>'
      : '<button class="btn btn-sm" disabled>📊 查看结果</button>';

    const hasPrepend = (presalesState.prependContentByTranscriptionId[transcription.id] || '').trim().length > 0;
    const prependBtn = '<button class="btn btn-sm btn-secondary" onclick="openPrependDialog(\'' + transcription.id + '\')" title="分析时将此前置内容与提示词、对话内容一并发给大模型">' + (hasPrepend ? '📝 编辑前置' : '📝 添加前置') + '</button>';

    return `
      <tr>
        <td><strong>${escapeHtml(transcription.name || transcription.originalFileName || '未命名')}</strong></td>
        <td>${escapeHtml(transcription.customerName || '-')}</td>
        <td>${formatDate(transcription.createdAt)}</td>
        <td>${analysisStatus}</td>
        <td>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${analyzeBtn}
            ${viewBtn}
            ${prependBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 打开前置内容编辑对话框
 */
window.openPrependDialog = function(transcriptionId) {
  presalesState.editingPrependTranscriptionId = transcriptionId;
  const textarea = document.getElementById('presales-prepend-content');
  if (textarea) {
    textarea.value = presalesState.prependContentByTranscriptionId[transcriptionId] || '';
  }
  const dialog = document.getElementById('presales-prepend-dialog');
  if (dialog) {
    dialog.showModal();
  }
};

/**
 * 关闭前置内容对话框
 */
window.closePrependDialog = function() {
  presalesState.editingPrependTranscriptionId = null;
  const dialog = document.getElementById('presales-prepend-dialog');
  if (dialog) {
    dialog.close();
  }
};

/**
 * 保存前置内容到状态并关闭对话框
 */
window.savePrependContent = function() {
  const id = presalesState.editingPrependTranscriptionId;
  if (!id) return;
  const textarea = document.getElementById('presales-prepend-content');
  if (textarea) {
    presalesState.prependContentByTranscriptionId[id] = textarea.value || '';
  }
  closePrependDialog();
  renderTranscriptionList();
  showToast('前置内容已保存，点击「分析」时将一并发送', 'success');
};

/**
 * 分析转录记录
 * 请求体包含前置内容（若有）：分析时将 前置内容 + 提示词（数据库） + 对话内容 合并发给大模型
 */
window.analyzeTranscription = async function(transcriptionId) {
  if (!confirm('确定要对该转录记录进行分析吗？')) {
    return;
  }

  try {
    showAnalyzing(true, '正在分析中，请稍候...');

    const prependContent = (presalesState.prependContentByTranscriptionId[transcriptionId] || '').trim();
    const response = await fetch(`${API_BASE}/presales-analysis/analyze/transcription/${transcriptionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(prependContent ? { prependContent } : {})
    });

    const data = await response.json();

    if (data.success) {
      showToast('分析完成', 'success');
      // 重新加载列表
      await loadTranscriptionList();
    } else {
      throw new Error(data.error || '分析失败');
    }
  } catch (error) {
    console.error('分析失败:', error);
    showToast('分析失败: ' + error.message, 'error');
  } finally {
    showAnalyzing(false);
  }
};

/**
 * 重新分析
 */
window.reAnalyze = function(transcriptionId) {
  if (!confirm('确定要重新分析吗？这将覆盖之前的分析结果。')) {
    return;
  }
  analyzeTranscription(transcriptionId);
};

/**
 * 查看分析结果
 */
window.viewResult = async function(transcriptionId) {
  try {
    showLoading(true);

    const response = await fetch(`${API_BASE}/presales-analysis/results/transcription/${transcriptionId}`);
    const data = await response.json();

    if (data.success && data.data) {
      presalesState.currentResult = data.data;
      displayAnalysisResult(data.data.analysisResult);
      openResultDialog();
    } else {
      throw new Error(data.error || '未找到分析结果');
    }
  } catch (error) {
    console.error('获取分析结果失败:', error);
    showToast('获取分析结果失败: ' + error.message, 'error');
  } finally {
    showLoading(false);
  }
};

/**
 * 显示分析结果
 * 若为 Markdown 报告（raw_markdown），优先展示完整报告；否则按结构化字段展示
 */
function displayAnalysisResult(result) {
  const contentDiv = document.getElementById('presales-result-content');
  if (!contentDiv) return;

  let html = '';

  // 模型返回 Markdown 报告时，直接展示完整内容（保留换行与格式）
  if (result.raw_markdown) {
    html += '<div class="analysis-section">';
    html += '<h4>📄 售前交流分析报告</h4>';
    html += '<pre class="raw-markdown-report" style="white-space: pre-wrap; word-break: break-word; max-height: 70vh; overflow: auto; padding: 12px; background: var(--bg-secondary, #f5f5f5); border-radius: 8px;">' + escapeHtml(result.raw_markdown) + '</pre>';
    html += '</div>';
    contentDiv.innerHTML = html;
    return;
  }

  if (result.summary) {
    html += '<div class="analysis-section">';
    html += '<h4>📋 整体摘要</h4>';

    if (result.summary.overall_impression) {
      html += `<div class="analysis-item"><strong>整体印象：</strong><p>${escapeHtml(result.summary.overall_impression)}</p></div>`;
    }

    if (result.summary.key_topics && result.summary.key_topics.length > 0) {
      html += `<div class="analysis-item"><strong>关键话题：</strong><div class="tags">${result.summary.key_topics.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div></div>`;
    }

    if (result.summary.customer_profile) {
      const profile = result.summary.customer_profile;
      html += '<div class="analysis-item"><strong>客户画像：</strong><ul>';
      if (profile.industry) html += `<li>行业：${escapeHtml(profile.industry)}</li>`;
      if (profile.company_size) html += `<li>公司规模：${escapeHtml(profile.company_size)}</li>`;
      if (profile.pain_points && profile.pain_points.length > 0) {
        html += `<li>痛点：${profile.pain_points.map(p => escapeHtml(p)).join('、')}</li>`;
      }
      if (profile.budget_range) html += `<li>预算范围：${escapeHtml(profile.budget_range)}</li>`;
      html += '</ul></div>';
    }

    if (result.summary.sales_performance) {
      const perf = result.summary.sales_performance;
      html += '<div class="analysis-item"><strong>销售表现：</strong><ul>';
      if (perf.strengths && perf.strengths.length > 0) {
        html += `<li>优势：${perf.strengths.map(s => escapeHtml(s)).join('、')}</li>`;
      }
      if (perf.weaknesses && perf.weaknesses.length > 0) {
        html += `<li>不足：${perf.weaknesses.map(w => escapeHtml(w)).join('、')}</li>`;
      }
      if (perf.suggestions && perf.suggestions.length > 0) {
        html += `<li>建议：${perf.suggestions.map(s => escapeHtml(s)).join('、')}</li>`;
      }
      html += '</ul></div>';
    }

    if (result.summary.next_steps) {
      const steps = result.summary.next_steps;
      html += '<div class="analysis-item"><strong>下一步行动：</strong><ul>';
      if (steps.recommended_actions && steps.recommended_actions.length > 0) {
        html += `<li>推荐行动：${steps.recommended_actions.map(a => escapeHtml(a)).join('、')}</li>`;
      }
      if (steps.priority) html += `<li>优先级：${escapeHtml(steps.priority)}</li>`;
      if (steps.timeline) html += `<li>时间线：${escapeHtml(steps.timeline)}</li>`;
      html += '</ul></div>';
    }

    html += '</div>';
  }

  if (result.analysis_details) {
    html += '<div class="analysis-section">';
    html += '<h4>🔍 详细分析</h4>';

    if (result.analysis_details.customer_intent) {
      const intent = result.analysis_details.customer_intent;
      html += '<div class="analysis-item"><strong>客户意图：</strong><ul>';
      if (intent.purchase_intention) html += `<li>购买意向：${escapeHtml(intent.purchase_intention)}</li>`;
      if (intent.concerns && intent.concerns.length > 0) {
        html += `<li>关注点：${intent.concerns.map(c => escapeHtml(c)).join('、')}</li>`;
      }
      if (intent.decision_factors && intent.decision_factors.length > 0) {
        html += `<li>决策因素：${intent.decision_factors.map(f => escapeHtml(f)).join('、')}</li>`;
      }
      html += '</ul></div>';
    }

    if (result.analysis_details.communication_quality) {
      const quality = result.analysis_details.communication_quality;
      html += '<div class="analysis-item"><strong>沟通质量：</strong><ul>';
      if (quality.clarity) html += `<li>清晰度：${quality.clarity}/10</li>`;
      if (quality.responsiveness) html += `<li>响应及时性：${quality.responsiveness}/10</li>`;
      if (quality.professionalism) html += `<li>专业度：${quality.professionalism}/10</li>`;
      html += '</ul></div>';
    }

    if (result.analysis_details.product_fit) {
      const fit = result.analysis_details.product_fit;
      html += '<div class="analysis-item"><strong>产品匹配度：</strong><ul>';
      if (fit.match_score) html += `<li>匹配度评分：${fit.match_score}/10</li>`;
      if (fit.gaps && fit.gaps.length > 0) {
        html += `<li>差距：${fit.gaps.map(g => escapeHtml(g)).join('、')}</li>`;
      }
      if (fit.opportunities && fit.opportunities.length > 0) {
        html += `<li>机会：${fit.opportunities.map(o => escapeHtml(o)).join('、')}</li>`;
      }
      html += '</ul></div>';
    }

    html += '</div>';
  }

  if (result.recommendations) {
    html += '<div class="analysis-section">';
    html += '<h4>💡 建议</h4>';

    if (result.recommendations.immediate && result.recommendations.immediate.length > 0) {
      html += `<div class="analysis-item"><strong>立即行动：</strong><ul>${result.recommendations.immediate.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
    }

    if (result.recommendations.short_term && result.recommendations.short_term.length > 0) {
      html += `<div class="analysis-item"><strong>短期建议：</strong><ul>${result.recommendations.short_term.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
    }

    if (result.recommendations.long_term && result.recommendations.long_term.length > 0) {
      html += `<div class="analysis-item"><strong>长期建议：</strong><ul>${result.recommendations.long_term.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul></div>`;
    }

    html += '</div>';
  }

  if (result.confidence !== undefined) {
    html += `<div class="analysis-section"><div class="analysis-item"><strong>置信度：</strong><span class="confidence-badge">${(result.confidence * 100).toFixed(1)}%</span></div></div>`;
  }

  contentDiv.innerHTML = html;
}

/**
 * 打开结果对话框
 */
function openResultDialog() {
  const dialog = document.getElementById('presales-result-dialog');
  if (dialog) {
    dialog.showModal();
  }
}

/**
 * 关闭结果对话框
 */
window.closeResultDialog = function() {
  const dialog = document.getElementById('presales-result-dialog');
  if (dialog) {
    dialog.close();
  }
};

/**
 * 复制结果
 */
window.copyResult = function() {
  if (presalesState.currentResult && presalesState.currentResult.analysisResult) {
    const result = presalesState.currentResult.analysisResult;
    const text = result.raw_markdown
      ? result.raw_markdown
      : JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      showToast('结果已复制到剪贴板', 'success');
    }).catch(err => {
      showToast('复制失败', 'error');
    });
  }
};

/**
 * 更新分页
 */
function updatePagination() {
  const totalCount = document.getElementById('presales-total-count');
  const paginationInfo = document.getElementById('presales-pagination-info');
  const pageInfo = document.getElementById('presales-page-info');
  const prevBtn = document.getElementById('presales-prev-btn');
  const nextBtn = document.getElementById('presales-next-btn');
  const pagination = document.getElementById('presales-pagination');

  if (totalCount) {
    totalCount.textContent = `共 ${presalesState.total} 条记录`;
  }

  if (paginationInfo) {
    paginationInfo.textContent = `共 ${presalesState.total} 条，每页 ${presalesState.pageSize} 条`;
  }

  if (pageInfo) {
    pageInfo.textContent = `第 ${presalesState.currentPage} 页，共 ${presalesState.totalPages} 页`;
  }

  if (prevBtn) {
    prevBtn.disabled = presalesState.currentPage <= 1;
  }

  if (nextBtn) {
    nextBtn.disabled = presalesState.currentPage >= presalesState.totalPages;
  }

  if (pagination) {
    pagination.style.display = presalesState.totalPages > 1 ? 'flex' : 'none';
  }
}

/**
 * 切换页码
 */
window.changePage = function(delta) {
  const newPage = presalesState.currentPage + delta;
  if (newPage >= 1 && newPage <= presalesState.totalPages) {
    presalesState.currentPage = newPage;
    loadTranscriptionList();
  }
};

/**
 * 显示/隐藏加载状态
 */
function showLoading(show) {
  const loading = document.getElementById('presales-loading');
  if (loading) {
    loading.style.display = show ? 'flex' : 'none';
  }
}

/**
 * 显示/隐藏空状态
 */
function showEmpty() {
  const empty = document.getElementById('presales-empty');
  if (empty) {
    empty.style.display = 'block';
  }
}

function hideEmpty() {
  const empty = document.getElementById('presales-empty');
  if (empty) {
    empty.style.display = 'none';
  }
}

/**
 * 显示/隐藏列表
 */
function showList() {
  const list = document.getElementById('presales-list');
  if (list) {
    list.style.display = 'block';
  }
}

function hideList() {
  const list = document.getElementById('presales-list');
  if (list) {
    list.style.display = 'none';
  }
}

/**
 * 显示/隐藏分析中遮罩
 */
function showAnalyzing(show, text = '正在分析中，请稍候...') {
  const overlay = document.getElementById('presales-analyzing-overlay');
  const textEl = document.getElementById('presales-analyzing-text');
  
  if (overlay) {
    overlay.style.display = show ? 'flex' : 'none';
  }
  
  if (textEl) {
    textEl.textContent = text;
  }
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'success') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else if (typeof toast === 'function') {
    toast(message, type);
  } else {
    alert(message);
  }
}

/**
 * HTML转义
 */
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 格式化日期
 */
function formatDate(dateString) {
  if (!dateString) return '未知';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
}
