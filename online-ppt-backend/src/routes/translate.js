/**
 * 翻译路由
 * 
 * 提供简单的中英文翻译功能，用于图片搜索等场景
 */

import express from 'express'
import { translateService } from '../services/translateService.js'

const router = express.Router()

/**
 * 翻译文本
 * 
 * POST /translate
 * 
 * Request:
 * {
 *   text: "要翻译的文本",
 *   from: "zh",  // 源语言
 *   to: "en"     // 目标语言
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { text, from = 'zh', to = 'en' } = req.body
    
    if (!text || typeof text !== 'string') {
      return res.json({
        success: false,
        error: '请提供要翻译的文本'
      })
    }
    
    console.log(`[翻译] 原文: "${text}", ${from} -> ${to}`)
    
    const translatedText = await translateService.translate(text, from, to)
    
    console.log(`[翻译] 译文: "${translatedText}"`)
    
    res.json({
      success: true,
      data: {
        originalText: text,
        translatedText,
        from,
        to
      }
    })
  } catch (error) {
    console.error('[翻译] 错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

export default router

