/**
 * 翻译服务
 * 
 * 提供简单的中英文翻译功能
 */

import aiService from './aiService.js'

class TranslateService {
  /**
   * 本地词典翻译（常用词汇快速翻译）
   */
  localDict = {
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
    '海滩': 'beach',
    '雪': 'snow',
    '山脉': 'mountains',
    
    // 人物类
    '人': 'people',
    '女性': 'woman',
    '男性': 'man',
    '儿童': 'children',
    '家庭': 'family',
    '朋友': 'friends',
    '老人': 'elderly',
    '年轻人': 'young people',
    
    // 物品类
    '电脑': 'computer',
    '手机': 'mobile phone',
    '笔记本': 'laptop',
    '书': 'book',
    '咖啡': 'coffee',
    '食物': 'food',
    '汽车': 'car',
    '建筑': 'building',
    
    // 概念类
    '成功': 'success',
    '增长': 'growth',
    '未来': 'future',
    '目标': 'goal',
    '战略': 'strategy',
    '分析': 'analysis',
    '报告': 'report',
    '图表': 'chart',
    '金融': 'finance',
    '投资': 'investment',
    '市场': 'market',
    '教育': 'education',
    '医疗': 'medical',
    '健康': 'health',
    '运动': 'sport',
    '音乐': 'music',
    '艺术': 'art',
    '设计': 'design',
  }

  /**
   * 检测是否包含中文
   */
  hasChinese(text) {
    return /[\u4e00-\u9fa5]/.test(text)
  }

  /**
   * 翻译文本（带降级策略，确保不会抛出异常）
   * 
   * @param {string} text - 要翻译的文本
   * @param {string} from - 源语言 (zh/en)
   * @param {string} to - 目标语言 (zh/en)
   * @returns {Promise<string>} 翻译结果，失败时返回原文
   */
  async translate(text, from = 'zh', to = 'en') {
    try {
      // 如果不包含中文，直接返回
      if (from === 'zh' && to === 'en' && !this.hasChinese(text)) {
        return text
      }
      
      // 先尝试本地词典翻译（快速）
      const localResult = this.translateLocally(text)
      if (localResult !== text) {
        console.log(`[翻译] 使用本地词典: "${text}" -> "${localResult}"`)
        return localResult
      }
      
      // 如果本地词典没有，使用AI翻译
      try {
        return await this.translateWithAI(text, from, to)
      } catch (error) {
        console.warn('[翻译] AI翻译失败，降级使用原文:', error.message)
        return text
      }
    } catch (error) {
      // 兜底：任何异常都返回原文
      console.error('[翻译] 翻译过程异常，返回原文:', error.message)
      return text
    }
  }

  /**
   * 本地词典翻译
   */
  translateLocally(text) {
    const trimmed = text.trim()
    
    // 完全匹配
    if (this.localDict[trimmed]) {
      return this.localDict[trimmed]
    }
    
    // 包含匹配（查找第一个匹配的关键词）
    for (const [zh, en] of Object.entries(this.localDict)) {
      if (trimmed.includes(zh)) {
        return en
      }
    }
    
    return text
  }

  /**
   * 使用AI翻译
   */
  async translateWithAI(text, from, to) {
    const prompt = from === 'zh' && to === 'en'
      ? `请将以下中文翻译成英文，只返回翻译结果，不要有任何解释或额外内容：\n\n${text}`
      : `Please translate the following text from ${from} to ${to}, return only the translation without any explanation:\n\n${text}`
    
    try {
      const result = await aiService.chat('deepseek-chat', [
        { role: 'user', content: prompt }
      ], {
        temperature: 0.3,  // 低温度，更准确
        maxTokens: 100
      })
      
      return result.trim()
    } catch (error) {
      console.error('[AI翻译] 失败:', error.message)
      throw error
    }
  }
}

export const translateService = new TranslateService()

