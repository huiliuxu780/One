import type { AgentA2A, AgentDefinitionDTO, AgentDefinitionVO, ApiResponse, PageResult } from '@/types'
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
