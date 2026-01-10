<template>
  <div class="dept-management admin-page">
    <el-card class="admin-card" shadow="never">
      <!-- 搜索区域 -->
      <el-form :inline="true" :model="queryParams" class="search-form">
        <el-form-item label="部门名称">
          <el-input
            v-model="queryParams.keyword"
            placeholder="请输入部门名称"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="部门状态" clearable style="width: 120px">
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
        :data="deptList"
        border
        row-key="id"
        class="admin-table"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        default-expand-all
      >
        <el-table-column label="部门名称" prop="dept_name" width="200" />
        <el-table-column label="排序" prop="order_num" width="100" align="center" />
        <el-table-column label="负责人" prop="leader" width="120" />
        <el-table-column label="联系电话" prop="phone" width="150" />
        <el-table-column label="邮箱" prop="email" width="200" />
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
              <el-button link type="primary" size="small" @click="handleEdit(row)">
                <el-icon><Edit /></el-icon>
                修改
              </el-button>
              <el-button link type="primary" size="small" @click="handleAddChild(row)">
                <el-icon><Plus /></el-icon>
                新增
              </el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">
                <el-icon><Delete /></el-icon>
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
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
        <el-form-item label="上级部门" prop="parent_id">
          <el-tree-select
            v-model="form.parent_id"
            :data="deptTreeOptions"
            :props="{ label: 'dept_name', value: 'id' }"
            placeholder="请选择上级部门"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="部门名称" prop="dept_name">
          <el-input v-model="form.dept_name" placeholder="请输入部门名称" />
        </el-form-item>
        <el-form-item label="显示顺序" prop="order_num">
          <el-input-number v-model="form.order_num" :min="0" />
        </el-form-item>
        <el-form-item label="负责人" prop="leader">
          <el-input v-model="form.leader" placeholder="请输入负责人" />
        </el-form-item>
        <el-form-item label="联系电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入联系电话" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Search, Refresh, Edit, Delete } from '@element-plus/icons-vue'
import { getDeptTree, getDeptList, createDept, updateDept, deleteDept, type Dept } from '@/services/admin/systemService'

// 查询参数
const queryParams = reactive({
  keyword: '',
  status: ''
})

// 部门列表
const loading = ref(false)
const deptList = ref<Dept[]>([])
const deptTree = ref<Dept[]>([])

// 表单相关
const formVisible = ref(false)
const formTitle = ref('新增部门')
const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  parent_id: '0',
  dept_name: '',
  order_num: 0,
  leader: '',
  phone: '',
  email: '',
  status: '0'
})

const formRules: FormRules = {
  dept_name: [{ required: true, message: '部门名称不能为空', trigger: 'blur' }]
}

// 部门树选项（用于选择上级部门）
const deptTreeOptions = computed(() => {
  return deptTree.value
})

// 查询部门列表
const handleQuery = async () => {
  loading.value = true
  try {
    const result = await getDeptTree(queryParams)
    deptTree.value = result
    deptList.value = result
  } catch (error: any) {
    ElMessage.error(error.message || '查询失败')
  } finally {
    loading.value = false
  }
}

// 重置查询
const resetQuery = () => {
  queryParams.keyword = ''
  queryParams.status = ''
  handleQuery()
}

// 新增
const handleCreate = () => {
  formTitle.value = '新增部门'
  resetForm()
  form.parent_id = '0'
  formVisible.value = true
}

// 新增子部门
const handleAddChild = (row: Dept) => {
  formTitle.value = '新增部门'
  resetForm()
  form.parent_id = row.id
  formVisible.value = true
}

// 编辑
const handleEdit = (row: Dept) => {
  formTitle.value = '修改部门'
  Object.assign(form, {
    id: row.id,
    parent_id: row.parent_id || '0',
    dept_name: row.dept_name,
    order_num: row.order_num,
    leader: row.leader || '',
    phone: row.phone || '',
    email: row.email || '',
    status: row.status
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
          await updateDept(form.id, form)
          ElMessage.success('修改成功')
        } else {
          await createDept(form)
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
    parent_id: '0',
    dept_name: '',
    order_num: 0,
    leader: '',
    phone: '',
    email: '',
    status: '0'
  })
  formRef.value?.resetFields()
}

// 删除
const handleDelete = async (row: Dept) => {
  try {
    await ElMessageBox.confirm(`确定要删除部门"${row.dept_name}"吗？`, '提示', {
      type: 'warning'
    })
    await deleteDept(row.id)
    ElMessage.success('删除成功')
    handleQuery()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.message || '删除失败')
    }
  }
}

// 状态切换
const handleStatusChange = async (row: Dept) => {
  try {
    await updateDept(row.id, { status: row.status })
    ElMessage.success('状态修改成功')
  } catch (error: any) {
    // 恢复原状态
    row.status = row.status === '0' ? '1' : '0'
    ElMessage.error(error.message || '状态修改失败')
  }
}

onMounted(() => {
  handleQuery()
})
</script>

<style lang="scss" scoped>
@import '@/assets/styles/admin.scss';
</style>

