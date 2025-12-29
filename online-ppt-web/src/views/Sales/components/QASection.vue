<template>
  <div class="qa-layout">
    <!-- 帮助最多的问题 -->
    <div class="qa-left card-block">
      <div class="section-head">
        <h3>帮助最多的问题</h3>
      </div>
      <ul class="qa-list-rich qa-list-left">
        <li 
          v-for="q in leftQuestions" 
          :key="q.id" 
          :data-qa-id="q.id" 
          :class="{active: expandedLeftQaId === q.id}"
        >
          <div class="qa-title-row" @click="toggleLeftQa(q.id)">
            <div class="qa-title">
              <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">
                {{ q.category }}
              </span>
              {{ q.title }}
            </div>
            <div class="qa-expand-icon">
              <i class="ri-arrow-down-s-line" v-if="expandedLeftQaId !== q.id"></i>
              <i class="ri-arrow-up-s-line" v-else></i>
            </div>
          </div>
          <div class="qa-answer" v-if="expandedLeftQaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedLeftQaId === q.id">
            <div class="qa-meta-top">
              <span class="qa-meta-time">{{ q.date }}</span>
              <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
            </div>
            <div class="qa-meta-feedback">
              <span class="qa-feedback-text">这个对你有帮助吗？</span>
              <div class="qa-feedback-buttons">
                <button 
                  class="qa-feedback-btn qa-like-btn" 
                  @click.stop="handleLike(q.id)" 
                  :class="{ active: q.userLiked }"
                >
                  <i class="ri-thumb-up-line"></i>
                  <span>{{ q.likes }}</span>
                </button>
                <button 
                  class="qa-feedback-btn qa-dislike-btn" 
                  @click.stop="handleDislike(q.id)" 
                  :class="{ active: q.userDisliked }"
                >
                  <i class="ri-thumb-down-line"></i>
                  <span>{{ q.dislikes }}</span>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 阅读量最高的问题 -->
    <div class="qa-right-list card-block">
      <div class="section-head">
        <h3>阅读量最高的问题</h3>
      </div>
      <ul class="qa-list-rich qa-list-right">
        <li 
          v-for="q in rightQuestions" 
          :key="q.id" 
          :data-qa-id="q.id" 
          :class="{active: expandedRightListQaId === q.id}"
        >
          <div class="qa-title-row" @click="toggleRightListQa(q.id)">
            <div class="qa-title">
              <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">
                {{ q.category }}
              </span>
              {{ q.title }}
            </div>
            <div class="qa-expand-icon">
              <i class="ri-arrow-down-s-line" v-if="expandedRightListQaId !== q.id"></i>
              <i class="ri-arrow-up-s-line" v-else></i>
            </div>
          </div>
          <div class="qa-answer" v-if="expandedRightListQaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedRightListQaId === q.id">
            <div class="qa-meta-top">
              <span class="qa-meta-time">{{ q.date }}</span>
              <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
            </div>
            <div class="qa-meta-feedback">
              <span class="qa-feedback-text">这个对你有帮助吗？</span>
              <div class="qa-feedback-buttons">
                <button 
                  class="qa-feedback-btn qa-like-btn" 
                  @click.stop="handleLike(q.id)" 
                  :class="{ active: q.userLiked }"
                >
                  <i class="ri-thumb-up-line"></i>
                  <span>{{ q.likes }}</span>
                </button>
                <button 
                  class="qa-feedback-btn qa-dislike-btn" 
                  @click.stop="handleDislike(q.id)" 
                  :class="{ active: q.userDisliked }"
                >
                  <i class="ri-thumb-down-line"></i>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- 最新问题 -->
    <div class="qa-latest card-block">
      <div class="section-head">
        <h3>最新</h3>
      </div>
      <ul class="qa-list-rich qa-list-latest">
        <li 
          v-for="q in latestQuestions" 
          :key="q.id" 
          :data-qa-id="q.id" 
          :class="{active: expandedLatestQaId === q.id}"
        >
          <div class="qa-title-row" @click="toggleLatestQa(q.id)">
            <div class="qa-title">
              <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">
                {{ q.category }}
              </span>
              {{ q.title }}
            </div>
            <div class="qa-expand-icon">
              <i class="ri-arrow-down-s-line" v-if="expandedLatestQaId !== q.id"></i>
              <i class="ri-arrow-up-s-line" v-else></i>
            </div>
          </div>
          <div class="qa-answer" v-if="expandedLatestQaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedLatestQaId === q.id">
            <div class="qa-meta-top">
              <span class="qa-meta-time">{{ q.date }}</span>
              <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
            </div>
            <div class="qa-meta-feedback">
              <span class="qa-feedback-text">这个对你有帮助吗？</span>
              <div class="qa-feedback-buttons">
                <button 
                  class="qa-feedback-btn qa-like-btn" 
                  @click.stop="handleLike(q.id)" 
                  :class="{ active: q.userLiked }"
                >
                  <i class="ri-thumb-up-line"></i>
                  <span>{{ q.likes }}</span>
                </button>
                <button 
                  class="qa-feedback-btn qa-dislike-btn" 
                  @click.stop="handleDislike(q.id)" 
                  :class="{ active: q.userDisliked }"
                >
                  <i class="ri-thumb-down-line"></i>
                  <span>{{ q.dislikes }}</span>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </div>

    <!-- Top 10 热门问题 -->
    <aside class="qa-right card-block">
      <div class="section-head">
        <h3>Top 10 热门问题</h3>
        <el-link>更多</el-link>
      </div>
      <ul class="qa-simple">
        <li 
          v-for="(q, index) in top10Questions" 
          :key="q.id" 
          :class="{ 'top-rank': index < 3, 'active': expandedTop10QaId === q.id }"
        >
          <div class="qa-rank-item" @click="toggleTop10Qa(q.id)">
            <span class="rank-number" :class="{ 'top-three': index < 3 }">{{ index + 1 }}</span>
            <span class="rank-title">{{ q.title }}</span>
            <span class="rank-value">{{ formatViews(q.views) }}</span>
          </div>
          <div class="qa-answer" v-if="expandedTop10QaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedTop10QaId === q.id">
            <div class="qa-meta-top">
              <span class="qa-meta-time">{{ q.date }}</span>
              <span class="qa-meta-words">{{ getAnswerWordCount(q.answer) }}次阅读</span>
            </div>
            <div class="qa-meta-feedback">
              <span class="qa-feedback-text">这个对你有帮助吗？</span>
              <div class="qa-feedback-buttons">
                <button 
                  class="qa-feedback-btn qa-like-btn" 
                  @click.stop="handleLike(q.id)" 
                  :class="{ active: q.userLiked }"
                >
                  <i class="ri-thumb-up-line"></i>
                  <span>{{ q.likes }}</span>
                </button>
                <button 
                  class="qa-feedback-btn qa-dislike-btn" 
                  @click.stop="handleDislike(q.id)" 
                  :class="{ active: q.userDisliked }"
                >
                  <i class="ri-thumb-down-line"></i>
                  <span>{{ q.dislikes }}</span>
                </button>
              </div>
            </div>
          </div>
        </li>
      </ul>
    </aside>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  questions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['like', 'dislike'])

