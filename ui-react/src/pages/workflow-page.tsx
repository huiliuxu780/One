import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, LockKeyOpen, Lock, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, NoMatchState, TableSkeleton } from '@/components/states'
import { SearchInput } from '@/components/search-input'
import { readableError } from '@/lib/utils'
import * as workflowApi from '@/api/workflows'
import type { Workflow } from '@/types'
import { usePagedList } from '@/features/data/paged'
import { createDefaultWorkflowDefinition } from '@/features/workflow/default-definition'

export function WorkflowPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [enabledFilter, setEnabledFilter] = useState('all')
  const paged = usePagedList<Workflow>({
    resource: 'workflow',
    fetcher: async (params) => (await workflowApi.pageWorkflows(params)).data.data,
  })
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [forceTarget, setForceTarget] = useState<Workflow | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [editingInfo, setEditingInfo] = useState<Workflow | null>(null)
  const [infoName, setInfoName] = useState('')
  const [infoRemark, setInfoRemark] = useState('')
  const [infoBusy, setInfoBusy] = useState(false)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'workflow'] })

  const createMutation = useMutation({
    mutationFn: async (payload: { name: string; remark: string }) => (await workflowApi.createWorkflow({ ...payload, status: 'DRAFT', version: '0', locked: 0, enabled: true, config: createDefaultWorkflowDefinition() })).data.data,
    onSuccess: (created) => {
      toast.success('已创建')
      setInfoOpen(false)
      refresh()
      if (!created?.id) {
        toast.error('创建成功，但服务端未返回工作流 ID')
        return
      }
      navigate(`/workflow/${created.id}/edit`)
    },
    onError: (cause) => toast.error(readableError(cause, '创建失败')),
  })

  function openInfo(workflow: Workflow | null) {
    setEditingInfo(workflow)
    setInfoName(workflow?.name ?? '')
    setInfoRemark(workflow?.remark ?? '')
    setInfoOpen(true)
  }

  async function submitInfo() {
    if (infoBusy || createMutation.isPending) return
    const name = infoName.trim()
    if (!name) { toast.error('请输入工作流名称'); return }
    if (name.length > 80 || infoRemark.trim().length > 300) { toast.error('名称或描述超过长度限制'); return }
    const remark = infoRemark.trim()
    if (!editingInfo) { createMutation.mutate({ name, remark }); return }
    setInfoBusy(true)
    try {
      await workflowApi.updateWorkflow({ id: editingInfo.id, name, remark })
      toast.success('工作流信息已保存')
      setInfoOpen(false)
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setInfoBusy(false)
    }
  }

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

  // 旧 Vue 深链 /workflow/new 由 router 转为 ?create=1：只打开一次创建表单。
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)
  useEffect(() => {
    if (deepLinkHandled.current || !searchParams.get('create')) return
    deepLinkHandled.current = true
    setSearchParams({}, { replace: true })
    openInfo(null)
  }, [searchParams, setSearchParams, createMutation])

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">工作流</h1>
          <p className="mt-1 text-sm text-muted-foreground">React Flow 画布编辑；保存协议经 round-trip 测试约束。</p>
        </div>
        <Button onClick={() => openInfo(null)} disabled={createMutation.isPending}>
          <Plus size={14} /> 新建工作流
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <SearchInput value={search} onChange={(value) => { setSearch(value); paged.setFilter('name', value || undefined) }} />
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); paged.setFilter('status', value === 'all' ? undefined : value) }}>
              <SelectTrigger className="w-36" aria-label="发布状态"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部状态</SelectItem><SelectItem value="DRAFT">草稿</SelectItem><SelectItem value="PUBLISHED">已发布</SelectItem></SelectContent>
            </Select>
            <Select value={enabledFilter} onValueChange={(value) => { setEnabledFilter(value); paged.setFilter('enabled', value === 'all' ? undefined : value === 'true') }}>
              <SelectTrigger className="w-36" aria-label="启用状态"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部启用状态</SelectItem><SelectItem value="true">启用</SelectItem><SelectItem value="false">禁用</SelectItem></SelectContent>
            </Select>
          </div>

          {paged.isLoading ? (
            <TableSkeleton rows={4} />
          ) : paged.error ? (
            <ErrorState error={paged.error} onRetry={() => void paged.refetch()} />
          ) : rows.length === 0 ? (
            search.trim() || statusFilter !== 'all' || enabledFilter !== 'all'
              ? <NoMatchState summary="没有匹配当前搜索或筛选条件的工作流。" onClear={() => { setSearch(''); setStatusFilter('all'); setEnabledFilter('all'); paged.setFilter('name', undefined); paged.setFilter('status', undefined); paged.setFilter('enabled', undefined) }} />
              : <EmptyState title="暂无工作流" description="新建一个工作流，从开始节点搭建流程。" />
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
                    <TableCell>{row.status ? <span className={`stat ${row.status === 'PUBLISHED' ? '' : 'off'}`}><i />{row.status === 'PUBLISHED' ? '已发布' : row.status === 'DRAFT' ? '草稿' : row.status}</span> : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.version ?? '—'}</TableCell>
                    <TableCell>{row.locked ? <span className="stat warn"><i />已锁定</span> : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-3">
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/workflow/${row.id}/edit`)}>
                          <PencilSimple size={13} /> 设计
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openInfo(row)}>
                          编辑信息
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

      <Dialog open={infoOpen} onOpenChange={(open) => { if (!infoBusy && !createMutation.isPending) setInfoOpen(open) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingInfo ? '编辑工作流' : '新建工作流'}</DialogTitle><DialogDescription>设置名称和用途后{editingInfo ? '保存信息' : '进入画布设计'}。</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div><Label htmlFor="workflow-info-name">工作流名称 *</Label><Input id="workflow-info-name" maxLength={80} value={infoName} onChange={(event) => setInfoName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void submitInfo() }} /></div>
            <div><Label htmlFor="workflow-info-remark">描述信息</Label><Textarea id="workflow-info-remark" maxLength={300} value={infoRemark} onChange={(event) => setInfoRemark(event.target.value)} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setInfoOpen(false)}>取消</Button><Button onClick={() => void submitInfo()} disabled={infoBusy || createMutation.isPending}>{infoBusy || createMutation.isPending ? '保存中…' : editingInfo ? '保存' : '创建并设计'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {forceTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4" onClick={() => setForceTarget(null)}>
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-dialog" onClick={(event) => event.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">仍被引用，确认强制删除？</h3>
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
