import type {
  ApiResponse,
  CheckModelResult,
  CodeExecutionConfig,
  HookConfigVO,
  LongTermMemoryConfig,
  McpServerVO,
  McpToolDebugResultVO,
  McpToolVO,
  ModelConfigVO,
  ModelProviderVO,
  PageResult,
  SensitiveWordConfigVO,
  SkillFileTreeNode,
  SkillImportResult,
  SkillPackageVO,
  SkillsHubVO,
  StudioConfig,
  SystemPromptTemplateVO,
  ToolVO,
} from '@/types'
import { apiClient } from './client'

type Query = Record<string, unknown>

function page<T>(url: string, query: Query) {
  return apiClient.get<ApiResponse<PageResult<T>>>(url, { params: query })
}
function get<T>(url: string) {
  return apiClient.get<ApiResponse<T>>(url)
}
function post<T>(url: string, body?: unknown) {
  return apiClient.post<ApiResponse<T>>(url, body ?? {})
}
function put<T>(url: string, body?: unknown) {
  return apiClient.put<ApiResponse<T>>(url, body ?? {})
}
function del(url: string, ids: string[]) {
  return apiClient.delete<ApiResponse<boolean>>(url, { data: ids })
}

/** 模型供应商 */
export const modelProviders = {
  page: (query: Query) => page<ModelProviderVO>('/api/model/provider/page', query),
  detail: (id: string) => get<ModelProviderVO>(`/api/model/provider/${id}`),
  save: (entity: Partial<ModelProviderVO>) => post<boolean>('/api/model/provider', entity),
  update: (entity: Partial<ModelProviderVO>) => put<boolean>('/api/model/provider', entity),
  remove: (ids: string[]) => del('/api/model/provider', ids),
  usedWithModel: (ids: string[]) => post<unknown[]>('/api/model/provider/used-with-model', ids),
}

