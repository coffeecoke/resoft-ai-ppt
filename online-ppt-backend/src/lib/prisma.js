// 全局单例 PrismaClient —— 所有模块共享同一个连接池
import pkg from '@prisma/client'
const { PrismaClient } = pkg

const prisma = new PrismaClient()

export default prisma
