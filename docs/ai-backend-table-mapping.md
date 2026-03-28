# ai_backend 前端功能 × 后台数据表对照

> **前端**：`ai_backend/frontend/`（原生 HTML + Vanilla JS）  
> **后台**：`ai_backend/server/`（Express + Node.js）  
> **数据库**：共用 `online-ppt-backend/prisma/schema.prisma`（MySQL）  
> **数据库表详情**：见 [`db-schema-ascii.md`](./db-schema-ascii.md)

**最后更新**：2026-03-27

---

## 一、页面总览

| 页面文件 | 页面标题 | 对应路由前缀 |
|---------|---------|------------|
| `index.html` | 文档文本提取器（Web版） | `/api/documents` |
| `documents.html` | 文档管理 | `/api/documents` |
| `pages/document-manage.html` | 文档管理（新版） | `/api/documents` |
| `transcription.html` | 语音转文本（旧入口） | `/api/transcription` |
| `pages/transcription.html` | 语音转录（主功能页） | `/api/transcription`, `/api/sessions`, `/api/products`, `/api/qa` |
| `analysis.html` | PPT AI 内容分析（旧入口） | `/api/ppt-analysis` |
| `pages/ppt-analysis.html` | PPT 页面分析（主功能页） | `/api/ppt-analysis`, `/api/documents`, `/api/admin/models`, `/api/admin/prompts` |
| `pages/presales-analysis.html` | 售前交流综合分析 | `/api/presales-analysis` |
| `pages/presales-video.html` | 售前视频生成 | `/api/presales-video` |
| `pages/tender-analysis.html` | 招标文件分析 | `/api/tender-analysis` |
| `pages/bid-analysis.html` | 投标文件分析 | `/api/bid-analysis` |
| `pages/auto-process.html` | 自动跑批监控 | `/api/auto-process` |
| `pages/qa-management.html` | QA 问答管理 | `/api/qa`, `/api/transcription` |
| `pages/model-config.html` | AI 模型配置 | `/api/admin/models` |
| `pages/prompt-templates.html` | 提示词模板管理 | `/api/admin/prompts` |
| `pages/dashboard.html` | 系统仪表盘 | `/api/admin/system` |
| `pages/scraper.html` | 智能爬虫 | `/api/intelligent-scraper` |
| `admin.html` | AI 管理后台（导航入口） | 导航页，不直接调接口 |
| `test-prompts.html` | 提示词API测试 | `/api/admin/prompts` |

---

## 二、全功能 × API × 表 对照（主表）

---

### 模块 1：文档文本提取（`index.html` / `documents.html` / `pages/document-manage.html`）

**功能**：列出 PPT 文档、提取幻灯片文本内容（为后续分析做准备）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 文档列表（含提取状态） | `GET /api/documents/list` | `documents`, `slide_merged_contents`（统计已提取数） | — |
| 单文档提取文本 | `POST /api/documents/:id/extract` | `documents` | `slide_merged_contents` |
| 提取状态查询 | `GET /api/documents/:id/extract-status` | `documents`, `slide_merged_contents` | — |
| 批量提取文本 | `POST /api/documents/batch-extract` | `documents` | `slide_merged_contents` |

**核心表关系**：
```
documents ──1:N──► slide_merged_contents
  （每张幻灯片对应一条 merged_content 记录）
```

---

### 模块 2：语音转录（`pages/transcription.html`）

