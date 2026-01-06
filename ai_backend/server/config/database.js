/**
 * 数据库配置
 * 用于ai_backend连接online-ppt-backend的数据库
 */

// 尝试多个可能的 Prisma Client 路径
let PrismaClient;
try {
  // 优先尝试 pnpm 路径
  PrismaClient = require('../../../online-ppt-backend/node_modules/.pnpm/@prisma+client@6.19.1_prisma@6.19.1/node_modules/.prisma/client').PrismaClient;
} catch (err) {
  try {
    // 回退到常规路径
    PrismaClient = require('../../../online-ppt-backend/node_modules/.prisma/client').PrismaClient;
  } catch (err2) {
    console.error('❌ 无法加载 Prisma Client，请确保 online-ppt-backend 已正确安装依赖');
    throw err2;
  }
}

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
  /**
   * 数据库连接URL
   */
  DATABASE_URL: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/ppt_db',
  
  /**
   * Prisma配置
   */
  prisma: {
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'info', 'warn', 'error'],
    errorFormat: 'pretty',
  },
  
  /**
   * 加密密钥（用于敏感信息加密）
   */
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'default-encryption-key-32chars',
};
