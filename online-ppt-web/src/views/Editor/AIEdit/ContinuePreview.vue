<template>
  <div class="continue-preview">
    <!-- 预览卡片 -->
    <div class="preview-card" v-if="slide">
      <div class="card-header">
        <span class="type-badge">{{ getTypeName(slide.type) }}</span>
        <span class="title">{{ slide.data?.title || '新页面' }}</span>
      </div>
      
      <div class="card-body">
        <!-- 内容预览 -->
        <div class="items-preview" v-if="slide.data?.items?.length">
          <div class="item" v-for="(item, index) in slide.data.items.slice(0, 4)" :key="index">
            <span class="item-num">{{ index + 1 }}</span>
            <div class="item-content">
              <div class="item-title">{{ item.title || item }}</div>
              <div class="item-text" v-if="item.text">{{ item.text }}</div>
            </div>
          </div>
          <div class="more" v-if="slide.data.items.length > 4">
            +{{ slide.data.items.length - 4 }} 更多...
          </div>
        </div>
        
        <!-- 文本内容 -->
        <div class="text-preview" v-else-if="slide.data?.text">
          {{ slide.data.text }}
        </div>
        
        <!-- 引用内容 -->
        <div class="quote-preview" v-else-if="slide.data?.quote">
          <div class="quote-text">"{{ slide.data.quote }}"</div>
          <div class="quote-author" v-if="slide.data.author">
            —— {{ slide.data.author }}
            <span v-if="slide.data.title">{{ slide.data.title }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="actions">
      <button class="cancel-btn" @click="handleCancel">取消</button>
      <button class="confirm-btn" @click="handleConfirm">插入此页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface SlideData {
  type: string
  data?: {
    title?: string
    text?: string
    items?: Array<{ title?: string; text?: string } | string>
    quote?: string
    author?: string
  }
}

const props = defineProps<{
  slide?: SlideData
}>()

const emit = defineEmits<{
  (e: 'confirm', slide: SlideData): void
  (e: 'cancel'): void
}>()

const getTypeName = (type: string) => {
  const names: Record<string, string> = {
    content: '内容页',
    cover: '封面页',
    contents: '目录页',
    transition: '过渡页',
    end: '结束页',
    text_image: '图文页',
    comparison: '对比页',
    timeline: '时间线',
    statistics: '数据页',
    quote: '引用页',
  }
  return names[type] || type
}

const handleConfirm = () => {
  if (props.slide) {
    emit('confirm', props.slide)
  }
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style lang="scss" scoped>
.continue-preview {
  // 主题变量
  --text-primary: #333;
  --text-secondary: #666;
  --text-tertiary: #999;
  --bg-primary: #fff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #f0f0f0;
  --border-color: #e0e0e0;
  --border-dash: #eee;
  
  @media (prefers-color-scheme: dark) {
    --text-primary: #e0e0e0;
    --text-secondary: #a0a0a0;
    --text-tertiary: #808080;
    --bg-primary: #2a2a2a;
    --bg-secondary: #252525;
    --bg-tertiary: #333;
    --border-color: #444;
    --border-dash: #3a3a3a;
  }
  
  margin-top: 8px;
}

.preview-card {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
  background: var(--bg-primary);
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    
    .type-badge {
      padding: 2px 8px;
      background: #667eea;
      color: #fff;
      font-size: 11px;
      border-radius: 4px;
    }
    
    .title {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }
  }
  
  .card-body {
    padding: 12px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .items-preview {
    .item {
      display: flex;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px dashed var(--border-dash);
      
      &:last-child {
        border-bottom: none;
      }
      
      .item-num {
        width: 20px;
        height: 20px;
        background: #667eea;
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        flex-shrink: 0;
      }
      
      .item-content {
        flex: 1;
        
        .item-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        
        .item-text {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: 4px;
          line-height: 1.4;
        }
      }
    }
    
    .more {
      text-align: center;
      padding: 8px;
      color: var(--text-tertiary);
      font-size: 12px;
    }
  }
  
  .text-preview {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.6;
  }
  
  .quote-preview {
    .quote-text {
      font-size: 14px;
      font-style: italic;
      color: var(--text-primary);
      line-height: 1.6;
    }
    
    .quote-author {
      margin-top: 12px;
      font-size: 12px;
      color: var(--text-secondary);
      text-align: right;
    }
  }
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  
  button {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  
  .cancel-btn {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    
    &:hover {
      opacity: 0.8;
    }
  }
  
  .confirm-btn {
    background: #52c41a;
    color: #fff;
    
    &:hover {
      background: #45a617;
    }
  }
}
</style>

