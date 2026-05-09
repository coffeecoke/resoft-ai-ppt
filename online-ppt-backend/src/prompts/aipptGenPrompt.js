// ========== 文档分析 Prompt ==========
export const analyzeSystemPrompt = `你是一位专业的文档分析专家。你的任务是阅读用户提供的文档内容，生成一份结构化的分析摘要报告。

输出要求（纯文本markdown格式）：
1. **文档概览**：一句话总结文档主题
2. **核心观点**：列出3-5个核心观点，每个观点附带原文关键论据
3. **关键数据**：提取文档中的数据、统计、指标（如有）
4. **结构脉络**：文档的逻辑结构（章节→要点）
5. **结论与建议**：文档的最终结论或建议

规则：
- 基于原文内容，不要编造
- 保留原文的关键表述和数据
- 按用户指定的参考模式调整：高度还原（尽量用原文表述）/ 适度改编（提炼重组）/ 自由发挥（概括大意即可）
- 只输出markdown内容，不加代码块标记`

// ========== 大纲生成 Prompt ==========
export function buildOutlinePrompt(options = {}) {
  const { pageLevel = 'standard', richness = 'moderate', referenceMode = 'adapt' } = options

  const pageLevelMap = {
    smart: '根据资料内容自动决定，一般10-14页（内容少则10页，内容丰富则12-14页，不要超过15页）',
    compact: '约10页（含封面/目录/章节过渡/结束页，实际内容约4-6页）',
    standard: '约20页（含封面/目录/章节过渡/结束页，实际内容约12-15页）',
    long: '约30页（含封面/目录/章节过渡/结束页，实际内容约20-25页）',
  }

  const richnessMap = {
    compact: '每个content页的description列出2-3个具体要点（每点一句，直接写要点内容，不同页要点不得重复）',
    moderate: '每个content页的description列出3-5个具体、独特的要点（直接写要展示的内容要点，包含关键数据或论据，不同页要点不得重复）',
    detailed: '每个content页的description列出5-7个详细要点（每点包含具体数据、案例或论据，确保每页内容高度差异化，不得与其他页重复）',
  }

  const refMap = {
    strict: 'description应尽量使用原文表述和原文数据',
    adapt: 'description可以在原文基础上提炼重组',
    free: 'description可以自由概括大意',
  }

  return `你是一位专业的PPT内容策划师。根据用户提供的分析摘要和选项，生成结构化PPT大纲。

严格输出JSON（不加代码块标记）：
{
  "title": "PPT主标题",
  "subtitle": "1-2句核心价值描述",
  "pages": [
    { "type": "cover", "title": "主标题", "description": "封面页展示方式" },
    { "type": "catalog", "title": "目录", "description": "列出所有章节标题" },
    { "type": "chapter", "title": "第一章 章节名称", "description": "章节过渡页设计思路" },
    { "type": "content", "title": "内容页标题", "description": "本页要展示的具体内容和要点" },
    { "type": "end", "title": "感谢聆听", "description": "结束页设计" }
  ]
}

要求：
- pages是扁平列表，每项包含type、title、description三个字段
- 第1页必须是cover（封面），第2页必须是catalog（目录），最后一页必须是end（结束）
- 每个章节开始前放一个chapter（章节过渡页），共4-6个章节
- chapter页之间放2-4个content（内容页）
- 总计${pageLevelMap[pageLevel] || pageLevelMap.standard}
- description要求：${richnessMap[richness] || richnessMap.moderate}
- 参考模式：${refMap[referenceMode] || refMap.adapt}
- content页的title要具体明确，体现该页要讲的核心内容
- 最后一个章节为"总结与展望"
- 只输出JSON对象，不加任何其他文字`
}

