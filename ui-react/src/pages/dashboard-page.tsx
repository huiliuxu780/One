import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, MagnifyingGlass, Play, Plus, Star, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { dashboards, datasets } from '@/api/dashboard'
import type { DashboardDatasetEntity, DashboardEntity, DatasetExecuteResult, DatasetType } from '@/types'
import { readableError } from '@/lib/utils'

/** 工作台（RM-08 Dashboard）：模板列表、默认项、启停与数据集真实查询。 */
export function DashboardPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">工作台</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">看板模板与数据集；数据集执行真实查询，错误与超时原文可见。</p>
      <Tabs defaultValue="dashboards">
        <TabsList>
          <TabsTrigger value="dashboards">看板</TabsTrigger>
          <TabsTrigger value="datasets">数据集</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboards"><DashboardsTab /></TabsContent>
        <TabsContent value="datasets"><DatasetsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function DashboardsTab() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['list', 'dashboard', page],
    queryFn: async () => (await dashboards.page({ page, size: 10 })).data.data,
  })
  const [editing, setEditing] = useState<DashboardEntity | null>(null)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)

  const rows: DashboardEntity[] = listQuery.data?.records ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'dashboard'] })

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

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}><Plus size={14} /> 新建看板</Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无看板" description="创建看板模板并配置数据集面板。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>版本</TableHead>
                  <TableHead>默认</TableHead>
                  <TableHead>启用</TableHead>
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
                    <TableCell className="font-mono text-xs">{row.version ?? '—'}</TableCell>
                    <TableCell>{row.isDefault ? <Star size={14} className="text-primary" weight="fill" /> : '—'}</TableCell>
                    <TableCell><Switch checked={Boolean(row.enabled)} onCheckedChange={(checked) => void action('启停', () => dashboards.enable(String(row.id), checked ? 1 : 0))} aria-label={`启用 ${row.name}`} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" disabled={row.isDefault || busy} onClick={() => void action('设为默认', () => dashboards.setDefault(String(row.id)))}>设为默认</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void action('删除', async () => {
                          await dashboards.remove([String(row.id)], 0).catch(() => dashboards.remove([String(row.id)], 1))
                        })}>
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

        <DashboardFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null) } }}
          editing={editing}
          onSaved={() => { refresh(); setCreating(false); setEditing(null) }}
        />
      </CardContent>
    </Card>
  )
}

function DashboardFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: DashboardEntity | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    remark: editing?.remark ?? '',
    configText: editing?.config ? JSON.stringify(editing.config, null, 2) : '{\n  "version": 1,\n  "panels": []\n}',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const config = JSON.parse(values.configText)
      if (editing) await dashboards.update({ id: editing.id, name: values.name, remark: values.remark, config })
      else await dashboards.save({ name: values.name, remark: values.remark, config })
      toast.success('已保存')
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, cause instanceof SyntaxError ? '面板配置不是合法 JSON' : '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑看板' : '新建看板'}</DialogTitle>
          <DialogDescription>面板 DSL 为声明式 JSON；可视化设计器后续接入。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="dash-name">名称</Label>
            <Input id="dash-name" className="mt-1.5" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="dash-remark">备注</Label>
            <Input id="dash-remark" className="mt-1.5" value={values.remark} onChange={(event) => setValues((v) => ({ ...v, remark: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="dash-config">面板配置 (JSON)</Label>
            <Textarea id="dash-config" className="mt-1.5 min-h-40 font-mono text-xs" value={values.configText} onChange={(event) => setValues((v) => ({ ...v, configText: event.target.value }))} />
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

function DatasetsTab() {
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const queryClient = useQueryClient()
  const listQuery = useQuery({
    queryKey: ['list', 'dashboard-dataset', page, keyword],
    queryFn: async () => (await datasets.page({ page, size: 10, name: keyword || undefined })).data.data,
  })
  const [editing, setEditing] = useState<DashboardDatasetEntity | null>(null)
  const [creating, setCreating] = useState(false)
  const [queryTarget, setQueryTarget] = useState<DashboardDatasetEntity | null>(null)
  const [busy, setBusy] = useState(false)

  const rows: DashboardDatasetEntity[] = listQuery.data?.records ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['list', 'dashboard-dataset'] })

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索数据集" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
          </div>
          <Button onClick={() => setCreating(true)}><Plus size={14} /> 新建数据集</Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无数据集" description="SQL / HTTP 数据集可用于看板面板的真实查询。" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>共享</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="font-mono text-xs text-muted-foreground">{row.type === 'SQL' ? row.sqlText?.slice(0, 60) : row.httpConfig?.url}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{row.type}</Badge></TableCell>
                    <TableCell>{row.shared ? <Badge>共享</Badge> : '—'}</TableCell>
                    <TableCell><Switch checked={Boolean(row.enabled)} onCheckedChange={(checked) => void datasets.enable(String(row.id), checked ? 1 : 0).then(() => refresh())} aria-label={`启用 ${row.name}`} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setQueryTarget(row)}>
                          <Play size={13} /> 查询
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          try {
                            await datasets.remove([String(row.id)])
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

        <DatasetFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null) } }}
          editing={editing}
          onSaved={() => { refresh(); setCreating(false); setEditing(null) }}
        />
        {queryTarget ? <DatasetQueryDialog dataset={queryTarget} onClose={() => setQueryTarget(null)} /> : null}
      </CardContent>
    </Card>
  )
}

function DatasetFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: DashboardDatasetEntity | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    type: (editing?.type ?? 'SQL') as DatasetType,
    sqlText: editing?.sqlText ?? '',
    httpConfigText: editing?.httpConfig ? JSON.stringify(editing.httpConfig, null, 2) : '',
    remark: editing?.remark ?? '',
    shared: editing?.shared ?? false,
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const payload: Partial<DashboardDatasetEntity> = {
        ...(editing ?? {}),
        name: values.name,
        type: values.type,
        remark: values.remark,
        shared: values.shared,
        sqlText: values.type === 'SQL' ? values.sqlText : undefined,
        httpConfig: values.type === 'HTTP' ? (values.httpConfigText.trim() ? JSON.parse(values.httpConfigText) : undefined) : undefined,
      }
      if (editing) await datasets.update(payload)
      else await datasets.save(payload)
      toast.success('已保存')
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, cause instanceof SyntaxError ? 'HTTP 配置不是合法 JSON' : '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑数据集' : '新建数据集'}</DialogTitle>
          <DialogDescription>SQL 数据集绑定数据源；HTTP 数据集直接配置请求。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ds-name">名称</Label>
              <Input id="ds-name" className="mt-1.5" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
            </div>
            <div>
              <Label>类型</Label>
              <Select value={values.type} onValueChange={(value) => setValues((v) => ({ ...v, type: value as DatasetType }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SQL">SQL</SelectItem>
                  <SelectItem value="HTTP">HTTP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {values.type === 'SQL' ? (
            <div>
              <Label htmlFor="ds-sql">SQL 文本</Label>
              <Textarea id="ds-sql" className="mt-1.5 min-h-24 font-mono text-xs" value={values.sqlText} onChange={(event) => setValues((v) => ({ ...v, sqlText: event.target.value }))} placeholder="SELECT ... WHERE created_at > :startTime" />
            </div>
          ) : (
            <div>
              <Label htmlFor="ds-http">HTTP 配置 (JSON)</Label>
              <Textarea id="ds-http" className="mt-1.5 min-h-24 font-mono text-xs" value={values.httpConfigText} onChange={(event) => setValues((v) => ({ ...v, httpConfigText: event.target.value }))} placeholder='{"url":"https://...","queries":[],"headers":[]}' />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={values.shared} onCheckedChange={(checked) => setValues((v) => ({ ...v, shared: checked }))} /> 租户内共享
          </label>
          <div>
            <Label htmlFor="ds-remark">备注</Label>
            <Input id="ds-remark" className="mt-1.5" value={values.remark} onChange={(event) => setValues((v) => ({ ...v, remark: event.target.value }))} />
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

function DatasetQueryDialog({ dataset, onClose }: { dataset: DashboardDatasetEntity; onClose: () => void }) {
  const [paramsText, setParamsText] = useState('{}')
  const [result, setResult] = useState<DatasetExecuteResult | null>(null)
  const [errorText, setErrorText] = useState<string | null>(null)

  const queryMutation = useMutation({
    mutationFn: async () => (await datasets.query(String(dataset.id), { params: JSON.parse(paramsText) })).data.data,
    onSuccess: (data) => setResult(data),
    onError: (cause) => setErrorText(readableError(cause, '查询失败')),
  })

  const columns = result?.columns?.map((column) => column.name ?? '') ?? []

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Database size={16} /> 查询 · {dataset.name}</DialogTitle>
          <DialogDescription>参数为 JSON 对象，绑定 SQL 中的 :name 模板；错误原文直接展示。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Textarea className="min-h-16 font-mono text-xs" value={paramsText} onChange={(event) => setParamsText(event.target.value)} />
          <div className="flex gap-2">
            <Button onClick={() => { setErrorText(null); queryMutation.mutate() }} disabled={queryMutation.isPending}>
              {queryMutation.isPending ? '查询中…' : '执行查询'}
            </Button>
            {result ? (
              <span className="self-center text-xs text-muted-foreground">
                {result.rowCount} 行 · {result.elapsedMs}ms{result.truncated ? ' · 结果已截断' : ''}
              </span>
            ) : null}
          </div>
          {errorText ? (
            <pre className="max-h-32 overflow-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 font-mono text-xs text-destructive">{errorText}</pre>
          ) : null}
          {result ? (
            <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(result.rows ?? [], null, 2).slice(0, 8000)}</pre>
          ) : null}
          {result && columns.length ? (
            <div className="text-xs text-muted-foreground">列：{columns.join('，')}</div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
