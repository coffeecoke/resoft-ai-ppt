/**
 * 投标文件分析提示词
 * 两个阶段：识别章节结构 → 逐章节分类打标
 */

const { buildSectionTypePromptText } = require('../config/bidSectionTypes')

/**
 * 阶段1：识别文档章节结构
 */
function buildSplitStructureMessages(docText) {
  const systemPrompt = `你是一位资深的投标文件审阅专家。
请分析以下投标文件的文本内容，识别其**一级章节**结构。

**任务**：只找出文档中最顶层（第一层）的章节边界，输出每个一级章节的标题和起始关键词。

**识别规则（严格执行）**：
1. 只识别一级标题，即文档的最顶层结构，常见形式：
   - "第一章 xxx"、"第二章 xxx"
   - "第一部分 xxx"、"第二部分 xxx"
   - "一、xxx"、"二、xxx"（仅当它是文档最顶层时）
   - 封面页、目录页也算一个顶层章节
2. **严禁**识别二级及更深层子章节，例如：
   - "1.1"、"1.2"、"4.2"、"4.3.1" 这类带小数点编号的 → 绝对不识别
   - "（一）"、"（二）" 这类括号编号 → 只有当它是最顶层时才识别
   - "第一节"、"第二节" → 若在某章节下，则不识别
3. 判断是否一级的方法：看该标题前面有没有更高层的章节，如果有，则它是子章节，不要识别
4. 一级章节数量通常在 3-15 个之间，若你识别超过 20 个，说明混入了子章节，请重新筛选

**输出要求**：严格以 JSON 数组格式输出，不要输出任何多余文字。

数组中每个元素固定格式：
{
  "title": "章节标题（如：第一章 投标函）",
  "level": 1,
  "start_keyword": "章节开头的纯文字关键词（10-20个汉字，不含引号/反斜杠/换行等特殊字符）"
}

**其他约束**：
- level 字段固定为 1，不得出现其他值
- start_keyword 取章节标题本身文字，如"第一章 投标函"、"第二部分 商务方案"
- 所有字段值不得包含双引号、反斜杠、换行符`

  const userPrompt = `请分析以下投标文件的章节结构：

【投标文件内容】
${docText}

请严格以 JSON 数组格式输出章节结构。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * 阶段2：对单个章节进行分类打标
 * @param {string} sectionTitle
 * @param {string} sectionContent
 * @param {string} [sectionTypesText] - 从数据库动态获取的类型列表文本；不传则用静态配置降级
 */
function buildClassifySectionMessages(sectionTitle, sectionContent, sectionTypesText) {
  const sectionTypes = sectionTypesText || buildSectionTypePromptText()

  const systemPrompt = `你是一位投标文件分析专家。
请对给定的投标文件章节进行分类打标和质量评估。

**章节类型列表**（必须从以下类型代码中选择一个）：
${sectionTypes}

**分类判断依据**：
- 看章节标题关键词：投标函/承诺书 → cover_letter；资质/营业执照 → company_profile
- 技术方案/技术架构/系统设计 → technical_solution
- 实施计划/进度安排/里程碑 → implementation_plan
- 项目管理/组织架构/沟通机制 → project_management
- 质量保证/测试/验收 → quality_assurance
- 售后/运维/培训/SLA → after_sales_service
- 项目团队/人员简历/人员配置 → team_composition
- 案例/业绩/成功经验 → case_reference
- 报价/价格/费用/商务 → pricing
- 安全/保密/信息安全 → security
- 附件/证明/资料 → appendix
- 以上都不符合 → other

**输出要求**：严格以 JSON 格式输出，不要输出任何多余文字。

JSON 结构：
{
  "section_type": "类型代码（必填，从上面列表中选）",
  "tags": ["标签1", "标签2"],
  "quality_score": 0.85,
  "quality_comment": "质量评价简述",
  "is_reusable": true,
  "summary": "章节内容摘要（50字以内）"
}`

  const userPrompt = `请分析以下投标章节：

【章节标题】${sectionTitle}

【章节内容】
${sectionContent}

请严格以 JSON 格式输出分析结果。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

module.exports = {
  buildSplitStructureMessages,
  buildClassifySectionMessages,
  buildLevel2StructureMessages,
}

/**
 * 阶段1b：在已识别的1级章节文本里，识别其2级子章节结构
 * @param {string} parentTitle - 1级章节标题（用于上下文）
 * @param {string} sectionText - 1级章节的纯文本内容
 */
function buildLevel2StructureMessages(parentTitle, sectionText) {
  const systemPrompt = `你是一位资深的投标文件审阅专家。
请分析以下投标文件章节的内容，识别其**二级子章节**结构。

**上下文**：当前分析的是一级章节「${parentTitle}」的内部结构。

**任务**：找出该章节内部的直接子章节（第二层），输出每个子章节的标题和起始关键词。

**识别规则**：
1. 只识别当前章节的**直接子章节**（第二层），不要深入到第三层
2. 常见二级标题形式：
   - "1.1 xxx"、"2.3 xxx"（数字编号）
   - "（一）xxx"、"（二）xxx"（括号编号）
   - "一、xxx"、"二、xxx"（中文数字，若当前章节顶层是"第X章"时）
   - "第一节 xxx"、"第二节 xxx"
3. 若内容没有明显的子章节结构（内容少于300字或无标题层次），请返回空数组 []
4. 子章节数量通常在 2-10 个，不要识别太细

**输出要求**：严格以 JSON 数组格式输出，不要输出任何多余文字。

数组中每个元素：
{
  "title": "子章节标题（如：1.1 项目背景）",
  "level": 2,
  "start_keyword": "该子章节起始的纯文字关键词（10-20个字，不含引号/反斜杠/换行）"
}

若无子章节，输出：[]`

  // 截取策略：总上限提高到 20000 字，超长时保留首尾（标题通常在段落开头）
  let textForAI
  if (sectionText.length <= 20000) {
    textForAI = sectionText
  } else {
    const head = sectionText.slice(0, 14000)
    const tail = sectionText.slice(-4000)
    textForAI = head + '\n\n...（中间正文内容已省略）...\n\n' + tail
  }

  const userPrompt = `请分析以下章节的内部二级结构：

【章节内容】
${textForAI}

请以 JSON 数组格式输出二级子章节列表。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}
