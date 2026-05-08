import { ref } from 'vue'

// ========== iframe 内注入的编辑脚本 ==========
export const IFRAME_EDIT_SCRIPT = `
(function() {
  var selectedElement = null;
  var hasDragged = false;
  // 拖拽状态全部在 iframe 内管理
  var dragEl = null, dragOx = 0, dragOy = 0, dragSx = 0, dragSy = 0;

  function getXPath(el) {
    if (!el || el === document.body) return '/html/body';
    if (el === document.documentElement) return '/html';
    if (el.id) return '//*[@id="' + el.id + '"]';
    var ix = 0;
    var siblings = el.parentNode ? el.parentNode.childNodes : [];
    for (var i = 0; i < siblings.length; i++) {
      var sib = siblings[i];
      if (sib === el) {
        return getXPath(el.parentNode) + '/' + el.tagName.toLowerCase() + '[' + (ix + 1) + ']';
      }
      if (sib.nodeType === 1 && sib.tagName === el.tagName) ix++;
    }
    return '/html/body';
  }

  function findByXPath(xpath) {
    try {
      return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    } catch(e) { return null; }
  }

  function getElementStyles(el) {
    var c = window.getComputedStyle(el);
    return {
      fontSize: c.fontSize,
      color: c.color,
      fontWeight: c.fontWeight,
      fontStyle: c.fontStyle,
      textAlign: c.textAlign,
      lineHeight: c.lineHeight,
      letterSpacing: c.letterSpacing,
      backgroundColor: c.backgroundColor,
      textDecoration: c.textDecoration,
      fontFamily: c.fontFamily
    };
  }

  function clearSelection() {
    if (selectedElement) {
      selectedElement.style.outline = '';
      selectedElement = null;
    }
    hasDragged = false;
  }

  function showSelection(el) {
    clearSelection();
    selectedElement = el;
    el.style.setProperty('outline', '2px solid #4f46e5', 'important');
    el.style.setProperty('outline-offset', '2px', 'important');
  }

  function reportElementInfo(el) {
    var rect = el.getBoundingClientRect();
    window.parent.postMessage({
      type: 'elementClick',
      data: {
        xpath: getXPath(el),
        tagName: el.tagName,
        text: (el.textContent || '').substring(0, 100),
        styles: getElementStyles(el),
        boundingRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
      }
    }, '*');
  }

  // ===== 拖拽：完全在 iframe 内处理，不依赖父窗口 mousemove =====
  function onDragMove(e) {
    if (!dragEl) return;
    var dx = e.clientX - dragSx;
    var dy = e.clientY - dragSy;
    var tx = dragOx + dx;
    var ty = dragOy + dy;
    dragEl.style.setProperty('transform', 'translate(' + tx + 'px, ' + ty + 'px)', 'important');
    hasDragged = true;
    e.preventDefault();
  }

  function onDragUp(e) {
    if (!dragEl) return;
    document.removeEventListener('mousemove', onDragMove, true);
    document.removeEventListener('mouseup', onDragUp, true);
    if (hasDragged) {
      var existing = dragEl.style.transform || '';
      var match = existing.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
      var tx = match ? parseFloat(match[1]) : dragOx;
      var ty = match ? parseFloat(match[2]) : dragOy;
      window.parent.postMessage({
        type: 'dragEnd',
        data: { xpath: getXPath(dragEl), transform: 'translate(' + tx + 'px, ' + ty + 'px)' }
      }, '*');
      reportElementInfo(dragEl);
    }
    dragEl = null;
  }

  // mousedown：判断是否命中已选元素，是则开始拖拽
  document.addEventListener('mousedown', function(e) {
    if (!selectedElement || e.target.contentEditable === 'true') return;
    if (e.button !== 0) return;
    // 用 boundingRect 判断点击是否在选中元素范围内，兼容嵌套元素
    var rect = selectedElement.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

    e.preventDefault();
    e.stopPropagation();

    var existing = selectedElement.style.transform || '';
    var match = existing.match(/translate\\(([-\\d.]+)px,\\s*([-\\d.]+)px\\)/);
    dragEl = selectedElement;
    dragOx = match ? parseFloat(match[1]) : 0;
    dragOy = match ? parseFloat(match[2]) : 0;
    dragSx = e.clientX;
    dragSy = e.clientY;

    document.addEventListener('mousemove', onDragMove, true);
    document.addEventListener('mouseup', onDragUp, true);
  }, true);

  // click：选中元素
  document.addEventListener('click', function(e) {
    if (e.target.contentEditable === 'true') return;
    if (hasDragged) { hasDragged = false; return; }

    e.preventDefault();
    e.stopPropagation();

    showSelection(e.target);
    reportElementInfo(e.target);
  }, true);

  // dblclick：内联编辑 或 替换图片
  document.addEventListener('dblclick', function(e) {
    if (e.target.tagName === 'IMG') {
      window.parent.postMessage({
        type: 'replaceImg',
        data: { xpath: getXPath(e.target), src: e.target.src || '', alt: e.target.alt || '' }
      }, '*');
      return;
    }
    e.target.contentEditable = 'true';
    e.target.focus();
    var range = document.createRange();
    range.selectNodeContents(e.target);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // blur：文本编辑结束，只上报变化的 xpath + 新 innerHTML
  document.addEventListener('blur', function(e) {
    if (e.target.contentEditable === 'true' && selectedElement === e.target) {
      e.target.contentEditable = 'false';
      window.parent.postMessage({
        type: 'textChange',
        data: {
          xpath: getXPath(e.target),
          innerHTML: e.target.innerHTML
        }
      }, '*');
    }
  }, true);

  // keydown：编辑中按 Escape 退出
  document.addEventListener('keydown', function(e) {
    if (e.target.contentEditable === 'true') {
      if (e.key === 'Escape') {
        e.target.contentEditable = 'false';
        e.target.blur();
      }
      e.stopPropagation();
    }
  }, true);

  // 监听父窗口命令
  window.addEventListener('message', function(e) {
    var msg = e.data;
    if (!msg || !msg.type) return;

    if (msg.type === 'UPDATE_ELEMENT_STYLE') {
      var el = findByXPath(msg.id) || document.getElementById(msg.id);
      if (!el) return;
      var props = Array.isArray(msg.styleProperty) ? msg.styleProperty : [msg.styleProperty];
      var vals = Array.isArray(msg.styleValue) ? msg.styleValue : [msg.styleValue];
      for (var i = 0; i < props.length; i++) {
        if (props[i] === 'innerHTML') {
          el.innerHTML = vals[i];
        } else if (props[i] === 'innerText' || props[i] === 'textContent') {
          el.textContent = vals[i];
        } else if (props[i] === 'src') {
          el.setAttribute('src', vals[i]);
        } else {
          el.style.setProperty(props[i], vals[i], 'important');
        }
      }
    } else if (msg.type === 'SET_HTML') {
      // 仅用于 AI 编辑等无法细分的整页替换
      try {
        var parser = new DOMParser();
        var newDoc = parser.parseFromString(msg.content, 'text/html');
        document.body.innerHTML = newDoc.body.innerHTML;
        Array.from(document.querySelectorAll('style')).forEach(function(s) { s.remove(); });
        Array.from(newDoc.querySelectorAll('style')).forEach(function(s) {
          document.head.appendChild(document.importNode(s, true));
        });
        clearSelection();
      } catch(err) {}
    } else if (msg.type === 'DESELECT_ALL') {
      clearSelection();
    }
  });
})();
`

