import { afterEach, describe, expect, it, vi } from 'vitest'
import { AgentClient } from './agent-client'

afterEach(() => {
  vi.unstubAllGlobals()
})

function eventStream(event: Record<string, unknown>) {
  const bytes = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`)
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

describe('AgentClient run URL', () => {
  it('只追加一次编码后的 agentCode，并发送 thread header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(eventStream({ type: 'RUN_FINISHED', threadId: 'thread-1', runId: 'run-1' }), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const client = new AgentClient('/api/runtime/agui/run')

    await client.run({ threadId: 'thread-1', forwardedProps: { agentCode: 'agent/demo' } })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/runtime/agui/run/agent%2Fdemo')
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).toMatchObject({
      'X-Apboa-Thread-Id': 'thread-1',
    })
  })

  it('缺少 agentCode 时在发请求前失败', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const client = new AgentClient('/api/runtime/agui/run')
    const errors: string[] = []
    client.handlers.onRunError = (event) => errors.push(event.message)

    await client.run({ threadId: 'thread-1' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(errors).toEqual(['运行请求缺少 agentCode'])
  })
})
