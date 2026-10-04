import type { ApiResponse, LoginRequest, LoginResponse } from '@/types'
import { apiClient } from './client'

export function login(data: LoginRequest) {
  return apiClient.post<ApiResponse<LoginResponse>>('/api/auth/login', data)
}

export function logout() {
  return apiClient.post<ApiResponse<void>>('/api/auth/logout')
}
