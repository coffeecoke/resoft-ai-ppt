<template>
  <el-drawer
    v-model="drawerVisible"
    title="响应文件章节"
    :size="480"
    direction="rtl"
    :before-close="handleClose"
  >
    <template #header>
      <div class="drawer-header">
        <div class="drawer-title">
          <i class="ri-file-list-3-line"></i>
          响应文件章节
          <span class="drawer-count">({{ realCount }})</span>
        </div>
      </div>
    </template>

    <div class="drawer-content">
      <div v-if="!store.sectionList.length" class="empty-state">
        <i class="ri-inbox-line"></i>
        <p>暂无选中章节</p>
      </div>
      <div v-else>
        <div class="batch-actions">
          <el-button type="success" @click="handleMergeDownload" :loading="downloading">
            <i class="ri-download-line"></i>
            合并下载
          </el-button>
          <el-button @click="handleClear">
            <i class="ri-delete-bin-line"></i>
            清空
          </el-button>
        </div>

        <div class="section-list">
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
                <!-- 标题行（半选父级，不可拖拽不可删除） -->
                <div
                  v-if="element.isHeaderOnly"
                  class="section-item section-item--header"
                  :style="{ paddingLeft: getIndentPx(element) + 'px' }"
                >
                  <i class="ri-bookmark-line header-icon"></i>
                  <span class="section-title">{{ element.title }}</span>
                </div>
                <!-- 正常章节行 -->
                <div
                  v-else
                  class="section-item"
                  :style="{ paddingLeft: getIndentPx(element) + 'px' }"
                >
                  <i class="ri-drag-move-line drag-handle"></i>
                  <span class="section-title">{{ element.title }}</span>
                  <el-button size="small" text type="danger" @click="removeSection(element)" class="section-remove">
                    <i class="ri-close-line"></i>
                  </el-button>
                </div>
              </div>
            </template>
          </Draggable>
        </div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useResponseSectionStore } from '@/store/Sales/responseSectionStore'
import Draggable from 'vuedraggable'

const props = defineProps({ visible: { type: Boolean, default: false } })
const emit = defineEmits(['update:visible'])

const store = useResponseSectionStore()
const downloading = ref(false)

const drawerVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const handleClose = () => { drawerVisible.value = false }

// 本地副本供 vuedraggable 操作
const localSections = ref([])

watch(
  () => store.sectionList,
  (items) => { localSections.value = [...items] },
  { immediate: true, deep: true }
)

// 真实章节数（排除标题行）
const realCount = computed(() => store.sectionList.filter(s => !s.isHeaderOnly).length)

// 文档分组判断
const isFirstOfGroup = (element, index) =>
  index === 0 || localSections.value[index - 1]?.documentId !== element.documentId

// 组内最小 level 作为基准，计算相对缩进
const minLevelMap = computed(() => {
  const map = {}
  for (const s of localSections.value) {
    const lv = s.level || 1
    if (!(s.documentId in map) || lv < map[s.documentId]) map[s.documentId] = lv
  }
  return map
})

const getIndentPx = (el) => {
  const minLv = minLevelMap.value[el.documentId] || 1
  return ((el.level || 1) - minLv) * 20 + 12
}

const onDragEnd = () => { store.reorderSections(localSections.value) }

const removeDocGroup = (documentId) => {
  store.removeDocumentSections(documentId)
  ElMessage.success('已移除该文档所有章节')
}

const removeSection = (element) => { store.removeSectionCascade(element.id) }

const handleClear = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有响应文件章节吗？', '提示', {
      confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
    })
    store.clearSections()
    ElMessage.success('已清空')
  } catch { /* 用户取消 */ }
}

// 父子去重：父节点已包含子节点内容，跳过子节点
function filterRedundantChildren(sections) {
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

const handleMergeDownload = async () => {
  const items = localSections.value
  if (!items.length) { ElMessage.warning('没有可下载的章节'); return }

  downloading.value = true
  try {
    const { mergeDownloadSections } = await import('../composables/useMergeDownload')

    const realSections = items.filter(s => !s.isHeaderOnly)
    const filteredRealIds = filterRedundantChildren(realSections)

    const orderedSections = items
      .filter(s => s.isHeaderOnly || filteredRealIds.includes(s.id))
      .map(s => ({ id: s.id, headerOnly: s.isHeaderOnly || false, title: s.title, level: s.level }))

    await mergeDownloadSections(orderedSections, '合并响应文件')
    ElMessage.success('合并下载成功')
  } catch (err) {
    ElMessage.error(err.message || '合并下载失败')
  } finally {
    downloading.value = false
  }
}
</script>

<style scoped>
.drawer-header {
  display: flex;
  align-items: center;
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

.section-list {
  padding: 12px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

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

.section-item--header {
  color: #6b7280;
  font-style: italic;
  border-left: 2px solid #d1d5db;
}
.header-icon { color: #9ca3af; font-size: 13px; flex-shrink: 0; }

.drag-handle {
  cursor: grab;
  color: #9ca3af;
  font-size: 14px;
  flex-shrink: 0;
}
.drag-handle:active { cursor: grabbing; }

.section-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.section-remove { flex-shrink: 0; padding: 2px; }

:deep(.sortable-ghost) {
  opacity: 0.4;
  background: #dbeafe;
  border: 1px dashed #3b82f6;
  border-radius: 4px;
}
:deep(.sortable-chosen) { background: #eff6ff; }
</style>
