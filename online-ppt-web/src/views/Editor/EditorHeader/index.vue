<template>
  <div class="editor-header">
    <div class="left">
      <!-- 模板/文档编辑模式：显示返回按钮 -->
      <div v-if="editMode !== 'normal'" class="back-to-admin" @click="goBack" :v-tooltip="editMode === 'template' ? '返回模板管理' : '返回我的文档'">
        <span class="arrow">←</span>
        <span class="text">{{ editMode === 'template' ? '模板管理' : '我的文档' }}</span>
      </div>
      <Popover trigger="click" placement="bottom-start" v-model:value="mainMenuVisible">
        <template #content>
          <div class="main-menu">
            <div class="ai-menu" @click="openAIPPTDialog(); mainMenuVisible = false">
              <div class="icon"><IconClick theme="two-tone" :fill="['#ffc158', '#fff']" /></div>
              <div class="aippt-content">
                <div class="aippt"><span>AIPPT</span></div>
                <div class="aippt-subtitle">输入一句话，智能生成演示文稿</div>
              </div>
            </div>
          </div>
          <Divider :margin="10" />
          <div class="import-section">
            <div class="import-label">导入文件</div>
            <div class="import-grid">
              <FileInput class="import-block" accept="application/vnd.openxmlformats-officedocument.presentationml.presentation" @change="files => {
                importPPTXFile(files)
                mainMenuVisible = false
              }">
                <span class="icon"><IconFilePdf theme="multi-color" :fill="['#333', '#d14424', '#fff']" /></span>
                <span class="label">PPTX</span>
                <span class="sub-label">（仅供测试）</span>
              </FileInput>
              <FileInput class="import-block" accept=".json" @change="files => {
                importJSON(files)
                mainMenuVisible = false
              }">
                <span class="icon"><IconFileJpg theme="multi-color" :fill="['#333', '#d14424', '#fff']" /></span>
                <span class="label">JSON</span>
                <span class="sub-label">（仅供测试）</span>
              </FileInput>
              <FileInput class="import-block" accept=".pptist" @change="files => {
                importSpecificFile(files)
                mainMenuVisible = false
              }">
                <span class="icon"><IconNotes theme="multi-color" :fill="['#333', '#d14424', '#fff']" /></span>
                <span class="label">RsAiPPT</span>
                <span class="sub-label">（专属格式）</span>
              </FileInput>
            </div>
          </div>
          <Divider :margin="10" />
          <PopoverMenuItem class="popover-menu-item" @click="setDialogForExport('pptx')"><IconDownload class="icon" /> 导出文件</PopoverMenuItem>
          <Divider :margin="10" />
          <PopoverMenuItem class="popover-menu-item" @click="resetSlides(); mainMenuVisible = false"><IconRefresh class="icon" /> 重置幻灯片</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="openMarkupPanel(); mainMenuVisible = false"><IconMark class="icon" /> 幻灯片类型标注</PopoverMenuItem>
          <PopoverMenuItem class="popover-menu-item" @click="mainMenuVisible = false; hotkeyDrawerVisible = true"><IconCommand class="icon" /> 快捷操作</PopoverMenuItem>
          <Divider :margin="10" />
          <div class="statement"></div>
        </template>
        <div class="menu-item"><IconHamburgerButton class="icon" /></div>
      </Popover>

      <div class="title">
        <Input 
          class="title-input" 
          ref="titleInputRef"
          v-model:value="titleValue" 
          @blur="handleUpdateTitle()" 
          v-if="editingTitle" 
        ></Input>
        <div 
          class="title-text"
          @click="startEditTitle()"
          :title="title"
          v-else
        >{{ title }}</div>
      </div>
    </div>

    <div class="right">
      <!-- 模板/文档编辑模式：显示保存和发布按钮 -->
      <template v-if="editMode !== 'normal'">
        <div 
          class="menu-item template-btn" 
          :v-tooltip="editMode === 'template' ? '保存模板到后端' : '保存文档到后端'" 
          @click="handleSave" 
          :class="{ disabled: saving }"
        >
          <span class="text">{{ saving ? '保存中...' : '保存' }}</span>
        </div>
        <!-- 模板和文档模式都显示发布按钮 -->
        <div 
          v-if="editMode === 'template' || editMode === 'document'"
          class="menu-item template-btn publish-btn" 
          :v-tooltip="editMode === 'template' ? '发布模板' : '发布文档'" 
          @click="handlePublish" 
          :class="{ disabled: publishing }"
        >
          <span class="text">{{ publishing ? '发布中...' : '发布' }}</span>
        </div>
      </template>
      
      <div class="group-menu-item">
        <div class="menu-item" v-tooltip="'幻灯片放映（F5）'" @click="enterScreening()">
          <IconPpt class="icon" />
        </div>
        <Popover trigger="click" center>
          <template #content>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreeningFromStart()"><IconSlideTwo class="icon" /> 从头开始</PopoverMenuItem>
            <PopoverMenuItem class="popover-menu-item" @click="enterScreening()"><IconPpt class="icon" /> 从当前页开始</PopoverMenuItem>
          </template>
          <div class="arrow-btn"><IconDown class="arrow" /></div>
        </Popover>
      </div>
      <div class="menu-item" v-tooltip="'AI生成PPT'" @click="openAIPPTDialog(); mainMenuVisible = false">
        <span class="text ai">RsAI</span>
      </div>
      <div 
        class="menu-item ai-edit-btn" 
        :class="{ active: showAIEditPanel }"
        v-tooltip="showAIEditPanel ? '关闭AI助手' : '打开AI助手'"
        @click="toggleAIEditPanel()"
      >
        <span class="icon">✨</span>
      </div>
      <div class="menu-item" v-tooltip="'导出'" @click="setDialogForExport('pptx')">
        <IconDownload class="icon" />
      </div>
      
    </div>

    <Drawer
      :width="320"
      v-model:visible="hotkeyDrawerVisible"
      placement="right"
    >
      <HotkeyDoc />
      <template v-slot:title>快捷操作</template>
    </Drawer>

    <FullscreenSpin :loading="exporting" tip="正在导入..." />
  </div>
