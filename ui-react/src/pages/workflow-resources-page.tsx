import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
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
import { checkSavedWorkflowResource, checkWorkflowResource, createWorkflowResource, enableWorkflowResource, pageWorkflowResources, removeWorkflowResources, updateWorkflowResource, workflowResourcesSummary } from '@/api/workflowResources'
import { readableError } from '@/lib/utils'

const kindLabels: Record<WorkflowResourceKind, string> = { datasource: '数据源', cache: '缓存', mq: '消息队列', channel: '通知渠道' }
const typeOptions: Record<WorkflowResourceKind, string[]> = {
  datasource: ['MYSQL', 'POSTGRESQL', 'ORACLE'],
  cache: ['REDIS'],
  mq: ['KAFKA', 'RABBITMQ', 'ROCKETMQ'],
  channel: ['EMAIL', 'WECOM', 'DINGTALK', 'FEISHU'],
}

const defaultPorts: Record<string, string | number> = {
  MYSQL: '3306',
  POSTGRESQL: '5432',
  ORACLE: '1521',
  REDIS: 6379,
  KAFKA: 9092,
  RABBITMQ: 5672,
  ROCKETMQ: 9876,
}

type ChannelConfig = Record<string, string>

export function parseChannelConfig(config?: string): ChannelConfig {
  if (!config?.trim()) return {}
  try {
    const value = JSON.parse(config)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ChannelConfig : {}
  } catch {
    return {}
  }
}

function channelConfigFor(type: string): ChannelConfig {
  return type === 'EMAIL'
    ? { serverHost: '', serverPort: '465', sender: '', enableSmtpAuth: 'true', user: '', passwd: '', starttlsEnable: 'true', sslEnable: 'true', smtpSslTrust: '*' }
    : { webhook: '' }
}

export function defaultResourceDraft(kind: WorkflowResourceKind): WorkflowManagedResource {
  const type = typeOptions[kind][0]
  const base: WorkflowManagedResource = { enabled: true, type }
  if (kind === 'datasource') return { ...base, port: defaultPorts[type] as string }
  if (kind === 'cache') return { ...base, port: defaultPorts[type] as number, db: 0 }
  if (kind === 'mq') return { ...base, port: defaultPorts[type] as number }
  return { ...base, config: JSON.stringify(channelConfigFor(type)) }
}