**功能**：上传音频 → 讯飞转录 → AI 纠错 → 对话角色调整 → QA 提取 → QA 分类

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 上传音频文件 | `POST /api/transcription/upload` | — | `transcriptions`（status=uploading→processing） |
| 查询转录列表 | `GET /api/transcription` | `transcriptions` | — |
| 查询转录详情 | `GET /api/transcription/:id` | `transcriptions`, `dialogue_adjustments` | — |
| 获取音频流 | `GET /api/transcription/:id/audio` | `transcriptions`（file_path） | — |
| 更新转录信息 | `PUT /api/transcription/:id` | — | `transcriptions` |
| 删除转录 | `DELETE /api/transcription/:id` | — | `transcriptions`（级联删 dialogue_adjustments 等） |
| **AI 纠错**（AI Correction） | `POST /api/transcription/:id/ai-correction` | `transcriptions`, `dialogue_adjustments`（读已有调整） | `dialogue_adjustments`（create/update，type=ai_correction） |
| 应用 AI 纠错结果 | `PUT /api/transcription/:id/apply-corrections` | `dialogue_adjustments` | `transcriptions`（dialogues 字段） |
| **角色判断**（AI Role Judgment） | `POST /api/transcription/:id/role-judgment` | `transcriptions`, `dialogue_adjustments` | `dialogue_adjustments`（create/update，type=role_judgment） |
| 角色设置（手动） | `PUT /api/transcription/:id/role-settings` | `dialogue_adjustments` | `transcriptions`（speaker_roles）, `dialogue_adjustments` |
| 对话内容更新 | `PUT /api/transcription/:id/dialogues` | `dialogue_adjustments` | `dialogue_adjustments`（update/create） |
| **重新合并对话** | `POST /api/transcription/:id/re-merge` | `dialogue_adjustments`（读各调整记录） | `dialogue_adjustments`（create 新 re-merge 记录） |
| **合并对话**（前端手动触发） | `POST /api/transcription/:id/merge-dialogues` | `transcriptions` | `transcriptions`（更新 dialogues） |
| **QA 提取**（AI 自动提取问答对） | `POST /api/transcription/:id/qa-extraction` | `transcriptions`, `dialogue_adjustments`, `sessions` | `concerns`（批量创建）, `session_concerns`（若绑定场次） |
| 查询 QA 列表 | `GET /api/transcription/:id/qa-pairs` | `concerns`, `session_concerns` | — |
| **QA 分类**（AI 分类单条） | `POST /api/transcription/:id/qa-classification` | `concern_categories` | `concerns`（更新 category_code/intent_code） |
| QA 分类（单条，独立接口） | `POST /api/transcription/concern/:id/classification` | `concern_categories` | `concerns` |
| QA 批量分类 | `POST /api/transcription/concerns/batch-classification` | `transcriptions`, `dialogue_adjustments`, `concern_categories` | `concerns`（批量更新） |
| 关联产品下拉 | `GET /api/products` | `products` | — |
| 关联场次下拉 | `GET /api/sessions/recent` | `sessions` | — |
| **文件扫描**（批量导入音频） | `GET/PUT /api/transcription/scan/config` | `audioScanConfig.json`（文件） | `audioScanConfig.json` |
| 扫描文件列表 | `GET /api/transcription/scan/files` | 磁盘文件 + `transcriptions`（已处理状态） | — |
| 批量转录 | `POST /api/transcription/scan/transcribe` | — | `transcriptions`（批量创建） |

**核心表关系**：
```
sessions ──► transcriptions ──1:N──► dialogue_adjustments
                             └─1:N──► concerns ──M:N──► session_concerns → sessions
                                      └─► concern_categories（分类）
```

---

### 模块 3：PPT 页面分析（`pages/ppt-analysis.html`）

