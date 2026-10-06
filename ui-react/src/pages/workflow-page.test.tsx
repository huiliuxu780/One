import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkflowPage } from './workflow-page'

const createWorkflow = vi.fn()
const updateWorkflow = vi.fn()
const setFilter = vi.fn()

vi.mock('@/api/workflows', () => ({
  createWorkflow: (...args: unknown[]) => createWorkflow(...args),
  updateWorkflow: (...args: unknown[]) => updateWorkflow(...args),
  usedWithAgent: vi.fn(),
  removeWorkflows: vi.fn(),
  copyWorkflow: vi.fn(),
  setWorkflowLock: vi.fn(),
}))

vi.mock('@/features/data/paged', () => ({
  usePagedList: () => ({
    data: {
      records: [{ id: 'workflow-42', name: '验收工作流', remark: '原描述', status: 'DRAFT', version: 1, locked: false }],
      total: 1,
    },
    isLoading: false,
    error: null,
    page: 1,
    size: 10,
    setPage: vi.fn(),
    setSize: vi.fn(),
    refetch: vi.fn(),
    setFilter,
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
    updateWorkflow.mockReset().mockResolvedValue({ data: { data: true } })
    setFilter.mockReset()
  })

  it('通过 React Router 打开已有工作流，不丢失 /react basename', () => {
    renderWorkflow()
    fireEvent.click(screen.getByRole('button', { name: /设计/ }))
    expect(screen.getByText('已进入工作流编辑器')).toBeInTheDocument()
  })

  it('创建成功后通过 React Router 进入编辑器', async () => {
    renderWorkflow()
    fireEvent.click(screen.getByRole('button', { name: /新建工作流/ }))
    fireEvent.change(screen.getByLabelText('工作流名称 *'), { target: { value: '新流程' } })
    fireEvent.click(screen.getByRole('button', { name: '创建并设计' }))
    await waitFor(() => expect(screen.getByText('已进入工作流编辑器')).toBeInTheDocument())
    expect(createWorkflow).toHaveBeenCalledOnce()
    expect(createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ name: '新流程', config: expect.objectContaining({ nodes: expect.arrayContaining([expect.objectContaining({ type: 'START' }), expect.objectContaining({ type: 'END' })]) }) }))
  })

  it('信息编辑仅提交元数据，不改写画布定义', async () => {
    renderWorkflow()
    fireEvent.click(screen.getByRole('button', { name: '编辑信息' }))
    fireEvent.change(screen.getByLabelText('描述信息'), { target: { value: '新描述' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledWith({ id: 'workflow-42', name: '验收工作流', remark: '新描述' }))
  })
})
