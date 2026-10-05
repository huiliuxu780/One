import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export interface MarkdownInteractionPayload {
  interactionId: string
  type: 'form' | 'choice' | 'confirm'
  data: Record<string, unknown>
  code: string
  userText: string
}

interface VepMessage {
  vision?: {
    id?: string
    type?: 'card' | 'chart'
    title?: string
    insight?: string
    data?: Array<{ label: string; value: string | number | boolean; unit?: string; status?: string }> | ChartData
  }
}

interface ChartData {
  chartType?: string
  xAxis?: string[]
  series?: Array<{ name: string; data: Array<number | { name: string; value: number }> }>
  yAxisLabel?: string
}

interface UipField {
  name: string
  label: string
  type: string
  required?: boolean
  placeholder?: string
  defaultValue?: unknown
  options?: Array<{ value: string | number; label: string; description?: string; disabled?: boolean }>
  multiple?: boolean
  helpText?: string
  disabled?: boolean
  readonly?: boolean
  hidden?: boolean
}

interface UipInteraction {
  id: string
  type: 'form' | 'choice' | 'confirm'
  schemaVersion?: string
  props?: { title?: string; submitLabel?: string; cancelLabel?: string; disabled?: boolean; readonly?: boolean }
  fields?: UipField[]
  question?: string
  message?: string
  multiple?: boolean
  allowCustom?: boolean
  options?: Array<{ value: string; label: string; description?: string; disabled?: boolean }>
  confirmLabel?: string
  cancelLabel?: string
  payload?: Record<string, unknown>
  submittedData?: Record<string, unknown>
}

interface UipMessage { interaction?: UipInteraction }

