<template>
  <div class="template-page-picker">
    <div v-if="loading" class="picker-loading">正在加载模版列表...</div>

    <div v-else-if="templates.length === 0" class="picker-empty">
      暂无已发布的模版，请先在模版管理中发布模版
    </div>

    <div v-else class="template-list">
      <div
        v-for="tpl in templates"
        :key="tpl.id"
        class="template-item"
      >
        <div
          class="template-header"
          :class="{ expanded: expandedId === tpl.id }"
          @click="toggleTemplate(tpl.id)"
        >
          <span class="tpl-name">{{ tpl.name }}</span>
          <span class="expand-arrow">{{ expandedId === tpl.id ? '▲' : '▼' }}</span>
        </div>

        <div v-if="expandedId === tpl.id" class="slide-grid">
          <div v-if="loadingMap[tpl.id]" class="slides-loading">加载中...</div>
          <template v-else-if="getFilteredSlides(tpl.id).length > 0">
            <div
              v-for="(slide, index) in getFilteredSlides(tpl.id)"
              :key="slide.id || index"
              class="slide-thumb-item"
              @click="selectSlide(slide, tpl.name)"
            >
              <div class="thumb-wrap">
                <ThumbnailSlide
                  class="thumbnail"
                  :slide="slide"
                  :size="100"
                />
              </div>
              <div class="thumb-label">
                <span class="page-num">{{ index + 1 }}</span>
                <span class="type-badge">{{ getTypeLabel(slide.type) }}</span>
              </div>
            </div>
          </template>
          <div v-else class="slides-empty">该模版暂无已标注类型的页面</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Slide } from '@/types/slides'
import { getTemplateList, getTemplateSlides, type TemplateInfo } from '@/services/templateService'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'

const emit = defineEmits<{
  select: [slide: Slide, templateName: string]
}>()

const loading = ref(true)
const templates = ref<TemplateInfo[]>([])
const expandedId = ref<string | null>(null)
const slidesMap = ref<Record<string, Slide[]>>({})
const loadingMap = ref<Record<string, boolean>>({})

const TYPE_LABELS: Record<string, string> = {
  cover: '封面',
  contents: '目录',
  transition: '过渡',
  content: '内容',
  end: '结尾',
}

function getTypeLabel(type?: string) {
  return type ? (TYPE_LABELS[type] || type) : ''
}

// 过滤出页面类型不为空的页面
function getFilteredSlides(templateId: string): Slide[] {
  const slides = slidesMap.value[templateId] || []
  return slides.filter(slide => slide.type && slide.type !== '')
}

async function toggleTemplate(id: string) {
  if (expandedId.value === id) {
    expandedId.value = null
    return
  }
  expandedId.value = id

  // 懒加载该模版的页面列表
  if (!slidesMap.value[id]) {
    loadingMap.value[id] = true
    try {
      const slides = await getTemplateSlides(id)
      slidesMap.value[id] = slides
    } catch (e) {
      console.error('[TemplatePagePicker] 加载模版页面失败:', e)
      slidesMap.value[id] = []
    } finally {
      loadingMap.value[id] = false
    }
  }
}

function selectSlide(slide: Slide, templateName: string) {
  emit('select', slide, templateName)
}

onMounted(async () => {
  try {
    const list = await getTemplateList()
    // 只展示已发布的模版
    templates.value = list.filter(t => !t.status || t.status === 'published')
  } catch (e) {
    console.error('[TemplatePagePicker] 加载模版列表失败:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.template-page-picker {
  margin-top: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  font-size: 12px;
}

.picker-loading,
.picker-empty {
  padding: 16px;
  text-align: center;
  color: #9ca3af;
}

.template-list {
  max-height: 300px;
  overflow-y: auto;
}

.template-item {
  border-bottom: 1px solid #f3f4f6;
}
.template-item:last-child {
  border-bottom: none;
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.template-header:hover {
  background: #f9fafb;
}
.template-header.expanded {
  background: #eff6ff;
  color: #2563eb;
}

.tpl-name {
  font-weight: 500;
  color: inherit;
}

.expand-arrow {
  font-size: 10px;
  color: #9ca3af;
}

.slides-loading,
.slides-empty {
  padding: 8px 12px;
  color: #9ca3af;
}

.slide-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  background: #f9fafb;
}

.slide-thumb-item {
  width: 68px;
  cursor: pointer;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.15s;
}
.slide-thumb-item:hover {
  border-color: #2563eb;
}

.thumb-wrap {
  width: 68px;
  height: 40px;
  background: #e5e7eb;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.thumb-wrap .thumbnail {
  width: 100%;
  display: block;
}

.thumb-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 4px;
  background: #fff;
}

.page-num {
  color: #6b7280;
  font-size: 10px;
}

.type-badge {
  font-size: 9px;
  color: #fff;
  background: #6b7280;
  border-radius: 2px;
  padding: 0 3px;
}
</style>
