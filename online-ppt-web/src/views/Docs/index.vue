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
          class="status-select"
          v-model:value="filterStatus"
          :options="statusOptions"
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
            <img 
              v-if="doc.cover" 
              :src="doc.cover" 
              :alt="doc.name" 
              class="cover"
              @error="(e) => handleCoverError(e, doc)"
            />
            <div v-else class="cover cover-placeholder">
              <div class="placeholder-content">
                <div class="placeholder-icon">📄</div>
                <div class="placeholder-text">{{ doc.name }}</div>
              </div>
            </div>
          </div>
          <div class="info">
            <div class="name" :title="doc.name">{{ doc.name }}</div>
            <div class="meta">
              <span class="tag">{{ formatFileSize(doc.fileSize) }}</span>
              <span class="tag">{{ doc.slideCount }} 页</span>
              <span class="tag category" v-if="doc.category">
                {{ getCategoryName(doc.category) }}
              </span>
              <span 
                class="tag status" 
                :class="`status-${doc.status || 'draft'}`"
              >
                {{ getStatusName(doc.status || 'draft') }}
              </span>
              <!-- 操作按钮组 -->
              <div class="actions" @click.stop>
                <button
                  class="action-btn"
                  @click.stop="openRenameModal(doc)"
                  title="编辑基础信息"
                >
                  编辑信息
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
            <label class="radio-item">
              <input
                type="radio"
                value="fromPPTX"
                v-model="createForm.createType"
              />
              <span>基于PPT文档创建</span>
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

        <div class="form-item" v-if="createForm.createType === 'fromPPTX'">
          <div class="label">上传PPT文档<span class="required">*</span></div>
          <FileInput
            accept="application/vnd.openxmlformats-officedocument.presentationml.presentation"
            @change="handlePPTXFileChange"
          >
            <div class="upload-area">
              <span v-if="!createForm.pptxFile" class="upload-placeholder">
                <span class="upload-icon">📄</span>
                <span>点击上传PPTX文件</span>
              </span>
              <span v-else class="upload-filename">{{ createForm.pptxFile.name }}</span>
            </div>
          </FileInput>
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

        <div class="form-item">
          <div class="label">客户名称</div>
          <Input
            v-model:value="createForm.customerName"
            placeholder="请输入客户名称"
          />
        </div>

        <div class="form-item">
          <div class="label">产品解决方案</div>
          <SelectMultiple
            v-model:value="createForm.product"
            :options="productOptions"
            placeholder="请选择产品（可多选）"
          />
        </div>

        <div class="form-item">
          <div class="label">行业</div>
          <SelectMultiple
            v-model:value="createForm.industry"
            :options="industryOptions"
            placeholder="请选择行业（可多选）"
          />
        </div>

        <div class="form-item">
          <div class="label">交流对象</div>
          <SelectMultiple
            v-model:value="createForm.audience"
            :options="audienceOptions"
            placeholder="请选择交流对象（可多选）"
          />
        </div>

        <div class="form-item">
          <div class="label">语言</div>
          <Select
            v-model:value="createForm.language"
            :options="languageOptions"
            placeholder="请选择语言"
          />
        </div>

        <div class="dialog-footer">
          <button class="btn" @click="closeCreateModal">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!canCreate || creating || parsing"
            @click="handleCreate"
          >
            <template v-if="parsing">
              {{ parsingMessage }}
            </template>
            <template v-else-if="creating">
              创建中...
            </template>
            <template v-else>
              创建并前往编辑
            </template>
          </button>
        </div>
      </div>
    </Modal>

    <!-- 编辑基础信息对话框 -->
    <Modal
      :visible="showRename"
      :width="500"
      @closed="closeRenameModal"
    >
      <div class="rename-form">
        <div class="dialog-title">编辑基础信息</div>
        
        <div class="form-item">
          <div class="label">文档名称<span class="required">*</span></div>
          <Input
            v-model:value="renameForm.name"
            placeholder="请输入文档名称"
          />
        </div>

        <div class="form-item">
          <div class="label">客户名称</div>
          <Input
            v-model:value="renameForm.customerName"
            placeholder="请输入客户名称"
          />
        </div>

        <div class="form-item">
          <div class="label">产品解决方案</div>
          <SelectMultiple
            v-model:value="renameForm.product"
            :options="productOptions"
            placeholder="请选择产品解决方案"
          />
        </div>

        <div class="form-item">
          <div class="label">行业</div>
          <SelectMultiple
            v-model:value="renameForm.industry"
            :options="industryOptions"
            placeholder="请选择行业"
          />
        </div>

        <div class="form-item">
          <div class="label">交流对象</div>
          <SelectMultiple
            v-model:value="renameForm.audience"
            :options="audienceOptions"
            placeholder="请选择交流对象"
          />
        </div>

        <div class="form-item">
          <div class="label">语言</div>
          <Select
            v-model:value="renameForm.language"
            :options="languageOptions"
            placeholder="请选择语言"
          />
        </div>

        <div class="dialog-footer">
          <button class="btn" @click="closeRenameModal">取消</button>
          <button
            class="btn btn-primary"
            :disabled="!renameForm.name.trim() || renaming"
            @click="handleRenameConfirm"
          >
            {{ renaming ? '保存中...' : '确定' }}
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
  updateDocumentMetadata,
  type DocumentMetadata,
  type UpdateDocumentMetadataParams,
} from '@/services/documentService'
import { PRODUCTS, INDUSTRIES, AUDIENCES, LANGUAGES } from '@/configs/salesConstants'
import { parsePPTXToSlides } from '@/utils/pptxParser'
import message from '@/utils/message'
import Modal from '@/components/Modal.vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'
import SelectMultiple from '@/components/SelectMultiple.vue'
import FileInput from '@/components/FileInput.vue'