export function MarkdownLite({ content, disabled = false, onInteraction }: { content: string; disabled?: boolean; onInteraction?: (payload: MarkdownInteractionPayload) => void }) {
  if (!content) return null
  const segments = content.split(/```/)
  return <div className="space-y-2 text-sm leading-6 break-words">{segments.map((segment, segmentIndex) => {
    if (segmentIndex % 2 === 1) {
      const newline = segment.indexOf('\n')
      const language = (newline > -1 ? segment.slice(0, newline) : '').trim().toLowerCase()
      const code = (newline > -1 ? segment.slice(newline + 1) : segment).replace(/\n$/, '')
      if (language === 'mermaid') return <MermaidBlock key={`code-${segmentIndex}`} code={code} />
      if (language === 'vep') return <VepBlock key={`code-${segmentIndex}`} code={code} />
      if (language === 'uip' || language === 'apip') return <UipBlock key={`code-${segmentIndex}`} code={code} disabled={disabled} onSubmit={onInteraction} />
      return <pre key={`code-${segmentIndex}`} className="overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-100">{language ? <div className="mb-1 text-[10px] uppercase text-slate-400">{language}</div> : null}<code>{code}</code></pre>
    }
    return <ReactMarkdown
      key={`text-${segmentIndex}`}
      remarkPlugins={[remarkGfm]}
      urlTransform={(url) => /^https?:\/\//i.test(url) || url.startsWith('/') ? url : ''}
      components={{
        a: ({ children, ...props }) => <a {...props} target="_blank" rel="noreferrer" className="underline underline-offset-2">{children}</a>,
        h1: ({ children }) => <h1 className="mt-4 text-xl font-semibold first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="mt-4 text-lg font-semibold first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="mt-3 text-base font-semibold first:mt-0">{children}</h3>,
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">{children}</blockquote>,
        table: ({ children }) => <div className="overflow-auto"><table className="w-full border-collapse text-left text-xs">{children}</table></div>,
        th: ({ children }) => <th className="border border-border bg-muted px-2 py-1.5 font-medium">{children}</th>,
        td: ({ children }) => <td className="border border-border px-2 py-1.5 align-top">{children}</td>,
        code: ({ children }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{children}</code>,
        img: ({ alt }) => <span className="text-xs text-muted-foreground">[图片：{alt || '未命名'}]</span>,
      }}
    >{segment}</ReactMarkdown>
  })}</div>
}

function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const id = useRef(`mermaid-${crypto.randomUUID().replaceAll('-', '')}`)
  useEffect(() => {
    let cancelled = false
    void import('mermaid').then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral', suppressErrorRendering: true })
      const rendered = await mermaid.render(id.current, code)
      if (!cancelled) setSvg(sanitizeSvg(rendered.svg))
    }).catch((cause: unknown) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'Mermaid 解析失败') })
    return () => { cancelled = true }
  }, [code])
  if (error) return <ProtocolFallback label="Mermaid 解析失败" code={code} detail={error} />
  if (!svg) return <div className="animate-pulse rounded-lg border border-dashed border-border bg-muted/40 p-5 text-center text-xs text-muted-foreground">正在渲染 Mermaid…</div>
  return <div className="overflow-auto rounded-lg border border-border bg-white p-3" dangerouslySetInnerHTML={{ __html: svg }} />
}

function sanitizeSvg(svg: string) {
  const documentNode = new DOMParser().parseFromString(svg, 'image/svg+xml')
  documentNode.querySelectorAll('script').forEach((node) => node.remove())
  documentNode.querySelectorAll('*').forEach((node) => {
    for (const attribute of Array.from(node.attributes)) {
      const value = attribute.value.trim().toLowerCase()
      if (attribute.name.toLowerCase().startsWith('on') || value.startsWith('javascript:')) node.removeAttribute(attribute.name)
    }
  })
  return new XMLSerializer().serializeToString(documentNode.documentElement)
}

function VepBlock({ code }: { code: string }) {
  let parsed: VepMessage
  try { parsed = JSON.parse(code) as VepMessage } catch { return <ProtocolFallback label="VEP 解析失败" code={code} /> }
  const vision = parsed.vision
  if (!vision || (vision.type !== 'card' && vision.type !== 'chart')) return <ProtocolFallback label="VEP 内容无效" code={code} />
  if (vision.type === 'card') {
    const fields = Array.isArray(vision.data) ? vision.data : []
    return <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><div className="font-semibold">{vision.title || '信息卡片'}</div>{vision.insight ? <p className="mt-1 text-xs text-muted-foreground">{vision.insight}</p> : null}<div className="mt-3 grid gap-2 sm:grid-cols-2">{fields.map((field, index) => <div key={`${field.label}-${index}`} className="rounded-lg bg-background p-3"><div className="text-xs text-muted-foreground">{field.label}</div><div className="mt-1 text-lg font-semibold">{String(field.value)}{field.unit ? <span className="ml-1 text-xs font-normal text-muted-foreground">{field.unit}</span> : null}</div></div>)}</div></div>
  }
  const chart = !Array.isArray(vision.data) ? vision.data : undefined
  return <div className="rounded-xl border border-border bg-card p-4"><div className="font-semibold">{vision.title || '数据图表'}</div>{vision.insight ? <p className="mt-1 text-xs text-muted-foreground">{vision.insight}</p> : null}<SimpleChart chart={chart} /></div>
}

function SimpleChart({ chart }: { chart?: ChartData }) {
  const series = chart?.series ?? []
  const numeric = series.flatMap((item) => item.data).map((item) => typeof item === 'number' ? item : item.value)
  const max = Math.max(...numeric, 1)
  return <div className="mt-4 space-y-3">{series.map((item) => <div key={item.name}><div className="mb-1 text-xs font-medium">{item.name}</div><div className="flex h-28 items-end gap-1 rounded-lg bg-muted/40 p-2">{item.data.map((raw, index) => { const value = typeof raw === 'number' ? raw : raw.value; const label = typeof raw === 'number' ? chart?.xAxis?.[index] : raw.name; return <div key={`${label}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"><span className="text-[9px]">{value}</span><div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(3, (value / max) * 75)}px` }} /><span className="max-w-full truncate text-[9px] text-muted-foreground">{label}</span></div> })}</div></div>)}</div>
}

function UipBlock({ code, disabled, onSubmit }: { code: string; disabled: boolean; onSubmit?: (payload: MarkdownInteractionPayload) => void }) {
  let parsed: UipMessage
  try { parsed = JSON.parse(code) as UipMessage } catch { return <ProtocolFallback label="UIP/APIP 解析失败" code={code} /> }
  const interaction = parsed.interaction
  if (!interaction || !['form', 'choice', 'confirm'].includes(interaction.type)) return <ProtocolFallback label="UIP/APIP 内容无效" code={code} />
  return <InteractionCard interaction={interaction} code={code} disabled={disabled || Boolean(interaction.submittedData) || Boolean(interaction.props?.disabled) || Boolean(interaction.props?.readonly)} onSubmit={onSubmit} />
}

function InteractionCard({ interaction, code, disabled, onSubmit }: { interaction: UipInteraction; code: string; disabled: boolean; onSubmit?: (payload: MarkdownInteractionPayload) => void }) {
  const defaults = useMemo(() => interaction.submittedData ?? Object.fromEntries((interaction.fields ?? []).map((field) => [field.name, field.defaultValue ?? (field.type === 'switch' ? false : '')])), [interaction])
  const [values, setValues] = useState<Record<string, unknown>>(defaults)
  const [submitted, setSubmitted] = useState(Boolean(interaction.submittedData))
  function submit(data: Record<string, unknown>) {
    setValues(data); setSubmitted(true)
    onSubmit?.({ interactionId: interaction.id, type: interaction.type, data, code, userText: interactionText(interaction, data) })
  }
  const locked = disabled || submitted
  if (interaction.type === 'confirm') return <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><div className="font-medium">{interaction.message}</div>{submitted ? <p className="mt-2 text-xs text-muted-foreground">已提交：{values.confirmed ? '确认' : '取消'}</p> : <div className="mt-3 flex gap-2"><Button size="sm" disabled={locked} onClick={() => submit({ confirmed: true, payload: interaction.payload })}>{interaction.confirmLabel || '确认'}</Button><Button size="sm" variant="outline" disabled={locked} onClick={() => submit({ confirmed: false, payload: interaction.payload })}>{interaction.cancelLabel || '取消'}</Button></div>}</div>
  if (interaction.type === 'choice') return <ChoiceCard interaction={interaction} values={values} disabled={locked} onSubmit={submit} />
  return <form className="rounded-xl border border-border bg-card p-4" onSubmit={(event) => { event.preventDefault(); if ((interaction.fields ?? []).some((field) => field.required && (values[field.name] === '' || values[field.name] == null))) return; submit(values) }}><div className="mb-3 font-medium">{interaction.props?.title || '请填写信息'}</div><div className="space-y-3">{(interaction.fields ?? []).filter((field) => !field.hidden).map((field) => <UipFieldControl key={field.name} field={field} value={values[field.name]} disabled={locked} onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))} />)}</div><Button className="mt-4" size="sm" type="submit" disabled={locked}>{submitted ? '已提交' : interaction.props?.submitLabel || '提交'}</Button></form>
}

