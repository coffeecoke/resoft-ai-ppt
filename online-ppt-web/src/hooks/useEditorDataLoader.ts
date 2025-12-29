import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSlidesStore } from '@/store'
import { getDocumentDetail } from '@/services/documentService'
import { getTemplateDetail } from '@/services/templateService'
import message from '@/utils/message'

/**
 * 编辑器数据加载Hook
 * 
 * 功能：
 * 1. 优先使用Router State中的数据（基于PPTX创建时秒开）
 * 2. State中无数据时从后端加载（F5刷新/直接访问）
 * 3. 统一管理loading状态和错误处理
 */
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
    
    loading.value = true
    
    try {
      // 优先使用router state中的数据
      const stateData = history.state?.documentData
      
      if (stateData) {
        console.log('[编辑器] 使用创建时的缓存数据（秒开）')
        loadingMessage.value = '正在加载文档...'
        
        // 直接应用数据
        slidesStore.setTitle(stateData.title)
        slidesStore.setTheme(stateData.theme)
        slidesStore.setSlides(stateData.slides)
        slidesStore.setViewportSize(stateData.width)
        
        return
      }
      
      // state中无数据，从后端加载
      console.log('[编辑器] 从后端加载文档数据（F5刷新/直接访问）')
      loadingMessage.value = '正在从服务器加载文档...'
      
      if (documentId) {
        const resp = await getDocumentDetail(documentId)
        const data = resp.documentData
        
        slidesStore.setTitle(data.title)
        slidesStore.setTheme(data.theme)
        slidesStore.setSlides(data.slides)
        slidesStore.setViewportSize(data.width)
      } else if (templateId) {
        const resp = await getTemplateDetail(templateId)
        const data = resp.templateData
        
        slidesStore.setTitle(data.title)
        slidesStore.setTheme(data.theme)
        slidesStore.setSlides(data.slides)
        slidesStore.setViewportSize(data.width)
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
  
  onMounted(() => {
    loadEditorData()
  })
  
  return {
    loading,
    loadingMessage,
    loadEditorData,
  }
}

