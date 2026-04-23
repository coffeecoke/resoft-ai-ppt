const VIDEO_BATCH_API_BASE = '/api/auto-process/video';

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function loadVideoBatchGroupSettings() {
  try {
    const response = await fetch(`${VIDEO_BATCH_API_BASE}/group-settings`);
    const result = await response.json();
    if (!result.success) {
      showError(result.error || '加载设置失败');
      return;
    }
    const data = result.data || {};
    const fixedMembers = Array.isArray(data.fixedMembers) ? data.fixedMembers : [];
    document.getElementById('video-fixed-members').value = fixedMembers.join(', ');

    const leadChats = data.leadChats && typeof data.leadChats === 'object' ? data.leadChats : {};
    const entries = Object.entries(leadChats);
    const list = document.getElementById('video-lead-chat-list');
    if (entries.length === 0) {
      list.innerHTML = '<div class="empty-logs"><div class="icon">📝</div><div>暂无映射记录</div></div>';
      return;
    }
    list.innerHTML = entries.map(([leadKey, item]) => {
      const name = item && item.name ? item.name : '-';
      const chatid = item && item.chatid ? item.chatid : '-';
      const updatedAt = item && item.updatedAt ? new Date(item.updatedAt).toLocaleString('zh-CN') : '-';
      const safeLeadKey = escapeHtml(leadKey);
      const safeName = escapeHtml(name);
      const safeChatid = escapeHtml(chatid);
      return `<div class="log-item info">
        <div><strong>${safeLeadKey}</strong></div>
        <div>群名：${safeName}</div>
        <div>chatid：${safeChatid}</div>
        <div>更新时间：${updatedAt}</div>
        <div style="margin-top:8px; display:flex; gap:8px;">
          <button class="btn btn-sm btn-primary" onclick="rebindLeadChat('${safeLeadKey}','${safeChatid}','${safeName}')">重绑</button>
          <button class="btn btn-sm btn-danger" onclick="clearLeadChat('${safeLeadKey}')">清除</button>
        </div>
      </div>`;
    }).join('');
  } catch (error) {
    showError(`加载设置失败：${error.message}`);
  }
}

async function saveVideoBatchGroupSettings() {
  try {
    const raw = document.getElementById('video-fixed-members').value || '';
    const fixedMembers = raw
      .split(/[,，、;；\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const response = await fetch(`${VIDEO_BATCH_API_BASE}/group-settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixedMembers })
    });
    const result = await response.json();
    if (!result.success) {
      showError(result.error || '保存失败');
      return;
    }
    showSuccess('固定成员已更新');
    await loadVideoBatchGroupSettings();
  } catch (error) {
    showError(`保存失败：${error.message}`);
  }
}

async function rebindLeadChat(leadKey, oldChatid, oldName) {
  const chatid = prompt(`请输入新的 chatid（原值：${oldChatid || '-'})`, oldChatid || '');
  if (chatid == null) return;
  const trimmedChatid = String(chatid).trim();
  if (!trimmedChatid) {
    showError('chatid 不能为空');
    return;
  }
  const name = prompt(`请输入群名（可选，原值：${oldName || '-'})`, oldName || '') || '';
  try {
    const response = await fetch(`${VIDEO_BATCH_API_BASE}/group-settings/lead-chat`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadKey,
        chatid: trimmedChatid,
        name: String(name).trim()
      })
    });
    const result = await response.json();
    if (!result.success) {
      showError(result.error || '重绑失败');
      return;
    }
    showSuccess('线索群映射已重绑');
    await loadVideoBatchGroupSettings();
  } catch (error) {
    showError(`重绑失败：${error.message}`);
  }
}

async function clearLeadChat(leadKey) {
  if (!confirm(`确定清除映射 ${leadKey} 吗？`)) return;
  try {
    const response = await fetch(`${VIDEO_BATCH_API_BASE}/group-settings/lead-chat?leadKey=${encodeURIComponent(leadKey)}`, {
      method: 'DELETE'
    });
    const result = await response.json();
    if (!result.success) {
      showError(result.error || '清除失败');
      return;
    }
    showSuccess(result.message || '已清除');
    await loadVideoBatchGroupSettings();
  } catch (error) {
    showError(`清除失败：${error.message}`);
  }
}

window.saveVideoBatchGroupSettings = saveVideoBatchGroupSettings;
window.rebindLeadChat = rebindLeadChat;
window.clearLeadChat = clearLeadChat;

loadVideoBatchGroupSettings();
