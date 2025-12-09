/**
 * AI模型配置
 * 
 * 支持的模型列表及其配置
 */

export const modelConfigs = {
  // ========== OpenAI ==========
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    envKey: 'OPENAI_API_KEY',
    envBaseUrl: 'OPENAI_BASE_URL',
    defaultBaseUrl: 'https://api.openai.com/v1'
  },

  // ========== 智谱AI (GLM) ==========
  'GLM-4-Flash': {
    provider: 'zhipu',
    model: 'GLM-4-Flash',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  'GLM-4.5-Flash': {
    provider: 'zhipu',
    model: 'glm-4-flash',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },
  'GLM-4-Plus': {
    provider: 'zhipu',
    model: 'GLM-4-Plus',
    envKey: 'ZHIPU_API_KEY',
    envBaseUrl: 'ZHIPU_BASE_URL',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4'
  },

  // ========== 豆包 (字节跳动) ==========
  'ark-doubao-seed-1.6-flash': {
    provider: 'doubao',
    model: 'doubao-seed-1-6-flash-250828',
    envKey: 'DOUBAO_API_KEY',
    envBaseUrl: 'DOUBAO_BASE_URL',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    supportsSystemRole: false // 豆包可能不支持system角色，需要合并到user消息中
  },
  'doubao-pro-32k': {
    provider: 'doubao',
    model: 'doubao-pro-32k',
    envKey: 'DOUBAO_API_KEY',
    envBaseUrl: 'DOUBAO_BASE_URL',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    supportsSystemRole: false // 豆包可能不支持system角色，需要合并到user消息中
  },

  // ========== 通义千问 (阿里云) ==========
  'qwen-turbo': {
    provider: 'qwen',
    model: 'qwen-turbo',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  'qwen-plus': {
    provider: 'qwen',
    model: 'qwen-plus',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },
  'qwen-max': {
    provider: 'qwen',
    model: 'qwen-max',
    envKey: 'QWEN_API_KEY',
    envBaseUrl: 'QWEN_BASE_URL',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  },

  // ========== DeepSeek ==========
  'deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    envKey: 'DEEPSEEK_API_KEY',
    envBaseUrl: 'DEEPSEEK_BASE_URL',
    defaultBaseUrl: 'https://api.deepseek.com/v1'
  },

  // ========== 月之暗面 (Moonshot/Kimi) ==========
  'moonshot-v1-8k': {
    provider: 'moonshot',
    model: 'moonshot-v1-8k',
    envKey: 'MOONSHOT_API_KEY',
    envBaseUrl: 'MOONSHOT_BASE_URL',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  },
  'moonshot-v1-32k': {
    provider: 'moonshot',
    model: 'moonshot-v1-32k',
    envKey: 'MOONSHOT_API_KEY',
    envBaseUrl: 'MOONSHOT_BASE_URL',
    defaultBaseUrl: 'https://api.moonshot.cn/v1'
  }
}

/**
 * 获取模型配置
 */
export function getModelConfig(modelName) {
  const config = modelConfigs[modelName]
  if (!config) {
    throw new Error(`不支持的模型: ${modelName}`)
  }
  return {
    ...config,
    apiKey: process.env[config.envKey],
    baseUrl: process.env[config.envBaseUrl] || config.defaultBaseUrl
  }
}

/**
 * 获取所有支持的模型列表
 */
export function getSupportedModels() {
  return Object.keys(modelConfigs)
}
