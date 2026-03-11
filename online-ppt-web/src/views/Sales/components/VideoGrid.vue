<template>
  <div class="ppt-grid">
    <div
      v-for="item in items"
      :key="item.id"
      class="ppt-card"
      @click="handleVideoClick(item)"
      style="cursor: pointer;"
    >
      <!-- 视频卡片：显示缩略图 -->
      <div v-if="item.isVideo" class="thumb is-video">
        <img :src="item.thumbnail" :alt="item.title" />
        <span
          v-if="item.tag"
          class="badge"
          :class="item.tag === '公共版' ? 'badge-public' : 'badge-practical'"
        >
          {{ item.tag }}
        </span>
        <div class="play-icon">
          <el-icon><VideoPlay /></el-icon>
        </div>
        <span v-if="item.duration" class="video-duration">{{ item.duration }}</span>
      </div>

      <!-- 音频卡片：默认底图 + 半透明黑遮罩 + 蓝色音波 + 耳机图标 -->
      <div v-else class="thumb is-audio">
        <div class="audio-bg">
          <div class="audio-bg-overlay"></div>
          <!-- 音波纹（系统蓝） -->
          <div class="audio-wave-bars">
            <span class="bar" style="--delay: 0s; --h: 10%;"></span>
            <span class="bar" style="--delay: 0.15s; --h: 18%;"></span>
            <span class="bar" style="--delay: 0.3s; --h: 25%;"></span>
            <span class="bar" style="--delay: 0.45s; --h: 35%;"></span>
            <span class="bar" style="--delay: 0.6s; --h: 42%;"></span>
            <span class="bar" style="--delay: 0.75s; --h: 50%;"></span>
            <span class="bar" style="--delay: 0.6s; --h: 42%;"></span>
            <span class="bar" style="--delay: 0.45s; --h: 35%;"></span>
            <span class="bar" style="--delay: 0.3s; --h: 25%;"></span>
            <span class="bar" style="--delay: 0.15s; --h: 18%;"></span>
            <span class="bar" style="--delay: 0s; --h: 10%;"></span>
            <span class="bar" style="--delay: 0.15s; --h: 18%;"></span>
            <span class="bar" style="--delay: 0.3s; --h: 25%;"></span>
            <span class="bar" style="--delay: 0.45s; --h: 35%;"></span>
            <span class="bar" style="--delay: 0.6s; --h: 42%;"></span>
            <span class="bar" style="--delay: 0.75s; --h: 50%;"></span>
            <span class="bar" style="--delay: 0.6s; --h: 42%;"></span>
            <span class="bar" style="--delay: 0.45s; --h: 35%;"></span>
            <span class="bar" style="--delay: 0.3s; --h: 25%;"></span>
            <span class="bar" style="--delay: 0.15s; --h: 18%;"></span>
            <span class="bar" style="--delay: 0s; --h: 10%;"></span>
          </div>
          <!-- 耳机图标 -->
          <div class="audio-icon">
            <i class="ri-headphone-line"></i>
          </div>
        </div>
        <span v-if="item.duration" class="video-duration">{{ item.duration }}</span>
      </div>

      <div class="meta">
        <div class="title">{{ item.title }}</div>
        <div class="sub">
          <template v-if="item.product && item.industry && item.date && item.author">
            {{ item.product }}<span class="divider"> | </span>{{ item.industry }}<span class="divider"> | </span>{{ item.date }}<span class="divider"> | </span>{{ item.author }}
          </template>
          <template v-else-if="item.product && item.industry && item.date">
            {{ item.product }}<span class="divider"> | </span>{{ item.industry }}<span class="divider"> | </span>{{ item.date }}
          </template>
          <template v-else>
            {{ item.date }}
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue'
import { VideoPlay } from '@element-plus/icons-vue'

const props = defineProps({
  items: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['video-click'])

const handleVideoClick = (item) => {
  emit('video-click', item)
}
</script>

<style scoped>
/* 音频卡片样式 */
.thumb.is-audio {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.audio-bg {
  width: 100%;
  height: 100%;
  background-image: url('/audio-bg-default.png');
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.audio-bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  pointer-events: none;
}

.audio-wave-bars {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 20px;
  z-index: 1;
}

.audio-wave-bars .bar {
  width: 4px;
  height: var(--h, 50%);
  background: #2563eb;
  border-radius: 2px;
  animation: bar-bounce 1.5s ease-in-out infinite;
  animation-delay: var(--delay, 0s);
}

@keyframes bar-bounce {
  0%, 100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

.audio-icon {
  width: 56px;
  height: 56px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.audio-icon i {
  font-size: 28px;
  color: #2563eb;
}

.thumb.is-audio .video-duration {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>

