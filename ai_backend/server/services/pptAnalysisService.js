/**
 * PPT内容分析服务
 * 
 * 负责调用AI分析PPT页面内容并自动分类
 */

require('dotenv').config()

const { PrismaClient } = require('../../../online-ppt-backend/node_modules/@prisma/client')
const aiService = require('./aiService')
const { buildPPTAnalysisMessages } = require('../prompts/pptAnalysisPrompt')

const prisma = new PrismaClient()

class PPTAnalysisService {
  /**
   * 获取所有分类标准(用于AI分析)
   * 
   * 🔄 已更新：从 product_catalogs 表读取通用分类标准
   * 
   * @returns {Promise<Array>} 分类标准数组
   */
  async getAllCategories() {
    // 先获取通用产品ID
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      throw new Error('未找到通用PPT分类产品，请先运行数据迁移脚本')
    }
    
    // 从 product_catalogs 表读取分类
    const categories = await prisma.product_catalogs.findMany({
      where: {
        product_id: generalProduct.id,
        is_active: true
      },
      orderBy: [
        { level: 'asc' },
        { sort_order: 'asc' }
      ]
    })
    
    return categories
  }
  
  /**
   * 分析单个PPT页面内容
   * 
   * @param {string} slideText - 页面文本内容
   * @param {number} slideIndex - 页面索引
   * @param {string} slideId - 页面ID
   * @param {string} modelName - 使用的AI模型名称
   * @param {string} promptId - 提示词模板ID(可选)
   * @returns {Promise<Object>} 分析结果 { category_code, confidence, reason }
   */
  async analyzeSingleSlide(slideText, slideIndex, slideId, modelName = 'custom-openai', promptId = null) {
    try {
      // 获取分类标准
      const categories = await this.getAllCategories()
      
      if (categories.length === 0) {
        throw new Error('分类标准数据为空,请先初始化分类数据')
      }
      
      // 构建提示词消息
      let messages;
      if (promptId) {
        // 使用自定义提示词模板
        const promptTemplate = await prisma.prompt_templates.findUnique({
          where: { id: promptId }
        })
        
        if (!promptTemplate) {
          throw new Error('提示词模板不存在')
        }
        
        if (!promptTemplate.is_active) {
          throw new Error('该提示词模板未激活')
        }
        
        // 🔄 只提取二级分类（level === 2）
        const level2Categories = categories.filter(cat => cat.level === 2)
        
        // 替换 {categories} 占位符
        const categoryDescriptions = level2Categories.map((cat, index) => {
          return `### ${index + 1}. ${cat.name} (${cat.code})\n${cat.description || ''}`
        }).join('\n\n')
        
        // 🆕 生成有效的分类代码列表（用于约束）
        const validCodes = level2Categories.map(c => c.code).join('、')
        const invalidCodes = `
**严禁使用以下代码（这些是一级分类，不能直接使用）：**
- enterprise_info（企业信息）
- cooperation_cases（合作案例）
- regulatory_policy_industry（监管政策与行业背景）
- product_solutions（产品解决方案）
- deployment_after_sales（部署实施及售后保障）
- other（其他）

**你必须从以下二级分类中选择：**
${validCodes}
`
        
        const systemPrompt = promptTemplate.prompt
          .replace('{categories}', categoryDescriptions)
          .replace('{valid_codes}', validCodes)
          .replace('{constraints}', invalidCodes)
        const userPrompt = `请分析以下PPT页面内容并进行分类:

【页面信息】
- 页面索引: ${slideIndex + 1}
- 页面ID: ${slideId}

【页面文本内容】
${slideText}

请根据以上内容,按照系统提示词中的分类标准进行分析,并以JSON格式输出结果。`
        
        messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      } else {
        // 使用默认提示词
        messages = buildPPTAnalysisMessages(slideText, slideIndex, slideId, categories)
      }
      
      // 调用AI服务
      console.log(`[PPT分析] 正在分析页面 ${slideIndex + 1} (${slideId})...`)
      const response = await aiService.chat(modelName, messages, {
        temperature: 0.3, // 降低temperature以获得更稳定的分类结果
        maxTokens: 500
      })
      
      // 解析AI返回的JSON结果
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                        response.match(/\{[\s\S]*?\}/)
      
      if (!jsonMatch) {
        throw new Error('AI返回格式不正确,无法解析JSON')
      }
      
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const result = JSON.parse(jsonStr)
      
      // 验证结果格式
      if (!result.category_code || typeof result.confidence !== 'number') {
        throw new Error('AI返回的JSON格式不完整')
      }
      
      // 🆕 验证分类代码必须是二级分类
      const level2Codes = categories
        .filter(cat => cat.level === 2)
        .map(cat => cat.code)
      
      if (!level2Codes.includes(result.category_code)) {
        const category = categories.find(c => c.code === result.category_code)
        if (category && category.level === 1) {
          // AI返回了一级分类代码，这是错误的
          console.error(`[PPT分析] ❌ AI返回了一级分类代码: ${result.category_code} (${category.name})`)
          console.error(`[PPT分析] 这是不允许的！AI应该只返回二级分类代码`)
          throw new Error(`AI返回了一级分类代码 "${result.category_code}"，这是不允许的。请检查提示词设置或重新分析。`)
        } else {
          // 未知的分类代码
          console.error(`[PPT分析] ❌ AI返回了未知的分类代码: ${result.category_code}`)
          throw new Error(`AI返回了未知的分类代码 "${result.category_code}"`)
        }
      }
      
      console.log(`[PPT分析] 页面 ${slideIndex + 1} 分析完成: ${result.category_code} (置信度: ${result.confidence})`)
      
      return result
      
    } catch (error) {
      console.error(`[PPT分析] 分析失败 (页面 ${slideIndex + 1}):`, error.message)
      throw error
    }
  }
  
  /**
   * 批量分析文档的所有页面
   * 
   * @param {string} documentId - 文档ID
   * @param {string} modelName - 使用的AI模型名称
   * @param {Function} progressCallback - 进度回调函数 (current, total, result)
   * @returns {Promise<Object>} 分析结果统计
   */
  async analyzeDocument(documentId, modelName = 'custom-openai', progressCallback = null) {
    try {
      console.log(`\n[PPT分析] 开始分析文档: ${documentId}`)
      console.log(`[PPT分析] 使用模型: ${modelName}`)
      
      // 1. 查询文档的所有提取内容
      const slides = await prisma.slide_merged_contents.findMany({
        where: {
          document_id: documentId
        },
        orderBy: {
          slide_order: 'asc'
        }
      })
      
      if (slides.length === 0) {
        throw new Error('该文档没有提取的文本内容,请先提取文本')
      }
      
      console.log(`[PPT分析] 共找到 ${slides.length} 个页面需要分析`)
      
      // 2. 逐页分析并更新
      const results = {
        total: slides.length,
        success: 0,
        failed: 0,
        skipped: 0,
        details: []
      }
      
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i]
        
        try {
          // 检查文本内容是否为空
          if (!slide.merged_content || slide.merged_content.trim().length === 0) {
            console.log(`[PPT分析] 跳过页面 ${i + 1}: 内容为空`)
            results.skipped++
            results.details.push({
              slideIndex: i,
              slideId: slide.slide_id,
              status: 'skipped',
              reason: '内容为空'
            })
            
            if (progressCallback) {
              progressCallback(i + 1, slides.length, { status: 'skipped', slideId: slide.slide_id })
            }
            continue
          }
          
          // 调用AI分析
          const analysisResult = await this.analyzeSingleSlide(
            slide.merged_content,
            slide.slide_order - 1, // slide_order从1开始,转为索引从0开始
            slide.slide_id,
            modelName
          )
          
          // 更新thumbnails表
          const updateResult = await prisma.thumbnails.updateMany({
            where: {
              document_id: documentId,
              slide_id: slide.slide_id
            },
            data: {
              page_type: analysisResult.category_code,
              page_type_confidence: analysisResult.confidence,
              analyzed_at: new Date()
            }
          })
          
          if (updateResult.count > 0) {
            results.success++
            results.details.push({
              slideIndex: i,
              slideId: slide.slide_id,
              status: 'success',
              categoryCode: analysisResult.category_code,
              confidence: analysisResult.confidence,
              reason: analysisResult.reason
            })
            
            console.log(`[PPT分析] 页面 ${i + 1} 分类更新成功: ${analysisResult.category_code}`)
          } else {
            results.failed++
            results.details.push({
              slideIndex: i,
              slideId: slide.slide_id,
              status: 'failed',
              reason: 'thumbnails表中未找到对应记录'
            })
          }
          
          if (progressCallback) {
            progressCallback(i + 1, slides.length, {
              status: 'success',
              slideId: slide.slide_id,
              result: analysisResult
            })
          }
          
          // 添加延迟以避免API调用过快
          if (i < slides.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500))
          }
          
        } catch (error) {
          console.error(`[PPT分析] 页面 ${i + 1} 分析失败:`, error.message)
          results.failed++
          results.details.push({
            slideIndex: i,
            slideId: slide.slide_id,
            status: 'error',
            error: error.message
          })
          
          if (progressCallback) {
            progressCallback(i + 1, slides.length, {
              status: 'error',
              slideId: slide.slide_id,
              error: error.message
            })
          }
        }
      }
      
      console.log(`\n[PPT分析] 文档分析完成!`)
      console.log(`[PPT分析] 成功: ${results.success}, 失败: ${results.failed}, 跳过: ${results.skipped}`)
      
      return results
      
    } catch (error) {
      console.error(`[PPT分析] 文档分析失败:`, error)
      throw error
    }
  }
  
  /**
   * 获取文档的分析结果
   * 
   * @param {string} documentId - 文档ID
   * @returns {Promise<Array>} 分析结果列表
   */
  async getAnalysisResults(documentId) {
    const thumbnails = await prisma.thumbnails.findMany({
      where: {
        document_id: documentId,
        page_type: {
          not: null
        }
      },
      orderBy: {
        slide_index: 'asc'
      },
      select: {
        id: true,
        slide_id: true,
        slide_index: true,
        page_type: true,
        page_type_confidence: true,
        analyzed_at: true
      }
    })
    
    // 关联分类信息 (🔄 已更新：从 product_catalogs 表读取)
    const results = []
    
    // 获取通用产品ID
    const GENERAL_PRODUCT_CODE = 'general_ppt_categories'
    const generalProduct = await prisma.products.findFirst({
      where: { code: GENERAL_PRODUCT_CODE }
    })
    
    if (!generalProduct) {
      throw new Error('未找到通用PPT分类产品')
    }
    
    for (const thumb of thumbnails) {
      const category = await prisma.product_catalogs.findFirst({
        where: {
          product_id: generalProduct.id,
          code: thumb.page_type
        }
      })
      
      results.push({
        thumbnailId: thumb.id,
        slideId: thumb.slide_id,
        slideIndex: thumb.slide_index,
        categoryCode: thumb.page_type,
        categoryName: category?.name || '未知分类',
        confidence: thumb.page_type_confidence,
        analyzedAt: thumb.analyzed_at
      })
    }
    
    return results
  }
}

module.exports = new PPTAnalysisService()

