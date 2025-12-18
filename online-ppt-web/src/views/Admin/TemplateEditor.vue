<template>
  <div class="template-editor">
    <div class="header">
      <button class="btn-back" @click="goBack">← 返回</button>
      <span class="title">
        模板编辑器
        <span v-if="templateId">（{{ templateId }}）</span>
      </span>
      <div class="actions">
        <button class="btn-save" :disabled="saving" @click="handleSave">
          {{ saving ? '保存中...' : '保存' }}
        </button>
        <button class="btn-publish" :disabled="publishing" @click="handlePublish">
          {{ publishing ? '发布中...' : '发布' }}
        </button>
      </div>
    </div>
    
    <div class="content">
      <div v-if="loading" class="placeholder">
        <div class="icon">⏳</div>
        <div class="text">正在加载模板数据...</div>
      </div>
      <div v-else class="editor-wrapper">
        <!-- 直接复用原有编辑器页面（包含 Canvas / Toolbar / MarkupPanel 等） -->
        <EditorView />
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import EditorView from '@/views/Editor/index.vue'
import { useSlidesStore, useSnapshotStore, useMainStore } from '@/store'
import { deleteDiscardedDB } from '@/utils/database'
import message from '@/utils/message'
import axios from '@/services/config'
import { SERVER_URL } from '@/services'

const route = useRoute()
const router = useRouter()

const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const mainStore = useMainStore()

const templateId = route.params.id as string | undefined

const loading = ref(true)
const saving = ref(false)
const publishing = ref(false)

const goBack = () => {
  router.push('/admin/templates')
}

// 从后端加载模板数据并写入 slidesStore
const loadTemplate = async () => {
  if (!templateId) {
    message.error('缺少模板ID')
    goBack()
    return
  }

  try {
    loading.value = true
    
    // 从后端获取完整的模板数据（包含 title, theme, slides）
    const resp = await fetch(`${SERVER_URL}/templates/${templateId}`)
    if (!resp.ok) {
      throw new Error('获取模板详情失败')
    }
    
    const json = await resp.json()
    if (!json.success || !json.data) {
      throw new Error(json.error || '模板数据格式错误')
    }
    
    const { templateData } = json.data
    if (!templateData) {
      throw new Error('模板数据不存在')
    }
    
    // 设置完整的模板数据到 store（包含 title, theme, slides, viewport）
    if (templateData.title) {
      slidesStore.setTitle(templateData.title)
    }
    if (templateData.theme) {
      slidesStore.setTheme(templateData.theme)
    }
    
    // 设置 viewport 相关参数（基于模板的宽高计算）
    if (templateData.width && templateData.height) {
      slidesStore.setViewportSize(templateData.width)
      slidesStore.setViewportRatio(templateData.height / templateData.width)
    }
    
    if (templateData.slides && Array.isArray(templateData.slides)) {
      slidesStore.setSlides(templateData.slides)
      // 确保 slideIndex 在有效范围内，默认显示第一页
      if (templateData.slides.length > 0) {
        slidesStore.updateSlideIndex(0)
      }
    } else {
      message.warning('模板暂无页面，请在编辑器中添加页面')
      slidesStore.setSlides([])
    }

    // 初始化快照数据库（与 App.vue 中逻辑一致）
    await deleteDiscardedDB()
    await snapshotStore.initSnapshotDatabase()

    // 打开类型标注面板，方便做模板标注
    mainStore.setMarkupPanelState(true)
  } catch (error) {
    console.error('[模板编辑器] 加载模板失败:', error)
    message.error('加载模板失败')
    goBack()
  } finally {
    loading.value = false
  }
}

// 手动保存模板到后端
const handleSave = async () => {
  if (!templateId) return
  try {
    saving.value = true
    const templateData = {
      title: slidesStore.title || '未命名模板',
      width: 1000,
      height: 562.5,
      theme: slidesStore.theme,
      slides: slidesStore.slides,
    }

    const resp = await axios.put(`${SERVER_URL}/templates/${templateId}`, {
      templateData,
      autoSave: false,
    })

    if (!resp?.success) {
      throw new Error(resp?.error || '保存模板失败')
    }

    message.success('模板已保存')
  } catch (error: any) {
    console.error('[模板编辑器] 保存模板失败:', error)
    message.error(error?.message || '保存模板失败')
  } finally {
    saving.value = false
  }
}

// 发布模板（先保存，再更新状态为 published）
const handlePublish = async () => {
  if (!templateId) return
  try {
    publishing.value = true
    await handleSave()

    const resp = await axios.post(`${SERVER_URL}/templates/${templateId}/publish`)
    if (!resp?.success) {
      throw new Error(resp?.error || '发布模板失败')
    }

    message.success('模板已发布')
  } catch (error: any) {
    console.error('[模板编辑器] 发布模板失败:', error)
    message.error(error?.message || '发布模板失败')
  } finally {
    publishing.value = false
  }
}

onMounted(() => {
  loadTemplate()
})
</script>

<style lang="scss" scoped>
.template-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #fff;
  border-radius: 8px;
}

.header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  border-bottom: 1px solid #e8e8e8;
  
  .btn-back {
    padding: 8px 16px;
    background-color: transparent;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      border-color: #1890ff;
      color: #1890ff;
    }
  }
  
  .title {
    font-size: 16px;
    font-weight: 500;
  }
  
  .actions {
    display: flex;
    gap: 12px;
    
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .btn-save {
      background-color: #fff;
      border: 1px solid #d9d9d9;
      color: #333;
      
      &:hover {
        border-color: #1890ff;
        color: #1890ff;
      }
    }
    
    .btn-publish {
      background-color: #1890ff;
      color: #fff;
      
      &:hover {
        background-color: #40a9ff;
      }
    }
  }
}

.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  
  .placeholder {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
    
    .icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    
    .text {
      font-size: 18px;
      margin-bottom: 8px;
    }
  }

  .editor-wrapper {
    flex: 1;
    min-height: 0;
  }
}
</style>



