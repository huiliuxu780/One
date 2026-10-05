import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MarkdownLite } from './markdown-lite'

describe('MarkdownLite protocol blocks', () => {
  it('renders VEP cards without injecting raw HTML', () => {
    render(<MarkdownLite content={'```vep\n{"vision":{"type":"card","title":"运行摘要","data":[{"label":"成功","value":3,"unit":"次"}]}}\n```'} />)
    expect(screen.getByText('运行摘要')).toBeInTheDocument()
    expect(screen.getByText('成功')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('submits UIP confirmations once with a natural language continuation', () => {
    const submit = vi.fn()
    const code = '{"interaction":{"id":"confirm-1","type":"confirm","message":"继续执行？"}}'
    render(<MarkdownLite content={`\`\`\`uip\n${code}\n\`\`\``} onInteraction={submit} />)
    fireEvent.click(screen.getByRole('button', { name: '确认' }))
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ interactionId: 'confirm-1', type: 'confirm', userText: '已确认', data: { confirmed: true } }))
    expect(screen.queryByRole('button', { name: '确认' })).not.toBeInTheDocument()
  })

  it('keeps UIP interactions read-only when disabled', () => {
    const code = '{"interaction":{"id":"confirm-2","type":"confirm","message":"危险操作"}}'
    render(<MarkdownLite content={`\`\`\`apip\n${code}\n\`\`\``} disabled />)
    expect(screen.getByRole('button', { name: '确认' })).toBeDisabled()
  })
})
