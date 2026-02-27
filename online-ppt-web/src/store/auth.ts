// online-ppt-web/src/store/auth.ts
import { defineStore } from 'pinia'

export interface AuthUser {
  userId: string
  username: string
  name: string
  role: 'admin' | 'user'
  department?: string
}

export interface AuthState {
  token: string | null
  user: AuthUser | null
}

const TOKEN_KEY = 'resoft_auth_token'
const USER_KEY = 'resoft_auth_user'

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem(TOKEN_KEY),
    user: (() => {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch { return null }
    })(),
  }),

  getters: {
    isLoggedIn: (state): boolean => !!state.token && !!state.user,
    isAdmin: (state): boolean => state.user?.role === 'admin',
  },

  actions: {
    setAuth(token: string, user: AuthUser) {
      this.token = token
      this.user = user
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    },

    clearAuth() {
      this.token = null
      this.user = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
    },
  },
})
