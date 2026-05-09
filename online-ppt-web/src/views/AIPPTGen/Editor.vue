<template>
  <div class="ppt-editor" @keydown="onKeyDown" tabindex="0">
    <!-- 顶部工具栏 -->
    <div class="editor-topbar">
      <div class="topbar-left">
        <span class="back-btn" @click="router.back()">← 返回</span>
        <span class="ppt-title">{{ project?.topic || '未命名PPT' }}</span>
      </div>
      <div class="topbar-center">
        <el-tooltip content="撤销 (Ctrl+Z)" placement="bottom">
          <span class="tb-btn" :class="{ disabled: !canUndo }" @click="handleUndo">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M3.3 7.7l4-4a1 1 0 011.4 1.4L6.4 7.4H13a5 5 0 010 10H8a1 1 0 010-2h5a3 3 0 000-6H6.4l2.3 2.3a1 1 0 01-1.4 1.4l-4-4a1 1 0 010-1.4z"/></svg>
          </span>
        </el-tooltip>
        <el-tooltip content="重做 (Ctrl+Y)" placement="bottom">
          <span class="tb-btn" :class="{ disabled: !canRedo }" @click="handleRedo">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor"><path d="M16.7 7.7l-4-4a1 1 0 00-1.4 1.4l2.3 2.3H7a5 5 0 000 10h5a1 1 0 000-2H7a3 3 0 010-6h6.6l-2.3 2.3a1 1 0 001.4 1.4l4-4a1 1 0 000-1.4z"/></svg>
          </span>
        </el-tooltip>
      </div>
      <div class="topbar-right">
        <el-button size="small" @click="startPresent">
          <svg viewBox="0 0 20 20" width="13" height="13" fill="currentColor" style="margin-right:4px"><path d="M6.3 2.84A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.27l9.34-5.89a1.5 1.5 0 000-2.54L6.3 2.84z"/></svg>
          演示
        </el-button>
        <el-button size="small" type="primary" :loading="saving" @click="saveChanges">保存</el-button>
        <el-button size="small" disabled>导出PPTX</el-button>
      </div>
    </div>

    <div class="editor-body">
      <!-- 左侧缩略图 -->
      <div class="thumbnail-panel" ref="thumbnailPanelRef">
        <div v-show="insertIndex === 0 && draggingIndex >= 0" class="drop-indicator" />
        <template v-for="(slide, i) in slides" :key="slide.index">
          <div
            class="thumb-item"
            :class="{ active: currentIndex === i, loading: slide.pptLoading, 'thumb-dragging': draggingIndex === i }"
            @mousedown.left.prevent="onThumbMouseDown(i, $event)"
            @click="selectSlide(i)"
          >
            <div class="thumb-num">{{ i + 1 }}</div>
            <div class="thumb-img-wrap">
              <img v-if="slide.previewUrl && !slide.pptLoading" :src="slide.previewUrl" class="thumb-img" draggable="false" />
              <div v-else class="thumb-skeleton">
                <div v-if="slide.pptLoading" class="skeleton-shimmer" />
                <span v-else class="thumb-type">{{ slide.pageType }}</span>
              </div>
            </div>
          </div>
          <div v-show="insertIndex === i + 1 && draggingIndex >= 0" class="drop-indicator" />
        </template>

        <!-- 生成中还没出现的占位 -->
        <div v-if="taskStatus === 'generating'" class="thumb-generating">
          <div class="gen-dot-row">
            <div class="gen-dot" v-for="i in 3" :key="i" :style="{ animationDelay: `${i * 0.2}s` }" />
          </div>
          <span>生成中 {{ genProgress.completed }}/{{ genProgress.total }}</span>
        </div>
        <div v-if="taskStatus === 'failed' && slides.length === 0" class="thumb-generating failed">
          <span style="color:#ef4444">任务已过期</span>
          <el-button size="small" type="primary" @click="router.push({ name: 'AIPPTHome' })">重新创建</el-button>
        </div>
      </div>

      <!-- 中间画布 -->
      <div class="canvas-area" @click="deselectOnCanvasClick">
        <template v-if="currentSlide">
          <!-- 幻灯片预览区 -->
          <div class="slide-preview" ref="slidePreviewRef">
            <div class="slide-container" :style="slideContainerStyle">
              <!-- iframe 独立裁剪层，保留圆角和内容裁剪 -->
              <div class="iframe-clip">
                <iframe
                  ref="slideIframe"
                  :srcdoc="iframeSrcdoc"
                  sandbox="allow-scripts allow-same-origin"
                  class="slide-iframe"
                  @load="onIframeLoad"
                />
              </div>
              <!-- 工具栏：transform 定位，slide-container 改 overflow:visible 后可溢出 -->
              <StyleToolbar
                v-if="selectedElementInfo"
                :elementInfo="selectedElementInfo"
                :toolbarStyle="floatingToolbarStyle"
                @styleChange="onStyleChange"
                @deleteElement="onDeleteElement"
                @aiEdit="onToolbarAiEdit"
              />
            </div>
          </div>

          <!-- 演讲稿 -->
          <div class="speaker-notes">
            <div class="notes-label">演讲稿</div>
            <el-input
              v-model="currentSlide.scriptContent"
              type="textarea"
              :rows="3"
              placeholder="在此输入演讲备注..."
              class="notes-input"
            />
          </div>
        </template>
        <div v-else class="canvas-empty">
          <el-icon><Picture /></el-icon>
          <span>暂无幻灯片</span>
        </div>
      </div>

      <!-- 右侧区域：图标条 + 弹出面板 -->
      <div class="right-sidebar">
        <!-- 滑出面板 -->
        <transition name="slide-panel">
          <div v-if="rightPanel" class="right-panel">
            <!-- AI智能编辑面板 -->
            <template v-if="rightPanel === 'ai'">
              <div class="panel-header">
                <div class="panel-title">
                  <span>AI智能编辑</span>
                  <span class="beta-badge">Beta</span>
                </div>
                <span class="close-btn" @click="rightPanel = ''">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.47 3.47a.75.75 0 00-1.06 1.06L6.94 8l-3.53 3.47a.75.75 0 001.06 1.06L8 9.06l3.47 3.47a.75.75 0 001.06-1.06L9.06 8l3.47-3.47a.75.75 0 00-1.06-1.06L8 6.94 4.47 3.47z"/></svg>
                </span>
              </div>
              <div class="page-tab">第 {{ currentIndex + 1 }} 页</div>
              <div class="ai-chat-body" ref="chatBodyRef">
                <!-- 欢迎区 + 快捷按钮：始终显示 -->
                <div class="preset-chat-box">
                  <div class="ai-bubble-wrap">
                    <div class="ai-bubble-msg">您好！我是您的 AI 编辑助手，在下面输入任意指令，我可以理解您的需求，智能修改当页PPT内容。我仍然处于 Beta 测试阶段，所以请对我耐心一点。</div>
                  </div>
                  <div class="preset-actions-wrap">
                    <span class="preset-actions-label">以下是我可以提供的一些帮助：</span>
                    <div class="preset-actions">
                      <div
                        v-for="(action, i) in quickActions"
                        :key="action"
                        class="preset-option-btn"
                        :style="{ animationDelay: i * 0.1 + 's' }"
                        :class="{ disabled: aiEditing }"
                        @click="!aiEditing && sendQuickAction(action)"
                      >{{ action }}</div>
                    </div>
                  </div>
                </div>

                <!-- 对话历史：在快捷按钮下方增长 -->
                <div class="chat-history-container">
                  <div v-for="(msg, i) in currentChatHistory" :key="i" class="chat-message-item">
                    <div v-if="msg.role === 'user'" class="user-bubble-wrap">
                      <div class="user-bubble-msg">{{ msg.content }}</div>
                    </div>
                    <div v-else class="ai-bubble-wrap">
                      <div class="ai-bubble-msg">{{ msg.content }}</div>
                    </div>
                  </div>
                  <div v-if="aiEditing" class="chat-message-item">
                    <div class="ai-bubble-wrap">
                      <div class="ai-bubble-msg typing">AI 正在处理...</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="ai-input-wrap">
                <div class="ai-chat-input">
                  <el-input
                    v-model="aiInstruction"
                    placeholder="您也可以输入想要修改的内容进行自定义修改"
                    type="textarea"
                    :rows="4"
                    @keydown.ctrl.enter="sendAiEdit"
                  />
                  <button class="send-btn" :disabled="aiEditing || !aiInstruction.trim()" @click="sendAiEdit">
                    <svg v-if="!aiEditing" viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M3.105 2.289a.75.75 0 00-.826.95l1.903 6.557H13.5a.75.75 0 010 1.5H4.182l-1.903 6.557a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.114A28.897 28.897 0 003.105 2.289z"/></svg>
                    <svg v-else viewBox="0 0 20 20" width="16" height="16" fill="currentColor" class="spin"><circle cx="10" cy="10" r="7" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="22" stroke-dashoffset="8"/></svg>
                  </button>
                </div>
              </div>
            </template>

            <!-- 素材面板 -->
            <template v-if="rightPanel === 'material'">
              <div class="panel-header">
                <div class="panel-title"><span>素材</span></div>
                <span class="close-btn" @click="rightPanel = ''">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M4.47 3.47a.75.75 0 00-1.06 1.06L6.94 8l-3.53 3.47a.75.75 0 001.06 1.06L8 9.06l3.47 3.47a.75.75 0 001.06-1.06L9.06 8l3.47-3.47a.75.75 0 00-1.06-1.06L8 6.94 4.47 3.47z"/></svg>
                </span>
              </div>

              <!-- 三个 tab -->
              <div class="mat-tab-bar">
                <span
                  v-for="tab in materialTabs"
                  :key="tab.key"
                  class="mat-tab"
                  :class="{ active: materialTab === tab.key }"
                  @click="materialTab = tab.key"
                >{{ tab.label }}</span>
              </div>

              <!-- 智能生图 -->
              <template v-if="materialTab === 'aiGen'">
                <div class="mat-body">
                  <div class="gen-input-wrap">
                    <el-input
                      v-model="genPrompt"
                      type="textarea"
                      :rows="3"
                      resize="none"
                      class="gen-prompt-input"
                      placeholder="输入图片描述，如：银行数据中心，写实风格"
                    />
                  </div>
                  <div class="gen-controls">
                    <el-select v-model="genStyle" size="small" style="flex:1">
                      <el-option label="标准配图" value="标准配图" />
                      <el-option label="写实风格" value="写实风格" />
                      <el-option label="插画风格" value="插画风格" />
                      <el-option label="扁平风格" value="扁平风格" />
                    </el-select>
                    <el-button type="primary" size="small" :loading="genLoading" @click="generateAiImage">
                      立即生成 ✨
                    </el-button>
                  </div>
                  <div class="gen-preview">
                    <div v-if="generatedImages.length" class="gen-img-card" @click="useAiImage(generatedImages[0])">
                      <img :src="generatedImages[0]" />
                    </div>
                    <div v-else class="gen-empty">
                      <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="#d1d5db" stroke-width="1.5"><rect x="4" y="8" width="32" height="24" rx="3"/><circle cx="14" cy="17" r="3"/><path d="M4 28l9-8 6 6 5-5 8 7"/></svg>
                      <span>在上方输入描述，AI将为您生成图片</span>
                    </div>
                  </div>
                  <div class="gen-history-section">
                    <div class="gen-history-title">历史记录</div>
                    <div v-if="genHistory.length === 0" class="gen-history-empty">暂无历史记录</div>
                    <div v-else class="gen-history-list">
                      <span
                        v-for="(h, i) in genHistory"
                        :key="i"
                        class="gen-history-tag"
                        @click="genPrompt = h; generateAiImage()"
                      >{{ h }}</span>
                    </div>
                  </div>
                </div>
              </template>

              <!-- 图库搜图 -->
              <template v-if="materialTab === 'search'">
                <div class="search-bar">
                  <el-input v-model="imageKeyword" placeholder="搜索图片关键词" @keydown.enter="searchImages()">
                    <template #suffix>
                      <svg viewBox="0 0 20 20" width="14" height="14" fill="#9ca3af" style="cursor:pointer" @click="searchImages()"><path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd"/></svg>
                    </template>
                  </el-input>
                  <div class="orient-btns">
                    <span
                      v-for="o in [{ k: 'all', l: '全部' }, { k: 'landscape', l: '横向' }, { k: 'portrait', l: '纵向' }, { k: 'squarish', l: '方形' }]"
                      :key="o.k"
                      class="orient-btn"
                      :class="{ active: imageOrientation === o.k }"
                      @click="setImageOrientation(o.k as any)"
                    >{{ o.l }}</span>
                  </div>
                </div>

                <div v-if="!imageResults.length && !imageLoading" class="search-empty">
                  <svg viewBox="0 0 40 40" width="36" height="36" fill="none" stroke="#d1d5db" stroke-width="1.5"><rect x="4" y="8" width="32" height="24" rx="3"/><circle cx="14" cy="17" r="3"/><path d="M4 28l9-8 6 6 5-5 8 7"/></svg>
                  <span>输入关键词搜索图片</span>
                </div>

                <div v-else class="mat-scroll-area">
                  <div class="image-grid">
                    <div
                      v-for="img in imageResults"
                      :key="img.id"
                      class="img-card"
                      @click="replaceImage(img.src)"
                    >
                      <img :src="img.src" loading="lazy" />
                    </div>
                  </div>
                  <div class="load-more-wrap">
                    <div v-if="imageLoading" class="img-loading">加载中...</div>
                    <button v-else-if="imageHasMore" class="load-more-btn" @click="loadMoreImages">加载更多</button>
                    <span v-else class="no-more-text">没有更多了</span>
                  </div>
                </div>
              </template>

              <!-- 我的素材 -->
              <template v-if="materialTab === 'mine'">
                <div class="mat-body">
                  <div class="mine-section">
                    <div class="mine-section-title">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zm1.5 0v9h9v-9h-9z"/><path d="M5 7.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5zM5 10a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3A.5.5 0 015 10z"/></svg>
                      本地图片
                    </div>
                    <!-- 本地上传区域 -->
                    <div v-if="localImages.length === 0" class="upload-zone" @click="triggerFileInput">
                      <svg viewBox="0 0 40 40" width="28" height="28" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M20 26V14M14 20l6-6 6 6"/><path d="M8 28a12 12 0 010-16 12 12 0 0124 0 12 12 0 010 16"/></svg>
                      <span class="upload-text">点击上传本地图片</span>
                      <span class="upload-hint">支持 JPG、PNG 格式</span>
                    </div>
                    <div v-else class="local-imgs-grid">
                      <div class="upload-add-btn" @click="triggerFileInput">
                        <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="#9ca3af" stroke-width="1.5"><path d="M10 4v12M4 10h12"/></svg>
                      </div>
                      <div
                        v-for="(src, i) in localImages"
                        :key="i"
                        class="img-card"
                        @click="replaceImage(src)"
                      >
                        <img :src="src" />
                      </div>
                    </div>
                    <input ref="fileInputRef" type="file" accept="image/jpeg,image/png,image/webp" multiple style="display:none" @change="onFileChange" />
                  </div>
                  <div class="mine-section" style="margin-top:16px">
                    <div class="mine-section-title">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zm1.5 0v9h9v-9h-9z"/></svg>
                      文档中的图片
                    </div>
                    <div class="mine-empty">暂无文档图片</div>
                  </div>
                </div>
              </template>
            </template>
          </div>
        </transition>

        <!-- 常驻图标条 -->
        <div class="icon-strip">
          <div class="strip-btn" :class="{ active: rightPanel === 'ai' }" @click="rightPanel = rightPanel === 'ai' ? '' : 'ai'">
            <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M9.25 3.75a.75.75 0 011.5 0V5h1.5A2.25 2.25 0 0114.5 7.25v.042a8.5 8.5 0 012.03 1.28.75.75 0 01-.96 1.152 7 7 0 00-1.07-.732v4.258a2.25 2.25 0 01-2.25 2.25h-4.5A2.25 2.25 0 015.5 13V8.25a2.25 2.25 0 012.25-2.25H9.25V3.75zM7.75 7.5A.75.75 0 007 8.25V13c0 .414.336.75.75.75h4.5A.75.75 0 0013 13V8.25a.75.75 0 00-.75-.75h-4.5z"/><path d="M16.78 3.22a.75.75 0 010 1.06l-1.5 1.5a.75.75 0 11-1.06-1.06l1.5-1.5a.75.75 0 011.06 0z"/></svg>
            <span>AI编辑</span>
          </div>
          <el-tooltip :content="selectedIsImage ? '素材' : '请先选择幻灯片中的图片'" placement="left">
            <div class="strip-btn" :class="{ active: rightPanel === 'material', dim: !selectedIsImage }" @click="openMaterial">
              <svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159M14.25 12.75l1.409-1.409a2.25 2.25 0 013.182 0l.909.909M14.25 7.5a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM3.75 19.5h12.5A2.25 2.25 0 0018.5 17.25V5.25A2.25 2.25 0 0016.25 3H3.75A2.25 2.25 0 001.5 5.25v12A2.25 2.25 0 003.75 19.5z"/></svg>
              <span>素材</span>
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>

  <!-- 演示模式全屏覆盖层 -->
  <teleport to="body">
    <transition name="present-fade">
      <div v-if="presenting" class="present-overlay" @click.self="exitPresent" @mousemove="onPresentMouseMove">
        <!-- 幻灯片画布 -->
        <div class="present-stage" :style="presentStageStyle">
          <iframe
            :srcdoc="presentSrcdoc"
            :style="presentIframeStyle"
            sandbox="allow-scripts allow-same-origin"
            class="present-iframe"
          />
        </div>

        <!-- 底部控制栏（悬浮在幻灯片上，不占高度） -->
        <div class="present-controls" @click.stop @mouseenter="showControls = true" @mouseleave="showControls = false" :class="{ visible: showControls }">
          <button class="present-nav-btn" :disabled="presentIndex === 0" @click="presentGo(presentIndex - 1)">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clip-rule="evenodd"/></svg>
          </button>
          <span class="present-progress">{{ presentIndex + 1 }} / {{ slides.length }}</span>
          <button class="present-nav-btn" :disabled="presentIndex === slides.length - 1" @click="presentGo(presentIndex + 1)">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/></svg>
          </button>
          <button class="present-exit-btn" @click="exitPresent">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/></svg>
            退出演示
          </button>
        </div>

        <!-- 演讲备注 -->
        <div v-if="presentNotes && showControls" class="present-notes">{{ presentNotes }}</div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Picture, Close, Search } from '@element-plus/icons-vue'
