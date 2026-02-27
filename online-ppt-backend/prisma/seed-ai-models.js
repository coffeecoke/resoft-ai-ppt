/**
 * AI模型配置初始化脚本
 * 为各个AI功能场景添加默认的模型配置
 */

import * as prismaClient from '@prisma/client';
import { randomUUID } from 'crypto';
const { PrismaClient } = prismaClient;
const prisma = new PrismaClient();

// 默认模型配置数据
const defaultModels = [
  // ========== 语音转文本场景 ==========
  {
    id: randomUUID(),
    name: '讯飞星火V3.5（语音分析）',
    code: 'xfyun_spark_v35_transcription',
    provider: 'xfyun',
    model_name: 'spark-v3.5',
    api_url: process.env.XFYUN_API_URL || 'https://spark-api.xf-yun.com/v1',
    api_key: process.env.XFYUN_API_KEY || 'YOUR_XFYUN_API_KEY',
    api_secret: process.env.XFYUN_API_SECRET || null,
    max_tokens: 2000,
    temperature: 0.7,
    top_p: 0.9,
    scene_type: 'transcription',
    is_default: true,
    supports_stream: true,
    supports_functions: false,
    supports_vision: false,
    sort_order: 1,
    remark: '用于语音转录后的内容分析和提取',
  },
  
  // ========== PPT分析场景 ==========
  {
    id: randomUUID(),
    name: '讯飞星火V3.5（PPT分析）',
    code: 'xfyun_spark_v35_ppt',
    provider: 'xfyun',
    model_name: 'spark-v3.5',
    api_url: process.env.XFYUN_API_URL || 'https://spark-api.xf-yun.com/v1',
    api_key: process.env.XFYUN_API_KEY || 'YOUR_XFYUN_API_KEY',
    api_secret: process.env.XFYUN_API_SECRET || null,
    max_tokens: 2000,
    temperature: 0.3,
    top_p: 0.8,
    scene_type: 'ppt_analysis',
    is_default: true,
    supports_stream: true,
    supports_functions: false,
    supports_vision: false,
    sort_order: 1,
    remark: '用于PPT页面分类，温度较低以保证稳定输出',
  },
  
  {
    id: randomUUID(),
    name: '通义千问Max（PPT分析）',
    code: 'qwen_max_ppt',
    provider: 'qwen',
    model_name: 'qwen-max',
    api_url: process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api_key: process.env.QWEN_API_KEY || 'YOUR_QWEN_API_KEY',
    api_secret: null,
    max_tokens: 2000,
    temperature: 0.3,
    top_p: 0.8,
    scene_type: 'ppt_analysis',
    is_default: false,
    supports_stream: true,
    supports_functions: true,
    supports_vision: false,
    sort_order: 2,
    remark: '备用模型，支持函数调用',
  },
  
  // ========== 文档提取场景 ==========
  {
    id: randomUUID(),
    name: '通义千问Plus（文档提取）',
    code: 'qwen_plus_extract',
    provider: 'qwen',
    model_name: 'qwen-plus',
    api_url: process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    api_key: process.env.QWEN_API_KEY || 'YOUR_QWEN_API_KEY',
    api_secret: null,
    max_tokens: 4000,
    temperature: 0.5,
    top_p: 0.9,
    scene_type: 'document_extract',
    is_default: true,
    supports_stream: true,
    supports_functions: false,
    supports_vision: false,
    sort_order: 1,
    remark: '用于文档内容提取，更大的Token支持',
  },
  
  // ========== 文档管理场景 ==========
  {
    id: randomUUID(),
    name: 'GPT-4 Turbo（文档管理）',
    code: 'openai_gpt4_turbo_manage',
    provider: 'openai',
    model_name: 'gpt-4-turbo-preview',
    api_url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
    api_key: process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY',
    api_secret: null,
    max_tokens: 4000,
    temperature: 0.7,
    top_p: 0.9,
    scene_type: 'document_manage',
    is_default: true,
    supports_stream: true,
    supports_functions: true,
    supports_vision: false,
    sort_order: 1,
    remark: '用于文档智能管理和分类',
  },
  
  // ========== 通用场景（预留） ==========
  {
    id: randomUUID(),
    name: '讯飞星火V3.5（通用）',
    code: 'xfyun_spark_v35_general',
    provider: 'xfyun',
    model_name: 'spark-v3.5',
    api_url: process.env.XFYUN_API_URL || 'https://spark-api.xf-yun.com/v1',
    api_key: process.env.XFYUN_API_KEY || 'YOUR_XFYUN_API_KEY',
    api_secret: process.env.XFYUN_API_SECRET || null,
    max_tokens: 2000,
    temperature: 0.7,
    top_p: 0.9,
    scene_type: 'general',
    is_default: true,
    supports_stream: true,
    supports_functions: false,
    supports_vision: false,
    sort_order: 1,
    remark: '通用对话模型',
  },
];

async function seedAIModels() {
  console.log('🌱 开始初始化AI模型配置...\n');
  
  try {
    // 检查是否已有数据
    const existingCount = await prisma.ai_model_configs.count();
    
    if (existingCount > 0) {
      console.log(`⚠️  检测到已有 ${existingCount} 条模型配置`);
      console.log('是否要清空并重新初始化？(请手动确认)\n');
      // 在实际使用时，可以添加交互式确认
      // 这里直接跳过
      console.log('跳过初始化，保留现有数据\n');
      return;
    }
    
    // 插入默认配置
    let successCount = 0;
    
    for (const model of defaultModels) {
      try {
        await prisma.ai_model_configs.create({
          data: {
            ...model,
            updated_at: new Date(),
          }
        });
        
        console.log(`✅ [${model.scene_type}] ${model.name} ${model.is_default ? '(默认)' : ''}`);
        successCount++;
      } catch (error) {
        console.error(`❌ 创建失败: ${model.name}`, error.message);
      }
    }
    
    console.log(`\n🎉 初始化完成！成功创建 ${successCount}/${defaultModels.length} 个模型配置\n`);
    
    // 显示场景统计
    const sceneStats = await prisma.ai_model_configs.groupBy({
      by: ['scene_type'],
      _count: true,
    });
    
    console.log('📊 各场景模型配置统计：');
    sceneStats.forEach(stat => {
      console.log(`   ${stat.scene_type}: ${stat._count} 个模型`);
    });
    
    console.log('\n💡 提示：');
    console.log('1. 请在 .env 文件中配置实际的API密钥');
    console.log('2. 可以通过管理界面修改和添加更多模型配置');
    console.log('3. 每个场景必须有至少一个默认模型');
    
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 执行初始化
seedAIModels().catch(console.error);

