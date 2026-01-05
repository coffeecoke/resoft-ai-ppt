/**
 * 测试脚本：验证分类提示词只包含二级分类
 */

require('dotenv').config()

const { PrismaClient } = require('../online-ppt-backend/node_modules/@prisma/client')
const { buildPPTAnalysisMessages } = require('./server/prompts/pptAnalysisPrompt')

const prisma = new PrismaClient()

async function testPromptCategories() {
  console.log('🧪 测试分类提示词生成\n')
  console.log('=' .repeat(60))

  try {
    // 1. 获取通用产品
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })

    if (!generalProduct) {
      throw new Error('未找到通用产品')
    }

    console.log(`✅ 通用产品: ${generalProduct.name} (${generalProduct.id})\n`)

    // 2. 获取所有分类
    const allCategories = await prisma.product_catalogs.findMany({
      where: {
        product_id: generalProduct.id,
        is_active: true
      },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })

    console.log(`📊 分类统计:`)
    console.log(`   总数: ${allCategories.length}`)
    console.log(`   一级分类: ${allCategories.filter(c => c.level === 1).length}`)
    console.log(`   二级分类: ${allCategories.filter(c => c.level === 2).length}\n`)

    // 3. 构建提示词消息
    const testSlideText = '公司成立于2010年，是一家专注于金融科技的高新技术企业。'
    const messages = buildPPTAnalysisMessages(testSlideText, 0, 'test_slide_001', allCategories)

    // 4. 提取系统提示词
    const systemPrompt = messages.find(m => m.role === 'system')?.content

    if (!systemPrompt) {
      throw new Error('未找到系统提示词')
    }

    // 5. 分析提示词内容
    console.log('🔍 提示词分析:\n')
    console.log('-'.repeat(60))

    // 统计提到的分类数量
    const level1Codes = allCategories.filter(c => c.level === 1).map(c => c.code)
    const level2Codes = allCategories.filter(c => c.level === 2).map(c => c.code)

    let level1Count = 0
    let level2Count = 0

    level1Codes.forEach(code => {
      if (systemPrompt.includes(code)) {
        level1Count++
      }
    })

    level2Codes.forEach(code => {
      if (systemPrompt.includes(code)) {
        level2Count++
      }
    })

    console.log(`📌 提示词中包含的分类:`)
    console.log(`   一级分类 code: ${level1Count} 个`)
    console.log(`   二级分类 code: ${level2Count} 个\n`)

    // 6. 显示提示词片段（前500字符）
    console.log('📝 提示词预览（前800字符）:\n')
    console.log('-'.repeat(60))
    console.log(systemPrompt.substring(0, 800))
    console.log('...\n')
    console.log('-'.repeat(60))

    // 7. 验证结果
    console.log('\n✅ 验证结果:\n')
    
    if (level1Count === 0) {
      console.log('   ✅ 提示词中不包含一级分类 code（符合预期）')
    } else {
      console.log(`   ❌ 提示词中包含 ${level1Count} 个一级分类 code（不符合预期）`)
    }

    if (level2Count === allCategories.filter(c => c.level === 2).length) {
      console.log('   ✅ 提示词中包含所有二级分类 code（符合预期）')
    } else {
      console.log(`   ⚠️  提示词中包含 ${level2Count} 个二级分类 code，期望 ${allCategories.filter(c => c.level === 2).length} 个`)
    }

    // 8. 列出提示词中的所有分类标题
    console.log('\n📋 提示词中的分类列表:\n')
    const level2Categories = allCategories.filter(c => c.level === 2)
    level2Categories.forEach((cat, index) => {
      const isIncluded = systemPrompt.includes(cat.code)
      const icon = isIncluded ? '✅' : '❌'
      console.log(`   ${icon} ${index + 1}. ${cat.name} (${cat.code})`)
    })

    // 9. 估算 Token 数量
    const estimatedTokens = Math.ceil(systemPrompt.length / 4) // 粗略估算
    console.log(`\n📊 Token 估算: ~${estimatedTokens} tokens`)
    
    if (estimatedTokens < 2000) {
      console.log('   ✅ Token 数量合理（< 2000）')
    } else {
      console.log('   ⚠️  Token 数量较多（> 2000）')
    }

    console.log('\n🎉 测试完成！')

  } catch (error) {
    console.error('\n❌ 测试失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

testPromptCategories()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

