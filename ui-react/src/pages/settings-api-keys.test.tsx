import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiKeysTab } from './settings-page'

const list = vi.fn()
const create = vi.fn()

vi.mock('@/api/settings', () => ({
  accounts: {},
  secretKeys: {
    list: (...args: unknown[]) => list(...args),
    create: (...args: unknown[]) => create(...args),
  },
  systemParams: {},
}))

describe('API Key 创建表单', () => {
  beforeEach(() => {
    list.mockReset().mockResolvedValue({ data: { data: [] } })
    create.mockReset().mockResolvedValue({ data: { data: { value: 'sk-one-time-value' } } })
  })

  it('提交过期时间和备注，完整密钥在可关闭弹窗内保留', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><ApiKeysTab /></QueryClientProvider>)

    fireEvent.change(screen.getByRole('textbox', { name: '新密钥名称' }), { target: { value: '验收密钥' } })
    fireEvent.change(screen.getByLabelText('过期时间'), { target: { value: '2027-10-06T10:30' } })
    fireEvent.change(screen.getByRole('textbox', { name: '密钥备注' }), { target: { value: '接口测试' } })
    fireEvent.click(screen.getByRole('button', { name: '创建密钥' }))

    await waitFor(() => expect(create).toHaveBeenCalledWith({ name: '验收密钥', remark: '接口测试', expireTime: '2027-10-06 10:30:00' }))
    expect(await screen.findByRole('dialog', { name: 'API Key 已创建' })).toHaveTextContent('sk-one-time-value')
    fireEvent.click(screen.getByText('关闭'))
    await waitFor(() => expect(screen.queryByText('sk-one-time-value')).not.toBeInTheDocument())
  })
})
