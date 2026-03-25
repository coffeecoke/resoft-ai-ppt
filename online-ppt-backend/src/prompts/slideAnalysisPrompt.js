/**
 * 幻灯片AI分析Prompt模板
 * 
 * 针对用户选中的页面进行分析
 */

/**
 * 创建幻灯片分析Prompt
 * 
 * @param {string} documentText - 选中幻灯片的文本内容
 * @param {object} options - 配置选项
 * @param {string} options.name - 文档名称
 * @param {number} options.slideCount - 文档总页数
 * @param {number} options.analyzedPageCount - 分析的页面数量
 * @param {number[]} options.pageNumbers - 分析的页面编号数组（1-based）
 */
export function createSlideAnalysisPrompt(documentText, options = {}) {
  const { 
    name = '未知', 
    slideCount = 0,
    analyzedPageCount = 0,
    pageNumbers = [],
    userPrompt = ''
  } = options
  
  // 格式化页面列表显示
  const pageList = pageNumbers.length <= 5 
    ? pageNumbers.join('、') 
    : `${pageNumbers.slice(0, 3).join('、')}...等${pageNumbers.length}页`

  // 有用户分析方向时，作为额外要求插入 Prompt
  const userInstruction = userPrompt
    ? `\n【用户分析要求】\n${userPrompt}\n请在分析中优先关注用户指定的方向，输出格式仍按下方要求执行。\n`
    : ''
  
  return `你是一个专业的PPT内容分析助手。用户从一个PPT文档中选中了${analyzedPageCount}页，需要你对这些页面进行针对性分析。

【文档基本信息】
文档名称：${name}
文档总页数：${slideCount}页
本次分析页数：${analyzedPageCount}页
选中页面：第${pageList}

【选中页面内容】
${documentText}
${userInstruction}
【输出要求】
请严格按照以下格式输出，保持emoji和格式：

🎯 选中内容概要
用1-2句话（不超过50字）概括这${analyzedPageCount}页的核心内容

📝 主要观点
• 观点1（15-25字，提炼关键信息）
• 观点2（15-25字，提炼关键信息）
• 观点3（15-25字，提炼关键信息）
${analyzedPageCount > 3 ? '• 观点4（可选，15-25字）' : ''}

💡 内容特点
用1-2句话描述这部分内容的特点（如：偏重技术细节、强调业务价值、包含案例说明等）

🔗 上下文关联
${analyzedPageCount === 1 
  ? '用1句话说明这页内容在整个PPT中的位置和作用'
  : '用1句话说明这些页面在整个PPT中的位置和作用'}（如：适合作为开场介绍、核心功能说明、案例展示等）

【注意事项】
1. 必须严格按照上述格式输出，包括emoji符号
2. 针对选中的${analyzedPageCount}页进行分析，不要泛泛而谈
3. 主要观点要具体，直接提炼页面内容，不要空泛
4. 保持专业、准确、客观的语言风格
5. 重点关注这${analyzedPageCount}页的独特价值和核心信息`
}

export default {
  createSlideAnalysisPrompt
}

