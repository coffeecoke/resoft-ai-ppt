# 模板草稿本地缓存工具使用说明

## 📦 功能概述

`templateDraftDB.ts` 提供了模板编辑过程中的本地缓存功能，防止意外关闭导致数据丢失。

**核心特性：**
- ✅ 使用 IndexedDB (Dexie) 存储，容量大、性能好
- ✅ 自动深拷贝数据，避免引用问题
- ✅ 提供完整的 CRUD 操作
- ✅ 支持过期清理
- ✅ 提供 Vue Composition API Hook

---

## 🚀 快速开始

### 基础用法

```typescript
import { 
  saveTemplateDraft, 
  loadTemplateDraft, 
  clearTemplateDraft 
} from '@/utils/templateDraftDB'
import type { Slide } from '@/types/slides'

// 保存草稿
await saveTemplateDraft('template_9', slides)

// 加载草稿
const draft = await loadTemplateDraft('template_9')
if (draft) {
  // 使用草稿数据
  console.log('找到草稿，共', draft.length, '页')
}

// 清除草稿
await clearTemplateDraft('template_9')
```

### 使用 Hook（推荐）

```vue
<script setup lang="ts">
import { useTemplateDraft } from '@/utils/templateDraftDB'
import { watch } from 'vue'
import { useSlidesStore } from '@/store'

const templateId = 'template_9'
const { saveDraft, loadDraft, clearDraft, hasDraft } = useTemplateDraft(templateId)
const slidesStore = useSlidesStore()

// 监听 slides 变化，自动保存草稿
watch(
  () => slidesStore.slides,
  (slides) => {
    saveDraft(slides)
  },
  { deep: true }
)

// 组件挂载时加载草稿
onMounted(async () => {
  const draft = await loadDraft()
  if (draft) {
    // 提示用户是否恢复草稿
    const restore = confirm('检测到未保存的草稿，是否恢复？')
    if (restore) {
      slidesStore.setSlides(draft)
    }
  }
})

// 手动保存后清除草稿
const handleSave = async () => {
  await saveToServer()
  await clearDraft() // 清除本地草稿
}
</script>
```

---

## 📚 API 文档

### `saveTemplateDraft(templateId, slides)`

保存模板草稿到本地。

**参数：**
- `templateId: string` - 模板ID（如 `template_9`）
- `slides: Slide[]` - 幻灯片数据数组

**返回：** `Promise<void>`

**示例：**
```typescript
await saveTemplateDraft('template_9', [
  { id: 'slide1', elements: [...], type: 'cover' },
  { id: 'slide2', elements: [...], type: 'content' }
])
```

---

### `loadTemplateDraft(templateId)`

加载模板草稿。

**参数：**
- `templateId: string` - 模板ID

**返回：** `Promise<Slide[] | null>` - 草稿数据，不存在返回 `null`

**示例：**
```typescript
const draft = await loadTemplateDraft('template_9')
if (draft) {
  console.log('草稿共', draft.length, '页')
}
```

---

### `getTemplateDraftInfo(templateId)`

获取草稿信息（不加载完整数据，性能更好）。

**参数：**
- `templateId: string` - 模板ID

**返回：** `Promise<{ timestamp: number } | null>`

**示例：**
```typescript
const info = await getTemplateDraftInfo('template_9')
if (info) {
  console.log('草稿保存时间:', new Date(info.timestamp))
}
```

---

### `hasTemplateDraft(templateId)`

检查草稿是否存在。

**参数：**
- `templateId: string` - 模板ID

**返回：** `Promise<boolean>`

**示例：**
```typescript
if (await hasTemplateDraft('template_9')) {
  console.log('存在未保存的草稿')
}
```

---

### `clearTemplateDraft(templateId)`

清除指定模板的草稿。

**参数：**
- `templateId: string` - 模板ID

**返回：** `Promise<void>`

**示例：**
```typescript
// 手动保存成功后清除草稿
await clearTemplateDraft('template_9')
```

---

### `clearAllDrafts()`

清除所有草稿（清理功能）。

**返回：** `Promise<number>` - 清除的数量

**示例：**
```typescript
const count = await clearAllDrafts()
console.log(`已清除 ${count} 个草稿`)
```

---

### `getAllDrafts()`

获取所有草稿列表（用于管理）。

**返回：** `Promise<TemplateDraft[]>`

**示例：**
```typescript
const drafts = await getAllDrafts()
console.log('当前有', drafts.length, '个草稿')
```

---

