<template>
  <div class="filters-container">
    <!-- 横向标签筛选 -->
    <div class="sub-filters">
      <div class="sub-filter-label">
        <i :class="industryLabelIcon" class="sub-filter-label-icon"></i>
        <span>{{ industryLabel }}</span>
      </div>
      <div class="sub-filter-tags">
        <button
          v-for="tag in industryTags"
          :key="tag.id"
          class="sub-filter-tag"
          :class="{ active: selectedIndustry === tag.id }"
          @click="handleIndustryChange(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
      <div class="sub-filter-divider"></div>
      <div class="sub-filter-actions">
        <button class="select-customer-btn" @click="handleSelectCustomer">
          <i class="ri-group-line"></i>
          <span>{{ customerButtonText }}</span>
          <i class="ri-arrow-down-s-line"></i>
        </button>
        <button class="select-product-btn" @click="handleSelectProduct">
          <i class="ri-puzzle-line"></i>
          <span>{{ productButtonText }}</span>
          <i class="ri-arrow-down-s-line"></i>
        </button>
      </div>
    </div>

    <!-- 筛选组 -->
    <div class="essence-type-filter">
      <!-- 左侧筛选组 -->
      <div class="filter-groups-left">
        <!-- 动态筛选组 -->
        <template v-for="(filterGroup, index) in filterGroups" :key="index">
          <div class="filter-group">
            <div class="essence-type-label">
              <i :class="filterGroup.icon" class="essence-type-icon"></i>
              <span>{{ filterGroup.label }}</span>
            </div>
            <div class="essence-type-buttons">
              <button
                v-for="option in filterGroup.options"
                :key="option.id"
                class="essence-type-btn"
                :class="{ active: getSelectedValue(filterGroup.key) === option.id }"
                @click="handleFilterGroupChange(filterGroup.key, option.id)"
              >
                {{ option.name }}
              </button>
            </div>
            <!-- 更多链接（如果配置了） -->
            <button 
              v-if="filterGroup.showMore && index === filterGroups.length - 1 && hiddenFilterGroups.length > 0"
              class="more-link" 
              @click="toggleMoreFilters"
            >
              {{ showMoreFilters ? '收起' : '更多' }}
              <i :class="showMoreFilters ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
            </button>
          </div>
        </template>
        <!-- 隐藏的筛选组（通过更多按钮控制） -->
        <template v-if="showMoreFilters">
          <template v-for="(filterGroup, index) in hiddenFilterGroups" :key="`hidden-${index}`">
            <div class="filter-group">
              <div class="essence-type-label">
                <i :class="filterGroup.icon" class="essence-type-icon"></i>
                <span>{{ filterGroup.label }}</span>
              </div>
              <div class="essence-type-buttons">
                <button
                  v-for="option in filterGroup.options"
                  :key="option.id"
                  class="essence-type-btn"
                  :class="{ active: getSelectedValue(filterGroup.key) === option.id }"
                  @click="handleFilterGroupChange(filterGroup.key, option.id)"
                >
                  {{ option.name }}
                </button>
              </div>
            </div>
          </template>
        </template>
      </div>
      <!-- 右侧排序筛选组 -->
      <div v-if="showSort" class="filter-group filter-group-right">
        <div class="essence-type-label">
          <i class="ri-sort-desc essence-type-icon"></i>
          <span>排序</span>
        </div>
        <div class="essence-type-buttons">
          <button
            v-for="sort in sortOptions"
            :key="sort.id"
            class="essence-type-btn"
            :class="{ active: selectedSort === sort.id }"
            @click="handleSortChange(sort.id)"
          >
            {{ sort.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface FilterOption {
  id: string
  name: string
}

interface FilterGroup {
  key: string
  label: string
  icon: string
  options: FilterOption[]
  showMore?: boolean
}

interface SortOption {
  id: string
  name: string
}

interface Props {
  // 行业标签配置
  industryLabel?: string
  industryLabelIcon?: string
  industryTags?: FilterOption[]
  selectedIndustry?: string | null
  // 按钮文本
  customerButtonText?: string
  productButtonText?: string
  // 筛选组配置
  filterGroups: FilterGroup[]
  hiddenFilterGroups?: FilterGroup[]
  // 筛选值
  filterValues?: Record<string, string | null>
  // 排序
  sortOptions?: SortOption[]
  selectedSort?: string
  showSort?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  industryLabel: '行业领域',
  industryLabelIcon: 'ri-building-2-line',
  industryTags: () => [
    { id: 'national', name: '全国/股份制/政策性银行' },
    { id: 'city', name: '城商行' },
    { id: 'foreign', name: '外资行' },
    { id: 'rural', name: '农商' },
    { id: 'finance', name: '财务公司' },
    { id: 'trust', name: '信托公司' },
    { id: 'auto', name: '汽车/消费金融' },
    { id: 'leasing', name: '金融租赁' }
  ],
  selectedIndustry: null,
  customerButtonText: '全部客户',
  productButtonText: '产品与解决方案',
  hiddenFilterGroups: () => [],
  filterValues: () => ({}),
  sortOptions: () => [
    { id: 'latest', name: '最新更新' },
    { id: 'likes', name: '点赞量' },
    { id: 'usage', name: '使用度' }
  ],
  selectedSort: 'latest',
  showSort: true
})

const emit = defineEmits<{
  'update:selectedIndustry': [value: string | null]
  'update:filterValues': [values: Record<string, string | null>]
  'update:selectedSort': [value: string]
  'select-customer': []
  'select-product': []
}>()

// 更多筛选显示状态（默认展开）
const showMoreFilters = ref(true)

// 获取筛选值
const getSelectedValue = (key: string): string | null => {
  return props.filterValues?.[key] || null
}

// 处理行业变化
const handleIndustryChange = (tagId: string) => {
  const newValue = props.selectedIndustry === tagId ? null : tagId
  emit('update:selectedIndustry', newValue)
}

// 处理筛选组变化
const handleFilterGroupChange = (key: string, optionId: string) => {
  const currentValue = getSelectedValue(key)
  const newValue = currentValue === optionId ? null : optionId
  const newFilterValues = { ...props.filterValues, [key]: newValue }
  emit('update:filterValues', newFilterValues)
}

// 处理排序变化
const handleSortChange = (sortId: string) => {
  emit('update:selectedSort', sortId)
}

// 切换更多筛选
const toggleMoreFilters = () => {
  showMoreFilters.value = !showMoreFilters.value
}

// 处理选择客户
const handleSelectCustomer = () => {
  emit('select-customer')
}

// 处理选择产品
const handleSelectProduct = () => {
  emit('select-product')
}
</script>

<style scoped lang="scss">
.filters-container {
  margin-bottom: 10px;
  background-color: #fcfcfd;
  padding: 10px;
  border-radius: 8px;
}

.sub-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.sub-filter-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: transparent;
  font-size: 0.75rem;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
}

