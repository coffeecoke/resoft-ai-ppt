import express from 'express'
import productsRouter from './sales/products.js'
import productCatalogsRouter from './sales/product-catalogs.js'
import thumbnailsRouter from './sales/thumbnails.js'
import qaRouter from './sales/qa.js'
import recommendationsRouter from './sales/recommendations.js'
import materialsRouter from './sales/materials.js'
import mediaRouter from './sales/media.js'
import userRouter from './sales/user.js'
import profileRouter from './sales/profile.js'
import documentsRouter from './sales/documents.js'
import batchOperationsRouter from './sales/batch-operations.js'
import transcriptionsRouter from './sales/transcriptions.js'
import concernsRouter from './sales/concerns.js'
import concernCategoriesRouter from './sales/concern-categories.js'

const router = express.Router()

// 注册子路由
router.use('/products', productsRouter)
router.use('/transcriptions', transcriptionsRouter)
router.use('/concerns', concernsRouter)
router.use('/concern-categories', concernCategoriesRouter)
router.use('/product-catalogs', productCatalogsRouter)
router.use('/thumbnails', thumbnailsRouter)
router.use('/qa', qaRouter)
router.use('/recommendations', recommendationsRouter)
router.use('/materials', materialsRouter)
router.use('/media', mediaRouter)
router.use('/user', userRouter)
router.use('/profile', profileRouter)
router.use('/documents', documentsRouter)
router.use('/batch-operations', batchOperationsRouter)

export default router
