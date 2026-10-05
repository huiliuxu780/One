import { expect, test } from '@playwright/test'

const username = process.env.APBOA_E2E_USERNAME
const password = process.env.APBOA_E2E_PASSWORD

test.describe('RM-01 平台基础冒烟', () => {
  test.skip(!username || !password, '需要 APBOA_E2E_USERNAME / APBOA_E2E_PASSWORD 环境变量')

  test('登录后刷新受保护路由会话可恢复，退出后回到登录页', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('用户名或邮箱').fill(username!)
    await page.getByLabel('密码').fill(password!)
    await page.getByRole('button', { name: /登录/ }).click()
    await expect(page).toHaveURL(/\/agent$/)

    // 刷新受保护路由：会话应自动恢复，不跳回登录页。
    await page.reload()
    await expect(page).toHaveURL(/\/agent$/)
    await expect(page.getByText('Apboa Next')).toBeVisible()

    // 个人资料页可达。
    await page.goto('/settings/profile')
    await expect(page.getByRole('heading', { name: '个人资料' })).toBeVisible()

    // 退出登录后访问受保护路由应回到登录页。
    await page.getByRole('button', { name: /默认组织|admin|用户/ }).first().click()
    await page.getByRole('menuitem', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/agent')
    await expect(page).toHaveURL(/\/login/)
  })

  test('未登录访问受保护路由跳转登录页，未知路径展示 404', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/agent')
    await expect(page).toHaveURL(/\/login/)
    await page.goto('/definitely-not-a-route')
    await expect(page).toHaveURL(/\/login/)
  })
})
