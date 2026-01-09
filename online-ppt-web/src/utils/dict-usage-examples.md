# 字典工具库使用示例

## 一、基础用法

### 1.1 在组件中使用 useDict

```vue
<template>
  <div>
    <!-- 使用字典选项 -->
    <el-select v-model="form.status" placeholder="请选择状态">
      <el-option
        v-for="item in statusOptions"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    
    <!-- 显示字典标签 -->
    <span>当前状态：{{ getStatusLabel(form.status) }}</span>
  </div>
</template>

<script setup lang="ts">
import { useSingleDict } from '@/composables/useDict'

// 使用单个字典
const { data, options, loading, getLabel } = useSingleDict('user_status', {
  dictName: '用户状态'
})

// 获取选项（用于下拉框）
const statusOptions = options

// 获取标签
const getStatusLabel = (value: string) => getLabel(value)
</script>
```

### 1.2 使用多个字典

```vue
<script setup lang="ts">
import { useDict } from '@/composables/useDict'

// 使用多个字典
const { dictData, loading, getLabel } = useDict(['user_status', 'order_status', 'dept_type'])

// 获取指定字典的数据
const userStatusOptions = computed(() => {
  return dictData.value.user_status || []
})

// 获取标签
const getUserStatusLabel = (value: string) => getLabel('user_status', value)
const getOrderStatusLabel = (value: string) => getLabel('order_status', value)
</script>
```

## 二、手动加载字典

```typescript
import { loadDict, getDict, getDictLabel } from '@/utils/dict'

// 手动加载字典
async function initDict() {
  await loadDict('user_status', '用户状态')
  
  // 获取字典数据
  const data = getDict('user_status')
  console.log('字典数据:', data)
  
  // 获取标签
  const label = getDictLabel('user_status', '0')
  console.log('标签:', label) // 输出：正常
}

// 批量加载
import { loadDicts } from '@/utils/dict'
await loadDicts(['user_status', 'order_status'])
```

## 三、在表格中使用字典

```vue
<template>
  <el-table :data="tableData">
    <el-table-column prop="status" label="状态">
      <template #default="{ row }">
        <el-tag :type="getStatusType(row.status)">
          {{ getStatusLabel(row.status) }}
        </el-tag>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { useSingleDict } from '@/composables/useDict'

const { getLabel, data } = useSingleDict('user_status')

const getStatusLabel = (value: string) => getLabel(value)

const getStatusType = (value: string) => {
  const item = data.value?.find(d => d.dictValue === value)
  // 可以根据字典的 cssClass 或其他字段设置标签类型
  return value === '0' ? 'success' : 'danger'
}
</script>
```

## 四、在表单中使用字典

```vue
<template>
  <el-form :model="form">
    <el-form-item label="用户状态">
      <el-select v-model="form.status">
        <el-option
          v-for="item in statusOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </el-form-item>
    
    <el-form-item label="订单状态">
      <el-radio-group v-model="form.orderStatus">
        <el-radio
          v-for="item in orderStatusOptions"
          :key="item.value"
          :label="item.value"
        >
          {{ item.label }}
        </el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { useDict } from '@/composables/useDict'
import { computed } from 'vue'

const { dictData, loading } = useDict(['user_status', 'order_status'])

const statusOptions = computed(() => {
  const data = dictData.value.user_status || []
  return data.map(item => ({
    label: item.dictLabel,
    value: item.dictValue
  }))
})

const orderStatusOptions = computed(() => {
  const data = dictData.value.order_status || []
  return data.map(item => ({
    label: item.dictLabel,
    value: item.dictValue
  }))
})
</script>
```

## 五、直接使用工具函数

```typescript
import { getDict, getDictLabel, getDictOptions, registerDict } from '@/utils/dict'

// 手动注册字典（用于静态数据或Mock数据）
registerDict('test_status', [
  { dictLabel: '正常', dictValue: '0' },
  { dictLabel: '停用', dictValue: '1' }
], '测试状态')

// 获取字典数据
const data = getDict('test_status')

// 获取选项
const options = getDictOptions('test_status')
// 输出: [{ label: '正常', value: '0' }, { label: '停用', value: '1' }]

// 获取标签
const label = getDictLabel('test_status', '0')
// 输出: '正常'

// 多个值
const labels = getDictLabel('test_status', ['0', '1'], '、')
// 输出: '正常、停用'
```

## 六、在系统管理页面中使用

```vue
<template>
  <div>
    <!-- 字典管理页面 -->
    <el-table :data="dictTypeList">
      <el-table-column prop="status" label="状态">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'">
            {{ getDictLabel('sys_normal_disable', row.status) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { useSingleDict } from '@/composables/useDict'

// 使用系统字典
const { getLabel } = useSingleDict('sys_normal_disable', {
  dictName: '系统是否'
})
</script>
```

## 七、注意事项

1. **字典类型代码**：必须与后端配置的 `dict_type` 一致
2. **自动加载**：`useDict` 默认会在组件挂载时自动加载字典
3. **缓存机制**：字典数据会被缓存，避免重复请求
4. **错误处理**：加载失败时会返回空数组，不会抛出异常
5. **响应式**：使用 `useDict` 返回的数据是响应式的，可以直接在模板中使用

## 八、常用字典类型

建议在系统中预定义以下常用字典类型：

- `sys_normal_disable` - 系统是否（0=正常，1=停用）
- `sys_show_hide` - 显示状态（0=显示，1=隐藏）
- `sys_yes_no` - 是否（Y=是，N=否）
- `user_sex` - 用户性别（0=男，1=女，2=未知）
- `user_status` - 用户状态（0=正常，1=停用）