**功能**：读取幻灯片合并文本 → AI 分析页面类型 → 写入 thumbnails.page_type → 人工审核

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 触发文档分析 | `POST /api/ppt-analysis/analyze/:documentId` | `documents`, `slide_merged_contents`, `product_catalogs`, `prompt_templates` | `thumbnails`（page_type, page_type_confidence, analyzed_at） |
| 查询分析状态（轮询） | `GET /api/ppt-analysis/analyze/:documentId` | `thumbnails`（统计分析进度） | — |
| 查询所有文档分析结果 | `GET /api/ppt-analysis/results` | `documents`, `thumbnails` | — |
| 查询单文档分析结果 | `GET /api/ppt-analysis/results/:documentId` | `documents`, `thumbnails`, `product_catalogs` | — |
| 查询分类目录 | `GET /api/ppt-analysis/categories` | `product_catalogs` | — |
| **单页手动纠正** | `POST /api/ppt-analysis/correct-single` | `documents`, `product_catalogs`, `thumbnails` | `thumbnails`（page_type）, `slide_analysis_review_records`（create） |
| **审核（单条）** | `POST /api/ppt-analysis/review` | `thumbnails` | `thumbnails`（review_status）, `slide_analysis_review_records`（create） |
| **审核（批量）** | `POST /api/ppt-analysis/review/batch` | `thumbnails` | `thumbnails`（review_status 批量）, `slide_analysis_review_records`（批量 create） |
| 文档分析统计 | `GET /api/ppt-analysis/statistics/:documentId` | `documents`, `thumbnails`, `product_catalogs` | — |
| 提示词列表 | `GET /api/ppt-analysis/prompts` | `prompt_templates` | — |
| 提示词 CRUD | `POST/PUT/DELETE/PATCH /api/ppt-analysis/prompts*` | `prompt_templates` | `prompt_templates` |
| 获取默认 AI 模型 | `GET /api/admin/models/default/ppt_analysis` | `ai_model_configs` | — |
| 获取分析提示词 | `GET /api/admin/prompts/scenes/ppt_analysis` | `prompt_templates` | — |
| 缩略图列表 | `GET /api/thumbnails/document/:documentId`（跨服务） | `thumbnails` | — |

**核心表关系**：
```
documents ──► slide_merged_contents（分析用文本输入）
product_catalogs（分类定义） ──► thumbnails（写 page_type）
                                └─► slide_analysis_review_records（审核历史）
prompt_templates（AI Prompt）
ai_model_configs（模型选择）
```

---

### 模块 4：售前交流综合分析（`pages/presales-analysis.html`）

**功能**：基于转录对话，用 AI 生成综合分析报告（客户需求、产品匹配等）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 转录列表（分页） | `GET /api/presales-analysis/transcriptions` | `transcriptions` | — |
| 对指定转录触发分析 | `POST /api/presales-analysis/analyze/transcription/:id` | `transcriptions`, `dialogue_adjustments`, `sessions`, `ai_model_configs`, `prompt_templates` | `presales_analysis_results`（create/update） |
| 自由文本分析 | `POST /api/presales-analysis/analyze` | `ai_model_configs`, `prompt_templates` | — （结果不落库） |
| 查询分析结果 | `GET /api/presales-analysis/results/transcription/:id` | `presales_analysis_results` | — |
| 场次详情 | `GET /api/sessions/:id`（presalesAnalysis 内部调用） | `sessions` | — |

**核心表关系**：
```
transcriptions ──► dialogue_adjustments（取调整后对话作为输入）
             └──► presales_analysis_results（写入分析结果）
sessions（补充会议元数据）
ai_model_configs + prompt_templates（AI 配置）
```

---

### 模块 5：售前视频生成（`pages/presales-video.html`）

**功能**：转录 → 推送对话到 Coze → Coze 工作流分析 → 推送分析报告 → 视频生成流水线

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 转录列表（含任务状态） | `GET /api/presales-video/transcriptions` | `transcriptions`, `presales_video_tasks` | — |
| 推送对话到 Coze | `POST /api/presales-video/transcriptions/:id/push-dialogue` | `transcriptions`, `dialogue_adjustments` | `presales_video_tasks`（create/update pipeline_status, coze_file_id） |
| 提交 Coze 工作流 | `POST /api/presales-video/transcriptions/:id/submit-workflow` | `transcriptions`, `presales_video_tasks` | `presales_video_tasks`（update execute_id, pipeline_status）, `presales_analysis_results`（create） |
| 工作流完成回调 | `POST /api/presales-video/workflow-callback` | `presales_video_tasks` | `presales_video_tasks`（按 execute_id 更新 pipeline_status、`analysis_content` / `video_address`） |
| 查询分析报告 | `GET /api/presales-video/transcriptions/:id/report` | `presales_analysis_results` | — |
| 推送分析报告 | `POST /api/presales-video/transcriptions/:id/push-report` | `transcriptions`, `presales_analysis_results` | `presales_video_tasks`（update pipeline_status） |
| 查询视频状态 | `GET /api/presales-video/transcriptions/:id/video` | `transcriptions`, `presales_video_tasks` | — |

