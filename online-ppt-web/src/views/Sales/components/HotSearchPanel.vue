<template>
  <div class="hot-search-panel">
    <div class="hot-search-header">
      <h3 class="hot-search-title">热搜榜</h3>
    </div>
    
    <div class="hot-search-list">
      <div 
        v-for="(item, index) in hotSearchList" 
        :key="index"
        class="hot-search-item"
        @click="handleSearch(item.keyword)"
      >
        <div class="hot-search-rank" :class="getRankClass(index + 1)">
          {{ index + 1 }}
        </div>
        <div class="hot-search-keyword">{{ item.keyword }}</div>
        <div class="hot-search-count">{{ item.count }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

// 热搜榜数据
interface HotSearchItem {
  keyword: string
  count: number
}

const hotSearchList = ref<HotSearchItem[]>([
  { keyword: '一表通', count: 1256 },
  { keyword: '1104', count: 892 },
  { keyword: '资质与案例', count: 756 },
  { keyword: '反洗钱', count: 634 },
  { keyword: '受益所有人', count: 523 },
  { keyword: '数据质量', count: 445 },
  { keyword: '监管报表', count: 387 },
  { keyword: '产品架构', count: 312 },
  { keyword: '性能与效率', count: 289 },
  { keyword: '公司规模与背景', count: 256 }
])

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