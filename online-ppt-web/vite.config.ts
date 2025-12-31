import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  base: '',
  plugins: [
    vue(), // Vue 插件默认会生成 source map，开发模式下可在浏览器控制台看到 .vue 文件路径
  ],
  server: {
    host: '127.0.0.1',
    port: 5173,
    allowedHosts: [
      '20792bg6wh17.vicp.fun', // 允许内网穿透域名访问
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => {
          // 将 /api/xxx 重写为 /xxx，代理到本地后端服务
          const newPath = path.replace(/^\/api/, '')
          console.log(`🔄 代理: ${path} -> http://localhost:5001${newPath}`)
          return newPath
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ 代理错误:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log(`📤 代理请求: ${req.method} ${req.url} -> http://localhost:5001${proxyReq.path}`)
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`📥 代理响应: ${proxyRes.statusCode} ${req.url}`)
          })
        },
      }
    }
  },
  css: {
    devSourcemap: true, // 开发模式下启用 CSS source map，可在浏览器控制台看到源码路径
    preprocessorOptions: {
      scss: {
        additionalData: `
          @import '@/assets/styles/variable.scss';
          @import '@/assets/styles/mixin.scss';
        `
      },
    },
  },
  esbuild: {
    // 启用 esbuild 的 source map，用于 TypeScript/JavaScript 文件
    sourcemap: true,
  },
  build: {
    sourcemap: true, // 构建时也生成 source map
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
