import type { ApiResponse, AccountVO, NodeStatusVO, Params, SecretKeyVO, StorageProtocol, WebSocketNodeVO } from '@/types'
import { apiClient } from './client'

export const accounts = {
  list: (query: Record<string, unknown>) => apiClient.get<ApiResponse<AccountVO[]>>(`/api/account/list`, { params: query }),
  detail: (id: string) => apiClient.get<ApiResponse<AccountVO>>(`/api/account/${id}`),
  save: (entity: Partial<AccountVO>) => apiClient.post<ApiResponse<boolean>>('/api/account', entity),
  remove: (ids: string[]) => apiClient.delete<ApiResponse<boolean>>('/api/account', { data: ids }),
  toggleEnabled: (id: string, enabled: boolean) =>
    apiClient.put<ApiResponse<boolean>>(`/api/account/${id}/toggle-enabled`, null, { params: { enabled } }),
  changePassword: (id: string, newPassword: string) =>
    apiClient.put<ApiResponse<boolean>>(`/api/account/${id}/change-password`, null, { params: { newPassword } }),
}

export const secretKeys = {
  list: () => apiClient.get<ApiResponse<SecretKeyVO[]>>('/api/sk/list'),
  create: (data: Partial<SecretKeyVO>) => apiClient.post<ApiResponse<SecretKeyVO>>('/api/sk', data),
  /** 仅允许更新名称；value 已脱敏不回显。 */
  update: (data: Pick<SecretKeyVO, 'id' | 'name'>) => apiClient.put<ApiResponse<boolean>>('/api/sk', data),
  remove: (ids: string[]) => apiClient.delete<ApiResponse<boolean>>('/api/sk', { data: ids }),
}

export const systemParams = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<{ records: Params[]; total: number; current: number; size: number; pages: number }>>('/api/params/page', { params: query }),
  save: (entity: Partial<Params>) => apiClient.post<ApiResponse<boolean>>('/api/params/add', entity),
  update: (entity: Partial<Params>) => apiClient.post<ApiResponse<boolean>>('/api/params/update', entity),
  remove: (ids: string[]) => apiClient.post<ApiResponse<boolean>>('/api/params/delete', ids),
}

export const heartbeat = {
  nodes: () => apiClient.get<ApiResponse<NodeStatusVO[]>>('/api/heartbeat/nodes'),
  websocketNodes: () => apiClient.get<ApiResponse<WebSocketNodeVO[]>>('/api/heartbeat/websocket'),
}

export const storageProtocols = {
  page: (query: Record<string, unknown>) => apiClient.get<ApiResponse<{ records: StorageProtocol[]; total: number; current: number; size: number; pages: number }>>('/api/storage/page', { params: query }),
  save: (entity: Partial<StorageProtocol>) => apiClient.post<ApiResponse<boolean>>('/api/storage/add', entity),
  update: (entity: Partial<StorageProtocol>) => apiClient.post<ApiResponse<boolean>>('/api/storage/update', entity),
  remove: (ids: string[]) => apiClient.post<ApiResponse<boolean>>('/api/storage/delete', ids),
  /** 连通性验证：调用真实后端。 */
  validate: (query: Record<string, unknown>) => apiClient.get<ApiResponse<boolean>>('/api/storage/validSuccess', { params: query }),
}