import { aipptGenApi } from '@/services/aipptGenService'
import api, { authFetch } from '@/services'
import StyleToolbar from './components/StyleToolbar.vue'
import { useSlideEditor, modifyHtml, getElementPropFromHtml, type UndoAction } from './composables/useSlideEditor'

const route = useRoute()
const router = useRouter()
const projectId = route.params.projectId as string
const taskId = ref(sessionStorage.getItem('aippt_taskId') || '')

const project = ref<any>(null)
const slides = ref<any[]>([])
const currentIndex = ref(0)
const currentSlide = computed(() => slides.value[currentIndex.value] || null)

const taskStatus = ref<'generating' | 'completed' | 'failed'>('generating')
const genProgress = ref({ total: 0, completed: 0 })

// 缩略图拖拽排序
const thumbnailPanelRef = ref<HTMLElement>()
const draggingIndex = ref(-1)
const insertIndex = ref(-1)
let _dragClone: HTMLElement | null = null
let _dragOffsetX = 0, _dragOffsetY = 0
let _dragFromIndex = -1
let _dragMoved = false
let _dragPendingClick = false


const rightPanel = ref<'' | 'ai' | 'material'>('')
const materialTab = ref('search')
const materialTabs = [
  { key: 'aiGen', label: '智能生图' },
  { key: 'search', label: '图库搜图' },
  { key: 'mine', label: '我的素材' },
]

