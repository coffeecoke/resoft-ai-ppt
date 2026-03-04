// online-ppt-web/src/services/authService.ts
import axios from './config'
import { SERVER_URL } from './index'

export interface LoginPayload {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    userId: string
    username: string
    name: string
    role: 'admin' | 'user'
    department?: string
  }
}

export const authService = {
  login(payload: LoginPayload): Promise<LoginResponse> {
    return axios.post(`${SERVER_URL}/auth/login`, payload)
  },

  logout(): Promise<void> {
    return axios.post(`${SERVER_URL}/auth/logout`)
  },

  getMe(): Promise<{ id: string; username: string; name: string; role: string; department?: string }> {
    return axios.get(`${SERVER_URL}/auth/me`)
  },

  changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    return axios.put(`${SERVER_URL}/auth/password`, { oldPassword, newPassword })
  },
}
