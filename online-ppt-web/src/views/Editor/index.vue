<template>
  <!-- 数据加载中的骨架屏 -->
  <div v-if="dataLoading" class="editor-loading">
    <div class="loading-skeleton">
      <!-- 顶部工具栏骨架 -->
      <div class="skeleton-header">
        <div class="skeleton-bar"></div>
      </div>

      <!-- 主体内容骨架 -->
      <div class="skeleton-content">
        <!-- 左侧缩略图骨架 -->
        <div class="skeleton-left">
          <div class="skeleton-thumb" v-for="i in 5" :key="i"></div>
        </div>

        <!-- 中间画布骨架 -->
        <div class="skeleton-center">
          <div class="skeleton-canvas">
            <div class="loading-spinner"></div>
            <div class="loading-text">{{ loadingMessage || '正在加载文档...' }}</div>
            <div class="loading-tip">首次加载可能需要几秒钟</div>
          </div>
        </div>

        <!-- 右侧工具栏骨架 -->
        <div class="skeleton-right">
          <div class="skeleton-panel"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 编辑器主界面 -->
  <div v-else class="pptist-editor">
    <EditorHeader class="layout-header" />
    <div class="layout-content">
      <Thumbnails class="layout-content-left" />
      <div 
        class="layout-content-center" 
        :class="{ 
          'with-ai-panel': showAIEditPanel && !aiEditPanelCollapsed,
          'with-ai-panel-collapsed': showAIEditPanel && aiEditPanelCollapsed
        }"
      >
        <CanvasTool class="center-top" />
        <Canvas class="center-body" :style="{ height: `calc(100% - ${remarkHeight + 40}px)` }" />
        <Remark
          class="center-bottom" 
          v-model:height="remarkHeight" 
          :style="{ height: `${remarkHeight}px` }"
        />
      </div>
      <Toolbar class="layout-content-right" />
    </div>
  </div>

  <!-- 只在数据加载完成后显示这些面板 -->
  <template v-if="!dataLoading">
  <SelectPanel v-if="showSelectPanel" />
  <SearchPanel v-if="showSearchPanel" />
  <NotesPanel v-if="showNotesPanel" />
  <MarkupPanel v-if="showMarkupPanel" />
  <SymbolPanel v-if="showSymbolPanel" />
  <ImageLibPanel v-if="showImageLibPanel" />
  
  <!-- AI编辑面板 -->
  <AIEditPanel v-if="showAIEditPanel" />

  <Modal
    :visible="!!dialogForExport" 
    :width="680"
    @closed="closeExportDialog()"
  >
    <ExportDialog />
  </Modal>

  <Modal
    :visible="showAIPPTDialog" 
    :width="720"
    :closeOnClickMask="false"
    :closeOnEsc="false"
    closeButton
    @closed="closeAIPPTDialog()"
  >
    <AIPPTDialog />
  </Modal>

  <!-- 预览图生成进度提示 -->
  <ThumbnailGenerationProgress
    :visible="generatingThumbnails"
    :progress="thumbnailProgress"
    @close="() => {}"
  />
  </template>
</template>

<script lang="ts">
// 定义组件名，用于 keep-alive 缓存
export default {
  name: 'Editor'
}
</script>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import useGlobalHotkey from '@/hooks/useGlobalHotkey'
import usePasteEvent from '@/hooks/usePasteEvent'
import { useEditorSave } from '@/hooks/useEditorSave'
import { useEditorDataLoader } from '@/hooks/useEditorDataLoader'

