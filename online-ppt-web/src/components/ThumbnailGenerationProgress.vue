<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="thumbnail-progress-overlay">
        <div class="progress-content">
          <div class="progress-icon">📸</div>
          <div class="progress-title">正在生成预览图</div>
          <div class="progress-count">
            {{ progress?.current || 0 }} / {{ progress?.total || 0 }}
          </div>
          <div class="progress-bar-container">
            <div 
              class="progress-bar" 
              :style="{ width: progressPercentage + '%' }"
            ></div>
          </div>
          <div class="progress-percentage">{{ progressPercentage }}%</div>
          <div v-if="progress?.status === 'error'" class="error-message">
            生成过程中出现错误
          </div>
          <div v-if="showResult" class="result-message" :class="resultClass">
            {{ resultMessage }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import type { ThumbnailGenerationProgress } from '@/hooks/useThumbnailGenerator'

interface Props {
  progress: ThumbnailGenerationProgress | null
  visible: boolean
  autoClose?: boolean
  autoCloseDelay?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoClose: true,
  autoCloseDelay: 2000
})

const emit = defineEmits<{
  close: []
}>()

const showResult = ref(false)
const resultMessage = ref('')
const resultClass = ref('')

const progressPercentage = computed(() => {
  if (!props.progress || props.progress.total === 0) return 0
  return Math.round((props.progress.current / props.progress.total) * 100)
})

// 监听进度状态变化
watch(
  () => props.progress?.status,
  (status) => {
    if (status === 'completed') {
      showResult.value = true
      resultMessage.value = `✓ 成功生成 ${props.progress?.total || 0} 张预览图`
      resultClass.value = 'success'
      
      // 自动关闭
      if (props.autoClose) {
        setTimeout(() => {
          emit('close')
        }, props.autoCloseDelay)
      }
    } else if (status === 'error') {
      showResult.value = true
      resultMessage.value = '✕ 生成过程中出现错误'
      resultClass.value = 'error'
    } else {
      showResult.value = false
    }
  }
)
</script>

<style lang="scss" scoped>
.thumbnail-progress-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.progress-content {
  text-align: center;
  color: #fff;
}

.progress-icon {
  font-size: 64px;
  margin-bottom: 24px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.8;
  }
}

.progress-title {
  font-size: 24px;
  font-weight: 500;
  margin-bottom: 16px;
  color: #fff;
}

.progress-count {
  font-size: 48px;
  font-weight: 600;
  margin-bottom: 24px;
  color: #fff;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  letter-spacing: 2px;
}

.progress-bar-container {
  width: 400px;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
  margin: 0 auto 16px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #5b9bd5 0%, #4a8bc2 50%, #5b9bd5 100%);
  background-size: 200% 100%;
  border-radius: 3px;
  transition: width 0.3s ease;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.progress-percentage {
  font-size: 18px;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 16px;
}

.error-message {
  margin-top: 16px;
  padding: 12px 24px;
  background: rgba(255, 77, 79, 0.2);
  border: 1px solid rgba(255, 77, 79, 0.4);
  border-radius: 4px;
  color: #ff4d4f;
  font-size: 14px;
  display: inline-block;
}

.result-message {
  margin-top: 16px;
  font-size: 18px;
  font-weight: 500;
  
  &.success {
    color: #52c41a;
  }
  
  &.error {
    color: #ff4d4f;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

