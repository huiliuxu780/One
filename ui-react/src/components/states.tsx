import type { ReactNode } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiClientError, toApiClientError } from '@/api/client'

export function PageLoading({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="grid min-h-[40dvh] place-items-center gap-3 text-sm text-muted-foreground" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" aria-hidden />
        {label}
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 py-2" aria-hidden>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-[30dvh] place-items-center px-6 text-center">
      <div className="max-w-sm space-y-2">
        <div className="text-sm font-medium">{title}</div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {action ? <div className="pt-2">{action}</div> : null}
      </div>
    </div>
  )
}

/** 列表/详情查询失败态：展示可读错误与请求关联 ID，支持重试。 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = toApiClientError(error)
  return (
    <div className="grid min-h-[30dvh] place-items-center px-6 text-center">
      <div className="max-w-md space-y-3">
        <div className="text-sm font-medium text-destructive">加载失败</div>
        <p className="break-all text-sm text-muted-foreground">{apiError.message}</p>
        {apiError.requestId ? (
          <p className="font-mono text-xs text-muted-foreground">请求关联 ID：{apiError.requestId}</p>
        ) : null}
        {onRetry ? (
          <Button variant="outline" onClick={onRetry}>
            <ArrowClockwise size={14} /> 重试
          </Button>
        ) : null}
      </div>
    </div>
  )
}

/** 403 时展示的只读提示，避免 viewer 角色看到空白页。 */
export function PermissionDeniedState({ capability }: { capability?: string }) {
  return (
    <EmptyState
      title="没有访问权限"
      description={capability ? `当前角色缺少能力：${capability}。如需操作请联系组织管理员。` : '当前角色无权访问该页面。'}
    />
  )
}

export { ApiClientError }
