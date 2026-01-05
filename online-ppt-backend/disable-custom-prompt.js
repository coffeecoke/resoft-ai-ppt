import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function disableCustomPrompt() {
  console.log('⏸️  停用数据库中的自定义提示词模板\n')
  console.log('='.repeat(60))
  
  const result = await prisma.prompt_templates.updateMany({
    where: { is_active: true },
    data: { is_active: false }
  })
  
  console.log(`\n✅ 已停用 ${result.count} 个自定义提示词模板`)
  console.log('')
  console.log('现在系统会使用默认提示词，包含：')
  console.log('  ✅ 22个二级分类白名单')
  console.log('  ✅ 6个一级分类黑名单')
  console.log('  ✅ 严格的代码验证')
  console.log('')
  console.log('📌 下一步：')
  console.log('   1. 重启 AI 后端服务')
  console.log('   2. 重新分析文档')
  console.log('   3. 验证结果（应该不再有一级分类）')
  
  await prisma.$disconnect()
}

disableCustomPrompt().catch(e => {
  console.error(e)
  process.exit(1)
})

