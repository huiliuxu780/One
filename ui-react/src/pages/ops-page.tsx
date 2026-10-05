import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { DownloadSimple, MagnifyingGlass, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
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
import { readableError } from '@/lib/utils'
import { batchDownloadAttachments, deleteAttachments, downloadAttachment, pageAttachmentLogs, pageAttachments } from '@/api/attach'
import { heartbeat, storageProtocols } from '@/api/settings'
import type { Attach, AttachLog, StorageProtocol } from '@/types'

export function OpsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['nodes', 'storage', 'files', 'logs'].includes(searchParams.get('tab') || '') ? searchParams.get('tab')! : 'nodes'
  return <div className="px-6 py-6"><h1 className="text-xl font-semibold tracking-tight">运维</h1><p className="mb-4 mt-1 text-sm text-muted-foreground">执行节点、存储配置、全局附件与操作日志。</p><Tabs value={tab} onValueChange={(value) => setSearchParams(value === 'nodes' ? {} : { tab: value }, { replace: true })}><TabsList><TabsTrigger value="nodes">节点监控</TabsTrigger><TabsTrigger value="storage">存储配置</TabsTrigger><TabsTrigger value="files">文件管理</TabsTrigger><TabsTrigger value="logs">文件日志</TabsTrigger></TabsList><TabsContent value="nodes"><NodesTab /></TabsContent><TabsContent value="storage"><StorageTab /></TabsContent><TabsContent value="files"><FilesTab /></TabsContent><TabsContent value="logs"><FileLogsTab /></TabsContent></Tabs></div>
}