import EditorHeader from './EditorHeader/index.vue'
import Canvas from './Canvas/index.vue'
import CanvasTool from './CanvasTool/index.vue'
import Thumbnails from './Thumbnails/index.vue'
import Toolbar from './Toolbar/index.vue'
import Remark from './Remark/index.vue'
import ExportDialog from './ExportDialog/index.vue'
import SelectPanel from './SelectPanel.vue'
import SearchPanel from './SearchPanel.vue'
import NotesPanel from './NotesPanel.vue'
import SymbolPanel from './SymbolPanel.vue'
import MarkupPanel from './MarkupPanel.vue'
import ImageLibPanel from './ImageLibPanel.vue'
import AIPPTDialog from './AIPPTDialog.vue'
import { AIEditPanel } from './AIEdit'
import Modal from '@/components/Modal.vue'
import ThumbnailGenerationProgress from '@/components/ThumbnailGenerationProgress.vue'

const mainStore = useMainStore()
const {
  dialogForExport,
  showSelectPanel,
  showSearchPanel,
  showNotesPanel,
  showSymbolPanel,
  showMarkupPanel,
  showImageLibPanel,
  showAIPPTDialog,
  showAIEditPanel,
  aiEditPanelCollapsed,
} = storeToRefs(mainStore)

const closeExportDialog = () => mainStore.setDialogForExport('')
const closeAIPPTDialog = () => mainStore.setAIPPTDialogState(false)

const remarkHeight = ref(40)

// 数据加载
const { loading: dataLoading, loadingMessage } = useEditorDataLoader()

// 获取预览图生成状态
const { generatingThumbnails, thumbnailProgress } = useEditorSave()

// 调试日志
watch(generatingThumbnails, (val) => {
  console.log('[编辑器] generatingThumbnails 变化:', val)
})

watch(thumbnailProgress, (val) => {
  console.log('[编辑器] thumbnailProgress 变化:', val)
}, { deep: true })

useGlobalHotkey()
usePasteEvent()
</script>

<style lang="scss" scoped>
.editor-loading {
  position: fixed;
  inset: 0;
  background: #f5f5f7;
  z-index: 9999;
  overflow: hidden;
}

.loading-skeleton {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.skeleton-header {
  height: 40px;
  background: white;
  border-bottom: 1px solid #e5e5e5;
  padding: 8px 16px;
  display: flex;
  align-items: center;

  .skeleton-bar {
    width: 100%;
    height: 24px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }
}

.skeleton-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.skeleton-left {
  width: 160px;
  background: white;
  border-right: 1px solid #e5e5e5;
  padding: 10px;
  flex-shrink: 0;

  .skeleton-thumb {
    width: 100%;
    height: 80px;
    margin-bottom: 10px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }
}

.skeleton-center {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f7;
}

.skeleton-canvas {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;

  .loading-spinner {
    width: 48px;
    height: 48px;
    border: 4px solid rgba(0, 0, 0, 0.1);
    border-top-color: $themeColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-text {
    font-size: 16px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.85);
  }

  .loading-tip {
    font-size: 13px;
    color: rgba(0, 0, 0, 0.45);
  }
}

.skeleton-right {
  width: 260px;
  background: white;
  border-left: 1px solid #e5e5e5;
  padding: 16px;
  flex-shrink: 0;

  .skeleton-panel {
    width: 100%;
    height: 200px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: skeleton-loading 1.5s ease-in-out infinite;
    border-radius: 4px;
  }
}

@keyframes skeleton-loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pptist-editor {
  height: 100%;
}
.layout-header {
  height: 40px;
}
.layout-content {
  height: calc(100% - 40px);
  display: flex;
}
.layout-content-left {
  width: 160px;
  height: 100%;
  flex-shrink: 0;
}
.layout-content-center {
  width: calc(100% - 160px - 260px);
  transition: width 0.3s ease;

  .center-top {
    height: 40px;
  }
  
  // AI面板展开时：减去完整面板宽度 380px
  &.with-ai-panel {
    width: calc(100% - 160px - 260px - 380px);
  }
  
  // AI面板折叠时：只减去折叠按钮宽度 4px
  &.with-ai-panel-collapsed {
    width: calc(100% - 160px - 260px - 4px);
  }
}
.layout-content-right {
  width: 260px;
  height: 100%;
}
</style>