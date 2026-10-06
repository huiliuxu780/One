import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OpsPage } from './ops-page'

const pageAttachments = vi.fn()
const pageAttachmentLogs = vi.fn()

vi.mock('@/features/auth/permissions', () => ({ usePermissions: () => ({ role: 'TENANT_ADMIN' }), roleSatisfies: () => true }))
vi.mock('@/api/settings', () => ({ heartbeat: {}, storageProtocols: {} }))
vi.mock('@/api/attach', () => ({
  pageAttachments: (...args: unknown[]) => pageAttachments(...args),
  pageAttachmentLogs: (...args: unknown[]) => pageAttachmentLogs(...args),
  batchDownloadAttachments: vi.fn(),
  deleteAttachments: vi.fn(),
  downloadAttachment: vi.fn(),
}))

function renderOps(tab: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/ops?tab=${tab}`]}><OpsPage /></MemoryRouter></QueryClientProvider>)
}

describe('运维列表分页协议', () => {
  beforeEach(() => {
    pageAttachments.mockReset().mockImplementation(async (query: { page: number }) => ({ data: { data: { records: [{ id: 'file-1', originalName: 'README.md' }], total: 25, size: 20, current: query.page } } }))
    pageAttachmentLogs.mockReset().mockImplementation(async (query: { page: number }) => ({ data: { data: { records: [{ id: 'log-1', originalName: 'README.md', optType: 'UPLOAD' }], total: 25, size: 20, current: query.page } } }))
  })

  it.each([['files', pageAttachments], ['logs', pageAttachmentLogs]])('%s 翻页发送后端识别的 page 参数', async (tab, request) => {
    renderOps(tab)
    fireEvent.click(await screen.findByRole('button', { name: /下一页/ }))
    await waitFor(() => expect(request).toHaveBeenCalledWith(expect.objectContaining({ page: 2, size: 20 })))
    expect(request.mock.lastCall?.[0]).not.toHaveProperty('current')
  })
})
