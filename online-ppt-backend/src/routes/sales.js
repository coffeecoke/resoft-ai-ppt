import express from 'express'
import productsRouter from './sales/products.js'
import qaRouter from './sales/qa.js'
import recommendationsRouter from './sales/recommendations.js'
import materialsRouter from './sales/materials.js'
import mediaRouter from './sales/media.js'
import userRouter from './sales/user.js'
import profileRouter from './sales/profile.js'

const router = express.Router()

// 注册子路由
router.use('/products', productsRouter)
router.use('/qa', qaRouter)
router.use('/recommendations', recommendationsRouter)
router.use('/materials', materialsRouter)
router.use('/media', mediaRouter)
router.use('/user', userRouter)
router.use('/profile', profileRouter)

export default router
