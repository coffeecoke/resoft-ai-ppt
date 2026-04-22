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
  var elSpeakerMap = document.getElementById('pvsc-speaker-map')
  var elList = document.getElementById('pvsc-list')
  var elBar = document.getElementById('pvsc-bar')
  var elSave = document.getElementById('pvsc-save')
  var elRefresh = document.getElementById('pvsc-refresh')
  var elSearchInput = document.getElementById('pvsc-search-input')
  var elSearchBtn = document.getElementById('pvsc-search-btn')
  var elSearchResult = document.getElementById('pvsc-search-result')

  var dialogues = []
  /** 是否在加载数据后做过说话人修改（未保存则刷新前提示） */
  var dataDirty = false
  var loadedName = ''
  var renderIndex = 0
  var lastSearchKeyword = ''
  var lastSearchIndex = -1
  var lastHighlightedRow = null
  /** 当前角色映射：speaker -> customer | our_side */
  var speakerRolesMap = {}

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
  function setSearchResult(msg) {
    if (!elSearchResult) return
    elSearchResult.textContent = msg || ''
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

  function normalizeRoleValue(raw) {
    if (raw && typeof raw === 'object') {
      raw = raw.role != null ? raw.role : raw.roleName != null ? raw.roleName : raw.name
    }
    var s = raw != null ? String(raw).trim().toLowerCase() : ''
    if (!s) return ''
    if (s === 'customer' || s === '客户方' || s === '客户') return 'customer'
    if (
      s === 'our_side' ||
      s === 'our side' ||
      s === '我方' ||
      s === '我方/供应商' ||
      s === '供应商'
    ) {
      return 'our_side'
    }
    return ''
  }

  function roleLabelZh(role) {
    if (role === 'customer') return '客户方'
    if (role === 'our_side') return '我方'
    return ''
  }

  function getRoleBySpeaker(speakerKey) {
    if (speakerKey == null || speakerKey === '') return ''
    var key = String(speakerKey)
    var direct = normalizeRoleValue(speakerRolesMap[key])
    if (direct) return direct
    var up = key.toUpperCase()
    for (var k in speakerRolesMap) {
      if (Object.prototype.hasOwnProperty.call(speakerRolesMap, k) && String(k).toUpperCase() === up) {
        return normalizeRoleValue(speakerRolesMap[k])
      }
    }
    return ''
  }

  function setRoleBySpeaker(speakerKey, role) {
    var key = speakerKey != null ? String(speakerKey).trim() : ''
    if (!key) return
    var norm = normalizeRoleValue(role)
    if (!norm) {
      delete speakerRolesMap[key]
      return
    }
    speakerRolesMap[key] = norm
  }

  function roleDisplayLabel(speakerKey) {
    return roleLabelZh(getRoleBySpeaker(speakerKey))
  }

  function normalizeSpeakerRolesMap(rawMap) {
    var out = {}
    if (!rawMap || typeof rawMap !== 'object') return out
    for (var key in rawMap) {
      if (!Object.prototype.hasOwnProperty.call(rawMap, key)) continue
      var nk = String(key || '').trim()
      if (!nk) continue
      var rv = normalizeRoleValue(rawMap[key])
      if (!rv) continue
      out[nk] = rv
    }
    return out
  }

  function roleFromDialogue(d) {
    if (!d || typeof d !== 'object') return ''
    return normalizeRoleValue(
      d.speaker_role != null
        ? d.speaker_role
        : d.speakerRole != null
          ? d.speakerRole
          : d.speaker_role_type
    )
  }

  function roleForDialogue(d) {
    var byDialogue = roleFromDialogue(d)
    if (byDialogue) return byDialogue
    return getRoleBySpeaker(normSpeaker(d))
  }

  function syncRoleMapWithDialogues() {
    var speakerSet = {}
    for (var i = 0; i < dialogues.length; i++) {
      var d = dialogues[i]
      var sp = normSpeaker(d)
      speakerSet[sp] = 1
      var dr = roleFromDialogue(d)
      if (dr && !getRoleBySpeaker(sp)) {
        speakerRolesMap[sp] = dr
      }
    }
    for (var k in speakerRolesMap) {
      if (Object.prototype.hasOwnProperty.call(speakerRolesMap, k) && !speakerSet[k]) {
        delete speakerRolesMap[k]
      }
    }
  }

  function applyRoleMapToDialogues() {
    var next = []
    for (var i = 0; i < dialogues.length; i++) {
      var d = dialogues[i] || {}
      var sp = normSpeaker(d)
      var role = getRoleBySpeaker(sp)
      var cloned = Object.assign({}, d)
      if (role) {
        cloned.speaker_role = role
        delete cloned.speakerRole
      } else {
        delete cloned.speaker_role
        delete cloned.speakerRole
      }
      next.push(cloned)
    }
    dialogues = next
  }

  function buildSpeakerRolesPayload() {
    var out = {}
    var keys = uniqueSpeakerKeys()
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i]
      var role = getRoleBySpeaker(key)
      if (role) out[key] = role
    }
    return out
  }

  function findMissingRoleSpeakers() {
    var keys = uniqueSpeakerKeys()
    var miss = []
    for (var i = 0; i < keys.length; i++) {
      if (!getRoleBySpeaker(keys[i])) miss.push(keys[i])
    }
    return miss
  }

  /** 按出现顺序去重后的说话人标签列表 */
  function uniqueSpeakerKeys() {
    var seen = {}
    var keys = []
    for (var j = 0; j < dialogues.length; j++) {
      var sp = normSpeaker(dialogues[j])
      if (!sp || seen[sp]) continue
      seen[sp] = 1
      keys.push(sp)
    }
    return keys
  }

  /** 左侧 speaker 标签、右侧角色名；右侧失焦后批量替换同标签段落，需用户点击「保存确认结果」落库 */
  function renderSpeakerMap() {
    if (!elSpeakerMap) return
    var keys = uniqueSpeakerKeys()
    elSpeakerMap.innerHTML = ''
    if (keys.length === 0) {
      elSpeakerMap.innerHTML = '<p class="meta" style="margin:0;">暂无说话人</p>'
      return
    }
    for (var i = 0; i < keys.length; i++) {
      var fromKey = keys[i]
      var row = document.createElement('div')
      row.className = 'speaker-map-row'
      var labWrap = document.createElement('div')
      labWrap.style.display = 'flex'
      labWrap.style.alignItems = 'baseline'
      labWrap.style.flexWrap = 'wrap'
      labWrap.style.gap = '4px'
      var lab = document.createElement('span')
      lab.className = 'speaker-map-label'
      lab.textContent = fromKey
      var disp = roleDisplayLabel(fromKey)
      if (disp && disp !== fromKey) {
        var meta = document.createElement('span')
        meta.className = 'speaker-map-meta'
        meta.textContent = '（' + disp + '）'
        labWrap.appendChild(lab)
        labWrap.appendChild(meta)
      } else {
        labWrap.appendChild(lab)
      }
      var inp = document.createElement('input')
      inp.type = 'text'
      inp.className = 'speaker-map-in'
      inp.setAttribute('data-map-from', fromKey)
      inp.value = fromKey
      inp.placeholder = '如 客户方'
      inp.setAttribute('aria-label', '将「' + fromKey + '」统一改为')
      inp.autocomplete = 'off'
      var roleWrap = document.createElement('div')
      roleWrap.className = 'speaker-role-group'
      var radioName = 'pvsc-role-' + i
      var currentRole = getRoleBySpeaker(fromKey)

      var customerLabel = document.createElement('label')
      customerLabel.className = 'speaker-role-opt'
      var customerRadio = document.createElement('input')
      customerRadio.type = 'radio'
      customerRadio.name = radioName
      customerRadio.className = 'speaker-role-radio'
      customerRadio.setAttribute('data-map-speaker', fromKey)
      customerRadio.value = 'customer'
      customerRadio.checked = currentRole === 'customer'
      customerLabel.appendChild(customerRadio)
      customerLabel.appendChild(document.createTextNode('客户方'))

      var ourSideLabel = document.createElement('label')
      ourSideLabel.className = 'speaker-role-opt'
      var ourSideRadio = document.createElement('input')
      ourSideRadio.type = 'radio'
      ourSideRadio.name = radioName
      ourSideRadio.className = 'speaker-role-radio'
      ourSideRadio.setAttribute('data-map-speaker', fromKey)
      ourSideRadio.value = 'our_side'
      ourSideRadio.checked = currentRole === 'our_side'
      ourSideLabel.appendChild(ourSideRadio)
      ourSideLabel.appendChild(document.createTextNode('我方'))

      roleWrap.appendChild(customerLabel)
      roleWrap.appendChild(ourSideLabel)
      row.appendChild(labWrap)
      row.appendChild(inp)
      row.appendChild(roleWrap)
      elSpeakerMap.appendChild(row)
    }
  }

  function applySpeakerMapOne(fromKey, to) {
    var t = (to != null ? String(to) : '').trim()
    if (!t) t = fromKey
    if (t === fromKey) return 0
    syncAllSpeakersFromDom()
    var n = 0
    var next = []
    for (var i = 0; i < dialogues.length; i++) {
      var d = dialogues[i]
      if (normSpeaker(d) === fromKey) {
        n++
        next.push(Object.assign({}, d, { speaker: t, speaker_role: roleForDialogue(d) || undefined }))
      } else {
        next.push(d)
      }
    }
    var roleFrom = getRoleBySpeaker(fromKey)
    if (roleFrom) {
      if (!getRoleBySpeaker(t)) {
        setRoleBySpeaker(t, roleFrom)
      }
      delete speakerRolesMap[fromKey]
    }
    dialogues = next
    syncRoleMapWithDialogues()
    return n
  }

  function applySpeakerRoleOne(speakerKey, roleValue) {
    var role = normalizeRoleValue(roleValue)
    if (!speakerKey || !role) return 0
    setRoleBySpeaker(speakerKey, role)
    var n = 0
    var next = []
    for (var i = 0; i < dialogues.length; i++) {
      var d = dialogues[i]
      if (normSpeaker(d) === speakerKey) {
        n++
        next.push(Object.assign({}, d, { speaker_role: role }))
      } else {
        next.push(d)
      }
    }
    dialogues = next
    return n
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
        var oldSpeaker = normSpeaker(dialogues[i])
        var oldRole = roleForDialogue(dialogues[i])
        var newSpeaker = (inp.value || '').trim() || '未知'
        dialogues[i] = Object.assign({}, dialogues[i], {
          speaker: newSpeaker,
          speaker_role: oldRole || undefined
        })
        if (newSpeaker !== oldSpeaker) {
          if (oldRole && !getRoleBySpeaker(newSpeaker)) {
            setRoleBySpeaker(newSpeaker, oldRole)
          }
        }
      }
    }
    syncRoleMapWithDialogues()
    applyRoleMapToDialogues()
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
    var role = roleForDialogue(d)
    var roleLabel = roleLabelZh(role)
    var tr = normTime(d)
    var tx = normText(d)
    var roleClass = role === 'customer' ? 'role-badge-customer' : role === 'our_side' ? 'role-badge-our-side' : ''
    var roleBadge = roleLabel
      ? '<span class="role-badge ' + roleClass + '">' + escapeHtml(roleLabel) + '</span>'
      : ''
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
      roleBadge +
      '</div>' +
      '<div class="text">' +
      escapeHtml(tx) +
      '</div></div>'
    )
  }

  function clearSearchHighlight() {
    if (lastHighlightedRow && lastHighlightedRow.classList) {
      lastHighlightedRow.classList.remove('search-hit')
    }
    lastHighlightedRow = null
  }

  function dialogueSearchText(d) {
    return (
      normSpeaker(d) + ' ' + normTime(d) + ' ' + normText(d) + ' ' + roleLabelZh(roleForDialogue(d))
    ).toLowerCase()
  }

  function scrollAndHighlightByIndex(idx, remainTry) {
    var row = elList.querySelector('.row[data-idx="' + idx + '"]')
    if (!row) {
      if (remainTry > 0) {
        setTimeout(function () {
          scrollAndHighlightByIndex(idx, remainTry - 1)
        }, 80)
      }
      return
    }
    clearSearchHighlight()
    row.classList.add('search-hit')
    lastHighlightedRow = row
    if (row.scrollIntoView) {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  function doSearch() {
    if (!elSearchInput) return
    var raw = (elSearchInput.value || '').trim()
    if (!raw) {
      setSearchResult('请输入关键字')
      clearSearchHighlight()
      lastSearchKeyword = ''
      lastSearchIndex = -1
      return
    }
    syncAllSpeakersFromDom()
    var kw = raw.toLowerCase()
    var start = 0
    if (lastSearchKeyword === kw && lastSearchIndex >= 0) {
      start = (lastSearchIndex + 1) % Math.max(dialogues.length, 1)
    } else {
      lastSearchKeyword = kw
      lastSearchIndex = -1
    }
    var found = -1
    for (var k = 0; k < dialogues.length; k++) {
      var idx = (start + k) % dialogues.length
      if (dialogueSearchText(dialogues[idx]).indexOf(kw) >= 0) {
        found = idx
        break
      }
    }
    if (found < 0) {
      setSearchResult('未找到：' + raw)
      clearSearchHighlight()
      lastSearchIndex = -1
      return
    }
    lastSearchIndex = found
    setSearchResult('已定位到第 ' + (found + 1) + ' 条（再次点击可继续查找下一个）')
    scrollAndHighlightByIndex(found, 25)
  }

  function render(done) {
    elList.innerHTML = ''
    renderIndex = 0
    if (dialogues.length === 0) {
      elList.innerHTML = '<p class="meta">暂无对话</p>'
      renderSpeakerMap()
      clearSearchHighlight()
      setSearchResult('')
      lastSearchKeyword = ''
      lastSearchIndex = -1
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
        renderSpeakerMap()
        if (lastSearchKeyword) {
          scrollAndHighlightByIndex(lastSearchIndex >= 0 ? lastSearchIndex : 0, 10)
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
    var oldSpeaker = normSpeaker(dialogues[i])
    var newSpeaker = (t.value || '').trim() || '未知'
    var oldRole = roleForDialogue(dialogues[i])
    dataDirty = true
    dialogues[i] = Object.assign({}, dialogues[i], {
      speaker: newSpeaker,
      speaker_role: oldRole || undefined
    })
    if (newSpeaker !== oldSpeaker) {
      if (oldRole && !getRoleBySpeaker(newSpeaker)) {
        setRoleBySpeaker(newSpeaker, oldRole)
      }
      syncRoleMapWithDialogues()
    }
  })

  function load() {
    if (!token) {
      elMeta.textContent = '缺少 token 参数'
      showErr('链接无效：未携带 token')
      return
    }
    if (elRefresh) elRefresh.disabled = true
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
        speakerRolesMap = normalizeSpeakerRolesMap(d.speakerRoles)
        loadedName = d.name || d.originalFileName || ''
        dialogues = []
        if (Array.isArray(d.dialogues)) {
          for (var i = 0; i < d.dialogues.length; i++) {
            dialogues.push(cloneDialogue(d.dialogues[i]))
          }
        }
        syncRoleMapWithDialogues()
        applyRoleMapToDialogues()
        elMeta.textContent =
          (loadedName || '未命名') +
          ' · 共 ' +
          dialogues.length +
          ' 条，正在渲染界面…'
        elToolbar.style.display = 'flex'
        elBar.style.display = 'flex'
        dataDirty = false
        lastSearchKeyword = ''
        lastSearchIndex = -1
        clearSearchHighlight()
        setSearchResult('')
        render(null)
      })
      .catch(function (e) {
        showErr(e.message || String(e))
        elMeta.textContent = '网络错误'
      })
      .then(function () {
        if (elRefresh) elRefresh.disabled = false
      })
  }

  if (elSpeakerMap) {
    elSpeakerMap.addEventListener('change', function (e) {
      var t = e.target
      if (!t || !t.classList) return
      if (t.classList.contains('speaker-map-in')) {
        var fromKey = t.getAttribute('data-map-from')
        if (fromKey == null || fromKey === '') return
        var toRaw = t.value
        var n = applySpeakerMapOne(fromKey, toRaw)
        if (n <= 0) return
        dataDirty = true
        hideMsgs()
        render(null)
        var toShow = (toRaw != null ? String(toRaw) : '').trim() || fromKey
        showOk('已将 ' + n + ' 条中的「' + fromKey + '」改为「' + toShow + '」')
        setTimeout(function () {
          elOk.style.display = 'none'
        }, 3000)
        return
      }
      if (t.classList.contains('speaker-role-radio')) {
        var spk = t.getAttribute('data-map-speaker')
        if (!spk) return
        var c = applySpeakerRoleOne(spk, t.value)
        if (c <= 0) return
        dataDirty = true
        hideMsgs()
        render(null)
      }
    })
  }

  if (elRefresh) {
    elRefresh.addEventListener('click', function () {
      if (dataDirty) {
        var ok = window.confirm('将重新从服务器加载对话，未保存的修改会丢失，是否继续？')
        if (!ok) return
      }
      hideMsgs()
      load()
    })
  }

  if (elSearchBtn) {
    elSearchBtn.addEventListener('click', doSearch)
  }
  if (elSearchInput) {
    elSearchInput.addEventListener('keydown', function (e) {
      var key = e && (e.key || e.keyCode)
      if (key === 'Enter' || key === 13) {
        e.preventDefault()
        doSearch()
      }
    })
  }

  elSave.addEventListener('click', function () {
    syncAllSpeakersFromDom()
    var missingSpeakers = findMissingRoleSpeakers()
    if (missingSpeakers.length > 0) {
      var first = missingSpeakers[0]
      window.alert(
        '请先为所有 speaker 勾选角色（客户方/我方），未勾选：' +
          missingSpeakers.join('、')
      )
      if (elSpeakerMap && elSpeakerMap.scrollIntoView) {
        elSpeakerMap.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      var firstRadio = elSpeakerMap
        ? elSpeakerMap.querySelector('.speaker-role-radio[data-map-speaker="' + first + '"]')
        : null
      if (firstRadio && firstRadio.focus) firstRadio.focus()
      return
    }
    var speakerRolesPayload = buildSpeakerRolesPayload()
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
      body: JSON.stringify({
        token: token,
        dialogues: dialogues,
        speaker_roles: speakerRolesPayload
      })
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
          var failMsg = (r.data && r.data.error) || '保存失败'
          hideMsgs()
          window.alert(failMsg)
          return
        }
        dataDirty = false
        hideMsgs()
        window.alert('保存成功。您可返回企微继续后续流程。')
      })
      .catch(function (e) {
        hideMsgs()
        window.alert((e && e.message) || String(e) || '保存失败')
      })
      .then(function () {
        elSave.disabled = false
      })
  })

  load()
})()
