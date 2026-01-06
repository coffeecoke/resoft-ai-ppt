/**
 * 自动跑批监控页面
 */

const AUTO_API_BASE = 'http://localhost:3000/api/auto-process';
let autoRefreshInterval = null;
let autoCurrentStatus = null;

// ==================== Toast 提示函数 ====================

/**
 * 显示Toast提示消息
 */
function showToast(message, type = 'info') {
  // 移除已有的toast
  const existingToast = document.querySelector('.auto-toast');
  if (existingToast) {
    existingToast.remove();
  }

  // 创建新toast
  const toast = document.createElement('div');
  toast.className = `auto-toast auto-toast-${type}`;
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
    font-size: 14px;
  `;
  
  // 根据类型设置边框颜色
  if (type === 'success') {
    toast.style.borderLeft = '4px solid #52c41a';
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid #f5222d';
  } else if (type === 'warning') {
    toast.style.borderLeft = '4px solid #faad14';
  } else {
    toast.style.borderLeft = '4px solid #1890ff';
  }
  
  document.body.appendChild(toast);
  
  // 3秒后自动移除
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-in';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 页面初始化
(async function() {
  console.log('🤖 自动跑批监控页面初始化...');
  await autoLoadStatus();
  await autoLoadConfig();
  await autoLoadStatistics();
  await autoLoadLogs();
  
  // 启动自动刷新（每5秒）
  autoRefreshInterval = setInterval(async () => {
    await autoLoadStatus();
    await autoLoadStatistics();
    await autoLoadLogs();
  }, 5000);
})();

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
  }
});

// ==================== 状态管理 ====================

/**
 * 加载当前状态
 */
async function autoLoadStatus() {
  try {
    const response = await fetch(`${AUTO_API_BASE}/status`);
    const result = await response.json();
    
    if (result.success) {
      autoCurrentStatus = result.data;
      autoRenderStatus(result.data);
    }
  } catch (error) {
    console.error('❌ 加载状态失败:', error);
  }
}

/**
 * 渲染状态显示
 */
function autoRenderStatus(status) {
  const indicator = document.getElementById('status-indicator');
  const panelTitle = document.getElementById('panel-title');
  const statusText = document.getElementById('status-text');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');
  const currentTaskDiv = document.getElementById('current-task');
  
  if (status.isRunning) {
    indicator.className = 'status-indicator running';
    panelTitle.textContent = '自动跑批监控 - 运行中';
    startBtn.disabled = true;
    stopBtn.disabled = false;
    
    const nextRun = status.statistics.nextRunTime 
      ? new Date(status.statistics.nextRunTime).toLocaleString('zh-CN')
      : '未知';
    statusText.textContent = `✅ 自动跑批正在运行，下次执行时间：${nextRun}`;
  } else {
    indicator.className = 'status-indicator stopped';
    panelTitle.textContent = '自动跑批监控 - 已停止';
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusText.textContent = '⏸️ 自动跑批已停止，点击"启动"按钮开始自动处理';
  }
  
  // 显示当前任务
  if (status.currentTask) {
    const task = status.currentTask;
    const taskStartTime = new Date(task.startTime).toLocaleTimeString('zh-CN');
    const duration = Math.floor((Date.now() - new Date(task.startTime)) / 1000);
    
    document.getElementById('task-info').innerHTML = `
      <div><strong>任务类型:</strong> ${task.type === 'extract' ? '文本提取' : 'AI分析'}</div>
      <div><strong>文档名称:</strong> ${task.documentName}</div>
      <div><strong>文档ID:</strong> <code>${task.documentId}</code></div>
      <div><strong>开始时间:</strong> ${taskStartTime} (已运行 ${duration} 秒)</div>
    `;
    currentTaskDiv.style.display = 'block';
  } else {
    currentTaskDiv.style.display = 'none';
  }
}

/**
 * 刷新状态
 */
async function autoRefreshStatus() {
  showToast('正在刷新状态...', 'info');
  await autoLoadStatus();
  await autoLoadStatistics();
  await autoLoadLogs();
  showToast('刷新完成', 'success');
}

// ==================== 控制操作 ====================

/**
 * 启动自动跑批
 */
async function autoStartProcess() {
  if (!window.confirm('确定要启动自动跑批吗？\n\n系统将定时扫描未处理的文档并自动提取和分析。')) {
    return;
  }
  
  try {
    const response = await fetch(`${AUTO_API_BASE}/start`, {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ 自动跑批已启动', 'success');
      await autoLoadStatus();
      await autoLoadLogs();
    } else {
      showToast('启动失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 启动失败:', error);
    showToast('启动失败: ' + error.message, 'error');
  }
}

/**
 * 停止自动跑批
 */
async function autoStopProcess() {
  if (!window.confirm('确定要停止自动跑批吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${AUTO_API_BASE}/stop`, {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.success) {
      showToast('⏸️ 自动跑批已停止', 'success');
      await autoLoadStatus();
    } else {
      showToast('停止失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 停止失败:', error);
    showToast('停止失败: ' + error.message, 'error');
  }
}

/**
 * 立即执行一次
 */
