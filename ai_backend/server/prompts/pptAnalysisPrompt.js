/**
 * PPT页面内容分析 Prompt
 * 
 * 用于分析PPT页面内容并自动分类
 */

/**
 * 构建PPT内容分析的系统提示词
 * 
 * @param {Array} categories - 分类标准数组
 * @returns {string} 系统提示词
 */
function buildPPTAnalysisSystemPrompt(categories) {
  // 🔄 只提取二级分类（level === 2）
  const level2Categories = categories.filter(cat => cat.level === 2)
  
  // 构建分类标准文本
  const categoryDescriptions = level2Categories.map((cat, index) => {
    return `### ${index + 1}. ${cat.name} (${cat.code})\n${cat.description || ''}`
  }).join('\n\n')
  
  // 🆕 生成有效的分类代码列表（用于约束）
  const validCodes = level2Categories.map(c => c.code).join('、')

  return `你是一位专业的PPT内容分析专家。你的任务是分析PPT页面的文本内容,并根据预定义的分类标准,为其分配最合适的分类标签。

## 分类标准

${categoryDescriptions}

## ⚠️ 重要约束

**你必须从以下列表中选择一个分类代码，不得使用其他代码：**

${validCodes}

**严禁使用以下代码（这些是一级分类，不能直接使用）：**
- enterprise_info（企业信息）
- cooperation_cases（合作案例）
- regulatory_policy_industry（监管政策与行业背景）
- product_solutions（产品解决方案）
- deployment_after_sales（部署实施及售后保障）
- other（其他）

**如果你不确定，请选择最接近的二级分类或使用 "other_content"。**

## 分析要求

1. **仔细阅读文本内容**:理解页面的核心主题和信息
2. **对比分类标准**:将内容与各分类的判断标准进行匹配
3. **选择最佳分类**:选择最贴合内容特征的二级分类code（必须从上述列表中选择）
4. **给出置信度**:评估分类的准确性(0-1之间的数值)
5. **提供理由**:简要说明为什么选择该分类

## 输出格式

你必须以JSON格式输出分析结果,格式如下:

\`\`\`json
{
  "category_code": "二级分类的code（必须从上述有效列表中选择）",
  "confidence": 0.95,
  "reason": "简要说明分类理由"
}
\`\`\`

## 注意事项

1. **category_code** 必须是二级分类的code（如 enterprise_basic_info, product_function_details 等）
2. **category_code** 必须从上述有效代码列表中选择，不得自行创造或使用一级分类代码
3. **confidence** 取值范围0-1,表示分类的置信度
4. **reason** 用中文简要说明分类依据,不超过100字
5. 如果内容无法明确分类,选择 "other_content" 并在reason中说明原因
6. 只输出JSON,不要有其他内容

## 示例

**输入文本**:
"XX公司成立于2010年,是一家专注于金融监管科技的高新技术企业。公司拥有员工200余人,年营收达2亿元。"

**输出**:
\`\`\`json
{
  "category_code": "enterprise_basic_info",
  "confidence": 0.92,
  "reason": "内容涉及企业成立时间、规模、定位等基础信息,符合企业基础信息的判断标准"
}
\`\`\``
}

/**
 * 构建用户提示词
 * 
 * @param {string} slideText - PPT页面的文本内容
 * @param {number} slideIndex - 页面索引(从0开始)
 * @param {string} slideId - 页面ID
 * @returns {string} 用户提示词
 */
function buildPPTAnalysisUserPrompt(slideText, slideIndex, slideId) {
  return `请分析以下PPT页面内容并进行分类:

【页面信息】
- 页面索引: ${slideIndex + 1}
- 页面ID: ${slideId}

【页面文本内容】
${slideText}

请根据以上内容,按照系统提示词中的分类标准进行分析,并以JSON格式输出结果。`
}

/**
 * 构建完整的消息数组
 * 
 * @param {string} slideText - PPT页面的文本内容
 * @param {number} slideIndex - 页面索引
 * @param {string} slideId - 页面ID
 * @param {Array} categories - 分类标准数组
 * @returns {Array} 消息数组
 */
function buildPPTAnalysisMessages(slideText, slideIndex, slideId, categories) {
  return [
    { 
      role: 'system', 
      content: buildPPTAnalysisSystemPrompt(categories) 
    },
    { 
      role: 'user', 
      content: buildPPTAnalysisUserPrompt(slideText, slideIndex, slideId) 
    }
  ]
}

module.exports = {
  buildPPTAnalysisSystemPrompt,
  buildPPTAnalysisUserPrompt,
  buildPPTAnalysisMessages
}

