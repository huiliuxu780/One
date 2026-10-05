import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowClockwise, MagnifyingGlass, Plus, Plugs, Wrench } from '@phosphor-icons/react'
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
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import { mcpServers } from '@/api/resources'
import type { McpServerVO, McpToolVO } from '@/types'
import { HealthStatus, McpActivationStatus, McpMode, McpProtocol } from '@/types'
import { usePagedList } from '@/features/data/paged'

function statusBadge(server: McpServerVO) {
  if (server.activationStatus === McpActivationStatus.ACTIVE) return <Badge>已激活</Badge>
  if (server.activationStatus === McpActivationStatus.FAILED) return <Badge variant="outline" className="border-destructive/40 text-destructive">激活失败</Badge>
  return <Badge variant="secondary">{server.activationStatus || '未激活'}</Badge>
}

export function McpPage() {
  const [search, setSearch] = useState('')
  const paged = usePagedList<McpServerVO>({
    resource: 'mcp',
    fetcher: async (params) => (await mcpServers.page({ ...params, name: search || undefined })).data.data,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<McpServerVO | null>(null)
  const [toolsServer, setToolsServer] = useState<McpServerVO | null>(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">MCP</h1>
          <p className="mt-1 text-sm text-muted-foreground">MCP Server 管理：激活、工具同步、全局治理与真实调试。</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={14} /> 新建 Server
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
            <EmptyState title="暂无 MCP Server" description="创建一个 Server 并激活后即可同步工具。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>协议/模式</TableHead>
                  <TableHead>激活状态</TableHead>
                  <TableHead>健康</TableHead>
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
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(server); setFormOpen(true) }}>
                          编辑
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void rowAction('删除', async () => {
                          const used = await mcpServers.usedWithAgent([String(server.id)])
                          if (used.data.data?.length) throw new Error(`仍被 ${used.data.data.length} 处引用`)
                          await mcpServers.remove([String(server.id)])
                        })}>
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

      <ServerFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} onSaved={() => void paged.refetch()} />
      {toolsServer ? <ToolsDialog server={toolsServer} onClose={() => setToolsServer(null)} /> : null}
    </div>
  )
}

function ServerFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: McpServerVO | null
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    name: editing?.name ?? '',
    protocol: editing?.protocol ?? McpProtocol.HTTP,
    mode: editing?.mode ?? McpMode.SYNC,
    timeout: editing?.timeout ?? 30,
    description: editing?.description ?? '',
    // MCP 配置可能含 token/API key；编辑时不回显，留空表示保持原值。
    protocolConfig: '',
    enabled: editing?.enabled ?? true,
  }))
  const [busy, setBusy] = useState(false)

  function set(name: string, value: unknown) {
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  async function submit() {
    setBusy(true)
    try {
      let protocolConfig: unknown = null
      const raw = values.protocolConfig
      if (typeof raw === 'string' && raw.trim()) protocolConfig = JSON.parse(raw)
      else if (raw && typeof raw !== 'string') protocolConfig = raw
      const payload = { ...(editing ?? {}), ...values, timeout: Number(values.timeout ?? 30), protocolConfig }
      if (editing && typeof raw === 'string' && !raw.trim()) delete (payload as Record<string, unknown>).protocolConfig
      if (editing) await mcpServers.update(payload as Partial<McpServerVO>)
      else await mcpServers.save(payload as Partial<McpServerVO>)
      toast.success('已保存')
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, cause instanceof SyntaxError ? 'protocolConfig 不是合法 JSON' : '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑 MCP Server' : '新建 MCP Server'}</DialogTitle>
          <DialogDescription>连接凭据写入 protocolConfig；提交后不回显密文。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="mcp-name">名称</Label>
            <Input id="mcp-name" className="mt-1.5" value={String(values.name ?? '')} onChange={(event) => set('name', event.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>协议</Label>
              <Select value={String(values.protocol)} onValueChange={(value) => set('protocol', value)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(McpProtocol).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>模式</Label>
              <Select value={String(values.mode)} onValueChange={(value) => set('mode', value)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(McpMode).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>超时 (秒)</Label>
              <Input className="mt-1.5" type="number" value={String(values.timeout ?? '')} onChange={(event) => set('timeout', Number(event.target.value))} />
            </div>
          </div>
          <div>
            <Label htmlFor="mcp-config">连接配置 (JSON)</Label>
            <Textarea id="mcp-config" className="mt-1.5 min-h-28 font-mono text-xs" placeholder='如 {"endpoint":"https://...","apiKey":"..."} 或 {"command":"npx","args":[...]}' value={String(values.protocolConfig ?? '')} onChange={(event) => set('protocolConfig', event.target.value)} />
          </div>
          <div>
            <Label htmlFor="mcp-desc">描述</Label>
            <Textarea id="mcp-desc" className="mt-1.5 min-h-16" value={String(values.description ?? '')} onChange={(event) => set('description', event.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(values.enabled)} onCheckedChange={(checked) => set('enabled', checked)} aria-label="启用" />
            <Label>启用</Label>
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

function ToolsDialog({ server, onClose }: { server: McpServerVO; onClose: () => void }) {
  const toolsQuery = useQuery({
    queryKey: ['detail', 'mcp-tools', String(server.id)],
    queryFn: async () => (await mcpServers.tools(String(server.id))).data.data,
  })
  const [debugTool, setDebugTool] = useState<McpToolVO | null>(null)
  const rows = toolsQuery.data ?? []

  async function toggleGlobal(tool: McpToolVO, field: 'enabled' | 'needConfirm', value: boolean) {
    try {
      if (field === 'enabled') await mcpServers.setGlobalEnabled(String(server.id), [tool.toolName], value)
      else await mcpServers.setGlobalNeedConfirm(String(server.id), [tool.toolName], value)
      toast.success('已更新')
      void toolsQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '更新失败'))
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{server.name} · 工具治理</DialogTitle>
          <DialogDescription>全局启用与人工确认开关立即生效；调试直接调用真实后端并展示原始结果。</DialogDescription>
        </DialogHeader>
        {toolsQuery.isLoading ? (
          <TableSkeleton rows={3} />
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
                <TableRow key={tool.toolName}>
                  <TableCell className="font-mono text-xs">{tool.toolName}</TableCell>
                  <TableCell className="line-clamp-1 max-w-64 text-xs text-muted-foreground">{tool.description}</TableCell>
                  <TableCell><Switch checked={tool.enabled} onCheckedChange={(checked) => void toggleGlobal(tool, 'enabled', checked)} aria-label={`${tool.toolName} 启用`} /></TableCell>
                  <TableCell><Switch checked={tool.needConfirm} onCheckedChange={(checked) => void toggleGlobal(tool, 'needConfirm', checked)} aria-label={`${tool.toolName} 确认`} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setDebugTool(tool)}>调试</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {debugTool ? <DebugDialog server={server} tool={debugTool} onClose={() => setDebugTool(null)} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function DebugDialog({ server, tool, onClose }: { server: McpServerVO; tool: McpToolVO; onClose: () => void }) {
  const [args, setArgs] = useState('{}')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setResult(null)
    try {
      const argumentsJson = JSON.parse(args) as Record<string, unknown>
      const response = await mcpServers.debugTool({ serverId: String(server.id), toolName: tool.toolName, arguments: argumentsJson })
      setResult(JSON.stringify(response.data.data ?? response.data, null, 2))
      toast.success('调试完成')
    } catch (cause) {
      // 原始错误直接展示，不包装为成功
      setResult(`调试失败：${readableError(cause, '无返回')}`)
      toast.error('调试失败（原始错误见结果区）')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>调试 {tool.toolName}</DialogTitle>
          <DialogDescription>参数为 JSON 对象；调用真实后端执行。</DialogDescription>
        </DialogHeader>
        <Textarea className="min-h-24 font-mono text-xs" value={args} onChange={(event) => setArgs(event.target.value)} />
        {result ? <pre className="max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{result}</pre> : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button onClick={() => void run()} disabled={busy}>{busy ? '执行中…' : '执行调试'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