// ========== HTML 字符串修改（课件帮 lt() 函数的复刻）==========
export function modifyHtml(
  html: string,
  idType: string,
  id: string,
  styleProps: string | string[],
  styleValues: string | string[],
): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  let element: Element | null = null
  if (idType === 'id') element = doc.getElementById(id)
  else if (idType === 'class') element = doc.getElementsByClassName(id)[0]
  else if (idType === 'xpath') {
    try {
      element = doc.evaluate(id, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as Element
    } catch { element = null }
  } else {
    try { element = doc.querySelector(id) } catch { element = null }
  }

  if (!element) return html

  const props = Array.isArray(styleProps) ? styleProps : [styleProps]
  const values = Array.isArray(styleValues) ? styleValues : [styleValues]

  for (let i = 0; i < props.length; i++) {
    const prop = props[i]
    const value = values[i]
    if (prop === 'innerHTML') {
      element.innerHTML = value
    } else if (prop === 'innerText' || prop === 'textContent') {
      element.textContent = value
    } else if (prop === 'src') {
      element.setAttribute('src', value)
    } else if (prop === 'backgroundImage') {
      ;(element as HTMLElement).style.backgroundImage = `url('${value}')`
    } else {
      ;(element as HTMLElement).style.setProperty(prop, value, 'important')
    }
  }

  return doc.documentElement.outerHTML
}

