# Services 服务层架构设计

## 一、目录结构

```
services/
├── admin/                    # 管理后台服务
│   ├── system/              # 系统管理模块
│   │   ├── roleService.js   # 角色管理服务
│   │   ├── userService.js   # 用户管理服务
│   │   ├── deptService.js   # 部门管理服务
│   │   └── dictService.js   # 字典管理服务
│   ├── document/            # 文档管理模块
│   │   ├── templateService.js    # 模版管理服务
│   │   ├── documentService.js    # 文档管理服务（从根目录迁移）
│   │   └── fileScanService.js    # 文件扫描服务（已有）
│   ├── scanConfigService.js      # 扫描配置服务（已有）
│   └── scanScheduler.js          # 扫描调度器（已有）
│
├── sales/                    # 售前平台服务
│   ├── productService.js    # 产品管理服务
│   ├── catalogService.js    # 产品目录服务
│   ├── qaService.js         # 问答服务
│   └── ...                  # 其他售前相关服务
│
├── ppt/                      # PPT编辑器核心服务
│   ├── pptxService.js       # PPTX解析和生成服务（从根目录迁移）
│   ├── thumbnailService.js  # 缩略图服务（从根目录迁移）
│   └── slotService.js       # 插槽服务（从根目录迁移）
│
├── ai/                       # AI相关服务
│   ├── aiService.js         # AI服务（从根目录迁移）
│   ├── intentService.js     # 意图识别服务（从根目录迁移）
│   └── translateService.js  # 翻译服务（从根目录迁移）
│
└── tools/                    # 工具类服务
    ├── wordService.js       # Word文档服务（从根目录迁移）
    └── imageService.js      # 图片服务（从根目录迁移）
```

## 二、模块说明

### 2.1 Admin 模块（管理后台）

#### system/ - 系统管理
- **roleService.js**: 角色管理（增删改查、权限分配）
- **userService.js**: 用户管理（增删改查、状态管理）
- **deptService.js**: 部门管理（树形结构、层级管理）
- **dictService.js**: 字典管理（字典类型、字典数据、字典查询）

#### document/ - 文档管理
- **templateService.js**: 模版管理（模版CRUD、模版分类）
- **documentService.js**: 文档管理（文档CRUD、文档状态）
- **fileScanService.js**: 文件扫描（文件扫描、自动处理）

### 2.2 Sales 模块（售前平台）

负责售前平台相关的业务逻辑，包括产品、目录、问答等。

### 2.3 PPT 模块（编辑器核心）

负责PPT编辑器的核心功能，包括PPTX解析、缩略图生成、插槽处理等。

### 2.4 AI 模块

负责AI相关功能，包括AI对话、意图识别、翻译等。

### 2.5 Tools 模块

提供通用工具类服务，如Word解析、图片处理等。

## 三、服务层设计规范

### 3.1 命名规范

- **服务文件命名**：使用 `模块名Service.js` 格式，如 `roleService.js`
- **类命名**：使用 `模块名Service` 格式，如 `RoleService`
- **方法命名**：使用动词开头，如 `getRoleList`、`createRole`、`updateRole`、`deleteRole`

### 3.2 服务类结构

```javascript
/**
 * 角色管理服务
 * 
 * 提供角色的增删改查功能
 */
class RoleService {
  /**
   * 获取角色列表
   * @param {Object} params - 查询参数
   * @param {number} params.page - 页码
   * @param {number} params.pageSize - 每页数量
   * @param {string} params.keyword - 关键词搜索
   * @returns {Promise<Object>} 角色列表和总数
   */
  async getRoleList(params) {
    // 实现逻辑
  }

  /**
   * 创建角色
   * @param {Object} data - 角色数据
   * @returns {Promise<Object>} 创建的角色信息
   */
  async createRole(data) {
    // 实现逻辑
  }

  /**
   * 更新角色
   * @param {string} id - 角色ID
   * @param {Object} data - 更新的数据
   * @returns {Promise<Object>} 更新后的角色信息
   */
  async updateRole(id, data) {
    // 实现逻辑
  }

  /**
   * 删除角色
   * @param {string} id - 角色ID
   * @returns {Promise<void>}
   */
  async deleteRole(id) {
    // 实现逻辑
  }
}

// 导出单例
export default new RoleService()
```

### 3.3 错误处理

所有服务方法都应该：
- 使用 try-catch 捕获错误
- 抛出有意义的错误信息
- 记录错误日志

```javascript
async getRoleList(params) {
  try {
    // 业务逻辑
    return { list: [], total: 0 }
  } catch (error) {
    console.error('[角色服务] 获取角色列表失败:', error)
    throw new Error(`获取角色列表失败: ${error.message}`)
  }
}
```

### 3.4 数据验证

服务层应该进行基础的数据验证：

```javascript
async createRole(data) {
  // 验证必填字段
  if (!data.name) {
    throw new Error('角色名称不能为空')
  }
  
  // 验证数据格式
  if (data.name.length > 50) {
    throw new Error('角色名称不能超过50个字符')
  }
  
  // 业务逻辑
}
```

## 四、迁移计划

### 阶段1：创建新模块结构（不破坏现有功能）

1. 创建新的目录结构
2. 创建新的服务文件（system模块）
3. 保持现有服务文件不变（向后兼容）

### 阶段2：迁移现有服务（逐步迁移）

1. **迁移 documentService.js**
   - 从 `services/documentService.js` 迁移到 `services/admin/document/documentService.js`
   - 更新路由中的引用

2. **迁移 pptxService.js**
   - 从 `services/pptxService.js` 迁移到 `services/ppt/pptxService.js`
   - 更新路由中的引用

3. **迁移其他服务**
   - 按模块分类迁移剩余服务

### 阶段3：清理和优化

1. 删除根目录下的旧服务文件
2. 统一服务导出方式
3. 优化服务间的依赖关系

## 五、导入方式

### 5.1 在路由中使用

```javascript
// routes/admin/system/role.js
import roleService from '../../services/admin/system/roleService.js'

router.get('/', async (req, res) => {
  const result = await roleService.getRoleList(req.query)
  res.json({ success: true, data: result })
})
```

### 5.2 在服务中使用其他服务

```javascript
// services/admin/system/userService.js
import roleService from './roleService.js'

class UserService {
  async assignRole(userId, roleId) {
    // 验证角色是否存在
    const role = await roleService.getRoleById(roleId)
    // 分配角色逻辑
  }
}
```

## 六、注意事项

1. **向后兼容**：迁移过程中保持现有功能正常
2. **统一导出**：所有服务统一使用 `export default new ServiceClass()` 方式导出
3. **依赖管理**：避免循环依赖，服务间依赖要清晰
4. **错误处理**：统一错误处理方式，便于调试和维护
5. **日志记录**：关键操作要记录日志，便于排查问题

## 七、后续扩展

- 添加服务层单元测试
- 添加服务层接口文档
- 优化服务层性能
- 添加服务层缓存机制

