import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'

export default () => {
  const { slides } = storeToRefs(useSlidesStore())

  const timer = ref<number | null>(null)
  const slidesLoadLimit = ref(10) // 优化：初始只加载10个缩略图，加快首屏速度

  const loadSlide = () => {
    if (slides.value.length > slidesLoadLimit.value) {
      timer.value = setTimeout(() => {
        slidesLoadLimit.value = slidesLoadLimit.value + 10 // 优化：每次增量加载10个
        loadSlide()
      }, 300) // 优化：缩短间隔从600ms到300ms，更快完成加载
    }
    else slidesLoadLimit.value = 9999
  }

  onMounted(loadSlide)

  onUnmounted(() => {
    if (timer.value) clearTimeout(timer.value)
  })

  return {
    slidesLoadLimit,
  }
}