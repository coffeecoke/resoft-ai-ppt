<template>
  <div class="dict-management admin-page">
    <el-card class="admin-card" shadow="never">
      <!-- 搜索区域 -->
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="字典名称">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入字典名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="字典状态" clearable style="width: 120px">
            <el-option label="正常" value="0" />
            <el-option label="停用" value="1" />
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
          <el-button type="primary" @click="handleCreateDictType">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
          <el-button 
            type="info" 
            plain 
            :disabled="selectedDictTypes.length !== 1"
            @click="handleBatchEditDictType"
          >
            <el-icon><Edit /></el-icon>
            修改
          </el-button>
          <el-button 
            type="danger" 
            plain 
            :disabled="selectedDictTypes.length === 0"
            @click="handleBatchDeleteDictType"
          >
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
          <el-button type="warning" plain @click="handleExport">
            <el-icon><Download /></el-icon>
            导出
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
        :data="dictTypeList" 
        border 
        class="admin-table"
        @selection-change="handleDictTypeSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="字典名称" prop="dict_name" :show-overflow-tooltip="true" />
        <el-table-column label="字典类型" prop="dict_type" :show-overflow-tooltip="true" />
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="0"
              inactive-value="1"
              @change="handleDictTypeStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="字典数据" prop="dataCount" width="100" align="center" />
        <el-table-column label="备注" prop="remark" :show-overflow-tooltip="true" />
        <el-table-column label="创建时间" prop="created_at" width="180" />
        <el-table-column label="操作" align="center" width="200" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button link type="primary" size="small" @click="handleViewDictData(row)">
                <el-icon><View /></el-icon>
                数据
              </el-button>
              <el-button link type="primary" size="small" @click="handleEditDictType(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button link type="danger" size="small" @click="handleDeleteDictType(row)">
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

    <!-- 字典数据管理对话框 -->
    <el-dialog
      v-model="dictDataDialogVisible"
      :title="`字典数据管理 - ${currentDictType?.dict_name || ''}`"
      width="800px"
      class="admin-dialog"
      @close="handleCloseDictDataDialog"
    >
      <div class="dict-data-header">
        <el-button type="primary" @click="handleCreateDictData">
          <el-icon><Plus /></el-icon>
          新增
        </el-button>
      </div>

      <el-table v-loading="dictDataLoading" :data="dictDataList" border class="admin-table">
        <el-table-column label="字典标签" prop="dict_label" />
        <el-table-column label="字典值" prop="dict_value" />
        <el-table-column label="排序" prop="dict_sort" width="80" align="center" />
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="0"
              inactive-value="1"
              @change="handleDictDataStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="150">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button link type="primary" size="small" @click="handleEditDictData(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button link type="danger" size="small" @click="handleDeleteDictData(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 字典类型表单对话框 -->
    <el-dialog
      v-model="dictTypeFormVisible"
      :title="dictTypeFormTitle"
      width="600px"
      class="admin-dialog"
      @close="resetDictTypeForm"
    >
      <el-form ref="dictTypeFormRef" :model="dictTypeForm" :rules="dictTypeFormRules" label-width="100px">
        <el-form-item label="字典类型" prop="dict_type">
          <el-input v-model="dictTypeForm.dict_type" placeholder="请输入字典类型" :disabled="!!dictTypeForm.id" />
        </el-form-item>
        <el-form-item label="字典名称" prop="dict_name">
          <el-input v-model="dictTypeForm.dict_name" placeholder="请输入字典名称" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="dictTypeForm.status">
            <el-radio label="0">正常</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="排序" prop="sort_order">
          <el-input-number v-model="dictTypeForm.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="dictTypeForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictTypeFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDictTypeForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 字典数据表单对话框 -->
    <el-dialog
      v-model="dictDataFormVisible"
      :title="dictDataFormTitle"
      width="600px"
      class="admin-dialog"
      @close="resetDictDataForm"
    >
      <el-form ref="dictDataFormRef" :model="dictDataForm" :rules="dictDataFormRules" label-width="100px">
        <el-form-item label="字典标签" prop="dict_label">
          <el-input v-model="dictDataForm.dict_label" placeholder="请输入字典标签" />
        </el-form-item>
        <el-form-item label="字典值" prop="dict_value">
          <el-input v-model="dictDataForm.dict_value" placeholder="请输入字典值" />
        </el-form-item>
        <el-form-item label="排序" prop="dict_sort">
          <el-input-number v-model="dictDataForm.dict_sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="dictDataForm.status">
            <el-radio label="0">正常</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="是否默认" prop="is_default">
          <el-radio-group v-model="dictDataForm.is_default">
            <el-radio label="Y">是</el-radio>
            <el-radio label="N">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="dictDataForm.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dictDataFormVisible = false">取消</el-button>
        <el-button type="primary" @click="submitDictDataForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete, View, Download } from '@element-plus/icons-vue'
import {
  getDictTypeList,
  createDictType,
  updateDictType,
  deleteDictType,
  getDictDataList,
  createDictData,
  updateDictData,
  deleteDictData,
  type DictType,
  type DictData
} from '@/services/admin/dictService'

// 查询参数
const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
})

