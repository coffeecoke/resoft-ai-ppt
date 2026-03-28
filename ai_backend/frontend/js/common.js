/**
 * 公共函数库
 */

// 显示消息提示（durationMs 可选，默认 3000；多行文案自动换行）
function showMessage(message, type = 'info', durationMs = 3000) {
  const colors = {
    success: '#52c41a',
    error: '#f5222d',
    warning: '#faad14',
    info: '#1890ff',
  };

  const ms =
    typeof durationMs === 'number' && durationMs > 0 ? durationMs : 3000

  const toast = document.createElement('div')
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
    max-width: min(440px, 92vw);
    line-height: 1.45;
    word-break: break-word;
  `
  toast.textContent = message
  if (String(message).includes('\n')) {
    toast.style.whiteSpace = 'pre-line'
  }

  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out'
    setTimeout(() => toast.remove(), 300)
  }, ms)
}

// 格式化日期
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
  if (!date) return '-';
  
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  const second = String(d.getSeconds()).padStart(2, '0');
  
  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

// 复制到剪贴板
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showMessage('已复制到剪贴板', 'success');
  } catch (error) {
    showMessage('复制失败', 'error');
  }
}

// 下载JSON
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 防抖
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 暴露到全局
window.showMessage = showMessage;
window.formatDate = formatDate;
window.copyToClipboard = copyToClipboard;
window.downloadJSON = downloadJSON;
window.debounce = debounce;

// 添加动画样式
const style = document.createElement('style');
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

