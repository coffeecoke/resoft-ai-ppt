/**
 * 图片搜索服务
 * 
 * 使用免费图库API（Unsplash/Pexels）进行图片搜索
 */

import axios from 'axios'
import { translateService } from './translateService.js'

class ImageService {
  /**
   * 获取 Unsplash API Key（延迟读取，确保环境变量已加载）
   */
  get unsplashKey() {
    return process.env.UNSPLASH_ACCESS_KEY
  }
  
  /**
   * 获取 Pexels API Key（延迟读取，确保环境变量已加载）
   */
  get pexelsKey() {
    return process.env.PEXELS_API_KEY
  }

  /**
   * 根据关键词搜索图片
   * @param {string} keyword - 搜索关键词
   * @param {object} options - 选项
   * @returns {Promise<Array>} 图片列表
   */
  async searchImages(keyword, options = {}) {
    const { 
      count = 4,
      orientation = 'landscape',  // landscape, portrait, squarish
      page = 1 
    } = options
    
    // 自动翻译中文关键词为英文（图库API需要英文）
    let searchKeyword = keyword
    if (translateService.hasChinese(keyword)) {
      console.log(`[图片搜索] 检测到中文关键词，尝试翻译...`)
      searchKeyword = await translateService.translate(keyword, 'zh', 'en')
      console.log(`[图片搜索] 翻译结果: "${keyword}" -> "${searchKeyword}"`)
    }
    
    try {
      // 优先使用Unsplash
      if (this.unsplashKey) {
        const images = await this.searchUnsplash(searchKeyword, { count, orientation, page })
        if (images.length > 0) return images
      }
      
      // 降级到Pexels
      if (this.pexelsKey) {
        return await this.searchPexels(searchKeyword, { count, orientation, page })
      }
      
      console.warn('[图片搜索] 未配置API Key，请设置 UNSPLASH_ACCESS_KEY 或 PEXELS_API_KEY')
      return []
    } catch (error) {
      console.error('[图片搜索] 失败:', error.message)
      return []
    }
  }

  /**
   * Unsplash搜索
   */
  async searchUnsplash(keyword, { count, orientation, page }) {
    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        headers: {
          'Authorization': `Client-ID ${this.unsplashKey}`
        },
        params: {
          query: keyword,
          per_page: count,
          page,
          orientation,
        },
        timeout: 10000
      })
      
      return response.data.results.map(img => ({
        id: img.id,
        src: img.urls.regular,
        thumb: img.urls.thumb,
        width: img.width,
        height: img.height,
        alt: img.alt_description || keyword,
        source: 'unsplash',
        author: img.user.name,
        downloadUrl: img.links.download_location,
      }))
    } catch (error) {
      console.error('[Unsplash] 搜索失败:', error.message)
      return []
    }
  }

  /**
   * Pexels搜索
   */
  async searchPexels(keyword, { count, orientation, page }) {
    try {
      const response = await axios.get('https://api.pexels.com/v1/search', {
        headers: {
          'Authorization': this.pexelsKey
        },
        params: {
          query: keyword,
          per_page: count,
          page,
          orientation,
        },
        timeout: 10000
      })
      
      return response.data.photos.map(img => ({
        id: String(img.id),
        src: img.src.large,
        thumb: img.src.tiny,
        width: img.width,
        height: img.height,
        alt: img.alt || keyword,
        source: 'pexels',
        author: img.photographer,
      }))
    } catch (error) {
      console.error('[Pexels] 搜索失败:', error.message)
      return []
    }
  }

  /**
   * 从PPT页面数据中提取搜索关键词
   * @param {object} slideData - 页面数据
   * @returns {string} 提取的关键词
   */
  extractKeywords(slideData) {
    if (!slideData) return ''
    
    const { title, items, text, data } = slideData
    
    // 优先使用标题
    const titleText = title || data?.title
    if (titleText) {
      return this.cleanKeyword(titleText)
    }
    
    // 其次使用内容文本
    if (text) {
      return this.cleanKeyword(text.substring(0, 30))
    }
    
    // 使用第一个item
    const itemList = items || data?.items
    if (itemList && itemList[0]) {
      const firstItem = itemList[0]
      const itemText = typeof firstItem === 'string' ? firstItem : (firstItem.title || firstItem.text)
      if (itemText) {
        return this.cleanKeyword(itemText)
      }
    }
    
    return ''
  }

  /**
   * 清理关键词（去除无意义词汇）
   */
  cleanKeyword(text) {
    if (!text) return ''
    
    return text
      .replace(/[的地得了着过是个一]/g, ' ')  // 去除虚词
      .replace(/[，。！？、：；""''【】（）]/g, ' ')  // 去除标点
      .replace(/\s+/g, ' ')  // 合并空格
      .trim()
      .substring(0, 50)  // 限制长度
  }

  /**
   * 根据图片元素尺寸判断需要的图片方向
   * @param {object} imageElement - 图片元素
   * @returns {string} orientation
   */
  getOrientationFromElement(imageElement) {
    if (!imageElement) return 'landscape'
    
    const { width, height } = imageElement
    if (!width || !height) return 'landscape'
    
    const ratio = width / height
    if (ratio > 1.2) return 'landscape'
    if (ratio < 0.8) return 'portrait'
    return 'squarish'
  }

  /**
   * 检查API是否可用
   */
  isAvailable() {
    return !!(this.unsplashKey || this.pexelsKey)
  }

  /**
   * 获取API状态信息
   */
  getStatus() {
    return {
      unsplash: !!this.unsplashKey,
      pexels: !!this.pexelsKey,
      available: this.isAvailable()
    }
  }
}

export const imageService = new ImageService()
export default imageService

