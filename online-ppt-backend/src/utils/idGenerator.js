import crypto from 'crypto'

/**
 * 生成文档ID
 * 格式：document_时间戳_随机字符串
 * 示例：document_1704067200000_a3b5c7
 * 
 * 优点：
 * - 无需查询数据库，性能好
 * - 时间戳可读，便于调试
 * - 随机字符串保证唯一性
 * - 支持高并发场景
 * 
 * @returns {string} 文档ID
 */
export function generateDocumentId() {
  const timestamp = Date.now()
  // 生成6位随机字符串（a-z0-9）
  const random = crypto.randomBytes(4).toString('hex')
  return `document_${timestamp}_${random}`
}

/**
 * 验证是否为有效的文档ID格式
 * @param {string} id - 待验证的ID
 * @returns {boolean} 是否为有效格式
 */
export function isValidDocumentId(id) {
  if (!id || typeof id !== 'string') return false
  // 匹配格式：document_数字_十六进制字符串
  return /^document_\d+_[a-f0-9]{8}$/.test(id)
}

