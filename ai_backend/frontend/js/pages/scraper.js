/**
 * 智能信息爬取页面逻辑
 */

(function () {
  const API_BASE = '/api/scraper';
  const logEl = document.getElementById('scraper-log');
  const resultsEl = document.getElementById('scraper-results-list');
  const keywordsEl = document.getElementById('scraper-keywords');
  const maxPagesEl = document.getElementById('scraper-max-pages');
  const startDateEl = document.getElementById('scraper-start-date');
  const endDateEl = document.getElementById('scraper-end-date');
  const btnLoad = document.getElementById('scraper-btn-load');
  const btnRun = document.getElementById('scraper-btn-run');

  function setLog(text) {
    if (logEl) logEl.textContent = text || '（无输出）';
  }

  function appendLog(text) {
    if (logEl) logEl.textContent = (logEl.textContent || '') + (text || '');
  }

  async function loadConfig() {
    try {
      const res = await fetch(API_BASE + '/config');
      const json = await res.json();
      if (!json.success) throw new Error(json.message || '获取配置失败');
      const c = json.data;
      if (keywordsEl) keywordsEl.value = (c.keywords || []).join(', ');
      if (maxPagesEl) maxPagesEl.value = c.max_pages != null ? c.max_pages : 1;
      if (startDateEl) startDateEl.value = c.start_date || '';
      if (endDateEl) endDateEl.value = c.end_date || '';
    } catch (e) {
      setLog('加载配置失败: ' + e.message);
    }
  }

  async function runScraper() {
    const keywordsStr = keywordsEl ? keywordsEl.value.trim() : '';
    const keywords = keywordsStr ? keywordsStr.split(/[,，]/).map(k => k.trim()).filter(Boolean) : [];
    if (!keywords.length) {
      setLog('请至少填写一个关键词');
      return;
    }
    const max_pages = maxPagesEl ? parseInt(maxPagesEl.value, 10) : 1;
    const start_date = startDateEl ? startDateEl.value.trim() : '';
    const end_date = endDateEl ? endDateEl.value.trim() : '';

    if (btnRun) {
      btnRun.disabled = true;
      btnRun.textContent = '爬取中…';
    }
    setLog('正在启动爬虫，请稍候…\n');

    try {
      const res = await fetch(API_BASE + '/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords, max_pages, start_date, end_date }),
      });
      const json = await res.json();
      if (json.log) setLog(json.log);
      if (json.success) appendLog('\n\n✅ 爬取结束');
      else appendLog('\n\n❌ 退出码: ' + (json.exitCode ?? ''));
    } catch (e) {
      setLog('请求失败: ' + e.message);
    } finally {
      if (btnRun) {
        btnRun.disabled = false;
        btnRun.textContent = '开始爬取';
      }
      refreshResults();
    }
  }

  async function refreshResults() {
    if (!resultsEl) return;
    try {
      const res = await fetch(API_BASE + '/results');
      const json = await res.json();
      if (!json.success) {
        resultsEl.innerHTML = '<div class="empty">获取结果失败: ' + (json.message || '') + '</div>';
        return;
      }
      const list = json.data || [];
      if (!list.length) {
        resultsEl.innerHTML = '<div class="empty">暂无爬取结果</div>';
        return;
      }
      let html = '';
      for (const group of list) {
        html += '<div style="margin-bottom: 16px;">';
        html += '<div style="font-weight: 600; margin-bottom: 8px;">关键词：' + escapeHtml(group.keyword) + '</div>';
        html += '<ul style="list-style: none; padding: 0; margin: 0;">';
        for (const f of group.files || []) {
          const url = '/' + (f.path || '').replace(/\\/g, '/');
          html += '<li style="margin-bottom: 4px;">';
          html += '<a href="' + url + '" target="_blank" rel="noopener">' + escapeHtml(f.name) + '</a>';
          if (f.size) html += ' <span class="text-muted">(' + formatSize(f.size) + ')</span>';
          html += ' <button type="button" class="btn btn-sm" data-preview="' + escapeAttr(f.path) + '">预览</button>';
          html += '</li>';
        }
        html += '</ul></div>';
      }
      resultsEl.innerHTML = html;
      resultsEl.querySelectorAll('[data-preview]').forEach(btn => {
        btn.addEventListener('click', function () {
          const path = this.getAttribute('data-preview');
          if (!path) return;
          fetch(API_BASE + '/results/preview?path=' + encodeURIComponent(path))
            .then(r => r.json())
            .then(j => {
              if (j.success && j.data && j.data.content) {
                const w = window.open('', '_blank');
                w.document.write('<pre style="white-space: pre-wrap; padding: 16px;">' + escapeHtml(j.data.content) + '</pre>');
                w.document.close();
              }
            })
            .catch(() => {});
        });
      });
    } catch (e) {
      resultsEl.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>';
    }
  }

  function escapeHtml(s) {
    if (s == null) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }
  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function formatSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
  }

  if (btnLoad) btnLoad.addEventListener('click', loadConfig);
  if (btnRun) btnRun.addEventListener('click', runScraper);

  loadConfig();
  refreshResults();
})();