</template>

<script lang="ts" setup>
import { nextTick, ref, useTemplateRef, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore } from '@/store'
import { useRoute, useRouter } from 'vue-router'
import useScreening from '@/hooks/useScreening'
import useImport from '@/hooks/useImport'
import useSlideHandler from '@/hooks/useSlideHandler'
import { useEditorSave } from '@/hooks/useEditorSave'
import type { DialogForExportTypes } from '@/types/export'

import HotkeyDoc from './HotkeyDoc.vue'
import FileInput from '@/components/FileInput.vue'
import FullscreenSpin from '@/components/FullscreenSpin.vue'
import Drawer from '@/components/Drawer.vue'
import Input from '@/components/Input.vue'
import Popover from '@/components/Popover.vue'
import PopoverMenuItem from '@/components/PopoverMenuItem.vue'
import Divider from '@/components/Divider.vue'

const route = useRoute()
const router = useRouter()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const { title } = storeToRefs(slidesStore)
const { showAIEditPanel } = storeToRefs(mainStore)

// ===== 统一保存Hook（支持模板和文档两种模式） =====
const {
  editMode,
  currentId,
  saving,
  save: saveDocument,
  generateThumbnailsForPublish,
  generateTemplateThumbnailsForPublish,
} = useEditorSave()

// 发布状态（仅模板模式使用）
const publishing = ref(false)

// 返回按钮逻辑
const goBack = () => {
  if (editMode.value === 'template') {
    router.push('/ppt/admin/templates')
  } else if (editMode.value === 'document') {
    router.push('/ppt/docs')
  }
}

