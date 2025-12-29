import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePendingOperationsStore = defineStore('pendingOperations', () => {
  // 待操作列表
  const pendingList = ref([])

  // 添加待操作项
  const addToPending = (item) => {
    // 检查是否已存在
    const exists = pendingList.value.find(p => p.id === item.id && p.type === item.type)
    if (!exists) {
      pendingList.value.push({
        id: item.id,
        type: item.type || 'ppt', // 'ppt' | 'video' | 'document'
        title: item.title,
        thumbnail: item.thumbnail,
        tag: item.tag || '公共版',
        date: item.date || new Date().toISOString().split('T')[0],
        slides: item.slides || [],
        selected: true // 默认选中
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
  const batchAnalyze = (selectedItems) => {
    // 如果没有传入selectedItems，使用所有选中的项
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    console.log('批量AI分析:', items)
    // TODO: 实现批量AI分析逻辑
    // 这里可以调用API进行批量分析
  }

  // 批量合并下载
  const batchDownload = (selectedItems) => {
    // 如果没有传入selectedItems，使用所有选中的项
    const items = selectedItems || pendingList.value.filter(item => item.selected !== false)
    console.log('批量合并下载:', items)
    // TODO: 实现批量下载逻辑
    // 这里可以调用API进行批量下载，或者合并多个文件后下载
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

