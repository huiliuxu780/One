import type { ApiResponse, JobInfo } from '@/types'
import { apiClient } from './client'

interface JobPageResponse {
  records: JobInfo[]
  total: number
  current: number
  size: number
  pages: number
}

interface JobRecordsResponse {
  records: Record<string, unknown>[]
  total: number
  current: number
  size: number
  pages: number
}

export function pageJobs(params: Record<string, unknown>) {
  return apiClient.get<ApiResponse<JobPageResponse>>('/api/runtime/job/page', { params })
}

export function addJob(jobInfo: Partial<JobInfo>) {
  return apiClient.post<ApiResponse<boolean>>('/api/runtime/job/add', jobInfo)
}

export function updateJob(jobInfo: Partial<JobInfo>) {
  return apiClient.post<ApiResponse<boolean>>('/api/runtime/job/update', jobInfo)
}

export function deleteJob(id: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/delete', { params: { id } })
}

export function toggleJob(id: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/toggle', { params: { id } })
}

export function startJob(id: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/start', { params: { id } })
}

export function stopJob(id: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/stop', { params: { id } })
}

export function triggerJob(id: string) {
  return apiClient.get<ApiResponse<boolean>>('/api/runtime/job/trigger', { params: { id } })
}

export function getRecords(jobId: string, page = 1, size = 50) {
  return apiClient.get<ApiResponse<JobRecordsResponse>>('/api/runtime/job/records', { params: { jobId, page, size } })
}

export function getJobById(id: string) {
  return apiClient.get<ApiResponse<JobInfo>>(`/api/runtime/job/${id}`)
}
