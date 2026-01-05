import pkg from '@prisma/client'
const { PrismaClient } = pkg
const prisma = new PrismaClient()

async function checkCategoriesLevel() {
  console.log('🔍 检查 document_1 的分类级别\n')
  console.log('='.repeat(60))
  
  // 1. 获取 document_1 的所有 page_type
  const thumbnails = await prisma.thumbnails.findMany({
    where: { 
      document_id: 'document_1',
      page_type: { not: null }
    },
    select: {
      slide_index: true,
      page_type: true
    },
    orderBy: { slide_index: 'asc' }
  })
  
  console.log(`\n📄 document_1 共有 ${thumbnails.length} 页已分析\n`)
  
  // 2. 获取通用产品
  const product = await prisma.products.findFirst({
    where: { code: 'general_ppt_categories' }
  })
  
  if (!product) {
    throw new Error('未找到通用产品')
  }
  
  // 3. 获取所有分类的 code 和 level
  const allCategories = await prisma.product_catalogs.findMany({
    where: { product_id: product.id },
    select: {
      code: true,
      name: true,
      level: true
    }
  })
  
  const categoryMap = new Map()
  allCategories.forEach(cat => {
    categoryMap.set(cat.code, { name: cat.name, level: cat.level })
  })
  
  // 4. 统计一级和二级分类的使用情况
  const level1Pages = []
  const level2Pages = []
  const unknownPages = []
  
  for (const thumb of thumbnails) {
    const category = categoryMap.get(thumb.page_type)
    
    if (!category) {
      unknownPages.push({
        page: thumb.slide_index + 1,
        code: thumb.page_type
      })
    } else if (category.level === 1) {
      level1Pages.push({
        page: thumb.slide_index + 1,
        code: thumb.page_type,
        name: category.name
      })
    } else {
      level2Pages.push({
        page: thumb.slide_index + 1,
        code: thumb.page_type,
        name: category.name
      })
    }
  }
  
  // 5. 输出统计结果
  console.log('📊 分类级别统计:')
  console.log(`   ✅ 二级分类: ${level2Pages.length} 页`)
  console.log(`   ❌ 一级分类: ${level1Pages.length} 页`)
  console.log(`   ⚠️  未知分类: ${unknownPages.length} 页`)
  
  // 6. 详细列出一级分类的使用情况
  if (level1Pages.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('❌ 错误：以下页面使用了一级分类（应该使用二级分类）:')
    console.log('='.repeat(60))
    
    // 按 code 分组
    const groupedByCode = {}
    level1Pages.forEach(item => {
      if (!groupedByCode[item.code]) {
        groupedByCode[item.code] = {
          name: item.name,
          pages: []
        }
      }
      groupedByCode[item.code].pages.push(item.page)
    })
    
    for (const [code, data] of Object.entries(groupedByCode)) {
      console.log(`\n📌 ${data.name} (${code})`)
      console.log(`   级别: 一级分类 ❌`)
      console.log(`   页码: ${data.pages.join(', ')}`)
      console.log(`   数量: ${data.pages.length} 页`)
      
      // 查找该一级分类下的二级分类
      const parentCategory = allCategories.find(c => c.code === code && c.level === 1)
      if (parentCategory) {
        const childCategories = allCategories.filter(c => c.level === 2)
          .filter(c => {
            // 根据 code 前缀判断是否属于该一级分类
            // 例如：product_solutions 的子分类都以 product_ 开头
            return c.code.startsWith(code.split('_')[0])
          })
        
        if (childCategories.length > 0) {
          console.log(`   应该使用的二级分类（示例）:`)
          childCategories.slice(0, 3).forEach(child => {
            console.log(`      - ${child.name} (${child.code})`)
          })
          if (childCategories.length > 3) {
            console.log(`      ... 还有 ${childCategories.length - 3} 个`)
          }
        }
      }
    }
  }
  
  // 7. 显示正确使用二级分类的示例
  if (level2Pages.length > 0) {
    console.log('\n' + '='.repeat(60))
    console.log('✅ 正确：以下是使用二级分类的示例:')
    console.log('='.repeat(60))
    
    // 显示前5个
    level2Pages.slice(0, 5).forEach(item => {
      console.log(`   页 ${item.page}: ${item.name} (${item.code})`)
    })
    if (level2Pages.length > 5) {
      console.log(`   ... 还有 ${level2Pages.length - 5} 页使用了正确的二级分类`)
    }
  }
  
  // 8. 给出建议
  console.log('\n' + '='.repeat(60))
  console.log('💡 解决方案:')
  console.log('='.repeat(60))
  
  if (level1Pages.length > 0) {
    console.log('\n⚠️  当前分析结果包含一级分类代码，这是不正确的！')
    console.log('\n原因：')
    console.log('   - 这个文档是在提示词优化前分析的')
    console.log('   - 旧的提示词同时包含一级和二级分类')
    console.log('   - AI 有时会选择一级分类而不是二级分类')
    console.log('\n解决方案：')
    console.log('   1. 重新分析该文档（推荐）')
    console.log('      curl -X POST http://localhost:3002/api/ppt-analysis/analyze/document_1 \\')
    console.log('        -H "Content-Type: application/json" \\')
    console.log('        -d \'{"modelName":"custom-openai"}\'')
    console.log('\n   2. 新的提示词只包含22个二级分类')
    console.log('   3. AI 将被迫选择具体的二级分类')
    console.log('\n预期效果：')
    console.log('   - product_solutions → product_function_details, solution_overview 等')
    console.log('   - deployment_after_sales → implementation_service_process, after_sales_service_guarantee')
  } else {
    console.log('\n✅ 太棒了！所有分析结果都使用了正确的二级分类！')
  }
  
  await prisma.$disconnect()
}

checkCategoriesLevel().catch(e => {
  console.error(e)
  process.exit(1)
})

