import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { Pagination } from '@/components/ui/pagination'
import type { WorkflowManagedResource, WorkflowResourceKind } from '@/types'
import { checkWorkflowResource, createWorkflowResource, enableWorkflowResource, pageWorkflowResources, removeWorkflowResources, updateWorkflowResource } from '@/api/workflowResources'
import { readableError } from '@/lib/utils'

const kindLabels: Record<WorkflowResourceKind, string> = { datasource: '数据源', cache: '缓存', mq: '消息队列', channel: '通知渠道' }
const typeOptions: Record<WorkflowResourceKind, string[]> = {
  datasource: ['MYSQL', 'POSTGRESQL', 'ORACLE'],
  cache: ['REDIS'],
  mq: ['KAFKA', 'RABBITMQ', 'ROCKETMQ'],
  channel: ['EMAIL', 'WECOM', 'DINGTALK', 'FEISHU'],
}

function editCopy(entity: WorkflowManagedResource): WorkflowManagedResource {
  const { password: _password, ...safe } = entity
  return { ...safe, password: '' }
}

export function WorkflowResourcesPage() {
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<WorkflowResourceKind>('datasource')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<WorkflowManagedResource | null>(null)
  const [removeTarget, setRemoveTarget] = useState<WorkflowManagedResource | null>(null)

  const query = useQuery({
    queryKey: ['list', 'workflow-resources', kind, page, search],
    queryFn: async () => (await pageWorkflowResources(kind, { page, size: 15, name: search || undefined })).data.data,
  })
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['list', 'workflow-resources', kind] })

  const saveMutation = useMutation({
    mutationFn: async (entity: WorkflowManagedResource) => {
      const payload = { ...entity }
      if (entity.id && !entity.password) delete payload.password
      return entity.id ? updateWorkflowResource(kind, payload) : createWorkflowResource(kind, payload)
    },
    onSuccess: () => { toast.success('已保存'); setDraft(null); refresh() },
    onError: (cause) => toast.error(readableError(cause, '保存失败')),
  })

  async function check(entity: WorkflowManagedResource) {
    try {
      const response = await checkWorkflowResource(kind, entity)
      if (response.data.data) toast.success('连接检查通过')
      else toast.error('连接检查未通过')
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '连接检查失败'))
    }
  }

  const records = query.data?.records ?? []
  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><Database size={18} /> Workflow resources</div><h1 className="text-2xl font-semibold tracking-tight">工作流资源</h1><p className="mt-1 text-sm text-muted-foreground">管理工作流节点引用的数据源、缓存、消息队列和通知渠道。</p></div><Button onClick={() => setDraft({ enabled: true, type: typeOptions[kind][0] })}><Plus size={14} /> 新建{kindLabels[kind]}</Button></div>
      <Tabs value={kind} onValueChange={(value) => { setKind(value as WorkflowResourceKind); setPage(1); setSearch('') }}><TabsList>{(Object.keys(kindLabels) as WorkflowResourceKind[]).map((item) => <TabsTrigger key={item} value={item}>{kindLabels[item]}</TabsTrigger>)}</TabsList></Tabs>
      <div className="my-4 relative w-72"><MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="按名称搜索" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
      {query.isLoading ? <TableSkeleton rows={6} /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : records.length === 0 ? <EmptyState title={`暂无${kindLabels[kind]}`} description="创建后可在工作流节点配置中引用。" /> : <div className="rounded-xl border border-border bg-card"><Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>连接</TableHead><TableHead>健康状态</TableHead><TableHead>启用</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{records.map((entity) => <TableRow key={entity.id}><TableCell><div className="font-medium">{entity.name}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{entity.remark || entity.lastCheckMessage}</div></TableCell><TableCell><Badge variant="outline">{entity.type || '-'}</Badge></TableCell><TableCell className="font-mono text-xs">{'ip' in entity ? `${entity.ip || ''}${entity.port ? `:${entity.port}` : ''}` : 'address' in entity ? `${entity.address || ''}${entity.port ? `:${entity.port}` : ''}` : 'JSON 配置'}</TableCell><TableCell><Badge variant={entity.healthStatus === 'HEALTHY' ? 'default' : 'secondary'}>{entity.healthStatus || 'UNKNOWN'}</Badge></TableCell><TableCell><Switch checked={entity.enabled ?? false} onCheckedChange={async (enabled) => { try { await enableWorkflowResource(kind, entity.id!, enabled); refresh() } catch (cause) { toast.error(readableError(cause, '状态更新失败')) } }} /></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => void check(entity)}>检查连接</Button><Button size="icon" variant="ghost" onClick={() => setDraft(editCopy(entity))}><PencilSimple size={14} /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => setRemoveTarget(entity)}><Trash size={14} /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
      {query.data ? <div className="mt-4"><Pagination page={page} size={query.data.size} total={query.data.total} onPageChange={setPage} /></div> : null}

      <ResourceDialog kind={kind} draft={draft} busy={saveMutation.isPending} onClose={() => setDraft(null)} onChange={setDraft} onSave={() => { if (!draft?.name?.trim()) { toast.error('名称不能为空'); return } void saveMutation.mutate(draft) }} onCheck={() => draft && void check(draft)} />
      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除{kindLabels[kind]}</AlertDialogTitle><AlertDialogDescription>将删除“{removeTarget?.name}”。若仍被工作流引用，后端会拒绝普通删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={async () => { if (!removeTarget?.id) return; try { await removeWorkflowResources(kind, [removeTarget.id]); toast.success('已删除'); refresh() } catch (cause) { toast.error(readableError(cause, '删除失败')) } finally { setRemoveTarget(null) } }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

function ResourceDialog({ kind, draft, busy, onClose, onChange, onSave, onCheck }: { kind: WorkflowResourceKind; draft: WorkflowManagedResource | null; busy: boolean; onClose: () => void; onChange: (value: WorkflowManagedResource) => void; onSave: () => void; onCheck: () => void }) {
  if (!draft) return null
  const set = (key: string, value: unknown) => onChange({ ...draft, [key]: value })
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{draft.id ? '编辑' : '新建'}{kindLabels[kind]}</DialogTitle><DialogDescription>密码仅在本次提交中使用，编辑时留空表示不修改。</DialogDescription></DialogHeader><div className="grid grid-cols-2 gap-4"><Field label="名称"><Input value={draft.name ?? ''} onChange={(event) => set('name', event.target.value)} /></Field><Field label="类型"><Select value={draft.type ?? typeOptions[kind][0]} onValueChange={(value) => set('type', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{typeOptions[kind].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field>{kind === 'datasource' || kind === 'cache' ? <><Field label="地址"><Input value={'ip' in draft ? draft.ip ?? '' : ''} onChange={(event) => set('ip', event.target.value)} placeholder="127.0.0.1" /></Field><Field label="端口"><Input type="number" value={'port' in draft ? draft.port ?? '' : ''} onChange={(event) => set('port', kind === 'datasource' ? event.target.value : Number(event.target.value))} /></Field><Field label="数据库"><Input value={'db' in draft ? draft.db ?? '' : ''} onChange={(event) => set('db', kind === 'datasource' ? event.target.value : Number(event.target.value))} /></Field></> : null}{kind === 'mq' ? <><Field label="连接地址"><Input value={'address' in draft ? draft.address ?? '' : ''} onChange={(event) => set('address', event.target.value)} /></Field><Field label="端口"><Input type="number" value={'port' in draft ? draft.port ?? '' : ''} onChange={(event) => set('port', Number(event.target.value))} /></Field></> : null}{kind !== 'channel' ? <><Field label="用户名"><Input value={draft.username ?? ''} onChange={(event) => set('username', event.target.value)} autoComplete="off" /></Field><Field label="密码"><Input type="password" value={draft.password ?? ''} onChange={(event) => set('password', event.target.value)} autoComplete="new-password" /></Field></> : null}<Field label="扩展配置（JSON）" className="col-span-2"><Textarea className="min-h-28 font-mono text-xs" value={draft.config ?? ''} onChange={(event) => set('config', event.target.value)} placeholder="{}" /></Field><Field label="备注" className="col-span-2"><Input value={draft.remark ?? ''} onChange={(event) => set('remark', event.target.value)} /></Field><label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={draft.enabled ?? false} onCheckedChange={(value) => set('enabled', value)} /> 启用</label></div><DialogFooter><Button variant="outline" onClick={onCheck}>检查连接</Button><Button onClick={onSave} disabled={busy}>{busy ? '保存中…' : '保存'}</Button></DialogFooter></DialogContent></Dialog>
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-1.5 block">{label}</Label>{children}</div>
}
