<template>
  <div v-if="elementInfo" class="style-toolbar floating" :style="toolbarStyle">
    <!-- AI编辑 -->
    <span class="tb-btn ai-btn" @click="$emit('aiEdit')">
      <span class="ai-icon">AI</span>
      <span>AI编辑</span>
    </span>

    <div class="toolbar-sep" />

    <!-- 字号 -->
    <el-select v-model="fontSize" size="small" class="size-select" @change="applyStyle('font-size', fontSize)">
      <el-option v-for="s in fontSizes" :key="s" :label="parseInt(s)" :value="s" />
    </el-select>

    <div class="toolbar-sep" />

    <!-- 加粗/斜体/下划线/删除线 下拉 -->
    <el-popover :width="130" trigger="click" :teleported="true" placement="bottom">
      <template #reference>
        <span class="tb-btn" title="文字样式"><b>B</b></span>
      </template>
      <div class="dd-list">
        <div class="dd-item" :class="{ active: isBold }" @click="toggleBold"><b>B</b> <span>加粗</span></div>
        <div class="dd-item" :class="{ active: isItalic }" @click="toggleItalic"><i style="font-style:italic">I</i> <span>斜体</span></div>
        <div class="dd-item" :class="{ active: isUnderline }" @click="toggleUnderline"><u>U</u> <span>下划线</span></div>
        <div class="dd-item" :class="{ active: isStrike }" @click="toggleStrike"><s>S</s> <span>删除线</span></div>
      </div>
    </el-popover>

    <!-- 对齐方式 下拉 -->
    <el-popover :width="100" trigger="click" :teleported="true" placement="bottom">
      <template #reference>
        <span class="tb-btn align-trigger" title="对齐方式">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
            <rect x="2" y="3" width="14" height="2" rx="1"/>
            <rect x="2" y="7" width="10" height="2" rx="1"/>
            <rect x="2" y="11" width="14" height="2" rx="1"/>
            <rect x="2" y="15" width="8" height="2" rx="1"/>
          </svg>
        </span>
      </template>
      <div class="dd-list">
        <div class="dd-item" :class="{ active: textAlign === 'left' }" @click="applyStyle('text-align','left')">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="14" height="2" rx="1"/><rect x="2" y="7" width="10" height="2" rx="1"/><rect x="2" y="11" width="14" height="2" rx="1"/></svg>
        </div>
        <div class="dd-item" :class="{ active: textAlign === 'center' }" @click="applyStyle('text-align','center')">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="14" height="2" rx="1"/><rect x="4" y="7" width="10" height="2" rx="1"/><rect x="2" y="11" width="14" height="2" rx="1"/></svg>
        </div>
        <div class="dd-item" :class="{ active: textAlign === 'right' }" @click="applyStyle('text-align','right')">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor"><rect x="2" y="3" width="14" height="2" rx="1"/><rect x="6" y="7" width="10" height="2" rx="1"/><rect x="2" y="11" width="14" height="2" rx="1"/></svg>
        </div>
      </div>
    </el-popover>

    <div class="toolbar-sep" />

    <!-- 文字颜色 + 背景颜色 合并面板 -->
    <el-popover :width="220" trigger="click" :teleported="true" placement="bottom">
      <template #reference>
        <span class="tb-btn color-trigger" title="文字颜色/背景颜色">
          <b>A</b>
          <span class="color-line" :style="{ backgroundColor: fontColor }" />
        </span>
      </template>
      <div class="color-panel">
        <!-- 文字颜色 -->
        <div class="color-section-label">文字颜色</div>
        <div class="color-a-grid">
          <div
            v-for="c in fontColors" :key="c"
            class="color-a-swatch"
            :class="{ active: fontColor === c }"
            :style="{ borderColor: fontColor === c ? c : 'transparent', background: c === '#ffffff' ? '#f3f4f6' : 'transparent' }"
            @click="fontColor = c; applyStyle('color', c)"
          >
            <span :style="{ color: c, textShadow: c === '#ffffff' ? '0 0 1px #aaa' : 'none' }">A</span>
          </div>
        </div>
        <el-input
          v-model="fontColor" size="small" style="margin-top:6px"
          placeholder="#000000"
          @change="applyStyle('color', fontColor)"
        />

        <div class="color-divider" />

        <!-- 背景颜色 -->
        <div class="color-section-label">背景颜色</div>
        <div class="color-bg-grid">
          <div
            v-for="c in bgColors" :key="c"
            class="color-bg-swatch"
            :class="{ active: bgColor === c }"
            :style="{ backgroundColor: c === 'transparent' ? '#fff' : c }"
            @click="bgColor = c; applyStyle('background-color', c)"
          >
            <svg v-if="c === 'transparent'" viewBox="0 0 20 20" width="12" height="12"><line x1="2" y1="18" x2="18" y2="2" stroke="#ef4444" stroke-width="2"/></svg>
          </div>
        </div>
        <el-input
          v-model="bgColor" size="small" style="margin-top:6px"
          placeholder="transparent"
          @change="applyStyle('background-color', bgColor)"
        />
      </div>
    </el-popover>

    <div class="toolbar-sep" />

    <!-- 字间距 + 行高（滑块面板） -->
    <el-popover :width="180" trigger="click" :teleported="true" placement="bottom">
      <template #reference>
        <span class="tb-btn" title="字间距/行高">
          <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
            <rect x="2" y="2" width="14" height="2" rx="1"/>
            <rect x="2" y="14" width="14" height="2" rx="1"/>
            <path d="M9 5v8M6.5 7l2.5-2.5L11.5 7M6.5 11l2.5 2.5 2.5-2.5" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
      </template>
      <div class="spacing-panel">
        <div class="spacing-row">
          <span class="spacing-label">字间距</span>
          <span class="spacing-val">{{ letterSpacingVal }}px</span>
        </div>
        <el-slider
          v-model="letterSpacingVal"
          :min="0" :max="10" :step="0.1"
          size="small"
          @change="applyStyle('letter-spacing', letterSpacingVal + 'px')"
        />
        <div class="spacing-row" style="margin-top:12px">
          <span class="spacing-label">行高</span>
          <span class="spacing-val">{{ lineHeightVal }}</span>
        </div>
        <el-slider
          v-model="lineHeightVal"
          :min="1" :max="3" :step="0.1"
          size="small"
          @change="applyStyle('line-height', String(lineHeightVal))"
        />
      </div>
    </el-popover>

    <!-- 删除 -->
    <span class="tb-btn delete-btn" title="删除元素" @click="$emit('deleteElement')">
      <svg viewBox="0 0 18 18" width="15" height="15" fill="currentColor">
        <path d="M6 2h6a1 1 0 011 1v1H5V3a1 1 0 011-1zM3 5h12l-1 11H4L3 5zm4 2v7m4-7v7" stroke="currentColor" stroke-width="1.3" fill="none" stroke-linecap="round"/>
      </svg>
    </span>

    <!-- 移动 -->
    <span class="tb-btn" title="移动元素（直接拖拽元素即可）" @click="toggleMove">
      <svg viewBox="0 0 18 18" width="16" height="16" fill="currentColor">
        <path d="M9 1l2.5 3H10v3h3V5.5L16 9l-3 2.5V10h-3v3h1.5L9 16l-2.5-3H8V10H5v1.5L2 9l3-2.5V8h3V5H6.5L9 1z"/>
      </svg>
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SelectedElementInfo } from '../composables/useSlideEditor'

