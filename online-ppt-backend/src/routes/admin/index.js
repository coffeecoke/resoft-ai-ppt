/**
 * Admin 路由组
 * 
 * 统一管理所有管理后台接口
 */

import { Router } from 'express'
import fileScanRouter from './fileScan.js'
import bidDocumentsRouter from './bid-documents.js'
import dictRouter from './system/dict.js'
import roleRouter from './system/role.js'
import userRouter from './system/user.js'
import deptRouter from './system/dept.js'
import productRouter from './system/product.js'

const router = Router()

// 注册子路由
router.use('/file-scan', fileScanRouter)
router.use('/bid-documents', bidDocumentsRouter)

// 系统管理路由
router.use('/system/dict', dictRouter)
router.use('/system/role', roleRouter)
router.use('/system/user', userRouter)
router.use('/system/dept', deptRouter)
router.use('/system/product', productRouter)

export default router