function NodesTab() {
  const nodesQuery = useQuery({ queryKey: ['list', 'heartbeat-nodes'], queryFn: async () => (await heartbeat.nodes()).data.data, refetchInterval: 15000 })
  const wsQuery = useQuery({ queryKey: ['list', 'heartbeat-ws'], queryFn: async () => (await heartbeat.websocketNodes()).data.data, refetchInterval: 15000 })
  return <div className="space-y-4"><Card><CardContent className="pt-5"><h2 className="mb-3 text-sm font-semibold">执行节点（Runtime / Proxy）</h2>{nodesQuery.isLoading ? <TableSkeleton rows={3} /> : nodesQuery.error ? <ErrorState error={nodesQuery.error} onRetry={() => void nodesQuery.refetch()} /> : (nodesQuery.data ?? []).length === 0 ? <EmptyState title="暂无上报节点" /> : <Table><TableHeader><TableRow><TableHead>节点</TableHead><TableHead>地址</TableHead><TableHead>状态</TableHead><TableHead>最近心跳</TableHead></TableRow></TableHeader><TableBody>{(nodesQuery.data ?? []).map((node, index) => <TableRow key={`${node.nodeId}-${index}`}><TableCell>{node.hostname}</TableCell><TableCell className="font-mono text-xs">{node.ip}</TableCell><TableCell><Badge variant={node.nodeStatus === 'HEALTHY' ? 'default' : 'secondary'}>{node.nodeStatus}</Badge></TableCell><TableCell className="text-xs text-muted-foreground">{node.lastUpdatedAt}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card><Card><CardContent className="pt-5"><h2 className="mb-3 text-sm font-semibold">WebSocket 节点</h2>{wsQuery.isLoading ? <TableSkeleton rows={2} /> : wsQuery.error ? <ErrorState error={wsQuery.error} onRetry={() => void wsQuery.refetch()} /> : (wsQuery.data ?? []).length === 0 ? <EmptyState title="暂无 WebSocket 节点" /> : <Table><TableHeader><TableRow><TableHead>节点</TableHead><TableHead>地址</TableHead><TableHead>状态</TableHead></TableRow></TableHeader><TableBody>{(wsQuery.data ?? []).map((node, index) => <TableRow key={`${node.nodeId}-${index}`}><TableCell>{node.hostname}</TableCell><TableCell className="font-mono text-xs">{node.ip}:{node.port ?? '—'}</TableCell><TableCell><Badge variant={node.status === 'UP' ? 'default' : 'secondary'}>{node.status}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card></div>
}

type StorageDraft = Pick<StorageProtocol, 'name' | 'protocol' | 'remark' | 'valid'> & { id?: string }
const emptyStorage: StorageDraft = { name: '', protocol: 'LOCAL', remark: '', valid: 0 }

function StorageTab() {
  const [keyword, setKeyword] = useState('')
  const [draft, setDraft] = useState<StorageDraft | null>(null)
  const [configTarget, setConfigTarget] = useState<StorageProtocol | null>(null)
  const [removeTarget, setRemoveTarget] = useState<StorageProtocol | null>(null)
  const [busy, setBusy] = useState(false)
  const listQuery = useQuery({ queryKey: ['list', 'storage-protocol'], queryFn: async () => (await storageProtocols.page({ current: 1, size: 999 })).data.data })
  const rows = useMemo(() => (listQuery.data?.records ?? []).filter((row) => !keyword.trim() || [row.name, row.protocol, row.remark].some((value) => value?.toLowerCase().includes(keyword.trim().toLowerCase()))), [keyword, listQuery.data])
  async function save() { if (!draft) return; setBusy(true); try { if (draft.id) await storageProtocols.update(draft); else await storageProtocols.save({ ...draft, protocolConfig: defaultProtocolConfig(draft.protocol) }); toast.success('存储配置已保存'); setDraft(null); void listQuery.refetch() } catch (cause) { toast.error(readableError(cause, '保存失败')) } finally { setBusy(false) } }
  async function openConfig(row: StorageProtocol) { try { setConfigTarget((await storageProtocols.detail(String(row.id))).data.data) } catch (cause) { toast.error(readableError(cause, '配置读取失败')) } }
  return <Card><CardContent className="pt-5"><div className="mb-3 flex items-center justify-between gap-3"><div className="relative w-72"><MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="搜索名称、协议或备注" value={keyword} onChange={(event) => setKeyword(event.target.value)} /></div><Button onClick={() => setDraft({ ...emptyStorage })}><Plus size={14} /> 新增配置</Button></div>{listQuery.isLoading ? <TableSkeleton rows={3} /> : listQuery.error ? <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} /> : rows.length === 0 ? <EmptyState title="暂无存储配置" description="附件和工作空间需要一个启用的存储配置。" /> : <Table><TableHeader><TableRow><TableHead>名称</TableHead><TableHead>协议</TableHead><TableHead>备注</TableHead><TableHead>启用</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={String(row.id)}><TableCell>{row.name}</TableCell><TableCell><Badge variant="outline">{row.protocol}</Badge></TableCell><TableCell className="max-w-64 truncate text-sm text-muted-foreground">{row.remark || '—'}</TableCell><TableCell><Switch checked={row.valid === 1} disabled={row.valid === 1} onCheckedChange={async (checked) => { if (!checked) return; try { await storageProtocols.enable(String(row.id)); toast.success('已设为唯一启用配置'); void listQuery.refetch() } catch (cause) { toast.error(readableError(cause, '启用失败')) } }} /></TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => void openConfig(row)}>协议配置</Button><Button variant="ghost" size="icon" onClick={() => setDraft({ id: String(row.id), name: row.name, protocol: row.protocol, remark: row.remark, valid: row.valid })}><PencilSimple size={14} /></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setRemoveTarget(row)}><Trash size={14} /></Button></div></TableCell></TableRow>)}</TableBody></Table>}<StorageFormDialog draft={draft} busy={busy} onChange={setDraft} onSave={() => void save()} /><ProtocolConfigDialog key={configTarget ? `${configTarget.id}-${configTarget.protocol}` : 'none'} target={configTarget} onClose={() => setConfigTarget(null)} onSaved={() => { setConfigTarget(null); void listQuery.refetch() }} /><AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除存储配置</AlertDialogTitle><AlertDialogDescription>将删除“{removeTarget?.name}”。正在使用的配置可能导致后续附件操作失败。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { if (!removeTarget) return; try { await storageProtocols.remove([String(removeTarget.id)]); toast.success('已删除'); void listQuery.refetch() } catch (cause) { toast.error(readableError(cause, '删除失败')) } finally { setRemoveTarget(null) } }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
}

function StorageFormDialog({ draft, busy, onChange, onSave }: { draft: StorageDraft | null; busy: boolean; onChange: (draft: StorageDraft | null) => void; onSave: () => void }) {
  if (!draft) return null
  const set = <K extends keyof StorageDraft>(key: K, value: StorageDraft[K]) => onChange({ ...draft, [key]: value })
  return <Dialog open onOpenChange={(open) => !open && onChange(null)}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>{draft.id ? '编辑' : '新增'}存储配置</DialogTitle><DialogDescription>切换协议会清空原协议配置；保存后请进入“协议配置”填写连接参数。</DialogDescription></DialogHeader><div className="grid gap-3"><div><Label>名称</Label><Input value={draft.name} onChange={(event) => set('name', event.target.value)} /></div><div><Label>协议</Label><Select value={draft.protocol} onValueChange={(value) => set('protocol', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['S3', 'FTP', 'LOCAL'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div><div><Label>备注</Label><Textarea value={draft.remark} onChange={(event) => set('remark', event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => onChange(null)}>取消</Button><Button disabled={busy || !draft.name.trim()} onClick={onSave}>{busy ? '保存中…' : '保存'}</Button></DialogFooter></DialogContent></Dialog>
}

function ProtocolConfigDialog({ target, onClose, onSaved }: { target: StorageProtocol | null; onClose: () => void; onSaved: () => void }) {
  const original = useMemo(() => parseObject(target?.protocolConfig), [target])
  const [form, setForm] = useState<Record<string, string | number>>({})
  const [busy, setBusy] = useState(false)
  if (!target) return null
  const values = { ...original, ...form }
  const set = (key: string, value: string | number) => setForm((current) => ({ ...current, [key]: value }))
  const fields = target.protocol === 'S3' ? [['endpoint', 'Endpoint', 'text'], ['accessKey', 'AccessKey', 'text'], ['secretKey', 'SecretKey', 'password'], ['bucketName', 'Bucket 名称', 'text'], ['appId', 'AppId', 'text'], ['region', 'Region', 'text']] : target.protocol === 'FTP' ? [['host', '主机地址', 'text'], ['port', '端口', 'number'], ['userName', '用户名', 'text'], ['password', '密码', 'password']] : [['localDir', '本地存储目录', 'text']]
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>协议配置 · {target.name}</DialogTitle><DialogDescription>敏感值不在页面回显；密码框留空表示保留后端当前值。</DialogDescription></DialogHeader><div className="grid gap-3">{fields.map(([key, label, type]) => <div key={key}><Label>{label}</Label><Input type={type} value={type === 'password' && !(key in form) ? '' : String(values[key] ?? '')} placeholder={type === 'password' && original[key] ? '已配置，留空不修改' : undefined} onChange={(event) => set(key, type === 'number' ? Number(event.target.value) : event.target.value)} /></div>)}</div><DialogFooter><Button variant="outline" onClick={onClose}>取消</Button><Button disabled={busy} onClick={async () => { setBusy(true); try { const next = { ...original, ...form }; for (const [key, , type] of fields) if (type === 'password' && form[key] === '') next[key] = original[key]; await storageProtocols.updateProtocol({ id: String(target.id), protocolConfig: JSON.stringify(next) }); toast.success('协议配置已保存'); onSaved() } catch (cause) { toast.error(readableError(cause, '保存失败')) } finally { setBusy(false) } }}>{busy ? '保存中…' : '保存'}</Button></DialogFooter></DialogContent></Dialog>
}

function FilesTab() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [removeTarget, setRemoveTarget] = useState<Attach[]>([])
  const query = useQuery({ queryKey: ['list', 'attachments', keyword, page], queryFn: async () => (await pageAttachments({ current: page, size: 20, originalName: keyword || undefined })).data.data })
  const rows = query.data?.records ?? []
  async function download(row: Attach) { try { saveBlob((await downloadAttachment(row.id)).data, row.originalName || row.name || 'download'); toast.success('下载已开始') } catch (cause) { toast.error(readableError(cause, '下载失败')) } }
  return <Card><CardContent className="pt-5"><div className="mb-3 flex items-center justify-between gap-3"><div className="relative w-72"><MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-8" placeholder="附件名称" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} /></div><div className="flex gap-2"><Button variant="outline" disabled={!selected.length} onClick={async () => { try { saveBlob((await batchDownloadAttachments(selected)).data, '批量下载.zip') } catch (cause) { toast.error(readableError(cause, '批量下载失败')) } }}><DownloadSimple size={14} /> 批量下载</Button><Button variant="outline" className="text-destructive" disabled={!selected.length} onClick={() => setRemoveTarget(rows.filter((row) => selected.includes(String(row.id))))}><Trash size={14} /> 删除</Button></div></div>{query.isLoading ? <TableSkeleton rows={5} /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState title="暂无附件" /> : <><Table><TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>文件</TableHead><TableHead>类型</TableHead><TableHead>大小</TableHead><TableHead>协议</TableHead><TableHead>创建时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={String(row.id)}><TableCell><input type="checkbox" checked={selected.includes(String(row.id))} onChange={(event) => setSelected((value) => event.target.checked ? [...value, String(row.id)] : value.filter((id) => id !== String(row.id)))} aria-label={`选择 ${row.originalName}`} /></TableCell><TableCell className="max-w-64 truncate font-medium">{row.originalName || row.name || '未命名'}</TableCell><TableCell>{row.extension || '—'}</TableCell><TableCell>{formatBytes(row.attachSize)}</TableCell><TableCell>{row.protocol || '—'}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(row.createAt)}</TableCell><TableCell><div className="flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => void download(row)}>下载</Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => setRemoveTarget([row])}><Trash size={14} /></Button></div></TableCell></TableRow>)}</TableBody></Table>{query.data && query.data.total > query.data.size ? <Pagination page={page} size={query.data.size} total={query.data.total} onPageChange={setPage} /> : null}</>}<AlertDialog open={removeTarget.length > 0} onOpenChange={(open) => !open && setRemoveTarget([])}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>删除附件</AlertDialogTitle><AlertDialogDescription>将永久删除选中的 {removeTarget.length} 个文件及其存储内容。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={async () => { try { await deleteAttachments(removeTarget.map((row) => String(row.id))); toast.success('附件已删除'); setSelected([]); void query.refetch() } catch (cause) { toast.error(readableError(cause, '删除失败')) } finally { setRemoveTarget([]) } }}>确认删除</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
}

