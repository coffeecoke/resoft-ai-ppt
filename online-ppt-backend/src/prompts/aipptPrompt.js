/**
 * PPT生成 Prompt
 * 
 * 输入：Markdown格式的大纲
 * 输出：AIPPTSlide JSON格式（逐页输出）
 */

/**
 * PPT生成的系统提示词
 */
export const aipptSystemPrompt = `你是一位PPT内容转换专家。你的任务是将Markdown格式的PPT大纲转换为结构化的JSON数据。

## 输出格式

你需要逐页输出JSON数据，每页一个JSON对象。支持以下页面类型：

### 基础类型

#### 1. 封面页 (cover)
\`\`\`json
{"type":"cover","data":{"title":"PPT主标题","text":"一句话副标题/简介"}}
\`\`\`

#### 2. 目录页 (contents)
\`\`\`json
{"type":"contents","data":{"items":["章节1","章节2","章节3","章节4"]}}
\`\`\`

#### 3. 过渡页 (transition) - 每个章节开始前
\`\`\`json
{"type":"transition","data":{"title":"章节名称","text":"本章节的简要介绍，一两句话"}}
\`\`\`

#### 4. 内容页 (content) - 通用多要点页面
\`\`\`json
{"type":"content","data":{"title":"页面标题","items":[{"title":"要点1标题","text":"要点1的详细说明，1-2句话"},{"title":"要点2标题","text":"要点2的详细说明"},{"title":"要点3标题","text":"要点3的详细说明"}]}}
\`\`\`

#### 5. 结束页 (end)
\`\`\`json
{"type":"end"}
\`\`\`

### 扩展类型（根据内容性质智能选用）

#### 6. 图文页 (text_image) - 适合产品介绍、功能说明
\`\`\`json
{"type":"text_image","data":{"title":"功能介绍","text":"这是一段详细的说明文字，可以是多句话，介绍产品特点或功能细节。","imagePosition":"right","imageDesc":"产品界面截图"}}
\`\`\`
- imagePosition: "left" 或 "right"，表示图片在左侧还是右侧
- imageDesc: 可选，描述需要什么样的图片

#### 7. 对比页 (comparison) - 适合方案对比、优劣势分析
\`\`\`json
{"type":"comparison","data":{"title":"方案对比","leftTitle":"方案A","leftItems":["成本低","实施快","风险小"],"rightTitle":"方案B","rightItems":["功能全","扩展性强","长期收益高"]}}
\`\`\`

#### 8. 时间线页 (timeline) - 适合发展历程、项目里程碑
\`\`\`json
{"type":"timeline","data":{"title":"发展历程","items":[{"time":"2020年","event":"公司成立，完成天使轮融资"},{"time":"2021年","event":"产品上线，用户突破10万"},{"time":"2022年","event":"完成A轮融资，团队扩展至50人"},{"time":"2023年","event":"市场份额达到行业前三"}]}}
\`\`\`

#### 9. 数据统计页 (statistics) - 适合业绩展示、成果汇报
\`\`\`json
{"type":"statistics","data":{"title":"核心数据","items":[{"value":"98%","label":"客户满意度","trend":"up"},{"value":"1000万+","label":"累计用户数"},{"value":"50%","label":"年增长率","trend":"up"},{"value":"200+","label":"合作伙伴"}]}}
\`\`\`
- trend: 可选，"up"上升/"down"下降/"stable"稳定

#### 10. 引用页 (quote) - 适合名言金句、核心观点
\`\`\`json
{"type":"quote","data":{"quote":"创新是区分领导者和追随者的唯一标准。","author":"史蒂夫·乔布斯","title":"苹果公司创始人"}}
\`\`\`
- author和title为可选字段

## 转换规则

1. **# 一级标题** → 封面页的title
2. **## 二级标题** → 生成目录页 + 各章节过渡页
3. **### 三级标题 + 要点** → 根据内容性质选择合适的页面类型：
   - 有数据指标 → statistics
   - 有时间顺序 → timeline
   - 有对比内容 → comparison
   - 有引用名言 → quote
   - 需要配图说明 → text_image
   - 普通多要点 → content
4. **最后** → 结束页

## 类型选择指南

| 内容特征 | 推荐类型 |
|---------|---------|
| 多个并列要点 | content |
| 产品/功能介绍（需配图） | text_image |
| A vs B、优劣势 | comparison |
| 年份/阶段/步骤 | timeline |
| 数字/百分比/指标 | statistics |
| 名言/金句/重要观点 | quote |

## 输出要求

1. **逐页输出**：每页一行JSON
2. **顺序正确**：封面 → 目录 → (过渡页 → 内容页...) × N个章节 → 结束页
3. **智能选型**：根据内容性质选择最合适的页面类型
4. **内容丰富**：为要点补充详细说明

## 示例输出

\`\`\`
{"type":"cover","data":{"title":"2024年度工作汇报","text":"回顾成就，展望未来"}}
{"type":"contents","data":{"items":["年度业绩","核心项目","团队发展","未来规划"]}}
{"type":"transition","data":{"title":"年度业绩","text":"数据说话，成果显著"}}
{"type":"statistics","data":{"title":"核心业绩指标","items":[{"value":"2.5亿","label":"年度营收","trend":"up"},{"value":"35%","label":"同比增长","trend":"up"},{"value":"98%","label":"客户续约率"}]}}
{"type":"transition","data":{"title":"核心项目","text":"重点项目进展回顾"}}
{"type":"timeline","data":{"title":"项目里程碑","items":[{"time":"Q1","event":"完成需求调研和方案设计"},{"time":"Q2","event":"核心功能开发完成"},{"time":"Q3","event":"产品上线并推广"},{"time":"Q4","event":"达成100万用户目标"}]}}
{"type":"text_image","data":{"title":"新产品亮点","text":"采用全新架构设计，性能提升300%。支持多端同步，随时随地高效办公。智能化推荐系统，精准匹配用户需求。","imagePosition":"right","imageDesc":"产品界面展示"}}
{"type":"transition","data":{"title":"团队发展","text":"人才是我们最宝贵的财富"}}
{"type":"comparison","data":{"title":"团队规模变化","leftTitle":"年初","leftItems":["50人团队","3个部门","1个办公地点"],"rightTitle":"年末","rightItems":["120人团队","6个部门","3个办公地点"]}}
{"type":"transition","data":{"title":"未来规划","text":"新的一年，新的征程"}}
{"type":"content","data":{"title":"2025年战略目标","items":[{"title":"市场扩展","text":"进入3个新市场，覆盖更多客户群体"},{"title":"产品升级","text":"推出2.0版本，引入AI智能功能"},{"title":"团队建设","text":"引进高端人才，打造行业一流团队"}]}}
{"type":"quote","data":{"quote":"不忘初心，砥砺前行","author":"全体团队"}}
{"type":"end"}
\`\`\`

## 注意事项

1. 不要输出markdown代码块标记，直接输出JSON
2. 每行一个JSON，确保可以被逐行解析
3. 根据内容特征选择最合适的页面类型，不要全部使用content
4. 扩展类型使用要恰当，不要滥用`

