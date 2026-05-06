<template>
  <div class="outline-page">
    <!-- 顶部导航 -->
    <div class="outline-header">
      <div class="header-left">
        <span class="back-btn" @click="router.back()">←</span>
        <span class="topic-badge">{{ topic }}</span>
        <span v-if="phase === 'analyzing'" class="gen-tag generating">正在整理资料...</span>
        <span v-else-if="phase === 'generating'" class="gen-tag generating">PPT大纲生成中...</span>
        <span v-else-if="phase === 'done'" class="gen-tag done">大纲已生成</span>
      </div>
    </div>

    <div class="outline-body">
      <!-- 整理资料阶段 -->
      <div v-if="phase === 'analyzing'" class="generating-placeholder">
        <div class="gen-progress">
          <div class="gen-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }" />
        </div>
        <div class="gen-text">AI 正在分析您的文档...</div>
        <div class="gen-streaming">{{ analyzeBuffer.slice(-300) }}</div>
      </div>

      <!-- 大纲生成中 -->
      <div v-else-if="phase === 'generating' && !outline" class="generating-placeholder">
        <div class="gen-progress">
          <div class="gen-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }" />
        </div>
        <div class="gen-text">AI 正在生成大纲...</div>
        <div class="gen-streaming">{{ outlineBuffer.slice(-300) }}</div>
      </div>

      <!-- 大纲列表 -->
      <div v-else-if="outline" class="outline-list">
        <!-- 标题编辑区 -->
        <div class="title-section">
          <el-input v-model="outline.title" class="main-title-input" placeholder="PPT主标题" />
          <el-input v-model="outline.subtitle" class="sub-title-input" placeholder="副标题" />
        </div>

        <!-- 页面列表 -->
        <div class="page-list">
          <div v-for="(page, pi) in outline.pages" :key="pi" class="page-row">
            <div class="page-row-main">
              <span class="page-num">P{{ pi + 1 }}</span>
              <span class="page-dot" />
              <span class="page-type-tag" :class="page.type">{{ typeLabel(page.type) }}</span>
              <el-input v-model="page.title" class="page-title-input" placeholder="页面标题" />
              <el-button v-if="canRemove(page.type)" text type="danger" size="small" @click="removePage(pi)">×</el-button>
            </div>
            <!-- 分镜描述 -->
            <div v-if="page.type !== 'cover' && page.type !== 'catalog'" class="page-desc">
              <el-input
                v-model="page.description"
                type="textarea"
                :rows="2"
                placeholder="分镜描述：本页要展示什么内容..."
                class="desc-input"
              />
            </div>
          </div>
        </div>

        <!-- 添加页面 -->
        <div class="add-actions">
          <el-button text size="small" @click="addPage('chapter')">+ 添加章节页</el-button>
          <el-button text size="small" @click="addPage('content')">+ 添加内容页</el-button>
        </div>
      </div>
    </div>

    <!-- 底部操作栏 -->
    <div v-if="phase !== 'analyzing' || outline" class="outline-footer">
      <el-button plain :loading="phase === 'generating'" @click="regenerate">换个大纲</el-button>
      <el-button type="primary" :disabled="!outline || phase === 'generating'" @click="goTemplate">
        挑选PPT模板 →
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { aipptGenApi } from '@/services/aipptGenService'

const router = useRouter()
const topic = ref(sessionStorage.getItem('aippt_topic') || '')
const options = ref(JSON.parse(sessionStorage.getItem('aippt_options') || '{}'))
const mode = ref(sessionStorage.getItem('aippt_mode') || 'topic')
const fileText = ref(sessionStorage.getItem('aippt_file_text') || '')

// 'analyzing' → 'generating' → 'done'
const phase = ref<'analyzing' | 'generating' | 'done'>('generating')
const analyzeBuffer = ref('')
const outlineBuffer = ref('')
const summary = ref('')
const outline = ref<any>(null)

const TYPE_LABELS: Record<string, string> = {
  cover: '封面', catalog: '目录', chapter: '章节', content: '内容', end: '结束',
}

onMounted(() => {
  if (!topic.value) { router.push({ name: 'AIPPTHome' }); return }
  if (mode.value === 'doc' && fileText.value) {
    startAnalyze()
  } else {
    startGenerateOutline()
  }
})

function typeLabel(type: string) { return TYPE_LABELS[type] || type }
function canRemove(type: string) { return type === 'chapter' || type === 'content' }

function normalizeOutline(data: any): any {
  if (data.pages) {
    // 确保 pages 里每个 item 都有 description
    data.pages.forEach((p: any) => {
      if (!p.description) p.description = ''
    })
    return data
  }
  const pages: any[] = [
    { type: 'cover', title: data.title, description: '' },
    { type: 'catalog', title: '目录', description: '' },
  ]
  for (const ch of (data.chapters || [])) {
    pages.push({ type: 'chapter', title: ch.title, description: '' })
    for (const sl of (ch.slides || [])) {
      pages.push({ type: 'content', title: sl.title, description: '' })
    }
  }
  pages.push({ type: 'end', title: '感谢聆听', description: '' })
  return { title: data.title, subtitle: data.subtitle || '', pages }
}

async function readSSE(response: Response, onChunk: (data: any) => void) {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    const lines = text.split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      try { onChunk(JSON.parse(line.slice(6))) } catch {}
    }
  }
}

