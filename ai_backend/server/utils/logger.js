/**
 * 日志工具类
 * 统一的日志输出格式
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

class Logger {
  /**
   * 格式化时间戳
   */
  getTimestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
  }

  /**
   * 信息日志
   */
  info(message, ...args) {
    console.log(
      `${colors.cyan}[INFO]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  }

  /**
   * 成功日志
   */
  success(message, ...args) {
    console.log(
      `${colors.green}[SUCCESS]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  }

  /**
   * 警告日志
   */
  warn(message, ...args) {
    console.warn(
      `${colors.yellow}[WARN]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  }

  /**
   * 错误日志
   */
  error(message, ...args) {
    console.error(
      `${colors.red}[ERROR]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`,
      ...args
    );
  }

  /**
   * 调试日志（仅开发环境）
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `${colors.magenta}[DEBUG]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`,
        ...args
      );
    }
  }

  /**
   * AI调用日志（特殊格式）
   */
  ai(scene, model, message) {
    console.log(
      `${colors.blue}[AI]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - [${scene}] ${model} - ${message}`
    );
  }
}

module.exports = new Logger();

