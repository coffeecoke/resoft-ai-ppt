/**
 * 模板填充 Prompt（方案D）
 * 
 * 输入：模板结构 + 用户主题 + 可选参考文档
 * 输出：每个槽位的内容映射
 */

/**
 * 模板填充的系统提示词
 */
export const templateFillSystemPrompt = `你是PPT内容生成专家。你的任务是根据用户提供的主题和参考内容，为PPT模板的每个文本槽位生成合适的内容。

## 核心规则

1. **严格按照模板结构生成**：模板有多少个槽位，你就必须生成多少条内容，不能增减
2. **内容适配**：
   - 如果参考内容不足以填满所有槽位，请合理扩展和发挥，保持主题相关
   - 如果参考内容过多，请精简合并，提取最重要的信息
3. **内容质量**：
   - 每个槽位的内容要简洁有力，适合PPT展示
   - 标题类槽位：简短有力，一般不超过10个字
   - 正文/列表类槽位：1-2句话，突出重点
4. **逻辑连贯**：
   - 先在内部规划好整体内容框架
   - 确保各页内容不重复、逻辑递进
   - 目录项要和后续内容页标题对应

## 输出格式

严格输出JSON格式，key为槽位ID，value为生成的内容：

\`\`\`json
{
  "slot_id_1": "生成的内容1",
  "slot_id_2": "生成的内容2",
  ...
}
\`\`\`

## 注意事项

1. 只输出JSON，不要有其他解释文字
2. 确保JSON格式正确，可以被解析
3. 所有槽位都必须填充，不能遗漏
4. 内容语言与用户主题保持一致`

/**
 * 构建模板填充的用户提示词
 * @param {string} structurePrompt - 模板结构描述
 * @param {string} topic - 用户主题
 * @param {string} wordContent - 参考文档内容（可选）
 */
export function buildTemplateFillUserPrompt(structurePrompt, topic, wordContent = '') {
  let prompt = `请为以下PPT模板生成内容：

【用户主题】
${topic}

${structurePrompt}
`

  if (wordContent) {
    // 限制文档内容长度，避免超出token限制
    const maxLength = 8000
    const truncatedContent = wordContent.length > maxLength 
      ? wordContent.substring(0, maxLength) + '\n...(内容已截断)'
      : wordContent
    
    prompt += `
【参考文档】
${truncatedContent}
`
  }

  prompt += `
【任务】
1. 首先在内部规划好PPT的整体内容框架（确保逻辑连贯、不重复）
2. 然后为每个槽位生成合适的内容
3. 以JSON格式输出，key为槽位ID（如上面的slot_xxx格式中的xxx部分）

请直接输出JSON，不要有其他内容：`

  return prompt
}

/**
 * 构建完整的消息数组
 * @param {string} structurePrompt - 模板结构描述
 * @param {string} topic - 用户主题
 * @param {string} wordContent - 参考文档内容（可选）
 * @param {string} modelName - 模型名称
 */
export function buildTemplateFillMessages(structurePrompt, topic, wordContent = '', modelName = null) {
  // 大部分模型都支持system角色，这里简化处理
  return [
    { role: 'system', content: templateFillSystemPrompt },
    { role: 'user', content: buildTemplateFillUserPrompt(structurePrompt, topic, wordContent) }
  ]
}

export default {
  templateFillSystemPrompt,
  buildTemplateFillUserPrompt,
  buildTemplateFillMessages
}
