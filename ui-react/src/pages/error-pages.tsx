import { ArrowLeft, Warning } from '@phosphor-icons/react'
import { Link, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ApiClientError, toApiClientError } from '@/api/client'

function shell(title: string, description: React.ReactNode, extra?: React.ReactNode) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <div className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Warning size={22} />
        </div>
        <div className="text-lg font-semibold">{title}</div>
        <div className="space-y-1 text-sm text-muted-foreground">{description}</div>
        {extra}
        <div className="pt-2">
          <Button variant="outline" asChild>
            <Link to="/agent">
              <ArrowLeft size={14} /> 返回首页
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ForbiddenPage() {
  return shell(
    '403 · 没有访问权限',
    <p>当前角色无权访问该页面。如需操作请联系组织管理员。</p>,
  )
}

export function NotFoundPage() {
  return shell('404 · 页面不存在', <p>链接可能已失效，或功能尚未迁移至新前端。</p>)
}

export function ServerErrorPage() {
  const routeError = useRouteError()
  const apiError = routeError instanceof ApiClientError ? routeError : toApiClientError(routeError)
  return shell(
    '500 · 服务出现异常',
    <>
      <p className="break-all">{apiError.message || '请求处理失败，请稍后重试。'}</p>
      {apiError.requestId ? <p className="font-mono text-xs">请求关联 ID：{apiError.requestId}</p> : null}
    </>,
    (
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => window.location.reload()}>
          刷新重试
        </Button>
      </div>
    ),
  )
}
