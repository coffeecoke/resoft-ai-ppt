/**
 * 大纲生成 Prompt
 * 
 * 输入：用户的PPT主题
 * 输出：Markdown格式的PPT大纲
 */

/**
 * 生成大纲的系统提示词
 */
export const outlineSystemPrompt = `你是一位专业的PPT内容策划专家，擅长根据主题设计结构清晰、内容丰富的演示文稿大纲。

你的任务是根据用户提供的主题，生成一份完整的PPT大纲。

## 输出格式要求

请严格按照以下Markdown格式输出：

\`\`\`markdown
# PPT主标题

## 第一章节名称
### 页面1标题
- 要点1
- 要点2
- 要点3
### 页面2标题
- 要点1
- 要点2
- 要点3

## 第二章节名称
### 页面3标题
- 要点1
- 要点2
### 页面4标题
- 要点1
- 要点2
- 要点3

## 第三章节名称
...

## 总结与展望
### 核心要点回顾
- 总结点1
- 总结点2
- 总结点3
\`\`\`

## 结构规范

1. **一级标题 (#)**：PPT的总标题，只有一个
2. **二级标题 (##)**：章节名称，通常4-6个章节
3. **三级标题 (###)**：每页的标题，每个章节下2-4页
4. **要点 (-)**：每页的核心内容，每页3-5个要点

## 内容要求

1. 内容要专业、有深度，不要空洞
2. 要点要具体，避免泛泛而谈
3. 逻辑要清晰，层层递进
4. 最后要有总结章节

## 注意事项

1. 只输出Markdown格式的大纲，不要有其他说明文字
2. 不要输出封面页和结束页的具体内容，系统会自动添加
3. 确保格式正确，便于后续解析`

/**
 * 生成大纲的用户提示词模板
 */
export function buildOutlineUserPrompt(topic, language = '中文') {
  return `请为以下主题生成PPT大纲：

【主题】${topic}
【语言】请使用${language}
【要求】
- 内容专业、有深度
- 结构清晰、逻辑严谨
- 每页3-5个要点
- 总共约15-20页

请直接输出Markdown格式的大纲：`
}

import { getModelConfig } from '../config/models.js'

/**
 * 构建完整的消息数组
 * 
 * @param {string} topic - PPT主题
 * @param {string} language - 语言，默认'中文'
 * @param {string} modelName - 模型名称，用于判断是否需要兼容处理
 */
export function buildOutlineMessages(topic, language = '中文', modelName = null) {
  // 从模型配置中读取是否支持system角色
  let supportsSystemRole = true // 默认支持
  
  if (modelName) {
    try {
      const config = getModelConfig(modelName)
      // 如果配置中明确标记为 false，则不支持system角色
      supportsSystemRole = config.supportsSystemRole !== false
    } catch (error) {
      // 如果模型不存在，使用默认值（支持system角色）
      console.warn(`[警告] 模型 ${modelName} 配置不存在，使用默认配置`)
    }
  }
  
  if (!supportsSystemRole) {
    // 不支持system角色的模型：将system和user内容合并到一个user消息中
    const combinedPrompt = `${outlineSystemPrompt}\n\n---\n\n${buildOutlineUserPrompt(topic, language)}`
    return [
      { role: 'user', content: combinedPrompt }
    ]
  }
  
  // 标准格式：支持system角色（OpenAI、智谱、通义千问、DeepSeek、Moonshot等）
  return [
    { role: 'system', content: outlineSystemPrompt },
    { role: 'user', content: buildOutlineUserPrompt(topic, language) }
  ]
}
