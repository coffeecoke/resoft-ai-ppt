/**
 * 外链：说话人角色确认（兼容企微内置浏览器：绝对路径脚本 + 分块渲染大列表）
 */
;(function () {
  var API = (window.location.origin || '') + '/api/presales-video'
  var RENDER_CHUNK = 40
  /** ngrok 免费域名：不带此头时接口常返回 HTML 拦截页，JSON.parse 会报「返回非 JSON」 */
  var SKIP_NGROK_WARN = { 'ngrok-skip-browser-warning': 'true' }

  var params = new URLSearchParams(window.location.search)
  var token = params.get('token') || ''

  var elMeta = document.getElementById('pvsc-meta')
  var elErr = document.getElementById('pvsc-err')
  var elOk = document.getElementById('pvsc-ok')
  var elToolbar = document.getElementById('pvsc-toolbar')
  var elList = document.getElementById('pvsc-list')
  var elBar = document.getElementById('pvsc-bar')
  var elSave = document.getElementById('pvsc-save')
  var elBatchFrom = document.getElementById('pvsc-batch-from')
  var elBatchTo = document.getElementById('pvsc-batch-to')
  var elBatchApply = document.getElementById('pvsc-batch-apply')

  var dialogues = []
  var loadedName = ''
  var renderIndex = 0
  /** GET 返回的 speaker_roles，用于下拉框展示角色名 */
  var speakerRolesFromApi = null

  function showErr(msg) {
    elErr.textContent = msg
    elErr.style.display = 'block'
    elOk.style.display = 'none'
  }
  function showOk(msg) {
    elOk.textContent = msg
    elOk.style.display = 'block'
    elErr.style.display = 'none'
  }
  function hideMsgs() {
    elErr.style.display = 'none'
    elOk.style.display = 'none'
  }

  function normSpeaker(d) {
    var s = d.speaker != null ? String(d.speaker) : d.role != null ? String(d.role) : ''
    s = s.trim()
    return s || '未知'
  }
  function normText(d) {
    if (d.text != null) return String(d.text).trim()
    if (d.correctedText != null) return String(d.correctedText).trim()
    if (d.originalText != null) return String(d.originalText).trim()
    return ''
  }
  function normTime(d) {
    if (d.timeRange != null) return String(d.timeRange).trim()
    if (d.startTime != null) return String(d.startTime).trim()
    return ''
  }

  /** 将 speaker_roles 中的值转为可读角色名（含 customer / 客户方 等） */
  function roleDisplayLabel(speakerKey) {
    if (speakerKey == null || speakerKey === '') return ''
    var map = speakerRolesFromApi
    if (!map || typeof map !== 'object') return String(speakerKey)
    var v = map[speakerKey]
    if (v == null) {
      var up = String(speakerKey).toUpperCase()
      for (var k in map) {
        if (Object.prototype.hasOwnProperty.call(map, k) && String(k).toUpperCase() === up) {
          v = map[k]
          break
        }
      }
    }
    var raw = v
    if (raw && typeof raw === 'object') {
      raw = raw.role != null ? raw.role : raw.roleName != null ? raw.roleName : raw.name
    }
    if (raw == null || raw === '') return String(speakerKey)
    var en2zh = { customer: '客户方', our_side: '我方', unknown: '未知' }
    var s = String(raw).toLowerCase()
    return en2zh[s] != null ? en2zh[s] : String(raw)
  }

  function refreshBatchFromSelect() {
    if (!elBatchFrom || elBatchFrom.tagName !== 'SELECT') return
    var prev = String(elBatchFrom.value || '').trim()
    var seen = {}
    var keys = []
    for (var j = 0; j < dialogues.length; j++) {
      var sp = normSpeaker(dialogues[j])
      if (!sp || seen[sp]) continue
      seen[sp] = 1
      keys.push(sp)
    }
    elBatchFrom.innerHTML = ''
    var opt0 = document.createElement('option')
    opt0.value = ''
    opt0.textContent = '请选择…'
    elBatchFrom.appendChild(opt0)
    for (var i = 0; i < keys.length; i++) {
      var spk = keys[i]
      var opt = document.createElement('option')
      opt.value = spk
      var label = roleDisplayLabel(spk)
      opt.textContent = label === spk ? spk : label + '（' + spk + '）'
      elBatchFrom.appendChild(opt)
    }
    if (prev && seen[prev]) elBatchFrom.value = prev
    else if (keys.length === 1) elBatchFrom.value = keys[0]
  }

  function cloneDialogue(x) {
    var o = {}
    for (var k in x) {
      if (Object.prototype.hasOwnProperty.call(x, k)) o[k] = x[k]
    }
    return o
  }

  function syncAllSpeakersFromDom() {
    var inputs = elList.querySelectorAll('.speaker-in')
    for (var j = 0; j < inputs.length; j++) {
      var inp = inputs[j]
      var i = parseInt(inp.getAttribute('data-spk-idx'), 10)
      if (!isNaN(i) && dialogues[i]) {
        dialogues[i] = Object.assign({}, dialogues[i], {
          speaker: (inp.value || '').trim() || '未知'
        })
      }
    }
  }

  function escapeHtml(s) {
    if (s == null) return ''
    var d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }
  function escapeAttr(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
  }

  function rowHtml(d, i) {
    var sp = normSpeaker(d)
    var tr = normTime(d)
    var tx = normText(d)
    return (
      '<div class="row" data-idx="' +
      i +
      '">' +
      '<div class="row-head"><span>' +
      escapeHtml(tr || '—') +
      '</span>' +
      '<input class="speaker-in" type="text" data-spk-idx="' +
      i +
      '" value="' +
      escapeAttr(sp) +
      '" aria-label="说话人" />' +
      '</div>' +
      '<div class="text">' +
      escapeHtml(tx) +
      '</div></div>'
    )
  }

  function render(done) {
    elList.innerHTML = ''
    renderIndex = 0
    if (dialogues.length === 0) {
      elList.innerHTML = '<p class="meta">暂无对话</p>'
      if (done) done()
      return
    }

    function step() {
      var end = Math.min(renderIndex + RENDER_CHUNK, dialogues.length)
      var html = ''
      for (var k = renderIndex; k < end; k++) {
        html += rowHtml(dialogues[k], k)
      }
      elList.insertAdjacentHTML('beforeend', html)
      renderIndex = end
      if (elMeta) {
        elMeta.textContent =
          (loadedName || '未命名') +
          ' · 渲染 ' +
          renderIndex +
          '/' +
          dialogues.length +
          ' 条…'
      }
      if (renderIndex < dialogues.length) {
        if (window.requestAnimationFrame) {
          requestAnimationFrame(step)
        } else {
          setTimeout(step, 0)
        }
      } else {
        if (elMeta) {
          elMeta.textContent =
            (loadedName || '未命名') +
            ' · 共 ' +
            dialogues.length +
            ' 条（可修改说话人后保存）'
        }
        if (done) done()
      }
    }

    if (window.requestAnimationFrame) {
      requestAnimationFrame(step)
    } else {
      step()
    }
  }

  /** 事件委托：避免几百个 input 各绑一个监听 */
  elList.addEventListener('change', function (e) {
    var t = e.target
    if (!t || !t.classList || !t.classList.contains('speaker-in')) return
    var i = parseInt(t.getAttribute('data-spk-idx'), 10)
    if (isNaN(i) || !dialogues[i]) return
    dialogues[i] = Object.assign({}, dialogues[i], {
      speaker: (t.value || '').trim() || '未知'
    })
  })

  function load() {
    if (!token) {
      elMeta.textContent = '缺少 token 参数'
      showErr('链接无效：未携带 token')
      return
    }
    elMeta.textContent = '正在请求数据…'
    var url = API + '/public/speaker-confirm?token=' + encodeURIComponent(token)
    fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: SKIP_NGROK_WARN
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {}
          try {
            data = JSON.parse(text)
          } catch (e) {
            var hint =
              (text || '').trim().charAt(0) === '<'
                ? '（响应为 HTML，常见于 ngrok 免费域名在企微内置浏览器未跳过警告页）'
                : ''
            throw new Error('返回非 JSON' + hint)
          }
          return { res: res, data: data }
        })
      })
      .then(function (r) {
        if (!r.res.ok || !r.data.success) {
          showErr((r.data && r.data.error) || '加载失败')
          elMeta.textContent = '加载失败'
          return
        }
        hideMsgs()
        var d = r.data.data || {}
        speakerRolesFromApi =
          d.speakerRoles && typeof d.speakerRoles === 'object' ? d.speakerRoles : null
        loadedName = d.name || d.originalFileName || ''
        dialogues = []
        if (Array.isArray(d.dialogues)) {
          for (var i = 0; i < d.dialogues.length; i++) {
            dialogues.push(cloneDialogue(d.dialogues[i]))
          }
        }
        elMeta.textContent =
          (loadedName || '未命名') +
          ' · 共 ' +
          dialogues.length +
          ' 条，正在渲染界面…'
        elToolbar.style.display = 'flex'
        elBar.style.display = 'flex'
        render(function () {
          refreshBatchFromSelect()
        })
      })
      .catch(function (e) {
        showErr(e.message || String(e))
        elMeta.textContent = '网络错误'
      })
  }

  elBatchApply.addEventListener('click', function () {
    var from = String(elBatchFrom.value || '').trim()
    var to = String(elBatchTo.value || '').trim()
    if (!from || !to) {
      showErr(!from ? '请选择「原说话人」并填写「改为」' : '请填写「改为」')
      return
    }
    syncAllSpeakersFromDom()
    hideMsgs()
    var n = 0
    var next = []
    for (var i = 0; i < dialogues.length; i++) {
      var d = dialogues[i]
      if (normSpeaker(d) === from) {
        n++
        next.push(Object.assign({}, d, { speaker: to }))
      } else {
        next.push(d)
      }
    }
    dialogues = next
    render(null)
    refreshBatchFromSelect()
    showOk('已将 ' + n + ' 条中的「' + from + '」改为「' + to + '」')
    setTimeout(function () {
      elOk.style.display = 'none'
    }, 3000)
  })

  elSave.addEventListener('click', function () {
    syncAllSpeakersFromDom()
    elSave.disabled = true
    hideMsgs()
    fetch(API + '/public/speaker-confirm', {
      method: 'PUT',
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        SKIP_NGROK_WARN
      ),
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ token: token, dialogues: dialogues })
    })
      .then(function (res) {
        return res.text().then(function (text) {
          var data = {}
          try {
            data = JSON.parse(text)
          } catch (e) {
            var hint =
              (text || '').trim().charAt(0) === '<'
                ? '（响应为 HTML，常见于 ngrok 未跳过警告页）'
                : ''
            throw new Error('返回非 JSON' + hint)
          }
          return { res: res, data: data }
        })
      })
      .then(function (r) {
        if (!r.res.ok || !r.data.success) {
          showErr((r.data && r.data.error) || '保存失败')
          return
        }
        showOk('已保存。您可返回企微继续后续流程。')
      })
      .catch(function (e) {
        showErr(e.message || String(e))
      })
      .then(function () {
        elSave.disabled = false
      })
  })

  load()
})()