**核心表关系**：
```
transcriptions ──1:1──► presales_video_tasks（流水线状态机）
             └──1:N──► presales_analysis_results（分析结果）
```

**流水线状态**：
```
推送对话 → 提交工作流 → 分析中 → 分析完成 → 推送分析文件 → 视频生成
```

---

### 模块 6：招标文件分析（`pages/tender-analysis.html`）

**功能**：上传招标文件 → AI 提取结构 → 生成投标目录树 → 编辑目录内容 → 导出 DOCX

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 上传招标文件 | `POST /api/tender-analysis/upload` | — | `tender_documents`（create，status=uploaded） |
| 触发 AI 分析 | `POST /api/tender-analysis/analyze/:tenderId` | `tender_documents` | `tender_documents`（status: extracting→analyzing→completed）, `bid_directory_items`（批量 create 目录树） |
| 轮询分析状态 | `GET /api/tender-analysis/analyze/:tenderId` | `tender_documents` | — |
| 招标文件列表 | `GET /api/tender-analysis/list` | `tender_documents` | — |
| 招标文件详情 | `GET /api/tender-analysis/:tenderId` | `tender_documents` | — |
| 获取目录树 | `GET /api/tender-analysis/:tenderId/directory` | `bid_directory_items` | — |
| **编辑目录项内容** | `PUT /api/tender-analysis/directory/:itemId` | — | `bid_directory_items`（user_content, content_status） |
| AI 重新生成目录项 | `POST /api/tender-analysis/:tenderId/directory/regenerate/:itemId` | `tender_documents`, `bid_directory_items` | `bid_directory_items`（default_content） |
| **导出 DOCX** | `GET /api/tender-analysis/:tenderId/export-docx` | `tender_documents`, `bid_directory_items` | 磁盘 DOCX 文件 |
| 删除招标文件 | `DELETE /api/tender-analysis/:tenderId` | — | `tender_documents`（级联删 bid_directory_items, tender_sections） |

**核心表关系**：
```
tender_documents ──1:N──► bid_directory_items（AI 生成目录树，自关联 parent_id）
                └──1:N──► tender_sections（从原始 DOCX 解析的章节 TOC）
```

---

### 模块 7：投标文件分析（`pages/bid-analysis.html`）

**功能**：上传历史投标文件 → AI 拆分章节 → 章节检索复用 → 章节类型管理

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 上传投标文件 | `POST /api/bid-analysis/upload` | — | `bid_documents`（create，status=uploaded） |
| 触发 AI 拆分 | `POST /api/bid-analysis/analyze/:bidDocId` | `bid_documents`, `bid_section_types` | `bid_documents`（status: extracting→splitting→completed）, `bid_sections`（批量 create） |
| 轮询拆分状态 | `GET /api/bid-analysis/analyze/:bidDocId` | `bid_documents` | — |
| 投标文件列表 | `GET /api/bid-analysis/list` | `bid_documents` | — |
| 投标文件详情 | `GET /api/bid-analysis/:bidDocId` | `bid_documents` | — |
| 章节列表 | `GET /api/bid-analysis/:bidDocId/sections` | `bid_sections` | — |
| 编辑章节（质量评分等） | `PUT /api/bid-analysis/sections/:sectionId` | — | `bid_sections` |
| **章节全文检索** | `GET /api/bid-analysis/sections/search` | `bid_sections`（FULLTEXT 索引） | — |
| 删除投标文件 | `DELETE /api/bid-analysis/:bidDocId` | — | `bid_documents`（级联删 bid_sections） |
| **章节类型列表** | `GET /api/bid-analysis/section-types` | `bid_section_types` | — |
| 创建章节类型 | `POST /api/bid-analysis/section-types` | — | `bid_section_types` |
| 编辑章节类型 | `PUT /api/bid-analysis/section-types/:id` | — | `bid_section_types` |
| 禁用章节类型 | `DELETE /api/bid-analysis/section-types/:id` | — | `bid_section_types`（is_active=false） |

