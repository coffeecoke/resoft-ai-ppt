/**
 * OnlyOffice 编辑器对话框
 *
 * 全屏对话框封装 OnlyOfficeEditor 组件
 */

<template>
  <el-dialog
    :model-value="visible"
    :title="documentName || '文档编辑'"
    fullscreen
    class="onlyoffice-dialog"
    :show-close="true"
    :close-on-click-modal="false"
    @update:model-value="handleClose"
  >
    <template #header>
      <div class="dialog-header">
        <span class="dialog-title">{{ documentName || '文档编辑' }}</span>
        <div class="dialog-actions">
          <el-button v-if="!editorReady" size="small" @click="handleClose">
            关闭
          </el-button>
        </div>
      </div>
    </template>

    <div class="dialog-content">
      <OnlyOfficeEditor
        v-if="documentId"
        :document-id="documentId"
        :mode="mode"
        @ready="handleEditorReady"
        @save="handleEditorSave"
        @error="handleEditorError"
        @close="handleClose"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import OnlyOfficeEditor from './OnlyOfficeEditor.vue'

const props = defineProps<{
  visible: boolean
  documentId: string
  documentName?: string
  mode?: 'view' | 'edit'
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'save'): void
  (e: 'close'): void
}>()

const editorReady = ref(false)

const handleEditorReady = () => {
  editorReady.value = true
}

const handleEditorSave = () => {
  ElMessage.success('文档已自动保存')
  emit('save')
}

const handleEditorError = (message: string) => {
  ElMessage.error(message)
}

const handleClose = () => {
  emit('update:visible', false)
  emit('close')
  editorReady.value = false
}
</script>

<style scoped>
.onlyoffice-dialog :deep(.el-dialog__header) {
  padding: 12px 20px;
  border-bottom: 1px solid #e6e8eb;
}

.onlyoffice-dialog :deep(.el-dialog__body) {
  padding: 0;
  height: calc(100vh - 60px);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.dialog-content {
  width: 100%;
  height: 100%;
}
</style>