const aiInstruction = ref('')
const aiEditing = ref(false)
type ChatMsg = { role: 'user' | 'assistant'; content: string }
const chatHistoryMap = ref<Record<number, ChatMsg[]>>({})
const currentChatHistory = computed(() => chatHistoryMap.value[currentIndex.value] ?? [])
const chatBodyRef = ref<HTMLElement>()
const quickActions = ['重新生成该页', '内容超出画面了', '丰富页面布局内容']

// 图库搜图
const imageKeyword = ref('')
const imageResults = ref<{ id: number; src: string; width: number; height: number }[]>([])
const imageLoading = ref(false)
const imageHasMore = ref(false)
const imagePage = ref(1)
const imageOrientation = ref<'landscape' | 'portrait' | 'squarish' | 'all'>('all')

// 智能生图
const genPrompt = ref('')
const genStyle = ref('标准配图')
const genLoading = ref(false)
const generatedImages = ref<string[]>([])
const genHistory = ref<string[]>([])

// 我的素材
const fileInputRef = ref<HTMLInputElement>()
const localImages = ref<string[]>([])

// 当前选中的是图片元素
const selectedIsImage = computed(() => selectedElementInfo.value?.tagName === 'IMG')

const saving = ref(false)
const slidePreviewRef = ref<HTMLElement>()
const slideIframe = ref<HTMLIFrameElement>()
const scale = ref(0.7)

// 追踪当前会话中被修改过的 slides 索引（用于增量保存）
const dirtySlideIndexes = ref<Set<number>>(new Set())

// iframe srcdoc 独立管理，避免编辑时触发重载
const iframeSrcdoc = ref('')

const slideContainerStyle = computed(() => ({
  width: `${1280 * scale.value}px`,
  height: `${720 * scale.value}px`,
  position: 'relative' as const,
}))

const loadingHtml = `<html><body style="margin:0;width:1280px;height:720px;display:flex;align-items:center;justify-content:center;background:#f9fafb"><div style="text-align:center;color:#9ca3af;font-family:sans-serif"><div style="font-size:24px;margin-bottom:8px">⏳</div><div>AI 正在生成...</div></div></body></html>`

// 编辑功能
const {
  selectedElementInfo, canUndo, canRedo,
  commitStyleEdit, commitHtmlEdit, undo, redo, clearStacks,
  injectEditingScript, sendMessageToIframe,
} = useSlideEditor()

// 选中元素的边界矩形（iframe 坐标系）
const selectedRect = ref<{ left: number; top: number; width: number; height: number } | null>(null)

// 浮动工具栏位置：position:absolute 锚在 slide-container 左上角，transform 移到元素上方
// slide-container 改为 overflow:visible，工具栏可以向上溢出到 slide 外
const floatingToolbarStyle = computed(() => {
  if (!selectedRect.value) return { display: 'none' }
  const r = selectedRect.value
  const s = scale.value
  const toolbarH = 40
  const gap = 6
  // 元素在 slide-container 内的位置（iframe 坐标 × scale）
  const x = r.left * s
  const y = r.top * s
  const elemBottom = (r.top + r.height) * s
  // 优先放元素上方；若元素太靠上则放元素下方
  const ty = y - toolbarH - gap >= 0 ? y - toolbarH - gap : elemBottom + gap
  return {
    position: 'absolute' as const,
    left: '0px',
    top: '0px',
    transform: `translate(${x}px, ${ty}px)`,
    zIndex: 9999,
  }
})

