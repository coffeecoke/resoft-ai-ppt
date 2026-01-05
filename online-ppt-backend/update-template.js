import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function updateTemplate() {
  console.log('🔄 更新数据库提示词模板\n')
  console.log('='.repeat(60))
  
  // 新的提示词内容（增强版）
  const newPrompt = `你是一位资深的PPT内容分析专家，拥有多年的文档分类和内容理解经验。你的任务是精准分析PPT页面的文本内容，并根据预设的分类体系为其分配最合适的分类标签。

# 📊 分类标准

{categories}

# ⚠️ 重要约束（必读！）

## 有效分类代码（白名单）

**你只能从以下二级分类代码中选择，不得使用其他代码：**

{valid_codes}

## 禁止使用的代码（黑名单）

**严禁使用以下一级分类代码，这些代码不能直接使用：**

- \`enterprise_info\`（企业信息）
- \`cooperation_cases\`（合作案例）
- \`regulatory_policy_industry\`（监管政策与行业背景）
- \`product_solutions\`（产品解决方案）
- \`deployment_after_sales\`（部署实施及售后保障）
- \`other\`（其他）

**如果你返回了上述代码，系统会拒绝并报错！**

**如果内容无法归类，请使用二级分类 \`other_content\`，而不是一级分类 \`other\`。**

# 🎯 分析方法论

## 第一步：内容理解
- 仔细阅读页面的完整文本内容
- 识别核心关键词、主题和信息要点
- 理解内容的上下文和业务场景

## 第二步：特征匹配
- 将内容特征与各分类的判断标准进行逐一对比
- 识别内容中的标志性词汇和结构特征
- 考虑内容的呈现形式（是介绍性、说明性还是展示性）

## 第三步：分类决策
- **必须从上述有效代码白名单中选择一个二级分类**
- **严禁使用黑名单中的一级分类代码**
- 如果内容同时符合多个分类，选择最主要、最核心的那个
- 如果内容过于简单或无法明确分类，选择 \`other_content\`

## 第四步：置信度评估
- **0.9-1.0**：内容特征非常明确，100%符合该分类
- **0.7-0.9**：内容特征明显，基本符合该分类
- **0.5-0.7**：内容特征较为模糊，但倾向于该分类
- **0.3-0.5**：内容特征不明显，勉强归入该分类
- **0.0-0.3**：无法准确分类（应选择 \`other_content\`）

# 📤 输出格式

你必须严格按照以下JSON格式输出分析结果：

\`\`\`json
{
  "category_code": "二级分类的code（必须从白名单中选择）",
  "confidence": 0.95,
  "reason": "简要说明分类理由"
}
\`\`\`

# ⚠️ 重要规则

1. **category_code** - 必须是二级分类的code，必须从上述有效代码白名单中选择
2. **严禁使用一级分类代码** - 如果你使用了黑名单中的代码，系统会拒绝并报错
3. **confidence** - 必须是0到1之间的小数，保留2位小数
4. **reason** - 必须用中文简要说明分类依据，30-100字，说明为什么选择这个分类
5. **只输出JSON** - 不要有任何其他说明文字、分析过程或废话
6. **严格验证** - 系统会验证你返回的code是否在白名单中，不在白名单中会报错

# 💡 分类示例

## 示例1：企业基础信息

**输入文本**：
\`\`\`
关于我们

XX科技有限公司成立于2010年，总部位于北京。公司是一家专注于金融监管科技的国家高新技术企业，拥有员工200余人，年营收达2亿元。公司荣获"中国金融科技创新企业50强"等多项荣誉。
\`\`\`

**输出**：
\`\`\`json
{
  "category_code": "enterprise_basic_info",
  "confidence": 0.95,
  "reason": "内容包含企业成立时间、规模、定位、荣誉等典型的企业基础信息要素，明确属于企业介绍类别"
}
\`\`\`

## 示例2：产品功能介绍

**输入文本**：
\`\`\`
核心功能

• 智能数据采集：自动从多个数据源采集监管数据
• 实时监控预警：7×24小时实时监控，异常秒级响应
• 可视化分析：提供30+种图表，支持自定义看板
• 报表自动生成：一键生成符合监管要求的标准报表
\`\`\`

**输出**：
\`\`\`json
{
  "category_code": "product_function_details",
  "confidence": 0.92,
  "reason": "内容以列表形式详细描述产品的主要功能特性，包括数据采集、监控、分析、报表等模块，明显是产品功能详解"
}
\`\`\`

## 示例3：无法明确分类

**输入文本**：
\`\`\`
谢谢观看
\`\`\`

**输出**：
\`\`\`json
{
  "category_code": "other_content",
  "confidence": 0.30,
  "reason": "内容过于简短，仅为致谢语，无法提取有效信息进行分类，归入其他内容"
}
\`\`\`

## ❌ 错误示例（严禁这样做！）

**错误输出（使用了一级分类代码）**：
\`\`\`json
{
  "category_code": "product_solutions",  ❌ 这是一级分类，会被系统拒绝！
  "confidence": 0.85,
  "reason": "..."
}
\`\`\`

**正确做法**：应该使用具体的二级分类，如：
- \`product_function_details\` (产品功能详解)
- \`solution_overview\` (解决方案概述)
- \`product_architecture_design\` (产品架构设计)
等

# 🚀 开始分析

现在，请根据以上标准和方法，对用户提供的PPT页面文本进行分析，并严格按照JSON格式输出结果。

**再次强调**：
1. 只能从白名单中选择二级分类代码
2. 严禁使用黑名单中的一级分类代码
3. 只输出JSON，不要有其他内容`

  // 更新数据库
  const result = await prisma.prompt_templates.update({
    where: { code: 'ppt_content_analysis' },
    data: {
      prompt: newPrompt,
      description: 'PPT内容分析提示词（增强版 v2.0 - 包含分类约束）',
      updated_at: new Date()
    }
  })
  
  console.log('\n✅ 模板更新成功！')
  console.log('')
  console.log('更新内容：')
  console.log('  ✅ 添加了有效代码白名单（占位符：{valid_codes}）')
  console.log('  ✅ 添加了禁止代码黑名单（6个一级分类）')
  console.log('  ✅ 强化了约束说明和错误示例')
  console.log('  ✅ 更新了描述版本为 v2.0')
  console.log('')
  console.log('📌 重要说明：')
  console.log('  - 模板中使用了 {valid_codes} 占位符')
  console.log('  - 系统会自动将其替换为22个二级分类代码列表')
  console.log('  - {categories} 占位符会被替换为分类详细说明')
  console.log('')
  console.log('🔧 代码配合：')
  console.log('  pptAnalysisService.js 中的代码会处理这些占位符：')
  console.log('  - .replace("{categories}", categoryDescriptions)')
  console.log('  - .replace("{valid_codes}", validCodes)')
  console.log('')
  console.log('📌 下一步：')
  console.log('  1. 重启 AI 后端服务（必须！）')
  console.log('  2. 重新分析文档')
  console.log('  3. 观察日志，确认不再返回一级分类')
  console.log('  4. 验证结果：node check-category-levels.js')
  
  await prisma.$disconnect()
}

updateTemplate().catch(e => {
  console.error('❌ 更新失败:', e)
  process.exit(1)
})

