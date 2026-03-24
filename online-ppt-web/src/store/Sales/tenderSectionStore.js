import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'tender-sections-list'

function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {
    console.error('[招标文件章节] 恢复数据失败:', e)
  }
  return []
}

function saveToStorage(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-100))) } catch {}
    }
  }
}

export const useTenderSectionStore = defineStore('tenderSections', () => {
  const sectionList = ref(loadFromStorage())

  watch(sectionList, (val) => saveToStorage(val), { deep: true })

  // 添加章节（去重）
  const addSection = (item) => {
    const exists = sectionList.value.find(s => s.id === item.id)
    if (!exists) {
      sectionList.value.push({
        id: item.id,
        title: item.title,
        documentId: item.documentId || '',
        documentName: item.documentName || '',
        level: item.level || 1,
        parent_section_id: item.parent_section_id || null,
        isHeaderOnly: item.isHeaderOnly || false,
        tag: item.tag || '招标文件',
        date: item.date || new Date().toISOString().split('T')[0],
      })
    }
  }

  // 移除单个章节
  const removeSection = (id) => {
    const idx = sectionList.value.findIndex(s => s.id === id)
    if (idx > -1) sectionList.value.splice(idx, 1)
  }

  // 级联移除章节（自身及所有后代），并清理孤立标题行
  const removeSectionCascade = (sectionId) => {
    const idsToRemove = new Set([sectionId])
    let changed = true
    while (changed) {
      changed = false
      for (const item of sectionList.value) {
        if (item.parent_section_id && idsToRemove.has(item.parent_section_id) && !idsToRemove.has(item.id)) {
          idsToRemove.add(item.id)
          changed = true
        }
      }
    }
    sectionList.value = sectionList.value.filter(s => !idsToRemove.has(s.id))

    // 清理孤立的 isHeaderOnly 行（其后代中没有实际章节了）
    const realItems = sectionList.value.filter(s => !s.isHeaderOnly)
    const hasDescendant = (headerId) =>
      realItems.some(item => {
        let pid = item.parent_section_id
        while (pid) {
          if (pid === headerId) return true
          const parent = sectionList.value.find(p => p.id === pid)
          pid = parent?.parent_section_id || null
        }
        return false
      })

    sectionList.value = sectionList.value.filter(s => {
      if (s.isHeaderOnly) return hasDescendant(s.id)
      return true
    })
  }

  // 移除某文档的所有章节
  const removeDocumentSections = (documentId) => {
    sectionList.value = sectionList.value.filter(s => s.documentId !== documentId)
  }

  // 拖拽排序后替换顺序
  const reorderSections = (newOrdered) => {
    sectionList.value = [...newOrdered]
  }

  // 清空
  const clearSections = () => {
    sectionList.value = []
  }

  // 合并下载
  const mergeDownload = async (sections, name) => {
    const { mergeDownloadSections } = await import('../../views/Sales/composables/useMergeDownload')
    await mergeDownloadSections(sections, name)
  }

  // 所有章节 ID（用于 TOC 双向联动）
  const sectionIdsForDoc = (documentId) =>
    computed(() =>
      sectionList.value
        .filter(s => s.documentId === documentId)
        .map(s => s.id)
    )

  return {
    sectionList,
    addSection,
    removeSection,
    removeSectionCascade,
    removeDocumentSections,
    reorderSections,
    clearSections,
    mergeDownload,
    sectionIdsForDoc,
  }
})
