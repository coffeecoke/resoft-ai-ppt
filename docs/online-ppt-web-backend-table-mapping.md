# online-ppt-web 前端功能 × 后台数据表对照

> **前端工程**：`online-ppt-web`（Vue3 + Vite）  
> **后台工程**：`online-ppt-backend`（Express + Prisma + MySQL）  
> **API 代理**：前端 `/api` → 后端 `http://localhost:5001`  
> **数据库表详情**：见 [`db-schema-ascii.md`](./db-schema-ascii.md)

**最后更新**：2026-03-27

---

## 一、说明与约定

### 1.1 文档存储双模式

`documents` / `templates` 受环境变量 `USE_DATABASE` 控制：
- `USE_DATABASE=true`：元数据落库，写入 `documents` / `templates` 表；
- 未启用：以 `DATA_DIR` 下 JSON 文件为主（阅读次数等少量字段仍可能更新库）。

下文"**主要写表**"在启用库模式下成立。

### 1.2 尚无真实接口（前端 Mock）

| 页面入口 | 说明 |
|----------|------|
| `/sales/competitor`（竞品分析） | 纯静态展示，无 API |
| `/sales/profile` 里「交流会议 / 收藏 / 下载」Tab | `sessions` 列表为前端写死 Mock；PPT 回传与「我的 PPT」走真实接口 |
| `/admin/system/role`（角色管理） | 后端 `roleService` 返回 Mock，**无对应 Prisma 表** |
| `/admin/system/dept`（部门管理） | 后端 `deptService` 返回 Mock，库中有 `departments` 表但未接 |

---

## 二、全功能 × API × 表 对照（主表）

