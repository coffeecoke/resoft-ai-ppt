/**
 * PPT文档总结Prompt模板
 * 
 * 生成结构化的文档总结
 */

export function createSummaryPrompt(documentText, documentInfo = {}) {
  const { name, slideCount } = documentInfo
  
  return `你是一个专业的PPT文档分析助手。请根据以下PPT文档的内容，生成结构化总结。

【文档基本信息】
文档名称：${name || '未知'}
幻灯片数量：${slideCount || '未知'}页

【文档内容】
${documentText}

【输出要求】
请严格按照以下格式输出，保持emoji和格式：

📌 核心主题
用一句话（20字内）概括这个PPT的核心内容

🎯 主要内容
• 要点1（不超过30字）
• 要点2（不超过30字）
• 要点3（不超过30字）
• 要点4（可选，不超过30字）
• 要点5（可选，不超过30字）

💡 适用场景
用1-2句话描述这个PPT适合在什么场合使用（如：售前交流、技术培训、产品发布会等）

👥 目标受众
说明这个PPT针对哪类人群（如：技术人员、业务决策者、客户经理、银行领导等）

📊 文档信息
共${slideCount || 'X'}页 | 涵盖模块：[列出2-3个关键模块] | 重点：[1-2个关键词]

【注意事项】
1. 必须严格按照上述格式输出，包括emoji符号
2. 每个要点必须精炼，突出核心信息
3. 如果内容较少，主要内容可以只列3个要点
4. 保持专业、准确、客观的语言风格`
}

export default {
  createSummaryPrompt
}

