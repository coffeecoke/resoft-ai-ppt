<template>
  <div class="pptist-editor">
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

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import useGlobalHotkey from '@/hooks/useGlobalHotkey'
import usePasteEvent from '@/hooks/usePasteEvent'
import { useEditorSave } from '@/hooks/useEditorSave'

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