| # | 前端路径 / 功能 | 主要 Service / 组件 | 后端路由（示例） | 主要读表 | 主要写表 |
|---|----------------|--------------------|--------------------|---------|---------|
| **认证** |
| 1 | `/login` 登录 | `authService` | `POST /auth/login` | `users` | `users`（login_count）, `audit_logs` |
| 2 | 修改密码 | `authService` | `PUT /auth/password` | `users` | `users`（password_hash） |
| **售前平台首页 `/sales/home`** |
| 3 | 产品统计看板 | `getProductStats` | `GET /sales/products/stats` | `products`, `transcriptions`, `documents`, `concerns`, `session_concerns` | — |
| 4 | 产品目录 + 版本切换 | `productCatalogService` | `GET /sales/product-catalogs` | `product_catalogs`, `thumbnails` | — |
| 5 | 产品—文档对应 | `productCatalogService` | `GET /sales/products/:code/documents` | `product_documents`, `documents` | — |
| 6 | 幻灯片缩略图展示 | `productCatalogService` | `GET /sales/thumbnails` | `thumbnails` | — |
| 7 | 交流会议（视频）列表 | `VideoPageView`, `getTranscriptionList` | `GET /sales/transcriptions` | `transcriptions` | — |
| 8 | 会议详情 + QA | `getTranscriptionDetail`, `getTranscriptionConcerns` | `GET /sales/transcriptions/:id`, `.../concerns` | `transcriptions`, `concerns` | — |
| 9 | 会议分析报告 | `getTranscriptionAnalysis` | `GET /sales/transcriptions/:id/analysis` | `presales_analysis_results` | — |
| 10 | 招标文件列表 | `tenderDocumentService` | `GET /sales/tender-documents` | `tender_documents` | — |
| 11 | 招标文件章节 TOC | `getTenderDocumentDetail` | `GET /sales/tender-documents/:id` | `tender_documents`, `tender_sections` | — |
| 12 | 响应文件（投标库）列表 | `bidDocumentService` | `GET /sales/bid-documents` | `bid_documents` | — |
| 13 | 响应文件章节 | `bidDocumentService` | `GET /sales/bid-documents/:id`, `.../sections` | `bid_sections`, `bid_section_types` | — |
| 14 | 章节合并下载 | `useMergeDownload` | `POST /sales/bid-compositions/merge-download` | `bid_sections` | — |
| **PPT 对话 / 分析** |
| 15 | PPT 幻灯片对话（Chat） | `PptDialog.vue` | `POST /sales/documents/:id/chat`（SSE） | `documents`, `slide_merged_contents`, `thumbnails` | — |
| 16 | PPT 幻灯片批量分析 | `PptDialog.vue` | `POST /sales/documents/:id/analyze-slides`（SSE） | `documents`, `thumbnails` | — |
| 17 | PPT 摘要生成 | `PptDialog.vue` | `POST /sales/documents/:id/summary`（SSE） | `documents`, `slide_merged_contents` | — |
| 18 | 批量分析（多文档） | `useBatchAnalyze` | `POST /sales/batch-operations/analyze`（SSE） | `documents`, `slide_merged_contents` | — |
| 19 | 批量导出 PPT | `useBatchExport` | `POST /sales/documents/batch-fetch` | `documents` | — |
| **售前 / 个人中心** |
| 20 | PPT 回传上传 | `uploadSalesPpt` | `POST /sales/profile/ppt/upload` | `products` | `documents` |
| 21 | 我的 PPT 列表 | `getSalesPptList` | `GET /sales/profile/ppt/list` | `documents` | — |
| **售前搜索** |
| 22 | 产品搜索 `/sales/product-search` | `productCatalogService` + `salesService` | 复用产品目录接口 | `product_catalogs`, `documents`, `thumbnails` | — |
| 23 | 客户搜索 `/sales/customer-search` | 复用 concerns / documents 接口 | — | `concerns`, `documents` | — |
| 24 | 问题搜索 `/sales/question-search` | `concernsApi` | `GET /api/sales/concerns` | `concerns`, `transcriptions` | — |
| **客户关心问题 `/sales/qa`** |
| 25 | 问题列表（无限滚动/游标） | `concernsApi.getConcerns` | `GET /api/sales/concerns` | `concerns`, `transcriptions` | — |
| 26 | 热搜榜 Top10 | `concernsApi.getHotConcerns` | `GET /api/sales/concerns/hot` | `concerns` | — |
| 27 | 问题详情 | `concernsApi.getConcernDetail` | `GET /api/sales/concerns/:id` | `concerns`, `transcriptions` | — |
| 28 | 问题点赞 | `concernsApi.likeConcern` | `POST /api/sales/concerns/:id/like` | `concerns` | `concerns`（likes） |
| 29 | 分类目录树 | `concernsApi.getConcernCategories` | `GET /api/sales/concern-categories` | `concern_categories` | — |
| **PPT 编辑器 `/ppt/editor`** |
| 30 | 加载文档数据 | `PPT/Layout.vue` | `GET /templates/:id` 或 `GET /documents/:id` | `templates` 或 `documents` | — |
| 31 | 自动保存模板 | `useAutoSave` | `PUT /templates/:templateId` | `templates` | `templates` |
| 32 | 保存文档 | `useEditorSave` | `PUT /documents/:id` 或 `PUT /templates/:id` | — | `documents` 或 `templates` |
| 33 | 上传封面图 | `useEditorSave` | `POST /templates/:id/cover` | — | `templates`（cover） |
| 34 | 上传幻灯片缩略图 | `useEditorSave` | `POST /templates/:id/thumbnails/:slideId` | — | `templates`（cover 同步），磁盘 snapshots |
| 35 | 发布 / 取消发布 | `EditorHeader` | `POST /documents/:id/publish` | — | `documents`（status） |
| **我的文档 `/ppt/docs`** |
| 36 | 文档列表 | `documentService.getDocumentList` | `GET /documents` | `documents` | — |
| 37 | 打开 / 查看计数 | `documentService` | `POST /documents/:id/view` | `documents` | `documents`（view_count） |
| 38 | 新建文档 | `documentService.createDocument` | `POST /documents/create` | — | `documents` |
| 39 | 删除文档 | `documentService.deleteDocument` | `DELETE /documents/:id` | — | `documents`（软删/物理删） |
| 40 | 文档复制 | `documentService.duplicateDocument` | `POST /documents/:id/duplicate` | `documents` | `documents` |
| 41 | 重命名 / 元数据更新 | `documentService.updateDocumentMetadata` | `PATCH /documents/:id/metadata` | — | `documents` |
| 42 | 插入幻灯片 | `documentService` | `POST /documents/:id/slides/insert` | — | `documents`（slide_count 等）或文件 |
| 43 | 删除幻灯片 | `documentService` | `DELETE /documents/:id/slides` | — | 同上 |
| 44 | 幻灯片重排 | `documentService` | `PATCH /documents/:id/slides/reorder` | — | 同上 |
| **缩略图** |
| 45 | 上传单个缩略图 | `thumbnailService` | `POST /thumbnails/upload` | — | 磁盘 snapshots |
| 46 | 查询文档缩略图 | `thumbnailService` | `GET /thumbnails/document/:documentId` | `thumbnails`（若 DB 模式） | — |
| 47 | 删除缩略图 | `thumbnailService` | `DELETE /thumbnails/:documentId/:slideId` | — | `thumbnails` |
| **模板管理（PPT 布局下）** |
| 48 | 模板列表 | `templateService` | `GET /templates` | `templates` | — |
| 49 | 新建模板 | `templateService` | `POST /templates/create` | — | `templates` |
| 50 | 删除模板 | `templateService` | `DELETE /templates/:id` | — | `templates` |
| **管理后台 `/admin`** |
| 51 | 模版管理（admin doc） | `templateService` | `/templates/*` | `templates` | `templates` |
| 52 | 文档管理 | `documentService` | `/documents/*` | `documents` | `documents` |
| 53 | 文件扫描 | `fileScanService` | `GET /api/admin/file-scan/*` | `file_scan_history` | `file_scan_history` |
| 54 | 字典类型管理 | `dictService` | `GET/POST/PUT/DELETE /api/admin/system/dict/types` | `dict_types` | `dict_types` |
| 55 | 字典数据管理 | `dictService` | `GET/POST/PUT/DELETE /api/admin/system/dict/data` | `dict_data` | `dict_data` |
| 56 | 产品解决方案 | `admin productService` | `GET/POST/PUT/DELETE /api/admin/system/product` | `products`, `documents` | `products` |
| 57 | 用户管理 | `systemService` | `GET/POST/PUT/DELETE /api/admin/system/user` | `users` | `users`, `audit_logs` |
| 58 | 角色管理 | `systemService` | `GET/POST/PUT/DELETE /api/admin/system/role` | **无表（Mock）** | — |
| 59 | 部门管理 | `systemService` | `GET/POST/PUT/DELETE /api/admin/system/dept` | **无表（Mock）** | — |
| **OnlyOffice 文档编辑** |
| 60 | 获取编辑器 Token | `wopiService` | `POST /wopi/token` | `personal_documents` | — |
| 61 | 编辑器配置 | `wopiService` | `GET /wopi/editor-config/:id` | `personal_documents` | — |
| 62 | 合并章节并创建个人文档 | `wopiService` | `POST /personal-documents/merge-and-edit` | `bid_sections`, `tender_sections` | `personal_documents` |
| 63 | 个人文档列表 | `wopiService` | `GET /personal-documents` | `personal_documents` | — |
| 64 | 删除个人文档 | `wopiService` | `DELETE /personal-documents/:id` | — | `personal_documents` |
| 65 | 重命名个人文档 | `wopiService` | `PUT /personal-documents/:id/rename` | — | `personal_documents` |
| **全局工具** |
| 66 | 数据字典下拉选项 | `@/utils/dict` | `GET /api/admin/system/dict/type/:dictType` | `dict_data` | — |

