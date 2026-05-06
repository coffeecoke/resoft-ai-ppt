<template>
  <div class="ppt-editor" @keydown="onKeyDown" tabindex="0">
    <!-- 顶部工具栏 -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <span class="back-btn" @click="router.back()">← 返回</span>
        <span class="ppt-title">{{ project?.topic || '未命名PPT' }}</span>
      </div>
      <div class="topbar-center">
        <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
          <span class="tb-btn" :class="{ disabled: !canUndo }" @click="handleUndo">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M3.3 7.7l4-4a1 1 0 011.4 1.4L6.4 7.4H13a5 5 0 010 10H8a1 1 0 010-2h5a3 3 0 000-6H6.4l2.3 2.3a1 1 0 01-1.4 1.4l-4-4a1 1 0 010-1.4z"/></svg>
          </span>
        </el-tooltip>
        <el-tooltip content="重做 (Ctrl+Y)" placement="bottom">
          <span class="tb-btn" :class="{ disabled: !canRedo }" @click="handleRedo">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M16.7 7.7l-4-4a1 1 0 00-1.4 1.4l2.3 2.3H7a5 5 0 000 10h5a1 1 0 000-2H7a3 3 0 010-6h6.6l-2.3 2.3a1 1 0 001.4 1.4l4-4a1 1 0 000-1.4z"/></svg>
          </span>
        </el-tooltip>
      </div>
      <div class="topbar-right">
        <el-button size="small" plain @click="rightPanel = rightPanel === 'ai' ? '' : 'ai'">AI写辅助</el-button>
        <el-button size="small" plain @click="rightPanel = rightPanel === 'material' ? '' : 'material'">素材</el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveChanges">保存</el-button>
        <el-button size="small" disabled>导出PPTX</el-button>
      </div>
    </div>

    <div class="editor-body">
      <!-- 左侧缩略图 -->
      <div class="thumbnail-panel">
        <div
          v-for="(slide, i) in slides"
          :key="slide.index"
          class="thumb-item"
          :class="{ active: currentIndex === i, loading: slide.pptLoading }"
          @click="selectSlide(i)"
        >
          <div class="thumb-num">{{ i + 1 }}</div>
          <div class="thumb-img-wrap">
            <img v-if="slide.previewUrl && !slide.pptLoading" :src="slide.previewUrl" class="thumb-img" />
            <div v-else class="thumb-skeleton">
              <div v-if="slide.pptLoading" class="skeleton-shimmer" />
              <span v-else class="thumb-type">{{ slide.pageType }}</span>
            </div>
          </div>
        </div>

        <!-- 生成中还没出现的占位 -->
        <div v-if="taskStatus === 'generating'" class="thumb-generating">
          <div class="gen-dot-row">
            <div class="gen-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }" />
          </div>
          <span>生成中 {{ genProgress.completed }}/{{ genProgress.total }}</span>
        </div>
        <div v-if="taskStatus === 'failed' && slides.length === 0" class="thumb-generating failed">
          <span style="color:#ef4444">任务已过期</span>
          <el-button size="small" type="primary" @click="router.push({ name: 'AIPPTHome' })">重新创建</el-button>
        </div>
      </div>

      <!-- 中间画布 -->
      <div class="canvas-area" @click="deselectOnCanvasClick">
        <template v-if="currentSlide">
          <!-- 幻灯片预览区 -->
          <div class="slide-preview" ref="slidePreviewRef">
            <div class="slide-container" :style="slideContainerStyle">
              <!-- iframe 独立裁剪层，保留圆角和内容裁剪 -->
              <div class="iframe-clip">
                <iframe
                  ref="slideIframe"
                  :srcdoc="iframeSrcdoc"
                  sandbox="allow-scripts allow-same-origin"
                  class="slide-iframe"
                  @load="onIframeLoad"
                />
              </div>
              <!-- 工具栏：transform 定位，slide-container 改 overflow:visible 后可溢出 -->
              <StyleToolbar
                v-if="selectedElementInfo"
                :elementInfo="selectedElementInfo"
                :toolbarStyle="floatingToolbarStyle"
                @styleChange="onStyleChange"
                @deleteElement="onDeleteElement"
                @aiEdit="onToolbarAiEdit"
              />
            </div>
          </div>

          <!-- 演讲稿 -->
          <div class="speaker-notes">
            <div class="notes-label">演讲稿</div>
            <el-input
              v-model="currentSlide.scriptContent"
              type="textarea"
              :rows="3"
              placeholder="在此输入演讲备注..."
              class="notes-input"
            />
          </div>
        </template>
        <div v-else class="canvas-empty">
          <el-icon><Picture /></el-icon>
          <span>暂无幻灯片</span>
        </div>
      </div>

      <!-- 右侧面板 -->
      <div v-if="rightPanel" class="right-panel">
        <!-- AI写辅助面板 -->
        <template v-if="rightPanel === 'ai'">
          <div class="panel-header">
            <span>AI写辅助</span>
            <el-icon class="close-icon" @click="rightPanel = ''"><Close /></el-icon>
          </div>
          <div class="ai-chat-body" ref="chatBodyRef">
            <div v-for="(msg, i) in chatHistory" :key="i" class="chat-msg" :class="msg.role">
              <div class="msg-bubble">{{ msg.content }}</div>
            </div>
            <div v-if="aiEditing" class="chat-msg assistant">
              <div class="msg-bubble typing">AI 正在修改...</div>
            </div>
          </div>
          <div class="ai-chat-input">
            <el-input
              v-model="aiInstruction"
              placeholder="输入修改要求，如：把标题改得更有吸引力"
              type="textarea"
              :rows="2"
              @keydown.ctrl.enter="sendAiEdit"
            />
            <el-button type="primary" size="small" :loading="aiEditing" @click="sendAiEdit">发送</el-button>
          </div>
        </template>

        <!-- 素材面板 -->
        <template v-if="rightPanel === 'material'">
          <div class="panel-header">
            <span>素材</span>
            <el-icon class="close-icon" @click="rightPanel = ''"><Close /></el-icon>
          </div>
          <div class="material-tabs">
            <span
              v-for="tab in materialTabs"
              :key="tab.key"
              class="mat-tab"
              :class="{ active: materialTab === tab.key }"
              @click="materialTab = tab.key"
            >{{ tab.label }}</span>
          </div>

          <!-- 图库搜图 -->
          <template v-if="materialTab === 'search'">
            <div class="search-bar">
              <el-input v-model="imageKeyword" placeholder="搜索图片" @keydown.enter="searchImages">
                <template #suffix><el-icon @click="searchImages"><Search /></el-icon></template>
              </el-input>
            </div>
            <div class="image-grid">
              <div
                v-for="img in imageResults"
                :key="img.id"
                class="img-card"
                @click="replaceImage(img.url || img.regularUrl)"
              >
                <img :src="img.smallUrl || img.url" loading="lazy" />
              </div>
              <div v-if="imageLoading" class="img-loading">加载中...</div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Picture, Close, Search } from '@element-plus/icons-vue'
