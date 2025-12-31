import express from 'express'
import path from 'path'
import fsSync from 'fs'
import {
  DOCUMENTS_DIR,
  readDocumentIndex,
  writeDocumentIndex,
  generateDocumentId
} from './utils.js'

const router = express.Router()

/**
 * 回传PPT
 * POST /api/sales/profile/ppt/upload
 */
router.post('/ppt/upload', async (req, res) => {
  try {
    const {
      name,
      customerName,
      product,
      industry,
      audience,
      language,
      slides
    } = req.body || {}
    
    // 验证必填字段
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        error: 'PPT标题不能为空'
      })
    }
    
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'PPT内容不能为空'
      })
    }
    
    // 确保目录存在
    if (!fsSync.existsSync(DOCUMENTS_DIR)) {
      fsSync.mkdirSync(DOCUMENTS_DIR, { recursive: true })
    }
    
    // 读取现有索引
    const indexList = readDocumentIndex()
    
    // 生成新ID
    const id = generateDocumentId(indexList)
    const now = new Date().toISOString()
    
    // 创建文档数据
    const documentData = {
      title: name.trim(),
      width: 1000,
      height: 562.5,
      theme: {
        themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4', '#70ad47'],
        fontColor: '#333',
        fontName: '',
        backgroundColor: '#fff',
        shadow: { h: 3, v: 3, blur: 2, color: '#808080' },
        outline: { width: 2, color: '#525252', style: 'solid' },
      },
      slides
    }
    
    // 保存文档JSON
    const filename = path.join(DOCUMENTS_DIR, `${id}.json`)
    fsSync.writeFileSync(filename, JSON.stringify(documentData, null, 2), 'utf-8')
    
    // 计算文件大小
    const stats = fsSync.statSync(filename)
    const fileSize = stats.size
    
    // 创建元数据
    const meta = {
      id,
      name: name.trim(),
      cover: '',  // 封面图需要后续生成
      category: 'uncategorized',
      status: 'draft',  // 默认为草稿
      tag: 'practical',  // 自动标记为实战
      slideCount: slides.length,
      fileSize,
      createdAt: now,
      updatedAt: now,
      customerName: customerName || undefined,
      product: (Array.isArray(product) && product.length > 0) ? product : undefined,
      industry: (Array.isArray(industry) && industry.length > 0) ? industry : undefined,
      audience: (Array.isArray(audience) && audience.length > 0) ? audience : undefined,
      language: language || undefined,
      // userId: req.user?.id,  // TODO: 未来从session获取
    }
    
    // 添加到索引（插入到最前面）
    indexList.unshift(meta)
    writeDocumentIndex(indexList)
    
    console.log(`[Sales Profile] PPT回传成功: ${id} - ${name}`)
    
    res.json({
      success: true,
      data: { id }
    })
  } catch (error) {
    console.error('[Sales Profile] PPT回传失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'PPT回传失败'
    })
  }
})

/**
 * 获取PPT列表（Profile页面使用）
 * GET /api/sales/profile/ppt/list
 */
router.get('/ppt/list', async (req, res) => {
  try {
    const { tag, status = 'published' } = req.query
    
    const indexList = readDocumentIndex()
    let filtered = indexList
    
    // 只显示已发布的
    filtered = filtered.filter(item => item.status === status)
    
    // 按标签过滤
    if (tag && tag !== 'all') {
      filtered = filtered.filter(item => item.tag === tag)
    }
    
    // TODO: 未来按用户过滤
    // if (req.user?.id) {
    //   filtered = filtered.filter(item => item.userId === req.user.id)
    // }
    
    res.json({
      success: true,
      data: filtered
    })
  } catch (error) {
    console.error('[Sales Profile] 获取PPT列表失败:', error)
    res.status(500).json({
      success: false,
      error: error.message || '获取PPT列表失败'
    })
  }
})

export default router



