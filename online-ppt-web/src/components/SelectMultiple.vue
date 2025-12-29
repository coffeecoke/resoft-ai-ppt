<template>
  <div class="select-wrap" v-if="disabled">
    <div class="select disabled" ref="selectRef">
      <div class="selector">
        <template v-if="selectedLabels.length === 0">
          <span class="placeholder-text">{{ placeholder }}</span>
        </template>
        <template v-else>
          <div class="tags-container">
            <span 
              v-for="(label, index) in selectedLabels" 
              :key="index" 
              class="tag"
            >
              {{ label }}
            </span>
          </div>
        </template>
      </div>
      <div class="icon">
        <IconDown :size="14" />
      </div>
    </div>
  </div>
  <Popover 
    class="select-wrap"
    trigger="click" 
    v-model:value="popoverVisible" 
    placement="bottom"
    :contentStyle="{
      padding: 0,
      boxShadow: '0 6px 16px 0 rgba(0, 0, 0, 0.08)',
    }"
    v-else
  >
    <template #content>
      <div class="options" ref="optionsRef" :style="{ width: width + 2 + 'px' }">
        <div class="option" 
          :class="{
            'disabled': option.disabled,
            'selected': isSelected(option.value),
          }"
          v-for="option in options" 
          :key="option.value"
          @click="handleToggle(option)"
        >
          <Checkbox 
            :value="isSelected(option.value)"
          />
          <span class="option-label">{{ option.label }}</span>
        </div>
      </div>
    </template>
    <div class="select" ref="selectRef">
      <div class="selector">
        <template v-if="selectedLabels.length === 0">
          <span class="placeholder-text">{{ placeholder }}</span>
        </template>
        <template v-else>
          <div class="tags-container">
            <span 
              v-for="(label, index) in selectedLabels" 
              :key="index" 
              class="tag"
            >
              {{ label }}
              <span class="tag-close" @click.stop="removeTag(index)">×</span>
            </span>
          </div>
        </template>
      </div>
      <div class="icon">
        <IconDown :size="14" />
      </div>
    </div>
  </Popover>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from 'vue'
import Popover from './Popover.vue'
import Checkbox from './Checkbox.vue'

interface SelectOption {
  label: string
  value: string | number
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  value: (string | number)[]
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
}>(), {
  disabled: false,
  placeholder: '请选择',
})

const emit = defineEmits<{
  (event: 'update:value', payload: (string | number)[]): void
}>()

const popoverVisible = ref(false)
const width = ref(0)
const selectRef = useTemplateRef<HTMLElement>('selectRef')
const optionsRef = useTemplateRef<HTMLElement>('optionsRef')

const selectedLabels = computed(() => {
  if (!props.value || props.value.length === 0) return []
  return props.value
    .map(val => props.options.find(opt => opt.value === val)?.label)
    .filter(Boolean) as string[]
})

const isSelected = (value: string | number) => {
  return props.value.includes(value)
}

const removeTag = (index: number) => {
  const newValue = [...props.value]
  newValue.splice(index, 1)
  emit('update:value', newValue)
}

const updateWidth = () => {
  if (!selectRef.value) return
  width.value = selectRef.value.clientWidth
}
const resizeObserver = new ResizeObserver(updateWidth)
onMounted(() => {
  if (!selectRef.value) return
  resizeObserver.observe(selectRef.value)
})
onUnmounted(() => {
  if (!selectRef.value) return
  resizeObserver.unobserve(selectRef.value)
})

const handleToggle = (option: SelectOption) => {
  if (option.disabled) return

  const newValue = [...props.value]
  const index = newValue.indexOf(option.value)
  
  if (index > -1) {
    // 已选中，取消选择
    newValue.splice(index, 1)
  } else {
    // 未选中，添加选择
    newValue.push(option.value)
  }
  
  emit('update:value', newValue)
}
</script>

<style lang="scss" scoped>
.select {
  width: 100%;
  min-height: 32px;
  padding-right: 32px;
  border-radius: $borderRadius;
  transition: border-color .25s;
  font-size: 13px;
  user-select: none;
  background-color: #fff;
  border: 1px solid #d9d9d9;
  position: relative;
  cursor: pointer;

  &:not(.disabled):hover {
    border-color: $themeColor;
  }

  &.disabled {
    background-color: #f5f5f5;
    border-color: #dcdcdc;
    color: #b7b7b7;
    cursor: default;
  }

  .selector {
    min-width: 50px;
    min-height: 30px;
    padding: 4px 10px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;

    .placeholder-text {
      color: #bfbfbf;
      line-height: 22px;
    }

    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      line-height: 1;

      .tag {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        background: rgba($color: $themeColor, $alpha: 0.1);
        color: $themeColor;
        border-radius: 4px;
        font-size: 12px;
        line-height: 18px;
        max-width: 120px;
        @include ellipsis-oneline();

        .tag-close {
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
          line-height: 1;
          flex-shrink: 0;

          &:hover {
            opacity: 1;
          }
        }
      }
    }
  }
}
.options {
  max-height: 260px;
  padding: 5px;
  overflow: auto;
  text-align: left;
  font-size: 13px;
  user-select: none;
}
.option {
  height: 32px;
  line-height: 32px;
  padding: 0 5px;
  border-radius: $borderRadius;
  display: flex;
  align-items: center;
  gap: 8px;

  .option-label {
    flex: 1;
    @include ellipsis-oneline();
  }

  &.disabled {
    color: #b7b7b7;
  }
  &:not(.disabled):hover {
    background-color: rgba($color: $themeColor, $alpha: .05);
    cursor: pointer;
  }

  &.selected {
    background-color: rgba($color: $themeColor, $alpha: .05);
  }
}
.icon {
  width: 32px;
  height: 32px;
  color: #bfbfbf;
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}
</style>

