/**
 * 诊断脚本：检查 AI 分析结果
 * 
 * 用途：
 * 1. 检查最近分析的文档
 * 2. 验证分类结果是否正确
 * 3. 显示分类分布统计
 * 4. 对比文本内容和分类结果
 */

require('dotenv').config()

const { PrismaClient } = require('../online-ppt-backend/node_modules/@prisma/client')

const prisma = new PrismaClient()

async function diagnoseAnalysisResults() {
  console.log('🔍 AI分析结果诊断\n')
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

    // 2. 获取所有二级分类（用于验证）
    const level2Categories = await prisma.product_catalogs.findMany({
      where: {
        product_id: generalProduct.id,
        level: 2,
        is_active: true
      },
      orderBy: [{ sort_order: 'asc' }]
    })

    const validCodes = new Set(level2Categories.map(c => c.code))
    console.log(`\n📋 有效的二级分类数量: ${validCodes.size}`)

    // 3. 查找最近分析的文档（有分析结果的）
    const analyzedDocIds = await prisma.thumbnails.groupBy({
      by: ['document_id'],
      _count: { page_type: true },
      where: { page_type: { not: null } }
    })
    
    if (analyzedDocIds.length === 0) {
      console.log('\n⚠️  没有找到任何已分析的文档')
      console.log('   提示: 请先对文档运行 AI 分析')
      return
    }
    
    const recentDocuments = await prisma.documents.findMany({
      where: {
        id: { in: analyzedDocIds.map(d => d.document_id) }
      },
      orderBy: { updated_at: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        slide_count: true,
        updated_at: true
      }
    })

    if (recentDocuments.length === 0) {
      console.log('\n⚠️  没有找到任何文档')
      return
    }

    console.log(`\n📄 最近更新的文档 (前5个):`)
    recentDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.name} (${doc.slide_count}页) - ${doc.updated_at.toLocaleString()}`)
    })

    // 4. 让用户选择或自动选择第一个
    const targetDoc = recentDocuments[0]
    console.log(`\n🎯 分析目标文档: ${targetDoc.name}`)
    console.log('   文档ID:', targetDoc.id)
    console.log('   总页数:', targetDoc.slide_count)

    // 5. 获取该文档的分析结果
    const thumbnails = await prisma.thumbnails.findMany({
      where: { document_id: targetDoc.id },
      orderBy: { slide_index: 'asc' },
      select: {
        slide_id: true,
        slide_index: true,
        page_type: true,
        page_type_confidence: true,
        analyzed_at: true
      }
    })

    console.log(`\n📊 缩略图记录数: ${thumbnails.length}`)

    // 6. 分析统计
    const analyzed = thumbnails.filter(t => t.page_type)
    const notAnalyzed = thumbnails.filter(t => !t.page_type)

    console.log(`\n✅ 已分析: ${analyzed.length} 页`)
    console.log(`❌ 未分析: ${notAnalyzed.length} 页`)

    if (analyzed.length === 0) {
      console.log('\n⚠️  该文档没有任何分析结果')
      console.log('   提示: 请先运行 AI 分析')
      return
    }

    // 7. 验证分类代码有效性
    console.log(`\n🔍 验证分类代码有效性:`)
    
    const invalidCategories = []
    const categoryStats = {}

    for (const thumb of analyzed) {
      const code = thumb.page_type
      
      // 统计
      if (!categoryStats[code]) {
        categoryStats[code] = {
          count: 0,
          totalConfidence: 0,
          slides: []
        }
      }
      categoryStats[code].count++
      categoryStats[code].totalConfidence += thumb.page_type_confidence || 0
      categoryStats[code].slides.push(thumb.slide_index + 1)
      
      // 验证
      if (!validCodes.has(code)) {
        invalidCategories.push({
          slide: thumb.slide_index + 1,
          code: code
        })
      }
    }

    if (invalidCategories.length > 0) {
      console.log(`   ❌ 发现 ${invalidCategories.length} 个无效的分类代码:`)
      invalidCategories.forEach(item => {
        console.log(`      页 ${item.slide}: ${item.code}`)
      })
    } else {
      console.log(`   ✅ 所有分类代码都有效`)
    }

    // 8. 分类分布统计
    console.log(`\n📈 分类分布统计:`)
    console.log('-'.repeat(60))

    const sortedStats = Object.entries(categoryStats)
      .sort((a, b) => b[1].count - a[1].count)

    for (const [code, stats] of sortedStats) {
      const category = level2Categories.find(c => c.code === code)
      const categoryName = category ? category.name : '❌ 未知分类'
      const avgConfidence = (stats.totalConfidence / stats.count).toFixed(2)
      const percentage = ((stats.count / analyzed.length) * 100).toFixed(1)
      
      console.log(`\n${categoryName} (${code})`)
      console.log(`   数量: ${stats.count} 页 (${percentage}%)`)
      console.log(`   平均置信度: ${avgConfidence}`)
      console.log(`   页码: ${stats.slides.slice(0, 10).join(', ')}${stats.slides.length > 10 ? '...' : ''}`)
      
      // 如果是"其他"分类且数量较多，提示可能有问题
      if (code === 'other_content' && stats.count / analyzed.length > 0.3) {
        console.log(`   ⚠️  警告: "其他"分类占比过高(${percentage}%)，可能需要优化分类标准或提示词`)
      }
    }

    // 9. 检查文本内容（如果有）
    console.log(`\n\n📝 检查文本内容与分类匹配度:`)
    console.log('-'.repeat(60))
    
    const slideMergedContents = await prisma.slide_merged_contents.findMany({
      where: { document_id: targetDoc.id },
      orderBy: { slide_order: 'asc' },
      take: 5  // 只检查前5页
    })

    if (slideMergedContents.length === 0) {
      console.log('   ⚠️  未找到文本内容，无法验证匹配度')
    } else {
      console.log(`\n检查前 ${Math.min(5, slideMergedContents.length)} 页的内容:`)
      
      for (const slideContent of slideMergedContents) {
        const thumb = thumbnails.find(t => t.slide_id === slideContent.slide_id)
        
        if (!thumb || !thumb.page_type) {
          console.log(`\n页 ${slideContent.slide_order}: [未分析]`)
          continue
        }
        
        const category = level2Categories.find(c => c.code === thumb.page_type)
        const text = slideContent.merged_content.substring(0, 100)
        
        console.log(`\n页 ${slideContent.slide_order}: ${category ? category.name : thumb.page_type}`)
        console.log(`   置信度: ${(thumb.page_type_confidence * 100).toFixed(1)}%`)
        console.log(`   文本预览: ${text}${slideContent.merged_content.length > 100 ? '...' : ''}`)
        console.log(`   文本长度: ${slideContent.merged_content.length} 字符`)
        
        // 简单判断：如果文本很短但不是"其他"分类，可能有问题
        if (slideContent.merged_content.length < 20 && thumb.page_type !== 'other_content') {
          console.log(`   ⚠️  警告: 文本内容过短，分类可能不准确`)
        }
      }
    }

    // 10. 总结和建议
    console.log(`\n\n${'='.repeat(60)}`)
    console.log('📊 诊断总结:')
    console.log(`   ✅ 已分析页数: ${analyzed.length} / ${thumbnails.length}`)
    console.log(`   ✅ 有效分类: ${sortedStats.length} 种`)
    console.log(`   ✅ 平均置信度: ${(analyzed.reduce((sum, t) => sum + t.page_type_confidence, 0) / analyzed.length * 100).toFixed(1)}%`)
    
    if (invalidCategories.length > 0) {
      console.log(`   ❌ 发现 ${invalidCategories.length} 个无效分类代码`)
    }
    
    const otherPercent = categoryStats['other_content'] 
      ? (categoryStats['other_content'].count / analyzed.length * 100).toFixed(1) 
      : 0
    if (otherPercent > 30) {
      console.log(`   ⚠️  "其他"分类占比过高 (${otherPercent}%)`)
    }

    console.log(`\n💡 建议:`)
    if (invalidCategories.length > 0) {
      console.log(`   - 重新运行 AI 分析，确保使用最新的分类标准`)
    }
    if (otherPercent > 30) {
      console.log(`   - 优化提示词，让AI更精确地识别内容类型`)
      console.log(`   - 检查分类标准是否覆盖了所有常见内容类型`)
    }
    if (analyzed.length < thumbnails.length) {
      console.log(`   - 完成所有页面的分析 (${notAnalyzed.length} 页未分析)`)
    }

    console.log('\n🎉 诊断完成！')

  } catch (error) {
    console.error('\n❌ 诊断失败:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

diagnoseAnalysisResults()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })

