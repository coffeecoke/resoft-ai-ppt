/**
 * OnlyOffice 文档编辑页面
 *
 * 全屏显示 OnlyOffice 编辑器
 * 通过 URL 参数 documentId 和 mode 控制文档
 */

<template>
  <div class="onlyoffice-page">
    <div class="editor-header">
      <div class="header-left">
        <el-button @click="handleClose" text>
          <i class="ri-arrow-left-line"></i>
          返回
        </el-button>
        <span class="doc-title">{{ documentName || '文档编辑' }}</span>
      </div>
      <div class="header-right">
        <el-button v-if="!editorReady" size="small" @click="handleClose">
          关闭
        </el-button>
      </div>
    </div>
    <div class="editor-container">
      <div v-if="loading" class="editor-loading">
        <i class="ri-loader-4-line spin"></i>
        <span>正在加载编辑器...</span>
      </div>
      <div v-else-if="error" class="editor-error">
        <i class="ri-error-warning-line"></i>
        <span>{{ error }}</span>
        <el-button size="small" @click="initEditor">重试</el-button>
      </div>
      <div :id="placeholderId" class="editor-placeholder"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getEditorConfig } from '@/services/wopiService'

const route = useRoute()
const router = useRouter()

const documentId = route.query.documentId as string
const mode = (route.query.mode as string) || 'edit'

const placeholderId = `onlyoffice-placeholder-${Date.now()}`
const documentName = ref('')
const loading = ref(true)
const error = ref('')
const editorReady = ref(false)
let docEditor: any = null

const initEditor = async () => {
  if (!documentId) {
    error.value = '缺少文档ID'
    loading.value = false
    return
  }

  loading.value = true
  error.value = ''

  try {
    const result = await getEditorConfig(documentId, mode)

    if (!result.success || !result.data) {
      throw new Error(result.error || '获取编辑器配置失败')
    }

    const config = result.data
    documentName.value = config.document?.title || '未命名文档'

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
        // 忽略
      }
      docEditor = null
    }

    // 创建编辑器
    docEditor = new (window as any).DocsAPI.DocEditor(placeholderId, {
      ...config,
      events: {
        onDocumentReady: () => {
          console.log('[OnlyOffice] 文档已加载')
          loading.value = false
          editorReady.value = true
        },
        onError: (event: any) => {
          console.error('[OnlyOffice] 错误:', event)
          error.value = `编辑器错误: ${event.data || '未知错误'}`
          loading.value = false
          ElMessage.error(error.value)
        }
      }
    })
  } catch (e: any) {
    console.error('[OnlyOffice] 初始化失败:', e)
    error.value = e.message || '初始化编辑器失败'
    loading.value = false
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

const handleClose = () => {
  // 关闭当前页签
  window.close()
  // 如果无法关闭（比如不是通过 window.open 打开的），则返回上一页
  router.back()
}

onMounted(() => {
  initEditor()
})

onBeforeUnmount(() => {
  if (docEditor) {
    try {
      docEditor.destroyEditor()
    } catch (e) {
      // 忽略
    }
  }
})
</script>

<style scoped>
.onlyoffice-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
}

.editor-header {
  height: 48px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.doc-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.editor-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.editor-placeholder {
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