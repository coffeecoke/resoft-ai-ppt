import axios from 'axios'
import { ElMessage } from 'element-plus'

// 售前平台 API 配置
const salesApi = axios.create({
  baseURL: import.meta.env.VITE_SALES_API_URL || 'http://localhost:3001',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// 请求拦截器
salesApi.interceptors.request.use(
  config => {
    // 可以在这里添加 token 等认证信息
    const token = localStorage.getItem('sales_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
salesApi.interceptors.response.use(
  response => {
    if (response.status >= 200 && response.status < 400) {
      return Promise.resolve(response.data)
    }
    ElMessage.error('未知的请求错误！')
    return Promise.reject(response)
  },
  error => {
    if (error && error.response) {
      const errorMessage = error.response.data?.error || error.response.data?.message || error.message
      
      if (error.response.status >= 400 && error.response.status < 500) {
        ElMessage.error(errorMessage)
        return Promise.reject(new Error(errorMessage))
      }
      else if (error.response.status >= 500) {
        ElMessage.error('服务器错误：' + errorMessage)
        return Promise.reject(new Error(errorMessage))
      }
      
      ElMessage.error('服务器遇到未知错误！')
      return Promise.reject(new Error(errorMessage))
    }

    ElMessage.error('连接到服务器失败 或 服务器响应超时！')
    return Promise.reject(error)
  }
)

export default salesApi




