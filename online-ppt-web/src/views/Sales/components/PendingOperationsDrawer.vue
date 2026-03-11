<template>
  <el-drawer
    v-model="drawerVisible"
    title="待操作列表"
    :size="480"
    direction="rtl"
    :before-close="handleClose"
  >
    <template #header>
      <div class="drawer-header">
        <div class="drawer-title">
          <i class="ri-list-check-3"></i>
          待操作列表
          <span class="drawer-count">({{ pendingStore.pendingList.length }})</span>
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <div v-if="pendingStore.pendingList.length === 0" class="empty-state">
        <i class="ri-inbox-line"></i>
        <p>待操作列表为空</p>
      </div>
      <div v-else>
        <div class="batch-actions">
          <el-button type="primary" @click="handleBatchAnalyze" :disabled="!hasSelectedItems">
            <i class="ri-magic-stick-line"></i>
            批量AI分析
          </el-button>
          <el-button type="success" @click="handleBatchDownload" :disabled="!hasSelectedItems">
            <i class="ri-download-line"></i>
            合并下载
          </el-button>
          <el-button @click="handleClear">
            <i class="ri-delete-bin-line"></i>
            清空
          </el-button>
        </div>

        <div class="pending-list">
          <!-- PPT / video / document 项（原有逻辑） -->
          <template v-if="pendingStore.otherItems.length">
            <div class="section-label">PPT 文档</div>
            <div
              v-for="item in pendingStore.otherItems"
              :key="`${item.id}-${item.type}`"
              class="pending-item"
            >
              <div class="pending-item-checkbox">
                <el-checkbox
                  :model-value="item.selected"
                  @update:model-value="(val) => item.selected = val"
                />
              </div>
              <div class="pending-item-thumb">
                <img :src="item.thumbnail || 'https://picsum.photos/seed/default/100/75'" :alt="item.title" />
                <span class="pending-item-tag" :class="item.tag === '公共版' ? 'tag-public' : 'tag-practical'">
                  {{ item.tag }}
                </span>
              </div>
              <div class="pending-item-info">
                <div class="pending-item-title">{{ item.title }}</div>
                <div class="pending-item-meta">{{ item.date }}</div>
              </div>
              <el-button size="small" text type="danger" @click="handleRemove(item)" class="pending-item-remove">
                <i class="ri-close-line"></i>
              </el-button>
            </div>
          </template>

          <!-- 响应文件章节（按文档分组 + 拖拽排序） -->
          <template v-if="localSections.length">
            <div class="section-label">响应文件章节</div>
            <Draggable
              :list="localSections"
              :animation="200"
              item-key="id"
              handle=".drag-handle"
              @end="onDragEnd"
            >
              <template #item="{ element, index }">
                <div>
                  <!-- 文档分组标题 -->
                  <div v-if="isFirstOfGroup(element, index)" class="doc-group-header">
                    <i class="ri-file-word-line"></i>
                    <span class="doc-group-name">{{ element.documentName }}</span>
                    <el-button size="small" text type="danger" @click="removeDocGroup(element.documentId)">
                      移除全部
                    </el-button>
                  </div>
                  <!-- 章节行 -->
                  <div class="section-item" :style="{ paddingLeft: getIndentPx(element) + 'px' }">
                    <i class="ri-drag-move-line drag-handle"></i>
                    <span class="section-title">{{ element.title }}</span>
                    <el-button size="small" text type="danger" @click="removeSection(element)" class="section-remove">
                      <i class="ri-close-line"></i>
                    </el-button>
                  </div>
                </div>
              </template>
            </Draggable>
          </template>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePendingOperationsStore } from '@/store/Sales/pendingOperations'
import Draggable from 'vuedraggable'

const props = defineProps({
  visible: { type: Boolean, default: false }
})
const emit = defineEmits(['update:visible'])

const pendingStore = usePendingOperationsStore()

const drawerVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value)
})

// 拖拽用的本地副本（vuedraggable 直接修改绑定数组）
const localSections = ref([])

watch(
  () => pendingStore.responseSectionItems,
  (items) => { localSections.value = [...items] },
  { immediate: true, deep: true }
)

const hasSelectedItems = computed(() => {
  return pendingStore.pendingList.some(i => i.selected !== false)
})

// 文档分组判断：当前项与上一项的 documentId 不同时显示标题
const isFirstOfGroup = (element, index) => {
  return index === 0 || localSections.value[index - 1]?.documentId !== element.documentId
}

// 计算每个文档组内的相对缩进层级（组内最小 level 作为基准 0）
const minLevelMap = computed(() => {
  const map = {}
  for (const s of localSections.value) {
    const docId = s.documentId
    const lv = s.level || 1
    if (!(docId in map) || lv < map[docId]) {
      map[docId] = lv
    }
  }
  return map
})

const getIndentPx = (element) => {
  const minLv = minLevelMap.value[element.documentId] || 1
  const relative = (element.level || 1) - minLv
  return relative * 20 + 12 // 基础 12px，每层 +20px
}

const onDragEnd = () => {
  pendingStore.reorderSections(localSections.value)
}

const removeDocGroup = (documentId) => {
  pendingStore.removeDocumentSections(documentId)
  ElMessage.success('已移除该文档所有章节')
}