// ========== 主题视觉 token 提取（配色 + 质感风格）==========
export function extractThemeTokens(html) {
  const tokens = new Set()
  const classMatches = html.match(/class="([^"]+)"/g) || []

  const TAILWIND_COLORS = 'white|black|transparent|current|inherit|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'

  const isStyleToken = (cls) => {
    const base = cls.replace(/^[a-z-]+:/, '')
    return (
      // ── 配色 ──
      // 背景色（含透明度变体 bg-black/50）
      new RegExp(`^bg-(${TAILWIND_COLORS}|\\[)`).test(base) ||
      // 渐变
      /^(from|to|via)-/.test(base) ||
      // 文字色
      new RegExp(`^text-(${TAILWIND_COLORS}|\\[#)`).test(base) ||
      // 边框色
      new RegExp(`^border-(${TAILWIND_COLORS}|\\[)`).test(base) ||
      // 分割线 / 光圈 / 阴影色
      new RegExp(`^(divide|ring|shadow)-(${TAILWIND_COLORS}|\\[)`).test(base) ||

      // ── 质感风格 ──
      // 圆角
      /^rounded(-[a-z0-9]+)*$/.test(base) ||
      // 边框宽度 / 方向（border-2, border-l-4, border-b-2 等）
      /^border(-[tlrbxy])?(-[0-9]+)$/.test(base) ||
      // 阴影大小
      /^shadow(-[a-z0-9]+)*$/.test(base) ||
      // 背景透明度变体（bg-gray-800/30 → 已含在背景色里，额外捕捉 /数字 结尾的）
      /^bg-.+\/\d+$/.test(base) ||
      // 毛玻璃
      /^backdrop-blur(-[a-z0-9]+)*$/.test(base) ||
      // 透明度
      /^opacity-\d+$/.test(base)
    )
  }

  for (const attr of classMatches) {
    const classes = attr.slice(7, -1).split(/\s+/)
    for (const cls of classes) {
      if (cls && isStyleToken(cls)) tokens.add(cls.replace(/^[a-z-]+:/, ''))
    }
  }

  return Array.from(tokens)
}

// ========== 非内容页生成（封面 / 目录 / 章节 / 结束）==========
function buildStructuredPageMessages(pageType, content, themeStyleHtml, topicContext) {
  const pageTypeDesc = {
    cover: '封面页',
    catalog: '目录页',
    chapter: '章节过渡页',
    end: '结束页',
  }

  const lines = []
  if (content.title) lines.push(`标题：${content.title}`)
  if (content.subtitle) lines.push(`副标题：${content.subtitle}`)
  if (content.description) lines.push(`说明：${content.description}`)
  if (content.chapters?.length) {
    lines.push(`章节列表（共 ${content.chapters.length} 项，必须全部展示）：`)
    content.chapters.forEach((c, i) => lines.push(`  ${i + 1}. ${c}`))
  }

  return [
    {
      role: 'system',
      content: `你是PPT幻灯片HTML生成专家。

## 任务
基于给定的【模板HTML】，生成视觉风格高度一致的幻灯片，将示例内容替换为实际内容。

## 视觉必须精确复现（最高优先级）
- 背景色/渐变：使用与模板完全相同的 Tailwind class（如 bg-black、from-slate-900、bg-[#0f172a]）
- 文字颜色：主标题色、副标题色、辅助文字色与模板一致，使用相同 class
- 装饰元素：保留模板中的线条、分隔符、角标、色块等所有装饰
- 字重与字号比例：保持相同的层级关系（大标题对应大标题 class，正文对应正文 class）
- 动画效果：保留 animate__animated 及相关动画 class

## 结构调整原则
- 将示例文字替换为实际内容
- 条目数量按实际内容增减（如目录章节数多于模板，按同样样式增加条目）
- 布局可以根据内容量微调，但整体视觉风格不得改变
- 不得引入模板中没有的颜色或装饰风格

## 防溢出铁律
- 最外层 class 必须包含 w-[1280px] h-[720px] overflow-hidden
- body：margin:0; overflow:hidden
- 内容过多时缩小字号或压缩间距，不得让内容超出 720px 高度

## 技术规则
- ⚠️ 依赖引入顺序固定，格式不可改变（tailwind 是 JS 用 script，不是 link）：
  <script src="/libs/tailwind.js"></script>
  <link rel="stylesheet" href="/libs/fontawesome.min.css">
  <link rel="stylesheet" href="/libs/animate.min.css">
- 只输出完整 HTML，不加任何说明文字`,
    },
    {
      role: 'user',
      content: `【模板HTML】：
${themeStyleHtml}

【PPT主题】：${topicContext || ''}
【页面类型】：${pageTypeDesc[pageType] || pageType}
【实际内容】：
${lines.join('\n')}

请基于模板生成本页HTML：`,
    },
  ]
}