const props = defineProps<{
  elementInfo: SelectedElementInfo | null
  toolbarStyle?: Record<string, any>
}>()

const emit = defineEmits<{
  styleChange: [prop: string, value: string]
  deleteElement: []
  aiEdit: []
  toggleMove: []
}>()

const fontSizes = [
  '10px','11px','12px','13px','14px','15px','16px',
  '18px','20px','22px','24px','28px','32px','36px',
  '40px','48px','56px','64px','72px',
]

const fontColors = [
  '#000000','#ffffff','#6b7280','#9ca3af',
  '#ef4444','#f97316','#eab308','#22c55e',
  '#3b82f6','#6366f1','#a855f7','#ec4899',
]

const bgColors = [
  'transparent','#ffffff','#fef3c7','#fee2e2',
  '#fce7f3','#ede9fe','#dbeafe','#dcfce7',
  '#374151','#1e293b','#dc2626','#2563eb',
]

const fontSize = ref('16px')
const fontColor = ref('#000000')
const bgColor = ref('transparent')
const isBold = ref(false)
const isItalic = ref(false)
const isUnderline = ref(false)
const isStrike = ref(false)
const textAlign = ref('left')
const letterSpacingVal = ref(0)
const lineHeightVal = ref(1.5)

watch(() => props.elementInfo, (info) => {
  if (!info) return
  const s = info.styles
  fontSize.value = s.fontSize || '16px'
  fontColor.value = s.color || '#000000'
  bgColor.value = s.backgroundColor || 'transparent'
  isBold.value = parseInt(s.fontWeight || '400') >= 700 || s.fontWeight === 'bold'
  isItalic.value = s.fontStyle === 'italic' || s.fontStyle === 'oblique'
  isUnderline.value = (s.textDecoration || '').includes('underline')
  isStrike.value = (s.textDecoration || '').includes('line-through')
  textAlign.value = s.textAlign || 'left'
  letterSpacingVal.value = parseFloat(s.letterSpacing || '0') || 0
  // lineHeight 计算样式是 px 值（如 "24px"），除以字号得比例
  const lhPx = parseFloat(s.lineHeight || '0')
  const fsPx = parseFloat(s.fontSize || '16')
  lineHeightVal.value = lhPx > 0 && fsPx > 0
    ? Math.round(lhPx / fsPx * 10) / 10
    : 1.5
})

