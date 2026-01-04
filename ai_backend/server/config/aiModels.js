/**
 * AI模型配置
 * 
 * 所有模型都使用自定义的OpenAI兼容API端点
 * 支持的模型列表根据实际API服务器提供的模型而定
 */

// 自定义API端点配置（所有模型共享）
const CUSTOM_API_KEY = process.env.CUSTOM_OPENAI_API_KEY || 'sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f'
const CUSTOM_BASE_URL = process.env.CUSTOM_OPENAI_BASE_URL || 'http://10.168.165.50:3000/v1'

const modelConfigs = {
  // ========== OpenAI 系列（本地API） ==========
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    displayName: 'GPT-4o',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'gpt-4.1': {
    provider: 'openai',
    model: 'gpt-4.1',
    displayName: 'GPT-4.1',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'gpt-4.1-mini': {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    displayName: 'GPT-4.1 Mini',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'gpt-4.1-nano': {
    provider: 'openai',
    model: 'gpt-4.1-nano',
    displayName: 'GPT-4.1 Nano',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  
  // ========== DeepSeek 系列（本地API） ==========
  'deepseek-chat': {
    provider: 'openai',
    model: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'deepseek-reasoner': {
    provider: 'openai',
    model: 'deepseek-reasoner',
    displayName: 'DeepSeek Reasoner',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'deepseek-v3': {
    provider: 'openai',
    model: 'deepseek-v3',
    displayName: 'DeepSeek V3',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'deepseek-v3.1': {
    provider: 'openai',
    model: 'deepseek-v3.1',
    displayName: 'DeepSeek V3.1',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'deepseek-r1': {
    provider: 'openai',
    model: 'deepseek-r1',
    displayName: 'DeepSeek R1',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'deepseek-r1:32b': {
    provider: 'openai',
    model: 'deepseek-r1:32b',
    displayName: 'DeepSeek R1 (32B)',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  
  // ========== 通义千问系列（本地API） ==========
  'qwen-plus': {
    provider: 'openai',
    model: 'qwen-plus',
    displayName: '通义千问 Plus',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'qwen3-max': {
    provider: 'openai',
    model: 'qwen3-max',
    displayName: '通义千问3 Max',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'qwen3-coder-flash': {
    provider: 'openai',
    model: 'qwen3-coder-flash',
    displayName: '通义千问3 Coder Flash',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'qwen3-coder-plus': {
    provider: 'openai',
    model: 'qwen3-coder-plus',
    displayName: '通义千问3 Coder Plus',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  
  // ========== OpenAI O1 系列（本地API） ==========
  'o1': {
    provider: 'openai',
    model: 'o1',
    displayName: 'OpenAI O1',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'o1-preview': {
    provider: 'openai',
    model: 'o1-preview',
    displayName: 'OpenAI O1 Preview',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  'o1-mini': {
    provider: 'openai',
    model: 'o1-mini',
    displayName: 'OpenAI O1 Mini',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  
  // ========== 其他模型（本地API） ==========
  'resoft-llm': {
    provider: 'openai',
    model: 'resoft-llm',
    displayName: 'Resoft LLM',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  },
  
  // ========== 兼容配置（保留） ==========
  'custom-openai': {
    provider: 'openai',
    model: process.env.CUSTOM_OPENAI_MODEL || 'gpt-4o-mini',
    displayName: 'Custom OpenAI (动态模型)',
    envKey: 'CUSTOM_OPENAI_API_KEY',
    envBaseUrl: 'CUSTOM_OPENAI_BASE_URL',
    defaultBaseUrl: CUSTOM_BASE_URL
  }
}

/**
 * 获取模型配置
 * 
 * @param {string} modelName - 模型名称
 * @returns {Object} 模型配置对象
 */
function getModelConfig(modelName) {
  const config = modelConfigs[modelName]
  if (!config) {
    throw new Error(`不支持的模型: ${modelName}`)
  }
  
  // 优先使用环境变量，否则使用硬编码的默认值
  let apiKey = process.env[config.envKey]
  let baseUrl = process.env[config.envBaseUrl] || config.defaultBaseUrl
  
  // 如果环境变量为空，使用硬编码的默认值
  if (!apiKey) {
    apiKey = CUSTOM_API_KEY
  }
  
  return {
    ...config,
    apiKey: apiKey,
    baseUrl: baseUrl
  }
}

/**
 * 获取所有支持的模型列表
 * 
 * @returns {Array} 模型名称数组
 */
function getSupportedModels() {
  return Object.keys(modelConfigs)
}

module.exports = {
  modelConfigs,
  getModelConfig,
  getSupportedModels
}

