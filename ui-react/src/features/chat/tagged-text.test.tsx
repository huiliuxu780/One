import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TaggedText } from './tagged-text'

describe('TaggedText', () => {
  it('opens workspace file tags while keeping tool and skill tags non-interactive', () => {
    const open = vi.fn()
    render(<TaggedText content="看 <workspace-file>data/report.md</workspace-file> 用 <agent-tool>search</agent-tool>" onWorkspaceFileClick={open} />)
    fireEvent.click(screen.getByRole('button', { name: /report\.md/ }))
    expect(open).toHaveBeenCalledWith('data/report.md')
    expect(screen.getByRole('button', { name: /search/ })).toBeDisabled()
  })
})