const removeSection = (element) => {
  pendingStore.removeSectionCascade(element.id)
}

const handleRemove = (item) => {
  pendingStore.removeFromPending(item.id, item.type)
  ElMessage.success('已移除')
}

const handleClose = () => {
  drawerVisible.value = false
}

// 父子去重：如果勾选了父节点，跳过其子节点（父节点 docx 已包含子节点内容）
const filterRedundantChildren = (sections) => {
  const selectedIds = new Set(sections.map(s => s.id))
  return sections
    .filter(s => {
      let parentId = s.parent_section_id
      while (parentId) {
        if (selectedIds.has(parentId)) return false
        const parent = sections.find(p => p.id === parentId)
        parentId = parent?.parent_section_id || null
      }
      return true
    })
    .map(s => s.id)
}

const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空待操作列表吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
    })
    pendingStore.clearPending()
    ElMessage.success('已清空')
  } catch { /* 用户取消 */ }
}

// 初始化 selected
watch(() => pendingStore.pendingList, (list) => {
  list.forEach(item => { if (item.selected === undefined) item.selected = true })
}, { deep: true, immediate: true })

const handleBatchAnalyze = () => {
  const selected = pendingStore.otherItems.filter(i => i.selected !== false)
  if (!selected.length) { ElMessage.warning('请至少选择一个 PPT 项目'); return }
  pendingStore.batchAnalyze(selected)
  ElMessage.success(`开始批量AI分析 ${selected.length} 个项目`)
}

const handleBatchDownload = async () => {
  // PPT 项走原有导出
  const pptItems = pendingStore.otherItems.filter(i => i.selected !== false)
  if (pptItems.length) {
    pendingStore.batchDownload(pptItems)
  }

  // 响应文件章节走 docx 合并下载
  const sectionItems = localSections.value
  if (sectionItems.length) {
    try {
      const { mergeDownloadSections } = await import('../composables/useMergeDownload')
      // 父子去重：父节点 docx 已包含子节点内容，过滤掉被覆盖的子节点
      const filteredIds = filterRedundantChildren(sectionItems)
      await mergeDownloadSections(filteredIds, '合并响应文件')
      ElMessage.success('合并下载成功')
    } catch (err) {
      console.error('[合并下载] 失败:', err)
      ElMessage.error(err.message || '合并下载失败')
    }
  }

  if (!pptItems.length && !sectionItems.length) {
    ElMessage.warning('没有可下载的内容')
  }
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.drawer-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
.drawer-title i { font-size: 20px; color: #2563eb; }
.drawer-count { font-size: 14px; font-weight: 400; color: #6b7280; }

.drawer-content { padding: 0; }

.empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; }
.empty-state i { font-size: 48px; margin-bottom: 16px; display: block; }
.empty-state p { font-size: 14px; margin: 0; }

.batch-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #fafafa;
}
.batch-actions .el-button { flex: 1; }

.pending-list {
  padding: 12px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

/* 区域标签 */
.section-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 4px 4px;
  margin-top: 4px;
}

/* --- PPT 项样式（保持原有） --- */
.pending-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  margin-bottom: 12px;
  align-items: center;
  transition: all 0.2s;
}
.pending-item:hover { border-color: #2563eb; box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1); }
.pending-item-checkbox { flex-shrink: 0; }
.pending-item-thumb { position: relative; width: 100px; height: 75px; flex-shrink: 0; border-radius: 6px; overflow: hidden; background: #f3f4f6; }
.pending-item-thumb img { width: 100%; height: 100%; object-fit: cover; }
.pending-item-tag { position: absolute; top: 4px; left: 4px; font-size: 10px; padding: 2px 6px; border-radius: 4px; color: #fff; font-weight: 600; }
.pending-item-tag.tag-public { background: #FF6A00; }
.pending-item-tag.tag-practical { background: #006DF9; }
.pending-item-info { flex: 1; min-width: 0; }
.pending-item-title { font-size: 14px; font-weight: 500; color: #1f2937; margin-bottom: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pending-item-meta { font-size: 12px; color: #6b7280; }
.pending-item-remove { flex-shrink: 0; padding: 4px; }

/* --- 响应文件分组样式 --- */
.doc-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px;
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
}
.doc-group-header:first-child { margin-top: 0; }
.doc-group-header i { color: #3b82f6; font-size: 16px; }
.doc-group-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.section-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  margin: 2px 0;
  font-size: 13px;
  color: #374151;
  background: #fff;
  border: 1px solid transparent;
  transition: all 0.15s;
  cursor: default;
}
.section-item:hover { background: #f1f5f9; border-color: #e2e8f0; }

.drag-handle {
  cursor: grab;
  color: #9ca3af;
  font-size: 14px;
  flex-shrink: 0;
}
.drag-handle:active { cursor: grabbing; }

.section-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-remove { flex-shrink: 0; padding: 2px; }

/* 拖拽中样式 */
:deep(.sortable-ghost) {
  opacity: 0.4;
  background: #dbeafe;
  border: 1px dashed #3b82f6;
  border-radius: 4px;
}
:deep(.sortable-chosen) {
  background: #eff6ff;
}
</style>
