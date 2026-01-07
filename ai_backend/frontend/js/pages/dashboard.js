/**
 * 控制台页面脚本
 */

(async function() {
  console.log('📊 加载控制台页面...');
  
  try {
    // 加载系统统计
    const stats = await API.get('/api/admin/system/stats');
    
    // 更新统计卡片
    document.getElementById('stat-models').textContent = stats.models.active || 0;
    document.getElementById('stat-prompts').textContent = stats.prompts.active || 0;
    document.getElementById('stat-calls').textContent = (stats.usage.total_calls || 0).toLocaleString();
    document.getElementById('stat-tokens').textContent = (stats.usage.total_tokens || 0).toLocaleString();
    
    // 加载场景列表
    const scenes = await API.get('/api/admin/system/scenes');
    renderSceneStats(scenes);
    
    // 检查系统健康状态
    checkHealth();
    
    // 更新最后更新时间
    document.getElementById('last-update').textContent = formatDate(new Date());
    
  } catch (error) {
    console.error('加载统计数据失败:', error);
    showMessage('加载数据失败: ' + error.message, 'error');
  }
})();

// 渲染场景统计表格
function renderSceneStats(scenes) {
  const tbody = document.getElementById('scene-stats-table');
  
  if (!scenes || scenes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">暂无数据</td></tr>';
    return;
  }
  
  tbody.innerHTML = scenes.map(scene => `
    <tr>
      <td>
        <span style="margin-right: 8px;">${getSceneIcon(scene.code)}</span>
        <strong>${scene.name}</strong>
        <br>
        <span style="font-size: 12px; color: var(--text-secondary);">${scene.description}</span>
      </td>
      <td>${scene.model_count || 0}</td>
      <td>${scene.template_count || 0}</td>
      <td>${(scene.total_calls || 0).toLocaleString()}</td>
      <td>${(scene.total_tokens || 0).toLocaleString()}</td>
      <td>
        <button class="btn btn-sm" onclick="location.hash='model-config'">配置模型</button>
      </td>
    </tr>
  `).join('');
}

// 获取场景图标
function getSceneIcon(code) {
  const icons = {
    transcription: '🎙️',
    transcription_correction: '✍️',
    ppt_analysis: '📊',
    document_extract: '📄',
    document_manage: '📁',
    general: '💬',
  };
  return icons[code] || '📌';
}

// 检查系统健康
async function checkHealth() {
  try {
    const health = await API.get('/api/admin/system/health');
    const statusEl = document.getElementById('db-status');
    
    if (health.database === 'connected') {
      statusEl.className = 'badge badge-success';
      statusEl.textContent = '正常';
    } else {
      statusEl.className = 'badge badge-danger';
      statusEl.textContent = '异常';
    }
  } catch (error) {
    const statusEl = document.getElementById('db-status');
    statusEl.className = 'badge badge-danger';
    statusEl.textContent = '离线';
  }
}

