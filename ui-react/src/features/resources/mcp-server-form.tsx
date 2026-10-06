import { useEffect, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { mcpServers } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import type { McpServerVO } from '@/types'
import { McpActivationStatus, McpMode, McpProtocol } from '@/types'
import { buildMcpProtocolConfig, initialMcpFormValues, secretConfigKey, validateMcpForm, type KeyValue, type McpFormValues } from './mcp-form-values'

export function McpServerFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: McpServerVO | null
  onSaved: () => void
}) {
  const [values, setValues] = useState<McpFormValues>(() => initialMcpFormValues(editing))
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (open) setValues(initialMcpFormValues(editing)) }, [open, editing])
  const set = <K extends keyof McpFormValues>(key: K, value: McpFormValues[K]) => setValues((current) => ({ ...current, [key]: value }))

  async function submit() {
    const validation = validateMcpForm(values)
    if (validation) { toast.error(validation); return }
    setBusy(true)
    try {
      const payload = {
        ...(editing ?? {}),
        name: values.name.trim(),
        description: values.description.trim(),
        protocol: values.protocol,
        mode: values.mode,
        timeout: values.timeout,
        runtimeFailThreshold: values.runtimeFailThreshold,
        enabled: values.enabled,
        protocolConfig: buildMcpProtocolConfig(values, editing),
      }
      if (editing) {
        const server = (await mcpServers.update(payload)).data.data
        if (editing.activationStatus === McpActivationStatus.ACTIVE && server.activationStatus === McpActivationStatus.FAILED) {
          toast.warning(`配置已保存，但自动重连失败：${server.activationMessage || '请检查 MCP 配置'}`)
        } else if (server.activationStatus === McpActivationStatus.ACTIVE && server.toolCount === 0) {
          toast.warning('配置已保存，连接成功，但未发现可用工具')
        } else toast.success('更新成功')
      } else {
        await mcpServers.save(payload)
        toast.success('创建成功，保存后可手动连接')
      }
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? '编辑 MCP Server' : '新建 MCP Server'}</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        {editing?.used?.length ? <div className="sm:col-span-2 text-xs text-muted-foreground">关联智能体：{editing.used.join('、')}</div> : null}
        <div><Label htmlFor="mcp-name">名称 *</Label><Input id="mcp-name" className="mt-1.5" value={values.name} onChange={(event) => set('name', event.target.value)} /></div>
        <div><Label htmlFor="mcp-description">描述 *</Label><Textarea id="mcp-description" className="mt-1.5 min-h-16" value={values.description} onChange={(event) => set('description', event.target.value)} /></div>
        <div><Label>协议</Label><Select value={values.protocol} disabled={Boolean(editing)} onValueChange={(value) => set('protocol', value as McpProtocol)}><SelectTrigger className="mt-1.5" aria-label="协议"><SelectValue /></SelectTrigger><SelectContent>{Object.values(McpProtocol).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>运行模式</Label><Select value={values.mode} onValueChange={(value) => set('mode', value as McpMode)}><SelectTrigger className="mt-1.5" aria-label="运行模式"><SelectValue /></SelectTrigger><SelectContent>{Object.values(McpMode).map((value) => <SelectItem key={value} value={value}>{value === McpMode.SYNC ? '同步' : '异步'}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="mcp-timeout">超时时间（秒）</Label><Input id="mcp-timeout" className="mt-1.5" type="number" min={1} step={1} value={values.timeout} onChange={(event) => set('timeout', Number(event.target.value))} /></div>
        <div><Label htmlFor="mcp-fail-threshold">自动降级失败次数</Label><Input id="mcp-fail-threshold" className="mt-1.5" type="number" min={0} step={1} value={values.runtimeFailThreshold} onChange={(event) => set('runtimeFailThreshold', Number(event.target.value))} /><p className="mt-1 text-xs text-muted-foreground">0 表示关闭自动降级。</p></div>
        {values.protocol === McpProtocol.STDIO ? <>
          <div className="sm:col-span-2"><Label htmlFor="mcp-command">可执行命令 *</Label><Input id="mcp-command" className="mt-1.5" value={values.command} onChange={(event) => set('command', event.target.value)} /></div>
          <StringRows label="命令参数" values={values.args} onChange={(next) => set('args', next)} />
          <KeyValueRows label="环境变量" rows={values.env} onChange={(next) => set('env', next)} editing={Boolean(editing)} keyPlaceholder="变量名" valuePlaceholder="变量值" />
          <div><Label htmlFor="mcp-cwd">工作目录（可选）</Label><Input id="mcp-cwd" className="mt-1.5" value={values.cwd} onChange={(event) => set('cwd', event.target.value)} /></div>
          <div><Label htmlFor="mcp-encoding">字符编码</Label><Input id="mcp-encoding" className="mt-1.5" value={values.encoding} onChange={(event) => set('encoding', event.target.value)} /></div>
        </> : <>
          <div className="sm:col-span-2"><Label htmlFor="mcp-url">服务 URL *</Label><Input id="mcp-url" className="mt-1.5" value={values.url} onChange={(event) => set('url', event.target.value)} placeholder="https://..." /></div>
          <KeyValueRows label="查询参数" rows={values.queryParams} onChange={(next) => set('queryParams', next)} editing={Boolean(editing)} keyPlaceholder="参数名" valuePlaceholder="参数值" />
          <KeyValueRows label="请求头" rows={values.headers} onChange={(next) => set('headers', next)} editing={Boolean(editing)} keyPlaceholder="Header 名" valuePlaceholder="Header 值" />
        </>}
        <label className="flex items-center gap-2 text-sm"><Switch checked={values.enabled} onCheckedChange={(enabled) => set('enabled', enabled)} /> 启用</label>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button onClick={() => void submit()} disabled={busy}>{busy ? '提交中…' : editing ? '更新' : '创建'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function KeyValueRows({ label, rows, onChange, editing, keyPlaceholder, valuePlaceholder }: {
  label: string
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  editing: boolean
  keyPlaceholder: string
  valuePlaceholder: string
}) {
  const patch = (index: number, value: Partial<KeyValue>) => onChange(rows.map((row, position) => position === index ? { ...row, ...value } : row))
  return <div className="space-y-2 sm:col-span-2"><Label>{label}</Label>{rows.map((row, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px] gap-2"><Input aria-label={`${label} ${index + 1} 名称`} value={row.key} placeholder={keyPlaceholder} onChange={(event) => patch(index, { key: event.target.value })} /><Input aria-label={`${label} ${index + 1} 值`} type={secretConfigKey(row.key) ? 'password' : 'text'} autoComplete="off" value={row.value} placeholder={editing && secretConfigKey(row.key) ? '留空不修改' : valuePlaceholder} onChange={(event) => patch(index, { value: event.target.value })} /><Button type="button" variant="ghost" size="icon" aria-label={`删除${label} ${index + 1}`} onClick={() => onChange(rows.filter((_, position) => position !== index))}><Trash size={14} /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, { key: '', value: '' }])}><Plus size={14} /> 添加{label}</Button></div>
}

function StringRows({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  return <div className="space-y-2 sm:col-span-2"><Label>{label}</Label>{values.map((value, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_32px] gap-2"><Input aria-label={`${label} ${index + 1}`} value={value} onChange={(event) => onChange(values.map((item, position) => position === index ? event.target.value : item))} /><Button type="button" variant="ghost" size="icon" aria-label={`删除${label} ${index + 1}`} onClick={() => onChange(values.filter((_, position) => position !== index))}><Trash size={14} /></Button></div>)}<Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ''])}><Plus size={14} /> 添加{label}</Button></div>
}