.sub-filter-label-icon {
  font-size: 14px;
  color: #475569;
}

.sub-filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  flex: 1;
}

.sub-filter-divider {
  width: 1px;
  height: 20px;
  background: #e5e7eb;
  flex-shrink: 0;
}

.sub-filter-actions {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.select-customer-btn,
.select-product-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: #f5f5f5;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  font-size: 0.75rem;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  
  i {
    font-size: 14px;
    color: #666;
    
    &:last-child {
      font-size: 12px;
      margin-left: 2px;
    }
  }
  
  &:hover {
    border-color: #9ca3af;
    background: #f0f0f0;
  }
}

.sub-filter-tag {
  padding: 6px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 0.75rem;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    border-color: #006DF9;
    color: #006DF9;
  }
  
  &.active {
    background: #006DF9;
    border-color: #006DF9;
    color: #fff;
  }
}

.essence-type-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 50px;
  margin-bottom: 0;
  padding: 0;
  flex-wrap: wrap;
}

.filter-groups-left {
  display: flex;
  align-items: center;
  gap: 10px 70px;
  flex-wrap: wrap;
  flex: 1;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-group-right {
  flex-shrink: 0;
  margin-left: auto;
}

.essence-type-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  background: transparent;
  font-size: 0.75rem;
  color: #475569;
  white-space: nowrap;
  flex-shrink: 0;
  min-width: 60px;
}

.essence-type-icon {
  font-size: 14px;
  color: #475569;
}

.essence-type-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.essence-type-btn {
  padding: 6px 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  font-size: 0.75rem;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  
  &:hover {
    border-color: #006DF9;
    color: #006DF9;
  }
  
  &.active {
    background: #006DF9;
    border-color: #006DF9;
    color: #fff;
  }
}

.more-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 0.75rem;
  color: #006DF9;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  height: fit-content;
  align-self: flex-start;
  margin-top: 0;
  
  i {
    font-size: 12px;
  }
  
  &:hover {
    color: #0056d6;
  }
}
</style>