// 从 HTML 字符串中读取指定元素的属性值
export function getElementPropFromHtml(html: string, xpath: string, prop: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const el = doc.evaluate(xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as HTMLElement
    if (!el) return ''
    if (prop === 'innerHTML') return el.innerHTML
    if (prop === 'textContent') return el.textContent || ''
    if (prop === 'src') return el.getAttribute('src') || ''
    if (prop === 'transform') return el.style.transform || ''
    return (el.style as any)[prop] || ''
  } catch {
    return ''
  }
}

// ========== UndoAction 类型 ==========
// 属性级变更（样式、文字、拖拽、删除）→ 撤销时用 UPDATE_ELEMENT_STYLE，无感
export interface StyleUndoAction {
  type: 'style'
  slideId: number  // slide.index 稳定 ID，不受拖动排序影响
  xpath: string
  idType: string
  prop: string | string[]
  oldValue: string | string[]
  newValue: string | string[]
}

// 整页替换（AI编辑、图片替换）→ 撤销时用 SET_HTML
export interface HtmlUndoAction {
  type: 'html'
  slideId: number  // slide.index 稳定 ID，不受拖动排序影响
  oldHtml: string
  newHtml: string
}

export type UndoAction = StyleUndoAction | HtmlUndoAction

// ========== composable ==========
export interface SelectedElementInfo {
  xpath: string
  tagName: string
  text: string
  styles: Record<string, string>
}

export function useSlideEditor() {
  const selectedElementInfo = ref<SelectedElementInfo | null>(null)
  const undoStack = ref<UndoAction[]>([])
  const redoStack = ref<UndoAction[]>([])
  const canUndo = ref(false)
  const canRedo = ref(false)

  function updateStackState() {
    canUndo.value = undoStack.value.length > 0
    canRedo.value = redoStack.value.length > 0
  }

  // 属性级提交：只记录 diff，htmlContent 用 modifyHtml 更新
  function commitStyleEdit(
    slides: any[], slideIndex: number,
    xpath: string, idType: string,
    prop: string | string[], oldValue: string | string[], newValue: string | string[],
  ) {
    const slide = slides[slideIndex]
    if (!slide) return
    undoStack.value.push({ type: 'style', slideId: slide.index, xpath, idType, prop, oldValue, newValue })
    redoStack.value = []
    slide.htmlContent = modifyHtml(slide.htmlContent, idType, xpath, prop, newValue)
    updateStackState()
  }

  // 整页替换提交（AI编辑等）
  function commitHtmlEdit(slides: any[], slideIndex: number, oldHtml: string, newHtml: string) {
    const slide = slides[slideIndex]
    if (!slide) return
    undoStack.value.push({ type: 'html', slideId: slide.index, oldHtml, newHtml })
    redoStack.value = []
    slide.htmlContent = newHtml
    updateStackState()
  }

  function undo(slides: any[]): UndoAction | null {
    const action = undoStack.value.pop()
    if (!action) return null
    redoStack.value.push(action)
    const slide = slides.find((s: any) => s.index === action.slideId)
    if (slide) {
      if (action.type === 'style') {
        slide.htmlContent = modifyHtml(slide.htmlContent, action.idType, action.xpath, action.prop, action.oldValue)
      } else {
        slide.htmlContent = action.oldHtml
      }
    }
    updateStackState()
    return action
  }

  function redo(slides: any[]): UndoAction | null {
    const action = redoStack.value.pop()
    if (!action) return null
    undoStack.value.push(action)
    const slide = slides.find((s: any) => s.index === action.slideId)
    if (slide) {
      if (action.type === 'style') {
        slide.htmlContent = modifyHtml(slide.htmlContent, action.idType, action.xpath, action.prop, action.newValue)
      } else {
        slide.htmlContent = action.newHtml
      }
    }
    updateStackState()
    return action
  }

  function clearStacks() {
    undoStack.value = []
    redoStack.value = []
    updateStackState()
  }

  function injectEditingScript(iframe: HTMLIFrameElement) {
    try {
      const doc = iframe.contentDocument
      if (!doc) return
      const script = doc.createElement('script')
      script.textContent = IFRAME_EDIT_SCRIPT
      ;(doc.head || doc.documentElement).appendChild(script)
      script.remove()
    } catch (e) {
      console.error('[Editor] inject editing script failed:', e)
    }
  }

  function sendMessageToIframe(iframe: HTMLIFrameElement, msg: any) {
    try {
      iframe.contentWindow?.postMessage(msg, '*')
    } catch {}
  }

  return {
    selectedElementInfo,
    canUndo,
    canRedo,
    commitStyleEdit,
    commitHtmlEdit,
    undo,
    redo,
    clearStacks,
    injectEditingScript,
    sendMessageToIframe,
  }
}
