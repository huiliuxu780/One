import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServerVO, McpToolVO } from '@/types'
import { McpActivationStatus, McpFailureSource } from '@/types'
import { DebugDialog, ToolsDialog, mcpDebugFields } from './mcp-page'

const listTools = vi.fn()
const setGlobalEnabled = vi.fn()
const debugTool = vi.fn()

vi.mock('@/api/resources', () => ({
  mcpServers: {
    tools: (...args: unknown[]) => listTools(...args),
    setGlobalEnabled: (...args: unknown[]) => setGlobalEnabled(...args),
    debugTool: (...args: unknown[]) => debugTool(...args),
  },
}))

const server = {
  id: '9', name: '测试 Server', activationStatus: McpActivationStatus.ACTIVE,
  failureSource: McpFailureSource.NONE,
} as McpServerVO

const tool = {
  id: '42', mcpServerId: '9', toolName: 'search_tool', enabled: true, needConfirm: false, missing: false,
  description: '检索', inputSchema: { properties: { query: { type: 'string', description: '关键词' }, limit: { type: 'integer', default: 2 } }, required: ['query'] },
  outputSchema: null, sort: 0, lastDiscoveredAt: null, lastSeenAt: null,
} satisfies McpToolVO

function renderDialog(dialog: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{dialog}</QueryClientProvider>)
}

describe('MCP 工具治理协议', () => {
  beforeEach(() => {
    listTools.mockReset().mockResolvedValue({ data: { data: [tool] } })
    setGlobalEnabled.mockReset().mockResolvedValue({ data: { data: server } })
    debugTool.mockReset().mockResolvedValue({ data: { data: { success: true, content: { found: true }, durationMs: 12 } } })
  })

  it('全局开关提交工具记录 ID，且自动降级时只读', async () => {
    const view = renderDialog(<ToolsDialog server={server} onClose={vi.fn()} />)
    fireEvent.click(await screen.findByRole('switch', { name: 'search_tool 启用' }))
    await waitFor(() => expect(setGlobalEnabled).toHaveBeenCalledWith('9', ['42'], false))

    view.unmount()
    renderDialog(<ToolsDialog server={{ ...server, activationStatus: McpActivationStatus.FAILED, failureSource: McpFailureSource.RUNTIME_AUTO_DEGRADE }} onClose={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('只读')
    expect(await screen.findByRole('switch', { name: 'search_tool 启用' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '调试' })).toBeDisabled()
  })

  it('从输入 Schema 转换必填参数并使用 toolId/input 调试协议', async () => {
    expect(mcpDebugFields(tool.inputSchema)[0]).toEqual(expect.objectContaining({ name: 'query', required: true }))
    renderDialog(<DebugDialog tool={tool} onClose={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '执行调试' }))
    expect(debugTool).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('textbox', { name: /query/ }), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: '执行调试' }))

    await waitFor(() => expect(debugTool).toHaveBeenCalledWith('42', { query: 'hello', limit: 2 }))
    expect(await screen.findByText('成功 · 12 ms')).toBeInTheDocument()
  })
})
