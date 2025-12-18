<template>
  <template v-if="slides.length">
    <RouterView />
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else loading :mask="false" />
</template>

<script lang="ts" setup>
import { onMounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import api, { SERVER_URL } from '@/services'

import FullscreenSpin from '@/components/FullscreenSpin.vue'

const router = useRouter()
const route = useRoute()
const _isPC = isPC()

const mainStore = useMainStore()
const slidesStore = useSlidesStore()
const snapshotStore = useSnapshotStore()
const { databaseId } = storeToRefs(mainStore)
const { slides } = storeToRefs(slidesStore)
const { screening } = storeToRefs(useScreenStore())

if (import.meta.env.MODE !== 'development') {
  window.onbeforeunload = () => false
}

// 根据当前路由和 templateId 加载对应的幻灯片 / 模板数据
const loadSlidesForRoute = async () => {
  // 只在编辑器主页('/')下根据 templateId 加载模板
  if (router.currentRoute.value.path !== '/') {
    return
  }

  const templateId = route.query.templateId as string | undefined

  if (templateId) {
    // 从后端加载指定模板数据
    try {
      const resp = await fetch(`${SERVER_URL}/templates/${templateId}`)
      if (resp.ok) {
        const json = await resp.json()
        if (json.success && json.data?.templateData) {
          const { templateData } = json.data

          // 设置模板数据到 store
          if (templateData.title) {
            slidesStore.setTitle(templateData.title)
          }
          if (templateData.theme) {
            slidesStore.setTheme(templateData.theme)
          }
          if (templateData.width && templateData.height) {
            slidesStore.setViewportSize(templateData.width)
            slidesStore.setViewportRatio(templateData.height / templateData.width)
          }
          if (templateData.slides && Array.isArray(templateData.slides)) {
            slidesStore.setSlides(templateData.slides)
            if (templateData.slides.length > 0) {
              slidesStore.updateSlideIndex(0)
            }
          } else {
            slidesStore.setSlides([])
          }

          // 打开类型标注面板，方便做模板标注
          mainStore.setMarkupPanelState(true)
          return
        }
        throw new Error('模板数据格式错误')
      } else {
        throw new Error('获取模板详情失败')
      }
    } catch (error) {
      console.error('[App] 加载模板失败:', error)
      // 失败时继续走默认逻辑
    }
  }

  // 无 templateId 或加载失败时：加载默认幻灯片数据
  const initialSlides = await api.getMockData('slides')
  slidesStore.setSlides(Array.isArray(initialSlides) ? initialSlides : [])
}

onMounted(async () => {
  await loadSlidesForRoute()

  await deleteDiscardedDB()
  snapshotStore.initSnapshotDatabase()
  
  // 初始化路由：根据设备类型导航到对应页面
  if (!_isPC && router.currentRoute.value.path === '/') {
    router.replace('/mobile')
  }
})

// 监听地址栏中的 templateId 变化，支持在单页应用内从模板列表跳转过来
watch(
  () => route.query.templateId,
  async () => {
    await loadSlidesForRoute()
  }
)

// 监听 screening 状态，自动切换到演示模式
watch(screening, (newVal) => {
  if (newVal && router.currentRoute.value.path !== '/screen') {
    router.push('/screen')
  } else if (!newVal && router.currentRoute.value.path === '/screen') {
    router.push('/')
  }
})

// 应用注销时向 localStorage 中记录下本次 indexedDB 的数据库ID，用于之后清除数据库
window.addEventListener('beforeunload', () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
})
</script>

<style lang="scss">
#app {
  height: 100%;
}
</style>