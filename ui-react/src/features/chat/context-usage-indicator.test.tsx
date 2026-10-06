import { describe, expect, it } from 'vitest'
import { contextUsagePresentation } from './context-usage-indicator'
import type { ContextUsageEvent } from '@/types/agui'

const usage: ContextUsageEvent['value'] = {
  usedTokens: 6_100,
  totalTokens: 10_000,
  tokenThreshold: 8_000,
  messageCount: 12,
  messageThreshold: 20,
  tokenPressure: 0.61,
  messagePressure: 0.6,
  compressionPressure: 0.61,
  ratio: 0.61,
  triggerReason: 'TOKEN',
  phase: 'RUN',
}

describe('contextUsagePresentation', () => {
  it.each([
    [0.2, '#22a06b'],
    [0.6, '#eab308'],
    [0.75, '#f97316'],
    [0.9, '#ef4444'],
  ])('uses the Vue-compatible pressure color at %s', (compressionPressure, color) => {
    expect(contextUsagePresentation({ ...usage, compressionPressure }, null)).toMatchObject({
      percentage: Math.round(compressionPressure * 100),
      color,
      compressing: false,
    })
  })

  it('shows compression state and complete tooltip details', () => {
    const result = contextUsagePresentation({ ...usage, triggerReason: 'MESSAGE' }, 'STARTED')
    expect(result.color).toBe('#f59e0b')
    expect(result.compressing).toBe(true)
    expect(result.lines).toEqual([
      '记忆压缩中…',
      'Token: 6,100 / 8,000',
      '消息: 12 / 20',
      '上限: 10,000 tokens',
      '触发因素: 消息数量',
    ])
  })
})
