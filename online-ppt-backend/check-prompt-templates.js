import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function checkPromptTemplates() {
  console.log('🔍 检查数据库中的提示词模板\n')
  console.log('='.repeat(60))
  
  const templates = await prisma.prompt_templates.findMany({
    orderBy: { created_at: 'desc' }
  })
  
  if (templates.length === 0) {
    console.log('\n✅ 数据库中没有自定义提示词模板')
    console.log('   说明：你使用的是代码中的默认提示词，已经更新了')
    console.log('')
    console.log('📌 结论：')
    console.log('   - 默认提示词已更新 ✅')
    console.log('   - 无需更新数据库 ✅')
    console.log('   - 重启服务即可生效 ✅')
  } else {
    console.log(`\n📋 数据库中有 ${templates.length} 个自定义提示词模板：\n`)
    
    templates.forEach((tpl, index) => {
      console.log(`${index + 1}. ${tpl.name}`)
      console.log(`   代码: ${tpl.code}`)
      console.log(`   类型: ${tpl.type}`)
      console.log(`   状态: ${tpl.is_active ? '✅ 激活' : '❌ 未激活'}`)
      console.log(`   创建时间: ${tpl.created_at.toLocaleString()}`)
      console.log(`   提示词长度: ${tpl.prompt.length} 字符`)
      
      // 检查是否包含约束信息
      const hasConstraints = tpl.prompt.includes('严禁使用') || tpl.prompt.includes('禁止')
      const hasValidCodes = tpl.prompt.includes('有效代码') || tpl.prompt.includes('白名单')
      
      if (!hasConstraints && !hasValidCodes) {
        console.log(`   ⚠️  警告：这个模板可能是旧版本，不包含新的约束`)
      }
      console.log()
    })
    
    console.log('='.repeat(60))
    console.log('\n⚠️  注意事项：')
    console.log('   1. 如果你使用的是默认提示词（不指定promptId），已经更新了 ✅')
    console.log('   2. 如果你使用了自定义提示词模板，需要手动更新或重新创建')
    console.log('   3. 数据库中的模板使用 {categories}、{valid_codes}、{constraints} 占位符')
    console.log('')
    console.log('💡 如何更新自定义模板：')
    console.log('   - 方法1：在前端界面编辑模板，添加约束信息')
    console.log('   - 方法2：删除旧模板，重新创建')
    console.log('   - 方法3：暂时停用旧模板，使用默认提示词')
  }
  
  await prisma.$disconnect()
}

checkPromptTemplates().catch(e => {
  console.error(e)
  process.exit(1)
})