let pollTimer: ReturnType<typeof setTimeout> | null = null
let pollRetryCount = 0
let resizeObserver: ResizeObserver | null = null


// srcdoc iframe 的 origin 是 null，无法解析 /libs/ 等绝对路径，需注入 <base> 让浏览器知道根地址
function withBaseTag(html: string): string {
  if (html.includes('<base ')) return html
  const base = `<base href="${window.location.origin}/">`
  return html.includes('<head>') ? html.replace('<head>', `<head>${base}`) : html.replace('<html>', `<html><head>${base}</head>`)
}

function syncIframeSrcdoc() {
  const slide = currentSlide.value
  if (slide) {
    iframeSrcdoc.value = withBaseTag(slide.htmlContent || loadingHtml)
  }
  selectedElementInfo.value = null
  selectedRect.value = null
}

onMounted(async () => {
  // 加载项目（如果存在）
  try {
    const res = await aipptGenApi.getProject(projectId)
    project.value = (res as any).data
    // sessionStorage 里的 summary 优先补入（首次进入编辑页时还没保存过）
    if (!project.value?.summary) {
      const storedSummary = sessionStorage.getItem('aippt_summary')
      if (storedSummary && project.value) project.value.summary = storedSummary
    }
    if (project.value?.slides?.length) {
      slides.value = project.value.slides
      taskStatus.value = 'completed'
      syncIframeSrcdoc()
    }
  } catch {}

  // 加载已上传的素材图片
  try {
    const imgRes = await aipptGenApi.listUserImages(projectId) as any
    const urls: string[] = imgRes.data?.urls || []
    localImages.value = urls
  } catch {}

  updateScale()
  resizeObserver = new ResizeObserver(updateScale)
  const setupObserver = () => {
    nextTick(() => {
      if (resizeObserver && slidePreviewRef.value) {
        resizeObserver.disconnect()
        resizeObserver.observe(slidePreviewRef.value)
      }
    })
  }
  setupObserver()
  // 只在切换页面时重载 iframe，编辑操作通过 postMessage 无感更新
  watch(currentIndex, () => { setupObserver(); syncIframeSrcdoc(); aiInstruction.value = '' })


  const hasLoading = slides.value.some(s => s.pptLoading)
  if (taskId.value && (slides.value.length === 0 || hasLoading)) {
    pollRetryCount = 0
    pollTaskStatus()
  }

  // 监听 iframe postMessage
  window.addEventListener('message', handleIframeMessage)
})

onUnmounted(() => {
  if (pollTimer) clearTimeout(pollTimer)
  resizeObserver?.disconnect()
  window.removeEventListener('message', handleIframeMessage)
  window.removeEventListener('keydown', onPresentKeyDown)
  window.removeEventListener('resize', calcPresentScale)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  document.removeEventListener('mousemove', _onDragMove)
  document.removeEventListener('mouseup', _onDragUp)
  if (_dragClone) { document.body.removeChild(_dragClone); _dragClone = null }
})

// ===== 演示模式 =====
const presenting = ref(false)
const presentIndex = ref(0)
const showControls = ref(false)
let hideControlsTimer: ReturnType<typeof setTimeout> | null = null

function onPresentMouseMove() {
  showControls.value = true
  if (hideControlsTimer) clearTimeout(hideControlsTimer)
  hideControlsTimer = setTimeout(() => { showControls.value = false }, 2500)
}
const presentSrcdoc = ref('')
const presentScale = ref(1)

const presentStageStyle = computed(() => ({
  width: `${1280 * presentScale.value}px`,
  height: `${720 * presentScale.value}px`,
  overflow: 'hidden',
}))

const presentIframeStyle = computed(() => ({
  transform: `scale(${presentScale.value})`,
  transformOrigin: 'top left',
  width: '1280px',
  height: '720px',
}))

const presentNotes = computed(() =>
  slides.value[presentIndex.value]?.scriptContent?.trim() || ''
)

function calcPresentScale() {
  presentScale.value = Math.min(window.innerWidth / 1280, window.innerHeight / 720)
}

function presentGo(idx: number) {
  if (idx < 0 || idx >= slides.value.length) return
  presentIndex.value = idx
  const slide = slides.value[idx]
  presentSrcdoc.value = withBaseTag(slide?.htmlContent || loadingHtml)
}

async function startPresent() {
  if (!slides.value.length) return
  presentIndex.value = currentIndex.value
  presenting.value = true
  presentSrcdoc.value = withBaseTag(slides.value[presentIndex.value]?.htmlContent || loadingHtml)
  window.addEventListener('keydown', onPresentKeyDown)
  window.addEventListener('resize', calcPresentScale)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  try {
    await document.documentElement.requestFullscreen()
    // fullscreenchange 会触发 calcPresentScale，无需在这里调用
  } catch {
    // 全屏不可用时降级（窗口模式）
    calcPresentScale()
  }
}

function exitPresent() {
  presenting.value = false
  window.removeEventListener('keydown', onPresentKeyDown)
  window.removeEventListener('resize', calcPresentScale)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
}

function onFullscreenChange() {
  // 用户通过 Esc/F11 等浏览器方式退出全屏时同步退出演示模式
  if (!document.fullscreenElement && presenting.value) {
    presenting.value = false
    window.removeEventListener('keydown', onPresentKeyDown)
    window.removeEventListener('resize', calcPresentScale)
    document.removeEventListener('fullscreenchange', onFullscreenChange)
  }
  // 全屏状态变化后重新计算比例
  calcPresentScale()
}

function onPresentKeyDown(e: KeyboardEvent) {
  if (!presenting.value) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault()
    presentGo(presentIndex.value + 1)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    presentGo(presentIndex.value - 1)
  } else if (e.key === 'Escape') {
    exitPresent()
  }
}

function updateScale() {
  if (!slidePreviewRef.value) return
  const { clientWidth, clientHeight } = slidePreviewRef.value
  const availW = clientWidth - 48
  const availH = clientHeight - 48
  scale.value = Math.min(availW / 1280, availH / 720, 1)
}

async function pollTaskStatus() {
  if (!taskId.value) return
  try {
    const res = await aipptGenApi.getTaskStatus(taskId.value)
    const data = (res as any).data
    if (!data) {
      // 任务不存在（后端重启丢失），尝试从项目恢复
      if (slides.value.length > 0) {
        taskStatus.value = 'completed'
      } else {
        taskStatus.value = 'failed'
        ElMessage.warning('任务已过期，请重新生成')
      }
      return
    }
    taskStatus.value = data.status
    genProgress.value = data.progress || { total: 0, completed: 0 }

    // 合并新生成的 slides
    let currentSlideUpdated = false
    for (const s of (data.slides || [])) {
      const existing = slides.value.find(x => x.index === s.index)
      if (!existing) {
        slides.value.push(s)
        slides.value.sort((a, b) => a.index - b.index)
        if (s.index === currentIndex.value) currentSlideUpdated = true
      } else if (existing.pptLoading && !s.pptLoading) {
        Object.assign(existing, s)
        if (existing.index === currentIndex.value) currentSlideUpdated = true
      }
    }
    // 当前页有新内容时同步 iframe
    if (currentSlideUpdated && currentSlide.value?.htmlContent) {
      syncIframeSrcdoc()
    } else if (currentSlide.value?.htmlContent && !iframeSrcdoc.value) {
      syncIframeSrcdoc()
    }

    if (data.status === 'generating') {
      pollTimer = setTimeout(pollTaskStatus, 3000)
    } else if (data.status === 'completed') {
      // 保存最终 slides 到项目
      await aipptGenApi.batchUpdate(projectId, [])
      saveSlides()
    }
  } catch (err: any) {
    // axios 拦截器已把 404 包装成 Error('任务不存在')，原始 response 丢失
    // 所以用错误消息内容判断
    const msg = err?.message || String(err)
    if (msg.includes('任务不存在') || msg.includes('404') || err?.response?.status === 404) {
      if (slides.value.length > 0) {
        taskStatus.value = 'completed'
      } else {
        taskStatus.value = 'failed'
        ElMessage.warning('任务已过期，请重新生成')
      }
      return
    }
    // 网络错误等其他情况，最多重试3次后停止
    pollRetryCount++
    if (pollRetryCount >= 3) {
      taskStatus.value = slides.value.length > 0 ? 'completed' : 'failed'
      if (slides.value.length === 0) ElMessage.warning('无法连接服务器，请稍后重试')
      return
    }
    pollTimer = setTimeout(pollTaskStatus, 5000)
  }
}