const router = useRouter()

const loading = ref(false)
const documents = ref<DocumentMetadata[]>([])
const filterCategory = ref<string>('')
const filterStatus = ref<string>('published')
const keyword = ref<string>('')
const showCreate = ref(false)
const creating = ref(false)
const parsing = ref(false) // PPTX解析状态
const parsingMessage = ref('') // 解析进度消息
const deleting = ref<string>('')
const duplicating = ref<string>('')
const showRename = ref(false)
const renaming = ref(false)
const renamingId = ref<string>('')

// 封面图加载失败处理
const handleCoverError = (e: Event, doc: DocumentMetadata) => {
  const target = e.target as HTMLImageElement
  // 隐藏失败的图片，让占位符显示
  target.style.display = 'none'
  // 清空封面字段，触发占位符显示
  doc.cover = ''
}

const createForm = ref({
  createType: 'blank' as 'blank' | 'fromDocument' | 'fromPPTX',
  name: '',
  sourceDocumentId: '',
  category: 'uncategorized',
  // 新增业务字段
  customerName: '',
  product: [] as string[],      // 多选
  industry: [] as string[],     // 多选
  audience: [] as string[],     // 多选
  language: '',
  // PPTX文件
  pptxFile: null as File | null,
})

const renameForm = ref({
  name: '',
  customerName: '',
  product: [] as string[],
  industry: [] as string[],
  audience: [] as string[],
  language: '',
})

const categoryOptions = [
  { label: '全部分类', value: '' },
  { label: '商务汇报', value: 'business' },
  { label: '教育培训', value: 'education' },
  { label: '市场运营', value: 'marketing' },
  { label: '其他', value: 'uncategorized' },
]

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const sourceDocumentOptions = computed(() => {
  return documents.value.map(doc => ({
    label: doc.name,
    value: doc.id,
  }))
})

// 产品选项（从salesConstants导入）
// 产品选项（多选，不需要"请选择"）
const productOptions = PRODUCTS

// 行业选项（多选，不需要"请选择"）
const industryOptions = INDUSTRIES

// 交流对象选项（多选，不需要"请选择"）
const audienceOptions = AUDIENCES

// 语言选项（单选，保留"请选择"）
const languageOptions = [
  { label: '请选择', value: '' },
  ...LANGUAGES
]

const getCategoryName = (category: string) => {
  const option = categoryOptions.find(opt => opt.value === category)
  return option?.label || category
}

const getStatusName = (status: string) => {
  const option = statusOptions.find(opt => opt.value === status)
  return option?.label || status
}

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const filteredDocuments = computed(() => {
  let list = documents.value.filter(d => d && d.id)
  
  // 状态筛选
  if (filterStatus.value) {
    list = list.filter(d => (d.status || 'draft') === filterStatus.value)
  }
  
  // 分类筛选
  if (filterCategory.value) {
    list = list.filter(d => d.category === filterCategory.value)
  }
  
  // 关键词搜索
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
  if (createForm.value.createType === 'fromPPTX' && !createForm.value.pptxFile) {
    return false
  }
  return true
})

