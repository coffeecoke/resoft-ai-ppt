# AI后台管理系统 - 页面导航

## 📍 访问地址
- **管理后台首页**: http://localhost:3000/admin.html

---

## 🗺️ 页面导航

### 1. 📊 数据概览 (Dashboard)
- **路径**: `#dashboard`
- **状态**: ✅ 已完成
- **功能**: 
  - 显示系统统计数据
  - 模型数量、提示词数量
  - 使用统计、场景分布

### 2. 🤖 模型配置 (Model Config)
- **路径**: `#model-config`
- **状态**: ✅ 已完成
- **功能**:
  - 查看所有AI模型配置
  - 按场景类型筛选
  - 新增/编辑/删除模型
  - 设置默认模型
  - API密钥加密管理
  - 模型调用统计

### 3. 📝 提示词管理 (Prompt Templates)
- **路径**: `#prompt-templates`
- **状态**: ✅ 已完成
- **功能**:
  - 管理提示词模板
  - 按场景类型筛选
  - 新增/编辑/删除模板
  - 支持变量定义
  - 测试提示词渲染
  - 模板复制
  - 版本管理

### 4. 🎤 语音转文本 (Transcription)
- **路径**: `#transcription`
- **状态**: 🚧 开发中
- **功能**: 音频文件上传和转写

### 5. 📊 PPT分析 (PPT Analysis)
- **路径**: `#ppt-analysis`
- **状态**: 🚧 开发中
- **功能**: PPT文件上传和智能分析

### 6. 📄 文档提取 (Document Extract)
- **路径**: `#document-extract`
- **状态**: 🚧 开发中
- **功能**: 文档结构化信息提取

### 7. 📁 文档管理 (Document Manage)
- **路径**: `#document-manage`
- **状态**: 🚧 开发中
- **功能**: 文档智能管理和分类

---

## 🔗 API接口文档

### 模型配置管理
```
GET    /api/admin/models                      - 获取所有模型
GET    /api/admin/models/scenes/:sceneType    - 获取场景模型
GET    /api/admin/models/default/:sceneType   - 获取默认模型
POST   /api/admin/models                      - 创建模型
PUT    /api/admin/models/:id                  - 更新模型
PUT    /api/admin/models/:id/set-default      - 设为默认
DELETE /api/admin/models/:id                  - 删除模型
GET    /api/admin/models/stats/scenes         - 场景统计
```

### 提示词管理
```
GET    /api/admin/prompts                     - 获取所有提示词
GET    /api/admin/prompts/scenes/:sceneType   - 获取场景提示词
POST   /api/admin/prompts                     - 创建提示词
PUT    /api/admin/prompts/:id                 - 更新提示词
DELETE /api/admin/prompts/:id                 - 删除提示词
POST   /api/admin/prompts/:id/duplicate       - 复制模板
POST   /api/admin/prompts/test/render         - 测试渲染
POST   /api/admin/prompts/test/extract        - 提取变量
GET    /api/admin/prompts/stats/scenes        - 场景统计
```

### 系统设置
```
GET    /api/admin/system/scenes               - 场景列表
GET    /api/admin/system/providers            - 提供商列表
GET    /api/admin/system/stats                - 系统统计
GET    /api/admin/system/health               - 健康检查
```

---

## 🎯 场景类型 (Scene Types)

| 代码 | 名称 | 说明 |
|---|---|---|
| `transcription` | 语音转文本 | 音频转文字 |
| `ppt_analysis` | PPT分析 | PPT内容分析和分类 |
| `document_extract` | 文档提取 | 结构化信息提取 |
| `document_manage` | 文档管理 | 文档智能管理 |
| `general` | 通用 | 通用对话和处理 |

---

## 🚀 快速开始

1. **启动服务**
```bash
cd E:\dev-chat-ppt\ai_backend
node server/app.js
```

2. **访问管理后台**
```
http://localhost:3000/admin.html
```

3. **配置AI模型**
- 点击左侧菜单"模型配置"
- 点击"新增模型"按钮
- 填写模型信息（name, code, provider, api_key等）
- 保存并设为默认模型

4. **创建提示词模板**
- 点击左侧菜单"提示词管理"
- 点击"新增提示词"按钮
- 填写模板内容，支持 `{{变量名}}` 语法
- 测试渲染后保存

---

## ⚙️ 配置说明

### 模型配置字段
- **显示名称** (name): 模型的展示名称
- **模型代码** (code): 唯一标识符，仅支持小写字母、数字、下划线
- **提供商** (provider): xfyun, openai, qwen, baidu, custom
- **模型名称** (model_name): 实际调用的模型名称
- **API地址** (api_url): API端点URL
- **API密钥** (api_key): API访问密钥（自动加密）
- **API秘钥** (api_secret): 可选的额外密钥
- **场景类型** (scene_type): 所属场景
- **最大Token数** (max_tokens): 默认2000
- **温度** (temperature): 0.0-1.0，默认0.7
- **Top-P** (top_p): 0.0-1.0，默认0.9

### 提示词模板字段
- **模板名称** (name): 模板的展示名称
- **模板代码** (code): 唯一标识符
- **场景类型** (scene_type): 所属场景
- **版本号** (version): 如 1.0, 2.0
- **提示词内容** (content): 实际的提示词，支持变量
- **变量定义** (variables): JSON格式，如 `{"var1": "描述"}`
- **启用状态** (is_active): 是否启用此模板

---

## 🔒 安全特性

- ✅ API密钥自动加密存储
- ✅ 密钥仅显示脱敏版本（****1234）
- ✅ 更新时支持不修改密钥
- ✅ code字段唯一性校验
- ✅ 输入格式验证

---

## 📞 技术支持

如有问题，请查看：
- `ai_backend/IMPLEMENTATION_SUMMARY.md` - 实现细节
- `ai_backend/QUICK_START.md` - 快速开始指南
- 服务日志：控制台输出

服务端口：3000
数据库：MySQL (通过 Prisma ORM)

