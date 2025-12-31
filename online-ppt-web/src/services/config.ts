import axios from 'axios'
import message from '@/utils/message'

// 创建axios实例，超时时间设置为5分钟（用于处理大文件上传）
const instance = axios.create({ 
  timeout: 1000 * 300,
  // 设置最大内容长度为100MB
  maxContentLength: 100 * 1024 * 1024,
  maxBodyLength: 100 * 1024 * 1024
})

instance.interceptors.response.use(
  response => {
    if (response.status >= 200 && response.status < 400) {
      return Promise.resolve(response.data)
    }

    message.error('未知的请求错误！')
    return Promise.reject(response)
  },
  error => {
    // 处理网络错误
    if (error.code === 'ERR_NETWORK' || error.code === 'ECONNRESET') {
      const errorMsg = '网络连接失败，可能是：\n1. 后端服务未启动\n2. 数据量过大导致连接中断\n3. 网络不稳定'
      message.error(errorMsg)
      return Promise.reject(new Error('网络连接失败'))
    }
    
    // 处理超时错误
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      message.error('请求超时，请稍后重试')
      return Promise.reject(new Error('请求超时'))
    }
    
    if (error && error.response) {
      // 优先使用后端返回的错误消息
      const errorMessage = error.response.data?.error || error.response.data?.message || error.message
      
      if (error.response.status >= 400 && error.response.status < 500) {
        return Promise.reject(new Error(errorMessage))
      }
      else if (error.response.status >= 500) {
        return Promise.reject(new Error(errorMessage))
      }
      
      message.error('服务器遇到未知错误！')
      return Promise.reject(new Error(errorMessage))
    }

    message.error('连接到服务器失败 或 服务器响应超时！')
    return Promise.reject(error)
  }
)

export default instance