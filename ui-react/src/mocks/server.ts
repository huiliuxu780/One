import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** 仅供单元测试使用的 MSW 服务；正式代码不得依赖 mock。 */
export const server = setupServer(...handlers)
