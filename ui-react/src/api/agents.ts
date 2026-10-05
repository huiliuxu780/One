import type { AgentA2A, AgentDefinitionDTO, AgentDefinitionVO, AgentStatisticsVO, ApiResponse, JobInfo, PageResult } from '@/types'
import { apiClient } from './client'

export function pageAgents(query: AgentDefinitionDTO) {
  return apiClient.get<ApiResponse<PageResult<AgentDefinitionVO>>>('/api/agent/definition/page', {
    params: query,
  })
}

export function listAgentTags() {
  return apiClient.get<ApiResponse<string[]>>('/api/agent/definition/get/tags')
}

export function getAgent(id: string) {
  return apiClient.get<ApiResponse<AgentDefinitionVO>>(`/api/agent/definition/${id}`)
}

export function getAgentAllowedFileTypes(id: string) {
  return apiClient.get<ApiResponse<string[]>>(`/api/agent/definition/${id}/allow/file-type`)
}

export function createAgent(vo: Partial<AgentDefinitionVO>) {
  return apiClient.post<ApiResponse<AgentDefinitionVO>>('/api/agent/definition', vo)
}

export function updateAgent(vo: Partial<AgentDefinitionVO>) {
  return apiClient.put<ApiResponse<boolean>>('/api/agent/definition', vo)
}

export function removeAgents(ids: string[]) {
  return apiClient.delete<ApiResponse<boolean>>('/api/agent/definition', { data: ids })
}

/** 删除/变更前占用检查：返回引用该 Agent 的使用方列表。 */
export function usedWithAgent(ids: string[]) {
  return apiClient.post<ApiResponse<unknown[]>>('/api/agent/definition/used-with-agent', ids)
}

export function getA2aConfig(agentId: string) {
  return apiClient.get<ApiResponse<AgentA2A>>(`/api/agentA2a/${agentId}`)
}

export function saveA2aConfig(data: AgentA2A) {
  return apiClient.post<ApiResponse<boolean>>('/api/agentA2a', data)
}

export function getAgentChatKey(agentId: string, refresh = false) {
  return apiClient.get<ApiResponse<string>>(`/api/agent/chat-key/${agentId}`, { params: { refresh } })
}

export function getAgentTrends(agentId: string, days: number) {
  return apiClient.get<ApiResponse<AgentStatisticsVO>>(`/api/agent/statistics/${agentId}/trends`, { params: { days } })
}

export function getAgentJob(agentId: string) {
  return apiClient.get<ApiResponse<JobInfo | null>>('/api/runtime/job/getByBizId', { params: { bizId: agentId } })
}

export function addAgentJob(job: JobInfo) {
  return apiClient.post<ApiResponse<boolean>>('/api/runtime/job/add', job)
}

export function updateAgentJob(job: JobInfo) {
  return apiClient.post<ApiResponse<boolean>>('/api/runtime/job/update', job)
}

export function deleteAgentJob(agentId: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/deleteByBizId', { params: { bizId: agentId } })
}