**核心表关系**：
```
bid_documents ──1:N──► bid_sections（拆分后章节，FULLTEXT 检索）
bid_section_types（章节类型枚举，影响 AI 拆分 Prompt）
```

---

### 模块 8：投标组合（内嵌在招标分析 / 投标分析页）

**功能**：基于招标目录，从投标章节库中选择内容，组装成完整投标文件

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 创建投标组合 | `POST /api/bid-composition` | — | `bid_compositions`（create） |
| 组合列表 | `GET /api/bid-composition` | `bid_compositions` | — |
| 组合详情（含明细） | `GET /api/bid-composition/:id` | `bid_compositions`, `bid_composition_items` | — |
| 更新组合信息 | `PUT /api/bid-composition/:id` | — | `bid_compositions` |
| 删除组合 | `DELETE /api/bid-composition/:id` | — | `bid_compositions`（级联删 bid_composition_items） |
| 添加章节到组合 | `POST /api/bid-composition/:id/items` | `bid_sections`（可选） | `bid_composition_items`（create） |
| 从目录树批量导入 | `POST /api/bid-composition/:id/items/from-directory` | `bid_directory_items` | `bid_composition_items`（批量 create） |
| 编辑组合明细 | `PUT /api/bid-composition/items/:itemId` | — | `bid_composition_items` |
| 删除组合明细 | `DELETE /api/bid-composition/items/:itemId` | — | `bid_composition_items` |
| 批量排序 | `PATCH /api/bid-composition/:id/items/sort` | — | `bid_composition_items`（sort_order 批量更新） |

**核心表关系**：
```
tender_documents ──► bid_compositions（关联招标文件，可选）
                           └──1:N──► bid_composition_items
bid_sections（从章节库引用） ──────────────────────────────►
bid_directory_items（从目录树导入）
```

---

### 模块 9：QA 问答管理（`pages/qa-management.html`）

**功能**：管理从转录中提取的问答对，支持分类、审核、优化、导出

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 分类目录 | `GET /api/qa/categories` | `concern_categories` | — |
| **问答对列表**（分页 + 多维筛选） | `GET /api/qa/concerns` | `concerns`, `transcriptions`, `dialogue_adjustments` | — |
| 问答对详情 | `GET /api/qa/concerns/:id` | `concerns`, `transcriptions` | — |
| 审核上下文（展示原对话） | `GET /api/qa/concerns/:id/review-context` | `concerns`, `transcriptions`, `dialogue_adjustments` | — |
| **修改分类**（手动重分类） | `PATCH /api/qa/concerns/:id/classification` | `concern_categories` | `concerns`（category_code, intent_code） |
| **审核（通过 / 拒绝 / 修改后通过）** | `POST /api/qa/concerns/:id/review` | `concerns` | `concerns`（review_status）, `concern_review_records`（create） |
| **批量通过** | `POST /api/qa/review/batch-approve` | — | `concerns`（updateMany review_status） |
| **批量拒绝** | `POST /api/qa/review/batch-reject` | — | `concerns`（updateMany review_status） |
| **AI 优化单条**（问答内容润色） | `POST /api/qa/concerns/:id/optimize` | `concerns`, `prompt_templates`, `ai_model_configs` | `concerns`（question/answer 优化，备份 original） |
| **AI 批量优化** | `POST /api/qa/optimize-batch` | `concerns`, `prompt_templates`, `ai_model_configs` | `concerns`（批量更新） |
| **导出 Excel** | `GET /api/qa/concerns/export` | `concerns`, `transcriptions`, `dialogue_adjustments`, `concern_categories` | 磁盘 XLSX 文件（流式下载） |
| QA 分类用模型 | `GET /api/admin/models?scene_type=qa_classification` | `ai_model_configs` | — |
| QA 分类用提示词 | `GET /api/admin/prompts?scene_type=qa_classification` | `prompt_templates` | — |

