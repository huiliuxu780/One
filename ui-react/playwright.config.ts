import { defineConfig, devices } from '@playwright/test'

/**
 * 针对真实开发后端的端到端测试。
 * 先启动 React 开发服务（deploy/dev/docker-compose.ui-react-dev.yml 或本地 pnpm dev），再执行：
 *   APBOA_E2E_BASE_URL=http://127.0.0.1:3031 \
 *   APBOA_E2E_USERNAME=... APBOA_E2E_PASSWORD=... pnpm test:e2e
 * 凭据只经环境变量注入，不写入仓库。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.APBOA_E2E_BASE_URL || 'http://127.0.0.1:3031',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
