<template>
  <section class="tabs">
    <div class="tabs-row">
      <el-segmented 
        :model-value="activeTab" 
        :options="tabOptions" 
        @update:model-value="handleTabChange"
      />
      <div class="filters-inline">
        <button class="new-ppt-btn" type="button" @click="handleCreatePpt">
          <i class="ri-file-ppt-2-line"></i>
          新建
        </button>
        <el-button @click="handleToggleFilter" type="primary" plain style="display: none;">
          <el-icon><Filter /></el-icon> 高级筛选
        </el-button>
        <el-button @click="handleFilter" type="primary" plain>
          <el-icon><Filter /></el-icon> 筛选
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Filter } from '@element-plus/icons-vue'

const props = defineProps({
  activeTab: {
    type: String,
    default: 'ppt'
  },
  showAdvancedFilter: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:activeTab', 'update:showAdvancedFilter', 'create-ppt', 'filter'])

// Tab选项
const tabOptions = [
  { label: '产品介绍PPT', value: 'ppt' },
  // { label: 'PPT', value: 'ppt-new' },
  { label: '售前交流', value: 'video' },
{ label: '客户问题', value: 'concerned' },
  { label: '招标文件', value: 'tender' },
  { label: '响应文件', value: 'response' }
]

const handleTabChange = (value: string) => {
  emit('update:activeTab', value)
}

const handleToggleFilter = () => {
  emit('update:showAdvancedFilter', !props.showAdvancedFilter)
}

const handleCreatePpt = () => {
  emit('create-ppt')
}

const handleFilter = () => {
  emit('filter')
}
</script>

<style scoped lang="scss">
.filters-inline {
  :deep(.el-button.el-button--primary.is-plain) {
    margin: 0;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-left: 1rem;
    padding-right: 1rem;
    background-color: rgb(248 250 252 / var(--tw-bg-opacity, 1));
    border-color: rgb(226 232 240 / var(--tw-border-opacity, 1));
    border-radius: 8px;
    color: #475569;
  }
}
</style>

