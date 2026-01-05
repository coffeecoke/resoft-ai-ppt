# 数据迁移架构图

## 📊 迁移前后对比

```mermaid
graph TB
    subgraph 迁移前架构
        A1[AI Backend] -->|查询| B1[content_categories_ppt]
        B1 -->|返回分类| A1
        style B1 fill:#ff9999
    end
    
    subgraph 迁移后架构
        A2[AI Backend] -->|1.查询通用产品| C1[products]
        C1 -->|返回产品ID| A2
        A2 -->|2.查询分类| B2[product_catalogs]
        B2 -->|返回分类| A2
        B2 -.关联.-> C1
        style B2 fill:#99ff99
        style C1 fill:#99ccff
    end
```

## 🔄 数据流转图

```mermaid
sequenceDiagram
    participant AI as AI分析服务
    participant DB1 as products表
    participant DB2 as product_catalogs表
    participant DB3 as thumbnails表
    
    Note over AI,DB3: AI分析PPT页面
    
    AI->>DB1: 查询通用产品<br/>(code='general_ppt_categories')
    DB1-->>AI: 返回产品ID
    
    AI->>DB2: 查询分类标准<br/>(product_id + is_active=true)
    DB2-->>AI: 返回所有分类
    
    Note over AI: AI分析页面内容<br/>匹配分类
    
    AI->>DB2: 根据category_code查询分类名称
    DB2-->>AI: 返回分类详情
    
    AI->>DB3: 更新page_type<br/>page_type_confidence<br/>analyzed_at
    DB3-->>AI: 更新成功
```

## 🏗️ 数据库结构变化

### 迁移前：独立的分类表

```mermaid
erDiagram
    content_categories_ppt {
        varchar id PK
        varchar parent_id FK
        varchar name
        varchar code UK
        int level
        text description
        int sort_order
        boolean is_active
    }
    
    content_categories_ppt ||--o{ content_categories_ppt : "parent-child"
```

### 迁移后：关联产品的目录体系

```mermaid
erDiagram
    products {
        varchar id PK
        varchar name
        varchar code UK
        text description
        boolean is_active
    }
    
    product_catalogs {
        varchar id PK
        varchar product_id FK
        varchar parent_id FK
        varchar name
        varchar code
        int level
        text description
        int sort_order
        boolean is_active
    }
    
    products ||--o{ product_catalogs : "has many"
    product_catalogs ||--o{ product_catalogs : "parent-child"
```

## 📂 代码调用链变化

### 迁移前：单表查询

```mermaid
graph LR
    A[pptAnalysisService] -->|1步查询| B[content_categories_ppt]
    B --> C[返回分类列表]
    
    style A fill:#99ccff
    style B fill:#ff9999
    style C fill:#99ff99
```

### 迁移后：两步查询

```mermaid
graph LR
    A[pptAnalysisService] -->|1.查询产品| B[products]
    B -->|返回产品ID| A
    A -->|2.查询分类| C[product_catalogs]
    C --> D[返回分类列表]
    
    style A fill:#99ccff
    style B fill:#ffcc99
    style C fill:#99ff99
    style D fill:#ccff99
```

## 🔍 分类结构可视化

```mermaid
graph TD
    Root[通用PPT内容分类<br/>general_ppt_categories]
    
    Root --> L1_1[企业信息<br/>enterprise_info]
    Root --> L1_2[合作案例<br/>cooperation_cases]
    Root --> L1_3[监管政策与行业背景<br/>regulatory_policy_industry]
    Root --> L1_4[产品解决方案<br/>product_solutions]
    Root --> L1_5[部署实施及售后保障<br/>deployment_after_sales]
    Root --> L1_6[其他<br/>other]
    
    L1_1 --> L2_1_1[企业基础信息]
    L1_1 --> L2_1_2[企业资质认证]
    L1_1 --> L2_1_3[业务条线介绍]
    L1_1 --> L2_1_4[业务咨询实力]
    L1_1 --> L2_1_5[技术研发实力]
    L1_1 --> L2_1_6[工程交付实力]
    
    L1_2 --> L2_2_1[监管合作]
    L1_2 --> L2_2_2[机构合作]
    
    L1_3 --> L2_3_1[监管发文与背景分析]
    L1_3 --> L2_3_2[行业发展趋势]
    L1_3 --> L2_3_3[监管相关要求]
    
    L1_4 --> L2_4_1[客户痛点/难点]
    L1_4 --> L2_4_2[解决方案概述]
    L1_4 --> L2_4_3[产品架构设计]
    L1_4 --> L2_4_4[产品功能详解]
    L1_4 --> L2_4_5[Demo 与交互演示]
    L1_4 --> L2_4_6[产品优势说明]
    L1_4 --> L2_4_7[产品应用场景]
    L1_4 --> L2_4_8[软硬件资源需求]
    
    L1_5 --> L2_5_1[实施服务流程]
    L1_5 --> L2_5_2[售后服务保障]
    
    L1_6 --> L2_6_1[其他内容]
    
    style Root fill:#ff9999
    style L1_1 fill:#99ccff
    style L1_2 fill:#99ccff
    style L1_3 fill:#99ccff
    style L1_4 fill:#99ccff
    style L1_5 fill:#99ccff
    style L1_6 fill:#99ccff
```

## 📊 迁移统计图

```mermaid
pie title 分类分布统计
    "企业信息" : 6
    "合作案例" : 2
    "监管政策与行业背景" : 3
    "产品解决方案" : 8
    "部署实施及售后保障" : 2
    "其他" : 1
```

## ✅ 迁移进度看板

```mermaid
gantt
    title 数据迁移进度
    dateFormat YYYY-MM-DD
    section 数据库
    创建迁移脚本           :done, 2026-01-04, 1h
    创建验证脚本           :done, 2026-01-04, 1h
    执行数据迁移           :done, 2026-01-04, 5m
    验证数据完整性         :done, 2026-01-04, 5m
    section 代码
    更新pptAnalysisService :done, 2026-01-04, 30m
    更新pptAnalysisRoutes  :done, 2026-01-04, 30m
    更新文档               :done, 2026-01-04, 30m
    section 测试
    单元测试               :active, 2026-01-04, 2h
    集成测试               :2026-01-04, 2h
    功能验证               :2026-01-04, 1h
```

## 🎯 迁移效果对比

| 指标 | 迁移前 | 迁移后 | 变化 |
|-----|-------|-------|-----|
| **数据表数量** | 1 个独立表 | 2 个关联表 | 架构更规范 |
| **查询步骤** | 1 步 | 2 步 | 增加1次查询 |
| **扩展性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | 支持多产品分类 |
| **数据完整性** | ✅ | ✅ | 保持一致 |
| **代码复杂度** | 简单 | 稍复杂 | 可通过缓存优化 |
| **维护性** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 统一架构 |

---

**图表生成时间**: 2026-01-04