import { aipptGenApi } from '@/services/aipptGenService'
import StyleToolbar from './components/StyleToolbar.vue'
import { useSlideEditor, modifyHtml, getElementPropFromHtml, type UndoAction } from './composables/useSlideEditor'

const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId as string
const taskId = ref(sessionStorage.getItem('aippt_taskId') || '')

const project = ref<any>(null)
const slides = ref<any[]>([])
const currentIndex = ref(0)
const currentSlide = computed(() => slides.value[currentIndex.value] || null)

const taskStatus = ref<'generating' | 'completed' | 'failed'>('generating')
const genProgress = ref({ total: 0, completed: 0 })

const rightPanel = ref<'' | 'ai' | 'material'>('')
const materialTab = ref('search')
const materialTabs = [{ key: 'search', label: '图库搜图' }]

const aiInstruction = ref('')
const aiEditing = ref(false)
const chatHistory = ref<{ role: string; content: string }[]>([])
const chatBodyRef = ref<HTMLElement>()

const imageKeyword = ref('')
const imageResults = ref<any[]>([])
const imageLoading = ref(false)

const saving = ref(false)
const slidePreviewRef = ref<HTMLElement>()
const slideIframe = ref<HTMLIFrameElement>()
const scale = ref(0.7)

// 追踪当前会话中被修改过的 slides 索引（用于增量保存）
const dirtySlideIndexes = ref<Set<number>>(new Set())

