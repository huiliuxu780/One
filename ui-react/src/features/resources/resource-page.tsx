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

function enumOptions(field: FieldDef) {
  if (field.enumFrom) return field.enumFrom.map((value) => ({ label: value, value }))
  return field.options ?? []
}

export function resourceEditFieldValue(field: FieldDef, raw: unknown): unknown {
  if (field.secret) return ''
  if (field.type === 'json' && raw != null && typeof raw !== 'string') return JSON.stringify(raw, null, 2)
  return raw ?? field.defaultValue ?? (field.type === 'switch' ? false : '')
}

export function requiredFieldMissing(field: FieldDef, raw: unknown) {
  return Boolean(field.required && (raw === undefined || raw === null || (typeof raw === 'string' && !raw.trim()) || (Array.isArray(raw) && raw.length === 0)))
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
      return (
        <Input
          {...common}
          placeholder={field.placeholder ?? '输入后按回车添加，可多项'}
          value={tags.join(', ')}
          onChange={(event) =>
            onChange(
              event.target.value
                .split(/[,，]/)
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
      )
    }
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
        // 留空不修改：密钥字段无论显示控件类型如何都不回显、不提交空值。
        if (field.secret && !raw) delete payload[field.name]
        if (field.type === 'number' && raw === '') payload[field.name] = undefined
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
                onChange={(value) => form.setValue(field.name, value as never, { shouldDirty: true })}
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
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({})
  const invalidate = useInvalidateResource()

  const listQuery = useQuery({
    queryKey: ['list', def.key, 'all'],
    queryFn: async () => (await def.api.list!()).data.data,
    enabled: def.nonPaged,
  })

  const paged = usePagedList<T>({
    resource: def.key,
    fetcher: async (params) => {
      const response = await def.api.page!({ ...params, name: search || undefined, ...filterValues })
      return response.data.data
    },
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

  const rows: T[] = def.nonPaged ? listQuery.data ?? [] : paged.data?.records ?? []
  const loading = def.nonPaged ? listQuery.isLoading : paged.isLoading
  const error = def.nonPaged ? listQuery.error : paged.error

  function refresh() {
    invalidate(def.key)
    if (def.nonPaged) void listQuery.refetch()
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
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {(def.filters ?? []).map((filter) =>
              filter.type === 'select' ? (
                <Select
                  key={filter.name}
                  value={String(filterValues[filter.name] ?? 'all')}
                  onValueChange={(value) => setFilterValues((previous) => ({ ...previous, [filter.name]: value === 'all' ? undefined : value }))}
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
              ) : null,
            )}
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
                          {column.render ? column.render(row) : column.field ? String((row as Record<string, unknown>)[column.field] ?? '—') : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {def.rowActions?.map((action) => (
                            <Button key={action.label} variant="ghost" size="sm" onClick={() => void action.action(row)}>
                              {action.label}
                            </Button>
                          ))}
                          <Button variant="ghost" size="sm" onClick={() => form.openEdit(row)}>
                            编辑
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

      <ResourceFormDialog def={def} form={form.form} editing={form.editing} open={form.open} onOpenChange={form.setOpen} onSaved={refresh} />

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
