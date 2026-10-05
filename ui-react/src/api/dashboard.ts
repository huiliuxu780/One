import type {
  ApiResponse,
  DashboardDatasetEntity,
  DashboardDsl,
  DashboardEntity,
  DashboardHistoryEntity,
  DatasetExecuteResult,
  GatewayAccessLog,
  GatewayApi,
  GatewayApp,
  GatewayPageResult,
  PageResult,
} from '@/types'
import { apiClient } from './client'

/** 工作台 */
export const dashboards = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<PageResult<DashboardEntity>>>('/api/dashboard/page', { params: query }),
  detail: (id: string) => apiClient.get<ApiResponse<DashboardEntity>>(`/api/dashboard/${id}`),
  save: (entity: Partial<DashboardEntity>) => apiClient.post<ApiResponse<DashboardEntity>>('/api/dashboard', entity),
  update: (entity: Partial<DashboardEntity>) => apiClient.put<ApiResponse<boolean>>('/api/dashboard', entity),
  remove: (ids: string[], force = 0) => apiClient.delete<ApiResponse<boolean>>(`/api/dashboard/${force}`, { data: ids }),
  setDefault: (id: string) => apiClient.put<ApiResponse<boolean>>(`/api/dashboard/${id}/default`),
  enable: (id: string, enable: number) => apiClient.put<ApiResponse<boolean>>(`/api/dashboard/${id}/enable/${enable}`),
  historyList: (id: string) => apiClient.get<ApiResponse<DashboardHistoryEntity[]>>(`/api/dashboard/${id}/history`),
  removeHistory: (id: string, historyId: string) => apiClient.delete<ApiResponse<boolean>>(`/api/dashboard/${id}/history/${historyId}`),
  portal: () => apiClient.get<ApiResponse<{ dashboardId: string; config: DashboardDsl; source: string; stale: boolean }>>('/api/dashboard/portal'),
}

/** 数据集 */
export const datasets = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<PageResult<DashboardDatasetEntity>>>('/api/dashboard/dataset/page', { params: query }),
  save: (entity: Partial<DashboardDatasetEntity>) => apiClient.post<ApiResponse<DashboardDatasetEntity>>('/api/dashboard/dataset', entity),
  update: (entity: Partial<DashboardDatasetEntity>) => apiClient.put<ApiResponse<boolean>>('/api/dashboard/dataset', entity),
  remove: (ids: string[]) => apiClient.delete<ApiResponse<boolean>>('/api/dashboard/dataset', { data: ids }),
  enable: (id: string, enable: number) => apiClient.put<ApiResponse<boolean>>(`/api/dashboard/dataset/${id}/enable/${enable}`),
  /** 真实执行数据集查询（含错误与超时原文） */
  query: (id: string, payload: Record<string, unknown>) =>
    apiClient.post<ApiResponse<DatasetExecuteResult>>(`/api/dashboard/dataset/${id}/query`, payload),
  preview: (payload: Record<string, unknown>) =>
    apiClient.post<ApiResponse<DatasetExecuteResult>>('/api/dashboard/dataset/execute', payload),
}

/** API 服务（runner-gateway） */
export const gatewayApps = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<GatewayPageResult<GatewayApp>>>('/api/gateway/app/page', { params: query }),
  save: (entity: Partial<GatewayApp>) => apiClient.post<ApiResponse<boolean>>('/api/gateway/app', entity),
  update: (entity: Partial<GatewayApp>) => apiClient.put<ApiResponse<boolean>>('/api/gateway/app', entity),
  remove: (ids: string[]) => apiClient.delete<ApiResponse<boolean>>('/api/gateway/app', { data: ids }),
  online: (id: string, v: number) => apiClient.put<ApiResponse<boolean>>(`/api/gateway/app/${id}/online/${v}`),
}

export const gatewayApis = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<GatewayPageResult<GatewayApi>>>('/api/gateway/api/page', { params: query }),
  detail: (id: string) => apiClient.get<ApiResponse<GatewayApi>>(`/api/gateway/api/${id}`),
  save: (entity: Partial<GatewayApi>) => apiClient.post<ApiResponse<boolean>>('/api/gateway/api', entity),
  update: (entity: Partial<GatewayApi>) => apiClient.put<ApiResponse<boolean>>('/api/gateway/api', entity),
  remove: (ids: string[]) => apiClient.delete<ApiResponse<boolean>>('/api/gateway/api', { data: ids }),
  online: (id: string, v: number) => apiClient.put<ApiResponse<boolean>>(`/api/gateway/api/${id}/online/${v}`),
  categories: () => apiClient.get<ApiResponse<string[]>>('/api/gateway/api/categories'),
}

export const accessLogs = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<GatewayPageResult<GatewayAccessLog>>>('/api/gateway/access-log/page', { params: query }),
}
