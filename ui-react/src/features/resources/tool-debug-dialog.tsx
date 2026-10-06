import { useMemo, useState } from 'react'
import { tools } from '@/api/resources'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import type { ToolVO } from '@/types'

export interface ToolInputSchemaItem {
  name?: string
  description?: string
  type?: string
  defaultValue?: unknown
  required?: boolean
  enum?: unknown[]
}

function convertPrimitive(type: string, value: unknown) {
  if (type === 'integer' || type === 'number') {
    const converted = Number(value)
    if (!Number.isFinite(converted)) throw new Error('必须是有效数字')
    if (type === 'integer' && !Number.isInteger(converted)) throw new Error('必须是整数')
    return converted
  }
  if (type === 'boolean') {
    if (typeof value === 'boolean') return value
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error('必须选择 true 或 false')
  }
  if (type === 'object' || type === 'array') {
    if (typeof value !== 'string') return value
    try {
      const parsed = JSON.parse(value) as unknown
      if (type === 'array' && !Array.isArray(parsed)) throw new Error('必须是 JSON 数组')
      if (type === 'object' && (parsed == null || Array.isArray(parsed) || typeof parsed !== 'object')) throw new Error('必须是 JSON 对象')
      return parsed
    } catch (cause) {
      if (cause instanceof Error && cause.message.startsWith('必须是')) throw cause
      throw new Error('不是合法 JSON')
    }
  }
  return String(value)
}

export function toolDebugInitialValues(schema: ToolInputSchemaItem[]) {
  const values: Record<string, unknown> = {}
  for (const field of schema) {
    const name = field.name?.trim()
    if (!name || field.defaultValue === '' || field.defaultValue == null) continue
    try {
      values[name] = convertPrimitive(field.type || 'string', field.defaultValue)
    } catch {
      values[name] = field.defaultValue
    }
  }
  return values
}

export function buildToolDebugArguments(schema: ToolInputSchemaItem[], values: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const field of schema) {
    const name = field.name?.trim()
    if (!name) continue
    const value = values[name]
    const empty = value === undefined || value === null || (typeof value === 'string' && !value.trim())
    if (empty) {
      if (field.required) throw new Error(`请填写${name}`)
      continue
    }
    try {
      result[name] = convertPrimitive(field.type || 'string', value)
    } catch (cause) {
      throw new Error(`${name}：${cause instanceof Error ? cause.message : '值无效'}`)
    }
  }
  return result
}

function inputValue(value: unknown) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value, null, 2)
}

export function ToolDebugDialog({ tool, onClose }: { tool: ToolVO; onClose: () => void }) {
  const schema = useMemo(
    () => (Array.isArray(tool.inputSchema) ? (tool.inputSchema as ToolInputSchemaItem[]).filter((field) => field?.name?.trim()) : []),
    [tool.inputSchema],
  )
  const [values, setValues] = useState<Record<string, unknown>>(() => toolDebugInitialValues(schema))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  function setValue(name: string, value: unknown) {
    setValues((previous) => ({ ...previous, [name]: value }))
  }

  async function execute() {
    let args: Record<string, unknown>
    try {
      args = buildToolDebugArguments(schema, values)
    } catch (cause) {
      toast.error(readableError(cause, '参数无效'))
      return
    }
    setBusy(true)
    setResult(null)
    try {
      const response = await tools.debug(tool.toolId, args)
      setResult({ ok: true, text: JSON.stringify(response.data.data ?? response.data, null, 2) })
      toast.success('工具调试完成')
    } catch (cause) {
      const message = readableError(cause, '工具调试失败')
      setResult({ ok: false, text: message })
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>调试 {tool.name}</DialogTitle>
          <DialogDescription>{tool.description || `调用工具 ${tool.toolId} 的真实后端执行接口。`}</DialogDescription>
        </DialogHeader>

        {schema.length === 0 ? (
          <div className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">此工具无需输入参数，点击执行即可。</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {schema.map((field) => {
              const name = field.name!.trim()
              const type = field.type || 'string'
              const wide = type === 'object' || type === 'array'
              return (
                <div key={name} className={wide ? 'sm:col-span-2' : ''}>
                  <label className="mb-1.5 block text-sm font-medium" htmlFor={`tool-debug-${name}`}>
                    {name}{field.required ? <span className="ml-1 text-destructive">*</span> : null}
                    <span className="ml-2 font-normal text-muted-foreground">{type}</span>
                  </label>
                  {type === 'boolean' ? (
                    <Select value={values[name] == null ? '' : String(values[name])} onValueChange={(value) => setValue(name, value === 'true')}>
                      <SelectTrigger id={`tool-debug-${name}`} aria-label={name}><SelectValue placeholder="请选择" /></SelectTrigger>
                      <SelectContent><SelectItem value="true">true</SelectItem><SelectItem value="false">false</SelectItem></SelectContent>
                    </Select>
                  ) : wide ? (
                    <Textarea
                      id={`tool-debug-${name}`}
                      className="min-h-28 font-mono text-xs"
                      placeholder={type === 'array' ? '[]' : '{}'}
                      value={inputValue(values[name])}
                      onChange={(event) => setValue(name, event.target.value)}
                    />
                  ) : (
                    <Input
                      id={`tool-debug-${name}`}
                      type={type === 'integer' || type === 'number' ? 'number' : 'text'}
                      step={type === 'integer' ? '1' : type === 'number' ? 'any' : undefined}
                      value={inputValue(values[name])}
                      onChange={(event) => setValue(name, event.target.value)}
                    />
                  )}
                  {field.description ? <p className="mt-1 text-xs text-muted-foreground">{field.description}</p> : null}
                </div>
              )
            })}
          </div>
        )}

        {result ? (
          <div>
            <div className="mb-1.5 text-sm font-medium">执行结果 · <span className={result.ok ? 'text-success' : 'text-destructive'}>{result.ok ? '成功' : '失败'}</span></div>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-3 font-mono text-xs">{result.text}</pre>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>关闭</Button>
          <Button onClick={() => void execute()} disabled={busy}>{busy ? '执行中…' : '执行调试'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
