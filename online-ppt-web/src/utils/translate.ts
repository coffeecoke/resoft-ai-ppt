/**
 * 翻译工具函数
 */

/**
 * 检测字符串是否包含中文
 */
export function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fa5]/.test(text)
}

/**
 * 使用简单的AI Prompt翻译中文到英文
 * 利用现有的AI接口
 * 降级策略：失败时返回原文，确保不会抛出异常
 */
export async function translateToEnglish(chineseText: string): Promise<string> {
  try {
    // 使用 fetch 调用后端 AI 翻译
    const response = await fetch('/api/tools/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: chineseText,
        from: 'zh',
        to: 'en'
      }),
    })
    
    if (!response.ok) {
      console.warn('[翻译] HTTP 错误，使用原文:', response.status)
      return chineseText
    }
    
    const result = await response.json()
    
    if (result.success && result.data && result.data.translatedText) {
      return result.data.translatedText
    }
    
    // 如果翻译失败，返回原文（降级策略）
    console.warn('[翻译] 翻译失败，使用原文:', result.error)
    return chineseText
  } catch (error) {
    // 网络错误或其他异常，返回原文（降级策略）
    console.warn('[翻译] 翻译异常，使用原文:', error)
    return chineseText
  }
}

/**
 * 简单的本地中英翻译映射（常用词汇）
 * 作为后备方案
 */
const commonTranslations: Record<string, string> = {
  // 场景类
  '商务': 'business',
  '科技': 'technology',
  '自然': 'nature',
  '城市': 'city',
  '办公': 'office',
  '团队': 'team',
  '会议': 'meeting',
  '合作': 'cooperation',
  '创新': 'innovation',
  '数据': 'data',
  '网络': 'network',
  '云计算': 'cloud computing',
  '人工智能': 'artificial intelligence',
  'AI': 'AI',
  
  // 自然类
  '山': 'mountain',
  '海': 'ocean',
  '天空': 'sky',
  '森林': 'forest',
  '花': 'flower',
  '树': 'tree',
  '日出': 'sunrise',
  '日落': 'sunset',
  '风景': 'landscape',
  '湖': 'lake',
  '河': 'river',
  
  // 人物类
  '人': 'people',
  '女性': 'woman',
  '男性': 'man',
  '儿童': 'children',
  '家庭': 'family',
  '朋友': 'friends',
  
  // 物品类
  '电脑': 'computer',
  '手机': 'mobile phone',
  '笔记本': 'laptop',
  '书': 'book',
  '咖啡': 'coffee',
  '食物': 'food',
  
  // 概念类
  '成功': 'success',
  '增长': 'growth',
  '未来': 'future',
  '目标': 'goal',
  '战略': 'strategy',
  '分析': 'analysis',
  '报告': 'report',
  '图表': 'chart',
}

/**
 * 本地简单翻译（基于词典）
 */
export function translateLocally(chineseText: string): string {
  const text = chineseText.trim().toLowerCase()
  
  // 先查找完全匹配
  if (commonTranslations[text]) {
    return commonTranslations[text]
  }
  
  // 查找包含的关键词
  for (const [zh, en] of Object.entries(commonTranslations)) {
    if (text.includes(zh)) {
      return en
    }
  }
  
  // 如果没有匹配，返回原文（让图片API自己处理）
  return chineseText
}

