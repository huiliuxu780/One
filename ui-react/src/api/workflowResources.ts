import type { ApiResponse, PageResult, WorkflowManagedResource, WorkflowResourceKind, WorkflowResourceQuery } from '@/types'
import { apiClient } from './client'

const endpoints: Record<WorkflowResourceKind, string> = {
  datasource: '/api/datasource',
  cache: '/api/cache',
  mq: '/api/mq',
  channel: '/api/channel',
}

export function pageWorkflowResources(kind: WorkflowResourceKind, query: WorkflowResourceQuery) {
  return apiClient.get<ApiResponse<PageResult<WorkflowManagedResource>>>(`${endpoints[kind]}/page`, { params: query })
}

export function createWorkflowResource(kind: WorkflowResourceKind, entity: WorkflowManagedResource) {
  return apiClient.post<ApiResponse<boolean>>(endpoints[kind], entity)
}

export function updateWorkflowResource(kind: WorkflowResourceKind, entity: WorkflowManagedResource) {
  return apiClient.put<ApiResponse<boolean>>(endpoints[kind], entity)
}

export function removeWorkflowResources(kind: WorkflowResourceKind, ids: string[], force = 0) {
  return apiClient.delete<ApiResponse<boolean>>(`${endpoints[kind]}/${force}`, { data: ids })
}

export function enableWorkflowResource(kind: WorkflowResourceKind, id: string, enabled: boolean) {
  return apiClient.put<ApiResponse<boolean>>(`${endpoints[kind]}/${id}/enable/${enabled ? 1 : 0}`)
}

export function checkWorkflowResource(kind: WorkflowResourceKind, entity: WorkflowManagedResource) {
  return entity.id
    ? apiClient.post<ApiResponse<boolean>>(`${endpoints[kind]}/${entity.id}/check/connect`)
    : apiClient.post<ApiResponse<boolean>>(`${endpoints[kind]}/check/connect`, entity)
}