// iframe srcdoc 独立管理，避免编辑时触发重载
const iframeSrcdoc = ref('')

const slideContainerStyle = computed(() => ({
  width: `${1280 * scale.value}px`,
  height: `${720 * scale.value}px`,
  position: 'relative' as const,
}))

const loadingHtml = `<html><body style="margin:0;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#f9fafb"><div style="text-align:center;color:#9ca3af;font-family:sans-serif"><div style="font-size:24px;margin-bottom:8px">⏳</div><div>AI 正在生成...</div></div></body></html>`

// 编辑功能
const {
  selectedElementInfo, canUndo, canRedo,
  commitStyleEdit, commitHtmlEdit, undo, redo, clearStacks,
  injectEditingScript, sendMessageToIframe,
} = useSlideEditor()

// 选中元素的边界矩形（iframe 坐标系）
const selectedRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)

// 浮动工具栏位置：position:absolute 锚在 slide-container 左上角，transform 移到元素上方
// slide-container 改为 overflow:visible，工具栏可以向上溢出到 slide 外
const floatingToolbarStyle = computed(() => {
  if (!selectedRect.value) return { display: 'none' }
  const r = selectedRect.value
  const s = scale.value
  const toolbarH = 40
  const gap = 6
  // 元素在 slide-container 内的位置（iframe 坐标 × scale）
  const x = r.left * s
  const y = r.top * s
  const elemBottom = (r.top + r.height) * s
  // 优先放元素上方；若元素太靠上则放元素下方
  const ty = y - toolbarH - gap >= 0 ? y - toolbarH - gap : elemBottom + gap
  return {
    position: 'absolute' as const,
    left: '0px',
    top: '0px',
    transform: `translate(${x}px, ${ty}px)`,
    zIndex: 9999,
  }
})

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollRetryCount = 0
let resizeObserver: ResizeObserver | null = null


// srcdoc iframe 的 origin 是 null，无法解析 /libs/ 等绝对路径，需注入 <base> 让浏览器知道根地址
function withBaseTag(html: string): string {
  if (html.includes('<base ')) return html
  const base = `<base href="${window.location.origin}/">`
  return html.includes('<head>') ? html.replace('<head>', `<head>${base}`) : html.replace('<html>', `<html><head>${base}</head>`)
}

function syncIframeSrcdoc() {
  const slide = currentSlide.value
  if (slide) {
    iframeSrcdoc.value = withBaseTag(slide.htmlContent || loadingHtml)
  }
  selectedElementInfo.value = null
  selectedRect.value = null
}

onMounted(async () => {
  // 加载项目（如果存在）
  try {
    const res = await aipptGenApi.getProject(projectId)
    project.value = (res as any).data
    if (project.value?.slides?.length) {
      slides.value = project.value.slides
      taskStatus.value = 'completed'
      syncIframeSrcdoc()
    }
  } catch {}

  updateScale()
  resizeObserver = new ResizeObserver(updateScale)
  const setupObserver = () => {
    nextTick(() => {
      if (resizeObserver && slidePreviewRef.value) {
        resizeObserver.disconnect()
        resizeObserver.observe(slidePreviewRef.value)
      }
    })
  }
  setupObserver()
  // 只在切换页面时重载 iframe，编辑操作通过 postMessage 无感更新
  watch(currentIndex, () => { setupObserver(); syncIframeSrcdoc() })

  const hasLoading = slides.value.some(s => s.pptLoading)
  if (taskId.value && (slides.value.length === 0 || hasLoading)) {
    pollRetryCount = 0
    pollTaskStatus()
  }

  // 监听 iframe postMessage
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
  resizeObserver?.disconnect()
  window.removeEventListener('message', handleIframeMessage)
})

