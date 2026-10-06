import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ArrowClockwise, MagnifyingGlass, Plus, Plugs, Wrench } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, NoMatchState, TableSkeleton } from '@/components/states'
import { SearchInput } from '@/components/search-input'
import { readableError } from '@/lib/utils'
import { mcpServers } from '@/api/resources'
import type { McpServerVO, McpToolVO } from '@/types'
import { HealthStatus, McpActivationStatus, McpFailureSource } from '@/types'
import { usePagedList } from '@/features/data/paged'
import { McpServerFormDialog } from '@/features/resources/mcp-server-form'
import { buildToolDebugArguments, toolDebugInitialValues, type ToolInputSchemaItem } from '@/features/resources/tool-debug-dialog'

export function mcpDebugFields(schema: Record<string, unknown> | null): ToolInputSchemaItem[] {
  const properties = schema?.properties
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return []
  const required = Array.isArray(schema?.required) ? schema.required : []
  return Object.entries(properties).map(([name, value]) => {
    const field = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    return { name, type: typeof field.type === 'string' ? field.type : 'string', description: typeof field.description === 'string' ? field.description : '', defaultValue: field.default, required: required.includes(name), enum: Array.isArray(field.enum) ? field.enum : undefined }
  }).sort((a, b) => Number(Boolean(b.required)) - Number(Boolean(a.required)))
}

function statusBadge(server: McpServerVO) {
  if (server.activationStatus === McpActivationStatus.ACTIVE) return <Badge>已激活</Badge>
  if (server.activationStatus === McpActivationStatus.FAILED) return <Badge variant="outline" className="border-destructive/40 text-destructive">激活失败</Badge>
  return <Badge variant="secondary">{server.activationStatus || '未激活'}</Badge>
}

