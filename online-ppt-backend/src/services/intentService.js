/**
 * 意图识别服务
 * 
 * 用于分析用户输入，判断是PPT编辑操作还是普通对话
 */

// 续写话术识别正则（优先级最高，支持多行内容）
const CONTINUE_WRITE_PATTERN = /^(续写一页[：:]|插入的PPT主要内容是[：:])\s*(.+)$/s

// PPT编辑意图模式
const PPT_EDIT_PATTERNS = [
  { pattern: /更换(样式|模板|风格)|换(一个|个)?(样式|模板|风格)/i, action: 'change_style' },
  { pattern: /(续写|继续写|再写|补充|添加)(一页|下一页)?/i, action: 'continue_write' },
  { pattern: /(更换|换|替换)(配)?图(片)?|换(张|个)图/i, action: 'change_image' },
  { pattern: /(增加|减少|增减|调整)(内容|要点|项|数量)/i, action: 'adjust_content' },
  { pattern: /多加(几|一些|点)(内容|要点|项)/i, action: 'adjust_content' },
  { pattern: /少(一些|点)(内容|要点|项)/i, action: 'adjust_content' },
]

/**
 * 解析续写话术，提取主题内容
 * @param {string} message - 用户输入
 * @returns {string|null} 主题内容，不匹配返回 null
 */
export function parseContinueTopic(message) {
  if (!message) return null
  const match = message.trim().match(CONTINUE_WRITE_PATTERN)
  return match ? match[2].trim() : null
}

/**
 * 【新增】解析润色意图
 * @param {string} message - 用户输入
 * @returns {object} {isPolish: boolean, requirement: string}
 */
export function parsePolishIntent(message) {
  if (!message) return { isPolish: false, requirement: '' }
  
  // 检测是否是润色要求
  const polishPattern = /^润色要求[：:]\s*(.*)$/
  const match = message.trim().match(polishPattern)
  
  if (match) {
    return {
      isPolish: true,
      requirement: match[1].trim() || 'default'  // 空则用默认风格
    }
  }
  
  return { isPolish: false, requirement: '' }
}

// PPT咨询意图模式
const PPT_QUERY_PATTERNS = [
  /这页|当前页|这一页/,
  /有(几|多少)(个|项|页|张)/,
  /(什么|哪个|哪种)(模板|类型|样式|风格)/,
  /ppt.*(主题|内容|结构)/i,
  /一共.*(多少|几)/,
]

// PPT能力边界模式（暂不支持）
const PPT_LIMIT_PATTERNS = [
  { pattern: /(改|换|调)(成|为)?.*颜色|配色|主题色/, limit: 'color' },
  { pattern: /动画|过渡(效果)?|转场/, limit: 'animation' },
  { pattern: /图表|表格|chart/i, limit: 'chart' },
  { pattern: /字体|font/i, limit: 'font' },
  { pattern: /背景(图|色)?/, limit: 'background' },
]

/**
 * 分类用户意图
 * @param {string} message - 用户输入
 * @returns {Object} 意图分类结果
 */
export function classifyIntent(message) {
  if (!message || typeof message !== 'string') {
    return { type: 'chat' }
  }
  
  const text = message.trim()
  
  // 1. 检查是否是PPT编辑意图
  for (const { pattern, action } of PPT_EDIT_PATTERNS) {
    if (pattern.test(text)) {
      return { type: 'edit', action }
    }
  }
  
  // 2. 检查是否是PPT咨询
  if (PPT_QUERY_PATTERNS.some(p => p.test(text))) {
    return { type: 'query' }
  }
  
  // 3. 检查是否触及能力边界
  for (const { pattern, limit } of PPT_LIMIT_PATTERNS) {
    if (pattern.test(text)) {
      return { type: 'limit', limit }
    }
  }
  
  // 4. 其他情况 → 通用对话
  return { type: 'chat' }
}

/**
 * 获取能力边界的提示信息
 * @param {string} limit - 边界类型
 * @returns {string} 提示信息
 */
export function getLimitMessage(limit) {
  const messages = {
    color: '抱歉，目前暂不支持智能修改配色，您可以在左侧「主题」面板中手动调整～',
    animation: '动画效果暂未开放智能编辑，可以在「动画」选项卡中设置～',
    chart: '图表编辑功能正在开发中，敬请期待！',
    font: '字体修改请在选中文本后，使用顶部工具栏调整～',
    background: '背景修改请在「页面设计」面板中操作～',
    default: '抱歉，这个功能暂时不支持。我目前可以帮您：\n• 更换样式\n• 续写一页\n• 更换配图\n• 增减内容',
  }
  return messages[limit] || messages.default
}

/**
 * 获取编辑操作的引导提示
 * @param {string} action - 操作类型
 * @returns {string} 引导提示
 */
export function getActionGuide(action) {
  const guides = {
    change_style: '好的，我来帮您更换页面样式～',
    continue_write: '好的，我来为您续写一页内容～',
    change_image: '好的，我来为您推荐相关配图～',
    adjust_content: '好的，我来帮您调整内容数量～',
  }
  return guides[action] || '好的，我来帮您处理～'
}

export default {
  classifyIntent,
  getLimitMessage,
  getActionGuide,
  parseContinueTopic,
  parsePolishIntent,
}

