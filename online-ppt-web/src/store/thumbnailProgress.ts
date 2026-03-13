import { defineStore } from 'pinia'

export interface ThumbnailTask {
  taskId: string
  documentId: string
  slideIds: string[]
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: { total: number; completed: number; failed: number }
  error?: string
}

export interface ThumbnailProgressState {
  currentTask: ThumbnailTask | null
  showProgressModal: boolean
  showMiniProgress: boolean
}

export const useThumbnailProgressStore = defineStore('thumbnailProgress', {
  state: (): ThumbnailProgressState => ({
    currentTask: null,
    showProgressModal: false,
    showMiniProgress: false,
  }),

  actions: {
    setTask(task: ThumbnailTask | null) {
      this.currentTask = task
    },
    setShowProgressModal(val: boolean) {
      this.showProgressModal = val
      if (val) this.showMiniProgress = false
    },
    setShowMiniProgress(val: boolean) {
      this.showMiniProgress = val
      if (val) this.showProgressModal = false
    },
    clearTask() {
      this.currentTask = null
      this.showProgressModal = false
      this.showMiniProgress = false
    },
  },
})
