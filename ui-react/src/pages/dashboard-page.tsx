import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ArrowsDownUp, Database, MagnifyingGlass, Play, Plus, Star, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, PageLoading, TableSkeleton } from '@/components/states'
import { dashboards, datasets } from '@/api/dashboard'
import type { DashboardDatasetEntity, DashboardDsl, DashboardEntity, DashboardHistoryEntity, DatasetExecuteResult, DatasetType, PanelDsl } from '@/types'
import { readableError } from '@/lib/utils'

/** 工作台（RM-08 Dashboard）：模板列表、默认项、启停与数据集真实查询。 */
export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  return (
    <div className="px-6 py-6">
      <h1 className="font-display text-[24px] font-bold leading-tight">工作台</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">看板模板与数据集。</p>
      <Tabs value={searchParams.get('tab') === 'datasets' ? 'datasets' : 'dashboards'} onValueChange={(value) => setSearchParams(value === 'dashboards' ? {} : { tab: value }, { replace: true })}>
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
  const [designer, setDesigner] = useState<DashboardEntity | null>(null)
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
        <div className="mb-3 flex items-center justify-between"><span className="font-mono text-[11px] text-muted-foreground">{rows.length} 个模板 · 第 {page} 页</span><Button onClick={() => setCreating(true)}><Plus size={14} /> 新建看板</Button>
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
                      <div className="flex justify-end gap-3">
                        {row.isDefault ? null : <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('设为默认', () => dashboards.setDefault(String(row.id)))}>设为默认</Button>}
                        <Button variant="ghost" size="sm" onClick={() => setDesigner(row)}>设计</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => { if (!window.confirm(`确认删除看板“${row.name}”？`)) return; void action('删除', async () => { try { await dashboards.remove([String(row.id)], 0) } catch (cause) { if (!window.confirm(`普通删除失败：${readableError(cause, '可能仍被引用')}。是否强制删除？`)) throw cause; await dashboards.remove([String(row.id)], 1) } }) }}>
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
        {designer ? <DashboardDesigner key={String(designer.id)} dashboard={designer} onClose={() => setDesigner(null)} onSaved={() => { refresh(); setDesigner(null) }} /> : null}
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
  useEffect(() => {
    if (open) setValues({ name: editing?.name ?? '', remark: editing?.remark ?? '', configText: editing?.config ? JSON.stringify(editing.config, null, 2) : '{\n  "version": 1,\n  "panels": []\n}' })
  }, [open, editing])

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

