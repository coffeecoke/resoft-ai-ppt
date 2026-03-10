# 问答对分类功能说明

## 概述

本功能用于对售前沟通中的问答对进行AI分类标注，支持双维度分类：
- **第一维度**：6大分类层面、23个分类类别
- **第二维度**：5大问题性质（I系列意图维度）

## 数据库设计

### 1. concern_categories 表（问答对分类表）

存储所有分类数据，包括：
- **分类层面**（level=1）：6个层面（1-6）
- **分类类别**（level=2）：23个类别（1.1, 1.2, ..., 6.4）
- **问题性质**（level=3）：5个意图类型（I1-I5）

**表结构**：
- `id`: 主键
- `code`: 分类代码（唯一，如"1.1", "2.3", "I1"）
- `name`: 分类名称
- `type`: 类型（level/category/intent）
- `parent_code`: 父级代码（用于层级关系）
- `level`: 层级（1=层面，2=类别，3=问题性质）
- `description`: 类别定义说明
- `keywords`: 识别关键词（JSON数组）
- `sort_order`: 排序字段
- `is_active`: 是否启用

### 2. concerns 表（修改）

新增字段：
- `category_id`: 关联分类ID（外键，关联到concern_categories）
- `intent_code`: 问题性质代码（I1-I5）

保留字段（兼容旧数据）：
- `category`: 问题分类（兼容旧数据，存储分类代码如"2.3"）

## 分类体系

### 分类层面（6个）

1. **公司层面**（code: 1）
   - 1.1 资质与案例
   - 1.2 公司规模与背景
   - 1.3 合作模式
   - 1.4 监管资源与协作

2. **产品层面**（code: 2）
   - 2.1 性能与效率
   - 2.2 产品架构
   - 2.3 产品功能
   - 2.4 兼容性与接口扩展

3. **业务层面**（code: 3）
   - 3.1 监管政策适配
   - 3.2 数据安全与合规治理
   - 3.3 业务适配与定制化

4. **商务层面**（code: 4）
   - 4.1 预算与报价
   - 4.2 价格竞争力与优惠政策

5. **项目实施层面**（code: 5）
   - 5.1 POC
   - 5.2 项目周期
   - 5.3 项目团队
   - 5.4 项目管控
   - 5.5 资源配置
   - 5.6 数据迁移与系统切换

6. **售后保障层面**（code: 6）
   - 6.1 运维内容
   - 6.2 运维费用和周期
   - 6.3 培训与知识转移
   - 6.4 安全支撑

### 问题性质（5个）

- **I1**: 确认类（确认产品功能）
- **I2**: 对比类（与竞品差异）
- **I3**: 顾虑类（担心使用效果）
- **I4**: 建议类（希望功能优化）
- **I5**: 其它意图

## 部署步骤

### 1. 生成数据库迁移

```bash
cd online-ppt-backend
npx prisma migrate dev --name add_concern_categories
```

### 2. 初始化分类数据

```bash
node prisma/seed-concern-categories.js
```

### 3. 验证数据

```bash
# 检查数据是否正确插入
node -e "
import('@prisma/client').then(async ({ PrismaClient }) => {
  const prisma = new PrismaClient()
  const total = await prisma.concern_categories.count()
  const levels = await prisma.concern_categories.count({ where: { level: 1 } })
  const categories = await prisma.concern_categories.count({ where: { level: 2 } })
  const intents = await prisma.concern_categories.count({ where: { level: 3 } })
  console.log('总计:', total)
  console.log('分类层面:', levels)
  console.log('分类类别:', categories)
  console.log('问题性质:', intents)
  await prisma.\$disconnect()
})
"
```

## 使用说明

### AI分类流程

1. **提取问答对**：从转录记录中提取问答对，存储到 `concerns` 表
2. **AI分类**：调用AI服务，使用分类提示词对问答对进行分类
3. **存储分类结果**：
   - 将分类类别代码（如"2.3"）存储到 `category` 字段（兼容旧数据）
   - 将分类ID存储到 `category_id` 字段（新字段，关联到concern_categories表）
   - 将问题性质代码（如"I1"）存储到 `intent_code` 字段

### 查询示例

```typescript
// 查询某个分类下的所有问答对
const concerns = await prisma.concerns.findMany({
  where: {
    category_id: 'category-id-here'
  },
  include: {
    concern_categories: true
  }
})

// 查询某个问题性质的所有问答对
const concerns = await prisma.concerns.findMany({
  where: {
    intent_code: 'I1'
  }
})

// 查询分类统计
const stats = await prisma.concern_categories.groupBy({
  by: ['type', 'level'],
  _count: true
})
```

## 注意事项

1. **兼容性**：`concerns.category` 字段保留，用于兼容旧数据，新数据建议同时填充 `category_id`
2. **数据完整性**：分类数据通过 seed 脚本初始化，如需修改分类体系，请更新 seed 文件后重新执行
3. **索引优化**：已为 `category_id` 和 `intent_code` 字段创建索引，提升查询性能

## 相关文件

- `prisma/schema.prisma`: 数据库模型定义
- `prisma/seed-concern-categories.js`: 分类数据初始化脚本
- `docs/api/`: 接口文档（待补充AI分类接口文档）

