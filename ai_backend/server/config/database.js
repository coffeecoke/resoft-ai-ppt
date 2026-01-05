/**
 * Prisma 数据库配置
 * 共享 online-ppt-backend 的 Prisma Client
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/.prisma/client');

// 创建 Prisma Client 实例（单例模式）
let prisma;

if (!prisma) {
  prisma = new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'info', 'warn', 'error'] 
      : ['warn', 'error'],
  });
}

// 优雅关闭
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = {
  prisma,
  prismaConfig: {
    log: ['query', 'info', 'warn', 'error'],
  },
};

