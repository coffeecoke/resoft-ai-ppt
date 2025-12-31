import express from 'express'
import { readJSONFile } from './utils.js'

const router = express.Router()

// 获取推荐内容
router.get('/', async (req, res) => {
  try {
    const { type } = req.query
    const products = await readJSONFile('products.json')
    const qaList = await readJSONFile('qa.json')
    
    let recommendations = []
    
    if (type === 'ppt' || !type) {
      recommendations.push(...products.slice(0, 3).map(p => ({ ...p, type: 'product' })))
    }
    if (type === 'qa' || !type) {
      recommendations.push(...qaList.slice(0, 3).map(q => ({ ...q, type: 'qa' })))
    }
    
    res.json({ success: true, data: recommendations })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router



