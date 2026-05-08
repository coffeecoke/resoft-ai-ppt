<template>
  <div class="template-page">
    <!-- 顶部 -->
    <div class="template-header">
      <div class="header-left">
        <span class="back-btn" @click="router.back()">← 返回</span>
        <span class="breadcrumb">为《{{ topic }}》选择PPT模板</span>
      </div>
      <el-button type="primary" :disabled="!selectedTheme" @click="showIllustDialog = true">
        继续生成 →
      </el-button>
    </div>

    <div class="template-body">
      <!-- 左侧大预览 -->
      <div class="preview-area">
        <div v-if="selectedTheme" class="preview-wrap">
          <div class="preview-scale-box" :style="previewScaleStyle">
            <iframe
              v-if="previewHtml"
              :srcdoc="previewHtml"
              sandbox="allow-scripts allow-same-origin"
              class="preview-iframe"
            />
            <div v-else class="preview-loading">
              <el-icon class="loading-icon"><Loading /></el-icon>
            </div>
          </div>
        </div>
        <div v-else class="preview-empty">
          <el-icon><Picture /></el-icon>
          <span>请从右侧选择模板</span>
        </div>

        <!-- 页型切换条 -->
        <div v-if="selectedTheme" class="page-type-tabs">
          <div
            v-for="pt in pageTypes"
            :key="pt.key"
            class="page-type-tab"
            :class="{ active: activePageType === pt.key }"
            @click="switchPageType(pt.key)"
          >{{ pt.label }}</div>
        </div>
      </div>

      <!-- 右侧模板列表 -->
      <div class="template-list-panel">
        <div class="panel-title">主题风格</div>
        <div class="template-grid">
          <div
            v-for="theme in themes"
            :key="theme.id"
            class="theme-card"
            :class="{ active: selectedTheme?.id === theme.id }"
            @click="selectTheme(theme)"
          >
            <div class="theme-preview">
              <div class="theme-name-badge">{{ theme.category }}</div>
              <div class="theme-cover-placeholder">
                <span>{{ theme.name }}</span>
              </div>
            </div>
            <div class="theme-label">{{ theme.name }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 配图模式弹窗 -->
    <el-dialog v-model="showIllustDialog" title="选择配图模式" width="400px" :show-close="false">
      <div class="illust-options">
        <div
          v-for="opt in illustOptions"
          :key="opt.value"
          class="illust-option"
          :class="{ active: illustrationMode === opt.value }"
          @click="illustrationMode = opt.value"
        >
          <div class="opt-title">{{ opt.label }}</div>
          <div class="opt-desc">{{ opt.desc }}</div>
        </div>
      </div>
      <template #footer>
        <el-button @click="showIllustDialog = false">取消</el-button>
        <el-button type="primary" :loading="starting" @click="startGenerate">开始生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Loading, Picture } from '@element-plus/icons-vue'
import { aipptGenApi } from '@/services/aipptGenService'

const router = useRouter()
const topic = ref(sessionStorage.getItem('aippt_topic') || '')
const outline = ref<any>(JSON.parse(sessionStorage.getItem('aippt_outline') || 'null'))
const summary = ref(sessionStorage.getItem('aippt_summary') || '')
const options = ref(JSON.parse(sessionStorage.getItem('aippt_options') || '{}'))

const themes = ref<any[]>([])
const selectedTheme = ref<any>(null)
const previewHtml = ref('')
const activePageType = ref('cover')
const themeHtmlCache = ref<Record<string, Record<string, string>>>({})

const showIllustDialog = ref(false)
const illustrationMode = ref('standard')
const starting = ref(false)

const pageTypes = [
  { key: 'cover', label: '封面' },
  { key: 'catalog', label: '目录' },
  { key: 'chapter', label: '章节' },
  { key: 'content', label: '内容' },
  { key: 'end', label: '结束' },
]

const illustOptions = [
  { value: 'standard', label: '标准配图', desc: '自动搜索图库匹配内容，快速生成' },
  { value: 'none', label: '不配图', desc: '纯文字内容，速度最快' },
]

const previewScaleStyle = computed(() => {
  const w = 700
  const scale = w / 1280
  return { width: `${w}px`, height: `${w * 720 / 1280}px`, position: 'relative' as const }
})

onMounted(async () => {
  if (!outline.value) { router.push({ name: 'AIPPTHome' }); return }
  const res = await aipptGenApi.getThemes()
  themes.value = (res as any).data || []
})

