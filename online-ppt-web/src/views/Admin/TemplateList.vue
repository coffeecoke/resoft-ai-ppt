<template>
  <div class="template-list">
    <div class="header">
      <div class="title-area">
        <h2>模板管理</h2>
        <div class="sub-title">
          <span class="count">共 {{ templates.length }} 个</span>
          <span class="dot">·</span>
          <span class="count">当前展示 {{ filteredTemplates.length }} 个</span>
        </div>
      </div>
      <div class="header-actions">
        <Input
          class="search"
          v-model:value="keyword"
          placeholder="搜索模板名称 / 来源 / 分类"
        />
        <Select
          class="status-select"
          v-model:value="filterStatus"
          :options="statusOptions"
        />
        <button class="btn btn-primary" @click="openCreateModal">
          ＋ 新建模板
        </button>
      </div>
    </div>
    
    <div class="content">
      <div v-if="loading" class="placeholder">
        <div class="icon">⏳</div>
        <div class="text">正在加载模板列表...</div>
      </div>

      <div v-else-if="filteredTemplates.length === 0" class="placeholder">
        <div class="icon">📭</div>
        <div class="text">没有找到模板</div>
        <div class="hint">你可以调整筛选条件，或点击右上角“新建模板”开始创建</div>
      </div>

      <div v-else class="grid">
        <div 
          v-for="tpl in filteredTemplates" 
          :key="tpl.id" 
          class="card"
          @click="openEditor(tpl.id)"
        >
          <div class="cover-wrapper">
            <img 
              v-if="tpl.cover" 
              :src="tpl.cover" 
              :alt="tpl.name" 
              class="cover"
              @error="(e) => handleCoverError(e, tpl)"
            />
            <div v-else class="cover cover-placeholder">
              <div class="placeholder-content">
                <div class="placeholder-icon">📋</div>
                <div class="placeholder-text">{{ tpl.name }}</div>
              </div>
            </div>
            <!-- <span class="status-badge" :class="tpl.status || 'draft'">
              {{ statusText(tpl.status) }}
            </span> -->
          </div>
          <div class="info">
            <div class="name" :title="tpl.name">{{ tpl.name }}</div>
            <div class="meta">
              <!-- 底部仅展示发布状态，不再展示来源/分类 -->
              <span
                class="tag status"
                :class="tpl.status || 'draft'"
              >
                {{ statusText(tpl.status) }}
              </span>
              <!-- 删除按钮：仅对未发布的模板显示，放在 info 区域 -->
              <button
                v-if="(tpl.status || 'draft') === 'draft'"
                class="delete-btn-text"
                @click.stop="handleDelete(tpl.id, tpl.name)"
                :disabled="deleting === tpl.id"
              >
                {{ deleting === tpl.id ? '删除中...' : '删除' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建模板对话框 -->
    <Modal
      :visible="showCreate"
      :width="420"
      @closed="closeCreateModal"
    >
      <div class="create-form">
        <div class="dialog-title">新建模板</div>
        <div class="form-item">
          <div class="label">模板名称<span class="required">*</span></div>
          <Input
            v-model:value="createForm.name"
            placeholder="请输入模板名称，如：年终汇报通用模板"
          />
        </div>

        <div class="form-item">
          <div class="label">模板分类</div>
          <Select
            v-model:value="createForm.category"
            :options="categoryOptions"
          />
        </div>

        <div class="form-item">
          <div class="label">初始布局</div>
          <div class="radio-group">
            <label class="radio-item">
              <input
                type="radio"
                value="blank"
                v-model="createForm.initialLayout"
              />
              <span>空白模板（只创建一页空白）</span>
            </label>
            <label class="radio-item">
              <input
                type="radio"
                value="basic"
                v-model="createForm.initialLayout"
              />
              <span>基础结构（封面 + 目录 + 内容 + 结束）</span>
            </label>
          </div>
        </div>

        <div class="form-item">
          <label class="checkbox">
            <input type="checkbox" v-model="createForm.autoPublish" />
            <span>创建后直接标记为已发布</span>
          </label>
        </div>

        <div class="dialog-footer">
          <button class="btn" @click="closeCreateModal">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!createForm.name.trim() || creating"
            @click="handleCreate"
          >
            {{ creating ? '创建中...' : '创建并前往编辑' }}
          </button>
        </div>
      </div>
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { openEditorTab } from '@/utils/openEditor'
import { getTemplateList, createTemplate, deleteTemplate, type TemplateInfo } from '@/services/templateService'
import message from '@/utils/message'
import Modal from '@/components/Modal.vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'

const router = useRouter()

const loading = ref(false)
const templates = ref<TemplateInfo[]>([])
const filterStatus = ref<string>('published') // 默认只看已发布模板
const keyword = ref<string>('')
const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
  { label: '已归档', value: 'archived' },
]
const showCreate = ref(false)
const creating = ref(false)
const deleting = ref<string>('') // 正在删除的模板ID

// 封面图加载失败处理
const handleCoverError = (e: Event, tpl: TemplateInfo) => {
  const target = e.target as HTMLImageElement
  // 隐藏失败的图片，让占位符显示
  target.style.display = 'none'
  // 清空封面字段，触发占位符显示
  tpl.cover = ''
}
const createForm = ref({
  name: '',
  category: 'business',
  initialLayout: 'blank' as 'blank' | 'basic',
  autoPublish: false,
})

const categoryOptions = [
  { label: '商务汇报', value: 'business' },
  { label: '教育培训', value: 'education' },
  { label: '市场运营', value: 'marketing' },
  { label: '其他', value: 'custom' },
]

const statusText = (status?: string) => {
  if (status === 'published') return '已发布'
  if (status === 'archived') return '已归档'
  return '草稿'
}

const filteredTemplates = computed(() => {
  // 先过滤掉无效项（undefined、null 或缺少 id 的项）
  let list = templates.value.filter(t => t && t.id)
  
  if (filterStatus.value) {
    list = list.filter(t => (t.status || 'draft') === filterStatus.value)
  }
  const k = keyword.value.trim().toLowerCase()
  if (k) {
    list = list.filter(t => {
      const name = (t.name || '').toLowerCase()
      const origin = (t.origin || '').toLowerCase()
      const category = (t.category || '').toLowerCase()
      const id = (t.id || '').toLowerCase()
      return (
        name.includes(k) ||
        origin.includes(k) ||
        category.includes(k) ||
        id.includes(k)
      )
    })
  }
  return list
})

const loadTemplates = async () => {
  try {
    loading.value = true
    templates.value = await getTemplateList()
  } catch (error) {
    console.error('[模板管理] 加载模板列表失败:', error)
    message.error('加载模板列表失败')
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  showCreate.value = true
  createForm.value = {
    name: '',
    category: 'business',
    initialLayout: 'blank',
    autoPublish: false,
  }
}

const closeCreateModal = () => {
  if (creating.value) return
  showCreate.value = false
}

const handleCreate = async () => {
  if (!createForm.value.name.trim()) {
    message.error('请填写模板名称')
    return
  }

  try {
    creating.value = true
    const resp = await createTemplate({
      name: createForm.value.name.trim(),
      category: createForm.value.category,
      initialLayout: createForm.value.initialLayout,
    })
    if (!resp?.success || !resp.data?.id) {
      throw new Error(resp?.error || '创建模板失败')
    }
    message.success('模板创建成功')
    await loadTemplates()
    showCreate.value = false
    // 跳转到PPT编辑器页面，复用已打开的页签
    openEditorTab('/ppt/editor', { templateId: resp.data.id }, resp.data.id)
  } catch (error: any) {
    console.error('[模板管理] 创建模板失败:', error)
    message.error(error?.message || '创建模板失败')
  } finally {
    creating.value = false
  }
}

const openEditor = (id: string) => {
  openEditorTab('/ppt/editor', { templateId: id }, id)
}

const handleDelete = async (id: string, name: string) => {
  if (!confirm(`确定要删除模板"${name}"吗？删除后无法恢复。`)) {
    return
  }

  try {
    deleting.value = id
    const resp = await deleteTemplate(id)
    if (!resp?.success) {
      throw new Error(resp?.error || '删除模板失败')
    }
    message.success('模板已删除')
    await loadTemplates()
  } catch (error: any) {
    console.error('[模板管理] 删除模板失败:', error)
    message.error(error?.message || '删除模板失败')
  } finally {
    deleting.value = ''
  }
}

onMounted(() => {
  loadTemplates()
})
</script>

<style lang="scss" scoped>
.template-list {
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

  .status-select {
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
    
    .cover-placeholder {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, rgba($color: $themeColor, $alpha: 0.08), rgba($color: $themeColor, $alpha: 0.03));
      
      .placeholder-content {
        text-align: center;
        
        .placeholder-icon {
          font-size: 32px;
          margin-bottom: 8px;
          opacity: 0.6;
        }
        
        .placeholder-text {
          font-size: 12px;
          color: rgba(17, 24, 39, 0.5);
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .status-badge {
      position: absolute;
      left: 16px;
      top: 16px;
      padding: 3px 10px;
      border-radius: 999px;
      font-size: 11px;
      color: #fff;
      backdrop-filter: blur(6px);
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.15);

      &.draft {
        background: linear-gradient(135deg, rgba(250, 173, 20, 0.95), rgba(250, 173, 20, 0.70));
      }
      &.published {
        background: linear-gradient(135deg, rgba(82, 196, 26, 0.95), rgba(82, 196, 26, 0.70));
      }
      &.archived {
        background: linear-gradient(135deg, rgba(156, 163, 175, 0.95), rgba(156, 163, 175, 0.70));
      }
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
      }

      .status {
        font-weight: 500;

        &.draft {
          color: #f59e0b;
          border-color: rgba(250, 173, 20, 0.45);
          background: rgba(250, 173, 20, 0.06);
        }
        &.published {
          color: #16a34a;
          border-color: rgba(22, 163, 74, 0.45);
          background: rgba(22, 163, 74, 0.06);
        }
        &.archived {
          color: #6b7280;
          border-color: rgba(107, 114, 128, 0.45);
          background: rgba(107, 114, 128, 0.06);
        }
      }

      .delete-btn-text {
        margin-left: auto;
        padding: 0;
        border: none;
        background: transparent;
        color: #ef4444;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.18s ease;
        text-decoration: none;

        &:hover:not(:disabled) {
          color: #dc2626;
          text-decoration: underline;
        }

        &:active:not(:disabled) {
          color: #b91c1c;
        }

        &:disabled {
          color: rgba(239, 68, 68, 0.5);
          cursor: not-allowed;
        }
      }
    }
  }
}

.create-form {
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

  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: rgba(17, 24, 39, 0.78);
    input {
      accent-color: $themeColor;
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


