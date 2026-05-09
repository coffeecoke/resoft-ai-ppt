<template>
  <div class="ppt-login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <el-icon><MagicStick /></el-icon>
        </div>
        <h1>AI PPT 工作台</h1>
        <p>请登录以继续</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        size="large"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="用户名"
            :prefix-icon="User"
            autocomplete="username"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            :prefix-icon="Lock"
            show-password
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            style="width: 100%"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>

      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'
import { User, Lock, MagicStick } from '@element-plus/icons-vue'
import { useAuthStore } from '@/store/auth'
import { authService } from '@/services/authService'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const formRef = ref<FormInstance>()
const loading = ref(false)
const errorMsg = ref('')

const form = reactive({ username: '', password: '' })

const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function handleLogin() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  loading.value = true
  errorMsg.value = ''
  try {
    const res = await authService.login({ username: form.username, password: form.password })
    authStore.setAuth(res.token, {
      userId: res.user.userId,
      username: res.user.username,
      name: res.user.name,
      role: res.user.role,
      department: res.user.department,
    })
    const redirect = (route.query.redirect as string) || '/ai-ppt/home'
    router.push(redirect)
  } catch (err: any) {
    errorMsg.value = err?.message || '登录失败，请检查用户名和密码'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.ppt-login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ede9fe 0%, #f5f3ff 50%, #eef2ff 100%);

  /* 紫色主题覆盖 Element Plus 变量 */
  --el-color-primary:         #6366f1;
  --el-color-primary-dark-2:  #4f52c1;
  --el-color-primary-light-3: #9294f5;
  --el-color-primary-light-5: #b1b3f8;
  --el-color-primary-light-7: #d0d1fb;
  --el-color-primary-light-8: #dfe0fc;
  --el-color-primary-light-9: #efeffd;
}

.login-card {
  width: 400px;
  padding: 48px 40px 40px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 40px rgba(99, 102, 241, 0.12);
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 26px;
  color: #fff;
  margin-bottom: 16px;
}

.login-header h1 {
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  margin: 0 0 6px;
}

.login-header p {
  color: #9ca3af;
  margin: 0;
  font-size: 14px;
}

.error-msg {
  color: #ef4444;
  text-align: center;
  margin-top: 8px;
  font-size: 14px;
}
</style>
