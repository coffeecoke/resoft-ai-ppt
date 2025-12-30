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
          新建PPT
        </button>
        <el-button @click="handleToggleFilter" type="primary" plain>
          <el-icon><Filter /></el-icon> 高级筛选
        </el-button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue'
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

const emit = defineEmits(['update:activeTab', 'update:showAdvancedFilter', 'create-ppt'])

// Tab选项
const tabOptions = [
  { label: '产品介绍PPT', value: 'ppt' },
  { label: '交流会议', value: 'video' },
  { label: '客户关心问题', value: 'qa' },
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
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