// 展开状态
const expandedLeftQaId = ref(null)
const expandedRightListQaId = ref(null)
const expandedLatestQaId = ref(null)
const expandedTop10QaId = ref(null)

// 将问题列表分成左右两部分
const leftQuestions = computed(() => {
  const mid = Math.ceil(props.questions.length / 2)
  return props.questions.slice(0, mid)
})

const rightQuestions = computed(() => {
  const mid = Math.ceil(props.questions.length / 2)
  return props.questions.slice(mid)
})

// 最新问题（按日期排序，最新的在前）
const latestQuestions = computed(() => {
  return [...props.questions]
    .sort((a, b) => {
      const dateA = new Date(a.date.replace(/\//g, '-'))
      const dateB = new Date(b.date.replace(/\//g, '-'))
      return dateB - dateA
    })
    .slice(0, 6)
})

// Top10 热门问题列表（按浏览量排序）
const top10Questions = computed(() => {
  return [...props.questions]
    .sort((a, b) => b.views - a.views)
    .slice(0, 10)
})

// 切换展开/收起
const toggleLeftQa = (qaId) => {
  expandedLeftQaId.value = expandedLeftQaId.value === qaId ? null : qaId
}

const toggleRightListQa = (qaId) => {
  expandedRightListQaId.value = expandedRightListQaId.value === qaId ? null : qaId
}

const toggleLatestQa = (qaId) => {
  expandedLatestQaId.value = expandedLatestQaId.value === qaId ? null : qaId
}

const toggleTop10Qa = (qaId) => {
  expandedTop10QaId.value = expandedTop10QaId.value === qaId ? null : qaId
}

// 格式化浏览量
const formatViews = (views) => {
  if (views >= 10000) {
    return (views / 10000).toFixed(1) + '万'
  }
  return views.toString()
}

// 计算答案字数
const getAnswerWordCount = (answer) => {
  if (!answer) return 0
  const chineseChars = (answer.match(/[\u4e00-\u9fa5]/g) || []).length
  const englishWords = answer.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(w => w.length > 0).length
  return chineseChars + englishWords
}

// 处理点赞
const handleLike = (qaId) => {
  emit('like', qaId)
}

// 处理点踩
const handleDislike = (qaId) => {
  emit('dislike', qaId)
}
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>

