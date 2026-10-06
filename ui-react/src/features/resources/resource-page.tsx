import { useState } from 'react'
import { useForm, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState, ErrorState, PageLoading, TableSkeleton } from '@/components/states'
import { toApiClientError } from '@/api/client'
import { useInvalidateResource, useBatchSelection, usePagedList } from '@/features/data/paged'
import { readableError } from '@/lib/utils'
import type { FieldDef, ResourceDef } from './types'
import { MemoryFormDialog } from './memory-form'
import type { LongTermMemoryConfig } from '@/types'
import { MultiSelectField } from '@/features/agents/multi-select-field'
import { TagInput } from './tag-input'
import { ToolSchemaField, validateToolSchema } from './tool-schema-field'

function enumOptions(field: FieldDef) {
  if (field.enumFrom) return field.enumFrom.map((value) => ({ label: value, value }))
  return field.options ?? []
}

const providerBaseUrls: Record<string, string> = {
  DASH_SCOPE: 'https://dashscope.aliyuncs.com',
  OPEN_AI: 'https://api.openai.com',
  ANTHROPIC: 'https://api.anthropic.com',
  GEMINI: 'http://localhost:8080',
  OLLAMA: 'http://localhost:11434',
  ORCA_ROUTER: 'https://api.orcarouter.ai/v1',
}

export function resourceEditFieldValue(field: FieldDef, raw: unknown): unknown {
  if (field.secret) return ''
  if (field.type === 'json' && raw != null && typeof raw !== 'string') return JSON.stringify(raw, null, 2)
  return raw ?? field.defaultValue ?? (field.type === 'switch' ? false : '')
}

export function requiredFieldMissing(field: FieldDef, raw: unknown) {
  return Boolean(field.required && (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && raw.length === 0)))
}

export function validateResourceSemantics(key: string, payload: Record<string, unknown>, previous?: Record<string, unknown> | null): string | null {
  if (key === 'tool' && payload.toolType !== 'BUILTIN') {
    if (!/^[a-z_]+$/.test(String(payload.toolId ?? ''))) return '工具 ID 只能使用小写字母和下划线'
    if (!String(payload.code ?? '').trim()) return '请填写工具代码'
  }
  if (key === 'sensitive' && payload.action === 'REPLACE' && !String(payload.replacement ?? '').trim()) return '请填写替换文本'
  if (key === 'model-provider') {
    if (payload.authType === 'ENV' && !String(payload.envVarName ?? '').trim()) return '请填写环境变量名'
    if (payload.authType === 'CONFIG' && (!previous || previous.authType !== 'CONFIG') && !String(payload.apiKey ?? '').trim()) return '请填写 API Key'
  }
  return null
}

