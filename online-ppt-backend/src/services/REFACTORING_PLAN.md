# Services 服务层重构实施方案

## 一、目标

将现有的平铺式服务文件重构为按业务模块分层的结构，提高代码的可维护性和可扩展性。

## 二、当前状态分析

### 2.1 现有服务文件

**根目录 services/**：
- `documentService.js` - 文档管理（应迁移到 admin/document/）
- `pptxService.js` - PPTX解析（应迁移到 ppt/）
- `thumbnailService.js` - 缩略图（应迁移到 ppt/）
- `slotService.js` - 插槽服务（应迁移到 ppt/）
- `aiService.js` - AI服务（应迁移到 ai/）
- `intentService.js` - 意图识别（应迁移到 ai/）
- `translateService.js` - 翻译（应迁移到 ai/）
- `wordService.js` - Word解析（应迁移到 tools/）
- `imageService.js` - 图片服务（应迁移到 tools/）

**admin 目录**：
- `fileScanService.js` - 文件扫描（保留在 admin/document/）
- `scanConfigService.js` - 扫描配置（保留在 admin/）
- `scanScheduler.js` - 扫描调度器（保留在 admin/）

### 2.2 需要新增的服务

**admin/system/**：
- `roleService.js` - 角色管理（新建）
- `userService.js` - 用户管理（新建）
- `deptService.js` - 部门管理（新建）
- `dictService.js` - 字典管理（新建）

**admin/document/**：
- `templateService.js` - 模版管理（新建，或从现有代码提取）

## 三、新目录结构

```
services/
├── admin/
│   ├── system/
│   │   ├── roleService.js      [新建]
│   │   ├── userService.js       [新建]
│   │   ├── deptService.js      [新建]
│   │   └── dictService.js       [新建]
│   ├── document/
│   │   ├── templateService.js   [新建]
│   │   ├── documentService.js   [迁移自根目录]
│   │   └── fileScanService.js   [移动自 admin/]
│   ├── scanConfigService.js     [保留]
│   └── scanScheduler.js        [保留]
│
├── sales/                       [预留，后续扩展]
│
├── ppt/
│   ├── pptxService.js           [迁移自根目录]
│   ├── thumbnailService.js      [迁移自根目录]
│   └── slotService.js           [迁移自根目录]
│
├── ai/
│   ├── aiService.js             [迁移自根目录]
│   ├── intentService.js         [迁移自根目录]
│   └── translateService.js     [迁移自根目录]
│
└── tools/
    ├── wordService.js           [迁移自根目录]
    └── imageService.js          [迁移自根目录]
```

## 四、实施步骤

### 阶段1：创建新模块结构（不影响现有功能）

#### 1.1 创建目录结构
```bash
# 创建新目录
mkdir -p services/admin/system
mkdir -p services/admin/document
mkdir -p services/ppt
mkdir -p services/ai
mkdir -p services/tools
```

#### 1.2 创建系统管理服务（新建）

**services/admin/system/dictService.js**
- 字典类型管理（CRUD）
- 字典数据管理（CRUD）
- 字典查询（根据dictType获取字典数据）

**services/admin/system/roleService.js**
- 角色列表查询
- 角色创建
- 角色更新
- 角色删除
- 角色权限管理

**services/admin/system/userService.js**
- 用户列表查询
- 用户创建
- 用户更新
- 用户删除
- 用户状态管理

**services/admin/system/deptService.js**
- 部门树查询
- 部门创建
- 部门更新
- 部门删除
- 部门层级管理

#### 1.3 创建文档管理服务（新建）

**services/admin/document/templateService.js**
- 模版列表查询
- 模版创建
- 模版更新
- 模版删除
- 模版分类管理

### 阶段2：迁移现有服务（逐步迁移，保持兼容）

#### 2.1 迁移 documentService.js

**步骤**：
1. 复制 `services/documentService.js` 到 `services/admin/document/documentService.js`
2. 更新文件内的导入路径（如果有）
3. 在路由中同时支持新旧路径（过渡期）
4. 测试验证
5. 更新所有路由引用
6. 删除旧文件

**影响范围**：
- `routes/documents.js`
- `routes/sales/documents.js`
- 其他引用 documentService 的文件

#### 2.2 迁移 PPT 相关服务

**pptxService.js** → `services/ppt/pptxService.js`
- 影响：`routes/tools.js`、`routes/aipptChat.js`

**thumbnailService.js** → `services/ppt/thumbnailService.js`
- 影响：`routes/thumbnails.js`、`routes/sales/thumbnails.js`

**slotService.js** → `services/ppt/slotService.js`
- 影响：`routes/tools.js`

#### 2.3 迁移 AI 相关服务

**aiService.js** → `services/ai/aiService.js`
- 影响：`routes/tools.js`、`routes/aipptChat.js`

**intentService.js** → `services/ai/intentService.js`
- 影响：`routes/aipptChat.js`

**translateService.js** → `services/ai/translateService.js`
- 影响：`routes/translate.js`

#### 2.4 迁移工具类服务

**wordService.js** → `services/tools/wordService.js`
- 影响：`routes/tools.js`

**imageService.js** → `services/tools/imageService.js`
- 影响：`routes/images.js`

#### 2.5 移动 admin 目录下的服务

**fileScanService.js** → `services/admin/document/fileScanService.js`
- 影响：`routes/admin/fileScan.js`

### 阶段3：清理和优化

1. 删除根目录下的旧服务文件
2. 统一服务导出方式
3. 更新所有引用路径
4. 运行测试验证
5. 更新文档

## 五、服务文件模板

### 5.1 字典服务模板

```javascript
/**
 * 字典管理服务
 * 
 * 提供字典类型和字典数据的增删改查功能
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

class DictService {
  /**
   * 获取字典类型列表
   */
  async getDictTypeList(params = {}) {
    const { page = 1, pageSize = 20, keyword, status } = params
    const skip = (page - 1) * pageSize
    
    const where = {}
    if (keyword) {
      where.OR = [
        { dict_type: { contains: keyword } },
        { dict_name: { contains: keyword } }
      ]
    }
    if (status !== undefined) {
      where.status = status
    }
    
    const [list, total] = await Promise.all([
      prisma.dict_types.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { sort_order: 'asc' }
      }),
      prisma.dict_types.count({ where })
    ])
    
    return { list, total }
  }

  /**
   * 根据字典类型代码获取字典数据
   */
  async getDictByType(dictType) {
    const dictData = await prisma.dict_data.findMany({
      where: {
        dict_type: dictType,
        status: '0' // 只返回正常状态的
      },
      orderBy: { dict_sort: 'asc' }
    })
    
    return dictData
  }

  // ... 其他方法
}