const loadDocuments = async () => {
  try {
    loading.value = true
    // 不传递任何筛选参数，获取所有文档，由前端计算属性进行筛选
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
    customerName: '',
    product: [],      // 多选数组
    industry: [],     // 多选数组
    audience: [],     // 多选数组
    language: '',
    pptxFile: null,
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
    
    let initialSlides = null
    let parsedTheme = null
    
    // 如果是基于PPTX创建，先解析
    if (createForm.value.createType === 'fromPPTX' && createForm.value.pptxFile) {
      try {
        parsing.value = true
        parsingMessage.value = '正在解析PPTX文件，请稍候...'
        
        console.log('[文档管理] 开始解析PPTX文件:', createForm.value.pptxFile.name)
        const { slides, theme } = await parsePPTXToSlides(createForm.value.pptxFile, { 
          fixedViewport: true  // 固定viewport为1000
        })
        initialSlides = slides
        parsedTheme = theme
        
        console.log('[文档管理] PPTX解析完成, slides数量:', slides.length)
        // 计算数据大小
        const dataSize = JSON.stringify(slides).length
        const sizeInMB = (dataSize / (1024 * 1024)).toFixed(2)
        console.log('[文档管理] Slides数据大小:', sizeInMB, 'MB')
        
        if (dataSize > 10 * 1024 * 1024) { // 10MB
          console.warn('[文档管理] 警告：Slides数据较大，可能影响传输性能')
        }
        
        parsingMessage.value = '解析完成，正在创建文档...'
      } catch (error) {
        console.error('[文档管理] PPTX解析失败:', error)
        message.error('PPTX解析失败，请检查文件格式')
        creating.value = false
        parsing.value = false
        return
      } finally {
        parsing.value = false
      }
    }
    
    const params: any = {
      name: createForm.value.name.trim(),
      category: createForm.value.category,
      // 新增业务字段
      customerName: createForm.value.customerName,
      product: createForm.value.product,
      industry: createForm.value.industry,
      audience: createForm.value.audience,
      language: createForm.value.language,
      // 解析后的slides
      initialSlides,
      // 明确标记为公版
      tag: 'public',
    }
    
    if (createForm.value.createType === 'fromDocument') {
      params.sourceDocumentId = createForm.value.sourceDocumentId
    }
    
    console.log('[文档管理] 发送创建文档请求...')
    const resp = await createDocument(params)
    console.log('[文档管理] 创建文档响应:', resp)
    
    if (!resp?.success || !resp.data?.id) {
      throw new Error(resp?.error || '创建文档失败')
    }
    
    message.success('文档创建成功')
    await loadDocuments()
    showCreate.value = false
    
    // 准备传递给编辑器的完整数据
    const documentData = {
      title: createForm.value.name.trim(),
      width: 1000,
      height: 562.5,
      theme: parsedTheme || {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
      },
      slides: initialSlides || [{
        id: `slide_${Date.now()}`,
        elements: [],
      }],
    }
    
    // 跳转到PPT编辑器页面，通过Router State传递数据（优化首次加载）
    router.push({
      path: '/ppt/editor',
      query: { documentId: resp.data.id },
      state: { documentData }
    })
  } catch (error: any) {
    console.error('[文档管理] 创建文档失败:', error)
    message.error(error?.message || '创建文档失败')
  } finally {
    creating.value = false
  }
}

const handlePPTXFileChange = (files: FileList) => {
  if (files && files.length > 0) {
    createForm.value.pptxFile = files[0]
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

// 打开编辑基础信息对话框
const openRenameModal = (doc: DocumentMetadata) => {
  renamingId.value = doc.id
  renameForm.value = {
    name: doc.name,
    customerName: doc.customerName || '',
    product: doc.product || [],
    industry: doc.industry || [],
    audience: doc.audience || [],
    language: doc.language || '',
  }
  showRename.value = true
}

const closeRenameModal = () => {
  if (renaming.value) return
  showRename.value = false
  renamingId.value = ''
  renameForm.value = {
    name: '',
    customerName: '',
    product: [],
    industry: [],
    audience: [],
    language: '',
  }
}

// 确认修改基础信息
const handleRenameConfirm = async () => {
  if (!renameForm.value.name.trim() || !renamingId.value) {
    message.error('请输入文档名称')
    return
  }

  try {
    renaming.value = true
    const params: UpdateDocumentMetadataParams = {
      name: renameForm.value.name.trim(),
      customerName: renameForm.value.customerName,
      product: renameForm.value.product,
      industry: renameForm.value.industry,
      audience: renameForm.value.audience,
      language: renameForm.value.language,
    }
    
    const resp = await updateDocumentMetadata(renamingId.value, params)
    if (!resp?.success) {
      throw new Error(resp?.error || '修改基础信息失败')
    }
    message.success('基础信息已更新')
    await loadDocuments()
    closeRenameModal()
  } catch (error: any) {
    console.error('[文档管理] 修改基础信息失败:', error)
    message.error(error?.message || '修改基础信息失败')
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

  .status-select {
    width: 120px;
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

        &.status {
          font-size: 11px;
          
          &.status-draft {
            color: #6b7280;
            border-color: rgba(107, 114, 128, 0.35);
            background: rgba(107, 114, 128, 0.06);
          }
          
          &.status-published {
            color: #10b981;
            border-color: rgba(16, 185, 129, 0.35);
            background: rgba(16, 185, 129, 0.06);
          }
          
          &.status-archived {
            color: #ef4444;
            border-color: rgba(239, 68, 68, 0.35);
            background: rgba(239, 68, 68, 0.06);
          }
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
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;

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

  .upload-area {
    border: 2px dashed rgba(15, 23, 42, 0.15);
    border-radius: $borderRadius;
    padding: 20px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: rgba(15, 23, 42, 0.02);

    &:hover {
      border-color: rgba($color: $themeColor, $alpha: 0.45);
      background: rgba($color: $themeColor, $alpha: 0.03);
    }

    .upload-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      color: rgba(17, 24, 39, 0.55);
      font-size: 13px;

      .upload-icon {
        font-size: 32px;
        opacity: 0.6;
      }
    }

    .upload-filename {
      color: $themeColor;
      font-size: 13px;
      font-weight: 500;
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