// ========== 幻灯片生成 Prompt（内容页 + 非内容页统一入口）==========
export function buildSlideGenMessages(pageType, content, themeStyleHtml, topicContext, summary, options = {}, skeletonPool = [], componentPool = []) {
  // 非内容页：精确复现模板视觉，结构可微调
  if (pageType !== 'content') {
    return buildStructuredPageMessages(pageType, content, themeStyleHtml, topicContext)
  }

  // 内容页：提取 token 作为色值硬约束，布局自由发挥
  const { richness = 'moderate', imageMode = 'standard' } = options

  const skeletonRef = skeletonPool.length > 0 ? `

## 布局版式参考
以下是可选的版式骨架（仅展示分区结构，配色按主题风格自行设计）：

${skeletonPool.map(s => `**${s.name}**：${s.description}\n${s.html}`).join('\n\n')}

根据本页内容选择最合适的版式，或自由创作。同一 PPT 中尽量每页使用不同版式。` : ''

  const componentRef = componentPool.length > 0 ? `

## 可用UI组件
以下是预置的可复用组件片段，可在页面中自由组合（配色按主题调整）：

${componentPool.map(c => `**${c.name}**：${c.description}\n${c.html}`).join('\n\n')}` : ''

  const tokens = extractThemeTokens(themeStyleHtml)
  const tokenConstraint = tokens.length > 0
    ? `\n\n## ⚠️ 主题风格约束（最高优先级）
你会收到一份【主题风格参考HTML】，从中提取以下视觉元素并严格应用：
- 配色方案：背景色/渐变、主标题色、副标题色、正文色、accent 强调色
- 装饰质感：边框宽度与方向（border-l-4 等）、圆角大小、阴影风格、透明度叠加（bg-xxx/30 等）、毛玻璃效果
- 色彩组合关系：哪种颜色用于强调、哪种用于辅助、哪种用于背景

禁止从参考 HTML 中复制的内容：
- 布局结构（几列、左右分布、卡片网格等）
- 动画方式（fadeInLeft/Right 等具体组合）
- 任何文字内容`
    : ''

  const richnessGuide = {
    compact: '内容精简，每页3-4个短要点，留白较多',
    moderate: '内容适中，每页4-6个要点，图文并茂',
    detailed: '内容详实，每页5-8个要点或详细段落，充分利用空间',
  }

  const imageGuide = {
    standard: `根据内容特点自主决定是否配图：
- 适合配图：人物介绍、场景描述、产品展示、流程图解等视觉化内容
- 不适合配图：纯数据对比、逻辑推导、文字密集的列表页

配图时从以下三种标准布局中选一种（根据内容量和视觉效果决定），不得偏离：
① 左文右图：文字列 flex-1，图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"
② 左图右文：图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"，文字列 flex-1
③ 上图下文：图片区 class="w-full h-[280px] overflow-hidden rounded-xl flex-shrink-0 mb-6"，文字区 flex-1 overflow-hidden

图片标签统一：<img alt="简明图片描述（供搜图用）" class="w-full h-full object-cover rounded-xl">`,
    none: '不配图，纯文字排版',
    ai: `根据内容特点自主决定是否配图（同 standard 判断标准）。
配图时从以下三种标准布局中选一种：
① 左文右图：文字列 flex-1，图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"
② 左图右文：图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"，文字列 flex-1
③ 上图下文：图片区 class="w-full h-[280px] overflow-hidden rounded-xl flex-shrink-0 mb-6"，文字区 flex-1 overflow-hidden

图片标签：<img alt="详细画面描述（用于AI生图的提示词，包含构图、风格、主体）" class="w-full h-full object-cover rounded-xl">`,
  }

  return [
    {
      role: 'system',
      content: `你是专业的PPT幻灯片HTML生成专家。${skeletonRef}${componentRef}${tokenConstraint}

## 工作方式
你会收到：
1. 【风格参考HTML】：展示目标主题的视觉DNA（颜色体系、字体层次、装饰元素风格）
2. 【页面类型】和【本页标题】
3. 【分镜描述】：说明本页要展示什么内容
4. 【参考资料】：文档分析摘要（作为内容参考）

你的任务：生成一张与参考HTML视觉风格一致（颜色、字体、装饰），但布局结构完全服务于本页内容的全新HTML。

## ❗❗❗ 最高优先级：绝不溢出（违反此规则 = 废品）
画布只有 1280×720 像素。你无法滚动，无法翻页，放不下的内容就是看不见。

**内容放不下的处理优先级（必须按此顺序尝试，不能跳步）：**
1. **换紧凑排版**：切换到更紧凑的布局模板（如卡片→列表、大卡片→小卡片）
2. **缩小字体**：正文可以降到 text-xs（12px），标题降到 text-base（16px）
3. **压缩间距**：gap-2、p-2、mb-1，尽可能紧凑
4. **精简措辞**：缩短每条要点的文字，但保留所有要点不删除
5. **最后手段**：仅在以上全部尝试后仍放不下时，才删除最次要的1-2个要点

**结构铁律：**
- 最外层：class="w-[1280px] h-[720px] overflow-hidden relative flex flex-col"
- 如果有顶部标题栏：固定高度如 h-[60px]~h-[80px]，用 shrink-0
- 内容区：flex-1 overflow-hidden（自动占满剩余空间）
- body 样式：style="margin:0;overflow:hidden;"

## 核心原则
- **内容完整性优先**：尽量保留分镜描述的所有要点，通过布局和字体适配，不要轻易删减内容
- 不做"槽位替换"——根据内容量和类型自由决定最合适的布局结构
- 内容多→多列小卡片紧凑排版、缩小字体；内容少→大字居中更多留白
- **每一页布局必须不同**，严禁连续两页使用相同的布局模式

## 视觉技巧
1. **装饰图标**：卡片背景 text-7xl~9xl opacity-50~60 的图标底层装饰
2. **关键词高亮**：核心数据用 <strong class="font-bold">高亮</strong>
3. **卡片头部**：浅色底条+圆形图标+标题
4. **hover动效**：group + group-hover:scale-105 + transition-transform duration-300
5. **动画多样化**：每页使用不同的 animate.css 组合，可选 fadeInDown/fadeInUp/fadeInLeft/fadeInRight/zoomIn/slideInUp，delay 0.1s~0.5s 递增，禁止每页都用相同动画

## ❗❗❗ 文字可读性（违反 = 废品）
**核心规则：文字必须与背景有强对比，一眼能看清。**
- 白色/浅色背景 → 文字必须用深色（text-gray-800, text-gray-900）
- 深色/彩色背景 → 文字必须用白色（text-white）或浅色（text-gray-100）
- 半透明背景（bg-black/50）→ 文字一律 text-white
- **禁止**：浅色文字+浅色背景、深色文字+深色背景
- 最小正文颜色深度：text-gray-600（白底）、text-gray-300（深色背景）

## 规则
1. 内容来源优先级：分镜描述 > 参考资料 > 自由发挥
2. ⚠️ 依赖引入顺序固定，格式不可改变（tailwind 是 JS 用 script，不是 link）：
   <script src="/libs/tailwind.js"></script>
   <link rel="stylesheet" href="/libs/fontawesome.min.css">
   <link rel="stylesheet" href="/libs/animate.min.css">
4. ${imageGuide[imageMode] || imageGuide.standard}
5. 内容密度：${richnessGuide[richness] || richnessGuide.moderate}
6. 只输出一份完整HTML文档，不要重复输出，不要加说明文字`,
    },
    {
      role: 'user',
      content: `【主题风格参考HTML】（只读取视觉风格，禁止复制布局结构和动画方式）：
${themeStyleHtml}
【PPT主题】：${topicContext || ''}
${content.chapterTitle ? `【所属章节】：${content.chapterTitle}` : ''}
【本页标题】：${content.title || ''}
${content.description ? `【分镜描述（本页要点）】：${content.description}` : ''}
${content.siblingTitles?.length ? `【同章节其他页（已覆盖，本页不得重复）】：${content.siblingTitles.join('、')}` : ''}
${summary ? `【参考资料摘要】：
${summary}` : ''}

请生成本页HTML幻灯片：`,
    },
  ]
}

