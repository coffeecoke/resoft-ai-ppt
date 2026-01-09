<template>
  <div class="user-management admin-page">
    <el-card class="admin-card" shadow="never">
      <!-- 搜索区域 -->
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="用户名称">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入用户名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="用户状态" clearable style="width: 120px">
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
        :data="userList" 
        border 
        class="admin-table"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column label="用户编号" prop="id" width="120" />
        <el-table-column label="用户名称" prop="user_name" />
        <el-table-column label="用户昵称" prop="nick_name" />
        <el-table-column label="邮箱" prop="email" />
        <el-table-column label="手机号" prop="phone" />
        <el-table-column label="部门" prop="dept_name" />
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
        <el-table-column label="操作" align="center" width="250" fixed="right">
          <template #default="{ row }">
            <div class="operation-buttons">
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button link type="primary" size="small" @click="handleResetPassword(row)">
                <el-icon><Key /></el-icon>
                重置密码
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

    <!-- 表单对话框 -->
    <el-dialog
      v-model="formVisible"
      :title="formTitle"
      width="600px"
      class="admin-dialog"
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="用户名称" prop="user_name">
          <el-input v-model="form.user_name" placeholder="请输入用户名称" />
        </el-form-item>
        <el-form-item v-if="!form.id" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item label="用户昵称" prop="nick_name">
          <el-input v-model="form.nick_name" placeholder="请输入用户昵称" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="性别" prop="sex">
          <el-radio-group v-model="form.sex">
            <el-radio label="0">男</el-radio>
            <el-radio label="1">女</el-radio>
            <el-radio label="2">未知</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio label="0">正常</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog
      v-model="resetPasswordVisible"
      title="重置密码"
      width="400px"
      class="admin-dialog"
    >
      <el-form ref="resetPasswordFormRef" :model="resetPasswordForm" :rules="resetPasswordRules" label-width="100px">
        <el-form-item label="新密码" prop="newPassword">
          <el-input v-model="resetPasswordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input v-model="resetPasswordForm.confirmPassword" type="password" placeholder="请再次输入密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="resetPasswordVisible = false">取消</el-button>
        <el-button type="primary" @click="submitResetPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete, Key, Download } from '@element-plus/icons-vue'
import { getUserList, createUser, updateUser, deleteUser, resetUserPassword, type User } from '@/services/admin/systemService'

// 查询参数
const queryParams = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  dept_id: ''
})

// 用户列表
const loading = ref(false)
const userList = ref<User[]>([])
const total = ref(0)
const selectedRows = ref<User[]>([])

// 表单相关
const formVisible = ref(false)
const formTitle = ref('新增用户')
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  user_name: '',
  password: '',
  nick_name: '',
  email: '',
  phone: '',
  sex: '0',
  status: '0',
  dept_id: '',
  role_ids: []
})

const formRules: FormRules = {
  user_name: [{ required: true, message: '用户名称不能为空', trigger: 'blur' }],
  password: [
    { required: true, message: '密码不能为空', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  nick_name: [{ required: true, message: '用户昵称不能为空', trigger: 'blur' }]
}

// 重置密码表单
const resetPasswordVisible = ref(false)
const resetPasswordFormRef = ref<FormInstance>()
const resetPasswordForm = reactive({
  userId: '',
  newPassword: '',
  confirmPassword: ''
})

const resetPasswordRules: FormRules = {
  newPassword: [
    { required: true, message: '新密码不能为空', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '确认密码不能为空', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== resetPasswordForm.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 查询用户列表
const handleQuery = async () => {
  loading.value = true
  try {
    const result = await getUserList(queryParams)
    userList.value = result.list
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
  queryParams.dept_id = ''
  handleQuery()
}

// 新增
const handleCreate = () => {
  formTitle.value = '新增用户'
  resetForm()
  formVisible.value = true
}

// 编辑
const handleEdit = (row: User) => {
  formTitle.value = '修改用户'
  Object.assign(form, {
    id: row.id,
    user_name: row.user_name,
    password: '',
    nick_name: row.nick_name,
    email: row.email || '',
    phone: row.phone || '',
    sex: row.sex,
    status: row.status,
    dept_id: row.dept_id || '',
    role_ids: row.role_ids || []
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
          // 修改时不需要密码
          const { password, ...updateData } = form
          await updateUser(form.id, updateData)
          ElMessage.success('修改成功')
        } else {
          await createUser(form)
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
    user_name: '',
    password: '',
    nick_name: '',
    email: '',
    phone: '',
    sex: '0',
    status: '0',
    dept_id: '',
    role_ids: []
  })
  formRef.value?.resetFields()
}

// 删除
const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(`确定要删除用户"${row.user_name}"吗？`, '提示', {
      type: 'warning'
    })
    await deleteUser(row.id)
    ElMessage.success('删除成功')
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 重置密码
const handleResetPassword = (row: User) => {
  resetPasswordForm.userId = row.id
  resetPasswordForm.newPassword = ''
  resetPasswordForm.confirmPassword = ''
  resetPasswordVisible.value = true
}

// 提交重置密码
const submitResetPassword = async () => {
  if (!resetPasswordFormRef.value) return
  
  await resetPasswordFormRef.value.validate(async (valid) => {
    if (valid) {
      try {
        await resetUserPassword(resetPasswordForm.userId, resetPasswordForm.newPassword)
        ElMessage.success('密码重置成功')
        resetPasswordVisible.value = false
      } catch (error: any) {
        ElMessage.error(error.message || '重置密码失败')
      }
    }
  })
}

// 选择变化
const handleSelectionChange = (selection: User[]) => {
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
    const names = selectedRows.value.map(u => u.user_name).join('、')
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个用户吗？`, '提示', {
      type: 'warning'
    })
    
    // 批量删除
    for (const row of selectedRows.value) {
      await deleteUser(row.id)
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
const handleStatusChange = async (row: User) => {
  try {
    await updateUser(row.id, { status: row.status })
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

onMounted(() => {
  handleQuery()
})
</script>

<style lang="scss" scoped>
@import '@/assets/styles/admin.scss';
</style>