async function startAnalyze() {
  phase.value = 'analyzing'
  analyzeBuffer.value = ''

  try {
    const resp = await aipptGenApi.analyzeDocument(fileText.value, topic.value, options.value)
    await readSSE(resp, (data) => {
      if (data.type === 'analyze_chunk') { analyzeBuffer.value += data.content }
      if (data.type === 'analyze_done') { summary.value = data.summary }
      if (data.type === 'error') ElMessage.error(data.message)
    })

    if (!summary.value) summary.value = analyzeBuffer.value
    startGenerateOutline()
  } catch (err: any) {
    ElMessage.error('文档分析失败：' + err.message)
    phase.value = 'done'
  }
}

async function startGenerateOutline() {
  phase.value = 'generating'
  outlineBuffer.value = ''
  outline.value = null

  try {
    const resp = await aipptGenApi.generateOutline(
      topic.value,
      options.value,
      summary.value || undefined,
    )
    let full = ''
    await readSSE(resp, (data) => {
      if (data.type === 'chunk') { full += data.content; outlineBuffer.value = full }
      if (data.type === 'done' && data.outline) { outline.value = normalizeOutline(data.outline) }
      if (data.type === 'error') ElMessage.error(data.message)
    })

    if (!outline.value && full) {
      try { outline.value = normalizeOutline(JSON.parse(full)) } catch {}
    }
  } catch (err: any) {
    ElMessage.error('大纲生成失败：' + err.message)
  } finally {
    phase.value = 'done'
  }
}

function regenerate() { startGenerateOutline() }

function goTemplate() {
  sessionStorage.setItem('aippt_outline', JSON.stringify(outline.value))
  if (summary.value) sessionStorage.setItem('aippt_summary', summary.value)
  router.push({ name: 'AIPPTTemplate' })
}

function addPage(type: string) {
  const pages = outline.value.pages
  const endIdx = pages.length - 1
  const newPage = type === 'chapter'
    ? { type: 'chapter', title: '新章节', description: '' }
    : { type: 'content', title: '新页面', description: '' }
  pages.splice(endIdx, 0, newPage)
}

function removePage(pi: number) {
  outline.value.pages.splice(pi, 1)
}
</script>

<style scoped lang="scss">
.outline-page {
  height: 100vh;
  background: #f5f6f8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.outline-header {
  height: 52px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  z-index: 100;
}

.header-left { display: flex; align-items: center; gap: 12px; }
.back-btn {
  color: #6b7280; cursor: pointer; font-size: 18px; font-weight: 500;
  &:hover { color: #374151; }
}
.topic-badge {
  font-size: 13px; color: #374151; font-weight: 500;
  background: #f3f4f6; padding: 4px 12px; border-radius: 14px;
  max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gen-tag {
  font-size: 12px; padding: 3px 10px; border-radius: 10px;
  &.generating { color: #d97706; background: #fef3c7; }
  &.done { color: #059669; background: #d1fae5; }
}

.outline-body {
  flex: 1;
  max-width: 720px;
  margin: 0 auto;
  width: 100%;
  padding: 24px 16px;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
}

.generating-placeholder {
  text-align: center;
  padding: 80px 0;
  color: #6b7280;
}
.gen-progress { display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; }
.gen-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #6366f1;
  animation: bounce 1s infinite;
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
}
.gen-text { font-size: 16px; margin-bottom: 16px; }
.gen-streaming { font-size: 12px; color: #9ca3af; max-height: 120px; overflow: hidden; white-space: pre-wrap; }

.outline-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.title-section {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  margin-bottom: 8px;
  .main-title-input { margin-bottom: 8px; :deep(.el-input__inner) { font-size: 18px; font-weight: 700; } }
  .sub-title-input { :deep(.el-input__inner) { font-size: 13px; color: #6b7280; } }
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.page-row {
  background: #fff;
  border-radius: 10px;
  padding: 14px 18px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.04);
}

.page-row-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-num {
  font-size: 12px; font-weight: 600; color: #6366f1;
  background: #ede9fe; padding: 2px 8px; border-radius: 6px;
  flex-shrink: 0; min-width: 32px; text-align: center;
}

.page-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #6366f1; flex-shrink: 0;
}

.page-type-tag {
  font-size: 11px; padding: 2px 8px; border-radius: 4px; flex-shrink: 0; font-weight: 500;
  &.cover { color: #7c3aed; background: #ede9fe; }
  &.catalog { color: #2563eb; background: #dbeafe; }
  &.chapter { color: #0891b2; background: #cffafe; }
  &.content { color: #059669; background: #d1fae5; }
  &.end { color: #dc2626; background: #fee2e2; }
}

.page-title-input {
  flex: 1;
  :deep(.el-input__inner) { font-size: 14px; }
}

.page-desc {
  padding: 8px 0 0 50px;
}

.desc-input {
  :deep(.el-textarea__inner) {
    font-size: 12px;
    color: #6b7280;
    resize: none;
    border-color: #f3f4f6;
    &:focus { border-color: #6366f1; }
  }
}

.add-actions {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  justify-content: center;
}

.outline-footer {
  height: 60px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-shrink: 0;
  z-index: 100;
}
</style>
