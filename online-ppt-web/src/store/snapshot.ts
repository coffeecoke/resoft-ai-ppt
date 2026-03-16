import { defineStore } from 'pinia'
import type { IndexableTypeArray } from 'dexie'
import { db, type Snapshot } from '@/utils/database'

import { useSlidesStore } from './slides'
import { useMainStore } from './main'

export interface ScreenState {
  snapshotCursor: number
  snapshotLength: number
  lastEditedSlideId: string | null
}

export const useSnapshotStore = defineStore('snapshot', {
  state: (): ScreenState => ({
    snapshotCursor: -1,
    snapshotLength: 0,
    lastEditedSlideId: null,
  }),

  getters: {
    canUndo(state) {
      return state.snapshotCursor > 0
    },
    canRedo(state) {
      return state.snapshotCursor < state.snapshotLength - 1
    },
  },

  actions: {
    setSnapshotCursor(cursor: number) {
      this.snapshotCursor = cursor
    },
    setSnapshotLength(length: number) {
      this.snapshotLength = length
    },

    async initSnapshotDatabase() {
      const slidesStore = useSlidesStore()
      // 兜底：确保 slides 为数组，避免 JSON.parse(undefined) 报错
      const safeSlides = Array.isArray(slidesStore.slides) ? slidesStore.slides : []
      const newFirstSnapshot = {
        index: slidesStore.slideIndex,
        slides: JSON.parse(JSON.stringify(safeSlides)),
      }
      await db.snapshots.add(newFirstSnapshot)
      this.setSnapshotCursor(0)
      this.setSnapshotLength(1)
    },
  
    async addSnapshot() {
      const slidesStore = useSlidesStore()

      // 记录本次编辑操作涉及的 slideId（用于增量保存感知）
      const currentSlide = slidesStore.slides[slidesStore.slideIndex]
      this.lastEditedSlideId = currentSlide?.id ?? null

      // 获取当前indexeddb中全部快照的ID
      const allKeys = await db.snapshots.orderBy('id').keys()
  
      let needDeleteKeys: IndexableTypeArray = []
  
      // 记录需要删除的快照ID
      // 若当前快照指针不处在最后一位，那么再添加快照时，应该将当前指针位置后面的快照全部删除，对应的实际情况是：
      // 用户撤回多次后，再进行操作（添加快照），此时原先被撤销的快照都应该被删除
      if (this.snapshotCursor >= 0 && this.snapshotCursor < allKeys.length - 1) {
        needDeleteKeys = allKeys.slice(this.snapshotCursor + 1)
      }
  
      // 添加新快照
      const snapshot = {
        index: slidesStore.slideIndex,
        slides: JSON.parse(JSON.stringify(slidesStore.slides)),
      }
      await db.snapshots.add(snapshot)
  
      // 计算当前快照长度，用于设置快照指针的位置（此时指针应该处在最后一位，即：快照长度 - 1）
      let snapshotLength = allKeys.length - needDeleteKeys.length + 1
  
      // 快照数量超过长度限制时，应该将头部多余的快照删除
      const snapshotLengthLimit = 20
      if (snapshotLength > snapshotLengthLimit) {
        needDeleteKeys.push(allKeys[0])
        snapshotLength--
      }
  
      // 快照数大于1时，需要保证撤回操作后维持页面焦点不变：也就是将倒数第二个快照对应的索引设置为当前页的索引
      // https://github.com/pipipi-pikachu/PPTist/issues/27
      if (snapshotLength >= 2) {
        db.snapshots.update(allKeys[snapshotLength - 2] as number, { index: slidesStore.slideIndex })
      }
  
      await db.snapshots.bulkDelete(needDeleteKeys as number[])
  
      this.setSnapshotCursor(snapshotLength - 1)
      this.setSnapshotLength(snapshotLength)
    },
  
    async unDo() {
      if (this.snapshotCursor <= 0) return

      const slidesStore = useSlidesStore()
      const mainStore = useMainStore()
  
      const snapshotCursor = this.snapshotCursor - 1
      const snapshots: Snapshot[] = await db.snapshots.orderBy('id').toArray()
      const snapshot = snapshots[snapshotCursor]
      const { index, slides } = snapshot
  
      const slideIndex = index > slides.length - 1 ? slides.length - 1 : index
  
      slidesStore.setSlides(slides)
      slidesStore.updateSlideIndex(slideIndex)
      this.setSnapshotCursor(snapshotCursor)
      mainStore.setActiveElementIdList([])
    },
  
    async reDo() {
      if (this.snapshotCursor >= this.snapshotLength - 1) return

      const slidesStore = useSlidesStore()
      const mainStore = useMainStore()
  
      const snapshotCursor = this.snapshotCursor + 1
      const snapshots: Snapshot[] = await db.snapshots.orderBy('id').toArray()
      const snapshot = snapshots[snapshotCursor]
      const { index, slides } = snapshot
  
      const slideIndex = index > slides.length - 1 ? slides.length - 1 : index
  
      slidesStore.setSlides(slides)
      slidesStore.updateSlideIndex(slideIndex)
      this.setSnapshotCursor(snapshotCursor)
      mainStore.setActiveElementIdList([])
    },
  },
})