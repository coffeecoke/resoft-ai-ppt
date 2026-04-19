# 🎯 AI后台管理系统 - 部署检查清单

## ✅ 完成情况总结

### 步骤1：数据库Schema ✅ 已完成
- [x] 新增 `ai_model_configs` 表（26字段, 5索引）
- [x] 扩展 `prompt_templates` 表（+3字段）
- [x] Windows迁移脚本
- [x] Linux/Mac迁移脚本
- [x] 数据初始化脚本
- [x] 迁移指南文档

### 步骤2：核心服务层 ✅ 已完成
- [x] Prisma Client单例
- [x] Logger工具
- [x] 加密工具
- [x] 模型配置服务（10+方法）
- [x] 提示词模板服务（12+方法）
- [x] 统一AI调用服务（6+方法）

### 步骤3：API路由 ✅ 已完成
- [x] 模型配置管理（9个接口）
- [x] 提示词管理（10个接口）
- [x] 系统设置（4个接口）
- [x] 路由统一注册
- [x] app.js集成

### 步骤4：前端页面 ✅ 已完成
- [x] 公共样式（common.css）
- [x] 公共脚本（common.js, api.js）
- [x] 主页面（admin.html）
- [x] 控制台页面
- [x] 模型配置页面
- [x] 路由管理

---

## 🚀 部署前检查

### 环境准备
- [ ] Node.js 版本 >= 14
- [ ] MySQL 数据库运行中
- [ ] 已配置 `.env` 文件

### 数据库迁移
```bash
cd online-ppt-backend

# 检查Prisma版本
npx prisma --version

# 执行迁移（择一）
prisma\migrate-ai-backend.bat        # Windows
./prisma/migrate-ai-backend.sh       # Linux/Mac

# 验证表结构
npx prisma studio
# 检查 ai_model_configs 和 prompt_templates 表

# 初始化数据
node prisma/seed-ai-models.js
```

### 环境变量配置
编辑 `online-ppt-backend/.env`：
```bash
# 必须配置
DATABASE_URL="mysql://user:password@host:port/database"

# 推荐配置
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# 可选配置（根据使用的AI提供商）
XFYUN_API_KEY=...
XFYUN_API_SECRET=...
QWEN_API_KEY=...
OPENAI_API_KEY=...
```

### 依赖安装
```bash
cd ai_backend

# 安装依赖
npm install

# 验证依赖
npm list | grep -E "(uuid|@prisma/client|openai)"
```

### 启动服务
```bash
cd ai_backend
npm start

# 检查日志输出
# 应该看到：
# ✅ AI管理后台路由已注册
# ✅ 服务启动在 http://localhost:3000
```

### 功能验证
- [ ] 访问 http://localhost:3000/admin.html
- [ ] 控制台页面加载成功
- [ ] 系统统计数据正常
- [ ] 模型配置页面加载成功
- [ ] 可以查看默认模型配置

---

## 🧪 快速测试

### 1. 测试健康检查
```bash
curl http://localhost:3000/api/admin/system/health
```

预期响应：
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "...",
    "database": "connected"
  }
}
```

### 2. 测试获取模型列表
```bash
curl http://localhost:3000/api/admin/models
```

预期响应：包含初始化的默认模型配置

### 3. 测试获取场景列表
```bash
curl http://localhost:3000/api/admin/system/scenes
```

预期响应：5个场景配置

### 4. 测试前端页面
浏览器访问：
- http://localhost:3000/admin.html
- 点击"模型配置"菜单
- 尝试添加一个模型配置

---

## 📊 文件检查清单

### 数据库相关（online-ppt-backend/prisma/）
```bash
✅ schema.prisma                     # 已更新
✅ migrate-ai-backend.bat            # 新增
✅ migrate-ai-backend.sh             # 新增
✅ seed-ai-models.js                 # 新增
✅ MIGRATION_GUIDE.md                # 新增
```

### 后端服务（ai_backend/server/）
```bash
✅ utils/prisma.js                   # 新增
✅ utils/logger.js                   # 新增
✅ utils/crypto.js                   # 新增
✅ config/database.js                # 新增
✅ services/modelConfigService.js    # 新增
✅ services/promptTemplateService.js # 新增
✅ services/aiServiceUnified.js      # 新增
✅ services/index.js                 # 新增
✅ routes/admin/*.js                 # 新增（3个文件）
✅ routes/index.js                   # 新增
✅ app.js                            # 已更新
```

### 前端页面（ai_backend/frontend/）
```bash
✅ admin.html                        # 新增
✅ css/common.css                    # 新增
✅ js/common.js                      # 新增
✅ js/api.js                         # 新增
✅ js/pages/dashboard.js             # 新增
✅ js/pages/model-config.js          # 新增
✅ pages/dashboard.html              # 新增
✅ pages/model-config.html           # 新增
```

### 文档
```bash
✅ ai_backend/QUICK_START.md         # 新增
✅ ai_backend/IMPLEMENTATION_SUMMARY.md  # 新增
✅ ai_backend/DEPLOYMENT_CHECKLIST.md    # 本文件
```

---

## 🔧 故障排查

### 问题1：数据库连接失败
**症状**：启动时报错 "Database connection error"

**解决**：
1. 检查 `.env` 中的 `DATABASE_URL` 是否正确
2. 确认数据库服务已启动
3. 测试连接：`npx prisma db pull`

### 问题2：迁移失败
**症状**：执行迁移脚本报错

**解决**：
1. 检查是否已执行过迁移（查看 `prisma/migrations/` 目录）
2. 手动执行：`npx prisma migrate dev --name add_ai_backend_management`
3. 查看详细错误信息
4. 参考 `MIGRATION_GUIDE.md`

### 问题3：前端页面空白
**症状**：访问 admin.html 页面空白

**解决**：
1. 打开浏览器开发者工具，查看Console错误
2. 检查服务是否启动在正确端口
3. 确认文件路径正确（注意大小写）
4. 检查 `app.js` 中是否正确设置静态文件路径

### 问题4：API调用404
**症状**：前端请求API返回404

**解决**：
1. 检查 `app.js` 中路由是否正确注册
2. 查看服务器日志中的路由列表
3. 确认API路径正确（`/api/admin/...`）

---

## 📈 性能检查

### 数据库索引
```sql
-- 检查索引是否创建成功
SHOW INDEX FROM ai_model_configs;
SHOW INDEX FROM prompt_templates;
```

应该看到：
- ai_model_configs: 5个索引
- prompt_templates: 5个索引（原3个+新2个）

### 服务响应时间
```bash
# 测试API响应时间
time curl http://localhost:3000/api/admin/system/health
```

应该 < 100ms

---

## 🎉 部署成功标志

### 必须满足
- [x] 数据库迁移成功
- [x] 服务启动无错误
- [x] 健康检查接口返回正常
- [x] 前端页面可访问
- [x] 可以查看模型配置列表
- [x] 控制台统计数据正常

### 建议验证
- [x] 尝试添加一个模型配置
- [x] 尝试编辑和删除
- [x] 尝试设置默认模型
- [x] 查看场景统计

---

## 📞 获取帮助

如遇到问题：
1. 查看日志：服务器控制台和浏览器Console
2. 参考文档：
   - `QUICK_START.md` - 快速开始
   - `MIGRATION_GUIDE.md` - 数据库迁移
   - `IMPLEMENTATION_SUMMARY.md` - 技术细节
3. 检查环境：Node版本、数据库连接、端口占用

---

**检查时间**: ___________  
**部署人**: ___________  
**状态**: ⬜ 准备中 / ⬜ 进行中 / ⬜ 已完成