async function saveSlides() {
  try {
    await aipptGenApi.createProject({
      id: projectId,
      topic: project.value?.topic,
      themeId: project.value?.themeId,
      outline: project.value?.outline,
      summary: project.value?.summary,
      slides: slides.value,
    })
  } catch {}
}

function selectSlide(i: number) {
  if (_dragPendingClick) return
  currentIndex.value = i
}

function onIframeLoad() {
  if (!slideIframe.value) return
  injectEditingScript(slideIframe.value)
}

// ========== 编辑消息处理 ==========
function handleIframeMessage(e: MessageEvent) {
  const msg = e.data
  if (!msg?.type) return

  if (msg.type === 'elementClick') {
    selectedElementInfo.value = msg.data || null
    selectedRect.value = msg.data?.boundingRect || null
    // 点击图片元素时自动打开素材面板
    if (msg.data?.tagName === 'IMG') {
      rightPanel.value = 'material'
    } else if (rightPanel.value === 'material') {
      rightPanel.value = ''
    }
  } else if (msg.type === 'dragEnd') {
    const { xpath, transform } = msg.data
    if (!currentSlide.value?.htmlContent || !xpath) return
    const oldTransform = getElementPropFromHtml(currentSlide.value.htmlContent, xpath, 'transform')
    commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'transform', oldTransform, transform)
    dirtySlideIndexes.value.add(currentIndex.value)
  } else if (msg.type === 'textChange') {
    // 双击编辑完成后，以 innerHTML diff 方式记录，撤销时无感
    const { xpath, innerHTML: newInner } = msg.data
    if (!xpath || !currentSlide.value?.htmlContent) return
    const oldInner = getElementPropFromHtml(currentSlide.value.htmlContent, xpath, 'innerHTML')
    if (oldInner === newInner) return
    commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'innerHTML', oldInner, newInner)
    dirtySlideIndexes.value.add(currentIndex.value)
  } else if (msg.type === 'replaceImg') {
    rightPanel.value = 'material'
  }
}

function onStyleChange(prop: string, value: string) {
  if (!selectedElementInfo.value?.xpath || !currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value.xpath
  // 从 selectedElementInfo.styles 取当前值作为旧值
  const styleKey = prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const oldValue = (selectedElementInfo.value.styles as any)[styleKey] || ''
  commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', prop, oldValue, value)
  dirtySlideIndexes.value.add(currentIndex.value)
  // 同步 iframe 内的视觉（无感）
  sendMessageToIframe(slideIframe.value!, {
    type: 'UPDATE_ELEMENT_STYLE',
    id: xpath,
    styleProperty: [prop],
    styleValue: [value],
  })
  ;(selectedElementInfo.value.styles as any)[styleKey] = value
}

function onDeleteElement() {
  if (!selectedElementInfo.value?.xpath || !currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value.xpath
  const oldDisplay = (selectedElementInfo.value.styles as any).display || 'block'
  commitStyleEdit(slides.value, currentIndex.value, xpath, 'xpath', 'display', oldDisplay, 'none')
  dirtySlideIndexes.value.add(currentIndex.value)
  selectedElementInfo.value = null
  selectedRect.value = null
  sendMessageToIframe(slideIframe.value!, {
    type: 'UPDATE_ELEMENT_STYLE',
    id: xpath,
    styleProperty: ['display'],
    styleValue: ['none'],
  })
}

function onToolbarAiEdit() {
  rightPanel.value = rightPanel.value === 'ai' ? '' : 'ai'
}

function deselectOnCanvasClick(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('.slide-container')) return
  selectedElementInfo.value = null
  selectedRect.value = null
  if (slideIframe.value) {
    sendMessageToIframe(slideIframe.value, { type: 'DESELECT_ALL' })
  }
}

function applyActionToIframe(action: UndoAction, direction: 'undo' | 'redo') {
  const currentSlide = slides.value[currentIndex.value]
  if (!currentSlide || currentSlide.index !== action.slideId) return
  if (action.type === 'style') {
    // 属性级更新，完全无感，不触发动画重播
    sendMessageToIframe(slideIframe.value!, {
      type: 'UPDATE_ELEMENT_STYLE',
      id: action.xpath,
      styleProperty: action.prop,
      styleValue: direction === 'undo' ? action.oldValue : action.newValue,
    })
  } else {
    // 整页替换（AI编辑等）：用 syncIframeSrcdoc 避免 body 属性不更新的 bug
    syncIframeSrcdoc()
  }
}

function handleUndo() {
  const action = undo(slides.value)
  if (!action) return
  selectedElementInfo.value = null
  selectedRect.value = null
  const idx = slides.value.findIndex((s: any) => s.index === action.slideId)
  if (idx >= 0) dirtySlideIndexes.value.add(idx)
  applyActionToIframe(action, 'undo')
}

function handleRedo() {
  const action = redo(slides.value)
  if (!action) return
  selectedElementInfo.value = null
  selectedRect.value = null
  const idx = slides.value.findIndex((s: any) => s.index === action.slideId)
  if (idx >= 0) dirtySlideIndexes.value.add(idx)
  applyActionToIframe(action, 'redo')
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    handleUndo()
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()
    handleRedo()
  } else if (e.key === 'Delete' && selectedElementInfo.value) {
    e.preventDefault()
    onDeleteElement()
  }
}

function pushChat(role: 'user' | 'assistant', content: string) {
  const idx = currentIndex.value
  if (!chatHistoryMap.value[idx]) chatHistoryMap.value[idx] = []
  chatHistoryMap.value[idx].push({ role, content })
  nextTick(() => {
    if (chatBodyRef.value) chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
  })
}

function sendQuickAction(text: string) {
  if (text === '重新生成该页') {
    regeneratePage()
  } else {
    aiInstruction.value = text
    sendAiEdit()
  }
}

async function sendAiEdit() {
  if (!aiInstruction.value.trim() || !currentSlide.value?.htmlContent) return
  const instruction = aiInstruction.value.trim()
  // 取本页历史（push 之前），过滤掉"重新生成"这类非编辑指令
  const history = (chatHistoryMap.value[currentIndex.value] || [])
    .filter(m => m.content !== '重新生成该页' && !m.content.startsWith('好的，已为您重新生成'))
  pushChat('user', instruction)
  aiInstruction.value = ''
  aiEditing.value = true

  try {
    const pageType = currentSlide.value.pageType || project.value?.outline?.pages?.[currentIndex.value]?.type || 'content'
    const res = await aipptGenApi.aiEdit(currentSlide.value.htmlContent, instruction, undefined, history, pageType, projectId)
    const newHtml = (res as any).data?.htmlContent
    if (newHtml) {
      commitHtmlEdit(slides.value, currentIndex.value, currentSlide.value!.htmlContent, newHtml)
      dirtySlideIndexes.value.add(currentIndex.value)
      syncIframeSrcdoc()
      pushChat('assistant', '已完成修改 ✓')
    }
  } catch (err: any) {
    pushChat('assistant', '修改失败：' + err.message)
  } finally {
    aiEditing.value = false
  }
}

