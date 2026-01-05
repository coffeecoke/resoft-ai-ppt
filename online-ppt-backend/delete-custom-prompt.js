import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function deleteCustomPrompt() {
  console.log('🗑️  删除数据库中的自定义提示词模板\n')
  console.log('='.repeat(60))
  
  // 先查询
  const templates = await prisma.prompt_templates.findMany()
  
  if (templates.length === 0) {
    console.log('\n✅ 数据库中没有自定义提示词模板')
    await prisma.$disconnect()
    return
  }
  
  console.log(`\n📋 即将删除 ${templates.length} 个模板：`)
  templates.forEach((tpl, index) => {
    console.log(`   ${index + 1}. ${tpl.name} (${tpl.code})`)
  })
  
  console.log('\n⚠️  确认删除？（5秒后自动删除，按 Ctrl+C 取消）')
  await new Promise(resolve => setTimeout(resolve, 5000))
  
  // 删除
  const result = await prisma.prompt_templates.deleteMany({})
  
  console.log(`\n✅ 已删除 ${result.count} 个自定义提示词模板`)
  console.log('')
  console.log('现在系统会使用默认提示词')
  console.log('')
  console.log('📌 下一步：')
  console.log('   1. 重启 AI 后端服务')
  console.log('   2. 重新分析文档')
  
  await prisma.$disconnect()
}

deleteCustomPrompt().catch(e => {
  console.error(e)
  process.exit(1)
})

