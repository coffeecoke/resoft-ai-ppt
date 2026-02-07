<template>
  <div v-if="visible" class="search-overlay" @click.self="handleClose">
    <div class="search-panel">
      <div class="search-header">
        <h2 class="search-title">搜索</h2>
        <button class="search-close-btn" @click="handleClose">
          <i class="ri-close-line"></i>
        </button>
      </div>
      <div class="search-content">
        <div class="search-input-wrapper">
          <!-- 左侧下拉选择器 -->
          <div class="search-type-selector" @click="toggleTypeDropdown">
            <i class="ri-box-3-line type-icon"></i>
            <span class="type-text">{{ searchType }}</span>
            <i class="ri-arrow-down-s-line dropdown-icon"></i>
            <div v-if="showTypeDropdown" class="type-dropdown" @click.stop>
              <div 
                v-for="option in typeOptions" 
                :key="option.value"
                class="type-option"
                :class="{ active: searchType === option.value }"
                @click="selectType(option.value)"
              >
                <i :class="option.icon" :style="{ color: option.iconColor }"></i>
                <span>{{ option.label }}</span>
              </div>
            </div>
          </div>
          
          <!-- 中间输入框 -->
          <div class="search-input-container">
            <i class="ri-search-line search-icon"></i>
            <input 
              v-model="keyword" 
              type="text"
              class="search-input-field"
              placeholder="搜索相关的产品信息..."
              @keyup.enter="handleSearchSubmit"
            />
          </div>
          
          <!-- 右侧搜索按钮 -->
          <button class="search-submit-btn" @click="handleSearchSubmit">
            <span>搜索</span>
            <i class="ri-arrow-right-line"></i>
          </button>
        </div>
        <div class="search-tags">
          <div class="tags-title">热门搜索</div>
          <div class="tags-list">
            <span 
              v-for="tag in hotTags" 
              :key="tag.text"
              class="tag-item"
              :class="{ 'tag-hot': tag.hot }"
              @click="handleTagClick(tag.text)"
            >
              <i v-if="tag.hot" class="ri-fire-line"></i>
              <i v-else-if="tag.recommended" class="ri-trophy-line"></i>
              #{{ tag.text }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:visible', 'close'])

const router = useRouter()
const keyword = ref('')
const searchType = ref('产品')
const showTypeDropdown = ref(false)

// 搜索类型选项
const typeOptions = [
  { label: '产品', value: '产品', icon: 'ri-box-3-line', iconColor: '#2563eb' },
  { label: '客户', value: '客户', icon: 'ri-group-line', iconColor: '#9ca3af' },
  { label: '问题', value: '问题', icon: 'ri-question-line', iconColor: '#9ca3af' }
]

// 热门搜索标签
const hotTags = ref([
  { text: '一表通', hot: false },
  { text: '1104', hot: false },
  { text: '反洗钱', hot: false },
  { text: '受益所有人', hot: false },
  { text: '金数', hot: false },
  { text: '数据质量', hot: false },
  { text: '监管报表', hot: false },
  { text: '北京银行', hot: false },
  { text: '招商银行', hot: false },
  { text: '建设银行', hot: false },
  { text: '工商银行', hot: false },
  { text: '产品方案', hot: false },
  { text: '技术架构', hot: false },
  { text: '实施案例', hot: false },
  { text: '系统集成', hot: false }
])

const toggleTypeDropdown = () => {
  showTypeDropdown.value = !showTypeDropdown.value
}

const selectType = (type) => {
  searchType.value = type
  showTypeDropdown.value = false
}

const handleClose = () => {
  showTypeDropdown.value = false
  emit('update:visible', false)
  emit('close')
}

const handleSearchSubmit = () => {
  const searchKeyword = keyword.value.trim()
  if (!searchKeyword) return
  
  // 根据搜索类型进行搜索
  if (searchType.value === '产品') {
    router.push({ path: '/sales/product-search', query: { q: searchKeyword } })
  } else if (searchType.value === '客户') {
    router.push({ path: '/sales/customer-search', query: { q: searchKeyword } })
  } else if (searchType.value === '问题') {
    router.push({ path: '/sales/question-search', query: { q: searchKeyword } })
  } else {
    router.push({ path: '/sales/home', query: { nav: 'recommend', search: searchKeyword, type: searchType.value } })
  }
  handleClose()
}

const handleTagClick = (tagText) => {
  keyword.value = tagText
  handleSearchSubmit()
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  const target = event.target
  if (!target.closest('.search-type-selector')) {
    showTypeDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped lang="scss">
/* 搜索弹窗 */
.search-overlay {
  position: fixed;
  top: 68px;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 0;
}

.search-panel {
  width: 80%;
  max-width: 1420px;
  height: 500px;
  background: #fff;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.search-panel :deep(.el-input-group__prepend) {
  background: #fff !important;
}

.search-panel :deep(.el-input-group__prepend) .el-select {
  background: #fff !important;
}

.search-panel :deep(.el-input-group__prepend) .el-select__wrapper {
  background: #fff !important;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #e5e7eb;
}

.search-title {
  font-size: 20px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.search-close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #6b7280;
  transition: all 0.2s;
  font-size: 20px;
}

.search-close-btn:hover {
  background: #f3f4f6;
  color: #374151;
}

.search-content {
  flex: 1;
  padding: 40px 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
  height: 48px;
  background: #fff;
  border-radius: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  // overflow: hidden;
}

// 左侧下拉选择器
.search-type-selector {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 48px;
  flex-shrink: 0;
  cursor: pointer;
  border-right: 1px solid #e5e7eb;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #f9fafb;
  }
  
  .type-icon {
    font-size: 18px;
    color: #2563eb;
    flex-shrink: 0;
  }
  
  .type-text {
    font-size: 14px;
    color: #1f2937;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .dropdown-icon {
    font-size: 16px;
    color: #9ca3af;
    flex-shrink: 0;
  }
  
  .type-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 8px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 140px;
    z-index: 1000;
    overflow: hidden;
    padding: 8px 0;
    
    .type-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: #f9fafb;
      }
      
      &.active {
        background-color: #eff6ff;
      }
      
      i {
        font-size: 18px;
        flex-shrink: 0;
        width: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      span {
        font-size: 14px;
        color: #374151;
        font-weight: 400;
      }
      
      &.active span {
        color: #2563eb;
        font-weight: 500;
      }
      
      &.active i {
        color: #2563eb !important;
      }
    }
  }
}

// 中间输入框
.search-input-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  height: 48px;
  
  .search-icon {
    font-size: 18px;
    color: #9ca3af;
    flex-shrink: 0;
  }
  
  .search-input-field {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 14px;
    color: #1f2937;
    height: 100%;
    
    &::placeholder {
      color: #9ca3af;
    }
  }
}

// 右侧搜索按钮

.search-submit-btn {
  height: 48px;
  padding: 0 24px;
  border: none;
  border-radius: 0 24px 24px 0;
  font-size: 14px;
  font-weight: 500;
  background: #2563eb;
  color: #fff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background: #1d4ed8;
  }
  
  &:active {
    background: #1e40af;
  }
  
  span {
    white-space: nowrap;
  }
  
  i {
    font-size: 16px;
    flex-shrink: 0;
  }
}

.search-tags {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 800px;
  margin: 0 auto;
  width: 100%;
}

.tags-title {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tag-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px;
  margin-right: 15px;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-item:hover {
  background: transparent;
  border: none;
}

.tag-item i {
  font-size: 16px;
  color: #f97316;
}

.tag-hot {
  background: transparent;
  border: none;
  color: #be123c;
}

.tag-hot:hover {
  background: transparent;
  border: none;
}
</style>