function FileLogsTab() {
  const [keyword, setKeyword] = useState('')
  const [optType, setOptType] = useState('ALL')
  const [page, setPage] = useState(1)
  const query = useQuery({ queryKey: ['list', 'attachment-logs', keyword, optType, page], queryFn: async () => (await pageAttachmentLogs({ current: page, size: 20, originalName: keyword || undefined, optType: optType === 'ALL' ? undefined : optType })).data.data })
  const rows = query.data?.records ?? []
  return <Card><CardContent className="pt-5"><div className="mb-3 flex gap-2"><Input className="w-72" placeholder="附件名称" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} /><Select value={optType} onValueChange={(value) => { setOptType(value); setPage(1) }}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">全部行为</SelectItem><SelectItem value="UPLOAD">上传</SelectItem><SelectItem value="DOWNLOAD">下载</SelectItem><SelectItem value="DELETE">删除</SelectItem></SelectContent></Select></div>{query.isLoading ? <TableSkeleton rows={5} /> : query.error ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState title="暂无文件日志" /> : <><Table><TableHeader><TableRow><TableHead>文件</TableHead><TableHead>行为</TableHead><TableHead>类型</TableHead><TableHead>大小</TableHead><TableHead>操作人</TableHead><TableHead>时间</TableHead></TableRow></TableHeader><TableBody>{rows.map((row: AttachLog) => <TableRow key={String(row.id)}><TableCell className="max-w-72 truncate font-medium">{row.originalName || '未命名'}</TableCell><TableCell><Badge variant={row.optType === 'UPLOAD' ? 'default' : row.optType === 'DOWNLOAD' ? 'secondary' : 'outline'} className={row.optType === 'DELETE' ? 'border-destructive/30 text-destructive' : undefined}>{({ UPLOAD: '上传', DOWNLOAD: '下载', DELETE: '删除' } as Record<string, string>)[row.optType] || row.optType}</Badge></TableCell><TableCell>{row.extension || '—'}</TableCell><TableCell>{formatBytes(row.attachSize)}</TableCell><TableCell>{row.optUserName || '—'}</TableCell><TableCell className="text-xs text-muted-foreground">{formatDate(row.optTime)}</TableCell></TableRow>)}</TableBody></Table>{query.data && query.data.total > query.data.size ? <Pagination page={page} size={query.data.size} total={query.data.total} onPageChange={setPage} /> : null}</>}</CardContent></Card>
}

function defaultProtocolConfig(protocol: string) { return JSON.stringify(protocol === 'S3' ? { bucketName: 'apboa', pathStyleAccess: true } : protocol === 'FTP' ? { port: 21, encoding: 'UTF-8' } : { localDir: '/home' }) }
function parseObject(value?: string) { try { const parsed = JSON.parse(value || '{}') as unknown; return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string | number | boolean> : {} } catch { return {} } }
function formatBytes(bytes = 0) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB` }
function formatDate(value?: string) { return value ? new Date(value).toLocaleString() : '—' }
function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  // click() 仅启动下载；同步回收在某些浏览器会让 blob 提前失效，延迟撤销。
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