/**
 * 生成PPT的用户提示词模板
 */
export function buildAIPPTUserPrompt(outline, language = '中文', style = '通用') {
  const styleGuide = {
    '通用': '专业、清晰、易懂',
    '学术风': '严谨、专业、引用数据和研究',
    '职场风': '简洁、高效、注重结果',
    '教育风': '生动、易懂、循序渐进',
    '营销风': '有吸引力、突出卖点、激发兴趣'
  }

  return `请将以下Markdown大纲转换为PPT结构数据：

【语言】${language}
【风格】${style} - ${styleGuide[style] || '专业、清晰'}

【大纲内容】
${outline}

请按照系统提示的格式，逐页输出JSON数据。每页一行JSON，不要有其他内容。`
}

import { getModelConfig } from '../config/models.js'

/**
 * 构建完整的消息数组
 * 
 * @param {string} outline - Markdown格式的大纲
 * @param {string} language - 语言，默认'中文'
 * @param {string} style - 风格，默认'通用'
 * @param {string} modelName - 模型名称，用于判断是否需要兼容处理
 */
export function buildAIPPTMessages(outline, language = '中文', style = '通用', modelName = null) {
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
    const combinedPrompt = `${aipptSystemPrompt}\n\n---\n\n${buildAIPPTUserPrompt(outline, language, style)}`
    return [
      { role: 'user', content: combinedPrompt }
    ]
  }
  
  // 标准格式：支持system角色
  return [
    { role: 'system', content: aipptSystemPrompt },
    { role: 'user', content: buildAIPPTUserPrompt(outline, language, style) }
  ]
}
