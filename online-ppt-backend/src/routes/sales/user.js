import express from 'express'

const router = express.Router()

// 获取用户信息
router.get('/profile', async (req, res) => {
  try {
    // 模拟用户信息
    const profile = {
      id: '1',
      username: '售前专员',
      email: 'sales@example.com',
      role: '售前顾问',
      avatar: 'https://dummyimage.com/100x100/6aa1ff/ffffff&text=U'
    }
    res.json({ success: true, data: profile })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 更新用户信息
router.put('/profile', async (req, res) => {
  try {
    // 这里应该更新用户信息到数据库
    res.json({ success: true, message: '更新成功' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router



