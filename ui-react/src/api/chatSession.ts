import type {
  ApiResponse,
  ChatMessageAppendDTO,
  ChatMessageVO,
  ChatSessionCreateDTO,
  ChatSessionQueryDTO,
  ChatSessionVO,
  PageResult,
} from '@/types'
import { apiClient } from './client'

const BASE = '/api/agent/chat/session'

export function createSession(dto: ChatSessionCreateDTO) {
  return apiClient.post<ApiResponse<ChatSessionVO>>(BASE, dto)
}

export function appendMessage(sessionId: string, dto: ChatMessageAppendDTO) {
  return apiClient.post<ApiResponse<ChatMessageVO>>(`${BASE}/${sessionId}/message`, dto)
}

export function regenerateMessage(sessionId: string, dto: ChatMessageAppendDTO) {
  return apiClient.post<ApiResponse<ChatMessageVO>>(`${BASE}/${sessionId}/regenerate`, dto)
}

export function switchCurrentMessage(sessionId: string, messageId: string) {
  return apiClient.put<ApiResponse<unknown>>(`${BASE}/${sessionId}/current`, null, { params: { messageId } })
}

export function getCurrentMessages(sessionId: string) {
  return apiClient.get<ApiResponse<ChatMessageVO[]>>(`${BASE}/${sessionId}/messages/current`)
}

export function getCurrentMessagesPaged(sessionId: string, query: { beforeDepth?: number; size?: number }) {
  return apiClient.get<ApiResponse<{ messages: ChatMessageVO[]; hasMore: boolean; nextBeforeDepth: number | null }>>(
    `${BASE}/${sessionId}/messages/paged`,
    { params: query },
  )
}

export function getMessageTree(sessionId: string) {
  return apiClient.get<ApiResponse<ChatMessageVO[]>>(`${BASE}/${sessionId}/messages/tree`)
}

export function listSessions(query?: ChatSessionQueryDTO) {
  return apiClient.get<ApiResponse<ChatSessionVO[]>>(`${BASE}/list`, { params: query })
}

export function pageSessions(query?: ChatSessionQueryDTO) {
  return apiClient.get<ApiResponse<PageResult<ChatSessionVO>>>(`${BASE}/page`, { params: query })
}

export function getSessionDetail(id: string) {
  return apiClient.get<ApiResponse<ChatSessionVO>>(`${BASE}/${id}`)
}

export function pinSession(id: string) {
  return apiClient.put<ApiResponse<unknown>>(`${BASE}/${id}/pin`)
}

export function unpinSession(id: string) {
  return apiClient.put<ApiResponse<unknown>>(`${BASE}/${id}/unpin`)
}

export function updateSessionTitle(id: string, title: string) {
  return apiClient.put<ApiResponse<unknown>>(`${BASE}/${id}/title`, null, { params: { title } })
}

export function updateCurrentMessageContent(sessionId: string, content: string) {
  return apiClient.put<ApiResponse<unknown>>(`${BASE}/${sessionId}/current-message/content`, { content })
}

export function deleteSession(id: string) {
  return apiClient.delete<ApiResponse<unknown>>(`${BASE}/${id}`)
}
