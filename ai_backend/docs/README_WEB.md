# 文档文本提取器 - Web 版

## 🚀 快速启动

### 1. 安装依赖

```bash
cd ai_backend
npm install
```

### 2. 启动服务

```bash
npm start
# 或开发模式（自动重启）
npm run dev
```

### 3. 访问界面

打开浏览器访问: **http://localhost:3000**

---

## 📁 目录结构

```
ai_backend/
├── frontend/                    # 前端界面
│   ├── index.html              # 主页面
│   ├── css/
│   │   └── style.css           # 样式文件
│   └── js/
│       └── app.js              # 前端逻辑
│
├── server/                      # 后端服务
│   ├── app.js                  # Express 服务器
│   └── routes/                 # 路由（预留）
│
├── output/                      # 输出目录（按日期分层）
│   ├── 2026-01-03/             # 2026年1月3日的提取结果
│   │   ├── document_1_2026-01-03T10-30-00.txt
│   │   ├── document_1_2026-01-03T10-30-00_merged.txt
│   │   └── ...
│   └── 2026-01-04/             # 2026年1月4日的提取结果
│
├── uploads/                     # 临时上传目录
│
├── DocumentTextExtractor.js    # 核心提取器
├── package.json                # 项目配置
└── README_WEB.md               # 本文档
```

---

## ✨ 功能特性

### 前端界面
- ✅ 拖拽上传 JSON 文件
- ✅ 多文件批量处理
- ✅ 实时提取进度显示
- ✅ 提取结果在线查看
- ✅ 历史记录管理
- ✅ 文件下载

### 后端服务
- ✅ RESTful API 接口
- ✅ 文件上传处理
- ✅ 自动时间戳命名
- ✅ 按日期分层存储
- ✅ 历史记录查询

### 输出管理
- ✅ 按日期自动分类（`output/YYYY-MM-DD/`）
- ✅ 文件名包含时间戳（`文件名_YYYY-MM-DDTHH-MM-SS.txt`）
- ✅ 详细版和拼接版双输出
- ✅ 自动清理临时文件

---

## 📖 使用说明

### 界面操作

#### 1️⃣ 上传文件
- **方式一**: 点击"选择 JSON 文件"按钮
- **方式二**: 拖拽文件到上传区域

#### 2️⃣ 管理文件列表
- 查看已选择的文件
- 移除不需要的文件
- 清空整个列表

#### 3️⃣ 开始提取
- 点击"开始提取"按钮
- 查看实时进度
- 等待提取完成

#### 4️⃣ 下载结果
- 点击"详细版"下载完整提取结果
- 点击"拼接版"下载按幻灯片合并的结果

#### 5️⃣ 查看历史
- 右侧边栏显示历史记录
- 按日期分组
- 点击打开历史目录

---

## 🔌 API 接口

### 1. 文件提取接口

**接口**: `POST /api/extract`

**请求**: 
- Content-Type: `multipart/form-data`
- 参数: `file` (JSON 文件)

**响应**:
```json
{
  "success": true,
  "file": "document_3.json",
  "recordCount": 855,
  "slideCount": 48,
  "timestamp": "2026-01-03",
  "detailFile": "/output/2026-01-03/document_3_2026-01-03T14-30-00.txt",
  "mergedFile": "/output/2026-01-03/document_3_2026-01-03T14-30-00_merged.txt"
}
```

### 2. 历史记录接口

**接口**: `GET /api/history`

**响应**:
```json
[
  {
    "date": "2026-01-03",
    "files": ["document_1_...", "document_3_..."],
    "totalRecords": 1200
  }
]
```

### 3. 健康检查接口

**接口**: `GET /api/health`

**响应**:
```json
{
  "status": "ok",
  "message": "服务运行正常"
}
```

---

## 📂 输出文件命名规则

### 目录结构
```
output/
└── 2026-01-03/                              # 日期目录 (YYYY-MM-DD)
    ├── document_1_2026-01-03T10-30-00.txt         # 详细版
    ├── document_1_2026-01-03T10-30-00_merged.txt  # 拼接版
    ├── document_3_2026-01-03T14-30-00.txt
    └── document_3_2026-01-03T14-30-00_merged.txt
```

### 命名格式
- **详细版**: `{原文件名}_{时间戳}.txt`
- **拼接版**: `{原文件名}_{时间戳}_merged.txt`
- **时间戳格式**: `YYYY-MM-DDTHH-MM-SS`

### 示例
```
document_3.json
    ↓ 提取后 ↓
document_3_2026-01-03T14-30-15.txt
document_3_2026-01-03T14-30-15_merged.txt
```

---

## 🛠️ 开发模式

### 启动开发服务器
```bash
npm run dev
```

### 测试提取器
```bash
npm test
```

### 清理输出目录
```bash
# Windows
Remove-Item -Recurse -Force output/*

# Linux/Mac
rm -rf output/*
```

---

## ⚙️ 配置

### 端口配置
编辑 `server/app.js`，修改端口号：
```javascript
const PORT = process.env.PORT || 3000
```

### 文件大小限制
编辑 `server/app.js`，修改上传限制：
```javascript
limits: {
  fileSize: 50 * 1024 * 1024 // 50MB
}
```

---

## 🐛 故障排查

### 问题 1: 端口被占用
**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**:
```bash
# 查找占用端口的进程
netstat -ano | findstr :3000

# 杀死进程
taskkill /PID <PID> /F
```

### 问题 2: 文件上传失败
**错误**: `只支持 JSON 文件`

**解决**: 确保上传的文件扩展名为 `.json`

### 问题 3: 提取失败
**错误**: `提取过程中出错`

**解决**: 
1. 检查 JSON 文件格式是否正确
2. 查看服务器日志获取详细错误信息

---

## 📊 性能指标

| 指标 | 数值 |
|------|------|
| 单文件提取速度 | ~80ms |
| 最大文件大小 | 50MB |
| 并发处理 | 支持队列处理 |
| 内存占用 | ~50MB |

---

## 🔐 安全建议

1. **生产环境部署**:
   - 添加身份验证
   - 限制上传来源（CORS）
   - 添加速率限制

2. **文件安全**:
   - 验证文件类型
   - 限制文件大小
   - 扫描恶意内容

3. **数据清理**:
   - 定期清理 `uploads/` 临时文件
   - 定期归档 `output/` 历史文件

---

## 📝 更新日志

### v1.0.0 (2026-01-03)
- ✅ 初始版本发布
- ✅ Web 界面实现
- ✅ 文件上传和提取功能
- ✅ 按日期分层存储
- ✅ 时间戳命名
- ✅ 历史记录管理

---

## 📧 支持

如有问题或建议，请：
- 查看文档: [README.md](./README.md)
- 查看源码: [DocumentTextExtractor.js](./DocumentTextExtractor.js)

---

<p align="center">
  <strong>🎉 享受文档文本提取！</strong>
</p>

