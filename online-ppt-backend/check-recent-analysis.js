import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function checkRecentAnalysis() {
  console.log('🔍 检查最近的分析结果\n')
  console.log('='.repeat(60))
  
  // 查询最近更新的 thumbnails
  const recentThumbnails = await prisma.thumbnails.findMany({
    where: {
      page_type: { not: null },
      analyzed_at: { not: null }
    },
    orderBy: { analyzed_at: 'desc' },
    take: 10,
    include: {
      documents: {
        select: { name: true }
      }
    }
  })
  
  console.log(`\n📊 最近分析的 10 页：\n`)
  
  // 获取通用产品
  const product = await prisma.products.findFirst({
    where: { code: 'general_ppt_categories' }
  })
  
  // 获取所有分类
  const allCategories = await prisma.product_catalogs.findMany({
    where: { product_id: product.id }
  })
  
  const categoryMap = new Map()
  allCategories.forEach(cat => {
    categoryMap.set(cat.code, { name: cat.name, level: cat.level })
  })
  
  for (const thumb of recentThumbnails) {
    const category = categoryMap.get(thumb.page_type)
    const levelIcon = category?.level === 1 ? '❌ 一级' : '✅ 二级'
    const levelText = category?.level === 1 ? '[一级分类-错误]' : '[二级分类-正确]'
    
    console.log(`${levelIcon} 文档: ${thumb.documents.name}`)
    console.log(`   页码: ${thumb.slide_index + 1}`)
    console.log(`   分类: ${category?.name || '未知'} (${thumb.page_type}) ${levelText}`)
    console.log(`   置信度: ${(thumb.page_type_confidence * 100).toFixed(1)}%`)
    console.log(`   分析时间: ${thumb.analyzed_at?.toLocaleString()}`)
    console.log()
  }
  
  await prisma.$disconnect()
}

checkRecentAnalysis().catch(e => {
  console.error(e)
  process.exit(1)
})