**核心表关系**：
```
transcriptions ──► concerns ──► concern_categories（分类）
                       └──► concern_review_records（审核历史）
                       └──► document_concerns（关联文档，若配置）
                       └──► session_concerns（关联场次）
dialogue_adjustments（提供问答来源上下文）
```

---

### 模块 10：交流场次管理（内嵌在转录页 / API 独立提供）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 场次列表 | `GET /api/sessions` | `sessions` | — |
| 场次详情 | `GET /api/sessions/:id` | `sessions` | — |
| 创建场次 | `POST /api/sessions` | — | `sessions` |
| 更新场次 | `PUT /api/sessions/:id` | — | `sessions` |
| 删除场次 | `DELETE /api/sessions/:id` | — | `sessions`（级联删相关记录） |
| 场次统计 | `GET /api/sessions/statistics` | `sessions` | — |
| 最近场次（下拉） | `GET /api/sessions/recent` | `sessions` | — |

---

### 模块 11：产品管理（内嵌 / API 独立提供）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 产品列表 | `GET /api/products` | `products` | — |
| 产品详情 | `GET /api/products/:id` | `products` | — |
| 创建产品 | `POST /api/products` | — | `products` |
| 更新产品 | `PUT /api/products/:id` | — | `products` |
| 删除产品 | `DELETE /api/products/:id` | — | `products` |
| 调整排序 | `PATCH /api/products/sort-order` | — | `products`（sort_order） |
| 产品统计 | `GET /api/products/statistics` | `products` | — |

---

### 模块 12：自动跑批监控（`pages/auto-process.html`）

**功能**：三条自动化流水线的配置 + 监控（PPT 分析、音频转录、QA 提取）

| 流水线 | 路由前缀 | 自动操作涉及表 |
|--------|---------|--------------|
| **PPT 分析跑批** | `/api/auto-process/*` | 读 `documents`；写 `slide_merged_contents`（提取文本）, `thumbnails`（AI 分析 page_type） |
| **音频转录跑批** | `/api/auto-process/audio/*` | 读 `transcriptions`, `dialogue_adjustments`；写 `transcriptions`（状态更新）, `dialogue_adjustments`（AI 纠错/角色判断） |
| **QA 提取跑批** | `/api/auto-process/qa/*` | 读 `transcriptions`, `dialogue_adjustments`, `concerns`；写 `concerns`（批量创建），`concern_categories`（分类更新） |

| 功能点（通用，三条流水线各一套） | API 路由示例 | 涉及表 |
|--------------------------------|------------|--------|
| 查询状态 | `GET /api/auto-process/status` | 无（内存状态） |
| 启动 | `POST /api/auto-process/start` | 触发扫描相关表 |
| 停止 | `POST /api/auto-process/stop` | 无 |
| 配置获取/修改 | `GET/PUT /api/auto-process/config` | JSON 配置文件（磁盘） |
| 统计数据 | `GET /api/auto-process/statistics` | 读相关业务表（documents/transcriptions/concerns） |
| 日志 | `GET/DELETE /api/auto-process/logs` | 日志文件（磁盘） |
| 立即执行一次 | `POST /api/auto-process/run-once` | 同"启动"逻辑 |

---

