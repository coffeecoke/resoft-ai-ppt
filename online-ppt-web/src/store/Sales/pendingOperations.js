import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'ppt-pending-operations-list'

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
    // 兼容旧 key（一次性迁移）
    const legacy = localStorage.getItem('pending-operations-list')
    if (legacy) {
      const all = JSON.parse(legacy)
      // 只保留非响应文件章节的项
      return all.filter(i => i.type !== 'response-section' && i.type !== 'response')
    }
  } catch (error) {
    console.error('[PPT待操作] 从LocalStorage恢复数据失败:', error)
  }
  return []
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-50))) } catch {}
    }
  }
}

export const usePendingOperationsStore = defineStore('pendingOperations', () => {
  const pendingList = ref(loadFromStorage())

  watch(pendingList, (val) => saveToStorage(val), { deep: true })

  // 添加待操作项（PPT / video / document）
  const addToPending = (item) => {
    const exists = pendingList.value.find(p => p.id === item.id && p.type === item.type)
    if (!exists) {
      pendingList.value.push({
        id: item.id,
        type: item.type || 'ppt',
        title: item.title,
        documentId: item.documentId || '',
        tag: item.tag || '',
        date: item.date || new Date().toISOString().split('T')[0],
        selected: item.selected !== undefined ? item.selected : true,
        slideIds: item.slideIds || [],
        thumbnail: item.thumbnail,
        slides: item.slides || [],
      })
    }
  }

  // 移除待操作项
  const removeFromPending = (id, type) => {
    const index = pendingList.value.findIndex(p => p.id === id && p.type === type)
    if (index > -1) pendingList.value.splice(index, 1)
  }

  // 清空
  const clearPending = () => { pendingList.value = [] }

  // PPT 项
  const otherItems = computed(() => pendingList.value)

  // 批量AI分析
  const batchAnalyze = async (selectedItems) => {
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    if (!items.length) return
    try {
      const { useBatchAnalyze } = await import('../../views/Sales/composables/useBatchAnalyze')
      const { startAnalyze } = useBatchAnalyze()
      await startAnalyze(items)
    } catch (error) {
      console.error('[PPT待操作] 批量AI分析失败:', error)
      throw error
    }
  }

  // 批量合并下载
  const batchDownload = async (selectedItems) => {
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    if (!items.length) return
    const { useBatchExport } = await import('../../views/Sales/composables/useBatchExport')
    const { exportMergedPPTX } = useBatchExport()
    try {
      await exportMergedPPTX(items)
    } catch (error) {
      console.error('[PPT待操作] 批量下载失败:', error)
      throw error
    }
  }

  return {
    pendingList,
    otherItems,
    addToPending,
    removeFromPending,
    clearPending,
    batchAnalyze,
    batchDownload,
  }
})
