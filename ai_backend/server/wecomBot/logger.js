const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 }

class Logger {
  constructor(level = 'info') {
    this.level = level
  }

  setLevel(level) {
    this.level = level
  }

  _ok(l) {
    return LEVELS[this.level] <= LEVELS[l]
  }

  debug(message, ...args) {
    if (this._ok('debug')) console.log(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args)
  }

  info(message, ...args) {
    if (this._ok('info')) console.log(`[INFO] ${new Date().toISOString()} ${message}`, ...args)
  }

  warn(message, ...args) {
    if (this._ok('warn')) console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args)
  }

  error(message, ...args) {
    if (this._ok('error')) console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args)
  }
}

let instance = null

function initLogger(config) {
  instance = new Logger(config.logLevel || 'info')
  return instance
}

function getLogger() {
  if (!instance) instance = new Logger()
  return instance
}

module.exports = { initLogger, getLogger }
