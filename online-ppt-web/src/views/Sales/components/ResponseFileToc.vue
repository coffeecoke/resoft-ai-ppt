<template>
  <aside class="response-file-toc">
    <div class="toc-header">
      <h3 class="sidebar-title">文档目录</h3>
      <div class="mode-switch-container">
        <div 
          class="mode-item" 
          :class="{ active: wordTocMode === 'single' }" 
          @click="handleModeChange('single')"
        >
          <i class="ri-check-line mode-icon"></i>
          <span class="mode-text">单选模式</span>
        </div>
        <div 
          class="mode-item" 
          :class="{ active: wordTocMode === 'multi' }" 
          @click="handleModeChange('multi')"
        >
          <i class="ri-grid-fill mode-icon"></i>
          <span class="mode-text">多选模式</span>
        </div>
      </div>
    </div>
    <div class="toc-content">
      <div 
        v-for="section in responseTocSections" 
        :key="section.title"
        class="category-group"
      >
        <div 
          class="category-title"
          :class="{ 'clickable': wordTocMode === 'multi' }"
          @click="wordTocMode === 'multi' ? handleSectionClick(section) : null"
        >
          <i :class="getSectionIcon(section.title)" class="category-icon"></i>
          <span>{{ removeNumberPrefix(section.title) }}</span>
        </div>
        <div class="category-children">
          <div 
            v-for="item in section.items"
            :key="item"
            class="category-child-item"
            :class="{
              active: responseIndex(item) === activeSlide || selectedSlides.includes(responseIndex(item))
            }"
            @click="handleItemClick(item)"
          >
            <span class="child-name">{{ item }}</span>
            <i 
              v-if="responseIndex(item) === activeSlide || selectedSlides.includes(responseIndex(item))" 
              class="ri-check-line check-icon"
            ></i>
          </div>
        </div>
      </div>
    </div>
    <div class="toc-footer ppt-thumbs-footer">
      <el-button type="primary" plain style="width: 100%; margin-bottom: 0;" @click="handleAnalyzeSelected">
        <el-icon><MagicStick /></el-icon> 选中-AI分析
      </el-button>
      <el-button style="width: 100%; margin-bottom: 0;" @click="handleDownloadSelected">
        <el-icon><Download /></el-icon> 选中-下载
      </el-button>
      <el-button style="width: 100%;" @click="handleAddToPending">
        <i class="ri-list-check-3"></i> 选中-待操作
      </el-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MagicStick, Download } from '@element-plus/icons-vue'

interface ResponseTocSection {
  title: string
  items: string[]
}

const props = defineProps({
  responseTocSections: {
    type: Array as () => ResponseTocSection[],
    required: true
  },
  activeSlide: {
    type: Number,
    default: 0
  },
  selectedSlides: {
    type: Array as () => number[],
    default: () => []
  },
  wordTocMode: {
    type: String as () => 'single' | 'multi',
    default: 'single'
  }
})

const emit = defineEmits(['update:wordTocMode', 'item-click', 'analyze-selected', 'download-selected', 'add-to-pending', 'section-select-all'])

// 响应文件目录扁平化
const responseTocFlat = computed(() => {
  return props.responseTocSections.flatMap(section =>
    section.items.map(title => ({ section: section.title, title }))
  )
})

const responseIndex = (title: string) => {
  return responseTocFlat.value.findIndex(t => t.title === title)
}

const handleModeChange = (mode: 'single' | 'multi') => {
  emit('update:wordTocMode', mode)
}

const handleItemClick = (title: string) => {
  emit('item-click', title)
}

// 获取一级目录的图标
const getSectionIcon = (title: string) => {
  // 去掉编号前缀
  const cleanTitle = removeNumberPrefix(title)
  
  if (cleanTitle.includes('商务')) {
    return 'ri-briefcase-line'
  } else if (cleanTitle.includes('技术')) {
    return 'ri-code-s-slash-line'
  } else if (cleanTitle.includes('投标')) {
    return 'ri-file-list-3-line'
  }
  return 'ri-folder-line'
}

// 去掉标题中的编号前缀（如"一、"、"二、"等）
const removeNumberPrefix = (title: string) => {
  return title.replace(/^[一二三四五六七八九十]+[、.]\s*/, '')
}

// 处理一级目录点击（多选模式下全选/取消全选该目录下的所有项）
const handleSectionClick = (section: ResponseTocSection) => {
  if (props.wordTocMode !== 'multi') return
  
  // 获取该目录下所有项的索引
  const sectionItemIndices = section.items.map(item => responseIndex(item)).filter(idx => idx >= 0)
  
  if (sectionItemIndices.length === 0) return
  
  // 检查是否全部已选中
  const allSelected = sectionItemIndices.every(idx => props.selectedSlides.includes(idx))
  
  if (allSelected) {
    // 如果全部已选中，则取消选中该目录下的所有项
    emit('section-select-all', sectionItemIndices, false)
  } else {
    // 如果未全部选中，则选中该目录下的所有项
    emit('section-select-all', sectionItemIndices, true)
  }
}

// 处理选中-AI分析
const handleAnalyzeSelected = () => {
  emit('analyze-selected')
}

// 处理选中-下载
const handleDownloadSelected = () => {
  emit('download-selected')
}

// 处理选中-待操作
const handleAddToPending = () => {
  emit('add-to-pending')
}
</script>

<style scoped lang="scss">
.response-file-toc {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toc-header {
  flex-shrink: 0;
  padding: 10px 16px 12px 16px;
}

.sidebar-title {
  font-size: 0.8rem;
  line-height: 1.75rem;
  color: #1e293b;
  font-weight: 600;
  margin: 0 0 10px 0;
  padding: 0;
  border-bottom: none;
}

.mode-switch-container {
  display: flex;
  gap: 8px;
  margin-bottom: 0;
  padding: 0;
}

.toc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 16px 16px 16px;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  background: transparent;
  transition: all 0.2s;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &.active {
    background: #fff;
    color: #006DF9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  
  .mode-icon {
    font-size: 14px;
  }
  
  .mode-text {
    font-size: 12px;
  }
}

.category-group {
  margin-bottom: 5px;
  background: rgba(252, 252, 253, 1);
  border-radius: 10px;
  border: 1px solid #FCFCFD;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.25rem;
  font-weight: 500;
  color: #3b82f6;
  border-radius: 4px;
  background-color: rgb(241 245 249 / 0.5);
  
  &.clickable {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background-color: rgb(241 245 249 / 0.8);
    }
  }
}

.category-icon {
  font-size: 16px;
  color: #334155;
}

.category-children {
  padding: 10px;
  margin-top: 0;
}

.category-child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid rgb(252, 252, 253);
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  
  &:hover {
    background: #fff;
    border: 1px solid rgb(226 232 240 / 1);
  }
  
  &.active {
    background: rgba(0, 109, 249, 1);
    color: #fff;
    border: 1px solid #006DF9;
    
    .check-icon {
      color: #fff;
    }
    
    .child-name {
      color: #fff;
    }
  }
}

.child-name {
  font-size: 12px;
  flex: 1;
  color: #94a3b8;
}

.check-icon {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fff;
  border-radius: 50%;
  font-size: 8px;
  color: #006DF9;
  flex-shrink: 0;
}

.toc-footer {
  flex-shrink: 0;
  padding: 16px;
  padding-top: 12px;
  border-top: 1px solid #e5e7eb;
}
</style>

