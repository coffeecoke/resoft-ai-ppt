// online-ppt-backend/prisma/seed-admin.js
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import pkg from '@prisma/client'
const { PrismaClient } = pkg
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.users.findFirst({ where: { role: 'admin' } })
  if (existing) {
    console.log('✅ 管理员账号已存在:', existing.username)
    return
  }

  const password = process.env.ADMIN_INIT_PASSWORD || 'Admin@123'
  const hash = await bcrypt.hash(password, 12)

  const admin = await prisma.users.create({
    data: {
      id: randomUUID(),
      username: process.env.ADMIN_INIT_USERNAME || 'admin',
      name: '系统管理员',
      role: 'admin',
      status: 'active',
      password_hash: hash,
    },
  })

  console.log('✅ 管理员账号创建成功:')
  console.log('   用户名:', admin.username)
  console.log('   密码:', password)
  console.log('   ⚠️  请登录后立即修改密码')
}

main()
  .catch(e => { console.error('❌ 创建失败:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
