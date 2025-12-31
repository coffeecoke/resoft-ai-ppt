import express from 'express'

const router = express.Router()

// 获取音频/视频列表
router.get('/', async (req, res) => {
  try {
    // 这里可以从数据文件读取，暂时返回空数组
    res.json({ success: true, data: [] })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router