function ChoiceCard({ interaction, values, disabled, onSubmit }: { interaction: UipInteraction; values: Record<string, unknown>; disabled: boolean; onSubmit: (data: Record<string, unknown>) => void }) {
  const [selected, setSelected] = useState<string[]>(Array.isArray(values.values) ? values.values as string[] : [])
  const [custom, setCustom] = useState(String(values.customInput ?? ''))
  return <div className="rounded-xl border border-border bg-card p-4"><div className="font-medium">{interaction.question}</div><div className="mt-3 space-y-2">{(interaction.options ?? []).map((option) => <label key={option.value} className="flex items-start gap-2 rounded-lg border border-border p-2 text-sm"><Checkbox disabled={disabled || option.disabled} checked={selected.includes(option.value)} onCheckedChange={(checked) => setSelected((previous) => interaction.multiple ? (checked ? [...previous, option.value] : previous.filter((value) => value !== option.value)) : (checked ? [option.value] : []))} /><span><span className="font-medium">{option.label}</span>{option.description ? <span className="block text-xs text-muted-foreground">{option.description}</span> : null}</span></label>)}</div>{interaction.allowCustom ? <Input className="mt-3" value={custom} disabled={disabled} placeholder="其他…" onChange={(event) => setCustom(event.target.value)} /> : null}<Button className="mt-3" size="sm" disabled={disabled || (!selected.length && !custom)} onClick={() => onSubmit({ values: selected, customInput: custom || undefined })}>{disabled ? '已提交' : '提交选择'}</Button></div>
}

