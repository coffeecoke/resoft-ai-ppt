/**
 * 日志工具类
 * 统一的日志输出格式，同时输出到控制台和文件
 */

const fs = require('fs');
const path = require('path');

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
  constructor() {
    // 确保 logs 目录存在
    this.logsDir = path.join(__dirname, '../../logs');
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // 获取当前日志文件路径（按日期）
    this.currentLogFile = this.getLogFilePath();
  }

  /**
   * 获取日志文件路径（按日期命名，格式：ai_backend_YYYY-MM-DD.log）
   */
  getLogFilePath() {
    const now = new Date();
    // 使用本地时区，格式：YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    const logFileName = `ai_backend_${dateStr}.log`;
    return path.join(this.logsDir, logFileName);
  }

  /**
   * 确保使用当天的日志文件
   */
  ensureCurrentLogFile() {
    const todayLogFile = this.getLogFilePath();
    if (this.currentLogFile !== todayLogFile) {
      this.currentLogFile = todayLogFile;
    }
    return this.currentLogFile;
  }

  /**
   * 写入日志到文件
   */
  writeToFile(level, message, ...args) {
    try {
      const logFile = this.ensureCurrentLogFile();
      const timestamp = this.getTimestamp();
      
      // 处理参数，如果是对象则格式化为JSON
      let fullContent = message;
      if (args.length > 0) {
        const argsStr = args.map(arg => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg, null, 2);
            } catch (e) {
              return String(arg);
            }
          }
          return String(arg);
        }).join(' ');
        fullContent = `${message} ${argsStr}`;
      }
      
      // 移除 ANSI 颜色代码（用于文件输出）
      let cleanMessage = fullContent
        .replace(/\x1b\[[0-9;]*m/g, '') // 移除所有ANSI颜色代码
        .replace(/\[INFO\]|\[SUCCESS\]|\[WARN\]|\[ERROR\]|\[DEBUG\]|\[AI\]/g, `[${level}]`);
      
      // 处理多行内容：如果是多行，每行前面加上时间戳和级别
      const lines = cleanMessage.split('\n');
      if (lines.length === 1) {
        // 单行日志
        const logLine = `[${level}] ${timestamp} - ${cleanMessage}\n`;
        fs.appendFileSync(logFile, logLine, 'utf8');
      } else {
        // 多行日志：第一行带时间戳，后续行只带缩进
        let logContent = `[${level}] ${timestamp} - ${lines[0]}\n`;
        for (let i = 1; i < lines.length; i++) {
          // 空行保持原样，非空行添加缩进
          if (lines[i].trim() === '') {
            logContent += '\n';
          } else {
            logContent += `                    ${lines[i]}\n`; // 20个空格缩进对齐
          }
        }
        fs.appendFileSync(logFile, logContent, 'utf8');
      }
    } catch (error) {
      // 静默处理文件写入错误，避免影响主程序
      // 只在开发环境输出错误信息
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[Logger] 日志文件写入异常: ${error.message}`);
      }
    }
  }

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
    const logMessage = `${colors.cyan}[INFO]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`;
    console.log(logMessage, ...args);
    this.writeToFile('INFO', message, ...args);
  }

  /**
   * 成功日志
   */
  success(message, ...args) {
    const logMessage = `${colors.green}[SUCCESS]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`;
    console.log(logMessage, ...args);
    this.writeToFile('SUCCESS', message, ...args);
  }

  /**
   * 警告日志
   */
  warn(message, ...args) {
    const logMessage = `${colors.yellow}[WARN]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`;
    console.warn(logMessage, ...args);
    this.writeToFile('WARN', message, ...args);
  }

  /**
   * 错误日志
   */
  error(message, ...args) {
    const logMessage = `${colors.red}[ERROR]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`;
    console.error(logMessage, ...args);
    this.writeToFile('ERROR', message, ...args);
  }

  /**
   * 调试日志（仅开发环境）
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV !== 'production') {
      const logMessage = `${colors.magenta}[DEBUG]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - ${message}`;
      console.log(logMessage, ...args);
      this.writeToFile('DEBUG', message, ...args);
    }
  }

  /**
   * AI调用日志（特殊格式）
   */
  ai(scene, model, message) {
    const logMessage = `${colors.blue}[AI]${colors.reset} ${colors.bright}${this.getTimestamp()}${colors.reset} - [${scene}] ${model} - ${message}`;
    console.log(logMessage);
    this.writeToFile('AI', `[${scene}] ${model} - ${message}`);
  }
}

module.exports = new Logger();

