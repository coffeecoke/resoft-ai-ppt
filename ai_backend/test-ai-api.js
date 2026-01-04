/**
 * 测试AI API连接
 */

require('dotenv').config()
const OpenAI = require('openai')

async function testAIConnection() {
  console.log('\n========== 测试AI API连接 ==========\n')
  
  // 配置
  const apiKey = process.env.CUSTOM_OPENAI_API_KEY || 'sk-vA1FLiIkxSmFA6VvC505BcEa71B04aBd83756c4b138fDb0f'
  const baseURL = process.env.CUSTOM_OPENAI_BASE_URL || 'http://10.168.165.50:3000/v1'
  const model = process.env.CUSTOM_OPENAI_MODEL || 'gpt-4o-mini'
  
  console.log('配置信息:')
  console.log(`  API Key: ${apiKey.substring(0, 10)}...`)
  console.log(`  Base URL: ${baseURL}`)
  console.log(`  Model: ${model}`)
  console.log('')
  
  // 创建客户端
  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL
  })
  
  try {
    // 测试聊天完成
    console.log('发送测试请求...')
    const response = await client.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: '你是一个测试助手' },
        { role: 'user', content: '请回复"连接成功"三个字' }
      ],
      temperature: 0.7,
      max_tokens: 100
    })
    
    console.log('\n✅ AI API连接成功!\n')
    console.log('响应内容:', response.choices[0].message.content)
    console.log('\n完整响应:')
    console.log(JSON.stringify(response, null, 2))
    
  } catch (error) {
    console.error('\n❌ AI API连接失败!\n')
    console.error('错误信息:', error.message)
    if (error.response) {
      console.error('响应状态:', error.response.status)
      console.error('响应数据:', error.response.data)
    }
    console.error('\n完整错误:')
    console.error(error)
  }
}

// 运行测试
testAIConnection()

