import express from 'express'
import { readJSONFile } from './utils.js'

const router = express.Router()

// 获取问答列表
router.get('/', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const { category, tag, q } = req.query
    
    let filtered = qaList
    
    if (category) {
      filtered = filtered.filter(item => item.category === category)
    }
    if (tag) {
      filtered = filtered.filter(item => item.tags.includes(tag))
    }
    if (q) {
      const keyword = q.toLowerCase()
      filtered = filtered.filter(item => 
        item.question.toLowerCase().includes(keyword) ||
        item.answer.toLowerCase().includes(keyword)
      )
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 获取问答详情
router.get('/:id', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const qa = qaList.find(item => item.id === req.params.id)
    
    if (!qa) {
      return res.status(404).json({ success: false, error: '问答不存在' })
    }
    
    res.json({ success: true, data: qa })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 搜索问答
router.get('/search', async (req, res) => {
  try {
    const qaList = await readJSONFile('qa.json')
    const { q } = req.query
    
    if (!q) {
      return res.json({ success: true, data: [] })
    }
    
    const keyword = q.toLowerCase()
    const results = qaList.filter(item => 
      item.question.toLowerCase().includes(keyword) ||
      item.answer.toLowerCase().includes(keyword)
    )
    
    res.json({ success: true, data: results })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router




