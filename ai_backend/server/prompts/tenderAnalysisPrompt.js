/**
 * 招标文件分析提示词
 * 分三个阶段：提取关键信息 → 生成投标目录 → 填充章节内容
 */

const { buildSectionTypePromptText } = require('../config/bidSectionTypes')

/**
 * 阶段1：提取招标关键信息
 */
function buildExtractInfoMessages(tenderText) {
  const systemPrompt = `你是一位资深的投标专家，擅长分析招标文件。
请仔细阅读以下招标文件内容，提取关键信息。

**输出要求**：严格以 JSON 格式输出，不要输出任何多余文字。

JSON 结构如下：
{
  "project_name": "项目名称",
  "bid_deadline": "投标截止时间",
  "budget": "预算金额（如有）",
  "purchaser": "采购人/招标人名称",
  "evaluation_method": "评标方法（综合评分法/最低评标价法/...）",
  "scoring_criteria": [
    { "item": "评分项名称", "weight": 分值, "description": "评分说明" }
  ],
  "qualification_requirements": [
    "资质要求1",
    "资质要求2"
  ],
  "technical_requirements": [
    "技术要求1",
    "技术要求2"
  ],
  "commercial_requirements": [
    "商务要求1",
    "商务要求2"
  ],
  "delivery_requirements": {
    "deadline": "交付期限",
    "location": "交付地点",
    "acceptance": "验收标准"
  },
  "special_notes": [
    "其他重要注意事项"
  ]
}`

  const userPrompt = `请分析以下招标文件内容，提取关键信息：

【招标文件内容】
${tenderText}

请严格以 JSON 格式输出分析结果。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * 阶段2：生成投标目录结构
 */
function buildDirectoryMessages(analysisResult) {
  const sectionTypes = buildSectionTypePromptText()

  const systemPrompt = `你是一位资深的投标文件编制专家。
根据招标文件的分析结果，生成一份完整的投标文件目录结构。

**目录要求**：
1. 目录至少包含一级（章）和二级（节）结构，重要章节可细化到三级（小节）
2. 目录必须覆盖招标文件中的所有评分项
3. 参照招标文件评分标准的权重，合理安排章节篇幅
4. 每个目录项要标注 section_type（章节类型）

**章节类型列表**：
${sectionTypes}

**输出要求**：严格以 JSON 数组格式输出，不要输出任何多余文字。

数组中每个元素结构：
{
  "title": "章节标题",
  "level": 1,
  "sort_order": 1,
  "section_type": "类型代码",
  "scoring_weight": 评分权重(数字，无则null),
  "children": [
    {
      "title": "二级标题",
      "level": 2,
      "sort_order": 1,
      "section_type": "类型代码",
      "scoring_weight": null,
      "children": []
    }
  ]
}`

  const userPrompt = `请根据以下招标分析结果，生成投标文件目录结构：

【招标分析结果】
${JSON.stringify(analysisResult, null, 2)}

请严格以 JSON 数组格式输出目录结构。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

/**
 * 阶段3：填充章节默认内容
 */
function buildFillContentMessages(chapterTitle, sectionType, analysisResult, scoringWeight) {
  const systemPrompt = `你是一位资深的投标文件编写专家。
请根据招标要求，为投标文件的指定章节编写内容。

**写作要求**：
1. 内容要专业、严谨，符合投标文件的正式行文风格
2. 要针对招标文件的要求点逐一响应
3. 内容要有条理，使用编号和层次结构
4. 占位信息用【待填写：xxx】标注，方便用户后续替换
5. 输出纯文本，不要使用 Markdown 格式
6. 篇幅根据评分权重合理安排：权重高的章节内容要更详细`

  const userPrompt = `请为以下投标章节编写默认内容：

【章节标题】${chapterTitle}
【章节类型】${sectionType}
【评分权重】${scoringWeight !== null ? `${scoringWeight}分` : '未指定'}

【招标分析结果】
${JSON.stringify(analysisResult, null, 2)}

请直接输出该章节的内容文本，不要重复标题。`

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]
}

module.exports = {
  buildExtractInfoMessages,
  buildDirectoryMessages,
  buildFillContentMessages,
}
