<template>
  <aside class="concerned-questions-sidebar">
    <h3 class="sidebar-title">问题分类</h3>
    <div 
      v-for="category in questionCategories" 
      :key="category.id"
      class="category-group"
    >
      <div class="category-title">
        <i :class="category.icon" class="category-icon"></i>
        <span>{{ category.name }}</span>
      </div>
      <div class="category-children">
        <div 
          v-for="child in category.children"
          :key="child.id"
          class="category-child-item"
          :class="{ active: selectedFilters.includes(child.id) }"
          @click="handleToggleFilter(child.id)"
        >
          <span class="child-name">{{ child.name }}</span>
          <i v-if="selectedFilters.includes(child.id)" class="ri-check-line check-icon"></i>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
interface CategoryChild {
  id: string
  name: string
}

interface QuestionCategory {
  id: string
  name: string
  icon: string
  children: CategoryChild[]
}

interface Props {
  questionCategories: QuestionCategory[]
  selectedFilters: string[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle-filter', filterId: string): void
}>()

const handleToggleFilter = (filterId: string) => {
  emit('toggle-filter', filterId)
}
</script>

<style scoped lang="scss">
.concerned-questions-sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 0;
}

.sidebar-title {
  font-size: 1rem;
  line-height: 1.75rem;
  color: #1e293b;
  font-weight: 600;
  margin: 0 0 10px 0;
  padding: 0;
  border-bottom: none;
}

.category-group {
  margin-bottom: 15px;
  background: rgba(252, 252, 253, 1);
  border-radius: 10px;
  border: 1px solid #FCFCFD;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.25rem;
  font-weight: 500;
  color: #3b82f6;
  border-radius: 4px;
  background-color: rgb(241 245 249 / 0.5);
}

.category-icon {
  font-size: 16px;
  color: #334155;
}

.category-children {
  padding: 10px;
  margin-top: 0;
}

.category-child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid rgb(252, 252, 253);
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  
  &:hover {
    background: #fff;
    border: 1px solid rgb(226 232 240 / 1);
  }
  
  &.active {
    background: rgba(0, 109, 249, 1);
    color: #fff;
    border: 1px solid #006DF9;
    
    .check-icon {
      color: #fff;
    }
    
    .child-name {
      color: #fff;
    }
  }
}

.child-name {
  font-size: 12px;
  flex: 1;
  color: #94a3b8;
}

.check-icon {
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #fff;
  border-radius: 50%;
  font-size: 8px;
  color: #006DF9;
  flex-shrink: 0;
}
</style>