// ========== AI 编辑 Prompt ==========
export function buildAiEditMessages(htmlContent, instruction, history = [], pageType = 'content') {
  const tokens = extractThemeTokens(htmlContent)
  const tokenConstraint = tokens.length > 0
    ? `\n当前主题色值与质感约束（修改时沿用以下 class，不得引入其他颜色或风格）：\n${tokens.join('  ')}`
    : ''

  const systemPrompt = `你是PPT幻灯片编辑专家，支持多轮对话式修改。
当前页面类型：${pageType}

## ❗ 画布硬约束（最高优先级，违反 = 废品）
- 画布固定 1280×720 像素，内容不可滚动
- 最外层容器必须保持 w-[1280px] h-[720px] overflow-hidden
- body 保持 style="margin:0;overflow:hidden;"
- 内容增加时优先缩小字号（最小 text-xs）、压缩间距，不得撑出画布

## 依赖引入规范
- Tailwind 必须用 <script src="/libs/tailwind.js"></script>，禁止写成 <link rel="stylesheet">
- FontAwesome / Animate.css 用 <link rel="stylesheet" href="/libs/xxx">

## ❗ 文字可读性（违反 = 废品）
- 浅色 / 白色背景 → 文字用深色（text-gray-800、text-gray-900）
- 深色 / 彩色背景 → 文字用白色（text-white）或浅色（text-gray-100）
- 禁止：浅色文字 + 浅色背景、深色文字 + 深色背景

## 配图规范（用户要求加图时遵守）
根据内容决定是否配图；配图时从以下三种标准布局选一种：
① 左文右图：文字列 flex-1，图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"
② 左图右文：图片列 class="w-[42%] h-full overflow-hidden rounded-xl flex-shrink-0"，文字列 flex-1
③ 上图下文：图片区 class="w-full h-[280px] overflow-hidden rounded-xl flex-shrink-0 mb-6"，文字区 flex-1 overflow-hidden
图片标签统一：<img alt="简明描述" class="w-full h-full object-cover rounded-xl">
${tokenConstraint}

## 编辑规则
1. 参考历史对话理解用户意图，只修改本次指令涉及的内容
2. 其余 HTML 结构、class、内容保持不变
3. 只输出完整修改后的 HTML，不加任何说明文字`

  return [
    { role: 'system', content: systemPrompt },
    ...history.slice(-8).map(msg => ({ role: msg.role, content: msg.content })),
    {
      role: 'user',
      content: `【当前幻灯片HTML】：
${htmlContent}

【本次修改要求】：${instruction}

输出修改后的完整HTML：`,
    },
  ]
}
