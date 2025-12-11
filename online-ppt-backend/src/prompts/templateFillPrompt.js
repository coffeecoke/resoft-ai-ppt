/**
 * 模板填充 Prompt（方案D）
 * 
 * 输入：模板结构 + 用户主题 + 可选参考文档
 * 输出：每个槽位的内容映射
 */

/**
 * 模板填充的系统提示词
 */
export const templateFillSystemPrompt = `你是PPT内容生成专家。你的任务是根据用户提供的主题，为PPT模板的每个文本槽位生成合适的内容。

## 最重要的规则：严格保持原有格式！

每个槽位都标注了格式要求，你必须严格遵守：
- 如果标注"数字格式"：只输出数字（如 "98%"、"1000+"、"3.5万"），不要变成文字描述
- 如果标注"极短，N字以内"：内容必须≤N字
- 如果标注"短标题，约N字"：内容长度接近N字
- 如果标注"带编号"：保持相同的编号格式（如 "01"、"1."）
- 参考"原"后面的内容格式，生成类似格式的新内容

## 示例

原槽位: \`xxx | 统计数值 | 数字格式，如"98%" | 原: "98%"\`
✅ 正确输出: "85%"
❌ 错误输出: "销售额增长百分之八十五"

原槽位: \`yyy | 标题 | 极短，4字以内 | 原: "关于我们"\`
✅ 正确输出: "公司简介"
❌ 错误输出: "关于我们公司的详细介绍"

## 其他规则

1. **数量一致**：模板有多少个槽位，就生成多少条内容
2. **逻辑连贯**：各页内容不重复、逻辑递进
3. **语言一致**：与用户主题语言保持一致

## 输出格式

只输出JSON，key为槽位ID，value为新内容：

{
  "slot_id_1": "新内容1",
  "slot_id_2": "新内容2"
}`

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
