import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, LockKeyOpen, Lock, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as workflowApi from '@/api/workflows'
import type { Workflow } from '@/types'
import { usePagedList } from '@/features/data/paged'

export function WorkflowPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const paged = usePagedList<Workflow>({
    resource: 'workflow',
    fetcher: async (params) => (await workflowApi.pageWorkflows({ ...params, name: search || undefined })).data.data,
  })
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [forceTarget, setForceTarget] = useState<Workflow | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'workflow'] })

  const createMutation = useMutation({
    mutationFn: async () => (await workflowApi.createWorkflow({ name: `工作流-${Date.now()}`, config: { nodes: [], edges: [] } })).data.data,
    onSuccess: (created) => {
      toast.success('已创建')
      refresh()
      if (!created?.id) {
        toast.error('创建成功，但服务端未返回工作流 ID')
        return
      }
      navigate(`/workflow/${created.id}/edit`)
    },
    onError: (cause) => toast.error(readableError(cause, '创建失败')),
  })

  async function action(label: string, fn: () => Promise<unknown>) {
    setBusy(true)
    try {
      await fn()
      toast.success(`${label}成功`)
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, `${label}失败`))
    } finally {
      setBusy(false)
    }
  }

  async function removeWorkflow(row: Workflow) {
    if (!window.confirm(`确认删除工作流“${row.name}”？未被引用时会立即永久删除。`)) return
    try {
      const used = await workflowApi.usedWithAgent([String(row.id)])
      if (used.data.data?.length) {
        setForceTarget(row)
        return
      }
      await doRemove(row, 0)
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    }
  }

  async function doRemove(row: Workflow, force: number) {
    await workflowApi.removeWorkflows([String(row.id)], force)
    toast.success('已删除')
    refresh()
  }

  const rows = paged.data?.records ?? []

  // 旧 Vue 深链 /workflow/new 由 router 转为 ?create=1：创建一次并进入编辑器，严格防重复创建。
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current || !searchParams.get('create')) return
    deepLinkHandled.current = true
    setSearchParams({}, { replace: true })
    createMutation.mutate()
  }, [searchParams, setSearchParams, createMutation])

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">工作流</h1>
          <p className="mt-1 text-sm text-muted-foreground">React Flow 画布编辑；保存协议经 round-trip 测试约束。</p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus size={14} /> 新建工作流
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 w-64">
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="按名称搜索" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
          </div>

          {paged.isLoading ? (
            <TableSkeleton rows={4} />
          ) : paged.error ? (
            <ErrorState error={paged.error} onRetry={() => void paged.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无工作流" description="新建一个工作流，从开始节点搭建流程。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>锁定</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{row.remark}</div>
                    </TableCell>
                    <TableCell>{row.status ? <Badge variant={row.status === 'PUBLISHED' ? 'default' : 'secondary'}>{row.status}</Badge> : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.version ?? '—'}</TableCell>
                    <TableCell>{row.locked ? <Badge variant="outline">已锁定</Badge> : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/workflow/${row.id}/edit`)}>
                          <PencilSimple size={13} /> 编辑
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('复制', () => workflowApi.copyWorkflow(String(row.id)))}>
                          <Copy size={13} /> 复制
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action(row.locked ? '解锁' : '锁定', () => workflowApi.setWorkflowLock(String(row.id), row.locked ? 0 : 1))}>
                          {row.locked ? <LockKeyOpen size={13} /> : <Lock size={13} />}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void removeWorkflow(row)}>
                          <Trash size={13} /> 删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {paged.data ? <Pagination page={paged.page} size={paged.size} total={paged.data.total} onPageChange={paged.setPage} onSizeChange={paged.setSize} /> : null}
        </CardContent>
      </Card>

      {forceTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" onClick={() => setForceTarget(null)}>
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-dialog" onClick={(event) => event.stopPropagation()}>
            <h3 className="text-lg font-semibold">仍被引用，确认强制删除？</h3>
            <p className="mt-2 text-sm text-muted-foreground">工作流 {forceTarget.name} 仍被其他配置引用。强制删除可能导致引用方运行失败，操作不可恢复。</p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setForceTarget(null)}>取消</Button>
              <Button variant="destructive" onClick={async () => {
                try {
                  await doRemove(forceTarget, 1)
                } catch (cause) {
                  toast.error(readableError(cause, '强制删除失败'))
                } finally {
                  setForceTarget(null)
                }
              }}>
                强制删除
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
