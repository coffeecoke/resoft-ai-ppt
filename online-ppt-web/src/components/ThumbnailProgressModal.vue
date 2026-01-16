<template>
  <el-dialog
    v-model="dialogVisible"
    title="生成缩略图"
    width="500px"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    :show-close="false"
  >
    <div class="progress-content">
      <div class="progress-text">
        正在生成缩略图 {{ task?.progress.completed || 0 }}/{{ task?.progress.total || 0 }}
      </div>

      <el-progress
        :percentage="percentage"
        :status="progressStatus"
        :stroke-width="20"
      />

      <div v-if="task?.progress.failed > 0" class="failed-info">
        <el-icon><WarningFilled /></el-icon>
        失败: {{ task.progress.failed }} 页(将显示默认占位图)
      </div>

      <div v-if="task?.status === 'completed'" class="success-info">
        <el-icon><SuccessFilled /></el-icon>
        全部生成完成!
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="handleMinimize" :disabled="task?.status === 'completed'">
          最小化到后台
        </el-button>
        <el-button
          v-if="task?.status === 'completed'"
          type="primary"
          @click="handleClose"
        >
          完成
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { WarningFilled, SuccessFilled } from '@element-plus/icons-vue'

interface Props {
  visible: boolean
  task: any
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'minimize'): void
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

const percentage = computed(() => {
  if (!props.task) return 0
  const { total, completed } = props.task.progress
  return total > 0 ? Math.floor((completed / total) * 100) : 0
})

const progressStatus = computed(() => {
  if (props.task?.status === 'completed') return 'success'
  if (props.task?.progress.failed > 0) return 'warning'
  return undefined
})

function handleMinimize() {
  emit('minimize')
}

function handleClose() {
  emit('close')
}

// 监听完成状态,自动更新进度条颜色
watch(() => props.task?.status, (newStatus) => {
  if (newStatus === 'completed') {
    console.log('[ThumbnailProgressModal] 任务完成')
  }
})
</script>

<style scoped>
.progress-content {
  padding: 20px 0;
  text-align: center;
}

.progress-text {
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.failed-info {
  margin-top: 20px;
  padding: 10px;
  background: #fdf6ec;
  border: 1px solid #f5dab1;
  border-radius: 4px;
  font-size: 14px;
  color: #e6a23c;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.success-info {
  margin-top: 20px;
  padding: 10px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 14px;
  color: #409eff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.dialog-footer {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>