function DashboardDesigner({ dashboard, onClose, onSaved }: { dashboard: DashboardEntity; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<DashboardDsl>(dashboard.config ?? { version: 1, grid: { columns: 12, rowHeight: 72, gap: 12 }, panels: [] })
  const [selectedId, setSelectedId] = useState('')
  const [busy, setBusy] = useState(false)
  const datasetQuery = useQuery({ queryKey: ['list', 'dashboard-dataset-options'], queryFn: async () => (await datasets.page({ page: 1, size: 200, enabled: true })).data.data.records })
  const historyQuery = useQuery({ queryKey: ['list', 'dashboard-history', String(dashboard.id)], queryFn: async () => (await dashboards.historyList(String(dashboard.id))).data.data })
  const panels = config.panels ?? []
  const selected = panels.find((panel) => panel.id === selectedId)

  function updatePanel(id: string, patch: Partial<PanelDsl>) {
    setConfig((previous) => ({ ...previous, panels: (previous.panels ?? []).map((panel) => panel.id === id ? { ...panel, ...patch } : panel) }))
  }
  function addPanel() {
    const id = `panel_${Date.now()}`
    const next: PanelDsl = { id, title: '新面板', chartType: 'TABLE', layout: { x: 0, y: panels.length * 3, w: 6, h: 3 }, options: {} }
    setConfig((previous) => ({ ...previous, panels: [...(previous.panels ?? []), next] }))
    setSelectedId(id)
  }
  function autoLayout() {
    setConfig((previous) => ({ ...previous, panels: (previous.panels ?? []).map((panel, index) => ({ ...panel, layout: { ...panel.layout, x: (index % 2) * 6, y: Math.floor(index / 2) * 3, w: 6, h: 3 } })) }))
  }
  async function save(mode: 'template' | 'personal' | 'version') {
    if (!dashboard.id) return
    setBusy(true)
    try {
      if (mode === 'template') await dashboards.update({ id: dashboard.id, config })
      else if (mode === 'personal') await dashboards.savePersonal(String(dashboard.id), config)
      else {
        const note = window.prompt('版本说明（可留空）') ?? undefined
        await dashboards.saveVersion(String(dashboard.id), config, note)
      }
      toast.success(mode === 'template' ? '模板已保存' : mode === 'personal' ? '个人配置已保存' : '历史版本已创建')
      void queryClient.invalidateQueries({ queryKey: ['list', 'dashboard-history', String(dashboard.id)] })
      if (mode === 'template') onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }
  async function loadPersonal() {
    try {
      const personal = (await dashboards.personal(String(dashboard.id))).data.data
      setConfig(personal.config)
      toast.success('已载入个人配置')
    } catch (cause) {
      toast.error(readableError(cause, '个人配置加载失败'))
    }
  }

  return <Sheet open onOpenChange={(open) => !open && onClose()}><SheetContent side="right" className="w-full overflow-auto sm:max-w-[1100px]"><SheetHeader><SheetTitle>看板设计器 · {dashboard.name}</SheetTitle><SheetDescription>结构化编辑面板、数据集、布局、个人副本和历史版本；保存协议仍使用后端 Dashboard DSL。</SheetDescription></SheetHeader><div className="flex flex-wrap gap-2 px-4"><Button size="sm" onClick={addPanel}><Plus size={13} />添加面板</Button><Button size="sm" variant="outline" onClick={autoLayout}><ArrowsDownUp size={13} />自动布局</Button><Button size="sm" variant="outline" onClick={() => void loadPersonal()}>载入个人配置</Button><Button size="sm" variant="outline" onClick={() => void save('personal')} disabled={busy}>保存个人配置</Button><Button size="sm" variant="outline" onClick={() => void save('version')} disabled={busy}>保存历史版本</Button><Button size="sm" className="ml-auto" onClick={() => void save('template')} disabled={busy}>保存模板</Button></div><div className="grid min-h-[520px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_300px]"><div className="rounded-lg border border-border bg-muted/20 p-3"><div className="grid grid-cols-12 gap-3">{panels.map((panel) => <button key={panel.id} onClick={() => setSelectedId(panel.id)} className={`col-span-6 min-h-32 rounded-lg border bg-card p-4 text-left ${selectedId === panel.id ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}><div className="flex items-center justify-between"><span className="font-medium">{panel.title}</span><Badge variant="outline">{panel.chartType}</Badge></div><div className="mt-3 text-xs text-muted-foreground">数据集：{datasetQuery.data?.find((item) => String(item.id) === panel.datasetId)?.name || panel.datasetId || '未绑定'}</div><div className="mt-1 font-mono text-[10px] text-muted-foreground">x:{panel.layout?.x ?? 0} y:{panel.layout?.y ?? 0} w:{panel.layout?.w ?? 6} h:{panel.layout?.h ?? 3}</div></button>)}{!panels.length ? <div className="col-span-12"><EmptyState title="画布为空" description="添加一个面板开始设计。" /></div> : null}</div></div><aside className="space-y-4">{selected ? <div className="space-y-3 rounded-lg border border-border p-3"><div className="font-medium">面板配置</div><div><Label>标题</Label><Input value={selected.title} onChange={(event) => updatePanel(selected.id, { title: event.target.value })} /></div><div><Label>图表类型</Label><Select value={selected.chartType ?? 'TABLE'} onValueChange={(value) => updatePanel(selected.id, { chartType: value as PanelDsl['chartType'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['TABLE', 'LINE', 'BAR', 'PIE', 'STAT'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>数据集</Label><Select value={selected.datasetId || 'none'} onValueChange={(value) => updatePanel(selected.id, { datasetId: value === 'none' ? undefined : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">不绑定</SelectItem>{(datasetQuery.data ?? []).map((dataset) => <SelectItem key={String(dataset.id)} value={String(dataset.id)}>{dataset.name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-4 gap-2">{(['x', 'y', 'w', 'h'] as const).map((key) => <div key={key}><Label>{key}</Label><Input type="number" value={selected.layout?.[key] ?? (key === 'w' ? 6 : key === 'h' ? 3 : 0)} onChange={(event) => updatePanel(selected.id, { layout: { ...selected.layout, [key]: Number(event.target.value) } })} /></div>)}</div><JsonOptionsEditor value={selected.options ?? {}} onChange={(options) => updatePanel(selected.id, { options })} /><Button variant="ghost" className="w-full text-destructive" onClick={() => { setConfig((previous) => ({ ...previous, panels: (previous.panels ?? []).filter((panel) => panel.id !== selected.id) })); setSelectedId('') }}><Trash size={13} />删除面板</Button></div> : <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">选择画布面板进行配置。</p>}<div className="rounded-lg border border-border p-3"><div className="mb-2 font-medium">历史版本</div>{historyQuery.isLoading ? <PageLoading /> : (historyQuery.data ?? []).length ? <div className="max-h-56 space-y-2 overflow-auto">{(historyQuery.data ?? []).map((history: DashboardHistoryEntity) => <div key={history.id} className="rounded-lg bg-muted p-2 text-xs"><div className="font-medium">{history.note || `版本 ${history.id}`}</div><div className="text-muted-foreground">{history.createdAt}</div><div className="mt-2 flex gap-1"><Button size="sm" variant="outline" onClick={async () => { if (!window.confirm('回滚会先保存当前配置快照，确认继续？')) return; try { const response = await dashboards.rollback(String(dashboard.id), history.id, true, '设计器回滚前快照'); setConfig(response.data.data); toast.success('已回滚') } catch (cause) { toast.error(readableError(cause, '回滚失败')) } }}>回滚</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={async () => { if (!window.confirm('确认删除此历史版本？')) return; await dashboards.removeHistory(String(dashboard.id), history.id); void historyQuery.refetch() }}>删除</Button></div></div>)}</div> : <p className="text-xs text-muted-foreground">暂无历史版本。</p>}</div></aside></div></SheetContent></Sheet>
}

function JsonOptionsEditor({ value, onChange }: { value: Record<string, unknown>; onChange: (value: Record<string, unknown>) => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  return <div><Label>面板选项（JSON）</Label><Textarea className="min-h-28 font-mono text-xs" value={text} onChange={(event) => setText(event.target.value)} onBlur={() => { try { onChange(JSON.parse(text) as Record<string, unknown>) } catch { toast.error('面板选项不是合法 JSON'); setText(JSON.stringify(value, null, 2)) } }} /></div>
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
                      <div className="flex justify-end gap-3">
                        <Button variant="ghost" size="sm" onClick={() => setQueryTarget(row)}>
                          <Play size={13} /> 查询
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          if (!window.confirm(`确认删除数据集“${row.name}”？已绑定该数据集的看板面板可能失效。`)) return
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
  useEffect(() => {
    if (open) setValues({ name: editing?.name ?? '', type: (editing?.type ?? 'SQL') as DatasetType, sqlText: editing?.sqlText ?? '', httpConfigText: editing?.httpConfig ? JSON.stringify(editing.httpConfig, null, 2) : '', remark: editing?.remark ?? '', shared: editing?.shared ?? false })
  }, [open, editing])

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
