import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { accessLogs, gatewayApis, gatewayApps } from '@/api/dashboard'
import type { GatewayAccessLog, GatewayApi, GatewayApp, GatewayHttpMethod, GatewayPageResult } from '@/types'
import { readableError } from '@/lib/utils'

/**
 * API 服务（RM-08）：应用/API/访问日志管理。
 * 管理面接口走 Console，数据面由内部 gateway profile 提供。
 */
export function ApiServicePage() {
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">API 服务</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">应用与 API 管理、上下线与访问日志；开发环境数据面仅在 Docker 内部网络可达。</p>
      <Tabs defaultValue="apps">
        <TabsList>
          <TabsTrigger value="apps">应用</TabsTrigger>
          <TabsTrigger value="apis">API</TabsTrigger>
          <TabsTrigger value="logs">访问日志</TabsTrigger>
        </TabsList>
        <TabsContent value="apps"><AppsTab /></TabsContent>
        <TabsContent value="apis"><ApisTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function OnlineBadge({ online }: { online?: number }) {
  return <Badge variant={online ? 'default' : 'secondary'}>{online ? '已上线' : '已下线'}</Badge>
}

function AppsTab() {
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['list', 'gateway-app', page, keyword],
    queryFn: async () => (await gatewayApps.page({ page, size: 10, name: keyword || undefined })).data.data as GatewayPageResult<GatewayApp>,
  })
  const [editing, setEditing] = useState<GatewayApp | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = listQuery.data?.records ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'gateway-app'] })

  async function toggle(row: GatewayApp) {
    setBusy(true)
    try {
      await gatewayApps.online(String(row.id), row.online ? 0 : 1)
      toast.success(row.online ? '已下线' : '已上线')
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '上下线失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索应用" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={14} /> 新建应用</Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无应用" description="应用承载一组对外 API；上线后经网关真实调用。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>协议/端口</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{row.remark}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.protocol ?? 'http'}:{row.port ?? '—'}</TableCell>
                    <TableCell><OnlineBadge online={row.online} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggle(row)}>{row.online ? '下线' : '上线'}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          try {
                            await gatewayApps.remove([String(row.id)])
                            toast.success('已删除')
                            refresh()
                          } catch (cause) {
                            toast.error(readableError(cause, '删除失败'))
                          }
                        }}>
                          <Trash size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listQuery.data ? <Pagination page={page} size={listQuery.data.size} total={listQuery.data.total} onPageChange={setPage} /> : null}
          </>
        )}

        <AppFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null) } }}
          editing={editing}
          onSaved={() => { refresh(); setCreating(false); setEditing(null) }}
        />
      </CardContent>
    </Card>
  )
}

function AppFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: GatewayApp | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    remark: editing?.remark ?? '',
    protocol: editing?.protocol ?? 'http',
    port: editing?.port ?? 8080,
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      if (editing) await gatewayApps.update({ ...editing, ...values })
      else await gatewayApps.save(values)
      toast.success('已保存')
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑应用' : '新建应用'}</DialogTitle>
          <DialogDescription>应用上线后由 runner-gateway 提供真实入口。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="app-name">名称</Label>
            <Input id="app-name" className="mt-1.5" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="app-protocol">协议</Label>
              <Input id="app-protocol" className="mt-1.5" value={values.protocol} onChange={(event) => setValues((v) => ({ ...v, protocol: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="app-port">端口</Label>
              <Input id="app-port" className="mt-1.5" type="number" value={String(values.port ?? '')} onChange={(event) => setValues((v) => ({ ...v, port: Number(event.target.value) }))} />
            </div>
          </div>
          <div>
            <Label htmlFor="app-remark">备注</Label>
            <Input id="app-remark" className="mt-1.5" value={values.remark} onChange={(event) => setValues((v) => ({ ...v, remark: event.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void submit()} disabled={busy}>{busy ? '提交中…' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ApisTab() {
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['list', 'gateway-api', page, keyword],
    queryFn: async () => (await gatewayApis.page({ page, size: 10, name: keyword || undefined })).data.data as GatewayPageResult<GatewayApi>,
  })
  const [editing, setEditing] = useState<GatewayApi | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows = listQuery.data?.records ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'gateway-api'] })

  async function toggle(row: GatewayApi) {
    setBusy(true)
    try {
      await gatewayApis.online(String(row.id), row.online ? 0 : 1)
      toast.success(row.online ? '已下线（网关拒绝访问）' : '已上线')
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '上下线失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索 API" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={14} /> 新建 API</Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无 API" description="API 绑定工作流；上线后可经网关调用并产生访问日志。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>方法/路径</TableHead>
                  <TableHead>应用</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.category ?? '—'}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{row.method} {row.path}</TableCell>
                    <TableCell>{row.appName ?? '—'}</TableCell>
                    <TableCell><OnlineBadge online={row.online} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void toggle(row)}>{row.online ? '下线' : '上线'}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          try {
                            await gatewayApis.remove([String(row.id)])
                            toast.success('已删除')
                            refresh()
                          } catch (cause) {
                            toast.error(readableError(cause, '删除失败'))
                          }
                        }}>
                          <Trash size={13} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listQuery.data ? <Pagination page={page} size={listQuery.data.size} total={listQuery.data.total} onPageChange={setPage} /> : null}
          </>
        )}

        <ApiFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null) } }}
          editing={editing}
          onSaved={() => { refresh(); setCreating(false); setEditing(null) }}
        />
      </CardContent>
    </Card>
  )
}

function ApiFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: GatewayApi | null
  onSaved: () => void
}) {
  const appsQuery = useQuery({ queryKey: ['list', 'gateway-app', 'options'], queryFn: async () => (await gatewayApps.page({ page: 1, size: 100 })).data.data as GatewayPageResult<GatewayApp> })
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    category: editing?.category ?? '',
    method: editing?.method ?? 'GET',
    path: editing?.path ?? '',
    appId: editing?.appId ?? '',
    remark: editing?.remark ?? '',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      if (editing) await gatewayApis.update({ ...editing, ...values })
      else await gatewayApis.save(values as Partial<GatewayApi>)
      toast.success('已保存')
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑 API' : '新建 API'}</DialogTitle>
          <DialogDescription>路径绑定工作流执行；鉴权与限流在网关配置中生效。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="api-name">名称</Label>
              <Input id="api-name" className="mt-1.5" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="api-category">分类</Label>
              <Input id="api-category" className="mt-1.5" value={values.category} onChange={(event) => setValues((v) => ({ ...v, category: event.target.value }))} />
            </div>
            <div>
              <Label>方法</Label>
              <Select value={values.method} onValueChange={(value) => setValues((v) => ({ ...v, method: value as GatewayHttpMethod }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL'].map((method) => <SelectItem key={method} value={method}>{method}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>所属应用</Label>
              <Select value={values.appId || undefined} onValueChange={(value) => setValues((v) => ({ ...v, appId: value }))}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="选择应用" /></SelectTrigger>
                <SelectContent>
                  {(appsQuery.data?.records ?? []).map((app) => (
                    <SelectItem key={String(app.id)} value={String(app.id)}>{app.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="api-path">路径</Label>
            <Input id="api-path" className="mt-1.5 font-mono" value={values.path} onChange={(event) => setValues((v) => ({ ...v, path: event.target.value }))} placeholder="/v1/ask" />
          </div>
          <div>
            <Label htmlFor="api-remark">备注</Label>
            <Input id="api-remark" className="mt-1.5" value={values.remark} onChange={(event) => setValues((v) => ({ ...v, remark: event.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void submit()} disabled={busy}>{busy ? '提交中…' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LogsTab() {
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<GatewayAccessLog | null>(null)
  const listQuery = useQuery({
    queryKey: ['list', 'gateway-access-log', page],
    queryFn: async () => (await accessLogs.page({ page, size: 20 })).data.data as GatewayPageResult<GatewayAccessLog>,
  })

  const rows = listQuery.data?.records ?? []

  return (
    <Card>
      <CardContent className="pt-5">
        {listQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无访问日志" description="API 上线并被真实调用后，这里会出现访问记录。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>方法/路径</TableHead>
                  <TableHead>来源 IP</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs">{row.createdAt ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{row.method} {row.path}</TableCell>
                    <TableCell className="font-mono text-xs">{row.accessIp ?? '—'}</TableCell>
                    <TableCell><Badge variant={row.httpStatus === 200 ? 'default' : 'outline'}>{row.httpStatus ?? '—'}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>查看</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listQuery.data ? <Pagination page={page} size={listQuery.data.size} total={listQuery.data.total} onPageChange={setPage} /> : null}
          </>
        )}

        <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>访问日志详情</DialogTitle>
              <DialogDescription>请求与响应原文，用于排查网关调用问题。</DialogDescription>
            </DialogHeader>
            {detail ? (
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(detail, null, 2).slice(0, 10000)}</pre>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetail(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