function updateScale() {
  if (!slidePreviewRef.value) return
  const { clientWidth, clientHeight } = slidePreviewRef.value
  const availW = clientWidth - 48
  const availH = clientHeight - 48
  scale.value = Math.min(availW / 1280, availH / 720, 1)
}

async function pollTaskStatus() {
  if (!taskId.value) return
  try {
    const res = await aipptGenApi.getTaskStatus(taskId.value)
    const data = (res as any).data
    if (!data) {
      // 任务不存在（后端重启丢失），尝试从项目恢复
      if (slides.value.length > 0) {
        taskStatus.value = 'completed'
      } else {
        taskStatus.value = 'failed'
        ElMessage.warning('任务已过期，请重新生成')
      }
      return
    }
    taskStatus.value = data.status
    genProgress.value = data.progress || { total: 0, completed: 0 }

    // 合并新生成的 slides
    for (const s of (data.slides || [])) {
      const existing = slides.value.find(x => x.index === s.index)
      if (!existing) {
        slides.value.push(s)
        slides.value.sort((a, b) => a.index - b.index)
      } else if (existing.pptLoading && !s.pptLoading) {
        Object.assign(existing, s)
      }
    }
    // 当前页内容更新时同步 iframe
    if (currentSlide.value?.htmlContent && !iframeSrcdoc.value) {
      iframeSrcdoc.value = currentSlide.value.htmlContent
    }

    if (data.status === 'generating') {
      pollTimer = setTimeout(pollTaskStatus, 3000)
    } else if (data.status === 'completed') {
      // 保存最终 slides 到项目
      await aipptGenApi.batchUpdate(projectId, [])
      saveSlides()
    }
  } catch (err: any) {
    // axios 拦截器已把 404 包装成 Error('任务不存在')，原始 response 丢失
    // 所以用错误消息内容判断
    const msg = err?.message || String(err)
    if (msg.includes('任务不存在') || msg.includes('404') || err?.response?.status === 404) {
      if (slides.value.length > 0) {
        taskStatus.value = 'completed'
      } else {
        taskStatus.value = 'failed'
        ElMessage.warning('任务已过期，请重新生成')
      }
      return
    }
    // 网络错误等其他情况，最多重试3次后停止
    pollRetryCount++
    if (pollRetryCount >= 3) {
      taskStatus.value = slides.value.length > 0 ? 'completed' : 'failed'
      if (slides.value.length === 0) ElMessage.warning('无法连接服务器，请稍后重试')
      return
    }
    pollTimer = setTimeout(pollTaskStatus, 5000)
  }
}

async function saveSlides() {
  try {
    await aipptGenApi.createProject({
      id: projectId,
      topic: project.value?.topic,
      themeId: project.value?.themeId,
      outline: project.value?.outline,
      slides: slides.value,
    })
  } catch {}
}

function selectSlide(i: number) {
  currentIndex.value = i
}

function onIframeLoad() {
  if (!slideIframe.value) return
  injectEditingScript(slideIframe.value)
}

