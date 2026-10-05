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
  // 代理模式：
  //  - 'nginx'：本地 Vite 经 SSH 隧道连 ECS Nginx，/api、/api/runtime、/api/ws 保留原路径转发，由 Nginx 负责剥离与路由；
  //  - 'services'（默认）：直连三个后端服务（宿主机端口或 compose 服务名），Vite 负责剥离 /api 前缀。
  const proxyMode = env.VITE_DEV_PROXY_MODE || 'services'
  const nginxTarget = env.VITE_DEV_NGINX_TARGET || 'http://127.0.0.1:18080'
  const consoleTarget = env.VITE_DEV_CONSOLE_TARGET || 'http://127.0.0.1:3060'
  const runtimeTarget = env.VITE_DEV_RUNTIME_TARGET || 'http://127.0.0.1:3061'
  const wsTarget = env.VITE_DEV_WS_TARGET || 'http://127.0.0.1:3064'
  // 生产默认不出 source map；需要发布符号时设 VITE_SOURCEMAP=hidden。
  const sourcemap = env.VITE_SOURCEMAP === 'hidden' ? ('hidden' as const) : env.VITE_SOURCEMAP === 'true'

  const proxy =
    proxyMode === 'nginx'
      ? {
          // 保留原路径：ECS Nginx 已按最长前缀匹配 /api/runtime、/api/ws、/api
          '/api': {
            target: nginxTarget,
            changeOrigin: true,
            ws: true,
            timeout: 0,
          },
        }
      : {
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
        }

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
      proxy,
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
