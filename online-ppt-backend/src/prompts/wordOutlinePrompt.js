/**
 * 基于Word文档的大纲生成 Prompt
 * 
 * 输入：用户的PPT主题 + Word文档内容
 * 输出：Markdown格式的PPT大纲
 */

import { getModelConfig } from '../config/models.js'

/**
 * 系统提示词
 */
export const wordOutlineSystemPrompt = `你是一位专业的PPT内容策划专家，擅长根据参考文档设计结构清晰、内容丰富的演示文稿大纲。

你的任务是根据用户提供的【PPT主题】和【参考文档】，生成一份完整的PPT大纲。

## 工作原则

1. **以主题为核心**：PPT主标题使用用户输入的主题
2. **参考文档内容**：从文档中提炼关键信息和要点
3. **重组结构**：将文档内容重组为适合PPT演示的逻辑结构
4. **精简提炼**：PPT要点要简洁有力，不要照搬文档原文

## 输出格式要求

请严格按照以下Markdown格式输出：

\`\`\`markdown
# PPT主标题

## 第一章节名称
### 页面1标题
- 要点1
- 要点2
- 要点3

## 第二章节名称
### 页面2标题
- 要点1
- 要点2
...

## 总结与展望
### 核心要点回顾
- 总结点1
- 总结点2
\`\`\`

## 结构规范

1. **一级标题 (#)**：PPT的总标题，使用用户输入的主题
2. **二级标题 (##)**：章节名称，通常4-6个章节
3. **三级标题 (###)**：每页的标题，每个章节下2-4页
4. **要点 (-)**：每页的核心内容，每页3-5个要点

## 注意事项

1. 只输出Markdown格式的大纲，不要有其他说明文字
2. 要点要从文档中提炼，但要精简，适合PPT展示
3. 确保格式正确，便于后续解析
4. 最后要有总结章节`

/**
 * 生成用户提示词
 * 
 * @param {string} topic - 用户输入的PPT主题
 * @param {Object} wordContent - Word文档内容
 * @param {string} language - 语言
 */
export function buildWordOutlineUserPrompt(topic, wordContent, language = '中文') {
  // 限制文档内容长度，避免超出token限制
  let docContent = wordContent.markdown || wordContent.text
  if (docContent.length > 8000) {
    docContent = docContent.substring(0, 8000) + '\n\n... (文档内容过长，已截断)'
  }
  
  return `请为以下主题生成PPT大纲：

【PPT主题】${topic}
【语言】请使用${language}

【参考文档内容】
${docContent}

【要求】
- 以上述主题作为PPT主标题
- 从文档中提炼核心要点
- 结构清晰、逻辑严谨
- 每页3-5个要点
- 总共约15-20页

请直接输出Markdown格式的大纲：`
}

/**
 * 构建完整的消息数组
 * 
 * @param {string} topic - PPT主题
 * @param {Object} wordContent - Word文档内容
 * @param {string} language - 语言
 * @param {string} modelName - 模型名称
 */
export function buildWordOutlineMessages(topic, wordContent, language = '中文', modelName = null) {
  // 从模型配置中读取是否支持system角色
  let supportsSystemRole = true
  
  if (modelName) {
    try {
      const config = getModelConfig(modelName)
      supportsSystemRole = config.supportsSystemRole !== false
    } catch (error) {
      console.warn(`[警告] 模型 ${modelName} 配置不存在，使用默认配置`)
    }
  }
  
  const userPrompt = buildWordOutlineUserPrompt(topic, wordContent, language)
  
  if (!supportsSystemRole) {
    // 不支持system角色的模型：合并到user消息
    const combinedPrompt = `${wordOutlineSystemPrompt}\n\n---\n\n${userPrompt}`
    return [
      { role: 'user', content: combinedPrompt }
    ]
  }
  
  // 标准格式
  return [
    { role: 'system', content: wordOutlineSystemPrompt },
    { role: 'user', content: userPrompt }
  ]
}
