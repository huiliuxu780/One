import type { AgentDefinitionDTO, AgentDefinitionVO, ApiResponse, PageResult } from '@/types'
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
