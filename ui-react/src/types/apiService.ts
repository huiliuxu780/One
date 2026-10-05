/**
 * API 服务（runner-gateway）类型（自 Vue 端移植，字段保持一致）
 */

export type GatewayHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL'
export type GatewayAuthType = string
export type GatewayLimitType = string

export interface GatewayApiParam {
  name?: string
  position?: string
  type?: string
  required?: boolean
  remark?: string
}

export interface GatewayApiConfig {
  authType?: GatewayAuthType
  limitType?: GatewayLimitType
  routeTimes?: number
  ipTimes?: number
  contentTypes?: string[]
  params?: GatewayApiParam[]
  wholeBodyParam?: string
}

export interface GatewayApp {
  id?: string
  name: string
  remark?: string
  protocol?: string
  port?: number
  config?: Record<string, unknown>
  online?: number
  createdAt?: string
}

export interface GatewayApi {
  id?: string
  appId?: string
  category?: string
  name: string
  remark?: string
  method: GatewayHttpMethod
  path: string
  config?: GatewayApiConfig
  online?: number
  createdAt?: string
  appName?: string
  appPort?: number
  workflowId?: string
  workflowName?: string
  workflowStatus?: string
}

export interface GatewayAccessLog {
  id: string
  appId?: string
  apiId?: string
  workflowRunId?: string
  method?: string
  path?: string
  headerParams?: string
  pathParams?: string
  queryParams?: string
  requestBody?: string
  responseBody?: string
  accessIp?: string
  status?: number
  httpStatus?: number
  error?: string
  startTime?: number
  endTime?: number
  createdAt?: string
}

export interface GatewayPageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}
