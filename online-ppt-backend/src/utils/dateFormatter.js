/**
 * 日期格式化工具
 * 
 * 统一处理日期格式，将 Date 对象或 ISO 字符串格式化为 yyyy-mm-dd 格式
 */

/**
 * 格式化日期为 yyyy-mm-dd 格式
 * @param {Date|string|null|undefined} date - 日期对象或 ISO 字符串
 * @returns {string|null} 格式化后的日期字符串，如果输入为空则返回 null
 */
export function formatDate(date) {
  if (!date) return null
  
  try {
    // 处理 Date 对象
    if (date instanceof Date) {
      if (isNaN(date.getTime())) {
        return null
      }
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    // 处理字符串（ISO 格式或其他格式）
    if (typeof date === 'string') {
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) {
        return null
      }
      const year = dateObj.getFullYear()
      const month = String(dateObj.getMonth() + 1).padStart(2, '0')
      const day = String(dateObj.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    
    return null
  } catch (error) {
    console.error('[日期格式化] 格式化失败:', error, date)
    return null
  }
}

/**
 * 格式化对象中的日期字段
 * @param {Object} obj - 需要格式化的对象
 * @param {Array<string>} dateFields - 需要格式化的日期字段名数组，如 ['created_at', 'updated_at']
 * @returns {Object} 格式化后的对象
 */
export function formatObjectDates(obj, dateFields = ['created_at', 'updated_at']) {
  if (!obj || typeof obj !== 'object') return obj
  
  const formatted = { ...obj }
  
  for (const field of dateFields) {
    if (formatted[field] !== null && formatted[field] !== undefined) {
      // 调试：打印原始值和类型
      // console.log(`[日期格式化] 字段 ${field}:`, formatted[field], typeof formatted[field])
      const formattedDate = formatDate(formatted[field])
      if (formattedDate !== null) {
        formatted[field] = formattedDate
      }
    }
  }
  
  return formatted
}

/**
 * 格式化数组中的每个对象的日期字段
 * @param {Array<Object>} array - 需要格式化的对象数组
 * @param {Array<string>} dateFields - 需要格式化的日期字段名数组
 * @returns {Array<Object>} 格式化后的对象数组
 */
export function formatArrayDates(array, dateFields = ['created_at', 'updated_at']) {
  if (!Array.isArray(array)) return array
  
  return array.map(item => formatObjectDates(item, dateFields))
}

