<template>
  <div class="ai-ppt-home">
    <div class="home-inner">
      <!-- 顶部模式选择 -->
      <div class="mode-tabs">
        <div
          v-for="tab in tabs"
          :key="tab.key"
          class="mode-tab"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <el-icon class="tab-icon"><component :is="tab.icon" /></el-icon>
          <span>{{ tab.label }}</span>
        </div>
      </div>

      <div class="input-card">
        <!-- 主题输入 -->
        <template v-if="activeTab === 'topic'">
          <div class="input-hint">你好，请输入您要生成的PPT主题，AI将帮您快速生成一份精美的演示文稿</div>
          <el-input
            v-model="topic"
            type="textarea"
            placeholder="请输入PPT主题，如：2024年度工作总结汇报"
            :rows="3"
            :maxlength="500"
            show-word-limit
            @keydown.ctrl.enter="handleStart"
          />
          <div class="suggest-tags">
            <span v-for="tag in suggestTags" :key="tag" class="suggest-tag" @click="topic = tag">{{ tag }}</span>
          </div>
        </template>

        <!-- 文档上传 -->
        <template v-else>
          <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
            <input ref="fileInput" type="file" accept=".docx,.doc,.txt,.pdf,.md" multiple style="display:none" @change="handleFileChange" />
            <template v-if="files.length === 0">
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="upload-text">点击上传或拖拽文档到此处</div>
              <div class="upload-hint">支持 Word、TXT、PDF，最多5个文件</div>
            </template>
            <template v-else>
              <div v-for="(f, i) in files" :key="i" class="file-info">
                <el-icon><Document /></el-icon>
                <span class="file-name">{{ f.name }}</span>
                <span class="file-size">({{ (f.size / 1024).toFixed(0) }}KB)</span>
                <el-icon class="remove-file" @click.stop="files.splice(i, 1)"><Close /></el-icon>
              </div>
              <div class="upload-add" @click.stop="triggerUpload">+ 继续添加</div>
            </template>
          </div>
        </template>

        <!-- 基础信息选项 -->
        <div class="options-section">
          <div class="options-grid">
            <div class="opt-item">
              <label>汇报对象</label>
              <el-select v-model="options.audience" placeholder="请选择" size="default">
                <el-option v-for="o in audienceOpts" :key="o" :label="o" :value="o" />
              </el-select>
            </div>
            <div class="opt-item">
              <label>使用场景</label>
              <el-select v-model="options.scenario" placeholder="请选择" size="default">
                <el-option v-for="o in scenarioOpts" :key="o" :label="o" :value="o" />
              </el-select>
            </div>
            <div class="opt-item">
              <label>语言风格</label>
              <el-select v-model="options.style" placeholder="请选择" size="default">
                <el-option v-for="o in styleOpts" :key="o" :label="o" :value="o" />
              </el-select>
            </div>
            <div class="opt-item">
              <label>内容丰富度</label>
              <el-select v-model="options.richness" placeholder="请选择" size="default">
                <el-option v-for="o in richnessOpts" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </div>
            <div class="opt-item">
              <label>配图模式</label>
              <el-select v-model="options.imageMode" placeholder="请选择" size="default">
                <el-option v-for="o in imageOpts" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </div>
            <div class="opt-item">
              <label>原文参考</label>
              <el-select v-model="options.referenceMode" placeholder="请选择" size="default">
                <el-option v-for="o in refOpts" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </div>
            <div class="opt-item full-width">
              <label>页面</label>
              <el-select v-model="options.pageLevel" placeholder="请选择" size="default">
                <el-option v-for="o in pageOpts" :key="o.value" :label="o.label" :value="o.value" />
              </el-select>
            </div>
          </div>
        </div>

        <el-button type="primary" class="gen-btn" :loading="loading" @click="handleStart">
          {{ activeTab === 'topic' ? '立即生成' : '开始分析生成' }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { EditPen, Upload, Document, Close } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { aipptGenApi } from '@/services/aipptGenService'

const router = useRouter()
const activeTab = ref<'topic' | 'doc'>('topic')
const topic = ref('')
const loading = ref(false)
const files = ref<File[]>([])
const fileInput = ref<HTMLInputElement>()

const tabs = [
  { key: 'topic', label: '输入PPT主题', icon: EditPen },
  { key: 'doc', label: '上传文档材料', icon: Upload },
]

const suggestTags = [
  '产品介绍', '大学生就业规划', '新员工入职培训', '人才报告', '工作汇报',
  '历史事件解析', '营销方案分析',
]

const audienceOpts = ['领导', '客户', '同事', '学生', '其他']
const scenarioOpts = ['工作汇报', '培训教学', '产品展示', '竞标方案', '其他']
const styleOpts = ['专业严谨', '简洁明了', '生动活泼']
const richnessOpts = [
  { label: '精简', value: 'compact' },
  { label: '适中', value: 'moderate' },
  { label: '详细', value: 'detailed' },
]
const imageOpts = [
  { label: '智能配图', value: 'standard' },
  { label: '纯文字', value: 'none' },
  { label: 'AI生图', value: 'ai' },
]
const refOpts = [
  { label: '高度还原', value: 'strict' },
  { label: '适度改编', value: 'adapt' },
  { label: '自由发挥', value: 'free' },
]
const pageOpts = [
  { label: '智能决策', value: 'smart' },
  { label: '精简（约10页）', value: 'compact' },
  { label: '标准（约20页）', value: 'standard' },
  { label: '长篇（约30页）', value: 'long' },
]

const options = ref({
  audience: '领导',
  scenario: '工作汇报',
  style: '专业严谨',
  richness: 'detailed',
  imageMode: 'standard',
  referenceMode: 'adapt',
  pageLevel: 'smart',
})

function triggerUpload() { fileInput.value?.click() }
function handleFileChange(e: Event) {
  const list = (e.target as HTMLInputElement).files
  if (list) {
    for (let i = 0; i < list.length; i++) {
      if (files.value.length >= 5) break
      files.value.push(list[i])
    }
  }
  if (fileInput.value) fileInput.value.value = ''
}
function handleDrop(e: DragEvent) {
  const list = e.dataTransfer?.files
  if (list) {
    for (let i = 0; i < list.length; i++) {
      if (files.value.length >= 5) break
      files.value.push(list[i])
    }
  }
}

async function handleStart() {
  if (activeTab.value === 'topic') {
    if (!topic.value.trim()) return ElMessage.warning('请输入PPT主题')
    sessionStorage.setItem('aippt_topic', topic.value.trim())
    sessionStorage.setItem('aippt_options', JSON.stringify(options.value))
    sessionStorage.setItem('aippt_mode', 'topic')
    sessionStorage.removeItem('aippt_file_text')
    router.push({ name: 'AIPPTOutline' })
  } else {
    if (files.value.length === 0) return ElMessage.warning('请先上传文档')
    loading.value = true
    try {
      const res = await aipptGenApi.uploadFiles(files.value)
      const data = (res as any).data
      const name = files.value[0].name.replace(/\.[^.]+$/, '')
      sessionStorage.setItem('aippt_topic', topic.value || name)
      sessionStorage.setItem('aippt_options', JSON.stringify(options.value))
      sessionStorage.setItem('aippt_mode', 'doc')
      sessionStorage.setItem('aippt_file_text', data.text)
      router.push({ name: 'AIPPTOutline' })
    } catch (err: any) {
      ElMessage.error('文件上传失败：' + err.message)
    } finally {
      loading.value = false
    }
  }
}
</script>

<style scoped lang="scss">
.ai-ppt-home {
  min-height: 100vh;
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #f0f9ff 100%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 60px 16px;
}

.home-inner {
  width: 720px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.mode-tabs {
  display: flex;
  gap: 16px;
}

.mode-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 24px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  color: #6b7280;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;

  &:hover { border-color: #6366f1; color: #6366f1; }
  &.active { background: #6366f1; color: #fff; border-color: #6366f1; }
  .tab-icon { font-size: 16px; }
}

.input-card {
  width: 100%;
  background: #fff;
  border-radius: 16px;
  padding: 28px 32px;
  box-shadow: 0 4px 24px rgba(99, 102, 241, 0.08);
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.input-hint { color: #6b7280; font-size: 14px; line-height: 1.6; }

.suggest-tags { display: flex; flex-wrap: wrap; gap: 8px; }
.suggest-tag {
  padding: 5px 14px;
  background: #f3f4f6;
  border-radius: 20px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: #ede9fe; color: #6366f1; }
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: #6366f1; background: #faf5ff; }
}

.upload-icon { font-size: 40px; color: #9ca3af; margin-bottom: 12px; }
.upload-text { font-size: 15px; color: #374151; margin-bottom: 6px; }
.upload-hint { font-size: 13px; color: #9ca3af; }

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #374151;
  padding: 6px 0;
  &:not(:last-child) { border-bottom: 1px solid #f3f4f6; }
  .file-name { font-weight: 500; }
  .file-size { color: #9ca3af; }
  .remove-file { cursor: pointer; color: #ef4444; margin-left: auto; }
}

.upload-add {
  margin-top: 12px;
  font-size: 13px;
  color: #6366f1;
  cursor: pointer;
  &:hover { color: #4f46e5; }
}

.options-section {
  border-top: 1px solid #f3f4f6;
  padding-top: 18px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 20px;
}

.opt-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  .el-select { width: 100%; }

  &.full-width { grid-column: 1 / -1; }
}

.gen-btn {
  width: 100%;
  height: 44px;
  border-radius: 10px;
  font-size: 15px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border: none;
  &:hover { opacity: 0.9; }
}
</style>