// ========== 编辑消息处理 ==========
function handleIframeMessage(e: MessageEvent) {
  const msg = e.data
  if (!msg?.type) return

  if (msg.type === 'elementClick') {
    selectedElementInfo.value = msg.data || null
    selectedRect.value = msg.data?.boundingRect || null
  } else if (msg.type === 'dragEnd') {
    const { xpath, transform } = msg.data
    if (!currentSlide.value?.htmlContent || !xpath) return
    const oldTransform = getElementPropFromHtml(currentSlide.value.htmlContent, xpath, 'transform')
    commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'transform', oldTransform, transform)
    dirtySlideIndexes.value.add(currentIndex.value)
  } else if (msg.type === 'textChange') {
    // 双击编辑完成后，以 innerHTML diff 方式记录，撤销时无感
    const { xpath, innerHTML: newInner } = msg.data
    if (!xpath || !currentSlide.value?.htmlContent) return
    const oldInner = getElementPropFromHtml(currentSlide.value.htmlContent, xpath, 'innerHTML')
    if (oldInner === newInner) return
    commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'innerHTML', oldInner, newInner)
    dirtySlideIndexes.value.add(currentIndex.value)
  } else if (msg.type === 'replaceImg') {
    rightPanel.value = 'material'
  }
}

function onStyleChange(prop: string, value: string) {
  if (!selectedElementInfo.value?.xpath || !currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value.xpath
  // 从 selectedElementInfo.styles 取当前值作为旧值
  const styleKey = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const oldValue = (selectedElementInfo.value.styles as any)[styleKey] || ''
  commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', prop, oldValue, value)
  dirtySlideIndexes.value.add(currentIndex.value)
  // 同步 iframe 内的视觉（无感）
  sendMessageToIframe(slideIframe.value!, {
    type: 'UPDATE_ELEMENT_STYLE',
    id: xpath,
    styleProperty: [prop],
    styleValue: [value],
  })
  ;(selectedElementInfo.value.styles as any)[styleKey] = value
}

function onDeleteElement() {
  if (!selectedElementInfo.value?.xpath || !currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value.xpath
  const oldDisplay = (selectedElementInfo.value.styles as any).display || 'block'
  commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'display', oldDisplay, 'none')
  dirtySlideIndexes.value.add(currentIndex.value)
  selectedElementInfo.value = null
  selectedRect.value = null
  sendMessageToIframe(slideIframe.value!, {
    type: 'UPDATE_ELEMENT_STYLE',
    id: xpath,
    styleProperty: ['display'],
    styleValue: ['none'],
  })
}

function onToolbarAiEdit() {
  rightPanel.value = rightPanel.value === 'ai' ? '' : 'ai'
}

function deselectOnCanvasClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.slide-container')) return
  selectedElementInfo.value = null
  selectedRect.value = null
  if (slideIframe.value) {
    sendMessageToIframe(slideIframe.value, { type: 'DESELECT_ALL' })
  }
}

function applyActionToIframe(action: UndoAction, direction: 'undo' | 'redo') {
  if (action.slideIndex !== currentIndex.value) return
  if (action.type === 'style') {
    // 属性级更新，完全无感，不触发动画重播
    sendMessageToIframe(slideIframe.value!, {
      type: 'UPDATE_ELEMENT_STYLE',
      id: action.xpath,
      styleProperty: action.prop,
      styleValue: direction === 'undo' ? action.oldValue : action.newValue,
    })
  } else {
    // 整页替换（AI编辑等）
    sendMessageToIframe(slideIframe.value!, {
      type: 'SET_HTML',
      content: direction === 'undo' ? action.oldHtml : action.newHtml,
    })
  }
}

function handleUndo() {
  const action = undo(slides.value)
  if (!action) return
  selectedElementInfo.value = null
  selectedRect.value = null
  dirtySlideIndexes.value.add(action.slideIndex)
  applyActionToIframe(action, 'undo')
}

function handleRedo() {
  const action = redo(slides.value)
  if (!action) return
  selectedElementInfo.value = null
  selectedRect.value = null
  dirtySlideIndexes.value.add(action.slideIndex)
  applyActionToIframe(action, 'redo')
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    handleUndo()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    handleRedo()
  } else if (e.key === 'Delete' && selectedElementInfo.value) {
    e.preventDefault()
    onDeleteElement()
  }
}

