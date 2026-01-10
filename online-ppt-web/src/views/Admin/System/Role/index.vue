<template>
  <div class="role-management admin-page">
    <el-card class="admin-card" shadow="never">
      <!-- 搜索区域 -->
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="角色名称">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入角色名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="角色状态" clearable style="width: 120px">
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
          <el-button type="primary" @click="handleCreate">
            <el-icon><Plus /></el-icon>
            新增
          </el-button>
          <el-button 
            type="info" 
            plain 
            :disabled="selectedRows.length !== 1"
            @click="handleBatchEdit"
          >
            <el-icon><Edit /></el-icon>
            修改
          </el-button>
          <el-button 
            type="danger" 
            plain 
            :disabled="selectedRows.length === 0"
            @click="handleBatchDelete"
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
        :data="roleList" 
        border 
        class="admin-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="角色编号" prop="id" width="120" />
        <el-table-column label="角色名称" prop="role_name" />
        <el-table-column label="权限字符" prop="role_key" />
        <el-table-column label="显示顺序" prop="role_sort" width="100" align="center" />
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-switch
              v-model="row.status"
              active-value="0"
              inactive-value="1"
              @change="handleStatusChange(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="create_time" width="180" />
        <el-table-column label="操作" align="center" width="200" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button type="primary" link size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button type="danger" link size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
              <el-dropdown @command="(cmd) => handleMoreAction(cmd, row)">
                <el-button type="primary" link size="small">
                  更多
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="dataScope">数据权限</el-dropdown-item>
                    <el-dropdown-item command="assignUser">分配用户</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
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

    <!-- 表单对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="formTitle"
      width="600px"
      class="admin-dialog"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="角色名称" prop="role_name">
          <el-input v-model="form.role_name" placeholder="请输入角色名称" />
        </el-form-item>
        <el-form-item label="权限字符" prop="role_key">
          <el-input v-model="form.role_key" placeholder="请输入权限字符" />
        </el-form-item>
        <el-form-item label="显示顺序" prop="role_sort">
          <el-input-number v-model="form.role_sort" :min="0" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="0">正常</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete, Download, ArrowDown } from '@element-plus/icons-vue'
import { getRoleList, createRole, updateRole, deleteRole, type Role } from '@/services/admin/systemService'


// 查询参数
const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: ''
})

// 角色列表
const loading = ref(false)
const roleList = ref<Role[]>([])
const total = ref(0)
const selectedRows = ref<Role[]>([])

// 表单相关
const formVisible = ref(false)
const formTitle = ref('新增角色')
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  role_name: '',
  role_key: '',
  role_sort: 0,
  status: '0',
  remark: ''
})

const formRules: FormRules = {
  role_name: [{ required: true, message: '角色名称不能为空', trigger: 'blur' }],
  role_key: [{ required: true, message: '权限字符不能为空', trigger: 'blur' }]
}

// 查询角色列表
const handleQuery = async () => {
  loading.value = true
  try {
    const result = await getRoleList(queryParams)
    roleList.value = result.list
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

// 新增
const handleCreate = () => {
  formTitle.value = '新增角色'
  resetForm()
  formVisible.value = true
}

// 编辑
const handleEdit = (row: Role) => {
  formTitle.value = '修改角色'
  Object.assign(form, {
    id: row.id,
    role_name: row.role_name,
    role_key: row.role_key,
    role_sort: row.role_sort,
    status: row.status,
    remark: row.remark || ''
  })
  formVisible.value = true
}

// 提交表单
const submitForm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      try {
        if (form.id) {
          await updateRole(form.id, form)
          ElMessage.success('修改成功')
        } else {
          await createRole(form)
          ElMessage.success('新增成功')
        }
        formVisible.value = false
        handleQuery()
      } catch (error: any) {
        ElMessage.error(error.message || '操作失败')
      }
    }
  })
}

// 重置表单
const resetForm = () => {
  Object.assign(form, {
    id: '',
    role_name: '',
    role_key: '',
    role_sort: 0,
    status: '0',
    remark: ''
  })
  formRef.value?.resetFields()
}

// 删除
const handleDelete = async (row: Role) => {
  try {
    await ElMessageBox.confirm(`确定要删除角色"${row.role_name}"吗？`, '提示', {
      type: 'warning'
    })
    await deleteRole(row.id)
    ElMessage.success('删除成功')
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 选择变化
const handleSelectionChange = (selection: Role[]) => {
  selectedRows.value = selection
}

// 批量编辑
const handleBatchEdit = () => {
  if (selectedRows.value.length === 1) {
    handleEdit(selectedRows.value[0])
  }
}

// 批量删除
const handleBatchDelete = async () => {
  if (selectedRows.value.length === 0) return
  
  try {
    const names = selectedRows.value.map(r => r.role_name).join('、')
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个角色吗？`, '提示', {
      type: 'warning'
    })
    
    // 批量删除
    for (const row of selectedRows.value) {
      await deleteRole(row.id)
    }
    
    ElMessage.success('删除成功')
    selectedRows.value = []
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 状态切换
const handleStatusChange = async (row: Role) => {
  try {
    await updateRole(row.id, { status: row.status })
    ElMessage.success('状态修改成功')
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

// 更多操作
const handleMoreAction = (command: string, row: Role) => {
  if (command === 'dataScope') {
    ElMessage.info('数据权限功能待实现')
  } else if (command === 'assignUser') {
    ElMessage.info('分配用户功能待实现')
  }
}

onMounted(() => {
  handleQuery()
})
</script>

<style lang="scss" scoped>
@import '@/assets/styles/admin.scss';
</style>