function UipFieldControl({ field, value, disabled, onChange }: { field: UipField; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const locked = disabled || field.disabled || field.readonly
  const label = <Label>{field.label}{field.required ? ' *' : ''}</Label>
  if (field.type === 'switch') return <label className="flex items-center gap-2 text-sm"><Switch checked={Boolean(value)} disabled={locked} onCheckedChange={onChange} />{field.label}</label>
  if (field.type === 'textarea') return <div>{label}<Textarea value={String(value ?? '')} disabled={locked} placeholder={field.placeholder} onChange={(event) => onChange(event.target.value)} />{field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}</div>
  if (field.type === 'select' || field.type === 'radio') return <div>{label}<Select value={value == null || value === '' ? undefined : String(value)} disabled={locked} onValueChange={onChange}><SelectTrigger><SelectValue placeholder={field.placeholder} /></SelectTrigger><SelectContent>{(field.options ?? []).map((option) => <SelectItem key={String(option.value)} value={String(option.value)} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent></Select></div>
  if (field.type === 'checkbox') return <label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(value)} disabled={locked} onCheckedChange={(checked) => onChange(Boolean(checked))} />{field.label}</label>
  if (field.type === 'checkbox-group') { const selected = Array.isArray(value) ? value.map(String) : []; return <div>{label}<div className="space-y-1">{(field.options ?? []).map((option) => <label key={String(option.value)} className="flex items-center gap-2 text-sm"><Checkbox checked={selected.includes(String(option.value))} disabled={locked || option.disabled} onCheckedChange={(checked) => onChange(checked ? [...selected, String(option.value)] : selected.filter((item) => item !== String(option.value)))} />{option.label}</label>)}</div></div> }
  const type = ['number', 'date', 'datetime-local', 'email', 'tel'].includes(field.type) ? (field.type === 'datetime' ? 'datetime-local' : field.type) : 'text'
  return <div>{label}<Input type={type} value={String(value ?? '')} disabled={locked} required={field.required} placeholder={field.placeholder} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} />{field.helpText ? <p className="text-xs text-muted-foreground">{field.helpText}</p> : null}</div>
}

function interactionText(interaction: UipInteraction, data: Record<string, unknown>) {
  if (interaction.type === 'confirm') return data.confirmed ? '已确认' : '已取消'
  if (interaction.type === 'choice') { const values = Array.isArray(data.values) ? data.values.map(String) : []; const labels = values.map((value) => interaction.options?.find((option) => option.value === value)?.label ?? value); if (data.customInput) labels.push(String(data.customInput)); return `已选择：${labels.join('，')}` }
  const labels = new Map((interaction.fields ?? []).map((field) => [field.name, field.label]))
  const entries = Object.entries(data).filter(([, value]) => value !== '' && value != null).map(([key, value]) => `${labels.get(key) || key}=${Array.isArray(value) ? value.join('、') : String(value)}`)
  return entries.length ? `已填写表单：${entries.join('，')}` : '已提交表单'
}

function ProtocolFallback({ label, code, detail }: { label: string; code: string; detail?: string }) {
  return <details className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3"><summary className="cursor-pointer text-xs font-medium text-amber-700">{label}</summary>{detail ? <p className="mt-2 text-xs text-destructive">{detail}</p> : null}<pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{code.slice(0, 2000)}</pre></details>
}
