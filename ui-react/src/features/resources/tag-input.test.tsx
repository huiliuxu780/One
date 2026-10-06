import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useState } from 'react'
import { TagInput } from './tag-input'

describe('TagInput', () => {
  it('keeps the unfinished token after a comma and commits tags independently', () => {
    const changes = vi.fn()
    function Host() {
      const [tags, setTags] = useState<string[]>([])
      return <TagInput id="words" value={tags} onChange={(next) => { changes(next); setTags(next) }} />
    }
    render(<Host />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'alpha, be' } })
    expect(changes).toHaveBeenLastCalledWith(['alpha'])
    expect(input).toHaveValue(' be')
    fireEvent.change(input, { target: { value: ' beta' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(changes).toHaveBeenLastCalledWith(['alpha', 'beta'])
    expect(screen.getByRole('button', { name: '删除 beta' })).toBeInTheDocument()
  })
})
