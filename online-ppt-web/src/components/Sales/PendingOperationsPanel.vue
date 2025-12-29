<template>
  <div class="pending-operations-panel" v-if="pendingList.length > 0">
    <div class="pending-header">
      <div class="pending-title">
        <i class="ri-list-check"></i>
        待操作列表 ({{ pendingList.length }})
      </div>
      <div class="pending-actions">
        <el-button size="small" type="primary" @click="handleBatchAnalyze">
          <i class="ri-magic-stick-line"></i>
          批量AI分析
        </el-button>
        <el-button size="small" type="success" @click="handleBatchDownload">
          <i class="ri-download-line"></i>
          批量下载
        </el-button>
        <el-button size="small" @click="handleClear">
          <i class="ri-delete-bin-line"></i>
          清空
        </el-button>
      </div>
    </div>
    <div class="pending-list">
      <div 
        v-for="item in pendingList" 
        :key="`${item.id}-${item.type}`"
        class="pending-item"
      >
        <div class="pending-item-thumb">
          <img :src="item.thumbnail || 'https://picsum.photos/seed/default/80/60'" :alt="item.title" />
          <span class="pending-item-tag" :class="item.tag === '公共版' ? 'tag-public' : 'tag-practical'">
            {{ item.tag }}
          </span>
        </div>
        <div class="pending-item-info">
          <div class="pending-item-title">{{ item.title }}</div>
          <div class="pending-item-meta">{{ item.date }}</div>
        </div>
        <el-button 
          size="small" 
          text 
          type="danger" 
          @click="handleRemove(item)"
          class="pending-item-remove"
        >
          <i class="ri-close-line"></i>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'

const pendingStore = usePendingOperationsStore()

const pendingList = computed(() => pendingStore.pendingList)

const handleRemove = (item) => {
  pendingStore.removeFromPending(item.id, item.type)
  ElMessage.success('已移除')
}

const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空待操作列表吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    pendingStore.clearPending()
    ElMessage.success('已清空')
  } catch {
    // 用户取消
  }
}

const handleBatchAnalyze = () => {
  if (pendingList.value.length === 0) {
    ElMessage.warning('待操作列表为空')
    return
  }
  pendingStore.batchAnalyze()
  ElMessage.success(`开始批量AI分析 ${pendingList.value.length} 个项目`)
}

const handleBatchDownload = () => {
  if (pendingList.value.length === 0) {
    ElMessage.warning('待操作列表为空')
    return
  }
  pendingStore.batchDownload()
  ElMessage.success(`开始批量下载 ${pendingList.value.length} 个项目`)
}
</script>

<style scoped>
.pending-operations-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 360px;
  max-height: 500px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.pending-header {
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fafafa;
}
.pending-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.pending-title i {
  font-size: 18px;
  color: #2563eb;
}
.pending-actions {
  display: flex;
  gap: 8px;
}
.pending-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  max-height: 400px;
}
.pending-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 8px;
  align-items: center;
  transition: background 0.2s;
}
.pending-item:hover {
  background: #f3f4f6;
}
.pending-item:last-child {
  margin-bottom: 0;
}
.pending-item-thumb {
  position: relative;
  width: 80px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
}
.pending-item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pending-item-tag {
  position: absolute;
  top: 4px;
  left: 4px;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  color: #fff;
  font-weight: 600;
}
.pending-item-tag.tag-public {
  background: #FF6A00;
}
.pending-item-tag.tag-practical {
  background: #006DF9;
}
.pending-item-info {
  flex: 1;
  min-width: 0;
}
.pending-item-title {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pending-item-meta {
  font-size: 12px;
  color: #6b7280;
}
.pending-item-remove {
  flex-shrink: 0;
  padding: 4px;
}
</style>

