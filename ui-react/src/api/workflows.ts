import type { ApiResponse, NodeMetadata, PageResult, Workflow, WorkflowDetail, WorkflowNodeExecution, WorkflowNodeRunRequest, WorkflowNodeRunResult, WorkflowRun, WorkflowRunRequest, WorkflowRunResult, WorkflowValidationResult, WorkflowVersion } from '@/types'
import { apiClient } from './client'

export function pageWorkflows(query: Record<string, unknown>) {
  return apiClient.get<ApiResponse<PageResult<Workflow>>>('/api/workflow/page', { params: query })
}

export function getWorkflow(id: string) {
  return apiClient.get<ApiResponse<WorkflowDetail>>(`/api/workflow/${id}`)
}

export function createWorkflow(entity: Partial<Workflow>) {
  return apiClient.post<ApiResponse<Workflow>>('/api/workflow', entity)
}

export function updateWorkflow(entity: Partial<Workflow>) {
  return apiClient.put<ApiResponse<boolean>>('/api/workflow', entity)
}

/** 删除（force=1 为强制删除，仍需确认） */
export function removeWorkflows(ids: string[], force = 0) {
  return apiClient.delete<ApiResponse<boolean>>(`/api/workflow/${force}`, { data: ids })
}

export function usedWithAgent(ids: string[]) {
  return apiClient.post<ApiResponse<unknown[]>>('/api/workflow/used-with-agent', ids)
}

export function copyWorkflow(id: string) {
  return apiClient.post<ApiResponse<Workflow>>(`/api/workflow/${id}/copy`)
}

export function setWorkflowLock(id: string, locked: number) {
  return apiClient.put<ApiResponse<boolean>>(`/api/workflow/${id}/lock/${locked}`)
}

export function validateWorkflow(id: string) {
  return apiClient.post<ApiResponse<WorkflowValidationResult>>(`/api/workflow/${id}/validate`)
}

export function publishWorkflow(id: string, remark: string) {
  return apiClient.post<ApiResponse<WorkflowVersion>>(`/api/workflow/${id}/publish`, null, { params: { remark } })
}

export function listVersions(id: string) {
  return apiClient.get<ApiResponse<WorkflowVersion[]>>(`/api/workflow/${id}/versions`)
}

export function removeVersion(id: string, version: string) {
  return apiClient.delete<ApiResponse<boolean>>(`/api/workflow/${id}/versions/${version}`)
}

export function pageRuns(query: Record<string, unknown>) {
  return apiClient.get<ApiResponse<PageResult<WorkflowRun>>>('/api/workflow/runs/page', { params: query })
}

export function runDetail(runId: string) {
  return apiClient.get<ApiResponse<WorkflowRun>>(`/api/workflow/runs/${runId}`)
}

export function runNodes(runId: string) {
  return apiClient.get<ApiResponse<WorkflowNodeExecution[]>>(`/api/workflow/runs/${runId}/nodes`)
}

export function debugRun(id: string, payload: WorkflowRunRequest) {
  return apiClient.post<ApiResponse<WorkflowRunResult>>(`/api/runtime/workflow/${id}/debug-run`, payload)
}

export function formalRun(id: string, payload: WorkflowRunRequest) {
  return apiClient.post<ApiResponse<WorkflowRunResult>>(`/api/runtime/workflow/${id}/run`, payload)
}

export function debugNode(payload: WorkflowNodeRunRequest) {
  return apiClient.post<ApiResponse<WorkflowNodeRunResult>>('/api/runtime/workflow/debug-node-run', payload)
}

export function nodeMetadata() {
  return apiClient.get<ApiResponse<NodeMetadata[]>>('/api/workflow/node-metadata')
}
