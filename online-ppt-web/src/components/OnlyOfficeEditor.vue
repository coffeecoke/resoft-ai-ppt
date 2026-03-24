/**
 * OnlyOffice 编辑器组件
 *
 * 封装 OnlyOffice Document Editor 的 iframe 嵌入
 * 通过 WOPI 协议与后端 OnlyOffice 服务通信
 */

<template>
  <div class="onlyoffice-editor" ref="containerRef">
    <!-- placeholder 始终存在，编辑器需要挂载到这里 -->
    <div :id="placeholderId" ref="placeholderRef"></div>
    <!-- loading 作为覆盖层 -->
    <div v-if="loading" class="editor-loading">
      <i class="ri-loader-4-line spin"></i>
      <span>正在加载编辑器...</span>
    </div>
    <!-- error 作为覆盖层 -->
    <div v-if="error" class="editor-error">
      <i class="ri-error-warning-line"></i>
      <span>{{ error }}</span>
      <el-button size="small" @click="initEditor">重试</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { getEditorConfig } from '@/services/wopiService'

const props = defineProps<{
  documentId: string
  mode?: 'view' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'ready'): void
  (e: 'save'): void
  (e: 'error', message: string): void
  (e: 'close'): void
}>()

// 生成唯一 placeholder id，支持多实例
const placeholderId = `onlyoffice-placeholder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const containerRef = ref<HTMLElement | null>(null)
const placeholderRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const error = ref('')
let docEditor: any = null

const initEditor = async () => {
  loading.value = true
  error.value = ''

  try {
    // 获取编辑器配置
    const result = await getEditorConfig(props.documentId, props.mode || 'edit')

    if (!result.success || !result.data) {
      throw new Error(result.error || '获取编辑器配置失败')
    }

    const config = result.data
    const ONLYOFFICE_URL = import.meta.env.VITE_ONLYOFFICE_URL || 'http://localhost:8080'

    // 加载 OnlyOffice API 脚本
    if (!(window as any).DocsAPI) {
      await loadScript(`${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`)
    }

    // 销毁旧编辑器实例
    if (docEditor) {
      try {
        docEditor.destroyEditor()
      } catch (e) {
        // 忽略销毁错误
      }
      docEditor = null
    }

    // 创建新编辑器
    docEditor = new (window as any).DocsAPI.DocEditor(placeholderId, {
      ...config,
      events: {
        onDocumentReady: () => {
          console.log('[OnlyOffice] 文档已加载')
          loading.value = false
          emit('ready')
        },
        onError: (event: any) => {
          console.error('[OnlyOffice] 错误:', event)
          error.value = `编辑器错误: ${event.data || '未知错误'}`
          loading.value = false
          emit('error', error.value)
        },
        onDocumentStateChange: (event: any) => {
          // 文档状态变化（用户编辑时触发）
          if (!event.data) {
            // 文档已保存
            emit('save')
          }
        },
        onRequestClose: () => {
          emit('close')
        }
      }
    })
  } catch (e: any) {
    console.error('[OnlyOffice] 初始化失败:', e)
    error.value = e.message || '初始化编辑器失败'
    loading.value = false
    emit('error', error.value)
  }
}

const loadScript = (url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('加载 OnlyOffice API 失败'))
    document.head.appendChild(script)
  })
}

watch([() => props.documentId, () => props.mode], () => {
  if (props.documentId) {
    initEditor()
  }
})

onMounted(() => {
  if (props.documentId) {
    initEditor()
  }
})

onBeforeUnmount(() => {
  if (docEditor) {
    try {
      docEditor.destroyEditor()
    } catch (e) {
      // 忽略销毁错误
    }
  }
})
</script>

<style scoped>
.onlyoffice-editor {
  width: 100%;
  height: 100%;
  min-height: 600px;
  position: relative;
  background: #f5f5f5;
}

.onlyoffice-editor > div:first-child {
  width: 100%;
  height: 100%;
}

.editor-loading,
.editor-error {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #fff;
  z-index: 10;
}

.editor-loading i,
.editor-error i {
  font-size: 48px;
  color: #006DF9;
}

.editor-error i {
  color: #f56c6c;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>