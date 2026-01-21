<template>
  <Transition name="slide-fade">
    <div v-if="visible" class="mini-progress-container" @click="handleExpand">
      <div class="mini-progress-content">
        <span class="mini-progress-text">
          缩略图生成中 {{ task?.progress.completed || 0 }}/{{ task?.progress.total || 0 }}
        </span>
        <el-progress
          :percentage="percentage"
          :width="32"
          :stroke-width="3"
          type="circle"
          :show-text="false"
          :status="progressStatus"
        />
      </div>
      <div v-if="task?.progress.failed > 0" class="mini-failed-badge">
        {{ task.progress.failed }}
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  visible: boolean
  task: any
}

interface Emits {
  (e: 'expand'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

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

function handleExpand() {
  emit('expand')
}
</script>

<style scoped>
.mini-progress-container {
  position: fixed;
  bottom: 24px;
  left: 24px;
  z-index: 2000;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.mini-progress-container:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  transform: translateY(-2px);
}

.mini-progress-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.mini-progress-text {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
}

.mini-failed-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #f56c6c;
  color: white;
  border-radius: 10px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

/* 动画 */
.slide-fade-enter-active {
  transition: all 0.3s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from {
  transform: translateY(100%);
  opacity: 0;
}

.slide-fade-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