function applyStyle(prop: string, value: string) {
  if (prop === 'font-size') fontSize.value = value
  if (prop === 'color') fontColor.value = value
  if (prop === 'background-color') bgColor.value = value
  if (prop === 'text-align') textAlign.value = value
  if (prop === 'letter-spacing') letterSpacingVal.value = parseFloat(value) || 0
  if (prop === 'line-height') lineHeightVal.value = parseFloat(value) || 1.5
  emit('styleChange', prop, value)
}

function toggleBold() {
  isBold.value = !isBold.value
  emit('styleChange', 'font-weight', isBold.value ? '700' : '400')
}

function toggleItalic() {
  isItalic.value = !isItalic.value
  emit('styleChange', 'font-style', isItalic.value ? 'italic' : 'normal')
}

function toggleUnderline() {
  isUnderline.value = !isUnderline.value
  emit('styleChange', 'text-decoration', buildTextDecoration())
}

function toggleStrike() {
  isStrike.value = !isStrike.value
  emit('styleChange', 'text-decoration', buildTextDecoration())
}

function buildTextDecoration() {
  const parts: string[] = []
  if (isUnderline.value) parts.push('underline')
  if (isStrike.value) parts.push('line-through')
  return parts.length > 0 ? parts.join(' ') : 'none'
}

function toggleMove() {
  emit('toggleMove')
}
</script>

<style scoped lang="scss">
.style-toolbar {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.12);
  border: 1px solid #e5e7eb;
  white-space: nowrap;

  &.floating {
    position: absolute;
    &::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 20px;
      width: 10px;
      height: 10px;
      background: #fff;
      border-right: 1px solid #e5e7eb;
      border-bottom: 1px solid #e5e7eb;
      transform: rotate(45deg);
    }
  }
}

.toolbar-sep {
  width: 1px;
  height: 18px;
  background: #e5e7eb;
  margin: 0 2px;
}

.tb-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: 4px;
  cursor: pointer;
  color: #374151;
  font-size: 13px;
  padding: 0 4px;
  transition: background 0.15s;

  &:hover { background: #f3f4f6; }
  &.active { background: #ede9fe; color: #6366f1; }
  b { font-size: 14px; line-height: 1; }
}

.delete-btn {
  color: #9ca3af;
  &:hover { background: #fee2e2; color: #ef4444; }
}

.ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 0 8px;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  border-radius: 4px;
  height: 26px;

  .ai-icon {
    background: #6366f1;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 4px;
    border-radius: 3px;
    line-height: 1.4;
  }
  &:hover { background: #f3f4f6; }
}

.size-select { width: 65px; }

.align-trigger svg { color: #374151; }

.bg-swatch {
  display: block;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid #d1d5db;
}

.color-trigger {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 4px;
}

.color-line {
  display: block;
  width: 16px;
  height: 3px;
  border-radius: 1px;
  margin-top: 1px;
}

.color-panel {
  padding: 2px 0;
}

.color-section-label {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 7px;
  font-weight: 500;
}

.color-divider {
  height: 1px;
  background: #f3f4f6;
  margin: 10px 0;
}

// 文字颜色：显示 A 字母
.color-a-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.color-a-swatch {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  transition: all 0.15s;

  span {
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  &:hover { background: #f3f4f6 !important; }
  &.active { border-color: currentColor; }
}

// 背景颜色：实色方块
.color-bg-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 4px;
}

.color-bg-swatch {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  cursor: pointer;
  border: 2px solid #e5e7eb;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;

  &:hover { transform: scale(1.1); }
  &.active { border-color: #374151; box-shadow: 0 0 0 1px #374151; }
}

.dd-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-size: 13px;
  color: #374151;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s;

  span { color: #6b7280; font-size: 12px; }
  &:hover { background: #f3f4f6; }
  &.active { color: #6366f1; background: #ede9fe; }
  &.active span { color: #6366f1; }
}

.spacing-panel {
  padding: 4px 2px;

  .spacing-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .spacing-label {
    font-size: 12px;
    color: #111;
    font-weight: 500;
  }

  .spacing-val {
    font-size: 12px;
    color: #111;
    font-weight: 600;
    min-width: 36px;
    text-align: right;
  }

  :deep(.el-slider) {
    margin: 0;

    .el-slider__runway {
      background: #e5e7eb;
      height: 3px;
    }

    .el-slider__bar {
      background: #111;
      height: 3px;
    }

    .el-slider__button-wrapper {
      top: -16px;
    }

    .el-slider__button {
      width: 14px;
      height: 14px;
      background: #fff;
      border: 2px solid #111;
      box-shadow: none;
    }
  }
}
</style>