export function FormFieldRenderer({
  field,
  value,
  onChange,
  invalid,
}: {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  invalid?: boolean
}) {
  const id = `field-${field.name}`
  const common = { id, invalid }
  switch (field.type) {
    case 'textarea':
    case 'json':
      return (
        <Textarea
          {...common}
          className={field.type === 'json' ? 'min-h-32 font-mono text-xs' : 'min-h-24'}
          placeholder={field.placeholder}
          value={typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value, null, 2)}
          onChange={(event) => onChange(event.target.value)}
        />
      )
    case 'number':
      return (
        <Input
          {...common}
          type="number"
          placeholder={field.placeholder}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        />
      )
    case 'switch':
      return <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} aria-label={field.label} />
    case 'select': {
      const options = enumOptions(field)
      return (
        <Select value={value === undefined || value === null ? '' : String(value)} onValueChange={(next) => onChange(next)}>
          <SelectTrigger aria-label={field.label}>
            <SelectValue placeholder={field.placeholder ?? `请选择${field.label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case 'tags': {
      const tags = Array.isArray(value) ? (value as unknown[]).map(String) : []
      if (field.options?.length) return <MultiSelectField options={field.options} value={tags} onChange={onChange} placeholder={`请选择${field.label}`} />
      return <TagInput id={id} value={tags} onChange={onChange} placeholder={field.placeholder} />
    }
    case 'tool-schema':
      return <ToolSchemaField value={value} onChange={onChange} />
    default:
      return (
        <Input
          {...common}
          type={field.type === 'password' ? 'password' : 'text'}
          autoComplete={field.type === 'password' ? 'new-password' : 'off'}
          placeholder={field.placeholder}
          value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''}
          onChange={(event) => onChange(event.target.value)}
        />
      )
  }
}

function useResourceForm<T extends { id?: string | number }>(def: ResourceDef<T>) {
  const form = useForm<FieldValues>({ defaultValues: {} })
  const [editing, setEditing] = useState<T | null>(null)
  const [open, setOpen] = useState(false)

  function openCreate() {
    const defaults: Record<string, unknown> = {}
    for (const field of def.form) defaults[field.name] = field.defaultValue ?? (field.type === 'switch' ? false : '')
    for (const field of def.form) {
      if (def.initialFilters?.[field.name] !== undefined) defaults[field.name] = def.initialFilters[field.name]
    }
    setEditing(null)
    form.reset(defaults)
    setOpen(true)
  }

  function openEdit(row: T) {
    const values: Record<string, unknown> = {}
    for (const field of def.form) {
      const raw = (row as Record<string, unknown>)[field.name]
      // 密钥字段不回显；留空表示不修改
      values[field.name] = resourceEditFieldValue(field, raw)
    }
    setEditing(row)
    form.reset(values)
    setOpen(true)
  }

  return { form, editing, open, openCreate, openEdit, setOpen }
}

function ResourceFormDialog<T extends { id?: string | number }>({
  def,
  form,
  editing,
  open,
  onOpenChange,
  onSaved,
}: {
  def: ResourceDef<T>
  form: UseFormReturn<FieldValues>
  editing: T | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [submitting, setSubmitting] = useState(false)

  async function submit(values: FieldValues) {
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = { ...(editing as Record<string, unknown> | null), ...values }
      for (const field of def.form) {
        const raw = payload[field.name]
        if (requiredFieldMissing(field, raw)) {
          toast.error(`请填写${field.label}`)
          return
        }
        if (field.type === 'json') {
          if (typeof raw === 'string') {
            const text = raw.trim()
            if (!text) payload[field.name] = null
            else {
              try {
                payload[field.name] = JSON.parse(text)
              } catch {
                toast.error(`${field.label} 不是合法 JSON`)
                return
              }
            }
          }
        }
        if (field.type === 'tags' && raw != null && !Array.isArray(raw)) payload[field.name] = String(raw).split(',').map((item) => item.trim()).filter(Boolean)
        if (field.type === 'tool-schema') {
          const message = validateToolSchema(raw)
          if (message) { toast.error(message); return }
        }
        // 留空不修改：密钥字段无论显示控件类型如何都不回显、不提交空值。
        if (field.secret && !raw) delete payload[field.name]
        if (field.type === 'number' && raw === '') payload[field.name] = undefined
      }
      const semanticError = validateResourceSemantics(def.key, payload, editing as Record<string, unknown> | null)
      if (semanticError) { toast.error(semanticError); return }
      if (def.key === 'tool' && payload.toolType !== 'BUILTIN') payload.classPath = null
      if (def.key === 'code-execution') {
        if (!payload.uploadDir) payload.uploadDir = '.apboa/skills'
        if (Array.isArray(payload.command) && payload.command.length === 0) payload.command = null
      }
      if (editing != null) await def.api.update(payload as Partial<T>)
      else await def.api.save(payload as Partial<T>)
      toast.success(editing ? '已保存修改' : '创建成功')
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `编辑${def.title}` : `新建${def.title}`}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={form.handleSubmit(submit)} noValidate>
          {def.form.map((field) => (
            def.key === 'tool' && (
              ['toolType', 'language', 'classPath'].includes(field.name) ||
              (editing as Record<string, unknown> | null)?.toolType === 'BUILTIN' && ['toolId', 'inputSchema', 'code'].includes(field.name)
            ) ? null :
            <div key={field.name} className={field.wide || field.type === 'textarea' || field.type === 'json' ? 'sm:col-span-2' : ''}>
              <label htmlFor={`field-${field.name}`} className="mb-1.5 block text-sm font-medium">
                {field.label}
                {field.required ? <span className="ml-1 text-destructive">*</span> : null}
                {field.secret ? <span className="ml-2 text-xs text-muted-foreground">（留空表示不修改）</span> : null}
              </label>
              <FormFieldRenderer
                field={field}
                invalid={false}
                value={form.watch(field.name)}
                onChange={(value) => {
                  form.setValue(field.name, value as never, { shouldDirty: true })
                  if (def.key === 'model-provider' && field.name === 'type' && !editing) {
                    form.setValue('baseUrl', providerBaseUrls[String(value)] ?? '', { shouldDirty: true })
                  }
                }}
              />
              {field.description ? <p className="mt-1 text-xs text-muted-foreground">{field.description}</p> : null}
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? '提交中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function useDeleteFlow<T extends { id?: string | number }>(def: ResourceDef<T>, onDeleted: () => void) {
  const [pending, setPending] = useState<T[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    if (!pending) return
    const ids = pending.map((row) => String(row.id))
    setBusy(true)
    try {
      if (def.api.usedWith) {
        const used = await def.api.usedWith(ids)
        const usages = used.data.data
        if (Array.isArray(usages) && usages.length > 0) {
          toast.error(`无法删除：资源仍被 ${usages.length} 处引用，请先解除占用`, {
            description: JSON.stringify(usages).slice(0, 200),
          })
          setPending(null)
          return
        }
      }
      await def.api.remove(ids)
      toast.success(`已删除 ${ids.length} 项`)
      setPending(null)
      onDeleted()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    } finally {
      setBusy(false)
    }
  }

  return { pending, setPending, busy, confirm }
}

const deleteDialog = (
  <>
    <AlertDialogHeader>
      <AlertDialogTitle>确认删除</AlertDialogTitle>
      <AlertDialogDescription>删除后不可恢复。若资源仍被 Agent 或其他配置引用，删除会被拒绝。</AlertDialogDescription>
    </AlertDialogHeader>
  </>
)

export function ResourcePage<T extends { id?: string | number }>({ def }: { def: ResourceDef<T> }) {
  const [search, setSearch] = useState(String(def.initialFilters?.name ?? ''))
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>(def.initialFilters ?? {})
  const [activeAction, setActiveAction] = useState<{ row: T; index: number } | null>(null)
  const [pendingToggle, setPendingToggle] = useState<{ row: T; enabled: boolean; usageCount: number } | null>(null)
  const [toggleBusy, setToggleBusy] = useState(false)
  const [editBusyId, setEditBusyId] = useState<string | null>(null)
  const invalidate = useInvalidateResource()

  const listQuery = useQuery({
    queryKey: ['list', def.key, 'all'],
    queryFn: async () => (await def.api.list!()).data.data,
    enabled: def.nonPaged,
  })

  const paged = usePagedList<T>({
    resource: def.key,
    fetcher: async (params) => {
      const response = await def.api.page!(params)
      return response.data.data
    },
    initialFilters: def.initialFilters,
    enabled: !def.nonPaged,
  })

  const form = useResourceForm(def)
  const deletion = useDeleteFlow(def, () => {
    invalidate(def.key)
    if (def.nonPaged) void listQuery.refetch()
  })
  const selection = useBatchSelection(
    def.nonPaged ? (listQuery.data ?? []).map((row) => String(row.id)) : paged.data?.records.map((row) => String(row.id)),
  )

  const rows: T[] = def.nonPaged
    ? (listQuery.data ?? []).filter((row) => {
        const record = row as Record<string, unknown>
        const displayName = String(record.name ?? record.configName ?? record.url ?? '')
        if (search && !displayName.toLocaleLowerCase().includes(search.toLocaleLowerCase())) return false
        return (def.filters ?? []).every((filter) => {
          const expected = filterValues[filter.name]
          return expected === undefined || expected === '' || String(record[filter.name] ?? '') === String(expected)
        })
      })
    : paged.data?.records ?? []
  const loading = def.nonPaged ? listQuery.isLoading : paged.isLoading
  const error = def.nonPaged ? listQuery.error : paged.error

  function refresh() {
    invalidate(def.key)
    if (def.nonPaged) void listQuery.refetch()
  }

  async function openEdit(row: T) {
    const id = String(row.id)
    setEditBusyId(id)
    try {
      const complete = def.api.detail ? (await def.api.detail(id)).data.data : row
      form.openEdit(complete)
    } catch (cause) {
      toast.error(readableError(cause, `加载${def.title}详情失败`))
    } finally {
      setEditBusyId(null)
    }
  }

  async function applyToggle(row: T, enabled: boolean) {
    setToggleBusy(true)
    try {
      const id = String(row.id)
      const needsFullEntity = ['hook', 'model-config', 'long-term-memory', 'code-execution'].includes(def.key)
      const complete = needsFullEntity && def.api.detail ? (await def.api.detail(id)).data.data : row
      const payload = needsFullEntity ? { ...complete, enabled } : { id: row.id, enabled }
      await def.api.update(payload as Partial<T>)
      toast.success(enabled ? '已启用' : '已停用')
      setPendingToggle(null)
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, enabled ? '启用失败' : '停用失败'))
    } finally {
      setToggleBusy(false)
    }
  }

  async function requestToggle(row: T, enabled: boolean) {
    if (!enabled && def.api.usedWith) {
      try {
        const usage = (await def.api.usedWith([String(row.id)])).data.data
        if (Array.isArray(usage) && usage.length > 0) {
          setPendingToggle({ row, enabled, usageCount: usage.length })
          return
        }
      } catch (cause) {
        toast.error(readableError(cause, '无法检查资源占用'))
        return
      }
    }
    await applyToggle(row, enabled)
  }

  async function deleteSelected() {
    deletion.setPending(rows.filter((row) => selection.isSelected(String(row.id))))
  }

  if (error) return <ErrorState error={error} onRetry={refresh} />

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{def.title}</h1>
          {def.description ? <p className="mt-1 text-sm text-muted-foreground">{def.description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {selection.someSelected ? (
            <Button variant="destructive" onClick={deleteSelected}>
              <Trash size={14} /> 删除选中 ({selection.selected.length})
            </Button>
          ) : null}
          <Button onClick={form.openCreate}>
            <Plus size={14} /> 新建{def.title}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder={def.searchPlaceholder ?? '按名称搜索'}
                value={search}
                onChange={(event) => {
                  const value = event.target.value
                  setSearch(value)
                  if (!def.nonPaged) paged.setFilter('name', value || undefined)
                }}
              />
            </div>
            {(def.filters ?? []).map((filter) => {
              const value = filterValues[filter.name]
              if (filter.type === 'select') return (
                <Select
                  key={filter.name}
                  value={String(value ?? 'all')}
                  onValueChange={(next) => {
                    const normalized = next === 'all' ? undefined : next
                    setFilterValues((previous) => ({ ...previous, [filter.name]: normalized }))
                    if (!def.nonPaged) paged.setFilter(filter.name, normalized)
                  }}
                >
                  <SelectTrigger className="w-36" aria-label={filter.label}>
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部{filter.label}</SelectItem>
                    {enumOptions(filter).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
              return (
                <Input
                  key={filter.name}
                  className="w-44"
                  aria-label={filter.label}
                  placeholder={filter.placeholder ?? filter.label}
                  value={value == null ? '' : String(value)}
                  onChange={(event) => {
                    const next = event.target.value
                    setFilterValues((previous) => ({ ...previous, [filter.name]: next || undefined }))
                    if (!def.nonPaged) paged.setFilter(filter.name, next || undefined)
                  }}
                />
              )
            })}
          </div>

          {loading ? (
            <TableSkeleton rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              title={`暂无${def.title}`}
              description="列表为空；点击右上角创建第一条记录。"
              action={
                <Button variant="outline" onClick={form.openCreate}>
                  <Plus size={14} /> 新建{def.title}
                </Button>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selection.allSelected}
                      onCheckedChange={() => selection.toggleAll()}
                      aria-label="全选本页"
                    />
                  </TableHead>
                  {def.columns.map((column) => (
                    <TableHead key={column.header} className={column.className}>
                      {column.header}
                    </TableHead>
                  ))}
                  <TableHead className="w-44 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const rowId = String(row.id)
                  return (
                    <TableRow key={rowId} data-state={selection.isSelected(rowId) ? 'selected' : undefined}>
                      <TableCell>
                        <Checkbox checked={selection.isSelected(rowId)} onCheckedChange={() => selection.toggle(rowId)} aria-label={`选择 ${rowId}`} />
                      </TableCell>
                      {def.columns.map((column) => (
                        <TableCell key={column.header} className={column.className}>
                          {column.kind === 'enabled' ? (
                            <Switch
                              checked={Boolean((row as Record<string, unknown>).enabled)}
                              disabled={toggleBusy}
                              onCheckedChange={(enabled) => void requestToggle(row, enabled)}
                              aria-label={`${String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).configName ?? row.id)}启用开关`}
                            />
                          ) : column.render ? column.render(row) : column.field ? String((row as Record<string, unknown>)[column.field] ?? '—') : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {def.rowActions?.map((action, index) => (
                            <Button
                              key={action.label}
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (action.renderDialog) setActiveAction({ row, index })
                                else if (action.action) void action.action(row)
                              }}
                            >
                              {action.label}
                            </Button>
                          ))}
                          <Button variant="ghost" size="sm" disabled={editBusyId === rowId} onClick={() => void openEdit(row)}>
                            {editBusyId === rowId ? '加载中…' : '编辑'}
                          </Button>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deletion.setPending([row])}>
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {!def.nonPaged && paged.data ? (
            <Pagination
              page={paged.page}
              size={paged.size}
              total={paged.data.total}
              onPageChange={paged.setPage}
              onSizeChange={paged.setSize}
            />
          ) : null}
        </CardContent>
      </Card>

      {def.key === 'long-term-memory' ? (
        <MemoryFormDialog editing={form.editing as LongTermMemoryConfig | null} open={form.open} onOpenChange={form.setOpen} onSaved={refresh} />
      ) : (
        <ResourceFormDialog def={def} form={form.form} editing={form.editing} open={form.open} onOpenChange={form.setOpen} onSaved={refresh} />
      )}

      <AlertDialog open={pendingToggle != null} onOpenChange={(open) => !open && setPendingToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认停用{def.title}</AlertDialogTitle>
            <AlertDialogDescription>该资源仍被 {pendingToggle?.usageCount} 处引用，停用后相关功能可能无法正常运行。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction disabled={toggleBusy} onClick={() => pendingToggle && void applyToggle(pendingToggle.row, pendingToggle.enabled)}>
              {toggleBusy ? '处理中…' : '确认停用'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {activeAction
        ? def.rowActions?.[activeAction.index]?.renderDialog?.(activeAction.row, () => setActiveAction(null))
        : null}

      <AlertDialog open={deletion.pending != null} onOpenChange={(open) => !open && deletion.setPending(null)}>
        <AlertDialogContent>
          {deleteDialog}
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deletion.confirm()} disabled={deletion.busy}>
              {deletion.busy ? '删除中…' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