### `clearExpiredDrafts(days?)`

清除过期草稿。

**参数：**
- `days: number` - 保留天数，默认 7 天

**返回：** `Promise<number>` - 清除的数量

**示例：**
```typescript
// 清除超过 7 天的草稿
const count = await clearExpiredDrafts(7)

// 清除超过 3 天的草稿
const count = await clearExpiredDrafts(3)
```

---

### `useTemplateDraft(templateId)`

Vue Composition API Hook，返回该模板的所有操作方法。

**参数：**
- `templateId: string` - 模板ID

**返回：**
```typescript
{
  saveDraft: (slides: Slide[]) => Promise<void>
  loadDraft: () => Promise<Slide[] | null>
  clearDraft: () => Promise<void>
  hasDraft: () => Promise<boolean>
  getDraftInfo: () => Promise<{ timestamp: number } | null>
}
```

---

## 💡 使用场景

### 场景1：实时保存草稿

```typescript
// 在模板编辑器中，每次修改自动保存
watch(
  () => slidesStore.slides,
  async (slides) => {
    await saveTemplateDraft(templateId, slides)
  },
  { deep: true, debounce: 500 } // 防抖，500ms 保存一次
)
```

### 场景2：页面加载时恢复草稿

```typescript
onMounted(async () => {
  const draft = await loadTemplateDraft(templateId)
  if (draft) {
    const restore = confirm('检测到未保存的草稿，是否恢复？')
    if (restore) {
      slidesStore.setSlides(draft)
    } else {
      // 用户选择不恢复，清除草稿
      await clearTemplateDraft(templateId)
    }
  }
})
```

### 场景3：手动保存后清除草稿

```typescript
const handleSave = async () => {
  try {
    // 保存到服务器
    await api.updateTemplate(templateId, { templateData })
    
    // 保存成功后清除本地草稿
    await clearTemplateDraft(templateId)
    
    message.success('保存成功')
  } catch (error) {
    message.error('保存失败')
  }
}
```

### 场景4：页面关闭前提示

```typescript
onBeforeUnmount(async () => {
  const hasDraft = await hasTemplateDraft(templateId)
  if (hasDraft) {
    const info = await getTemplateDraftInfo(templateId)
    if (info) {
      const time = new Date(info.timestamp).toLocaleString()
      console.log(`⚠️ 有未保存的草稿（${time}），已自动保存到本地`)
    }
  }
})
```

---

## 🔧 技术细节

### 数据库结构

- **数据库名：** `TemplateDraftDB`
- **表名：** `drafts`
- **主键：** `id` (模板ID)
- **索引：** `timestamp` (时间戳)

### 数据格式

```typescript
interface TemplateDraft {
  id: string              // 模板ID
  slides: Slide[]         // 幻灯片数据（深拷贝）
  timestamp: number       // 保存时间戳
  version?: number        // 版本号（预留）
}
```

### 性能优化

1. **深拷贝：** 使用 `JSON.parse(JSON.stringify())` 避免引用问题
2. **索引：** `timestamp` 建立索引，查询过期数据更快
3. **批量操作：** 提供 `bulkDelete` 批量删除

---

## ⚠️ 注意事项

1. **数据大小限制：** IndexedDB 单个对象建议不超过 50MB
2. **浏览器兼容性：** 需要支持 IndexedDB 的现代浏览器
3. **清理策略：** 建议定期调用 `clearExpiredDrafts()` 清理过期数据
4. **错误处理：** 所有操作都包含 try-catch，失败时会在控制台输出错误

---

## 🧪 测试建议

```typescript
// 测试保存和加载
const testId = 'test_template_1'
const testSlides: Slide[] = [
  { id: 'slide1', elements: [], type: 'cover' }
]

// 保存
await saveTemplateDraft(testId, testSlides)

// 检查
const exists = await hasTemplateDraft(testId)
console.assert(exists === true, '草稿应该存在')

// 加载
const loaded = await loadTemplateDraft(testId)
console.assert(loaded !== null, '应该能加载到草稿')
console.assert(loaded!.length === 1, '草稿应该有1页')

// 清除
await clearTemplateDraft(testId)
const existsAfter = await hasTemplateDraft(testId)
console.assert(existsAfter === false, '清除后应该不存在')
```

---

## 📝 更新日志

- **v1.0.0** (2024-01-01)
  - ✅ 初始版本
  - ✅ 基础 CRUD 操作
  - ✅ Vue Hook 支持
  - ✅ 过期清理功能





