<template>
  <div class="filters-container">
    <!-- 横向标签筛选 -->
    <div class="sub-filters">
      <div class="sub-filter-label">
        <i class="ri-building-2-line sub-filter-label-icon"></i>
        <span>行业领域</span>
      </div>
      <div class="sub-filter-tags">
        <button
          v-for="tag in resolvedSubFilterTags"
          :key="tag.code"
          class="sub-filter-tag"
          :class="{ active: selectedSubFilter === tag.code }"
          @click="handleSubFilterChange(tag.code)"
        >
          {{ tag.name }}
        </button>
      </div>
      <div class="sub-filter-divider"></div>
      <div class="sub-filter-actions">
        <button class="select-customer-btn" @click="handleSelectCustomer">
          <i class="ri-group-line"></i>
          <span>全部客户</span>
          <i class="ri-arrow-down-s-line"></i>
        </button>
        <button class="select-product-btn" @click="handleSelectProduct">
          <i class="ri-puzzle-line"></i>
          <span>产品与解决方案</span>
          <i class="ri-arrow-down-s-line"></i>
        </button>
      </div>
    </div>

    <!-- 业务条线和版本筛选 -->
    <div class="essence-type-filter">
      <!-- 左侧筛选组 -->
      <div class="filter-groups-left">
        <!-- 动态筛选组 -->
        <template v-for="(filterGroup, index) in computedFilterGroups" :key="index">
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
              v-if="filterGroup.showMore && index === computedFilterGroups.length - 1"
              class="more-link" 
              @click="toggleMoreFilters"
            >
              {{ showMoreFilters ? '收起' : '更多' }}
              <i :class="showMoreFilters ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'"></i>
            </button>
          </div>
        </template>
        <!-- 版本筛选组：只在PPT页面显示 -->
        <template v-if="showVersion">
          <div class="filter-group">
            <div class="essence-type-label">
              <i class="ri-file-copy-line essence-type-icon"></i>
              <span>版本</span>
            </div>
            <div class="essence-type-buttons">
              <button
                v-for="version in versions"
                :key="version.id"
                class="essence-type-btn"
                :class="{ active: selectedVersion === version.id }"
                @click="handleVersionChange(version.id)"
              >
                {{ version.name }}
              </button>
            </div>
          </div>
        </template>
        <!-- 隐藏的筛选组（通过更多按钮控制） -->
        <template v-if="showMoreFilters">
          <template v-for="(filterGroup, index) in computedHiddenFilterGroups" :key="`hidden-${index}`">
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
      <div class="filter-group filter-group-right">
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
import { ref, computed, onMounted } from 'vue'
import { useSalesOptions } from '@/hooks/useSalesOptions'

interface SubFilterTag {
  code: string
  name: string
}

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

interface Version {
  id: string
  name: string
}

interface SortOption {
  id: string
  name: string
}

interface Props {
  selectedSubFilter?: string | null
  selectedEssenceType?: string | null
  selectedVersion?: string | null
  selectedSort?: string | null
  showVersion?: boolean
  subFilterTags?: SubFilterTag[]
  essenceTypes?: FilterOption[]
  versions?: Version[]
  sortOptions?: SortOption[]
  // 新增：动态筛选组配置
  filterGroups?: FilterGroup[]
  hiddenFilterGroups?: FilterGroup[]
  // 新增：筛选值对象（用于动态筛选组）
  filterValues?: Record<string, string | null>
}

const { load, industryTags: dynamicSubFilterTags } = useSalesOptions()
onMounted(() => load())

const props = withDefaults(defineProps<Props>(), {
  selectedSubFilter: null,
  selectedEssenceType: null,
  selectedVersion: null,
  selectedSort: 'latest',
  showVersion: false,
  subFilterTags: () => [],
  essenceTypes: () => [
    { id: 'regulatory', name: '监管条线' },
    { id: 'xinchuang', name: '信创协同条线' },
    { id: 'bill', name: '票据条线' },
    { id: 'internet-finance', name: '互联网金融条线' }
  ],
  versions: () => [
    { id: 'public', name: '公共版' },
    { id: 'practical', name: '实战版' }
  ],
  sortOptions: () => [
    { id: 'latest', name: '最新更新' },
    { id: 'likes', name: '点赞量' },
    { id: 'usage', name: '使用度' }
  ],
  filterGroups: () => [],
  hiddenFilterGroups: () => [],
  filterValues: () => ({})
})

// 行业标签：优先使用 prop 传入，否则用动态接口数据
const resolvedSubFilterTags = computed(() =>
  props.subFilterTags.length > 0 ? props.subFilterTags : dynamicSubFilterTags.value
)

// 更多筛选显示状态
const showMoreFilters = ref(false)

// 计算筛选组（如果没有传入 filterGroups，则使用默认的 essenceTypes）
const computedFilterGroups = computed(() => {
  if (props.filterGroups && props.filterGroups.length > 0) {
    return props.filterGroups
  }
  // 默认使用 essenceTypes（向后兼容）
  if (props.essenceTypes && props.essenceTypes.length > 0) {
    return [{
      key: 'essenceType',
      label: '问题本质',
      icon: 'ri-stack-line',
      options: props.essenceTypes
    }]
  }
  return []
})

// 计算隐藏的筛选组
const computedHiddenFilterGroups = computed(() => {
  return props.hiddenFilterGroups || []
})

const emit = defineEmits<{
  'update:selectedSubFilter': [value: string | null]
  'update:selectedEssenceType': [value: string | null]
  'update:selectedVersion': [value: string | null]
  'update:selectedSort': [value: string]
  'update:filterValues': [values: Record<string, string | null>]
  'select-customer': []
  'select-product': []
}>()

// 处理子筛选标签变化
const handleSubFilterChange = (tagId: string) => {
  const newValue = props.selectedSubFilter === tagId ? null : tagId
  emit('update:selectedSubFilter', newValue)
}

// 处理业务条线变化
const handleEssenceTypeChange = (typeId: string) => {
  const newValue = props.selectedEssenceType === typeId ? null : typeId
  emit('update:selectedEssenceType', newValue)
}

// 获取筛选值（支持动态筛选组）
const getSelectedValue = (key: string): string | null => {
  if (props.filterValues && props.filterValues[key] !== undefined) {
    return props.filterValues[key]
  }
  // 向后兼容：如果是 essenceType，使用 selectedEssenceType
  if (key === 'essenceType') {
    return props.selectedEssenceType
  }
  return null
}

// 处理动态筛选组变化
const handleFilterGroupChange = (key: string, optionId: string) => {
  const currentValue = getSelectedValue(key)
  const newValue = currentValue === optionId ? null : optionId
  
  if (props.filterValues) {
    // 使用 filterValues 模式
    const newFilterValues = { ...props.filterValues, [key]: newValue }
    emit('update:filterValues', newFilterValues)
  } else if (key === 'essenceType') {
    // 向后兼容：使用 selectedEssenceType
    emit('update:selectedEssenceType', newValue)
  }
}

// 切换更多筛选
const toggleMoreFilters = () => {
  showMoreFilters.value = !showMoreFilters.value
}

// 处理版本变化
const handleVersionChange = (versionId: string) => {
  const newValue = props.selectedVersion === versionId ? null : versionId
  emit('update:selectedVersion', newValue)
}

// 处理排序变化
const handleSortChange = (sortId: string) => {
  emit('update:selectedSort', sortId)
}

// 处理选择客户
const handleSelectCustomer = () => {
  emit('select-customer')
}

// 处理选择产品与解决方案
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
  gap: 50px;
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
</style>

