# AI Backend 环境变量配置示例

## 服务端口
PORT=3000

## 数据库连接（与 online-ppt-backend 共享）
请根据实际情况修改用户名、密码、数据库名

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/ppt_database"
SHADOW_DATABASE_URL="mysql://root:your_password@localhost:3306/ppt_database_shadow"
```

## 文件路径配置
online-ppt-backend 项目的根目录（用于读取文档JSON文件）

```env
ONLINE_PPT_BACKEND_PATH="../online-ppt-backend"
```

## 使用方法
1. 复制本文件内容到 `.env` 文件
2. 修改数据库连接信息
3. 确保 `online-ppt-backend` 项目的 Prisma Client 已生成
4. 运行 `npm install` 安装依赖
5. 运行 `npm start` 启动服务