let _dragStartX = 0, _dragStartY = 0

function onThumbMouseDown(i: number, e: MouseEvent) {
  if (taskStatus.value === 'generating') return
  _dragFromIndex = i
  _dragMoved = false
  _dragStartX = e.clientX
  _dragStartY = e.clientY
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  _dragOffsetX = e.clientX - rect.left
  _dragOffsetY = e.clientY - rect.top
  document.addEventListener('mousemove', _onDragMove)
  document.addEventListener('mouseup', _onDragUp)
}

function _onDragMove(e: MouseEvent) {
  if (_dragFromIndex < 0) return

  // 超过 5px 才正式开始拖拽，避免点击误触
  if (!_dragMoved) {
    if (Math.abs(e.clientX - _dragStartX) < 5 && Math.abs(e.clientY - _dragStartY) < 5) return
    const el = thumbnailPanelRef.value?.querySelectorAll<HTMLElement>('.thumb-item')[_dragFromIndex]
    if (!el) return
    _dragMoved = true
    draggingIndex.value = _dragFromIndex
    const rect = el.getBoundingClientRect()
    _dragClone = el.cloneNode(true) as HTMLElement
    Object.assign(_dragClone.style, {
      position: 'fixed', zIndex: '9999',
      width: rect.width + 'px', height: rect.height + 'px',
      left: (e.clientX - _dragOffsetX) + 'px',
      top: (e.clientY - _dragOffsetY) + 'px',
      pointerEvents: 'none', opacity: '0.92',
      boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
      borderRadius: '6px', border: '2px solid #6366f1',
      transform: 'rotate(1.5deg)',
    })
    document.body.appendChild(_dragClone)
  }

  // 移动克隆
  if (_dragClone) {
    _dragClone.style.left = (e.clientX - _dragOffsetX) + 'px'
    _dragClone.style.top = (e.clientY - _dragOffsetY) + 'px'
  }

  // 计算插入位置（排除 dragging 元素本身，避免自身干扰计算）
  const panel = thumbnailPanelRef.value
  if (!panel) return
  const items = [...panel.querySelectorAll<HTMLElement>('.thumb-item')]
  let newInsert = slides.value.length
  for (let i = 0; i < items.length; i++) {
    if (i === _dragFromIndex) continue
    const r = items[i].getBoundingClientRect()
    const adjustedIdx = i > _dragFromIndex ? i : i
    if (e.clientY < r.top + r.height / 2) { newInsert = i; break }
  }
  insertIndex.value = newInsert
}

function _onDragUp() {
  document.removeEventListener('mousemove', _onDragMove)
  document.removeEventListener('mouseup', _onDragUp)

  const from = _dragFromIndex
  const to = insertIndex.value
  const moved = _dragMoved

  if (_dragClone) { document.body.removeChild(_dragClone); _dragClone = null }
  draggingIndex.value = -1
  insertIndex.value = -1
  _dragFromIndex = -1
  _dragMoved = false

  if (!moved || from < 0 || to < 0 || from === to || from + 1 === to) return

  // 阻止紧随的 click 事件触发 selectSlide
  _dragPendingClick = true
  setTimeout(() => { _dragPendingClick = false }, 0)

  const selected = slides.value[currentIndex.value]
  const arr = [...slides.value]
  const [item] = arr.splice(from, 1)
  arr.splice(from < to ? to - 1 : to, 0, item)
  slides.value = arr
  currentIndex.value = arr.indexOf(selected)
  // 优先用 slideId，旧数据没有时 fallback 到 String(index)
  aipptGenApi.reorderSlides(projectId, arr.map((s: any) => s.slideId ?? String(s.index))).catch(() => {})
}

async function regeneratePage() {
  if (!currentSlide.value || aiEditing.value) return
  const outline = project.value?.outline
  const pageData = outline?.pages?.[currentIndex.value]
  const pageType = pageData?.type || currentSlide.value.type || 'content'
  const content = pageData ? { title: pageData.title, description: pageData.description } : {}

  pushChat('user', '重新生成该页')
  aiEditing.value = true

  try {
    const res = await aipptGenApi.regenerateSlide({
      pageType,
      content,
      themeId: project.value?.themeId,
      topic: project.value?.topic,
      summary: project.value?.summary,
      options: project.value?.options,
    }) as any
    const newHtml = res.data?.htmlContent
    if (newHtml) {
      commitHtmlEdit(slides.value, currentIndex.value, currentSlide.value!.htmlContent, newHtml)
      dirtySlideIndexes.value.add(currentIndex.value)
      syncIframeSrcdoc()
      pushChat('assistant', '好的，已为您重新生成该页 ✓')
    }
  } catch (err: any) {
    pushChat('assistant', '重新生成失败：' + err.message)
  } finally {
    aiEditing.value = false
  }
}

async function searchImages(reset = true) {
  if (!imageKeyword.value.trim()) return
  if (imageLoading.value) return
  imageLoading.value = true
  if (reset) {
    imagePage.value = 1
    imageResults.value = []
  }
  try {
    const params: any = { keyword: imageKeyword.value, count: 6, page: imagePage.value }
    if (imageOrientation.value !== 'all') params.orientation = imageOrientation.value
    const res = await api.searchImages(params)
    const data = res?.data
    const newImgs = (data?.images || []).map((img: any) => ({
      id: img.id, src: img.src, width: img.width, height: img.height,
    }))
    imageResults.value = reset ? newImgs : [...imageResults.value, ...newImgs]
    imageHasMore.value = data?.hasMore !== false && newImgs.length > 0
  } catch (err: any) {
    ElMessage.error('搜图失败：' + err.message)
  } finally {
    imageLoading.value = false
  }
}

async function loadMoreImages() {
  if (!imageHasMore.value || imageLoading.value) return
  imagePage.value++
  await searchImages(false)
}

function setImageOrientation(val: typeof imageOrientation.value) {
  imageOrientation.value = val
  if (imageKeyword.value.trim()) searchImages()
}

function replaceImage(url: string) {
  if (!currentSlide.value?.htmlContent) return
  const xpath = selectedElementInfo.value?.xpath
  const oldHtml = currentSlide.value.htmlContent
  let newHtml: string
  if (xpath) {
    newHtml = modifyHtml(oldHtml, 'xpath', xpath, 'src', url)
  } else {
    newHtml = oldHtml.replace(/<img([^>]*?)>/, (match) => {
      if (match.includes('src=')) return match
      return match.replace(/<img/, `<img src="${url}"`)
    })
  }
  commitHtmlEdit(slides.value, currentIndex.value, oldHtml, newHtml)
  dirtySlideIndexes.value.add(currentIndex.value)
  syncIframeSrcdoc()
  ElMessage.success('图片已替换')
}

