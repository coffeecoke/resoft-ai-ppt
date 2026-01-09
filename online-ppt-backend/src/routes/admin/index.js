/**
 * Admin 路由组
 * 
 * 统一管理所有管理后台接口
 */

import { Router } from 'express'
import fileScanRouter from './fileScan.js'

const router = Router()

// 注册子路由
router.use('/file-scan', fileScanRouter)

export default router





