/**
 * Prisma Client 单例
 * 确保整个应用只有一个 Prisma Client 实例
 * 使用 online-ppt-backend 的 Prisma Client
 */

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client');

/**
 * Prisma 日志级别（默认不输出 SQL，避免淹没业务日志）
 * 需要看 SQL 时在 .env 设置 PRISMA_LOG_QUERY=true
 */
function getPrismaLogLevels() {
  const levels = ['warn', 'error'];
  const queryFlag = String(process.env.PRISMA_LOG_QUERY || '').trim().toLowerCase();
  if (queryFlag === '1' || queryFlag === 'true' || queryFlag === 'yes') {
    levels.unshift('query');
  }
  const infoFlag = String(process.env.PRISMA_LOG_INFO || '').trim().toLowerCase();
  if (infoFlag === '1' || infoFlag === 'true' || infoFlag === 'yes') {
    if (!levels.includes('info')) {
      levels.splice(levels.length - 2, 0, 'info');
    }
  }
  return levels;
}

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: getPrismaLogLevels(),
  });
} else {
  // 开发环境：避免热重载时创建多个实例
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      log: getPrismaLogLevels(),
    });
  }
  prisma = global.prisma;
}

module.exports = prisma;