/** 模型配置 */
export const modelConfigs = {
  page: (query: Query) => page<ModelConfigVO>('/api/model/config/page', query),
  detail: (id: string) => get<ModelConfigVO>(`/api/model/config/${id}`),
  save: (entity: Partial<ModelConfigVO>) => post<string>('/api/model/config', entity),
  update: (entity: Partial<ModelConfigVO>) => put<string>('/api/model/config', entity),
  remove: (ids: string[]) => del('/api/model/config', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/model/config/used-with-agent', ids),
  check: (modelId: string) => get<CheckModelResult>(`/api/runtime/model/config/check/${modelId}`),
}

/** 工具 */
export const tools = {
  page: (query: Query) => page<ToolVO>('/api/tool/page', query),
  detail: (id: string) => get<ToolVO>(`/api/tool/${id}`),
  categories: () => get<string[]>('/api/tool/get/categories'),
  save: (entity: Partial<ToolVO>) => post<boolean>('/api/tool', entity),
  update: (entity: Partial<ToolVO>) => put<boolean>('/api/tool', entity),
  remove: (ids: string[]) => del('/api/tool', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/tool/used-with-agent', ids),
  debug: (toolName: string, args: Record<string, unknown>) => post<unknown>(`/api/runtime/tool/${encodeURIComponent(toolName)}/do`, args),
}

/** 技能包 */
export const skills = {
  page: (query: Query) => page<SkillPackageVO>('/api/skill/page', query),
  detail: (id: string) => get<SkillPackageVO>(`/api/skill/${id}`),
  categories: () => get<string[]>('/api/skill/get/categories'),
  save: (entity: Partial<SkillPackageVO>) => post<number>('/api/skill', entity),
  update: (entity: Partial<SkillPackageVO>) => put<boolean>('/api/skill', entity),
  updateAlias: (id: string, alias: string) =>
    apiClient.put<ApiResponse<boolean>>(`/api/skill/${id}/alias`, null, { params: { alias } }),
  updateTools: (id: string, toolIds: string[]) => put<boolean>(`/api/skill/${id}/tools`, toolIds),
  remove: (ids: string[]) => del('/api/skill', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/skill/used-with-agent', ids),
  importLocal: (config: Record<string, unknown>) => post<SkillImportResult>('/api/skill/import/local', config),
  importGit: (config: Record<string, unknown>) => post<SkillImportResult>('/api/skill/import/git', config),
  importUpload: (formData: FormData) =>
    apiClient.post<ApiResponse<SkillImportResult>>('/api/skill/import/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  tree: (skillId: string) => get<SkillFileTreeNode[]>(`/api/skill/${skillId}/tree`),
  fileContent: (skillId: string, path: string) =>
    apiClient.get<ApiResponse<string>>(`/api/skill/${skillId}/file-content`, { params: { path } }),
  writeFile: (skillId: string, path: string, content: string) =>
    put<boolean>(`/api/skill/${skillId}/filesystem-write`, { path, content }),
  updateDbFile: (fileId: string, content: string) => put<boolean>(`/api/skill/files/${fileId}`, { content }),
  createFile: (skillId: string, data: { parentPath: string; fileName: string; content?: string }) =>
    post<SkillFileTreeNode>(`/api/skill/${skillId}/files`, data),
  createDirectory: (skillId: string, data: { parentPath: string; dirName: string }) =>
    post<boolean>(`/api/skill/${skillId}/directories`, data),
  deleteDbFile: (fileId: string) => apiClient.delete<ApiResponse<boolean>>(`/api/skill/files/${fileId}`),
  deleteFsNode: (skillId: string, data: { path: string; directory: boolean }) =>
    apiClient.delete<ApiResponse<boolean>>(`/api/skill/${skillId}/filesystem`, { data }),
  uploadFile: (skillId: string, parentPath: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('parentPath', parentPath)
    return apiClient.post<ApiResponse<SkillFileTreeNode>>(`/api/skill/${skillId}/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  allowedExtensions: () => get<string[]>('/api/skill/allowed-extensions'),
  downloadFile: (skillId: string, path: string) =>
    apiClient.get<Blob>(`/api/skill/${skillId}/download`, { params: { path }, responseType: 'blob' }),
  downloadZip: (skillId: string) =>
    apiClient.get<Blob>(`/api/skill/${skillId}/download-zip`, { responseType: 'blob' }),
  syncToFile: (skillId: string) => post<boolean>(`/api/skill/${skillId}/sync-to-file`),
}

export const skillHub = {
  search: (query: { keyword?: string; category?: string; source?: string; labels?: string; sortBy?: string; order?: string; page: number }) =>
    apiClient.get<ApiResponse<SkillsHubVO[]>>('/api/skill/hub/search', { params: query }),
  download: (slug: string, category: string) =>
    apiClient.get<ApiResponse<SkillImportResult>>('/api/skill/hub/download', { params: { slug, category } }),
}

/** MCP Server */
export const mcpServers = {
  page: (query: Query) => page<McpServerVO>('/api/mcp/server/page', query),
  detail: (id: string) => get<McpServerVO>(`/api/mcp/server/${id}`),
  save: (entity: Partial<McpServerVO>) => post<McpServerVO>('/api/mcp/server', entity),
  update: (entity: Partial<McpServerVO>) => put<McpServerVO>('/api/mcp/server', entity),
  activate: (id: string) => post<McpServerVO>(`/api/mcp/server/${id}/activate`),
  syncTools: (id: string) => post<McpServerVO>(`/api/mcp/server/${id}/sync-tools`),
  tools: (id: string) => get<McpToolVO[]>(`/api/mcp/server/${id}/tools`),
  setGlobalEnabled: (id: string, toolIds: string[], enabled: boolean) =>
    put<McpServerVO>(`/api/mcp/server/${id}/tools/global-enabled`, { toolIds, enabled }),
  setGlobalNeedConfirm: (id: string, toolIds: string[], needConfirm: boolean) =>
    put<McpServerVO>(`/api/mcp/server/${id}/tools/global-need-confirm`, { toolIds, needConfirm }),
  remove: (ids: string[]) => del('/api/mcp/server', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/mcp/server/used-with-agent', ids),
  debugTool: (toolId: string, input: Record<string, unknown>) =>
    post<McpToolDebugResultVO>('/api/mcp/server/tools/debug', { toolId, input }),
}

/** Hook */
export const hooks = {
  page: (query: Query) => page<HookConfigVO>('/api/hook-config/page', query),
  detail: (id: string) => get<HookConfigVO>(`/api/hook-config/${id}`),
  save: (entity: Partial<HookConfigVO>) => post<boolean>('/api/hook-config', entity),
  update: (entity: Partial<HookConfigVO>) => put<boolean>('/api/hook-config', entity),
  remove: (ids: string[]) => del('/api/hook-config', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/hook-config/used-with-agent', ids),
}

/** 提示词模板 */
export const prompts = {
  page: (query: Query) => page<SystemPromptTemplateVO>('/api/prompt/template/page', query),
  detail: (id: string) => get<SystemPromptTemplateVO>(`/api/prompt/template/${id}`),
  categories: () => get<string[]>('/api/prompt/template/get/categories'),
  save: (entity: Partial<SystemPromptTemplateVO>) => post<boolean>('/api/prompt/template', entity),
  update: (entity: Partial<SystemPromptTemplateVO>) => put<boolean>('/api/prompt/template', entity),
  remove: (ids: string[]) => del('/api/prompt/template', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/prompt/template/used-with-agent', ids),
}

/** 敏感词配置 */
export const sensitiveWords = {
  page: (query: Query) => page<SensitiveWordConfigVO>('/api/sensitive/config/page', query),
  detail: (id: string) => get<SensitiveWordConfigVO>(`/api/sensitive/config/${id}`),
  categories: () => get<string[]>('/api/sensitive/config/get/categories'),
  save: (entity: Partial<SensitiveWordConfigVO>) => post<boolean>('/api/sensitive/config', entity),
  update: (entity: Partial<SensitiveWordConfigVO>) => put<boolean>('/api/sensitive/config', entity),
  remove: (ids: string[]) => del('/api/sensitive/config', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/sensitive/config/used-with-agent', ids),
}

/** 长期记忆配置 */
export const longTermMemories = {
  list: () => get<LongTermMemoryConfig[]>('/api/long-term-memory/list'),
  detail: (id: string) => get<LongTermMemoryConfig>(`/api/long-term-memory/${id}`),
  save: (entity: Partial<LongTermMemoryConfig>) => post<boolean>('/api/long-term-memory', entity),
  update: (entity: Partial<LongTermMemoryConfig>) => put<boolean>('/api/long-term-memory', entity),
  remove: (ids: string[]) => del('/api/long-term-memory', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/long-term-memory/used-with-agent', ids),
}

/** 代码执行环境 */
export const codeExecutionConfigs = {
  list: () => get<CodeExecutionConfig[]>('/api/agent/code-execution/list'),
  detail: (id: string) => get<CodeExecutionConfig>(`/api/agent/code-execution/${id}`),
  save: (entity: Partial<CodeExecutionConfig>) => post<boolean>('/api/agent/code-execution', entity),
  update: (entity: Partial<CodeExecutionConfig>) => put<boolean>('/api/agent/code-execution', entity),
  remove: (ids: string[]) => del('/api/agent/code-execution', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/agent/code-execution/used-with-agent', ids),
}

/** Studio 配置 */
export const studios = {
  list: () => get<StudioConfig[]>('/api/studio/list'),
  detail: (id: string) => get<StudioConfig>(`/api/studio/${id}`),
  save: (entity: Partial<StudioConfig>) => post<boolean>('/api/studio', entity),
  update: (entity: Partial<StudioConfig>) => put<boolean>('/api/studio', entity),
  remove: (ids: string[]) => del('/api/studio', ids),
  usedWithAgent: (ids: string[]) => post<unknown[]>('/api/studio/used-with-agent', ids),
}