// 手动保存
const handleSave = async () => {
  try {
    const { default: message } = await import('@/utils/message')
    await saveDocument(false, true) // 手动保存：autoSave=false, generateCover=true
    const modeName = editMode.value === 'template' ? '模板' : '文档'
    message.success(`${modeName}已保存`)
  } catch (error: any) {
    const { default: message } = await import('@/utils/message')
    message.error(error?.message || '保存失败')
  }
}

// 发布模板/文档（支持两种模式）
const handlePublish = async () => {
  if ((editMode.value !== 'template' && editMode.value !== 'document') || !currentId.value || publishing.value) return
  
  try {
    publishing.value = true
    const { default: axios } = await import('@/services/config')
    const { SERVER_URL } = await import('@/services')
    const { default: message } = await import('@/utils/message')
    
    // 先保存（发布时不需要生成封面，因为发布时会统一生成所有缩略图）
    try {
      const { default: message } = await import('@/utils/message')
      await saveDocument(false, false) // 发布时：autoSave=false, generateCover=false
      const modeName = editMode.value === 'template' ? '模板' : '文档'
      message.success(`${modeName}已保存`)
    } catch (error: any) {
      const { default: message } = await import('@/utils/message')
      message.error(error?.message || '保存失败')
      throw error
    }
    
    // 如果是文档模式，生成预览图
    if (editMode.value === 'document') {
      console.log('[EditorHeader] 发布文档，开始生成预览图')
      generateThumbnailsForPublish()
    }

    // 根据模式调用不同的发布接口
    const url = editMode.value === 'template'
      ? `${SERVER_URL}/templates/${currentId.value}/publish`
      : `${SERVER_URL}/documents/${currentId.value}/publish`

    const resp = await axios.post(url)
    if (!resp?.success) {
      throw new Error(resp?.error || '发布失败')
    }

    const modeName = editMode.value === 'template' ? '模板' : '文档'
    message.success(`${modeName}已发布`)

    // 模板模式：发布后异步生成所有已标注页面的缩略图
    if (editMode.value === 'template') {
      generateTemplateThumbnailsForPublish().catch(err => {
        console.warn('[EditorHeader] 模板缩略图生成失败:', err)
      })
    }
  } catch (error: any) {
    console.error('[EditorHeader] 发布失败:', error)
    const { default: message } = await import('@/utils/message')
    message.error(error?.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

const { enterScreening, enterScreeningFromStart } = useScreening()
const { importSpecificFile, importPPTXFile, importJSON, exporting } = useImport()
const { resetSlides } = useSlideHandler()

const mainMenuVisible = ref(false)
const hotkeyDrawerVisible = ref(false)
const editingTitle = ref(false)
const titleValue = ref('')
const titleInputRef = useTemplateRef<InstanceType<typeof Input>>('titleInputRef')

const startEditTitle = () => {
  titleValue.value = title.value
  editingTitle.value = true
  nextTick(() => titleInputRef.value?.focus())
}

const handleUpdateTitle = () => {
  slidesStore.setTitle(titleValue.value)
  editingTitle.value = false
}

const goLink = (url: string) => {
  window.open(url)
  mainMenuVisible.value = false
}

const setDialogForExport = (type: DialogForExportTypes) => {
  mainStore.setDialogForExport(type)
  mainMenuVisible.value = false
}

const openMarkupPanel = () => {
  mainStore.setMarkupPanelState(true)
}

const openAIPPTDialog = () => {
  mainStore.setAIPPTDialogState(true)
}

const toggleAIEditPanel = () => {
  mainStore.toggleAIEditPanel()
}
</script>

<style lang="scss" scoped>
.editor-header {
  background-color: #fff;
  user-select: none;
  border-bottom: 1px solid $borderColor;
  display: flex;
  justify-content: space-between;
  padding: 0 5px;
}
.left, .right {
  display: flex;
  justify-content: center;
  align-items: center;
}

.back-to-admin {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  margin-right: 8px;
  border-radius: $borderRadius;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #666;
  background-color: #f5f5f5;
  
  &:hover {
    background-color: #e8e8e8;
    color: $themeColor;
  }
  
  .arrow {
    font-size: 16px;
    font-weight: bold;
  }
  
  .text {
    font-size: 13px;
  }
}

.template-btn {
  margin: 0 4px;
  padding: 6px 14px !important;
  background-color: #f5f5f5;
  border-radius: $borderRadius;
  transition: all 0.2s;
  
  &:hover:not(.disabled) {
    background-color: #e8e8e8;
  }
  
  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .text {
    // 保存 / 发布按钮的文字略小一点，避免太显眼
    font-size: 12px !important;
    width: auto !important;
    color: #333;
  }
  
  &.publish-btn {
    background-color: $themeColor;
    
    .text {
      color: #fff;
    }
    
    &:hover:not(.disabled) {
      background-color: #40a9ff;
    }
  }
}
.menu-item {
  height: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 14px;
  padding: 0 10px;
  border-radius: $borderRadius;
  cursor: pointer;

  .icon {
    font-size: 18px;
    color: #666;
  }
  .text {
    width: 50px;
    text-align: center;
    font-size: 17px;
  }
  .ai {
    background: linear-gradient(270deg, #d897fd, #33bcfc);
    background-clip: text;
    color: transparent;
    font-weight: 700;
  }

  &:hover {
    background-color: #f1f1f1;
  }
}
.popover-menu-item {
  display: flex;
  padding: 8px 10px;

  .icon {
    font-size: 18px;
    margin-right: 10px;
  }
}
.statement {
  font-size: 12px;
  color: #999;
  padding: 8px 10px;
  font-style: italic;
}
.main-menu {
  width: 300px;
}
.ai-menu {
  background: linear-gradient(270deg, #f8edff, #d4f1ff);
  color: $themeColor;
  border-radius: $borderRadius;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  cursor: pointer;

  .icon {
    font-size: 22px;
    margin-right: 16px;
  }
  .aippt-content {
    display: flex;
    flex-direction: column;
  }
  .aippt {
    font-weight: 700;
    font-size: 16px;

    span {
      background: linear-gradient(270deg, #d897fd, #33bcfc);
      background-clip: text;
      color: transparent;
    }
  }
  .aippt-subtitle {
    font-size: 12px;
    color: #777;
    margin-top: 5px;
  }
}

.import-section {
  padding: 5px 0;

  .import-label {
    font-size: 12px;
    color: #999;
    margin-bottom: 6px;
  }
  .import-grid {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
  .import-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 12px 8px;
    border-radius: $borderRadius;
    border: 1px solid $borderColor;
    transition: background-color .2s;
    cursor: pointer;
  
    &:hover {
      background-color: #f1f1f1;
    }
    .icon {
      font-size: 24px;
      margin-bottom: 2px;
    }
    .label {
      font-size: 12px;
      text-align: center;
    }
    .sub-label {
      font-size: 10px;
      color: #999;
    }
  }
}

.group-menu-item {
  height: 30px;
  display: flex;
  margin: 0 8px;
  padding: 0 2px;
  border-radius: $borderRadius;

  &:hover {
    background-color: #f1f1f1;
  }

  .menu-item {
    padding: 0 3px;
  }
  .arrow-btn {
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
}
.title {
  height: 30px;
  margin-left: 2px;
  font-size: 13px;

  .title-input {
    width: 200px;
    height: 100%;
    padding-left: 0;
    padding-right: 0;

    ::v-deep(input) {
      height: 28px;
      line-height: 28px;
    }
  }
  .title-text {
    min-width: 20px;
    max-width: 400px;
    line-height: 30px;
    padding: 0 6px;
    border-radius: $borderRadius;
    cursor: pointer;

    @include ellipsis-oneline();

    &:hover {
      background-color: #f1f1f1;
    }
  }
}
.github-link {
  display: inline-block;
  height: 30px;
}
.ai-edit-btn {
  .icon {
    font-size: 16px;
  }
  
  &.active {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    
    .icon {
      color: #fff;
    }
  }
}
</style>