export default new DictService()
```

### 5.2 角色服务模板

```javascript
/**
 * 角色管理服务
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

class RoleService {
  /**
   * 获取角色列表
   */
  async getRoleList(params = {}) {
    // TODO: 实现角色列表查询
    // 暂时返回Mock数据
    return {
      list: [],
      total: 0
    }
  }

  // ... 其他方法
}

export default new RoleService()
```

## 六、路由更新示例

### 6.1 字典路由

```javascript
// routes/admin/system/dict.js
import express from 'express'
import dictService from '../../services/admin/system/dictService.js'

const router = express.Router()

// GET /api/admin/system/dict/types - 获取字典类型列表
router.get('/types', async (req, res) => {
  try {
    const result = await dictService.getDictTypeList(req.query)
    res.json({ success: true, data: result })
  } catch (error) {
    console.error('[字典管理] 获取字典类型列表失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// GET /api/admin/system/dict/type/:dictType - 根据类型获取字典数据
router.get('/type/:dictType', async (req, res) => {
  try {
    const { dictType } = req.params
    const data = await dictService.getDictByType(dictType)
    res.json({ success: true, data })
  } catch (error) {
    console.error('[字典管理] 获取字典数据失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
```

### 6.2 更新主路由

```javascript
// routes/admin/index.js
import { Router } from 'express'
import fileScanRouter from './fileScan.js'
import dictRouter from './system/dict.js'  // 新增

const router = Router()

router.use('/file-scan', fileScanRouter)
router.use('/system/dict', dictRouter)  // 新增

export default router
```

## 七、迁移检查清单

### 7.1 字典服务
- [ ] 创建 `services/admin/system/dictService.js`
- [ ] 创建 `routes/admin/system/dict.js`
- [ ] 在 `routes/admin/index.js` 中注册路由
- [ ] 测试字典类型CRUD接口
- [ ] 测试字典数据CRUD接口
- [ ] 测试根据类型获取字典数据接口

### 7.2 其他系统管理服务
- [ ] 创建 `roleService.js`
- [ ] 创建 `userService.js`
- [ ] 创建 `deptService.js`
- [ ] 创建对应的路由文件
- [ ] 注册路由

### 7.3 文档管理服务
- [ ] 创建 `templateService.js`
- [ ] 迁移 `documentService.js`
- [ ] 移动 `fileScanService.js`
- [ ] 更新路由引用

### 7.4 PPT服务迁移
- [ ] 迁移 `pptxService.js`
- [ ] 迁移 `thumbnailService.js`
- [ ] 迁移 `slotService.js`
- [ ] 更新所有路由引用

### 7.5 AI服务迁移
- [ ] 迁移 `aiService.js`
- [ ] 迁移 `intentService.js`
- [ ] 迁移 `translateService.js`
- [ ] 更新所有路由引用

### 7.6 工具服务迁移
- [ ] 迁移 `wordService.js`
- [ ] 迁移 `imageService.js`
- [ ] 更新所有路由引用

## 八、注意事项

1. **向后兼容**：迁移过程中，可以同时保留新旧路径，逐步切换
2. **测试验证**：每次迁移后都要进行完整测试
3. **日志记录**：迁移过程中记录所有变更
4. **文档更新**：及时更新相关文档
5. **代码审查**：重要变更需要代码审查

## 九、风险评估

### 9.1 低风险
- 创建新目录结构
- 创建新的系统管理服务（不影响现有功能）

### 9.2 中风险
- 迁移现有服务（需要更新多个引用点）
- 需要充分测试

### 9.3 缓解措施
- 分阶段实施，每次迁移一个模块
- 保留旧文件一段时间，确保稳定后再删除
- 完整的测试覆盖

## 十、时间估算

- **阶段1**（创建新结构）：1-2天
- **阶段2**（迁移现有服务）：3-5天
- **阶段3**（清理优化）：1-2天

**总计**：5-9天

