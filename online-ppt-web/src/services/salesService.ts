import salesApi from './salesApi'

// 售前平台业务接口

// 产品相关
export const getProducts = (params?: any) => {
  return salesApi.get('/api/products', { params })
}

export const getProductDetail = (id: string) => {
  return salesApi.get(`/api/products/${id}`)
}

export const searchProducts = (keyword: string) => {
  return salesApi.get('/api/products/search', { params: { q: keyword } })
}

// 问答相关
export const getQAList = (params?: any) => {
  return salesApi.get('/api/qa', { params })
}

export const getQADetail = (id: string) => {
  return salesApi.get(`/api/qa/${id}`)
}

export const searchQA = (keyword: string) => {
  return salesApi.get('/api/qa/search', { params: { q: keyword } })
}

// 推荐内容
export const getRecommendations = (type?: string) => {
  return salesApi.get('/api/recommendations', { params: { type } })
}

// 宣传物料
export const getMaterials = (params?: any) => {
  return salesApi.get('/api/materials', { params })
}

// 音频/视频
export const getMediaList = (params?: any) => {
  return salesApi.get('/api/media', { params })
}

// 用户相关
export const getUserProfile = () => {
  return salesApi.get('/api/user/profile')
}

export const updateUserProfile = (data: any) => {
  return salesApi.put('/api/user/profile', data)
}


