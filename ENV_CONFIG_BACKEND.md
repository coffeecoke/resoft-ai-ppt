# 🔧 后端环境变量配置说明

## 📋 两种配置方式

### 方式 1: 使用 `online-ppt-backend/.env`（本地开发）

**适用场景：** 本地开发，不使用 Docker

**位置：** `online-ppt-backend/.env`

**工作原理：**
- 后端代码使用 `dotenv.config()` 读取 `.env` 文件
- `dotenv.config()` 会在当前工作目录查找 `.env` 文件
- 本地运行时，从 `online-ppt-backend/.env` 读取

**配置步骤：**
```bash
cd online-ppt-backend
cp .env.example .env
nano .env  # 填入 API 密钥
npm start  # 本地运行
```

---

### 方式 2: 使用根目录 `.env`（Docker 部署）⭐ 推荐

**适用场景：** Docker 部署

**位置：** 项目根目录 `/resoft-ai-ppt/.env`

**工作原理：**
1. Docker Compose 从根目录的 `.env` 读取环境变量
2. 通过 `docker-compose.yml` 的 `environment:` 传递给容器
3. 容器内的 `dotenv.config()` 会读取环境变量（优先级高于文件）

**配置步骤：**
```bash
# 在项目根目录
cd /Users/tanghuan/Desktop/resoft-ai-ppt项目/resoft-ai-ppt
cp .env.example .env
nano .env  # 填入 API 密钥
docker-compose up -d
```

---

## 🔍 为什么 Docker 不使用 `online-ppt-backend/.env`？

查看 `.dockerignore` 文件：

```dockerignore
.env          # ← 这里排除了 .env 文件
.env.local
.env.*.local
```

**原因：**
1. **安全考虑**：`.env` 文件包含敏感信息（API 密钥），不应该被打包到镜像中
2. **灵活性**：通过 Docker Compose 的环境变量传递更灵活
3. **最佳实践**：环境变量应该通过容器运行时传递，而不是打包在镜像中

---

## 📊 环境变量优先级

在 Docker 容器中，环境变量的优先级（从高到低）：

1. **docker-compose.yml 的 `environment:`**（最高优先级）
   ```yaml
   environment:
     - OPENAI_API_KEY=${OPENAI_API_KEY:-}
   ```
   从根目录 `.env` 读取并传递

2. **容器内的 `.env` 文件**（如果存在）
   ```javascript
   dotenv.config()  // 读取容器内的 .env
   ```

3. **系统环境变量**

4. **代码中的默认值**

---

## ✅ 推荐配置方式

### Docker 部署（推荐）

**使用根目录的 `.env` 文件：**

```bash
# 1. 在项目根目录创建 .env
cd /Users/tanghuan/Desktop/resoft-ai-ppt项目/resoft-ai-ppt
cp .env.example .env

# 2. 编辑配置
nano .env

# 3. 启动 Docker 服务
docker-compose up -d
```

**优点：**
- ✅ 统一管理所有服务的环境变量
- ✅ 符合 Docker 最佳实践
- ✅ 更安全（不打包到镜像中）
- ✅ 便于 CI/CD 配置

### 本地开发

**使用 `online-ppt-backend/.env` 文件：**

```bash
# 1. 在后端目录创建 .env
cd online-ppt-backend
cp .env.example .env

# 2. 编辑配置
nano .env

# 3. 本地运行
npm start
```

**优点：**
- ✅ 独立配置，不影响 Docker
- ✅ 适合本地开发调试

---

## 🔄 两种方式对比

| 特性 | 根目录 `.env` (Docker) | `online-ppt-backend/.env` (本地) |
|------|----------------------|--------------------------------|
| **位置** | `/resoft-ai-ppt/.env` | `/resoft-ai-ppt/online-ppt-backend/.env` |
| **用途** | Docker Compose 部署 | 本地开发 |
| **传递方式** | docker-compose.yml → 容器 | dotenv.config() 直接读取 |
| **是否打包到镜像** | ❌ 不打包 | ❌ 被 .dockerignore 排除 |
| **推荐场景** | 生产部署 | 本地开发 |

---

## 📝 配置示例

### 根目录 `.env`（Docker 使用）

```bash
# /resoft-ai-ppt/.env
OPENAI_API_KEY=sk-your-key-here
ZHIPU_API_KEY=your-zhipu-key
PORT=5001

# 数据目录配置（可选）
# 如果不设置，默认使用项目内的 data/ 目录
# Windows 示例：
DATA_DIR=D:\ppt-data
# Linux/Mac 示例：
# DATA_DIR=/data/ppt-data
```

### 后端目录 `.env`（本地开发使用）

