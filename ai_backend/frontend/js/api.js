/**
 * API封装
 * 统一的HTTP请求方法
 */

const API = {
  // 基础URL
  baseURL: '',
  
  /**
   * 通用请求方法
   */
  async request(url, options = {}) {
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
      const response = await fetch(this.baseURL + url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data.data !== undefined ? data.data : data;
    } catch (error) {
      console.error('API请求失败:', error);
      throw error;
    }
  },
  
  /**
   * GET请求
   */
  async get(url, params = {}) {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    return this.request(fullUrl, { method: 'GET' });
  },
  
  /**
   * POST请求
   */
  async post(url, data = {}) {
    return this.request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * PUT请求
   */
  async put(url, data = {}) {
    return this.request(url, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  /**
   * DELETE请求
   */
  async delete(url) {
    return this.request(url, { method: 'DELETE' });
  },
};

// 暴露到全局
window.API = API;

