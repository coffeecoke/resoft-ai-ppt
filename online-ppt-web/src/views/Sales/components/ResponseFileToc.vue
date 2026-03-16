<template>
  <aside class="response-file-toc">
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
    <!-- 底部操作按钮（参考 PptDialog 的 ppt-thumbs-footer） -->
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
import type { BidSection } from '@/services/bidDocumentService'

interface TreeNode extends BidSection {
  children: TreeNode[]
}

const props = defineProps<{
  tocSections: BidSection[]
  activeSectionId?: string
  selectedSectionIds?: string[]
}>()

const emit = defineEmits<{
  'heading-click': [section: BidSection]
  'add-to-pending': [sections: BidSection[]]
  'download-selected': [sections: BidSection[]]
  'analyze-selected': [sections: BidSection[]]
}>()

const treeRef = ref<any>()
const checkedCount = ref(0)

// 从平铺列表按 parent_section_id 构建树
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

// 勾选变化时更新计数（@check 每次用户操作只触发一次）
const handleCheck = () => {
  checkedCount.value = treeRef.value?.getCheckedKeys()?.length || 0
}

// 同步外部 selectedSectionIds → el-tree 勾选状态（待操作列表变更时联动）
watch(
  () => props.selectedSectionIds,
  (newIds, oldIds) => {
    nextTick(() => {
      if (!treeRef.value) return
      if (!oldIds) {
        // 首次初始化：从 pending store 恢复勾选
        treeRef.value.setCheckedKeys(newIds || [])
      } else {
        // 增量同步：仅处理移除的项（避免覆盖用户本地勾选）
        const newSet = new Set(newIds || [])
        for (const id of oldIds) {
          if (!newSet.has(id)) {
            treeRef.value.setChecked(id, false, true) // deep=true 级联取消子节点
          }
        }
      }
      checkedCount.value = treeRef.value.getCheckedKeys()?.length || 0
    })
  },
  { deep: true, immediate: true }
)

// 同步 activeSectionId 高亮
watch(
  () => props.activeSectionId,
  (key) => {
    nextTick(() => treeRef.value?.setCurrentKey(key || null))
  }
)

const handleLabelClick = (data: BidSection) => {
  emit('heading-click', data)
}

// 获取当前勾选的节点列表（不含半选）
const getCheckedSections = (): BidSection[] => {
  return treeRef.value?.getCheckedNodes(false, false) || []
}

const handleAddToPending = () => {
  // 获取完全选中的 key 集合
  const checkedKeys = new Set<string>(treeRef.value?.getCheckedKeys() || [])
  // getCheckedNodes(false, true) 包含完全选中 + 半选（indeterminate）节点，顺序为 DFS 树序
  const allNodes: BidSection[] = treeRef.value?.getCheckedNodes(false, true) || []

  // 标记每个节点是否为半选（标题行）
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
.response-file-toc {
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
  color: #006DF9;
  font-weight: 500;
}

.toc-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #666;
  background: transparent;
  transition: all 0.2s;
  
  &:hover {
    background: #f5f5f5;
  }
  
  &.active {
    background: #fff;
    color: #006DF9;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }
  
  .mode-icon {
    font-size: 14px;
  }
  
  .mode-text {
    font-size: 12px;
  }
}

.category-group {
  margin-bottom: 5px;
  background: rgba(252, 252, 253, 1);
  border-radius: 10px;
  border: 1px solid #FCFCFD;
}

.category-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: 12px;
  line-height: 1.25rem;
  font-weight: 500;
  color: #3b82f6;
  border-radius: 4px;
  background-color: rgb(241 245 249 / 0.5);
  
  &.clickable {
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background-color: rgb(241 245 249 / 0.8);
    }
  }
}

.category-icon {
  font-size: 16px;
  color: #334155;
}

.category-children {
  padding: 10px;
  margin-top: 0;
}

.category-child-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 1px;
  cursor: pointer;
  border-radius: 10px;
  border: 1px solid rgb(252, 252, 253);
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
  
  &:hover {
    background: #fff;
    border: 1px solid rgb(226 232 240 / 1);
  }
  
  &.active {
    background: rgba(0, 109, 249, 1);
    color: #fff;
    border: 1px solid #006DF9;
    
    .check-icon {
      color: #fff;
    }
    
    .child-name {
      color: #fff;
    }
  }
}

.child-name {
  font-size: 12px;
  flex: 1;
  color: #94a3b8;
}

.check-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #fff;
  border-radius: 50%;
  font-size: 11px;
  color: #006DF9;
  flex-shrink: 0;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 109, 249, 0.3);
}

/* 底部按钮区域 */
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

/* el-tree 样式覆盖 */
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
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 500;
}

/* el-tree 原生 checkbox 样式微调 */
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

/* 一级节点加粗 */
:deep(.el-tree > .el-tree-node > .el-tree-node__content .el-tree-node__label) {
  font-weight: 500;
  color: #1e293b;
}

/* 展开/折叠图标 */
:deep(.el-tree-node__expand-icon) {
  color: #9ca3af;
  font-size: 14px;
}
</style>
