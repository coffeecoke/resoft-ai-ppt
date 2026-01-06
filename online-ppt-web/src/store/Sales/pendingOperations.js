import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'pending-operations-list'

// 从LocalStorage恢复数据
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[待操作列表] 从LocalStorage恢复数据失败:', error)
  }
  return []
}

// 保存到LocalStorage
function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (error) {
    console.error('[待操作列表] 保存到LocalStorage失败:', error)
    // 如果存储失败（可能是容量超限），尝试清理旧数据
    if (error.name === 'QuotaExceededError') {
      console.warn('[待操作列表] LocalStorage容量不足，尝试清理旧数据')
      // 只保留最近50条
      const trimmed = list.slice(-50)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        console.log('[待操作列表] 已清理旧数据，保留最近50条')
      } catch (e) {
        console.error('[待操作列表] 清理后仍无法保存:', e)
      }
    }
  }
}

export const usePendingOperationsStore = defineStore('pendingOperations', () => {
  // 待操作列表 - 从LocalStorage初始化
  const pendingList = ref(loadFromStorage())

  // 监听变化自动保存
  watch(
    pendingList,
    (newList) => {
      saveToStorage(newList)
    },
    { deep: true }
  )

  // 添加待操作项
  const addToPending = (item) => {
    // 检查是否已存在
    const exists = pendingList.value.find(p => p.id === item.id && p.type === item.type)
    if (!exists) {
      pendingList.value.push({
        id: item.id,
        type: item.type || 'ppt', // 'ppt' | 'video' | 'document'
        title: item.title,
        documentId: item.documentId, // 文档ID（必须，用于后端查询）
        slideIds: item.slideIds || [], // 幻灯片ID数组（可为空表示整个PPT）
        thumbnail: item.thumbnail,
        tag: item.tag || '公共版',
        date: item.date || new Date().toISOString().split('T')[0],
        slides: item.slides || [], // 保留用于兼容（可选）
        selected: item.selected !== undefined ? item.selected : true // 默认选中
      })
    }
  }

  // 移除待操作项
  const removeFromPending = (id, type) => {
    const index = pendingList.value.findIndex(p => p.id === id && p.type === type)
    if (index > -1) {
      pendingList.value.splice(index, 1)
    }
  }

  // 清空待操作列表
  const clearPending = () => {
    pendingList.value = []
  }

  // 批量AI分析
  const batchAnalyze = async (selectedItems) => {
    // 如果没有传入selectedItems，使用所有选中的项
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    
    console.log('[Store-批量分析] 开始批量分析')
    console.log('[Store-批量分析] 选中的项目数:', items.length)
    console.log('[Store-批量分析] 选中的项目:', items)
    
    if (items.length === 0) {
      console.warn('[Store-批量分析] 没有选中的项目')
      return
    }
    
    try {
      // 动态导入 composable（避免循环依赖）
      console.log('[Store-批量分析] 动态导入 useBatchAnalyze')
      const { useBatchAnalyze } = await import('../../views/Sales/composables/useBatchAnalyze')
      const { startAnalyze } = useBatchAnalyze()
      
      console.log('[Store-批量分析] 调用 startAnalyze')
      await startAnalyze(items)
      console.log('[Store-批量分析] startAnalyze 完成')
    } catch (error) {
      console.error('[Store-批量分析] 批量AI分析失败:', error)
      throw error
    }
  }

  // 批量合并下载
  const batchDownload = async (selectedItems) => {
    // 如果没有传入selectedItems，使用所有选中的项
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    
    console.log('[Store-批量下载] 开始批量下载')
    console.log('[Store-批量下载] 选中的项目数:', items.length)
    console.log('[Store-批量下载] 选中的项目:', items)
    
    if (items.length === 0) {
      console.warn('[Store-批量下载] 没有选中的项目')
      return
    }
    
    // 动态导入 composable（避免循环依赖）
    const { useBatchExport } = await import('../../views/Sales/composables/useBatchExport')
    const { exportMergedPPTX } = useBatchExport()
    
    try {
      await exportMergedPPTX(items)
    } catch (error) {
      console.error('[Store-批量下载] 批量下载失败:', error)
      throw error
    }
  }

  return {
    pendingList,
    addToPending,
    removeFromPending,
    clearPending,
    batchAnalyze,
    batchDownload
  }
})

