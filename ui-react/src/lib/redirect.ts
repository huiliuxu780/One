/** 会话失效后的统一跳转；独立成模块便于在测试中 mock。 */
export function redirectToLogin() {
  window.location.assign(`${import.meta.env.BASE_URL}login`)
}
