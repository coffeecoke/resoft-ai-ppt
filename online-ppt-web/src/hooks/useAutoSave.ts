import { ref, onUnmounted } from 'vue'
import axios from '@/services/config'
import { SERVER_URL } from '@/services'

// 与规划文档中的 TemplateData 对齐的结构
export interface TemplateData {
  title: string
  width: number
  height: number
  theme: any
  slides: any[]
}

/**
 * 自动保存 Hook：每 30 秒将有变更的模板数据保存到后端
 *
 * 对应规划 3.4 中的 useAutoSave 设计：
 * - hasUnsavedChanges=true 时才会触发
 * - autoSave 标志位传给后端用于区分自动/手动
 */
export function useAutoSave(templateId: string | undefined, getTemplateData: () => TemplateData) {
  const saving = ref(false)
  const lastSaveTime = ref<number>(0)
  const hasUnsavedChanges = ref(false)

  const autoSave = async () => {
    if (!templateId) return
    if (saving.value || !hasUnsavedChanges.value) return

    saving.value = true
    try {
      const template = getTemplateData()
      await axios.put(`${SERVER_URL}/templates/${templateId}`, {
        templateData: template,
        autoSave: true,
      })
      lastSaveTime.value = Date.now()
      hasUnsavedChanges.value = false
    } catch (error) {
      console.error('[useAutoSave] 自动保存失败', error)
    } finally {
      saving.value = false
    }
  }

  // 30 秒自动保存一次
  const timer = setInterval(autoSave, 30000)

  const markAsChanged = () => {
    hasUnsavedChanges.value = true
  }

  onUnmounted(() => {
    clearInterval(timer)
  })

  return {
    autoSave,
    saving,
    lastSaveTime,
    hasUnsavedChanges,
    markAsChanged,
  }
}




