/**
 * 数据库配置
 * 用于ai_backend连接online-ppt-backend的数据库
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../online-ppt-backend/.env') });

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
