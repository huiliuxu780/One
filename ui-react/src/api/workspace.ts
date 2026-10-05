import type { ApiResponse, WorkspaceCapacityVO, WorkspaceFileNode } from '@/types'
import { apiClient } from './client'

const BASE = '/api/runtime/workspace'

export function upload(sessionId: string, file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post<ApiResponse<string>>(`${BASE}/upload`, formData, {
    params: { sessionId },
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
}

export function uploadBatch(sessionId: string, files: File[]) {
  const formData = new FormData()
  files.forEach((file) => formData.append('files', file))
  return apiClient.post<ApiResponse<string[]>>(`${BASE}/upload/batch`, formData, { params: { sessionId } })
}

export function uploadArchive(sessionId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post<ApiResponse<string[]>>(`${BASE}/upload/archive`, formData, { params: { sessionId } })
}

export function listFiles(sessionId: string) {
  return apiClient.get<ApiResponse<WorkspaceFileNode[]>>(`${BASE}/files`, { params: { sessionId } })
}

export function downloadFile(sessionId: string, fileName: string) {
  return apiClient.get(`${BASE}/download`, { params: { sessionId, fileName }, responseType: 'blob' })
}

export function downloadBatch(sessionId: string, filePaths: string[]) {
  return apiClient.post(`${BASE}/download/batch`, filePaths, { params: { sessionId }, responseType: 'blob' })
}

export function downloadAll(sessionId: string) {
  return apiClient.get(`${BASE}/download/all`, { params: { sessionId }, responseType: 'blob' })
}

export function deleteFile(sessionId: string, filePath: string) {
  return apiClient.delete<ApiResponse<void>>(`${BASE}/file`, { params: { sessionId, filePath } })
}

export function clearWorkspace(sessionId: string) {
  return apiClient.delete<ApiResponse<void>>(`${BASE}/clear`, { params: { sessionId } })
}

export function getCapacity(sessionId: string) {
  return apiClient.get<ApiResponse<WorkspaceCapacityVO>>(`${BASE}/capacity`, { params: { sessionId } })
}

export function workspaceExists(sessionId: string) {
  return apiClient.get<ApiResponse<boolean>>(`${BASE}/exists`, { params: { sessionId } })
}
