<template>
  <div class="hot-search-panel">
    <div class="hot-search-header">
      <h3 class="hot-search-title">热搜榜</h3>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="hot-search-loading">
      <div v-for="i in 5" :key="i" class="skeleton-item">
        <div class="skeleton-rank"></div>
        <div class="skeleton-text"></div>
        <div class="skeleton-count"></div>
      </div>
    </div>

    <!-- 列表 -->
    <div v-else class="hot-search-list">
      <div
        v-for="(item, index) in hotSearchList"
        :key="item.id"
        class="hot-search-item"
        @click="handleSearch(item.question)"
      >
        <div class="hot-search-rank" :class="getRankClass(index + 1)">
          {{ index + 1 }}
        </div>
        <div class="hot-search-keyword">{{ item.question }}</div>
        <div class="hot-search-count">{{ item.likes }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getHotConcerns, type HotConcernItem } from '@/services/concernsApi'

const router = useRouter()

// 热搜榜数据
const hotSearchList = ref<HotConcernItem[]>([])
const loading = ref(true)

// 加载热搜数据
const loadHotConcerns = async () => {
  loading.value = true
  try {
    const res = await getHotConcerns()
    if (res.success && res.data) {
      hotSearchList.value = res.data
    }
  } catch (error) {
    console.error('加载热搜榜失败:', error)
  } finally {
    loading.value = false
  }
}

// 获取排名样式类
const getRankClass = (rank: number): string => {
  if (rank === 1) return 'rank-first'
  if (rank === 2) return 'rank-second'
  if (rank === 3) return 'rank-third'
  return 'rank-normal'
}

// 处理搜索
const handleSearch = (keyword: string) => {
  router.push({
    path: '/sales/question-search',
    query: { q: keyword }
  })
}

onMounted(() => {
  loadHotConcerns()
})
</script>

<style scoped lang="scss">
.hot-search-panel {
  width: 100%;
  background: #fff;
  border: 1px solid #e6e8eb;
  border-radius: 8px;
  padding: 16px;
}

.hot-search-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e6e8eb;
}

.hot-search-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.hot-search-loading {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.skeleton-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.skeleton-rank {
  width: 24px;
  height: 24px;
  background: #f0f0f0;
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.skeleton-text {
  flex: 1;
  height: 16px;
  background: #f0f0f0;
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

.skeleton-count {
  width: 30px;
  height: 14px;
  background: #f0f0f0;
  border-radius: 4px;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.hot-search-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.hot-search-item {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  margin: 0;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    .hot-search-keyword {
      color: #2563eb;
    }
  }
}

.hot-search-rank {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;

  &.rank-first {
    color: #fe2d46;
  }

  &.rank-second {
    color: #ff6000;
  }

  &.rank-third {
    color: #faa90e;
  }

  &.rank-normal {
    color: #faa90e;
  }
}

.hot-search-keyword {
  flex: 1;
  font-size: 14px;
  color: #1f2937;
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color 0.2s;
}

.hot-search-count {
  font-size: 12px;
  color: #9ca3af;
  flex-shrink: 0;
}
</style>