### 模块 13：AI 模型配置（`pages/model-config.html`）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 模型配置列表（按场景） | `GET /api/admin/models` | `ai_model_configs` | — |
| 查询默认模型 | `GET /api/admin/models/default/:sceneType` | `ai_model_configs` | — |
| 创建 / 更新模型配置 | `POST/PUT /api/admin/models` | `ai_model_configs` | `ai_model_configs`（upsert） |
| 删除模型配置 | `DELETE /api/admin/models/:id` | — | `ai_model_configs` |
| 设为默认 | `PATCH /api/admin/models/:id/default` | — | `ai_model_configs`（is_default） |
| 测试可用性 | `POST /api/admin/models/:id/test` | `ai_model_configs` | `ai_model_configs`（is_available, last_check_at） |

---

### 模块 14：提示词模板管理（`pages/prompt-templates.html`）

| 功能点 | API 路由 | 读表 | 写表 |
|--------|---------|------|------|
| 模板列表（按场景/类型） | `GET /api/admin/prompts` | `prompt_templates` | — |
| 按场景查询 | `GET /api/admin/prompts/scenes/:sceneType` | `prompt_templates` | — |
| 模板详情 | `GET /api/admin/prompts/:id` | `prompt_templates` | — |
| 创建模板 | `POST /api/admin/prompts` | — | `prompt_templates` |
| 更新模板 | `PUT /api/admin/prompts/:id` | — | `prompt_templates` |
| 删除模板 | `DELETE /api/admin/prompts/:id` | — | `prompt_templates` |
| 复制模板 | `POST /api/admin/prompts/:id/duplicate` | `prompt_templates` | `prompt_templates`（create copy） |
| 渲染测试（变量替换） | `POST /api/admin/prompts/test/render` | `prompt_templates` | — |
| 提取变量 | `POST /api/admin/prompts/test/extract` | — | — |
| 场景统计 | `GET /api/admin/prompts/stats/scenes` | `prompt_templates` | — |

---

### 模块 15：系统仪表盘（`pages/dashboard.html`）

| 功能点 | API 路由 | 读表 |
|--------|---------|------|
| 系统统计 | `GET /api/admin/system/stats` | `ai_model_configs`, `prompt_templates` |
| 支持的场景类型 | `GET /api/admin/system/scenes` | `ai_model_configs`, `prompt_templates` |
| 提供商列表 | `GET /api/admin/system/providers` | `ai_model_configs` |
| 服务健康检查 | `GET /api/admin/system/health` | 无直接 DB（检查连接） |

---

### 模块 16：智能爬虫（`pages/scraper.html`）

| 功能点 | API 路由 | 涉及表 |
|--------|---------|--------|
| 配置 | `GET /api/intelligent-scraper/config` | 无（JSON 配置文件） |
| 启动爬虫 | `POST /api/intelligent-scraper/run` | 无（结果写磁盘） |
| 查看结果 | `GET /api/intelligent-scraper/results` | 无（读磁盘文件） |

> 注：爬虫结果目前**不写入 `scraping_infos` 表**，仅存 JSON 文件到磁盘。

---

## 三、模块 × 涉及表汇总

| 模块 | 主要读表 | 主要写表 |
|------|---------|---------|
| 文档提取 | `documents` | `slide_merged_contents` |
| 语音转录 | `transcriptions`, `dialogue_adjustments`, `sessions`, `products` | `transcriptions`, `dialogue_adjustments`, `concerns`, `session_concerns` |
| PPT 页面分析 | `documents`, `thumbnails`, `slide_merged_contents`, `product_catalogs`, `prompt_templates`, `ai_model_configs` | `thumbnails`（page_type）, `slide_analysis_review_records` |
| 售前综合分析 | `transcriptions`, `dialogue_adjustments`, `sessions`, `ai_model_configs`, `prompt_templates` | `presales_analysis_results` |
| 售前视频生成 | `transcriptions`, `presales_analysis_results`, `dialogue_adjustments` | `presales_video_tasks`, `presales_analysis_results` |
| 招标文件分析 | `tender_documents`, `bid_directory_items` | `tender_documents`, `bid_directory_items`, `tender_sections` |
| 投标文件分析 | `bid_documents`, `bid_sections`, `bid_section_types` | `bid_documents`, `bid_sections`, `bid_section_types` |
| 投标组合 | `bid_compositions`, `bid_composition_items`, `bid_sections`, `bid_directory_items` | `bid_compositions`, `bid_composition_items` |
| QA 管理 | `concerns`, `concern_categories`, `transcriptions`, `dialogue_adjustments` | `concerns`, `concern_review_records` |
| 交流场次 | `sessions`, `products` | `sessions` |
| 产品管理 | `products` | `products` |
| 自动跑批 | `documents`, `transcriptions`, `dialogue_adjustments`, `concerns` | `slide_merged_contents`, `thumbnails`, `dialogue_adjustments`, `concerns` |
| AI 模型配置 | `ai_model_configs` | `ai_model_configs` |
| 提示词模板 | `prompt_templates` | `prompt_templates` |
| 系统仪表盘 | `ai_model_configs`, `prompt_templates` | — |
| 智能爬虫 | — | — （仅磁盘文件） |