async function generateAiImage() {
  if (!genPrompt.value.trim()) return
  genLoading.value = true
  try {
    const styleMap: Record<string, string> = {
      '标准配图': '',
      '写实风格': '，写实摄影风格',
      '插画风格': '，插画风格，矢量图',
      '扁平风格': '，扁平设计风格，简洁',
    }
    const fullPrompt = genPrompt.value.trim() + (styleMap[genStyle.value] || '')
    const res = await aipptGenApi.generateImage(fullPrompt, projectId) as any
    const urls: string[] = res.data?.urls || []
    generatedImages.value = urls
    if (urls.length) genHistory.value.unshift(genPrompt.value)
  } catch (err: any) {
    ElMessage.error('生成失败：' + err.message)
  } finally {
    genLoading.value = false
  }
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const fileArray = Array.from(input.files || [])
  input.value = ''
  if (!fileArray.length) return
  try {
    const form = new FormData()
    fileArray.forEach(f => form.append('images', f))
    const res = await authFetch(`/aippt-gen/project/${projectId}/images`, { method: 'POST', body: form })
    const json = await res.json()
    if (!json.success) throw new Error(json.message)
    ;(json.data?.urls as string[]).forEach(url => localImages.value.unshift(url))
  } catch {
    ElMessage.error('图片上传失败，请重试')
  }
}

async function useAiImage(tempUrl: string) {
  try {
    const res = await aipptGenApi.useAiImage(tempUrl, projectId) as any
    replaceImage(res.data?.url || tempUrl)
  } catch {
    replaceImage(tempUrl)
  }
}

function openMaterial() {
  if (!selectedIsImage.value) {
    ElMessage.info('请先在幻灯片中点击选择一张图片')
    return
  }
  rightPanel.value = rightPanel.value === 'material' ? '' : 'material'
}

