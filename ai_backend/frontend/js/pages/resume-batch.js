/**
 * 简历批量拆解：提交根目录 → 轮询任务进度
 */
;(function () {
  const API_BASE = (window.location.origin || 'http://localhost:3000') + '/api'
  let pollTimer = null

  function api (p) {
    return API_BASE + p
  }

  function setProgress (pct, text) {
    const p = document.getElementById('rb-progress')
    const t = document.getElementById('rb-progress-text')
    if (p) {
      const n = Math.max(0, Math.min(100, Number(pct) || 0))
      p.value = n
    }
    if (t) t.textContent = text || ''
  }

  async function fetchJob (id) {
    const res = await fetch(api('/resume-batch/jobs/' + encodeURIComponent(id)))
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'HTTP ' + res.status)
    return body.data
  }

  function stopPoll () {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function renderLog (job) {
    const el = document.getElementById('rb-log')
    if (!el) return
    el.textContent = (job.logs || []).join('\n')
    el.scrollTop = el.scrollHeight
  }

  document.getElementById('rb-btn-start')?.addEventListener('click', async function () {
    const startBtn = document.getElementById('rb-btn-start')
    const root = ((document.getElementById('rb-root-path') || {}).value || '').trim()
    if (!root) {
      if (typeof showMessage === 'function') showMessage('请填写根文件夹路径', 'warning')
      return
    }
    stopPoll()
    if (startBtn) startBtn.disabled = true
    setProgress(0, '提交任务…')
    const logEl = document.getElementById('rb-log')
    if (logEl) logEl.textContent = ''

    try {
      const res = await fetch(api('/resume-batch/jobs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rootPath: root }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        const extra = body.data && body.data.activeJobId ? '（进行中: ' + body.data.activeJobId + '）' : ''
        throw new Error((body.error || body.message || '启动失败') + extra)
      }
      const jobId = body.data.jobId
      setProgress(1, '已排队…')

      pollTimer = setInterval(async function () {
        try {
          const job = await fetchJob(jobId)
          const hint = [job.status, job.unitIndex && job.totalUnits ? job.unitIndex + '/' + job.totalUnits : '', job.currentFolder || '']
            .filter(Boolean)
            .join(' · ')
          setProgress(job.percent || 0, hint)
          renderLog(job)
          if (job.status === 'completed' || job.status === 'failed') {
            stopPoll()
            if (startBtn) startBtn.disabled = false
            setProgress(job.status === 'completed' ? 100 : job.percent || 0, job.status === 'completed' ? '完成' : '失败')
            if (typeof showMessage === 'function') {
              showMessage(
                job.status === 'completed' ? '批量拆解已完成，可到「简历查询管理」按批次查看。' : ('任务失败：' + (job.error || '未知错误')),
                job.status === 'completed' ? 'success' : 'error',
                6000
              )
            }
          }
        } catch (e) {
          stopPoll()
          if (startBtn) startBtn.disabled = false
          setProgress(0, '就绪')
          if (typeof showMessage === 'function') showMessage(e.message, 'error')
        }
      }, 900)
    } catch (e) {
      if (startBtn) startBtn.disabled = false
      setProgress(0, '就绪')
      if (typeof showMessage === 'function') showMessage(e.message, 'error')
    }
  })

  document.getElementById('rb-btn-clear-log')?.addEventListener('click', function () {
    const el = document.getElementById('rb-log')
    if (el) el.textContent = ''
  })
})()