---

## 三、关键数据流梳理

### 3.1 PPT 文档生命周期

```
上传 PPTX → POST /documents/create
        └─ 写: documents (status=draft)
                └─ 缩略图生成队列 → POST /thumbnails/upload
                        └─ 写: 磁盘 snapshots/

编辑保存 → PUT /documents/:id
        └─ 写: documents (content_file_path / slide_count)

发布 → POST /documents/:id/publish
     └─ 写: documents (status=published)

PPT 回传（售前） → POST /sales/profile/ppt/upload
                └─ 读: products (name→code转换)
                └─ 写: documents (tag=practical)
```

### 3.2 产品目录与文档关联

```
admin 产品管理 → products (CRUD)
              └─ product_catalogs (目录树)
              └─ product_documents (关联文档 + catalog_id + version)

前端展示目录 → GET /sales/product-catalogs
            └─ 读: product_catalogs, thumbnails
```

### 3.3 转录会议完整链路

```
（由 ai_backend 处理转录，online-ppt-web 只做只读展示）

前端展示: GET /sales/transcriptions → 读: transcriptions
前端展示: GET /sales/transcriptions/:id/concerns → 读: concerns
前端展示: GET /sales/transcriptions/:id/analysis → 读: presales_analysis_results
```

---

## 四、模块 × 涉及表汇总

| 模块 | 涉及表（读+写） |
|------|----------------|
| 认证 | `users`, `audit_logs` |
| 产品看板 / 目录 | `products`, `product_catalogs`, `product_documents`, `documents`, `thumbnails`, `transcriptions`, `concerns`, `session_concerns` |
| 交流会议（只读） | `transcriptions`, `concerns`, `presales_analysis_results` |
| 招标 / 投标展示 | `tender_documents`, `tender_sections`, `bid_documents`, `bid_sections`, `bid_section_types` |
| 章节合并下载 | `bid_sections` |
| 客户问题 / QA | `concerns`, `concern_categories`, `transcriptions` |
| PPT 编辑器 / 文档 | `documents`, `templates` |
| 缩略图 | `thumbnails`（部分场景无 DB） |
| 个人文档 / OnlyOffice | `personal_documents`, `bid_sections`, `tender_sections` |
| 管理后台 | `users`, `audit_logs`, `products`, `documents`, `templates`, `dict_types`, `dict_data`, `file_scan_history` |
| 角色 / 部门 | **无表（Mock）** |

---

## 五、未在主流程使用但库中存在的表（online-ppt-web 视角）

下列表在当前前端页面中**没有直接 API 操作**（可能由后台任务、ai_backend 或未完成功能使用）：

| 表名 | 备注 |
|------|------|
| `sessions` | 完整 CRUD 在 ai_backend 中；web 端只做只读展示 |
| `document_concerns`, `session_concerns` | 关联由 ai_backend 的转录 QA 提取流程写入 |
| `slide_analysis_review_records` | 由 ai_backend `ppt-analysis` 模块写入 |
| `slide_merged_contents` | 由 ai_backend 文本提取写入；web 端只读 |
| `dialogue_adjustments` | 由 ai_backend 转录处理写入 |
| `presales_video_tasks` | 由 ai_backend 售前视频流程管理 |
| `ai_model_configs`, `prompt_templates` | 由 ai_backend 管理后台维护 |
| `concern_review_records` | 由 ai_backend QA 审核流程写入 |
| `bid_compositions`, `bid_composition_items` | 由 ai_backend 投标组合服务维护 |
| `bid_directory_items` | 由 ai_backend 招标分析服务写入 |
| `communication_reports`, `leads`, `customers` | CRM 同步数据，web 端尚未集成 |
| `scraping_infos` | 由 ai_backend 爬虫服务写入 |
