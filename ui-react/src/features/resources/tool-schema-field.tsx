import { Plus, Trash, ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface ToolSchemaItem {
  name: string
  description: string
  type: string
  defaultValue: string
  required: boolean
}

const parameterTypes = [
  { value: 'string', label: '字符串' },
  { value: 'integer', label: '整数' },
  { value: 'number', label: '数字' },
  { value: 'boolean', label: '布尔' },
  { value: 'object', label: '对象' },
]

export function normalizeToolSchema(value: unknown): ToolSchemaItem[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => ({
    name: String(item?.name ?? ''),
    description: String(item?.description ?? ''),
    type: String(item?.type ?? 'string'),
    defaultValue: String(item?.defaultValue ?? ''),
    required: Boolean(item?.required),
  }))
}

export function validateToolSchema(value: unknown): string | null {
  if (!Array.isArray(value)) return '输入参数格式无效'
  const names = new Set<string>()
  for (const item of value as ToolSchemaItem[]) {
    const name = item.name?.trim()
    if (!name) return '输入参数名不能为空'
    if (names.has(name)) return `输入参数名“${name}”重复`
    names.add(name)
    if (!parameterTypes.some((type) => type.value === item.type)) return `参数“${name}”的类型无效`
  }
  return null
}

export function ToolSchemaField({ value, onChange }: { value: unknown; onChange: (value: ToolSchemaItem[]) => void }) {
  const items = normalizeToolSchema(value)
  const patch = (index: number, value: Partial<ToolSchemaItem>) => onChange(items.map((item, position) => position === index ? { ...item, ...value } : item))
  const move = (index: number, offset: number) => {
    const reordered = [...items]
    const [item] = reordered.splice(index, 1)
    reordered.splice(index + offset, 0, item)
    onChange(reordered)
  }

  return <div className="space-y-2">
    {items.map((item, index) => <div key={index} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_105px_100px_auto]">
      <Input aria-label={`参数 ${index + 1} 名称`} value={item.name} placeholder="参数名" onChange={(event) => patch(index, { name: event.target.value })} />
      <Input aria-label={`参数 ${index + 1} 描述`} value={item.description} placeholder="参数描述" onChange={(event) => patch(index, { description: event.target.value })} />
      <Select value={item.type} onValueChange={(type) => patch(index, { type })}><SelectTrigger aria-label={`参数 ${index + 1} 类型`}><SelectValue /></SelectTrigger><SelectContent>{parameterTypes.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}</SelectContent></Select>
      <Input aria-label={`参数 ${index + 1} 默认值`} value={item.defaultValue} placeholder="默认值" onChange={(event) => patch(index, { defaultValue: event.target.value })} />
      <div className="flex items-center gap-1"><label className="flex items-center gap-1 text-xs"><Checkbox checked={item.required} onCheckedChange={(required) => patch(index, { required: required === true })} />必填</label><Button type="button" variant="ghost" size="icon" aria-label={`上移参数 ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={14} /></Button><Button type="button" variant="ghost" size="icon" aria-label={`下移参数 ${index + 1}`} disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown size={14} /></Button><Button type="button" variant="ghost" size="icon" aria-label={`删除参数 ${index + 1}`} onClick={() => onChange(items.filter((_, position) => position !== index))}><Trash size={14} /></Button></div>
    </div>)}
    <Button type="button" variant="outline" onClick={() => onChange([...items, { name: '', description: '', type: 'string', defaultValue: '', required: false }])}><Plus size={14} /> 添加参数</Button>
    <p className="text-xs text-muted-foreground">参数顺序会保存在 Schema 中；参数名对应工具代码中 params 的 key。</p>
  </div>
}
