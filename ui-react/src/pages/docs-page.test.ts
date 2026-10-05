import { describe, expect, it } from 'vitest'
import { docSections } from './docs-page'

describe('React help center scope', () => {
  it('migrates the legacy documentation sections without restoring the excluded knowledge base entry', () => {
    expect(docSections.length).toBeGreaterThanOrEqual(13)
    expect(docSections.map((section) => section.slug)).not.toContain('knowledge')
    expect(docSections.flatMap((section) => [section.label, section.summary]).join(' ')).not.toContain('知识库')
  })
})
