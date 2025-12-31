import express from 'express'
import { readJSONFile } from './utils.js'

const router = express.Router()

// 获取产品列表
router.get('/', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const { category, tag, q } = req.query
    
    let filtered = products
    
    if (category) {
      filtered = filtered.filter(p => p.category === category)
    }
    if (tag) {
      filtered = filtered.filter(p => p.tags.includes(tag))
    }
    if (q) {
      const keyword = q.toLowerCase()
      filtered = filtered.filter(p => 
        p.title.toLowerCase().includes(keyword) ||
        p.description.toLowerCase().includes(keyword)
      )
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取产品详情
router.get('/:id', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const product = products.find(p => p.id === req.params.id)
    
    if (!product) {
      return res.status(404).json({ success: false, error: '产品不存在' })
    }
    
    res.json({ success: true, data: product })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 搜索产品
router.get('/search', async (req, res) => {
  try {
    const products = await readJSONFile('products.json')
    const { q } = req.query
    
    if (!q) {
      return res.json({ success: true, data: [] })
    }
    
    const keyword = q.toLowerCase()
    const results = products.filter(p => 
      p.title.toLowerCase().includes(keyword) ||
      p.description.toLowerCase().includes(keyword) ||
      p.tags.some(tag => tag.toLowerCase().includes(keyword))
    )
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router