export function validateResourceDraft(kind: WorkflowResourceKind, entity: WorkflowManagedResource): string | null {
  if (!entity.name?.trim()) return '名称不能为空'
  if (!entity.type) return '类型不能为空'
  if (kind === 'datasource' || kind === 'cache') {
    if (!('ip' in entity) || !entity.ip?.trim()) return '地址不能为空'
    const port = Number(entity.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return '端口范围为 1-65535'
    if (kind === 'datasource' && (!('db' in entity) || !String(entity.db ?? '').trim())) return '数据库/服务名不能为空'
    if (kind === 'cache' && (!('db' in entity) || !Number.isInteger(Number(entity.db)) || Number(entity.db) < 0)) return 'DB 不能小于 0'
  }
  if (kind === 'mq') {
    if (!('address' in entity) || !entity.address?.trim()) return '连接地址不能为空'
    const port = Number(entity.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return '端口范围为 1-65535'
  }
  if (entity.config?.trim()) {
    try { JSON.parse(entity.config) } catch { return '扩展配置必须是合法 JSON' }
  }
  if (kind === 'channel') {
    const config = parseChannelConfig(entity.config)
    if (entity.type === 'EMAIL' && !config.serverHost?.trim()) return 'SMTP 服务器地址不能为空'
    if (entity.type !== 'EMAIL' && !config.webhook?.trim()) return 'Webhook 地址不能为空'
  }
  return null
}

function editCopy(entity: WorkflowManagedResource): WorkflowManagedResource {
  const { password: _password, ...safe } = entity
  return { ...safe, password: '' }
}

export function WorkflowResourcesPage() {
  const queryClient = useQueryClient()
  // 页签状态进 URL，便于深链直达与回归验证
  const [searchParams, setSearchParams] = useSearchParams()
  const kindParam = searchParams.get('kind')
  const kind: WorkflowResourceKind = kindParam === 'cache' || kindParam === 'mq' || kindParam === 'channel' ? kindParam : 'datasource'
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
      if (entity.id && !entity.config) delete payload.config
      return entity.id ? updateWorkflowResource(kind, payload) : createWorkflowResource(kind, payload)
    },
    onSuccess: () => { toast.success('已保存'); setDraft(null); refresh() },
    onError: (cause) => toast.error(readableError(cause, '保存失败')),
  })

  async function check(entity: WorkflowManagedResource, saved = false) {
    try {
      const response = saved && entity.id ? await checkSavedWorkflowResource(kind, entity.id) : await checkWorkflowResource(kind, entity)
      if (response.data.data) toast.success('连接检查通过')
      else toast.error('连接检查未通过')
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '连接检查失败'))
    }
  }

  const records = query.data?.records ?? []
  const summaryQuery = useQuery({
    queryKey: ['workflow-resources', 'summary'],
    queryFn: async () => (await workflowResourcesSummary()).data.data,
  })
  const summary = summaryQuery.data
  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><Database size={18} /> Workflow resources</div><h1 className="font-display text-[26px] font-bold tracking-tight">工作流资源</h1><p className="mt-1 text-sm text-muted-foreground">管理工作流节点引用的数据源、缓存、消息队列和通知渠道。{summary ? <>当前共 <Badge variant="secondary">{summary.total ?? 0}</Badge> 项：数据源 {summary.datasourceTotal ?? 0}、缓存 {summary.cacheTotal ?? 0}、消息队列 {summary.mqTotal ?? 0}、通知渠道 {summary.channelTotal ?? 0}。</> : null}</p></div><Button onClick={() => setDraft(defaultResourceDraft(kind))}><Plus size={14} /> 新建{kindLabels[kind]}</Button></div>
      <Tabs value={kind} onValueChange={(value) => { setSearchParams(value === 'datasource' ? {} : { kind: value }, { replace: true }); setPage(1); setSearch('') }}><TabsList>{(Object.keys(kindLabels) as WorkflowResourceKind[]).map((item) => <TabsTrigger key={item} value={item}>{kindLabels[item]}</TabsTrigger>)}</TabsList></Tabs>
      <div className="my-4 relative w-72"><MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="按名称搜索" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></div>
      {query.isLoading ? <TableSkeleton rows={6} /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : records.length === 0 ? <EmptyState title={`暂无${kindLabels[kind]}`} description="创建后可在工作流节点配置中引用。" /> : <div className="rounded-lg border border-border bg-card"><Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>类型</TableHead><TableHead>连接</TableHead><TableHead>健康状态</TableHead><TableHead>启用</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{records.map((entity) => <TableRow key={entity.id}><TableCell><div className="font-medium">{entity.name}</div><div className="max-w-64 truncate text-xs text-muted-foreground">{entity.remark || entity.lastCheckMessage}</div></TableCell><TableCell><Badge variant="outline">{entity.type || '-'}</Badge></TableCell><TableCell className="font-mono text-xs">{'ip' in entity ? `${entity.ip || ''}${entity.port ? `:${entity.port}` : ''}` : 'address' in entity ? `${entity.address || ''}${entity.port ? `:${entity.port}` : ''}` : 'JSON 配置'}</TableCell><TableCell><Badge variant={entity.healthStatus === 'HEALTHY' ? 'default' : 'secondary'}>{entity.healthStatus || 'UNKNOWN'}</Badge></TableCell><TableCell><Switch checked={entity.enabled ?? false} onCheckedChange={async (enabled) => { try { await enableWorkflowResource(kind, entity.id!, enabled); refresh() } catch (cause) { toast.error(readableError(cause, '状态更新失败')) } }} /></TableCell><TableCell><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => void check(entity, true)}>检查连接</Button><Button size="icon" variant="ghost" aria-label={`编辑 ${entity.name}`} onClick={() => setDraft(editCopy(entity))}><PencilSimple size={14} /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`删除 ${entity.name}`} onClick={() => setRemoveTarget(entity)}><Trash size={14} /></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
      {query.data ? <div className="mt-4"><Pagination page={page} size={query.data.size} total={query.data.total} onPageChange={setPage} /></div> : null}

      <ResourceDialog kind={kind} draft={draft} busy={saveMutation.isPending} onClose={() => setDraft(null)} onChange={setDraft} onSave={() => { if (!draft) return; const message = validateResourceDraft(kind, draft); if (message) { toast.error(message); return } void saveMutation.mutate(draft) }} onCheck={() => { if (!draft) return; const message = validateResourceDraft(kind, draft); if (message) { toast.error(message); return } void check(draft) }} />
      <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除{kindLabels[kind]}</AlertDialogTitle><AlertDialogDescription>将删除“{removeTarget?.name}”。若仍被工作流引用，后端会拒绝普通删除。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={async () => { if (!removeTarget?.id) return; try { await removeWorkflowResources(kind, [removeTarget.id]); toast.success('已删除'); refresh() } catch (cause) { toast.error(readableError(cause, '删除失败')) } finally { setRemoveTarget(null) } }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </div>
  )
}