// 字典类型列表
const loading = ref(false)
const dictTypeList = ref<DictType[]>([])
const total = ref(0)
const selectedDictTypes = ref<DictType[]>([])

// 字典数据相关
const dictDataDialogVisible = ref(false)
const dictDataLoading = ref(false)
const dictDataList = ref<DictData[]>([])
const currentDictType = ref<DictType | null>(null)

// 字典类型表单
const dictTypeFormVisible = ref(false)
const dictTypeFormTitle = ref('新增字典类型')
const dictTypeFormRef = ref<FormInstance>()
const dictTypeForm = reactive({
  id: '',
  dict_type: '',
  dict_name: '',
  status: '0',
  sort_order: 0,
  remark: ''
})

const dictTypeFormRules: FormRules = {
  dict_type: [{ required: true, message: '字典类型不能为空', trigger: 'blur' }],
  dict_name: [{ required: true, message: '字典名称不能为空', trigger: 'blur' }]
}

// 字典数据表单
const dictDataFormVisible = ref(false)
const dictDataFormTitle = ref('新增字典数据')
const dictDataFormRef = ref<FormInstance>()
const dictDataForm = reactive({
  id: '',
  dict_type: '',
  dict_label: '',
  dict_value: '',
  dict_sort: 0,
  status: '0',
  is_default: 'N',
  remark: ''
})

const dictDataFormRules: FormRules = {
  dict_label: [{ required: true, message: '字典标签不能为空', trigger: 'blur' }],
  dict_value: [{ required: true, message: '字典值不能为空', trigger: 'blur' }]
}

// 查询字典类型列表
const handleQuery = async () => {
  loading.value = true
  try {
    const result = await getDictTypeList(queryParams)
    dictTypeList.value = result.list
    total.value = result.total
  } catch (error: any) {
    ElMessage.error(error.message || '查询失败')
  } finally {
    loading.value = false
  }
}

// 重置查询
const resetQuery = () => {
  queryParams.page = 1
  queryParams.pageSize = 20
  queryParams.keyword = ''
  queryParams.status = ''
  handleQuery()
}

// 新增字典类型
const handleCreateDictType = () => {
  dictTypeFormTitle.value = '新增字典类型'
  resetDictTypeForm()
  dictTypeFormVisible.value = true
}

// 编辑字典类型
const handleEditDictType = (row: DictType) => {
  dictTypeFormTitle.value = '修改字典类型'
  Object.assign(dictTypeForm, {
    id: row.id,
    dict_type: row.dict_type,
    dict_name: row.dict_name,
    status: row.status,
    sort_order: row.sort_order,
    remark: row.remark || ''
  })
  dictTypeFormVisible.value = true
}

// 提交字典类型表单
const submitDictTypeForm = async () => {
  if (!dictTypeFormRef.value) return
  
  await dictTypeFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (dictTypeForm.id) {
          await updateDictType(dictTypeForm.id, dictTypeForm)
          ElMessage.success('修改成功')
        } else {
          await createDictType(dictTypeForm)
          ElMessage.success('新增成功')
        }
        dictTypeFormVisible.value = false
        handleQuery()
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      }
    }
  })
}

// 重置字典类型表单
const resetDictTypeForm = () => {
  Object.assign(dictTypeForm, {
    id: '',
    dict_type: '',
    dict_name: '',
    status: '0',
    sort_order: 0,
    remark: ''
  })
  dictTypeFormRef.value?.resetFields()
}

