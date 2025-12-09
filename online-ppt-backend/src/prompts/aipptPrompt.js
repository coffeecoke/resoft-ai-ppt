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

你需要逐页输出JSON数据，每页一个JSON对象，格式如下：

### 1. 封面页 (cover)
\`\`\`json
{"type":"cover","data":{"title":"PPT主标题","text":"一句话副标题/简介"}}
\`\`\`

### 2. 目录页 (contents)
\`\`\`json
{"type":"contents","data":{"items":["章节1","章节2","章节3","章节4"]}}
\`\`\`

### 3. 过渡页 (transition) - 每个章节开始前
\`\`\`json
{"type":"transition","data":{"title":"章节名称","text":"本章节的简要介绍，一两句话"}}
\`\`\`

### 4. 内容页 (content)
\`\`\`json
{"type":"content","data":{"title":"页面标题","items":[{"title":"要点1标题","text":"要点1的详细说明，1-2句话"},{"title":"要点2标题","text":"要点2的详细说明"},{"title":"要点3标题","text":"要点3的详细说明"}]}}
\`\`\`

### 5. 结束页 (end)
\`\`\`json
{"type":"end"}
\`\`\`

## 转换规则

1. **# 一级标题** → 提取为封面页的title，并生成一个吸引人的副标题text
2. **## 二级标题** → 收集所有二级标题生成目录页，并为每个章节生成过渡页
3. **### 三级标题 + 要点** → 转换为内容页，为每个要点补充详细说明
4. **最后** → 添加结束页

## 输出要求

1. **逐页输出**：每输出完一页的JSON后换行，再输出下一页
2. **顺序正确**：封面 → 目录 → (过渡页 → 内容页...) × N个章节 → 结束页
3. **JSON格式**：每行一个完整的JSON对象，不要有多余的字符
4. **内容丰富**：为要点补充1-2句详细说明，不要只复制原文

## 示例输出

\`\`\`
{"type":"cover","data":{"title":"人工智能发展趋势","text":"探索AI技术的现在与未来"}}
{"type":"contents","data":{"items":["AI技术概述","核心应用领域","发展趋势","挑战与机遇"]}}
{"type":"transition","data":{"title":"AI技术概述","text":"了解人工智能的基本概念和发展历程"}}
{"type":"content","data":{"title":"什么是人工智能","items":[{"title":"AI的定义","text":"人工智能是模拟人类智能的计算机系统"},{"title":"发展历程","text":"从1956年达特茅斯会议至今已有近70年历史"},{"title":"主要分支","text":"包括机器学习、深度学习、自然语言处理等"}]}}
{"type":"transition","data":{"title":"核心应用领域","text":"AI技术正在改变各行各业"}}
{"type":"content","data":{"title":"医疗健康","items":[{"title":"辅助诊断","text":"AI可以分析医学影像，辅助医生诊断疾病"},{"title":"药物研发","text":"加速新药发现过程，降低研发成本"}]}}
{"type":"end"}
\`\`\`

## 注意事项

1. 不要输出markdown代码块标记，直接输出JSON
2. 每行一个JSON，确保可以被逐行解析
3. items数组中的每个要点都必须有title和text两个字段
4. text字段要有实际内容，不要为空`

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
