# ai_backend 故障排查指南

## 文档管理界面 "fail to fetch" 错误

### 问题现象
- 访问 `documents.html` 时，文档列表无法加载
- 浏览器控制台显示 "fail to fetch" 或 "Network Error"

### 诊断步骤

#### 1. 检查后端服务是否启动

```bash
# 检查端口 3000 是否被占用
netstat -ano | findstr :3000
```

如果没有输出，说明服务未启动，执行：
```bash
cd ai_backend
npm start
```

#### 2. 测试 API 是否正常

```bash
# 测试健康检查
curl http://localhost:3000/api/health

# 测试文档列表
curl http://localhost:3000/api/documents/list
```

如果返回 JSON 数据，说明 API 正常。

#### 3. 确认访问方式

**❌ 错误方式**：直接双击 `documents.html` 文件
- 地址栏显示：`file:///E:/dev-chat-ppt/ai_backend/frontend/documents.html`
- 会触发 **CORS 跨域错误**

**✅ 正确方式**：通过服务器访问
- 地址栏应该是：`http://localhost:3000/documents.html`

#### 4. 检查数据库连接

```bash
# 检查 .env 文件
cat ai_backend/.env

# 应该包含：
# DATABASE_URL="mysql://root:密码@localhost:3306/ppt_database"
```

如果没有 `.env` 文件，创建一个：
```env
PORT=3000
DATABASE_URL="mysql://root:你的密码@localhost:3306/ppt_database"
SHADOW_DATABASE_URL="mysql://root:你的密码@localhost:3306/ppt_database_shadow"
```

#### 5. 生成 Prisma Client

```bash
cd online-ppt-backend
npx prisma generate
```

### 常见错误对照表

| 错误信息 | 原因 | 解决方法 |
|---------|------|----------|
| **fail to fetch** | 服务未启动 | `cd ai_backend && npm start` |
| **CORS error** | 使用 file:// 协议访问 | 改用 `http://localhost:3000/documents.html` |
| **Network Error** | 防火墙阻止 | 检查防火墙设置 |
| **PrismaClient error** | 数据库连接失败 | 检查 `.env` 配置和 MySQL 服务 |
| **Cannot find module** | 依赖未安装 | `cd ai_backend && npm install` |

### 浏览器控制台常见错误

#### CORS 错误
```
Access to fetch at 'http://localhost:3000/api/documents/list' from origin 'null' 
has been blocked by CORS policy
```
**解决**：通过 `http://localhost:3000/documents.html` 访问，而不是直接打开文件。

#### 连接被拒绝
```
Failed to fetch
TypeError: NetworkError when attempting to fetch resource.
```
**解决**：确保 ai_backend 服务已启动（`npm start`）。

#### 超时错误
```
Failed to fetch
The operation timed out
```
**解决**：
1. 检查数据库连接是否正常
2. 检查 MySQL 服务是否启动
3. 检查网络连接

### 完整启动流程

```bash
# 1. 启动 MySQL 数据库
# （根据你的系统，可能是 mysqld 或 MySQL 服务）

# 2. 生成 Prisma Client（首次运行需要）
cd online-ppt-backend
npx prisma generate

# 3. 启动 ai_backend 服务
cd ../ai_backend
npm start

# 4. 在浏览器打开
# http://localhost:3000/documents.html
```

### 验证步骤

1. ✅ 服务启动成功，显示：
   ```
   ============================================================
   文档文本提取器 - Web 服务已启动
   ============================================================
   🌐 访问地址: http://localhost:3000
   ```

2. ✅ API 测试成功：
   ```bash
   curl http://localhost:3000/api/health
   # {"status":"ok","message":"服务运行正常"}
   ```

3. ✅ 文档列表可以加载：
   ```bash
   curl http://localhost:3000/api/documents/list
   # 返回 JSON 数据
   ```

4. ✅ 浏览器访问 `http://localhost:3000/documents.html` 可以看到文档列表

### 如果问题仍然存在

请提供以下信息：
1. **浏览器控制台**的完整错误信息（F12 → Console 标签）
2. **Network 标签**中失败请求的详细信息
3. **服务器日志**（ai_backend 启动后的输出）
4. **数据库连接配置**（隐藏敏感信息）

## 其他常见问题

### 问题：文档列表为空
**原因**：数据库中没有文档数据
**解决**：
1. 先使用 `online-ppt-web` 创建几个文档
2. 刷新 ai_backend 的文档管理页面

### 问题：封面图片显示为 404
**原因**：封面图片路径指向 online-ppt-backend（5001端口）
**解决**：确保 `online-ppt-backend` 服务也在运行：
```bash
cd online-ppt-backend
npm run dev
```

### 问题：提取功能无法使用
**原因**：documents 表中的 `content_file_path` 字段路径不正确
**解决**：
1. 检查数据库中的 `content_file_path` 值
2. 确保文件路径存在且可访问
3. 路径应该是相对于 `online-ppt-backend/data/` 目录

## 参考文档

- [文档管理功能使用指南](docs/DOCUMENT_EXTRACT_GUIDE.md)
- [API 接口文档](docs/README_WEB.md)
- [数据库配置指南](../docs/database-setup-guide.md)