// 删除字典类型
const handleDeleteDictType = async (row: DictType) => {
  try {
    await ElMessageBox.confirm(`确定要删除字典类型"${row.dict_name}"吗？`, '提示', {
      type: 'warning'
    })
    await deleteDictType(row.id)
    ElMessage.success('删除成功')
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 查看字典数据
const handleViewDictData = async (row: DictType) => {
  currentDictType.value = row
  dictDataDialogVisible.value = true
  await loadDictDataList(row.dict_type)
}

// 加载字典数据列表
const loadDictDataList = async (dictType: string) => {
  dictDataLoading.value = true
  try {
    const result = await getDictDataList({
      dict_type: dictType,
      page: 1,
      pageSize: 100
    })
    dictDataList.value = result.list
  } catch (error: any) {
    ElMessage.error(error.message || '查询失败')
  } finally {
    dictDataLoading.value = false
  }
}

// 关闭字典数据对话框
const handleCloseDictDataDialog = () => {
  currentDictType.value = null
  dictDataList.value = []
}

// 新增字典数据
const handleCreateDictData = () => {
  if (!currentDictType.value) return
  dictDataFormTitle.value = '新增字典数据'
  resetDictDataForm()
  dictDataForm.dict_type = currentDictType.value.dict_type
  dictDataFormVisible.value = true
}

// 编辑字典数据
const handleEditDictData = (row: DictData) => {
  dictDataFormTitle.value = '修改字典数据'
  Object.assign(dictDataForm, {
    id: row.id,
    dict_type: row.dict_type,
    dict_label: row.dict_label,
    dict_value: row.dict_value,
    dict_sort: row.dict_sort,
    status: row.status,
    is_default: row.is_default,
    remark: row.remark || ''
  })
  dictDataFormVisible.value = true
}

// 提交字典数据表单
const submitDictDataForm = async () => {
  if (!dictDataFormRef.value) return
  
  await dictDataFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (dictDataForm.id) {
          await updateDictData(dictDataForm.id, dictDataForm)
          ElMessage.success('修改成功')
        } else {
          await createDictData(dictDataForm)
          ElMessage.success('新增成功')
        }
        dictDataFormVisible.value = false
        if (currentDictType.value) {
          await loadDictDataList(currentDictType.value.dict_type)
        }
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      }
    }
  })
}

// 重置字典数据表单
const resetDictDataForm = () => {
  Object.assign(dictDataForm, {
    id: '',
    dict_type: '',
    dict_label: '',
    dict_value: '',
    dict_sort: 0,
    status: '0',
    is_default: 'N',
    remark: ''
  })
  dictDataFormRef.value?.resetFields()
}

// 删除字典数据
const handleDeleteDictData = async (row: DictData) => {
  try {
    await ElMessageBox.confirm(`确定要删除字典数据"${row.dict_label}"吗？`, '提示', {
      type: 'warning'
    })
    await deleteDictData(row.id)
    ElMessage.success('删除成功')
    if (currentDictType.value) {
      await loadDictDataList(currentDictType.value.dict_type)
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 字典类型选择变化
const handleDictTypeSelectionChange = (selection: DictType[]) => {
  selectedDictTypes.value = selection
}

// 批量编辑字典类型
const handleBatchEditDictType = () => {
  if (selectedDictTypes.value.length === 1) {
    handleEditDictType(selectedDictTypes.value[0])
  }
}

// 批量删除字典类型
const handleBatchDeleteDictType = async () => {
  if (selectedDictTypes.value.length === 0) return
  
  try {
    const names = selectedDictTypes.value.map(d => d.dict_name).join('、')
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedDictTypes.value.length} 个字典类型吗？`, '提示', {
      type: 'warning'
    })
    
    // 批量删除
    for (const row of selectedDictTypes.value) {
      await deleteDictType(row.id)
    }
    
    ElMessage.success('删除成功')
    selectedDictTypes.value = []
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 字典类型状态切换
const handleDictTypeStatusChange = async (row: DictType) => {
  try {
    await updateDictType(row.id, { status: row.status })
    ElMessage.success('状态修改成功')
  } catch (error: any) {
    // 恢复原状态
    row.status = row.status === '0' ? '1' : '0'
    ElMessage.error(error.message || '状态修改失败')
  }
}

// 字典数据状态切换
const handleDictDataStatusChange = async (row: DictData) => {
  try {
    await updateDictData(row.id, { status: row.status })
    ElMessage.success('状态修改成功')
    if (currentDictType.value) {
      await loadDictDataList(currentDictType.value.dict_type)
    }
  } catch (error: any) {
    // 恢复原状态
    row.status = row.status === '0' ? '1' : '0'
    ElMessage.error(error.message || '状态修改失败')
  }
}

// 导出
const handleExport = () => {
  ElMessage.info('导出功能待实现')
}

onMounted(() => {
  handleQuery()
})
</script>

<style lang="scss" scoped>
@import '@/assets/styles/admin.scss';

.dict-management {
  // 使用统一的 admin.scss 样式
  
  .dict-data-header {
    margin-bottom: 20px;
  }
}
</style>