export function McpPage() {
  const [search, setSearch] = useState('')
  const [protocolFilter, setProtocolFilter] = useState('')
  const paged = usePagedList<McpServerVO>({
    resource: 'mcp',
    fetcher: async (params) => (await mcpServers.page(params)).data.data,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<McpServerVO | null>(null)
  const [toolsServer, setToolsServer] = useState<McpServerVO | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDisable, setPendingDisable] = useState<{ server: McpServerVO; usageCount: number } | null>(null)
  // 旧 Vue 深链 /mcp/:serverId/tools 由 router 转成本页 query，打开指定 Server 的工具治理。
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)

  useEffect(() => {
    if (deepLinkHandled.current) return
    const tools = searchParams.get('tools')
    if (!tools) return
    deepLinkHandled.current = true
    mcpServers.detail(tools).then((response) => {
      if (!response.data.data) throw new Error('MCP Server 不存在或已被删除')
      setToolsServer(response.data.data)
    }).catch((cause) => toast.error(readableError(cause, 'MCP Server 加载失败'))).finally(() => setSearchParams({}, { replace: true }))
  }, [searchParams, setSearchParams])

  const rows = paged.data?.records ?? []

  async function rowAction(label: string, action: () => Promise<unknown>) {
    setBusy(true)
    try {
      await action()
      toast.success(`${label}成功`)
      void paged.refetch()
    } catch (cause) {
      toast.error(`${label}失败：${readableError(cause, '原始错误已展示')}`)
    } finally {
      setBusy(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  async function setServerEnabled(server: McpServerVO, enabled: boolean) {
    await rowAction(enabled ? '启用' : '停用', async () => {
      await mcpServers.update({ id: server.id, enabled })
      setPendingDisable(null)
    })
  }

  async function requestServerEnabled(server: McpServerVO, enabled: boolean) {
    if (!enabled) {
      try {
        const usage = (await mcpServers.usedWithAgent([String(server.id)])).data.data
        if (usage?.length) {
          setPendingDisable({ server, usageCount: usage.length })
          return
        }
      } catch (cause) {
        toast.error(readableError(cause, '无法检查 MCP Server 占用'))
        return
      }
    }
    await setServerEnabled(server, enabled)
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">MCP</h1>
          <p className="mt-1 text-sm text-muted-foreground">MCP Server 管理：激活、工具同步、全局治理与真实调试。</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} /> 新建 Server
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <SearchInput value={search} onChange={(value) => { setSearch(value); paged.setFilter('name', value || undefined) }} />
            <Select value={protocolFilter || 'all'} onValueChange={(value) => { const next = value === 'all' ? '' : value; setProtocolFilter(next); paged.setFilter('protocol', next || undefined) }}>
              <SelectTrigger className="w-36" aria-label="MCP 协议"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">全部协议</SelectItem><SelectItem value="HTTP">HTTP</SelectItem><SelectItem value="SSE">SSE</SelectItem><SelectItem value="STDIO">STDIO</SelectItem></SelectContent>
            </Select>
          </div>

          {paged.isLoading ? (
            <TableSkeleton rows={4} />
          ) : paged.error ? (
            <ErrorState error={paged.error} onRetry={() => void paged.refetch()} />
          ) : rows.length === 0 ? (
            search.trim() || protocolFilter
              ? <NoMatchState summary="没有匹配当前搜索或协议的 MCP Server。" onClear={() => { setSearch(''); setProtocolFilter(''); paged.setFilter('name', undefined); paged.setFilter('protocol', undefined) }} />
              : <EmptyState title="暂无 MCP Server" description="创建一个 Server 并激活后即可同步工具。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>协议/模式</TableHead>
                  <TableHead>激活状态</TableHead>
                  <TableHead>健康</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead>工具</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((server) => (
                  <TableRow key={String(server.id)}>
                    <TableCell>
                      <div className="font-medium">{server.name}</div>
                      <div className="line-clamp-1 text-xs text-muted-foreground">{server.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{server.protocol}</Badge> <Badge variant="outline">{server.mode}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(server)}</TableCell>
                    <TableCell>
                      <Badge variant={server.healthStatus === HealthStatus.HEALTHY ? 'default' : 'secondary'}>{server.healthStatus}</Badge>
                    </TableCell>
                    <TableCell><Switch checked={Boolean(server.enabled)} disabled={busy} onCheckedChange={(enabled) => void requestServerEnabled(server, enabled)} aria-label={`${server.name}启用开关`} /></TableCell>
                    <TableCell>
                      {server.toolCount}/{server.availableToolCount} 可用
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setToolsServer(server)}>
                          <Wrench size={14} /> 工具
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void rowAction('同步工具', () => mcpServers.syncTools(String(server.id)))}>
                          <ArrowClockwise size={14} /> 同步
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void rowAction('激活', () => mcpServers.activate(String(server.id)))}>
                          <Plugs size={14} /> 激活
                        </Button>
                        <Button variant="ghost" size="sm" onClick={async () => { try { setEditing((await mcpServers.detail(String(server.id))).data.data); setFormOpen(true) } catch (cause) { toast.error(readableError(cause, '加载 MCP Server 详情失败')) } }}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => {
                          if (!window.confirm(`确认删除 MCP Server“${server.name}”？该操作不可撤销。`)) return
                          void rowAction('删除', async () => {
                          const used = await mcpServers.usedWithAgent([String(server.id)])
                          if (used.data.data?.length) throw new Error(`仍被 ${used.data.data.length} 处引用`)
                          await mcpServers.remove([String(server.id)])
                          })
                        }}>
                          删除
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

      <McpServerFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={() => void paged.refetch()} />
      <AlertDialog open={pendingDisable != null} onOpenChange={(open) => !open && setPendingDisable(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认停用 MCP Server</AlertDialogTitle><AlertDialogDescription>该 Server 仍被 {pendingDisable?.usageCount} 处引用，停用后相关 Agent 可能无法正常使用。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => pendingDisable && void setServerEnabled(pendingDisable.server, false)}>确认停用</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      {toolsServer ? <ToolsDialog server={toolsServer} onClose={() => setToolsServer(null)} /> : null}
    </div>
  )
}

export function ToolsDialog({ server, onClose }: { server: McpServerVO; onClose: () => void }) {
  const toolsQuery = useQuery({
    queryKey: ['detail', 'mcp-tools', String(server.id)],
    queryFn: async () => (await mcpServers.tools(String(server.id))).data.data,
  })
  const [debugTool, setDebugTool] = useState<McpToolVO | null>(null)
  const [search, setSearch] = useState('')
  const [pendingTool, setPendingTool] = useState<string | null>(null)
  const readOnly = server.activationStatus === McpActivationStatus.FAILED && server.failureSource === McpFailureSource.RUNTIME_AUTO_DEGRADE
  const rows = (toolsQuery.data ?? []).filter((tool) => `${tool.toolName} ${tool.description ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()))

  async function toggleGlobal(tool: McpToolVO, field: 'enabled' | 'needConfirm', value: boolean) {
    if (readOnly || pendingTool) return
    setPendingTool(String(tool.id))
    try {
      if (field === 'enabled') await mcpServers.setGlobalEnabled(String(server.id), [String(tool.id)], value)
      else await mcpServers.setGlobalNeedConfirm(String(server.id), [String(tool.id)], value)
      toast.success('已更新')
      await toolsQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '更新失败'))
    } finally {
      setPendingTool(null)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{server.name} · 工具治理</DialogTitle>
          <DialogDescription>全局启用与人工确认开关立即生效；调试直接调用真实后端并展示原始结果。</DialogDescription>
        </DialogHeader>
        {readOnly ? <p role="alert" className="rounded-md border border-warning/40 p-3 text-sm text-warning">该 MCP 因运行时自动降级处于只读状态；重新连接成功前不能修改工具或调试。</p> : null}
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索工具名称或描述" aria-label="搜索 MCP 工具" />
        {toolsQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : toolsQuery.error ? (
          <ErrorState error={toolsQuery.error} onRetry={() => void toolsQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={search ? '未找到匹配的工具' : '暂无工具目录'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工具</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>全局启用</TableHead>
                <TableHead>需确认</TableHead>
                <TableHead className="text-right">调试</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tool) => (
                <TableRow key={String(tool.id)}>
                  <TableCell className="font-mono text-xs">{tool.toolName}</TableCell>
                  <TableCell className="line-clamp-1 max-w-64 text-xs text-muted-foreground">{tool.description}</TableCell>
                  <TableCell><Switch checked={tool.enabled} disabled={readOnly || pendingTool !== null || tool.missing} onCheckedChange={(checked) => void toggleGlobal(tool, 'enabled', checked)} aria-label={`${tool.toolName} 启用`} /></TableCell>
                  <TableCell><Switch checked={tool.needConfirm} disabled={readOnly || pendingTool !== null || tool.missing || !tool.enabled} onCheckedChange={(checked) => void toggleGlobal(tool, 'needConfirm', checked)} aria-label={`${tool.toolName} 确认`} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled={readOnly || tool.missing || !tool.enabled} onClick={() => setDebugTool(tool)}>调试</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {debugTool ? <DebugDialog tool={debugTool} onClose={() => setDebugTool(null)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

export function DebugDialog({ tool, onClose }: { tool: McpToolVO; onClose: () => void }) {
  const fields = mcpDebugFields(tool.inputSchema)
  const [values, setValues] = useState<Record<string, unknown>>(() => toolDebugInitialValues(fields))
  const [rawMode, setRawMode] = useState(false)
  const [rawJson, setRawJson] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ success: boolean; text: string; durationMs?: number } | null>(null)

  function setValue(name: string, value: unknown) {
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  function toggleRawMode() {
    if (!rawMode) {
      setRawJson(JSON.stringify(values, null, 2))
      setRawMode(true)
      return
    }
    try {
      const parsed: unknown = JSON.parse(rawJson)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('参数必须是 JSON 对象')
      setValues(parsed as Record<string, unknown>)
      setRawMode(false)
    } catch (cause) {
      toast.error(readableError(cause, 'JSON 格式错误'))
    }
  }

  async function run() {
    let input: Record<string, unknown>
    try {
      if (rawMode) {
        const parsed: unknown = JSON.parse(rawJson)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('参数必须是 JSON 对象')
        input = parsed as Record<string, unknown>
      } else {
        input = buildToolDebugArguments(fields, values)
      }
    } catch (cause) {
      toast.error(readableError(cause, '参数无效'))
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const response = await mcpServers.debugTool(String(tool.id), input)
      const result = response.data.data
      setResult({ success: result.success, text: result.success ? JSON.stringify(result.content, null, 2) : (result.errorMessage || '调用失败'), durationMs: result.durationMs })
      if (result.success) toast.success('调试完成')
    } catch (cause) {
      setResult({ success: false, text: readableError(cause, '调试失败') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>调试 {tool.toolName}</DialogTitle>
          <DialogDescription>按输入 Schema 填写参数；调用真实后端执行。</DialogDescription>
        </DialogHeader>
        {fields.length === 0 ? <p className="text-sm text-muted-foreground">此工具无需输入参数。</p> : <Button variant="ghost" size="sm" onClick={toggleRawMode}>{rawMode ? '表单模式' : 'JSON 编辑'}</Button>}
        {rawMode ? <Textarea aria-label="MCP 调试 JSON" className="min-h-32 font-mono text-xs" value={rawJson} onChange={(event) => setRawJson(event.target.value)} /> : (
          <div className="grid max-h-80 gap-3 overflow-auto">
            {fields.map((field) => {
              const name = field.name!
              const type = field.type || 'string'
              const value = values[name]
              return <div key={name}>
                <label htmlFor={`mcp-debug-${name}`} className="mb-1 block text-sm font-medium">{name}{field.required ? <span className="text-destructive"> *</span> : null} <span className="font-normal text-muted-foreground">{type}</span></label>
                {field.enum?.length ? (
                  <Select value={value == null ? '' : String(value)} onValueChange={(selected) => setValue(name, field.enum?.find((item) => String(item) === selected))}>
                    <SelectTrigger id={`mcp-debug-${name}`} aria-label={name}><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent>{field.enum.map((item) => <SelectItem key={String(item)} value={String(item)}>{String(item)}</SelectItem>)}</SelectContent>
                  </Select>
                ) : type === 'boolean' ? (
                  <Select value={value == null ? '' : String(value)} onValueChange={(selected) => setValue(name, selected === 'true')}>
                    <SelectTrigger id={`mcp-debug-${name}`} aria-label={name}><SelectValue placeholder="请选择" /></SelectTrigger>
                    <SelectContent><SelectItem value="true">true</SelectItem><SelectItem value="false">false</SelectItem></SelectContent>
                  </Select>
                ) : type === 'object' || type === 'array' ? (
                  <Textarea id={`mcp-debug-${name}`} aria-label={name} className="min-h-24 font-mono text-xs" value={typeof value === 'string' ? value : JSON.stringify(value ?? field.defaultValue ?? (type === 'array' ? [] : {}), null, 2)} onChange={(event) => setValue(name, event.target.value)} />
                ) : (
                  <Input id={`mcp-debug-${name}`} type={type === 'integer' || type === 'number' ? 'number' : 'text'} step={type === 'integer' ? '1' : type === 'number' ? 'any' : undefined} value={value == null ? '' : String(value)} onChange={(event) => setValue(name, event.target.value)} />
                )}
                {field.description ? <p className="mt-1 text-xs text-muted-foreground">{field.description}</p> : null}
              </div>
            })}
          </div>
        )}
        {result ? <div><p className={result.success ? 'text-sm text-success' : 'text-sm text-destructive'}>{result.success ? '成功' : '失败'}{result.durationMs != null ? ` · ${result.durationMs} ms` : ''}</p><pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">{result.text}</pre></div> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button onClick={() => void run()} disabled={busy}>{busy ? '执行中…' : '执行调试'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
