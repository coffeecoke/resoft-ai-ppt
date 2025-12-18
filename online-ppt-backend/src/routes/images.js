/**
 * 图片推荐路由
 * 
 * 提供图片搜索和推荐功能
 */

import express from 'express'
import { imageService } from '../services/imageService.js'

const router = express.Router()

/**
 * 图片推荐接口
 * 
 * POST /images/recommend
 * 
 * Request:
 * {
 *   slideData: { title, items, text },  // 当前页面数据
 *   keyword: "手动指定关键词（可选）",
 *   orientation: "landscape",  // landscape/portrait/squarish
 *   count: 4,
 *   page: 1
 * }
 */
router.post('/recommend', async (req, res) => {
  try {
    const { 
      slideData, 
      keyword, 
      orientation = 'landscape', 
      count = 4, 
      page = 1 
    } = req.body
    
    // 检查API是否可用
    if (!imageService.isAvailable()) {
      return res.json({
        success: false,
        error: '图片搜索服务未配置，请设置 UNSPLASH_ACCESS_KEY 或 PEXELS_API_KEY 环境变量',
        status: imageService.getStatus()
      })
    }
    
    // 提取或使用指定的关键词
    const searchKeyword = keyword || imageService.extractKeywords(slideData)
    
    if (!searchKeyword) {
      return res.json({
        success: false,
        error: '无法提取关键词，请手动输入搜索词',
        needInput: true
      })
    }
    
    console.log(`[图片推荐] 关键词: "${searchKeyword}", 方向: ${orientation}, 页码: ${page}`)
    
    const images = await imageService.searchImages(searchKeyword, {
      count,
      orientation,
      page
    })
    
    res.json({
      success: true,
      data: {
        keyword: searchKeyword,
        images,
        hasMore: images.length === count,
        page
      }
    })
  } catch (error) {
    console.error('[图片推荐] 错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 搜索图片
 * 
 * POST /images/search
 */
router.post('/search', async (req, res) => {
  try {
    const { 
      keyword, 
      orientation = 'landscape', 
      count = 4, 
      page = 1 
    } = req.body
    
    if (!keyword) {
      return res.json({
        success: false,
        error: '请输入搜索关键词'
      })
    }
    
    // 检查API是否可用
    if (!imageService.isAvailable()) {
      return res.json({
        success: false,
        error: '图片搜索服务未配置'
      })
    }
    
    console.log(`[图片搜索] 关键词: "${keyword}"`)
    
    const images = await imageService.searchImages(keyword, {
      count,
      orientation,
      page
    })
    
    res.json({
      success: true,
      data: {
        keyword,
        images,
        hasMore: images.length === count,
        page
      }
    })
  } catch (error) {
    console.error('[图片搜索] 错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 换一批（下一页）
 * 
 * POST /images/next
 */
router.post('/next', async (req, res) => {
  try {
    const { 
      keyword, 
      orientation = 'landscape', 
      count = 4, 
      currentPage = 1 
    } = req.body
    
    if (!keyword) {
      return res.json({
        success: false,
        error: '缺少关键词'
      })
    }
    
    const nextPage = currentPage + 1
    
    const images = await imageService.searchImages(keyword, {
      count,
      orientation,
      page: nextPage
    })
    
    res.json({
      success: true,
      data: {
        keyword,
        images,
        page: nextPage,
        hasMore: images.length === count
      }
    })
  } catch (error) {
    console.error('[换一批] 错误:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

/**
 * 获取图片服务状态
 * 
 * GET /images/status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: imageService.getStatus()
  })
})

export default router