async function sendAiEdit() {
  if (!aiInstruction.value.trim() || !currentSlide.value?.htmlContent) return
  const instruction = aiInstruction.value.trim()
  chatHistory.value.push({ role: 'user', content: instruction })
  aiInstruction.value = ''
  aiEditing.value = true

  try {
    const res = await aipptGenApi.aiEdit(currentSlide.value.htmlContent, instruction)
    const newHtml = (res as any).data?.htmlContent
    if (newHtml) {
      commitHtmlEdit(slides.value, currentIndex.value, currentSlide.value!.htmlContent, newHtml)
      dirtySlideIndexes.value.add(currentIndex.value)
      sendMessageToIframe(slideIframe.value!, { type: 'SET_HTML', content: newHtml })
      chatHistory.value.push({ role: 'assistant', content: '已完成修改 ✓' })
      nextTick(() => {
        if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
      })
    }
  } catch (err: any) {
    chatHistory.value.push({ role: 'assistant', content: '修改失败：' + err.message })
  } finally {
    aiEditing.value = false
  }
}

async function searchImages() {
  if (!imageKeyword.value.trim()) return
  imageLoading.value = true
  try {
    const res = await aipptGenApi.searchImages(imageKeyword.value)
    imageResults.value = (res as any).data || []
  } catch (err: any) {
    ElMessage.error('搜图失败：' + err.message)
  } finally {
    imageLoading.value = false
  }
}

