/**
 * 文件路径工具函数
 *
 * 统一处理"绝对路径 ↔ 相对路径"的转换逻辑。
 * DB 只存相对路径（相对于 UPLOAD_BASE_DIR），读取时按需还原绝对路径。
 *
 * 配置项（.env）：
 *   UPLOAD_BASE_DIR  - 文件存储根目录，默认为项目根目录下的 uploads_data/
 *                      Windows 示例: D:\bid-data
 *                      Linux 示例:   /data/bid-data
 *
 * 注意：所有函数都在调用时实时读取 process.env，避免模块加载顺序导致
 *       dotenv 未就绪时取到空值的问题。
 */

const path = require('path')

/**
 * 获取存储根目录（绝对路径）。
 * 每次调用时实时读取 process.env，避免模块加载顺序问题。
 */
function getUploadBaseDir() {
  return process.env.UPLOAD_BASE_DIR
    ? path.resolve(process.env.UPLOAD_BASE_DIR)
    : path.resolve(__dirname, '../../uploads_data')
}

/**
 * 将绝对路径转为相对路径（相对于 UPLOAD_BASE_DIR）。
 * 如果传入的已经是相对路径（不以根路径符号开头），直接返回。
 *
 * @param {string} absPath - 绝对路径
 * @returns {string} 相对路径，如 "bid/1748001234567_xx.docx"
 */
function toRelativePath(absPath) {
  if (!absPath) return absPath
  const base = getUploadBaseDir().replace(/\\/g, '/')
  const normalized = absPath.replace(/\\/g, '/')

  if (normalized.startsWith(base)) {
    return normalized.slice(base.length).replace(/^\//, '')
  }
  // 已是相对路径，直接返回
  return normalized
}

/**
 * 将相对路径还原为绝对路径。
 * 如果传入的已经是绝对路径，直接返回。
 *
 * @param {string} relPath - 相对路径，如 "bid/1748001234567_xx.docx"
 * @returns {string} 绝对路径
 */
function toAbsolutePath(relPath) {
  if (!relPath) return relPath
  if (path.isAbsolute(relPath)) return relPath
  return path.join(getUploadBaseDir(), relPath)
}

module.exports = { toRelativePath, toAbsolutePath, getUploadBaseDir }