function ResourceDialog({ kind, draft, busy, onClose, onChange, onSave, onCheck }: { kind: WorkflowResourceKind; draft: WorkflowManagedResource | null; busy: boolean; onClose: () => void; onChange: (value: WorkflowManagedResource) => void; onSave: () => void; onCheck: () => void }) {
  if (!draft) return null
  const set = (key: string, value: unknown) => onChange({ ...draft, [key]: value })
  const setType = (value: string) => {
    const next: WorkflowManagedResource & { port?: string | number } = { ...draft, type: value }
    if (kind === 'channel') next.config = JSON.stringify(channelConfigFor(value))
    else if (defaultPorts[value] !== undefined) next.port = defaultPorts[value]
    onChange(next)
  }
  const channelConfig = parseChannelConfig(draft.config)
  const setChannel = (key: string, value: string) => set('config', JSON.stringify({ ...channelConfig, [key]: value }))
  return <Dialog open onOpenChange={(open) => { if (!open) onClose() }}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{draft.id ? '编辑' : '新建'}{kindLabels[kind]}</DialogTitle>{kind !== 'channel' ? <DialogDescription>编辑时密码留空表示不修改。</DialogDescription> : null}</DialogHeader><div className="grid grid-cols-2 gap-4"><Field label="名称 *"><Input value={draft.name ?? ''} onChange={(event) => set('name', event.target.value)} /></Field><Field label="类型"><Select value={draft.type ?? typeOptions[kind][0]} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{typeOptions[kind].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field>{kind === 'datasource' || kind === 'cache' ? <><Field label="地址"><Input value={'ip' in draft ? draft.ip ?? '' : ''} onChange={(event) => set('ip', event.target.value)} placeholder="127.0.0.1" /></Field><Field label="端口 *"><Input type="number" min={1} max={65535} value={'port' in draft ? draft.port ?? '' : ''} onChange={(event) => set('port', kind === 'datasource' ? event.target.value : Number(event.target.value))} /></Field><Field label={kind === 'datasource' ? '数据库/服务名' : 'DB'}><Input type={kind === 'cache' ? 'number' : 'text'} min={kind === 'cache' ? 0 : undefined} value={'db' in draft ? draft.db ?? '' : ''} onChange={(event) => set('db', kind === 'datasource' ? event.target.value : Number(event.target.value))} /></Field></> : null}{kind === 'mq' ? <><Field label="连接地址"><Input value={'address' in draft ? draft.address ?? '' : ''} onChange={(event) => set('address', event.target.value)} /></Field><Field label="端口 *"><Input type="number" min={1} max={65535} value={'port' in draft ? draft.port ?? '' : ''} onChange={(event) => set('port', Number(event.target.value))} /></Field></> : null}{kind !== 'channel' ? <><Field label="用户名"><Input value={draft.username ?? ''} onChange={(event) => set('username', event.target.value)} autoComplete="off" /></Field><Field label="密码"><Input type="password" value={draft.password ?? ''} onChange={(event) => set('password', event.target.value)} autoComplete="new-password" /></Field></> : null}{kind === 'channel' ? <ChannelConfigFields type={draft.type ?? 'EMAIL'} config={channelConfig} onChange={setChannel} /> : <Field label="扩展配置（JSON）" className="col-span-2"><Textarea className="min-h-28 font-mono text-xs" value={draft.config ?? ''} onChange={(event) => set('config', event.target.value)} placeholder='例如：{"timeout":5000}' /></Field>}<Field label="备注" className="col-span-2"><Input value={draft.remark ?? ''} onChange={(event) => set('remark', event.target.value)} /></Field><label className="col-span-2 flex items-center gap-2 text-sm"><Switch checked={draft.enabled ?? false} onCheckedChange={(value) => set('enabled', value)} /> 启用</label></div><DialogFooter><Button variant="outline" onClick={onCheck}>检查连接</Button><Button onClick={onSave} disabled={busy}>{busy ? (draft.id ? '保存中…' : '创建中…') : (draft.id ? '保存' : '创建')}</Button></DialogFooter></DialogContent></Dialog>
}

function ChannelConfigFields({ type, config, onChange }: { type: string; config: ChannelConfig; onChange: (key: string, value: string) => void }) {
  if (type !== 'EMAIL') return <>
    <Field label="Webhook 地址" className="col-span-2"><Input value={config.webhook ?? ''} onChange={(event) => onChange('webhook', event.target.value)} placeholder="https://..." /></Field>
    {type === 'DINGTALK' ? <Field label="安全关键词" className="col-span-2"><Input value={config.keyword ?? ''} onChange={(event) => onChange('keyword', event.target.value)} /></Field> : null}
    {type === 'FEISHU' ? <Field label="签名密钥" className="col-span-2"><Input type="password" value={config.secret ?? ''} onChange={(event) => onChange('secret', event.target.value)} autoComplete="new-password" /></Field> : null}
  </>
  return <>
    <Field label="SMTP 服务器 *"><Input value={config.serverHost ?? ''} onChange={(event) => onChange('serverHost', event.target.value)} placeholder="smtp.example.com" /></Field>
    <Field label="端口 *"><Input type="number" min={1} max={65535} value={config.serverPort ?? '465'} onChange={(event) => onChange('serverPort', event.target.value)} /></Field>
    <Field label="发件人地址 *" className="col-span-2"><Input value={config.sender ?? ''} onChange={(event) => onChange('sender', event.target.value)} placeholder="noreply@example.com" /></Field>
    <Field label="用户名"><Input value={config.user ?? ''} onChange={(event) => onChange('user', event.target.value)} autoComplete="off" /></Field>
    <Field label="密码/授权码"><Input type="password" value={config.passwd ?? ''} onChange={(event) => onChange('passwd', event.target.value)} autoComplete="new-password" /></Field>
    <Field label="SMTP 认证"><BooleanSelect value={config.enableSmtpAuth ?? 'true'} onChange={(value) => onChange('enableSmtpAuth', value)} /></Field>
    <Field label="SSL 信任"><Input value={config.smtpSslTrust ?? '*'} onChange={(event) => onChange('smtpSslTrust', event.target.value)} /></Field>
    <Field label="STARTTLS"><BooleanSelect value={config.starttlsEnable ?? 'true'} onChange={(value) => onChange('starttlsEnable', value)} /></Field>
    <Field label="SSL"><BooleanSelect value={config.sslEnable ?? 'true'} onChange={(value) => onChange('sslEnable', value)} /></Field>
  </>
}

function BooleanSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="true">开启</SelectItem><SelectItem value="false">关闭</SelectItem></SelectContent></Select>
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <div className={className}><Label className="mb-1.5 block">{label}</Label>{children}</div>
}
