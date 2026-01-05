import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function checkAnalysisMethod() {
  console.log('🔍 检查分析时是否使用了自定义提示词\n')
  console.log('='.repeat(60))
  
  // 查看最近的分析日志（如果有记录的话）
  // 由于没有记录promptId的字段，我们看不出来
  
  console.log('\n📌 判断方法：')
  console.log('')
  console.log('如果你在前端分析时：')
  console.log('  - 没有选择"使用自定义提示词" → 使用默认提示词 ✅ 已更新')
  console.log('  - 选择了"ppt内容分析"模板 → 使用数据库模板 ⚠️ 旧版本')
  console.log('')
  console.log('如果使用 API 调用：')
  console.log('  - 没有传 promptId 参数 → 使用默认提示词 ✅ 已更新')
  console.log('  - 传了 promptId 参数 → 使用数据库模板 ⚠️ 旧版本')
  console.log('')
  
  console.log('='.repeat(60))
  console.log('\n💡 解决方案（3个选择）：')
  console.log('')
  console.log('方案 1：停用数据库模板，使用默认提示词（推荐）')
  console.log('   - 简单快速')
  console.log('   - 立即生效')
  console.log('   - 运行：node disable-custom-prompt.js')
  console.log('')
  console.log('方案 2：更新数据库模板')
  console.log('   - 保留自定义模板')
  console.log('   - 需要手动添加约束内容')
  console.log('   - 我可以帮你生成更新脚本')
  console.log('')
  console.log('方案 3：删除数据库模板')
  console.log('   - 彻底清理')
  console.log('   - 运行：node delete-custom-prompt.js')
  
  await prisma.$disconnect()
}

checkAnalysisMethod().catch(e => {
  console.error(e)
  process.exit(1)
})

