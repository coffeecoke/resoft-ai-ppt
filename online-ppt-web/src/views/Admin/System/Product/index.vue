<template>
  <div class="product-management admin-page">
    <el-card class="admin-card" shadow="never">
      <!-- 搜索区域 -->
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="产品名称">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入产品名称或代码"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="产品分类">
          <el-input
            v-model="queryParams.category"
            placeholder="请输入产品分类"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="启用状态">
          <el-select v-model="queryParams.is_active" placeholder="启用状态" clearable style="width: 120px">
            <el-option label="启用" :value="true" />
            <el-option label="停用" :value="false" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">
            <el-icon><Search /></el-icon>
            搜索
          </el-button>
          <el-button @click="resetQuery">
            <el-icon><Refresh /></el-icon>
            重置
          </el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
          <el-button
            type="info"
            plain
            :disabled="selectedProducts.length !== 1"
            @click="handleBatchEdit"
          >
            <el-icon><Edit /></el-icon>
            修改
          </el-button>
          <el-button
            type="danger"
            plain
            :disabled="selectedProducts.length === 0"
            @click="handleBatchDelete"
          >
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
        </div>
        <div class="toolbar-right">
          <el-button circle @click="handleQuery" title="刷新">
            <el-icon><Refresh /></el-icon>
          </el-button>
        </div>
      </div>

      <!-- 表格区域 -->
      <el-table
        v-loading="loading"
        :data="productList"
        border
        class="admin-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <!-- <el-table-column label="产品编号" prop="id" width="180" :show-overflow-tooltip="true" /> -->
        <el-table-column label="产品名称" prop="name" :show-overflow-tooltip="true" />
        <el-table-column label="产品代码" prop="code" width="150" :show-overflow-tooltip="true" />
        <el-table-column label="产品分类" prop="category" width="120" :show-overflow-tooltip="true" />
        <el-table-column label="重点产品" align="center" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.is_featured"
              @change="handleFeaturedChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="启用状态" align="center" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.is_active"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="排序" prop="sort_order" width="80" align="center" />
        <el-table-column label="创建时间" prop="created_at" width="180" />
        <el-table-column label="操作" align="center" width="150" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="queryParams.page"
          v-model:page-size="queryParams.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleQuery"
          @current-change="handleQuery"
        />
      </div>
    </el-card>

    <!-- 产品表单对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="formTitle"
      width="600px"
      class="admin-dialog"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="产品名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="产品代码" prop="code">
          <el-input v-model="form.code" placeholder="请输入产品代码" />
        </el-form-item>
        <el-form-item label="产品描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入产品描述" />
        </el-form-item>
        <el-form-item label="产品分类" prop="category">
          <el-input v-model="form.category" placeholder="请输入产品分类" />
        </el-form-item>
        <el-form-item label="产品图标" prop="icon">
          <el-input v-model="form.icon" placeholder="请输入产品图标URL" />
        </el-form-item>
        <el-form-item label="封面图" prop="cover">
          <el-input v-model="form.cover" placeholder="请输入封面图URL" />
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="重点产品" prop="is_featured">
          <el-switch v-model="form.is_featured" />
        </el-form-item>
        <el-form-item label="启用状态" prop="is_active">
          <el-radio-group v-model="form.is_active">
            <el-radio :label="true">启用</el-radio>
            <el-radio :label="false">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh, Plus, Edit, Delete } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import {
  getProductList,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product,
  type ProductListParams
} from '@/services/admin/productService'

// 查询参数
const queryParams = reactive<ProductListParams>({
  page: 1,
  pageSize: 20,
  keyword: '',
  category: '',
  is_active: undefined
})

// 列表数据
const loading = ref(false)
const productList = ref<Product[]>([])
const total = ref(0)
const selectedProducts = ref<Product[]>([])

// 表单相关
const formVisible = ref(false)
const formTitle = ref('')
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  name: '',
  code: '',
  description: '',
  category: '',
  icon: '',
  cover: '',
  sort_order: 0,
  is_active: true,
  is_featured: false
})

const formRules: FormRules = {
  name: [{ required: true, message: '请输入产品名称', trigger: 'blur' }]
}

// 加载产品列表
const loadProductList = async () => {
  try {
    loading.value = true
    const result = await getProductList(queryParams)
    productList.value = result.list
    total.value = result.total
  } catch (error: any) {
    ElMessage.error(error.message || '加载产品列表失败')
  } finally {
    loading.value = false
  }
}

// 搜索
const handleQuery = () => {
  queryParams.page = 1
  loadProductList()
}

// 重置搜索
const resetQuery = () => {
  queryParams.keyword = ''
  queryParams.category = ''
  queryParams.is_active = undefined
  handleQuery()
}

// 选择变化
const handleSelectionChange = (selection: Product[]) => {
  selectedProducts.value = selection
}

// 新增
const handleCreate = () => {
  formTitle.value = '新增产品'
  resetForm()
  formVisible.value = true
}

// 修改
const handleEdit = (row: Product) => {
  formTitle.value = '修改产品'
  Object.assign(form, row)
  formVisible.value = true
}

// 批量修改
const handleBatchEdit = () => {
  if (selectedProducts.value.length === 1) {
    handleEdit(selectedProducts.value[0])
  }
}

// 删除
const handleDelete = async (row: Product) => {
  try {
    await ElMessageBox.confirm(`确定要删除产品"${row.name}"吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await deleteProduct(row.id)
    ElMessage.success('删除成功')
    loadProductList()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedProducts.value.length} 个产品吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    for (const product of selectedProducts.value) {
      await deleteProduct(product.id)
    }
    ElMessage.success('删除成功')
    loadProductList()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 重点产品状态变化
const handleFeaturedChange = async (row: Product) => {
  try {
    await updateProduct(row.id, { is_featured: row.is_featured })
    ElMessage.success('更新成功')
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
    row.is_featured = !row.is_featured
  }
}

// 启用状态变化
const handleStatusChange = async (row: Product) => {
  try {
    await updateProduct(row.id, { is_active: row.is_active })
    ElMessage.success('更新成功')
  } catch (error: any) {
    ElMessage.error(error.message || '更新失败')
    row.is_active = !row.is_active
  }
}

// 提交表单
const handleSubmit = async () => {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    if (form.id) {
      await updateProduct(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await createProduct(form)
      ElMessage.success('创建成功')
    }
    formVisible.value = false
    loadProductList()
  } catch (error: any) {
    if (error.message) {
      ElMessage.error(error.message)
    }
  }
}

// 重置表单
const resetForm = () => {
  form.id = ''
  form.name = ''
  form.code = ''
  form.description = ''
  form.category = ''
  form.icon = ''
  form.cover = ''
  form.sort_order = 0
  form.is_active = true
  form.is_featured = false
  formRef.value?.clearValidate()
}

// 初始化
onMounted(() => {
  loadProductList()
})
</script>

<style scoped lang="scss">
.product-management {
  .search-form {
    margin-bottom: 16px;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;

    .toolbar-left {
      display: flex;
      gap: 8px;
    }
  }

  .operation-buttons {
    display: flex;
    justify-content: center;
    gap: 8px;
  }

  .pagination-wrapper {
    margin-top: 16px;
    display: flex;
    justify-content: flex-end;
  }
}
</style>
