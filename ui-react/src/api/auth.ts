import type { ApiResponse, ChangePasswordRequest, LoginRequest, LoginResponse, UpdateProfileRequest } from '@/types'
import { apiClient } from './client'

export function login(data: LoginRequest) {
  return apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', data)
}

export function logout() {
  return apiClient.post<ApiResponse<void>>('/api/auth/logout')
}

export function changePassword(data: ChangePasswordRequest) {
  return apiClient.post<ApiResponse<boolean>>('/api/auth/change-password', data)
}

export function updateProfile(data: UpdateProfileRequest) {
  return apiClient.post<ApiResponse<boolean>>('/api/auth/update-profile', data)
}

/** 通过 ChatKey 换取会话令牌（对外分享入口）。 */
export function chatKeyToken(chatKey: string) {
  return apiClient.post<ApiResponse<LoginResponse>>(`/api/auth/chat-key-token/${chatKey}`)
}
