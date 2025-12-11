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
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: true,
        ws: true,
        rewrite: (path) => {
          const newPath = path.replace(/^\/api/, '')
          console.log(`🔄 代理: ${path} -> https://server.pptist.cn${newPath}`)
          return newPath
        },
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('❌ 代理错误:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            const actualPath = proxyReq.path
            const fullUrl = `https://server.pptist.cn${actualPath}`
            console.log(`📤 代理请求详情:`)
            console.log(`   原始请求: ${req.method} ${req.url}`)
            console.log(`   实际路径: ${actualPath}`)
            console.log(`   完整URL: ${fullUrl}`)
            // 确保转发所有必要的请求头
            proxyReq.setHeader('Accept', '*/*')
            proxyReq.setHeader('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8')
            proxyReq.setHeader('Origin', 'https://server.pptist.cn')
            proxyReq.setHeader('Referer', 'https://server.pptist.cn/')
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36')
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`📥 代理响应: ${proxyRes.statusCode} ${req.url}`)
            // 处理CORS响应头
            proxyRes.headers['Access-Control-Allow-Origin'] = '*'
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
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
