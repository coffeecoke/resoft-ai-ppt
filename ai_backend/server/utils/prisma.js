/**
 * Prisma Client 单例
 * 确保整个应用只有一个 Prisma Client 实例
 * 使用 online-ppt-backend 的 Prisma Client
 */

// 引用 online-ppt-backend 的 Prisma Client
const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  // 开发环境：避免热重载时创建多个实例
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;

