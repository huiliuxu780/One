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

  it('renders GFM tables, lists and headings', () => {
    render(<MarkdownLite content={'### 结论\n\n| 节点 | 状态 |\n| --- | --- |\n| Agent | SUCCESS |\n\n- 第一项\n- 第二项'} />)
    expect(screen.getByRole('columnheader', { name: '节点' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'SUCCESS' })).toBeInTheDocument()
    expect(screen.getByText('第一项')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: '结论' })).toBeInTheDocument()
  })

  it('strips javascript: URLs while keeping http links', () => {
    render(<MarkdownLite content={'[安全链接](https://example.com) 与 [危险链接](javascript:alert(1))'} />)
    const safe = screen.getByRole('link', { name: '安全链接' })
    expect(safe).toHaveAttribute('href', 'https://example.com')
    expect(safe).toHaveAttribute('target', '_blank')
    expect(screen.queryByRole('link', { name: '危险链接' })).not.toBeInTheDocument()
    expect(screen.getByText('危险链接')).toBeInTheDocument()
  })

  it('keeps headings and tables outside fenced code blocks intact', () => {
    render(<MarkdownLite content={'前文\n\n```text\n| 不是表格 |\n```\n\n| 真表格 |\n| --- |'} />)
    expect(screen.getByRole('columnheader', { name: '真表格' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: '不是表格' })).not.toBeInTheDocument()
  })
})