---

## 四、完整数据流：从录音到 QA 知识库

```
① 上传音频
   └─ POST /api/transcription/upload
   └─ 写: transcriptions (status=uploading)

② 讯飞转录（后台异步）
   └─ 写: transcriptions (dialogues, status=completed)

③ AI 纠错（可选）
   └─ POST /api/transcription/:id/ai-correction
   └─ 写: dialogue_adjustments (type=ai_correction)

④ 角色判断（自动/手动）
   └─ POST /api/transcription/:id/role-judgment
   └─ 写: dialogue_adjustments (type=role_judgment)
         transcriptions (speaker_roles)

⑤ 重新合并对话
   └─ POST /api/transcription/:id/re-merge
   └─ 写: dialogue_adjustments (type=re_merge，合并所有调整)

⑥ QA 提取（AI 自动识别问答对）
   └─ POST /api/transcription/:id/qa-extraction
   └─ 写: concerns (批量 create)
         session_concerns (若绑定场次)

⑦ QA 分类（AI 自动分类）
   └─ POST /api/transcription/concerns/batch-classification
   └─ 写: concerns (category_code, intent_code)

⑧ QA 审核（人工）
   └─ POST /api/qa/concerns/:id/review
   └─ 写: concerns (review_status=approved)
         concern_review_records (审核历史)

⑨ QA 优化（AI 润色）
   └─ POST /api/qa/concerns/:id/optimize
   └─ 写: concerns (question/answer 优化，备份 original)

⑩ 导出到 Excel / 推送到 online-ppt-web 展示
   └─ GET /api/qa/concerns/export → XLSX
   └─ online-ppt-web 通过 GET /api/sales/concerns 只读展示
```

---

## 五、完整数据流：从招标文件到投标文件组合

```
① 上传招标文件
   └─ POST /api/tender-analysis/upload
   └─ 写: tender_documents (status=uploaded)

② AI 分析招标文件
   └─ POST /api/tender-analysis/analyze/:tenderId
   └─ 写: tender_documents (status, analysis_result)
         bid_directory_items (AI 生成目录树)
         tender_sections (文件章节 TOC)

③ 编辑目录内容
   └─ PUT /api/tender-analysis/directory/:itemId
   └─ 写: bid_directory_items (user_content, content_status)

④ 上传历史投标文件
   └─ POST /api/bid-analysis/upload
   └─ 写: bid_documents (status=uploaded)

⑤ AI 拆分投标章节
   └─ POST /api/bid-analysis/analyze/:bidDocId
   └─ 写: bid_sections (批量 create，含 docx_file_path)

⑥ 创建投标组合
   └─ POST /api/bid-composition
   └─ 写: bid_compositions

⑦ 从章节库 / 目录树 添加内容到组合
   └─ POST /api/bid-composition/:id/items
   └─ 写: bid_composition_items (引用 bid_sections 或自定义)

⑧ 导出 DOCX
   └─ GET /api/tender-analysis/:tenderId/export-docx → 生成 DOCX 文件
```
