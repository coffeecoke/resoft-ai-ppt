<template>
  <el-drawer
    v-model="drawerVisible"
    title="待操作列表"
    :size="480"
    direction="rtl"
    :before-close="handleClose"
  >
    <template #header>
      <div class="drawer-header">
        <div class="drawer-title">
          <i class="ri-list-check-3"></i>
          待操作列表
          <span class="drawer-count">({{ pendingStore.pendingList.length }})</span>
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <div v-if="pendingStore.pendingList.length === 0" class="empty-state">
        <i class="ri-inbox-line"></i>
        <p>待操作列表为空</p>
      </div>
      <div v-else>
        <div class="batch-actions">
          <el-button type="primary" @click="handleBatchAnalyze" :disabled="!hasSelectedItems">
            <i class="ri-magic-stick-line"></i>
            批量AI分析
          </el-button>
          <el-button type="success" @click="handleBatchDownload" :disabled="!hasSelectedItems">
            <i class="ri-download-line"></i>
            合并下载
          </el-button>
          <el-button @click="handleClear">
            <i class="ri-delete-bin-line"></i>
            清空
          </el-button>
        </div>

        <div class="pending-list">
          <div
            v-for="item in pendingStore.pendingList"
            :key="`${item.id}-${item.type}`"
            class="pending-item"
          >
            <div class="pending-item-checkbox">
              <el-checkbox
                :model-value="item.selected"
                @update:model-value="(val) => item.selected = val"
              />
            </div>
            <div class="pending-item-thumb">
              <img :src="item.thumbnail || 'https://picsum.photos/seed/default/100/75'" :alt="item.title" />
              <span class="pending-item-tag" :class="item.tag === '公共版' ? 'tag-public' : 'tag-practical'">
                {{ item.tag }}
              </span>
            </div>
            <div class="pending-item-info">
              <div class="pending-item-title">{{ item.title }}</div>
              <div class="pending-item-meta">{{ item.date }}</div>
            </div>
            <el-button size="small" text type="danger" @click="handleRemove(item)" class="pending-item-remove">
              <i class="ri-close-line"></i>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible'])

const pendingStore = usePendingOperationsStore()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

const handleClose = () => { drawerVisible.value = false }

const hasSelectedItems = computed(() =>
  pendingStore.pendingList.some(i => i.selected !== false)
)

const handleRemove = (item) => {
  pendingStore.removeFromPending(item.id, item.type)
  ElMessage.success('已移除')
}

const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空待操作列表吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    pendingStore.clearPending()
    ElMessage.success('已清空')
  } catch { /* 用户取消 */ }
}

const handleBatchAnalyze = () => {
  const selected = pendingStore.pendingList.filter(i => i.selected !== false)
  if (!selected.length) { ElMessage.warning('请至少选择一个项目'); return }
  pendingStore.batchAnalyze(selected)
  ElMessage.success(`开始批量AI分析 ${selected.length} 个项目`)
}

const handleBatchDownload = async () => {
  const items = pendingStore.pendingList.filter(i => i.selected !== false)
  if (!items.length) { ElMessage.warning('没有可下载的内容'); return }
  pendingStore.batchDownload(items)
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.drawer-title i { font-size: 20px; color: #2563eb; }
.drawer-count { font-size: 14px; font-weight: 400; color: #6b7280; }

.drawer-content { padding: 0; }

.empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
.empty-state i { font-size: 48px; margin-bottom: 16px; display: block; }
.empty-state p { font-size: 14px; margin: 0; }

.batch-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
}
.batch-actions .el-button { flex: 1; }

.pending-list {
  padding: 12px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.pending-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  align-items: center;
  transition: all 0.2s;
}
.pending-item:hover { border-color: #2563eb; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1); }
.pending-item-checkbox { flex-shrink: 0; }
.pending-item-thumb { position: relative; width: 100px; height: 75px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #f3f4f6; }
.pending-item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.pending-item-tag { position: absolute; top: 4px; left: 4px; font-size: 10px; padding: 2px 6px; border-radius: 4px; color: #fff; font-weight: 600; }
.pending-item-tag.tag-public { background: #FF6A00; }
.pending-item-tag.tag-practical { background: #006DF9; }
.pending-item-info { flex: 1; min-width: 0; }
.pending-item-title { font-size: 14px; font-weight: 500; color: #1f2937; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pending-item-meta { font-size: 12px; color: #6b7280; }
.pending-item-remove { flex-shrink: 0; padding: 4px; }
</style>
