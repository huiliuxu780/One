import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  const contextPath = env.VITE_APP_CONTEXT_PATH || ''

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
          target: 'http://127.0.0.1:3061',
          changeOrigin: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
        '/api/ws/': {
          target: 'http://127.0.0.1:3064',
          changeOrigin: true,
          ws: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
        '/api': {
          target: 'http://127.0.0.1:3060',
          changeOrigin: true,
          timeout: 0,
          rewrite: (value) => value.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/@xyflow/')) return 'xyflow'
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
