<template>
  <aside class="tender-file-toc">
    <div class="toc-header">
      <h3 class="sidebar-title">文档目录</h3>
      <span v-if="checkedCount > 0" class="checked-count">已选{{ checkedCount }}</span>
    </div>
    <div class="toc-content">
      <div v-if="!treeData.length" class="toc-empty">
        <span>暂无目录</span>
      </div>
      <el-tree
        v-else
        ref="treeRef"
        :data="treeData"
        :props="{ label: 'title', children: 'children' }"
        node-key="id"
        default-expand-all
        highlight-current
        show-checkbox
        :check-on-click-node="false"
        :current-node-key="activeSectionId"
        @check="handleCheck"
        class="toc-tree"
      >
        <template #default="{ data }">
          <span class="toc-label" @click.stop="handleLabelClick(data)">{{ data.title }}</span>
        </template>
      </el-tree>
    </div>
    <div v-if="treeData.length" class="toc-footer">
      <el-button size="small" :disabled="checkedCount === 0" @click="handleAiAnalyze">
        <i class="ri-magic-stick-line"></i> 选中-AI分析
      </el-button>
      <el-button size="small" :disabled="checkedCount === 0" @click="handleDownload">
        <i class="ri-download-line"></i> 选中-下载
      </el-button>
      <el-button size="small" type="primary" :disabled="checkedCount === 0" @click="handleAddToPending">
        <i class="ri-list-check-3"></i> 选中-待操作
      </el-button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { TenderSection } from '@/services/tenderDocumentService'

interface TreeNode extends TenderSection {
  children: TreeNode[]
}

const props = defineProps<{
  tocSections: TenderSection[]
  activeSectionId?: string
  selectedSectionIds?: string[]
}>()

const emit = defineEmits<{
  'heading-click': [section: TenderSection]
  'add-to-pending': [sections: TenderSection[]]
  'download-selected': [sections: TenderSection[]]
  'analyze-selected': [sections: TenderSection[]]
}>()

const treeRef = ref<any>()
const checkedCount = ref(0)

const treeData = computed((): TreeNode[] => {
  const map = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const s of props.tocSections) {
    map.set(s.id, { ...s, children: [] })
  }

  for (const s of props.tocSections) {
    const node = map.get(s.id)!
    if (s.parent_section_id && map.has(s.parent_section_id)) {
      map.get(s.parent_section_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function sortNodes(nodes: TreeNode[]) {
    nodes.sort((a, b) => a.sort_order - b.sort_order)
    for (const n of nodes) {
      if (n.children.length) sortNodes(n.children)
    }
  }
  sortNodes(roots)

  return roots
})

const handleCheck = () => {
  checkedCount.value = treeRef.value?.getCheckedKeys()?.length || 0
}

watch(
  () => props.selectedSectionIds,
  (newIds, oldIds) => {
    nextTick(() => {
      if (!treeRef.value) return
      if (!oldIds) {
        treeRef.value.setCheckedKeys(newIds || [])
      } else {
        const newSet = new Set(newIds || [])
        for (const id of oldIds) {
          if (!newSet.has(id)) {
            treeRef.value.setChecked(id, false, true)
          }
        }
      }
      checkedCount.value = treeRef.value.getCheckedKeys()?.length || 0
    })
  },
  { deep: true, immediate: true }
)

watch(
  () => props.activeSectionId,
  (key) => {
    nextTick(() => treeRef.value?.setCurrentKey(key || null))
  }
)

const handleLabelClick = (data: TenderSection) => {
  emit('heading-click', data)
}

const getCheckedSections = (): TenderSection[] => {
  return treeRef.value?.getCheckedNodes(false, false) || []
}

const handleAddToPending = () => {
  const checkedKeys = new Set<string>(treeRef.value?.getCheckedKeys() || [])
  const allNodes: TenderSection[] = treeRef.value?.getCheckedNodes(false, true) || []

  const sections = allNodes.map(node => ({
    ...node,
    isHeaderOnly: !checkedKeys.has(node.id),
  }))

  if (!sections.length) return
  emit('add-to-pending', sections)
}

const handleDownload = () => {
  const sections = getCheckedSections()
  if (!sections.length) return
  emit('download-selected', sections)
}

const handleAiAnalyze = () => {
  const sections = getCheckedSections()
  if (!sections.length) return
  emit('analyze-selected', sections)
}
</script>

<style scoped>
.tender-file-toc {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toc-header {
  flex-shrink: 0;
  padding: 10px 16px 8px 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar-title {
  font-size: 13px;
  line-height: 1.5;
  color: #1e293b;
  font-weight: 600;
  margin: 0;
}

.checked-count {
  font-size: 12px;
  color: #f36f6f;
  font-weight: 500;
}

.toc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.toc-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 120px;
  font-size: 12px;
  color: #9ca3af;
}

.toc-footer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #f0f0f0;
}

.toc-footer .el-button {
  width: 100%;
  margin: 0;
}

.toc-tree {
  --el-tree-node-hover-bg-color: #f1f5f9;
  --el-tree-node-content-height: auto;
  font-size: 12px;
  color: #374151;
}

:deep(.el-tree-node__content) {
  align-items: flex-start;
  padding: 4px 6px;
  height: auto;
  min-height: 28px;
  border-radius: 4px;
  margin: 1px 4px;
  line-height: 1.4;
}

:deep(.el-tree-node__content:hover) {
  background: #f1f5f9;
}

:deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: #fff3f3;
  color: #c0392b;
  font-weight: 500;
}

:deep(.el-checkbox__inner) {
  width: 14px;
  height: 14px;
}

:deep(.el-checkbox) {
  margin-right: 4px;
  flex-shrink: 0;
}

:deep(.el-tree-node__label) {
  font-size: 12px;
  white-space: normal;
  word-break: break-all;
  padding: 2px 0;
}

.toc-label {
  font-size: 12px;
  white-space: normal;
  word-break: break-all;
  padding: 2px 0;
  cursor: pointer;
  flex: 1;
}

:deep(.el-tree > .el-tree-node > .el-tree-node__content .el-tree-node__label) {
  font-weight: 500;
  color: #1e293b;
}

:deep(.el-tree-node__expand-icon) {
  color: #9ca3af;
  font-size: 14px;
}
</style>
