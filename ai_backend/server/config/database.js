/**
 * Prisma 数据库配置
 * 共享 online-ppt-backend 的 Prisma Client
 */

// 由于 ai_backend 和 online-ppt-backend 共享同一个数据库
// 这里创建一个配置文件，用于连接到 online-ppt-backend 的 Prisma Client

module.exports = {
  // 数据库连接配置（与 online-ppt-backend 共享）
  // 确保 .env 文件包含以下环境变量：
  // DATABASE_URL="mysql://username:password@localhost:3306/ppt_database"
  
  // Prisma Client 配置
  prismaConfig: {
    log: ['query', 'info', 'warn', 'error'],
  },
}

