/**
 * PPT内容分析测试脚本
 * 
 * 用于测试AI分析功能
 */

require('dotenv').config()

const { PrismaClient } = require('@prisma/client')
const pptAnalysisService = require('../server/services/pptAnalysisService')

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('PPT内容分析测试')
  console.log('='.repeat(60))
  
  try {
    // 1. 测试获取分类标准
    console.log('\n[测试1] 获取分类标准...')
    const categories = await pptAnalysisService.getAllCategories()
    console.log(`✅ 成功获取 ${categories.length} 个分类标准`)
    console.log(`   - 一级分类: ${categories.filter(c => c.level === 1).length} 个`)
    console.log(`   - 二级分类: ${categories.filter(c => c.level === 2).length} 个`)
    
    // 2. 测试单页分析
    console.log('\n[测试2] 测试单页内容分析...')
    const testText = `
      XX科技公司成立于2010年，是一家专注于金融监管科技的高新技术企业。
      公司总部位于北京，在上海、深圳设有分支机构。
      公司拥有员工200余人，其中研发人员占比60%。
      年营收达2亿元，服务客户超过100家金融机构。
    `
    
    const singleResult = await pptAnalysisService.analyzeSingleSlide(
      testText,
      0,
      'test_slide',
      'custom-openai'
    )
    
    console.log('✅ 单页分析成功')
    console.log(`   - 分类: ${singleResult.category_code}`)
    console.log(`   - 置信度: ${singleResult.confidence}`)
    console.log(`   - 理由: ${singleResult.reason}`)
    
    // 3. 查询一个已提取文本的文档进行完整分析
    console.log('\n[测试3] 查找已提取文本的文档...')
    const document = await prisma.documents.findFirst({
      where: {
        slide_count: {
          gt: 0
        }
      },
      include: {
        _count: {
          select: {
            thumbnails: true
          }
        }
      }
    })
    
    if (!document) {
      console.log('❌ 未找到已提取文本的文档')
      console.log('   提示: 请先上传PPT文档并提取文本内容')
      return
    }
    
    console.log(`✅ 找到文档: ${document.name} (ID: ${document.id})`)
    console.log(`   - 页数: ${document.slide_count}`)
    console.log(`   - 缩略图数: ${document._count.thumbnails}`)
    
    // 检查是否有提取的文本内容
    const slideContents = await prisma.slide_merged_contents.count({
      where: {
        document_id: document.id
      }
    })
    
    if (slideContents === 0) {
      console.log('❌ 该文档没有提取的文本内容')
      console.log('   提示: 请先使用文档提取功能提取文本')
      return
    }
    
    console.log(`✅ 已提取文本: ${slideContents} 页`)
    
    // 询问是否执行完整分析
    console.log('\n[测试4] 执行完整文档分析')
    console.log(`⚠️  警告: 将分析 ${slideContents} 页内容，可能需要较长时间`)
    console.log('   如果要测试，请取消注释下面的代码')
    
    /*
    console.log('开始分析...')
    const results = await pptAnalysisService.analyzeDocument(
      document.id,
      'custom-openai',
      (current, total, result) => {
        console.log(`   进度: ${current}/${total} - 状态: ${result.status}`)
      }
    )
    
    console.log('\n✅ 分析完成')
    console.log(`   - 成功: ${results.success}`)
    console.log(`   - 失败: ${results.failed}`)
    console.log(`   - 跳过: ${results.skipped}`)
    */
    
    console.log('\n='.repeat(60))
    console.log('测试完成!')
    console.log('='.repeat(60))
    console.log('\n提示: 使用以下命令启动Web服务器测试API:')
    console.log('  cd ai_backend')
    console.log('  npm start')
    console.log('\n然后访问以下接口:')
    console.log(`  - 分析文档: POST http://localhost:3000/api/ppt-analysis/analyze/${document.id}`)
    console.log(`  - 获取结果: GET  http://localhost:3000/api/ppt-analysis/results/${document.id}`)
    console.log(`  - 获取统计: GET  http://localhost:3000/api/ppt-analysis/statistics/${document.id}`)
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main()

