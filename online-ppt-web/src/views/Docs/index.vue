<template>
  <div class="document-list">
    <div class="header">
      <div class="title-area">
        <h2>我的文档</h2>
        <div class="sub-title">
          <span class="count">共 {{ documents.length }} 个</span>
          <span class="dot">·</span>
          <span class="count">当前展示 {{ filteredDocuments.length }} 个</span>
        </div>
      </div>
      <div class="header-actions">
        <Input
          class="search"
          v-model:value="keyword"
          placeholder="搜索文档名称 / 分类"
        />
        <Select
          class="category-select"
          v-model:value="filterCategory"
          :options="categoryOptions"
        />
        <button class="btn btn-primary" @click="openCreateModal">
          ＋ 新建文档
        </button>
      </div>
    </div>
    
    <div class="content">
      <div v-if="loading" class="placeholder">
        <div class="icon">⏳</div>
        <div class="text">正在加载文档列表...</div>
      </div>

      <div v-else-if="filteredDocuments.length === 0" class="placeholder">
        <div class="icon">📭</div>
        <div class="text">没有找到文档</div>
        <div class="hint">你可以调整筛选条件，或点击右上角"新建文档"开始创建</div>
      </div>

      <div v-else class="grid">
        <div 
          v-for="doc in filteredDocuments" 
          :key="doc.id" 
          class="card"
          @click="openEditor(doc.id)"
        >
          <div class="cover-wrapper">
            <img :src="doc.cover" :alt="doc.name" class="cover" />
          </div>
          <div class="info">
            <div class="name" :title="doc.name">{{ doc.name }}</div>
            <div class="meta">
              <span class="tag">{{ formatFileSize(doc.fileSize) }}</span>
              <span class="tag">{{ doc.slideCount }} 页</span>
              <span class="tag category" v-if="doc.category">
                {{ getCategoryName(doc.category) }}
              </span>
              <!-- 操作按钮组 -->
              <div class="actions" @click.stop>
                <button
                  class="action-btn"
                  @click.stop="handleRename(doc.id, doc.name)"
                  title="重命名"
                >
                  重命名
                </button>
                <button
                  class="action-btn"
                  @click.stop="handleDuplicate(doc.id)"
                  :disabled="duplicating === doc.id"
                  title="复制"
                >
                  {{ duplicating === doc.id ? '复制中...' : '复制' }}
                </button>
                <button
                  class="action-btn delete"
                  @click.stop="handleDelete(doc.id, doc.name)"
                  :disabled="deleting === doc.id"
                  title="删除"
                >
                  {{ deleting === doc.id ? '删除中...' : '删除' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建文档对话框 -->
    <Modal
      :visible="showCreate"
      :width="480"
      @closed="closeCreateModal"
    >
      <div class="create-form">
        <div class="dialog-title">新建文档</div>
        
        <div class="form-item">
          <div class="label">创建方式<span class="required">*</span></div>
          <div class="radio-group">
            <label class="radio-item">
              <input
                type="radio"
                value="blank"
                v-model="createForm.createType"
              />
              <span>空白文档（创建一页空白文档）</span>
            </label>
            <label class="radio-item">
              <input
                type="radio"
                value="fromDocument"
                v-model="createForm.createType"
              />
              <span>基于已有文档创建</span>
            </label>
          </div>
        </div>

        <div class="form-item" v-if="createForm.createType === 'fromDocument'">
          <div class="label">选择源文档<span class="required">*</span></div>
          <Select
            v-model:value="createForm.sourceDocumentId"
            :options="sourceDocumentOptions"
            placeholder="请选择要基于的文档"
          />
        </div>

        <div class="form-item">
          <div class="label">文档名称<span class="required">*</span></div>
          <Input
            v-model:value="createForm.name"
            placeholder="请输入文档名称，如：2024年度工作总结"
          />
        </div>

        <div class="form-item">
          <div class="label">文档分类</div>
          <Select
            v-model:value="createForm.category"
            :options="categoryOptions"
          />
        </div>

        <div class="dialog-footer">
          <button class="btn" @click="closeCreateModal">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!canCreate"
            @click="handleCreate"
          >
            {{ creating ? '创建中...' : '创建并前往编辑' }}
          </button>
        </div>
      </div>
    </Modal>

    <!-- 重命名对话框 -->
    <Modal
      :visible="showRename"
      :width="400"
      @closed="closeRenameModal"
    >
      <div class="rename-form">
        <div class="dialog-title">重命名文档</div>
        <div class="form-item">
          <div class="label">文档名称<span class="required">*</span></div>
          <Input
            v-model:value="renameForm.name"
            placeholder="请输入新名称"
            @keyup.enter="handleRenameConfirm"
          />
        </div>
        <div class="dialog-footer">
          <button class="btn" @click="closeRenameModal">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!renameForm.name.trim() || renaming"
            @click="handleRenameConfirm"
          >
            {{ renaming ? '重命名中...' : '确定' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  getDocumentList,
  createDocument,
  deleteDocument,
  duplicateDocument,
  renameDocument,
  type DocumentMetadata,
} from '@/services/documentService'
import message from '@/utils/message'
import Modal from '@/components/Modal.vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'

const router = useRouter()

const loading = ref(false)
const documents = ref<DocumentMetadata[]>([])
const filterCategory = ref<string>('')
const keyword = ref<string>('')
const showCreate = ref(false)
const creating = ref(false)
const deleting = ref<string>('')
const duplicating = ref<string>('')
const showRename = ref(false)
const renaming = ref(false)
const renamingId = ref<string>('')

const createForm = ref({
  createType: 'blank' as 'blank' | 'fromDocument',
  name: '',
  sourceDocumentId: '',
  category: 'uncategorized',
})

const renameForm = ref({
  name: '',
})

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '商务汇报', value: 'business' },
  { label: '教育培训', value: 'education' },
  { label: '市场运营', value: 'marketing' },
  { label: '其他', value: 'uncategorized' },
]

const sourceDocumentOptions = computed(() => {
  return documents.value.map(doc => ({
    label: doc.name,
    value: doc.id,
  }))
})

const getCategoryName = (category: string) => {
  const option = categoryOptions.find(opt => opt.value === category)
  return option?.label || category
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const filteredDocuments = computed(() => {
  let list = documents.value.filter(d => d && d.id)
  
  if (filterCategory.value) {
    list = list.filter(d => d.category === filterCategory.value)
  }
  
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    list = list.filter(d => {
      const name = (d.name || '').toLowerCase()
      const category = (d.category || '').toLowerCase()
      const id = (d.id || '').toLowerCase()
      return name.includes(k) || category.includes(k) || id.includes(k)
    })
  }
  
  // 按更新时间倒序排列（最新的在前）
  return list.sort((a, b) => {
    const timeA = new Date(a.updatedAt).getTime()
    const timeB = new Date(b.updatedAt).getTime()
    return timeB - timeA
  })
})

const canCreate = computed(() => {
  if (!createForm.value.name.trim()) return false
  if (createForm.value.createType === 'fromDocument' && !createForm.value.sourceDocumentId) {
    return false
  }
  return true
})

const loadDocuments = async () => {
  try {
    loading.value = true
    documents.value = await getDocumentList()
  } catch (error: any) {
    console.error('[文档管理] 加载文档列表失败:', error)
    message.error(error?.message || '加载文档列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  showCreate.value = true
  createForm.value = {
    createType: 'blank',
    name: '',
    sourceDocumentId: '',
    category: 'uncategorized',
  }
}

const closeCreateModal = () => {
  if (creating.value) return
  showCreate.value = false
}

const handleCreate = async () => {
  if (!canCreate.value) {
    message.error('请完善必填信息')
    return
  }

  try {
    creating.value = true
    const params: any = {
      name: createForm.value.name.trim(),
      category: createForm.value.category,
    }
    
    if (createForm.value.createType === 'fromDocument') {
      params.sourceDocumentId = createForm.value.sourceDocumentId
    }
    
    const resp = await createDocument(params)
    if (!resp?.success || !resp.data?.id) {
      throw new Error(resp?.error || '创建文档失败')
    }
    
    message.success('文档创建成功')
    await loadDocuments()
    showCreate.value = false
    // 跳转到PPT编辑器页面，通过 URL 参数加载文档
    router.push(`/ppt/editor?documentId=${resp.data.id}`)
  } catch (error: any) {
    console.error('[文档管理] 创建文档失败:', error)
    message.error(error?.message || '创建文档失败')
  } finally {
    creating.value = false
  }
}

const openEditor = (id: string) => {
  router.push(`/ppt/editor?documentId=${id}`)
}

const handleDelete = async (id: string, name: string) => {
  if (!confirm(`确定要删除文档"${name}"吗？删除后无法恢复。`)) {
    return
  }

  try {
    deleting.value = id
    const resp = await deleteDocument(id)
    if (!resp?.success) {
      throw new Error(resp?.error || '删除文档失败')
    }
    message.success('文档已删除')
    await loadDocuments()
  } catch (error: any) {
    console.error('[文档管理] 删除文档失败:', error)
    message.error(error?.message || '删除文档失败')
  } finally {
    deleting.value = ''
  }
}

const handleDuplicate = async (id: string) => {
  try {
    duplicating.value = id
    const resp = await duplicateDocument(id)
    if (!resp?.success || !resp.data?.id) {
      throw new Error(resp?.error || '复制文档失败')
    }
    message.success('文档已复制')
    await loadDocuments()
  } catch (error: any) {
    console.error('[文档管理] 复制文档失败:', error)
    message.error(error?.message || '复制文档失败')
  } finally {
    duplicating.value = ''
  }
}

const handleRename = (id: string, currentName: string) => {
  renamingId.value = id
  renameForm.value.name = currentName
  showRename.value = true
}

const closeRenameModal = () => {
  if (renaming.value) return
  showRename.value = false
  renamingId.value = ''
  renameForm.value.name = ''
}

const handleRenameConfirm = async () => {
  if (!renameForm.value.name.trim() || !renamingId.value) {
    message.error('请输入文档名称')
    return
  }

  try {
    renaming.value = true
    const resp = await renameDocument(renamingId.value, renameForm.value.name.trim())
    if (!resp?.success) {
      throw new Error(resp?.error || '重命名文档失败')
    }
    message.success('文档已重命名')
    await loadDocuments()
    closeRenameModal()
  } catch (error: any) {
    console.error('[文档管理] 重命名文档失败:', error)
    message.error(error?.message || '重命名文档失败')
  } finally {
    renaming.value = false
  }
}

onMounted(() => {
  loadDocuments()
})
</script>

<style lang="scss" scoped>
.document-list {
  max-width: 1240px;
  margin: 0 auto;
  background: #fff;
  border-radius: 12px;
  padding: 20px 20px 24px;
  min-height: calc(100vh - 100px);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
  
  .title-area {
    min-width: 220px;

    h2 {
      font-size: 20px;
      font-weight: 700;
      margin: 0;
      color: #111827;
      letter-spacing: 0.2px;
    }

    .sub-title {
      margin-top: 6px;
      font-size: 12px;
      color: rgba(17, 24, 39, 0.62);
      display: flex;
      align-items: center;
      gap: 8px;

      .dot {
        opacity: 0.6;
      }
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .category-select {
    width: 140px;
  }

  .search {
    width: 260px;
  }

  .btn {
    height: 32px;
    padding: 0 14px;
    border-radius: $borderRadius;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.18s ease;
    border: 1px solid rgba(15, 23, 42, 0.12);
    background: #fff;
    color: rgba(17, 24, 39, 0.86);

    &:hover {
      border-color: rgba($color: $themeColor, $alpha: 0.55);
      color: $themeColor;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
    &:active {
      transform: translateY(0);
      box-shadow: none;
    }
  }

  .btn-primary {
    border-color: rgba($color: $themeColor, $alpha: 0.65);
    background: linear-gradient(135deg, rgba($color: $themeColor, $alpha: 0.92), rgba($color: $themeColor, $alpha: 0.72));
    color: #fff;

    &:hover {
      border-color: rgba($color: $themeColor, $alpha: 0.75);
      color: #fff;
      filter: saturate(1.1);
    }
  }
}

.content {
  .placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 260px;
    color: rgba(17, 24, 39, 0.5);
    
    .icon {
      font-size: 48px;
      margin-bottom: 12px;
    }
    
    .text {
      font-size: 16px;
      margin-bottom: 6px;
      color: rgba(17, 24, 39, 0.78);
    }
    
    .hint {
      font-size: 13px;
      color: rgba(17, 24, 39, 0.48);
    }
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 18px;
  }

  .card {
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    border: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: rgba($color: $themeColor, $alpha: 0.35);
      box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12);
    }
  }

  .cover-wrapper {
    position: relative;
    background: radial-gradient(1200px 400px at 30% 0%, rgba($color: $themeColor, $alpha: 0.10), rgba(15, 23, 42, 0.04));
    padding: 10px;

    .cover {
      width: 100%;
      height: 140px;
      display: block;
      border-radius: 10px;
      background: #fff;
      object-fit: cover;
      border: 1px solid rgba(15, 23, 42, 0.06);
    }
  }

  .info {
    padding: 12px 12px 14px;

    .name {
      font-size: 14px;
      font-weight: 700;
      color: rgba(17, 24, 39, 0.92);
      margin-bottom: 8px;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }

    .meta {
      font-size: 12px;
      color: rgba(17, 24, 39, 0.55);
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;

      .tag {
        padding: 2px 8px;
        border-radius: 999px;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(15, 23, 42, 0.03);
        color: rgba(17, 24, 39, 0.70);
        max-width: 100%;
        @include ellipsis-oneline();
        
        &.category {
          color: $themeColor;
          border-color: rgba($color: $themeColor, $alpha: 0.35);
          background: rgba($color: $themeColor, $alpha: 0.06);
        }
      }

      .actions {
        margin-left: auto;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;

        .action-btn {
          padding: 2px 6px;
          border: none;
          background: transparent;
          color: rgba(17, 24, 39, 0.60);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.18s ease;
          border-radius: 4px;

          &:hover:not(:disabled) {
            background: rgba(15, 23, 42, 0.06);
            color: $themeColor;
          }

          &.delete {
            color: #ef4444;
            &:hover:not(:disabled) {
              background: rgba(239, 68, 68, 0.1);
              color: #dc2626;
            }
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }
    }
  }
}

.create-form,
.rename-form {
  .dialog-title {
    font-size: 16px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .form-item {
    margin-bottom: 14px;
  }

  .label {
    font-size: 13px;
    color: rgba(17, 24, 39, 0.72);
    margin-bottom: 8px;
    .required {
      color: #ef4444;
      margin-left: 4px;
    }
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: rgba(17, 24, 39, 0.78);
    .radio-item {
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
      input {
        accent-color: $themeColor;
      }
    }
  }

  .dialog-footer {
    margin-top: 18px;
    display: flex;
    justify-content: flex-end;
    gap: 10px;

    .btn {
      height: 32px;
      padding: 0 14px;
      border-radius: $borderRadius;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: #fff;
      color: rgba(17, 24, 39, 0.86);
      cursor: pointer;
      transition: all 0.18s ease;

      &:hover {
        border-color: rgba($color: $themeColor, $alpha: 0.55);
        color: $themeColor;
      }

      &.btn-primary {
        border-color: rgba($color: $themeColor, $alpha: 0.65);
        background: linear-gradient(135deg, rgba($color: $themeColor, $alpha: 0.92), rgba($color: $themeColor, $alpha: 0.72));
        color: #fff;
        &:hover {
          color: #fff;
          filter: saturate(1.1);
        }
        &:disabled {
          cursor: not-allowed;
          filter: grayscale(0.2);
          opacity: 0.65;
        }
      }
    }
  }
}
</style>
