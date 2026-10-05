/// <reference types="vitest/config" />
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const contextPath = env.VITE_APP_CONTEXT_PATH || ''
  // 宿主机直跑时代理到本机端口；容器开发态通过环境变量指向 compose 服务名。
  const consoleTarget = env.VITE_DEV_CONSOLE_TARGET || 'http://127.0.0.1:3060'
  const runtimeTarget = env.VITE_DEV_RUNTIME_TARGET || 'http://127.0.0.1:3061'
  const wsTarget = env.VITE_DEV_WS_TARGET || 'http://127.0.0.1:3064'
  // 生产默认不出 source map；需要发布符号时设 VITE_SOURCEMAP=hidden。
  const sourcemap = env.VITE_SOURCEMAP === 'hidden' ? ('hidden' as const) : env.VITE_SOURCEMAP === 'true'

  return {
    base: contextPath ? `${contextPath}/` : '/',
    plugins: [react(), tailwindcss()].flat(),
    resolve: {
      alias: {
        '@': path.resolve(rootDir, 'src'),
      },
    },
    server: {
      host: true,
      port: 3031,
      proxy: {
        '/api/runtime/': {
          target: runtimeTarget,
          changeOrigin: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
        '/api/ws/': {
          target: wsTarget,
          changeOrigin: true,
          ws: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
        '/api': {
          target: consoleTarget,
          changeOrigin: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
      exclude: ['**/node_modules/**', 'e2e/**'],
    },
    build: {
      outDir: 'dist',
      sourcemap,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@xyflow/')) return 'xyflow'
            if (id.includes('/node_modules/@codemirror/') || id.includes('/node_modules/codemirror/')) return 'codemirror'
            if (id.includes('/node_modules/react') || id.includes('/node_modules/react-router')) {
              return 'react'
            }
            return undefined
          },
        },
      },
    },
  }
})