function replaceImage(url: string) {
  if (!currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value?.xpath
  const oldHtml = currentSlide.value.htmlContent
  let newHtml: string
  if (xpath) {
    newHtml = modifyHtml(oldHtml, 'xpath', xpath, 'src', url)
  } else {
    newHtml = oldHtml.replace(/<img([^>]*?)>/, (match) => {
      if (match.includes('src=')) return match
      return match.replace(/<img/, `<img src="${url}"`)
    })
  }
  commitHtmlEdit(slides.value, currentIndex.value, oldHtml, newHtml)
  dirtySlideIndexes.value.add(currentIndex.value)
  sendMessageToIframe(slideIframe.value!, { type: 'SET_HTML', content: newHtml })
  ElMessage.success('图片已替换')
}

async function saveChanges() {
  if (!slides.value.length) return

  // 只传本次会话中被修改过的 slides（增量保存）
  const dirtySlides = slides.value.filter(s => dirtySlideIndexes.value.has(s.index))
  if (dirtySlides.length === 0) {
    ElMessage.info('没有需要保存的修改')
    return
  }

  saving.value = true
  try {
    const changedSlides = dirtySlides
      .filter(s => s.htmlContent && !s.pptLoading)
      .map(s => ({ index: s.index, htmlContent: s.htmlContent }))

    const res = await aipptGenApi.batchUpdate(projectId, changedSlides)
    const updated = (res as any).data?.updated_pages || []

    // 更新左侧缩略图（加时间戳破浏览器缓存）
    const ts = Date.now()
    for (const u of updated) {
      const slide = slides.value.find(s => s.index === u.index)
      if (slide && u.previewUrl) {
        const url = u.previewUrl
        slide.previewUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + ts
      }
    }

    // 清空脏标记
    dirtySlideIndexes.value.clear()

    const savedCount = updated.length
    ElMessage.success(`已保存 ${savedCount} 个页面`)
  } catch (err: any) {
    ElMessage.error('保存失败：' + err.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.ppt-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f1f3f5;
  overflow: hidden;
}

.editor-topbar {
  height: 52px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  z-index: 100;
}
.topbar-left { display: flex; align-items: center; gap: 14px; }
.topbar-center { display: flex; align-items: center; gap: 4px; }
.back-btn { font-size: 13px; color: #6b7280; cursor: pointer; &:hover { color: #374151; } }
.ppt-title { font-size: 14px; font-weight: 500; color: #374151; }
.topbar-right { display: flex; align-items: center; gap: 8px; }

// 通用工具栏按钮
.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  font-size: 14px;
  transition: all 0.15s;

  &:hover { background: #f3f4f6; color: #374151; }
  &.disabled { opacity: 0.35; cursor: default; pointer-events: none; }
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 左侧缩略图
.thumbnail-panel {
  width: 160px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  padding: 12px 8px;
  flex-shrink: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
}

.thumb-item {
  cursor: pointer;
  margin-bottom: 10px;
  border-radius: 6px;
  border: 2px solid transparent;
  overflow: hidden;
  transition: all 0.15s;
  position: relative;

  &:hover { border-color: #a5b4fc; }
  &.active { border-color: #6366f1; box-shadow: 0 0 0 1px rgba(99,102,241,0.3); }
  &.loading { opacity: 0.6; }
}

.thumb-num {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 10px;
  color: #fff;
  background: rgba(0,0,0,0.4);
  padding: 1px 5px;
  border-radius: 3px;
  z-index: 1;
}

.thumb-img-wrap { width: 100%; aspect-ratio: 16/9; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-skeleton {
  width: 100%;
  height: 100%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  .thumb-type { font-size: 10px; color: #9ca3af; }
}
.skeleton-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
}

.thumb-generating {
  text-align: center;
  padding: 12px 0;
  color: #9ca3af;
  font-size: 11px;
}
.gen-dot-row { display: flex; justify-content: center; gap: 4px; margin-bottom: 6px; }
.gen-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #6366f1;
  animation: bounce 1s infinite;
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
}

// 中间画布
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 12px;
  padding: 16px;
}

.slide-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.06);
  background-image: radial-gradient(rgba(209, 213, 219, 0.4) 1px, transparent 1px);
  background-size: 24px 24px;
  overflow: hidden;
}

.slide-container {
  /* overflow:visible 让工具栏能溢出到 slide 上方/下方 */
  overflow: visible;
  position: relative;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  background: #fff;
  border-radius: 8px;
}

/* iframe 独立裁剪层：保留圆角和内容裁剪 */
.iframe-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
}

.slide-iframe {
  width: 1280px;
  height: 720px;
  transform-origin: left top;
  transform: v-bind('`scale(${scale})`');
  border: none;
  display: block;
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
  height: 100%;
  el-icon { font-size: 48px; }
}

.speaker-notes {
  width: 100%;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.notes-label { font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
.notes-input { :deep(.el-textarea__inner) { font-size: 13px; resize: none; border: none; padding: 0; box-shadow: none; } }

// 右侧面板
.right-panel {
  width: 300px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.panel-header {
  height: 44px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  .close-icon { cursor: pointer; color: #9ca3af; &:hover { color: #374151; } }
}

// AI 面板
.ai-chat-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chat-msg {
  &.user .msg-bubble { background: #6366f1; color: #fff; margin-left: auto; }
  &.assistant .msg-bubble { background: #f3f4f6; color: #374151; }
}
.msg-bubble {
  display: inline-block;
  max-width: 220px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  &.typing { color: #9ca3af; }
}
.ai-chat-input {
  padding: 10px 12px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 8px;
  :deep(.el-textarea__inner) { font-size: 13px; resize: none; }
}

// 素材面板
.material-tabs {
  display: flex;
  padding: 8px 12px;
  gap: 8px;
  border-bottom: 1px solid #f3f4f6;
}
.mat-tab {
  font-size: 13px;
  padding: 4px 12px;
  border-radius: 16px;
  cursor: pointer;
  color: #6b7280;
  &:hover { color: #6366f1; }
  &.active { background: #ede9fe; color: #6366f1; }
}
.search-bar { padding: 10px 12px; }
.image-grid {
  flex: 1;
  overflow-y: auto;
  padding: 0 12px 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.img-card {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  aspect-ratio: 16/9;
  background: #f3f4f6;
  img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
  &:hover img { transform: scale(1.05); }
}
.img-loading { grid-column: 1/-1; text-align: center; color: #9ca3af; font-size: 13px; padding: 12px; }
</style>
