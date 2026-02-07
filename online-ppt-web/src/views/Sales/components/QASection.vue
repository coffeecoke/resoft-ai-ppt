<template>
  <div class="qa-layout">
    <!-- 最新的问题 -->
    <div class="qa-section qa-section-latest card-block">
      <div class="section-head">
        <h3>最新的问题</h3>
      </div>
      <ul class="qa-list-rich">
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

    <!-- 最有帮助的问题 -->
    <div class="qa-section qa-section-helpful card-block">
      <div class="section-head">
        <h3>最有帮助的问题</h3>
      </div>
      <ul class="qa-list-rich">
        <li 
          v-for="q in mostHelpfulQuestions" 
          :key="q.id" 
          :data-qa-id="q.id" 
          :class="{active: expandedHelpfulQaId === q.id}"
        >
          <div class="qa-title-row" @click="toggleHelpfulQa(q.id)">
            <div class="qa-title">
              <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">
                {{ q.category }}
              </span>
              {{ q.title }}
            </div>
            <div class="qa-expand-icon">
              <i class="ri-arrow-down-s-line" v-if="expandedHelpfulQaId !== q.id"></i>
              <i class="ri-arrow-up-s-line" v-else></i>
            </div>
          </div>
          <div class="qa-answer" v-if="expandedHelpfulQaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedHelpfulQaId === q.id">
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

    <!-- 阅读量最多的问题 -->
    <div class="qa-section qa-section-views card-block">
      <div class="section-head">
        <h3>阅读量最多的问题</h3>
      </div>
      <ul class="qa-list-rich">
        <li 
          v-for="q in mostViewedQuestions" 
          :key="q.id" 
          :data-qa-id="q.id" 
          :class="{active: expandedViewsQaId === q.id}"
        >
          <div class="qa-title-row" @click="toggleViewsQa(q.id)">
            <div class="qa-title">
              <span class="qa-category-tag" :style="{ backgroundColor: q.categoryColor }">
                {{ q.category }}
              </span>
              {{ q.title }}
            </div>
            <div class="qa-expand-icon">
              <i class="ri-arrow-down-s-line" v-if="expandedViewsQaId !== q.id"></i>
              <i class="ri-arrow-up-s-line" v-else></i>
            </div>
          </div>
          <div class="qa-answer" v-if="expandedViewsQaId === q.id">答：{{ q.answer }}</div>
          <div class="qa-meta" v-if="expandedViewsQaId === q.id">
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
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  questions: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['like', 'dislike'])

// 展开状态
const expandedLatestQaId = ref(null)
const expandedHelpfulQaId = ref(null)
const expandedViewsQaId = ref(null)

// 最新的问题（按日期排序，最新的在前）
const latestQuestions = computed(() => {
  return [...props.questions]
    .sort((a, b) => {
      const dateA = new Date(a.date.replace(/\//g, '-'))
      const dateB = new Date(b.date.replace(/\//g, '-'))
      return dateB - dateA
    })
    .slice(0, 6)
})

// 最有帮助的问题（按点赞数排序）
const mostHelpfulQuestions = computed(() => {
  return [...props.questions]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 6)
})

// 阅读量最多的问题（按浏览量排序）
const mostViewedQuestions = computed(() => {
  return [...props.questions]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
})

// 切换展开/收起
const toggleLatestQa = (qaId) => {
  expandedLatestQaId.value = expandedLatestQaId.value === qaId ? null : qaId
}

const toggleHelpfulQa = (qaId) => {
  expandedHelpfulQaId.value = expandedHelpfulQaId.value === qaId ? null : qaId
}

const toggleViewsQa = (qaId) => {
  expandedViewsQaId.value = expandedViewsQaId.value === qaId ? null : qaId
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

// 默认展开三个模块的第一条问题
watch(() => props.questions, (newQuestions) => {
  if (newQuestions && newQuestions.length > 0) {
    // 最新的问题 - 第一条
    if (!expandedLatestQaId.value && latestQuestions.value.length > 0) {
      expandedLatestQaId.value = latestQuestions.value[0].id
    }
    // 最有帮助的问题 - 第一条
    if (!expandedHelpfulQaId.value && mostHelpfulQuestions.value.length > 0) {
      expandedHelpfulQaId.value = mostHelpfulQuestions.value[0].id
    }
    // 阅读量最多的问题 - 第一条
    if (!expandedViewsQaId.value && mostViewedQuestions.value.length > 0) {
      expandedViewsQaId.value = mostViewedQuestions.value[0].id
    }
  }
}, { immediate: true })

onMounted(() => {
  if (props.questions && props.questions.length > 0) {
    // 最新的问题 - 第一条
    if (!expandedLatestQaId.value && latestQuestions.value.length > 0) {
      expandedLatestQaId.value = latestQuestions.value[0].id
    }
    // 最有帮助的问题 - 第一条
    if (!expandedHelpfulQaId.value && mostHelpfulQuestions.value.length > 0) {
      expandedHelpfulQaId.value = mostHelpfulQuestions.value[0].id
    }
    // 阅读量最多的问题 - 第一条
    if (!expandedViewsQaId.value && mostViewedQuestions.value.length > 0) {
      expandedViewsQaId.value = mostViewedQuestions.value[0].id
    }
  }
})
</script>

<style scoped>
/* 样式继承自 sales.scss */
</style>


