import type { ApiResponse } from '@/types'
import { apiClient } from './client'

export function uploadAttachment(file: File, onProgress?: (percent: number) => void) {
  const formData = new FormData()
  formData.append('file', file)
  return apiClient.post<ApiResponse<string>>('/api/attach/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100))
    },
  })
}

export function parseAttachmentText(id: string) {
  return apiClient.post<ApiResponse<boolean>>(`/api/runtime/parse-text/${id}`)
}

export function deleteAttachments(ids: string[]) {
  return apiClient.post<ApiResponse<boolean>>('/api/attach/delete', ids)
}

export function downloadAttachment(id: string) {
  return apiClient.get<Blob>(`/api/attach/download/${id}`, { responseType: 'blob' })
}
