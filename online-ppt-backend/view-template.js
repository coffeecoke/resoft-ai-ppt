import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function viewCurrentTemplate() {
  console.log('📄 查看当前数据库模板内容\n')
  console.log('='.repeat(60))
  
  const template = await prisma.prompt_templates.findFirst({
    where: { code: 'ppt_content_analysis' }
  })
  
  if (!template) {
    console.log('❌ 未找到模板')
    await prisma.$disconnect()
    return
  }
  
  console.log(`\n模板名称: ${template.name}`)
  console.log(`模板代码: ${template.code}`)
  console.log(`创建时间: ${template.created_at.toLocaleString()}`)
  console.log(`\n当前提示词内容:`)
  console.log('-'.repeat(60))
  console.log(template.prompt)
  console.log('-'.repeat(60))
  
  // 检查是否包含占位符
  const hasCategories = template.prompt.includes('{categories}')
  const hasValidCodes = template.prompt.includes('{valid_codes}')
  const hasConstraints = template.prompt.includes('{constraints}')
  
  console.log(`\n📊 占位符检查:`)
  console.log(`   {categories}: ${hasCategories ? '✅ 存在' : '❌ 不存在'}`)
  console.log(`   {valid_codes}: ${hasValidCodes ? '✅ 存在' : '❌ 不存在'}`)
  console.log(`   {constraints}: ${hasConstraints ? '✅ 存在' : '❌ 不存在'}`)
  
  await prisma.$disconnect()
}

viewCurrentTemplate().catch(e => {
  console.error(e)
  process.exit(1)
})