async function saveChanges() {
  if (!slides.value.length) return

  // 只传本次会话中被修改过的 slides（增量保存）
  const dirtySlides = slides.value.filter(s => dirtySlideIndexes.value.has(s.index))
  if (dirtySlides.length === 0) {
    ElMessage.info('没有需要保存的修改')
    return
  }

  saving.value = true
  try {
    const changedSlides = dirtySlides
      .filter(s => s.htmlContent && !s.pptLoading)
      .map(s => ({ index: s.index, htmlContent: s.htmlContent }))

    const res = await aipptGenApi.batchUpdate(projectId, changedSlides)
    const updated = (res as any).data?.updated_pages || []

    // 更新左侧缩略图（加时间戳破浏览器缓存）
    const ts = Date.now()
    for (const u of updated) {
      const slide = slides.value.find(s => s.index === u.index)
      if (slide && u.previewUrl) {
        const url = u.previewUrl
        slide.previewUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + ts
      }
    }

    // 清空脏标记
    dirtySlideIndexes.value.clear()

    const savedCount = updated.length
    ElMessage.success(`已保存 ${savedCount} 个页面`)
  } catch (err: any) {
    ElMessage.error('保存失败：' + err.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.ppt-editor {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f1f3f5;
  overflow: hidden;
}

.editor-topbar {
  height: 52px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  flex-shrink: 0;
  z-index: 100;
}
.topbar-left { display: flex; align-items: center; gap: 14px; }
.topbar-center { display: flex; align-items: center; gap: 4px; }
.back-btn { font-size: 13px; color: #6b7280; cursor: pointer; &:hover { color: #374151; } }
.ppt-title { font-size: 14px; font-weight: 500; color: #374151; }
.topbar-right { display: flex; align-items: center; gap: 8px; }

// 通用工具栏按钮
.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  color: #6b7280;
  font-size: 14px;
  transition: all 0.15s;

  &:hover { background: #f3f4f6; color: #374151; }
  &.disabled { opacity: 0.35; cursor: default; pointer-events: none; }
}

.editor-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

// 左侧缩略图
.thumbnail-panel {
  width: 160px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  padding: 12px 8px;
  flex-shrink: 0;
  position: relative; // 供绝对定位占位使用

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
}

.thumb-item {
  cursor: grab;
  margin-bottom: 10px;
  border-radius: 6px;
  border: 2px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
  position: relative;
  user-select: none;
  -webkit-user-select: none;

  &:hover { border-color: #a5b4fc; }
  &.active { border-color: #6366f1; box-shadow: 0 0 0 1px rgba(99,102,241,0.3); }
  &.loading { opacity: 0.6; }
}

.thumb-num {
  position: absolute;
  bottom: 4px;
  left: 4px;
  font-size: 10px;
  color: #fff;
  background: rgba(0,0,0,0.4);
  padding: 1px 5px;
  border-radius: 3px;
  z-index: 1;
}

.thumb-img-wrap { width: 100%; aspect-ratio: 16/9; }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-skeleton {
  width: 100%;
  height: 100%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  .thumb-type { font-size: 10px; color: #9ca3af; }
}
.skeleton-shimmer {
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
}

.thumb-generating {
  text-align: center;
  padding: 12px 0;
  color: #9ca3af;
  font-size: 11px;
}
.gen-dot-row { display: flex; justify-content: center; gap: 4px; margin-bottom: 6px; }
.gen-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #6366f1;
  animation: bounce 1s infinite;
  @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
}

// 拖拽排序：原位置半透明占位
.thumb-item.thumb-dragging { opacity: 0.35; }

// 插入位置蓝色细线指示器
.drop-indicator {
  height: 2px;
  background: #6366f1;
  border-radius: 1px;
  margin: 3px 0;
  position: relative;
  pointer-events: none;
  &::before, &::after {
    content: '';
    position: absolute;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #6366f1;
    top: 50%; transform: translateY(-50%);
  }
  &::before { left: -4px; }
  &::after { right: -4px; }
}

// 中间画布
.canvas-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  gap: 12px;
  padding: 16px;
}

.slide-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.06);
  background-image: radial-gradient(rgba(209, 213, 219, 0.4) 1px, transparent 1px);
  background-size: 24px 24px;
  overflow: hidden;
}

.slide-container {
  /* overflow:visible 让工具栏能溢出到 slide 上方/下方 */
  overflow: visible;
  position: relative;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  background: #fff;
  border-radius: 8px;
}

/* iframe 独立裁剪层：保留圆角和内容裁剪 */
.iframe-clip {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 8px;
}

.slide-iframe {
  width: 1280px;
  height: 720px;
  transform-origin: left top;
  transform: v-bind('`scale(${scale})`');
  border: none;
  display: block;
}

.canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #9ca3af;
  height: 100%;
  el-icon { font-size: 48px; }
}

.speaker-notes {
  width: 100%;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 12px 16px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}
.notes-label { font-size: 12px; color: #9ca3af; margin-bottom: 6px; }
.notes-input { :deep(.el-textarea__inner) { font-size: 13px; resize: none; border: none; padding: 0; box-shadow: none; } }

// 右侧区域整体
.right-sidebar {
  display: flex;
  flex-shrink: 0;
  height: 100%;
}

// 常驻图标条
.icon-strip {
  width: 52px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12px;
  gap: 4px;
}

.strip-btn {
  width: 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 4px;
  border-radius: 8px;
  cursor: pointer;
  color: #6b7280;
  font-size: 10px;
  transition: all 0.15s;
  user-select: none;

  svg { flex-shrink: 0; }

  &:hover { background: #f3f4f6; color: #374151; }
  &.active { background: #ede9fe; color: #6366f1; }
}

// 滑出面板
.right-panel {
  width: 300px;
  background: #fff;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.slide-panel-enter-active,
.slide-panel-leave-active { transition: width 0.25s ease, opacity 0.2s ease; }
.slide-panel-enter-from,
.slide-panel-leave-to { width: 0; opacity: 0; }
.slide-panel-enter-to,
.slide-panel-leave-from { width: 300px; opacity: 1; }

.panel-header {
  height: 44px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}
.beta-badge {
  font-size: 10px;
  font-weight: 500;
  color: #6366f1;
  background: #ede9fe;
  padding: 1px 6px;
  border-radius: 10px;
}
.close-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: #9ca3af;
  &:hover { background: #f3f4f6; color: #374151; }
}

.page-tab {
  padding: 8px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #6366f1;
  border-bottom: 1px solid #f3f4f6;
  flex-shrink: 0;
}

// AI 面板
.ai-chat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
}

// preset 区
.preset-chat-box { display: flex; flex-direction: column; gap: 10px; }
.preset-actions-wrap { display: flex; flex-direction: column; gap: 6px; }
.preset-actions-label { font-size: 12px; color: #9ca3af; }
.preset-actions { display: flex; flex-direction: column; gap: 6px; }
.preset-option-btn {
  padding: 8px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
  &:hover { border-color: #a5b4fc; background: #f5f3ff; color: #6366f1; }
  &.disabled { opacity: 0.5; cursor: not-allowed; }
}

// 气泡样式（AI 和 用户共用基础）
.ai-bubble-wrap { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.ai-bubble-msg {
  background: #f3f4f6;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: #374151;
  line-height: 1.6;
  max-width: 230px;
  &.typing { color: #9ca3af; }
}
.user-bubble-wrap { display: flex; justify-content: flex-end; }
.user-bubble-msg {
  background: #6366f1;
  color: #fff;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 1.6;
  max-width: 230px;
}

// 对话历史
.chat-history-container { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
.chat-message-item { display: flex; flex-direction: column; gap: 6px; }


.ai-input-wrap {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px 12px;
  flex-shrink: 0;
}
.ai-chat-input {
  position: relative;
  border: 1.5px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  transition: border-color 0.2s;
  &:focus-within { border-color: #a5b4fc; }

  :deep(.el-textarea__inner) {
    font-size: 13px;
    resize: none;
    border: none;
    box-shadow: none;
    border-radius: 14px;
    padding: 12px 14px 44px;
    background: transparent;
    color: #374151;
    &::placeholder { color: #c0c4cc; }
  }
}
.send-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: #6366f1;
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px #6366f133;
  &:hover:not(:disabled) { background: #4f46e5; box-shadow: 0 4px 12px #6366f14d; }
  &:active:not(:disabled) { background: #4338ca; box-shadow: none; }
  &:disabled { background: #c7d2fe; cursor: default; box-shadow: none; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
}

// 素材面板 tab 栏
.mat-tab-bar {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  padding: 0 4px;
}
.mat-tab {
  flex: 1;
  text-align: center;
  font-size: 13px;
  padding: 10px 4px;
  cursor: pointer;
  color: #6b7280;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
  white-space: nowrap;
  &:hover { color: #6366f1; }
  &.active { color: #6366f1; border-bottom-color: #6366f1; font-weight: 500; }
}

.mat-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 12px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
}

// 图标条 dim 状态
.strip-btn.dim { opacity: 0.45; }

// 智能生图
.gen-input-wrap { margin-bottom: 8px; }
.gen-prompt-input :deep(.el-textarea__inner) { min-height: 150px !important; }
.gen-controls {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  align-items: center;
}
.gen-preview {
  border: 1px dashed #e5e7eb;
  border-radius: 8px;
  height: 180px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  overflow: hidden;
  margin-bottom: 12px;
}
.gen-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
  padding: 20px;
  text-align: center;
}
.gen-img-card {
  width: 100%;
  height: 100%;
  cursor: pointer;
  overflow: hidden;
  background: #f3f4f6;
  img { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.2s; }
  &:hover img { opacity: 0.85; }
}
.gen-history-section { margin-top: 4px; }
.gen-history-title { font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
.gen-history-empty { font-size: 12px; color: #d1d5db; text-align: center; padding: 12px 0; }
.gen-history-list { display: flex; flex-wrap: wrap; gap: 6px; }
.gen-history-tag {
  font-size: 12px;
  padding: 3px 10px;
  background: #f3f4f6;
  border-radius: 12px;
  color: #6b7280;
  cursor: pointer;
  &:hover { background: #ede9fe; color: #6366f1; }
}

// 图库搜图
.search-bar {
  padding: 10px 12px 6px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.orient-btns {
  display: flex;
  gap: 4px;
}
.orient-btn {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 10px;
  cursor: pointer;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  transition: all 0.15s;
  &:hover { color: #6366f1; border-color: #a5b4fc; }
  &.active { background: #ede9fe; color: #6366f1; border-color: #a5b4fc; }
}
.mat-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 2px; }
}

.image-grid {
  padding: 0 12px 6px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.img-card {
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  aspect-ratio: 4/3;
  background: #f3f4f6;
  position: relative;
  img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
  &:hover img { transform: scale(1.05); }
}
.img-loading { grid-column: 1/-1; text-align: center; color: #9ca3af; font-size: 12px; padding: 10px; }
.load-more-wrap {
  padding: 8px 12px 12px;
  text-align: center;
  flex-shrink: 0;
}
.load-more-btn {
  width: 100%;
  padding: 7px 0;
  border: none;
  border-radius: 6px;
  background: #6366f1;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 12px #6366f133;
  &:hover { background: #4f46e5; box-shadow: 0 6px 16px #6366f14d; }
  &:active { background: #4338ca; box-shadow: none; }
}
.no-more-text { font-size: 12px; color: #d1d5db; }
.search-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 12px;
  padding: 40px 12px;
}

// 我的素材
.mine-section { }
.mine-section-title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 10px;
}
.upload-zone {
  border: 1.5px dashed #d1d5db;
  border-radius: 8px;
  padding: 28px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: #6366f1; background: #f5f3ff; }
}
.upload-text { font-size: 13px; color: #374151; }
.upload-hint { font-size: 11px; color: #9ca3af; }
.local-imgs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.upload-add-btn {
  aspect-ratio: 4/3;
  border: 1.5px dashed #d1d5db;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  &:hover { border-color: #6366f1; background: #f5f3ff; }
}
.mine-empty { font-size: 12px; color: #d1d5db; text-align: center; padding: 16px 0; }

// ===== 统一 primary 按钮风格 =====
:deep(.el-button--primary) {
  cursor: pointer;
  transition: all 0.2s !important;
  background: #6366f1 !important;
  color: #fff !important;
  border: none !important;
  box-shadow: 0 4px 12px #6366f133 !important;

  &:hover:not(.is-disabled) {
    background: #4f46e5 !important;
    box-shadow: 0 6px 16px #6366f14d !important;
  }
  &:active:not(.is-disabled) {
    background: #4338ca !important;
    box-shadow: none !important;
  }
  &.is-disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none !important; }
  &.is-loading { opacity: 0.8; cursor: wait; }
}

// ===== 演示模式 =====
.present-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.present-stage {
  position: relative;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 60px rgba(0,0,0,0.8);
}

.present-iframe {
  width: 1280px;
  height: 720px;
  border: none;
  display: block;
}

.present-controls {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(8px);
  opacity: 0;
  transition: opacity 0.25s;
  pointer-events: none;
  &.visible { opacity: 1; pointer-events: auto; }
}

.present-nav-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: rgba(255,255,255,0.25); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
}

.present-progress {
  color: rgba(255,255,255,0.8);
  font-size: 14px;
  min-width: 60px;
  text-align: center;
}

.present-exit-btn {
  position: absolute;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.2);
  background: transparent;
  color: rgba(255,255,255,0.7);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  &:hover { background: rgba(255,255,255,0.1); color: #fff; }
}

.present-notes {
  position: fixed;
  bottom: 64px;
  left: 50%;
  transform: translateX(-50%);
  max-width: 800px;
  width: 90%;
  background: rgba(0,0,0,0.6);
  color: rgba(255,255,255,0.75);
  font-size: 13px;
  line-height: 1.6;
  padding: 10px 16px;
  border-radius: 8px;
  backdrop-filter: blur(6px);
  text-align: center;
  pointer-events: none;
}

.present-fade-enter-active,
.present-fade-leave-active { transition: opacity 0.2s ease; }
.present-fade-enter-from,
.present-fade-leave-to { opacity: 0; }
</style>

