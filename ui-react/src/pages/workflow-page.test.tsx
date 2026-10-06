import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowPage } from './workflow-page'

const createWorkflow = vi.fn()

vi.mock('@/api/workflows', () => ({
  createWorkflow: (...args: unknown[]) => createWorkflow(...args),
  usedWithAgent: vi.fn(),
  removeWorkflows: vi.fn(),
  copyWorkflow: vi.fn(),
  setWorkflowLock: vi.fn(),
}))

vi.mock('@/features/data/paged', () => ({
  usePagedList: () => ({
    data: {
      records: [{ id: 'workflow-42', name: '验收工作流', status: 'DRAFT', version: 1, locked: false }],
      total: 1,
    },
    isLoading: false,
    error: null,
    page: 1,
    size: 10,
    setPage: vi.fn(),
    setSize: vi.fn(),
    refetch: vi.fn(),
  }),
}))

function renderWorkflow(initialEntry = '/react/workflow') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter basename="/react" initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/workflow" element={<WorkflowPage />} />
          <Route path="/workflow/:id/edit" element={<p>已进入工作流编辑器</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('WorkflowPage basename navigation', () => {
  beforeEach(() => {
    createWorkflow.mockReset()
    createWorkflow.mockResolvedValue({ data: { data: { id: 'created-99' } } })
  })

  it('通过 React Router 打开已有工作流，不丢失 /react basename', () => {
    renderWorkflow()
    fireEvent.click(screen.getByRole('button', { name: /编辑/ }))
    expect(screen.getByText('已进入工作流编辑器')).toBeInTheDocument()
  })

  it('创建成功后通过 React Router 进入编辑器', async () => {
    renderWorkflow()
    fireEvent.click(screen.getByRole('button', { name: /新建工作流/ }))
    await waitFor(() => expect(screen.getByText('已进入工作流编辑器')).toBeInTheDocument())
    expect(createWorkflow).toHaveBeenCalledOnce()
  })
})
