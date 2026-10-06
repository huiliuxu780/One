import { CircleNotch } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ContextCompressionEvent, ContextUsageEvent } from '@/types/agui'
import { cn } from '@/lib/utils'

type Usage = ContextUsageEvent['value']
type CompressionStatus = ContextCompressionEvent['value']['status'] | null

export function contextUsagePresentation(usage: Usage, compression: CompressionStatus) {
  const rawRatio = usage.compressionPressure ?? usage.ratio ?? 0
  const ratio = Math.min(1, Math.max(0, rawRatio > 1 ? rawRatio / 100 : rawRatio))
  const percentage = Math.round(ratio * 100)
  const compressing = compression === 'STARTED'
  const color = compressing
    ? '#f59e0b'
    : percentage >= 90
      ? '#ef4444'
      : percentage >= 75
        ? '#f97316'
        : percentage >= 60
          ? '#eab308'
          : '#22a06b'
  const triggerReason = usage.triggerReason === 'MESSAGE' ? '消息数量' : 'Token 数量'
  const tokenThreshold = usage.tokenThreshold ?? usage.totalTokens

  return {
    color,
    compressing,
    percentage,
    lines: [
      compressing ? '记忆压缩中…' : `压缩压力 ${percentage}%`,
      `Token: ${usage.usedTokens.toLocaleString()} / ${tokenThreshold.toLocaleString()}`,
      `消息: ${usage.messageCount.toLocaleString()} / ${usage.messageThreshold.toLocaleString()}`,
      `上限: ${usage.totalTokens.toLocaleString()} tokens`,
      `触发因素: ${triggerReason}`,
    ],
  }
}

export function ContextUsageIndicator({ usage, compression }: { usage: Usage; compression: CompressionStatus }) {
  const presentation = contextUsagePresentation(usage, compression)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="status"
          aria-label={`上下文压缩压力 ${presentation.percentage}%${presentation.compressing ? '，记忆压缩中' : ''}`}
          className={cn('relative ml-auto inline-flex size-7 shrink-0 cursor-help items-center justify-center rounded-full text-[9px] font-semibold', presentation.compressing && 'animate-pulse')}
          style={{ color: presentation.color, background: `conic-gradient(${presentation.color} ${presentation.percentage}%, var(--muted) 0)` }}
        >
          <span className="absolute inset-[3px] rounded-full bg-background" />
          {presentation.compressing
            ? <CircleNotch size={13} className="relative z-10 animate-spin" />
            : <span className="relative z-10">{presentation.percentage}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="space-y-1 py-2">
        {presentation.lines.map((line) => <div key={line} className="whitespace-nowrap border-b border-white/10 pb-1 last:border-0 last:pb-0">{line}</div>)}
      </TooltipContent>
    </Tooltip>
  )
}