async function selectTheme(theme: any) {
  selectedTheme.value = theme
  activePageType.value = 'cover'
  await loadPagePreview(theme.id, 'cover')
}

async function switchPageType(pt: string) {
  activePageType.value = pt
  if (!selectedTheme.value) return
  await loadPagePreview(selectedTheme.value.id, pt)
}

async function loadPagePreview(themeId: string, pageType: string) {
  previewHtml.value = ''
  const cache = themeHtmlCache.value
  if (cache[themeId]?.[pageType]) {
    previewHtml.value = cache[themeId][pageType]
    return
  }
  try {
    const res = await aipptGenApi.getThemeHtml(themeId, pageType)
    const html = (res as any).data?.html
    if (html) {
      if (!cache[themeId]) cache[themeId] = {}
      cache[themeId][pageType] = html
      previewHtml.value = html
    }
  } catch {
    previewHtml.value = `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:720px;font-family:sans-serif;color:#9ca3af;background:#f3f4f6"><div>模板预览加载失败</div></body></html>`
  }
}

async function startGenerate() {
  if (!selectedTheme.value || !outline.value) return
  starting.value = true
  try {
    const res = await aipptGenApi.createTask({
      outline: outline.value,
      themeId: selectedTheme.value.id,
      illustrationMode: illustrationMode.value,
      summary: summary.value || undefined,
      options: options.value,
    })
    const { taskId } = (res as any).data

    // 先保存一个空项目，拿到 projectId
    const saveRes = await aipptGenApi.createProject({
      topic: topic.value,
      themeId: selectedTheme.value.id,
      outline: outline.value,
      taskId,
      slides: [],
    })
    const projectId = (saveRes as any).data.id

    sessionStorage.setItem('aippt_taskId', taskId)
    router.push({ name: 'AIPPTEditor', params: { projectId } })
  } catch (err: any) {
    ElMessage.error('创建任务失败：' + err.message)
  } finally {
    starting.value = false
    showIllustDialog.value = false
  }
}
</script>

<style scoped lang="scss">
.template-page {
  height: 100vh;
  overflow: hidden;
  background: #f9fafb;
  display: flex;
  flex-direction: column;
}

.template-header {
  height: 56px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  position: sticky;
  top: 0;
  z-index: 100;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.back-btn { color: #6b7280; cursor: pointer; font-size: 14px; &:hover { color: #374151; } }
.breadcrumb { font-size: 14px; color: #374151; font-weight: 500; }

.template-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 24px;
  gap: 24px;
}

.preview-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.preview-wrap {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.1);
  overflow: hidden;
}

.preview-scale-box {
  overflow: hidden;
  iframe {
    width: 1280px;
    height: 720px;
    transform-origin: top left;
    transform: scale(v-bind('700/1280'));
    border: none;
    display: block;
  }
}

.preview-loading, .preview-empty {
  width: 700px;
  height: 393px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
  font-size: 15px;
  background: #f9fafb;
  border-radius: 12px;
  border: 2px dashed #e5e7eb;
  el-icon { font-size: 48px; }
}

.loading-icon { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.page-type-tabs {
  display: flex;
  gap: 8px;
}
.page-type-tab {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  cursor: pointer;
  background: #f3f4f6;
  color: #6b7280;
  transition: all 0.15s;
  &:hover { background: #ede9fe; color: #6366f1; }
  &.active { background: #6366f1; color: #fff; }
}

.template-list-panel {
  width: 280px;
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  overflow-y: auto;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.panel-title { font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 12px; }

.template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.theme-card {
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s;
  &:hover { border-color: #a5b4fc; }
  &.active { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.2); }
}

.theme-preview {
  position: relative;
  height: 64px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.theme-name-badge {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  background: rgba(255,255,255,0.2);
  color: #fff;
  padding: 1px 6px;
  border-radius: 4px;
}
.theme-cover-placeholder { color: rgba(255,255,255,0.7); font-size: 10px; text-align: center; padding: 0 4px; }
.theme-label { font-size: 11px; color: #374151; padding: 5px 6px; text-align: center; background: #f9fafb; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.illust-options { display: flex; flex-direction: column; gap: 12px; }
.illust-option {
  padding: 14px 16px;
  border-radius: 10px;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #a5b4fc; }
  &.active { border-color: #6366f1; background: #f5f3ff; }
  .opt-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
  .opt-desc { font-size: 12px; color: #6b7280; }
}
</style>