async function autoRunOnce() {
  if (!window.confirm('确定要立即执行一次处理吗？\n\n系统将扫描并处理所有待处理的文档。')) {
    return;
  }
  
  try {
    const response = await fetch(`${AUTO_API_BASE}/run-once`, {
      method: 'POST'
    });
    const result = await response.json();
    
    if (result.success) {
      showToast('🚀 ' + result.message, 'success');
      // 延迟刷新，给后端一点处理时间
      setTimeout(async () => {
        await autoLoadStatus();
        await autoLoadLogs();
      }, 1000);
    } else {
      showToast('执行失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 执行失败:', error);
    showToast('执行失败: ' + error.message, 'error');
  }
}

// ==================== 配置管理 ====================

/**
 * 加载配置
 */
async function autoLoadConfig() {
  try {
    const response = await fetch(`${AUTO_API_BASE}/config`);
    const result = await response.json();
    
    if (result.success) {
      const config = result.data;
      document.getElementById('polling-interval').value = config.pollingInterval;
      document.getElementById('enable-extract').checked = config.enableAutoExtract;
      document.getElementById('enable-analysis').checked = config.enableAutoAnalysis;
      document.getElementById('max-concurrent').value = config.maxConcurrent;
    }
  } catch (error) {
    console.error('❌ 加载配置失败:', error);
  }
}

/**
 * 保存配置
 */
async function autoSaveConfig() {
  try {
    const config = {
      pollingInterval: parseInt(document.getElementById('polling-interval').value),
      enableAutoExtract: document.getElementById('enable-extract').checked,
      enableAutoAnalysis: document.getElementById('enable-analysis').checked,
      maxConcurrent: parseInt(document.getElementById('max-concurrent').value)
    };
    
    const response = await fetch(`${AUTO_API_BASE}/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ 配置已保存', 'success');
      await autoLoadStatus();
    } else {
      showToast('保存失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 保存配置失败:', error);
    showToast('保存失败: ' + error.message, 'error');
  }
}

// ==================== 统计数据 ====================

/**
 * 加载统计数据
 */
async function autoLoadStatistics() {
  try {
    const response = await fetch(`${AUTO_API_BASE}/statistics`);
    const result = await response.json();
    
    if (result.success) {
      const stats = result.data;
      
      document.getElementById('stat-total').textContent = stats.totalDocuments || 0;
      document.getElementById('stat-extracted').textContent = stats.extractedDocuments || 0;
      document.getElementById('stat-analyzed').textContent = stats.analyzedDocuments || 0;
      document.getElementById('stat-pending').textContent = stats.pendingDocuments || 0;
      document.getElementById('stat-total-runs').textContent = stats.totalRuns || 0;
      document.getElementById('stat-success-runs').textContent = stats.successfulRuns || 0;
      document.getElementById('stat-failed-runs').textContent = stats.failedRuns || 0;
      
      if (stats.nextRunTime) {
        const nextRun = new Date(stats.nextRunTime);
        const now = new Date();
        const seconds = Math.floor((nextRun - now) / 1000);
        
        if (seconds > 0) {
          const minutes = Math.floor(seconds / 60);
          const secs = seconds % 60;
          document.getElementById('stat-next-run').textContent = 
            `${minutes}分${secs}秒后`;
        } else {
          document.getElementById('stat-next-run').textContent = '即将执行';
        }
      } else {
        document.getElementById('stat-next-run').textContent = '-';
      }
    }
  } catch (error) {
    console.error('❌ 加载统计数据失败:', error);
  }
}

// ==================== 日志管理 ====================

/**
 * 加载日志
 */
async function autoLoadLogs() {
  try {
    const response = await fetch(`${AUTO_API_BASE}/logs?limit=50`);
    const result = await response.json();
    
    if (result.success) {
      autoRenderLogs(result.data);
    }
  } catch (error) {
    console.error('❌ 加载日志失败:', error);
  }
}

/**
 * 渲染日志列表
 */
function autoRenderLogs(logs) {
  const logList = document.getElementById('log-list');
  
  if (!logs || logs.length === 0) {
    logList.innerHTML = `
      <div class="empty-logs">
        <div class="icon">📝</div>
        <div>暂无日志记录</div>
      </div>
    `;
    return;
  }
  
  logList.innerHTML = logs.map(log => {
    const time = new Date(log.timestamp).toLocaleString('zh-CN');
    const hasDetails = log.details && Object.keys(log.details).length > 0;
    
    return `
      <div class="log-item ${log.level}">
        <div>
          <span class="log-time">${time}</span>
          <span class="log-message">${log.message}</span>
        </div>
        ${hasDetails ? `
          <div class="log-details">
            ${JSON.stringify(log.details, null, 2)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

/**
 * 清空日志
 */
async function autoClearLogs() {
  if (!window.confirm('确定要清空所有日志吗？')) {
    return;
  }
  
  try {
    const response = await fetch(`${AUTO_API_BASE}/logs`, {
      method: 'DELETE'
    });
    const result = await response.json();
    
    if (result.success) {
      showToast('✅ 日志已清空', 'success');
      await autoLoadLogs();
    } else {
      showToast('清空失败: ' + result.error, 'error');
    }
  } catch (error) {
    console.error('❌ 清空日志失败:', error);
    showToast('清空失败: ' + error.message, 'error');
  }
}

console.log('✅ 自动跑批监控页面JS已加载');

