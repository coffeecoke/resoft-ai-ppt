// 检查启动问题
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
const envPath = path.join(__dirname, '.env')
dotenv.config({ path: envPath })

console.log('开始检查启动问题...\n')

// 捕获所有错误
process.on('unhandledRejection', (error) => {
  console.error('\n❌ 未处理的 Promise 拒绝:')
  console.error('错误信息:', error.message)
  console.error('错误堆栈:', error.stack)
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('\n❌ 未捕获的异常:')
  console.error('错误信息:', error.message)
  console.error('错误堆栈:', error.stack)
  process.exit(1)
})

try {
  console.log('正在导入主入口文件...')
  await import('./src/index.js')
  console.log('✅ 导入成功，服务器应该正在启动...')
  // 保持进程运行
  setTimeout(() => {
    console.log('服务器运行中...')
  }, 5000)
} catch (error) {
  console.error('\n❌ 导入失败！')
  console.error('错误类型:', error.constructor.name)
  console.error('错误信息:', error.message)
  console.error('\n错误堆栈:')
  console.error(error.stack)
  process.exit(1)
}




