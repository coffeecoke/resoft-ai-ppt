import express from 'express'
import { readJSONFile } from './utils.js'

const router = express.Router()

// 获取宣传物料列表
router.get('/', async (req, res) => {
  try {
    const materials = await readJSONFile('materials.json')
    const { type } = req.query
    
    let filtered = materials
    if (type) {
      filtered = filtered.filter(m => m.type === type)
    }
    
    res.json({ success: true, data: filtered })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router




