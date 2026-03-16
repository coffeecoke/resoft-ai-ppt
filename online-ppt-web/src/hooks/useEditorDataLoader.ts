import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSlidesStore } from '@/store'
import { getDocument } from '@/services/documentService'
import message from '@/utils/message'

/**
 * 编辑器数据加载Hook
 * 
 * 功能：
 * 1. 优先使用Router State中的数据（基于PPTX创建时秒开）
 * 2. State中无数据时从后端加载（F5刷新/直接访问）
 * 3. 统一管理loading状态和错误处理
 */

// 全局标记：记录已加载的 documentId 和 templateId（避免退出演示时重复加载）
const loadedIds = new Set<string>()

export function useEditorDataLoader() {
  const route = useRoute()
  const router = useRouter()
  const slidesStore = useSlidesStore()
  
  const loading = ref(false)
  const loadingMessage = ref('')
  
  const loadEditorData = async () => {
    const documentId = route.query.documentId as string
    const templateId = route.query.templateId as string
    
    if (!documentId && !templateId) {
      // 普通编辑模式，使用mock数据
      return
    }
    
    // 优化：检查是否已经加载过相同的数据（避免退出演示时重复请求）
    const currentId = documentId || templateId
    if (currentId && loadedIds.has(currentId) && slidesStore.slides.length > 0) {
      console.log('[编辑器] 检测到已加载相同数据，跳过重新加载（可能是从演示模式返回）', currentId)
      return
    }
    
    loading.value = true
    slidesStore.setEditorDataReady(false)
    
    try {
      // 判断是否是用户主动刷新（F5/Ctrl+R）
      // 刷新时 history.state 里的缓存数据已过时，必须从后端重新加载
      const isPageReload = performance.navigation?.type === 1
        || (performance.getEntriesByType?.('navigation')[0] as PerformanceNavigationTiming)?.type === 'reload'

      // 优先使用router state中的数据（仅限首次从列表页导航，不含刷新）
      // 其次读 sessionStorage（window.open 新建页签时写入）
      const stateData = !isPageReload && (
        history.state?.documentData
        || (documentId ? JSON.parse(sessionStorage.getItem(`editor_init_${documentId}`) || 'null') : null)
      )

      if (stateData) {
        // 用完即清，避免下次刷新时复用
        if (documentId) sessionStorage.removeItem(`editor_init_${documentId}`)
        console.log('[编辑器] 使用创建时的缓存数据（秒开）')
        loadingMessage.value = '正在加载文档...'

        // 直接应用数据
        slidesStore.setTitle(stateData.title)
        slidesStore.setTheme(stateData.theme)
        slidesStore.setSlides(stateData.slides)
        slidesStore.setViewportSize(stateData.width)

        // stateData 只含 slides，仍需请求一次获取最新 metadata（status/name）
        // 注意：这里是唯一一次请求，不会和下面的完整加载重叠
        if (documentId) {
          try {
            const resp = await getDocument(documentId)
            slidesStore.setMetadata(resp.metadata)
            if (resp.metadata.name) slidesStore.setTitle(resp.metadata.name)
            console.log('[编辑器] 已加载文档状态:', resp.metadata.status)
          } catch (error) {
            console.warn('[编辑器] 获取文档状态失败，将按草稿处理:', error)
          }
          slidesStore.setLoadedId(documentId)
          loadedIds.add(documentId)
        }
        slidesStore.setEditorDataReady(true)
        return
      }
      
      // state中无数据，从后端加载
      console.log('[编辑器] 从后端加载文档数据（F5刷新/直接访问）')
      loadingMessage.value = '正在从服务器加载文档...'
      
      if (documentId) {
        const resp = await getDocument(documentId)
        const data = resp.documentData

        // 保存 metadata（新增）
        slidesStore.setMetadata(resp.metadata)

        // 以 DB 中的 name 为准（与文档列表保持一致），JSON 的 title 作为兜底
        slidesStore.setTitle(resp.metadata.name || data.title)
        slidesStore.setTheme(data.theme)
        slidesStore.setSlides(data.slides)
        slidesStore.setViewportSize(data.width)
        slidesStore.setLoadedId(documentId)

        // 标记已加载
        loadedIds.add(documentId)
        slidesStore.setEditorDataReady(true)
        console.log('[编辑器] 文档数据加载完成，已标记:', documentId)
      } else if (templateId) {
        // 模板数据由 PPT/Layout.vue 的 loadSlidesForRoute 负责加载，此处只标记 ID
        // loadedId 由 Layout.vue 在数据加载成功后设置
        console.log('[编辑器] 模板编辑模式，跳过数据加载（由 Layout.vue 负责）')
        loadedIds.add(templateId)
      }
    } catch (error) {
      console.error('[编辑器] 加载数据失败:', error)
      message.error('加载失败，请返回重试')
      
      // 3秒后跳转回列表
      setTimeout(() => {
        if (documentId) router.push('/ppt/docs')
        else if (templateId) router.push('/ppt/admin/templates')
      }, 3000)
    } finally {
      loading.value = false
    }
  }
  
  // 不在 hook 内部注册 onMounted，由调用方决定调用时机
  return {
    loading,
    loadingMessage,
    loadEditorData,
  }
}

