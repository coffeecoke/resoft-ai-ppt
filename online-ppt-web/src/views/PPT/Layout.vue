<template>
  <!-- 管理后台页面不需要slides数据，直接渲染 -->
  <template v-if="isAdminRoute">
    <RouterView />
  </template>
  <!-- 文档模式等 useEditorDataLoader 加载完毕；模板/默认模式等 slides 有数据 -->
  <template v-else-if="slidesStore.editorDataReady || slides.length">
    <KeepAlive :include="['Editor']">
      <RouterView />
    </KeepAlive>
  </template>
  <FullscreenSpin tip="数据初始化中，请稍等 ..." v-else loading :mask="false" />
</template>

<script lang="ts" setup>
import { onMounted, watch, onBeforeUnmount, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { useScreenStore, useMainStore, useSnapshotStore, useSlidesStore } from '@/store'
import { LOCALSTORAGE_KEY_DISCARDED_DB } from '@/configs/storage'
import { deleteDiscardedDB } from '@/utils/database'
import { isPC } from '@/utils/common'
import api, { SERVER_URL, authFetch } from '@/services'
import { useEditorDataLoader } from '@/hooks/useEditorDataLoader'

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

// 保存进入演示前的编辑器路由信息（用于退出时恢复）
let editorRouteBeforeScreen: { path: string; query: Record<string, any> } | null = null

// 判断是否为不需要slides数据的路由（管理后台、文档列表等）
const isAdminRoute = computed(() => {
  return route.path.includes('/ppt/admin') || route.path.includes('/ppt/docs')
})

// 保存已加载的 documentId/templateId，避免重复加载
let loadedDocumentId: string | null = null
let loadedTemplateId: string | null = null

// 根据当前路由和 templateId/documentId 加载对应的幻灯片 / 模板 / 文档数据
const loadSlidesForRoute = async () => {
  // 只在编辑器页面下根据 templateId/documentId 加载数据
  if (!route.path.includes('/ppt/editor')) {
    return
  }

  const templateId = route.query.templateId as string | undefined
  const documentId = route.query.documentId as string | undefined
  
  // 优化：如果已经加载过相同的数据，且 store 中有数据，跳过重新加载（避免退出演示时重复请求）
  if (documentId && documentId === loadedDocumentId && slidesStore.slides.length > 0) {
    console.log('[PPTLayout] 检测到已加载相同文档，跳过重新加载（可能是从演示模式返回）')
    return
  }
  
  if (templateId && templateId === loadedTemplateId && slidesStore.slides.length > 0) {
    console.log('[PPTLayout] 检测到已加载相同模板，跳过重新加载')
    return
  }

  if (templateId) {
    // 从后端加载指定模板数据
    try {
      // 清空 loadedId，防止加载过程中的 race condition（旧 slides + 新 ID 触发自动保存）
      slidesStore.setLoadedId(null)
      const resp = await authFetch(`${SERVER_URL}/templates/${templateId}`)
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
          // 标记已加载的 templateId
          loadedTemplateId = templateId
          slidesStore.setLoadedId(templateId)
          return
        }
        throw new Error('模板数据格式错误')
      } else {
        throw new Error('获取模板详情失败')
      }
    } catch (error) {
      console.error('[PPTLayout] 加载模板失败:', error)
      // 失败时继续走默认逻辑
    }
  } else if (documentId) {
    // 文档数据由 Editor/index.vue 内的 useEditorDataLoader 统一加载（含 metadata）
    // Layout 不发重复请求，只标记已处理
    loadedDocumentId = documentId
    return
  }

  // 无 templateId/documentId 或加载失败时：加载默认幻灯片数据
  if (!templateId && !documentId) {
    const initialSlides = await api.getMockData('slides')
    slidesStore.setSlides(Array.isArray(initialSlides) ? initialSlides : [])
  }
}

// 监听 screening 状态，自动切换到演示模式（仅在非管理后台路由时生效）
const unwatchScreening = watch(screening, (newVal) => {
  // 管理后台页面不需要监听演示模式切换
  if (isAdminRoute.value) return
  
  if (newVal && route.path !== '/ppt/screen') {
    // 进入演示模式：保存当前编辑器路由信息，并跳转到演示页面（保留 query 参数）
    editorRouteBeforeScreen = {
      path: route.path,
      query: { ...route.query }
    }
    router.replace({
      path: '/ppt/screen',
      query: route.query
    })
  } else if (!newVal && route.path === '/ppt/screen') {
    // 退出演示模式：恢复到进入演示前的编辑器路由（使用 replace 避免添加历史记录）
    const targetRoute = editorRouteBeforeScreen || {
      path: '/ppt/editor',
      query: route.query
    }
    router.replace({
      path: targetRoute.path,
      query: targetRoute.query
    })
    // 清空保存的路由信息
    editorRouteBeforeScreen = null
  }
})

// IndexedDB 清理事件处理
const handleBeforeUnload = () => {
  const discardedDB = localStorage.getItem(LOCALSTORAGE_KEY_DISCARDED_DB)
  const discardedDBList: string[] = discardedDB ? JSON.parse(discardedDB) : []

  discardedDBList.push(databaseId.value)

  const newDiscardedDB = JSON.stringify(discardedDBList)
  localStorage.setItem(LOCALSTORAGE_KEY_DISCARDED_DB, newDiscardedDB)
}

// 文档模式数据加载（统一在 Layout 层调用，避免子组件挂载前的死锁）
const { loadEditorData } = useEditorDataLoader()

onMounted(async () => {
  // 管理后台页面不需要初始化slides和IndexedDB
  if (!isAdminRoute.value) {
    // 先并行跑：loadSlidesForRoute（模板/mock）和 loadEditorData（文档）
    // documentId 场景：loadSlidesForRoute 会快速 return，loadEditorData 负责加载
    // templateId 场景：loadSlidesForRoute 负责加载，loadEditorData 快速 return
    await Promise.all([loadSlidesForRoute(), loadEditorData()])
    await deleteDiscardedDB()
    snapshotStore.initSnapshotDatabase()
    
    // 移动端检测：如果当前在编辑器页面且是移动设备，跳转到移动端
    if (!_isPC && route.path.includes('/ppt/editor')) {
      router.replace('/ppt/mobile')
    }
  }

  // 监听 beforeunload 事件，记录需要清理的数据库
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  // 清理监听器
  unwatchScreening()
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

// 监听地址栏中的 templateId/documentId 变化，支持在单页应用内从模板列表跳转过来（仅在编辑器路由时生效）
watch(
  () => [route.query.templateId, route.query.documentId],
  async (newVal, oldVal) => {
    // 管理后台页面不需要监听templateId变化
    if (isAdminRoute.value) return
    
    // 优化：如果参数没有实际变化，跳过加载（避免退出演示时触发）
    const [newTemplateId, newDocumentId] = newVal as [string | undefined, string | undefined]
    const [oldTemplateId, oldDocumentId] = (oldVal || []) as [string | undefined, string | undefined]
    
    if (newTemplateId === oldTemplateId && newDocumentId === oldDocumentId) {
      console.log('[PPTLayout] query 参数未变化，跳过加载')
      return
    }
    
    await loadSlidesForRoute()
  }
)
</script>

<style lang="scss" scoped>
// PPT模块布局不需要额外样式，高度由父容器控制
</style>