```bash
# /resoft-ai-ppt/online-ppt-backend/.env
OPENAI_API_KEY=sk-your-key-here
ZHIPU_API_KEY=your-zhipu-key
PORT=5001

# 数据目录配置（可选）
# 如果不设置，默认使用项目内的 data/ 目录
# Windows 示例：
DATA_DIR=D:\ppt-data
# Linux/Mac 示例：
# DATA_DIR=/data/ppt-data
```

**注意：** 两个文件的内容可以相同，但用途不同。

---

## 📁 数据目录配置（DATA_DIR）

### 功能说明

`DATA_DIR` 环境变量用于指定数据文件的存储路径。如果不设置，系统会使用项目内的 `data/` 目录作为默认路径。

### 使用场景

- ✅ **数据量大**：需要将数据存储在独立的磁盘分区
- ✅ **数据备份**：需要将数据存储在易于备份的位置
- ✅ **多环境部署**：不同环境使用不同的数据目录
- ✅ **性能优化**：将数据存储在 SSD 或高性能磁盘

### 配置方式

#### Windows 系统

```bash
# 在 .env 文件中添加
DATA_DIR=D:\ppt-data

# 或者使用其他盘符
DATA_DIR=E:\work\ppt-data
DATA_DIR=F:\data\ppt
```

#### Linux/Mac 系统

```bash
# 在 .env 文件中添加
DATA_DIR=/data/ppt-data

# 或者使用用户目录
DATA_DIR=/home/user/ppt-data
```

### 目录结构

设置 `DATA_DIR` 后，系统会自动在该目录下创建以下子目录：

```
DATA_DIR/
├── documents/      # 文档内容文件
├── templates/      # 模板文件
├── covers/         # 封面图片
├── snapshots/      # 快照文件
├── thumbnails/     # 缩略图
├── sales/          # 销售业务数据
└── document-index.json  # 文档索引
```

### 注意事项

1. **路径格式**：
   - Windows：使用反斜杠 `\` 或正斜杠 `/` 都可以，如 `D:\ppt-data` 或 `D:/ppt-data`
   - Linux/Mac：使用正斜杠 `/`，如 `/data/ppt-data`

2. **目录权限**：
   - 确保应用有读写权限
   - Linux/Mac 可能需要设置目录权限：`chmod 755 /data/ppt-data`

3. **路径不存在**：
   - 系统会自动创建目录（如果父目录存在）
   - 建议先手动创建目录，确保路径正确

4. **迁移数据**：
   - 如果从默认路径迁移到新路径，需要手动复制 `data/` 目录下的所有文件
   - 迁移后重启服务即可

### 示例：迁移到 D 盘

```bash
# 1. 创建目标目录
mkdir D:\ppt-data

# 2. 复制现有数据（如果存在）
xcopy /E /I online-ppt-backend\data D:\ppt-data

# 3. 在 .env 文件中配置
DATA_DIR=D:\ppt-data

# 4. 重启服务
npm start
```

### 验证配置

启动服务后，检查日志输出，确认数据目录路径：

```bash
# 查看日志，应该显示：
[文档模型] 数据目录: D:\ppt-data
```

或者查看实际创建的文件路径，确认是否正确使用了配置的目录。

---

## 🎯 总结

### Docker 部署时

1. ✅ **使用根目录的 `.env` 文件**
2. ✅ 通过 `docker-compose.yml` 传递环境变量
3. ✅ `.dockerignore` 会排除 `online-ppt-backend/.env`，不会打包到镜像

### 本地开发时

1. ✅ **使用 `online-ppt-backend/.env` 文件**
2. ✅ `dotenv.config()` 会自动读取
3. ✅ 不影响 Docker 部署

### 最佳实践

- **Docker 部署**：统一使用根目录的 `.env`
- **本地开发**：使用 `online-ppt-backend/.env`
- **不要**：将真实的 API 密钥提交到 Git

---

## ❓ 常见问题

### Q: 为什么 Docker 不读取 `online-ppt-backend/.env`？

**A:** 因为 `.dockerignore` 排除了 `.env` 文件，这是安全最佳实践。环境变量应该通过 Docker Compose 传递，而不是打包在镜像中。

### Q: 可以同时使用两个 `.env` 文件吗？

**A:** 可以，但用途不同：
- 根目录 `.env` → Docker 部署
- `online-ppt-backend/.env` → 本地开发

### Q: 如果两个文件都存在，Docker 会使用哪个？

**A:** Docker 会使用根目录的 `.env`，因为：
1. `online-ppt-backend/.env` 被 `.dockerignore` 排除，不会复制到镜像
2. `docker-compose.yml` 从根目录 `.env` 读取并传递给容器

### Q: 本地开发时，根目录的 `.env` 会影响后端吗？

**A:** 不会。本地开发时，后端代码在 `online-ppt-backend/` 目录运行，`dotenv.config()` 只会在当前目录查找 `.env` 文件。


