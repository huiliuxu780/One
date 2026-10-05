import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ClockCounterClockwise, MagnifyingGlass, Play, Plus, Square, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as automationApi from '@/api/automation'
import type { JobInfo } from '@/types'
import { usePagedList } from '@/features/data/paged'

/** 自动化任务（RM-06）：Cron 任务 CRUD、启停、手动触发与执行记录。 */
export function AutomationPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const paged = usePagedList<JobInfo>({
    resource: 'automation-job',
    fetcher: async (params) => {
      const response = await automationApi.pageJobs({ ...params, keyword: search || undefined, type: typeFilter || undefined })
      return {
        records: response.data.data.records ?? [],
        total: response.data.data.total ?? 0,
        size: response.data.data.size ?? params.size,
        current: response.data.data.current ?? params.page,
        pages: response.data.data.pages ?? 0,
      }
    },
  })
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<JobInfo | null>(null)
  const [recordsJob, setRecordsJob] = useState<JobInfo | null>(null)
  const [busy, setBusy] = useState(false)

  const rows = paged.data?.records ?? []

  async function action(label: string, job: JobInfo, fn: (id: string) => Promise<unknown>) {
    setBusy(true)
    try {
      await fn(String(job.id))
      toast.success(`${label}成功`)
      void paged.refetch()
    } catch (cause) {
      toast.error(readableError(cause, `${label}失败`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">自动化</h1>
          <p className="mt-1 text-sm text-muted-foreground">Agent / Workflow 定时任务：创建、启停、手动触发与执行记录。</p>
        </div>
        <Button onClick={() => { setEditing(null); setEditorOpen(true) }}>
          <Plus size={14} /> 新建任务
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="按任务描述搜索" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <Select value={typeFilter || 'all'} onValueChange={(value) => setTypeFilter(value === 'all' ? '' : value)}>
              <SelectTrigger className="w-40" aria-label="任务类型">
                <SelectValue placeholder="任务类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="WORKFLOW">Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {paged.isLoading ? (
            <TableSkeleton rows={4} />
          ) : paged.error ? (
            <ErrorState error={paged.error} onRetry={() => void paged.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无自动化任务" description="创建一个 Cron 任务，按计划运行 Agent 或工作流。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>目标</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>Cron</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((job) => (
                  <TableRow key={String(job.id)}>
                    <TableCell className="font-mono text-xs">{job.bizId}</TableCell>
                    <TableCell><Badge variant="outline">{job.type}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{job.cron}</TableCell>
                    <TableCell>{job.enabled ? <Badge>已启用</Badge> : <Badge variant="secondary">已禁用</Badge>}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setRecordsJob(job)}>记录</Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('手动触发', job, automationApi.triggerJob)}>
                          <Play size={13} /> 触发
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('启动', job, automationApi.startJob)}>
                          启动
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('停止', job, automationApi.stopJob)}>
                          <Square size={13} /> 停止
                        </Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void action('启停切换', job, automationApi.toggleJob)}>
                          切换
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(job); setEditorOpen(true) }}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => void action('删除', job, automationApi.deleteJob)}>
                          <Trash size={13} />
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

      <JobFormDialog open={editorOpen} onOpenChange={setEditorOpen} editing={editing} onSaved={() => void paged.refetch()} />
      {recordsJob ? <RecordsSheet job={recordsJob} onClose={() => setRecordsJob(null)} /> : null}
    </div>
  )
}

function JobFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: JobInfo | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    type: editing?.type ?? 'AGENT',
    bizId: editing?.bizId ?? '',
    cron: editing?.cron ?? '0 */5 * * * ?',
    dataMap: editing?.dataMap ?? '',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      if (editing) await automationApi.updateJob({ ...editing, ...values })
      else await automationApi.addJob({ jobClass: values.type === 'AGENT' ? 'com.hxh.apboa.scheduler.scheduler.AgentScheduler' : 'com.hxh.apboa.scheduler.scheduler.WorkflowScheduler', ...values } as unknown as JobInfo)
      toast.success('已保存')
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑任务' : '新建任务'}</DialogTitle>
          <DialogDescription>目标 bizId 为 Agent 或 Workflow 的 ID；Cron 使用 Quartz 六位表达式。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label>任务类型</Label>
            <Select value={values.type} onValueChange={(value) => setValues((v) => ({ ...v, type: value }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="WORKFLOW">Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-bizid">目标 ID（bizId）</Label>
            <Input id="job-bizid" className="mt-1.5 font-mono" value={values.bizId} onChange={(event) => setValues((v) => ({ ...v, bizId: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="job-cron">Cron 表达式</Label>
            <Input id="job-cron" className="mt-1.5 font-mono" value={values.cron} onChange={(event) => setValues((v) => ({ ...v, cron: event.target.value }))} placeholder="0 */5 * * * ?" />
            <p className="mt-1 text-xs text-muted-foreground">秒 分 时 日 月 周（Quartz）</p>
          </div>
          <div>
            <Label htmlFor="job-desc">输入映射 dataMap (JSON)</Label>
            <Textarea id="job-desc" className="mt-1.5" value={values.dataMap} onChange={(event) => setValues((v) => ({ ...v, dataMap: event.target.value }))} />
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

interface JobRecord {
  id?: string | number
  jobId?: string | number
  status?: string
  startTime?: string | number
  endTime?: string | number
  error?: string
  [key: string]: unknown
}

function RecordsSheet({ job, onClose }: { job: JobInfo; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const recordsQuery = useQuery({
    queryKey: ['list', 'job-records', String(job.id), page],
    queryFn: async () => (await automationApi.getRecords(String(job.id), page, 20)).data.data,
  })
  const records: JobRecord[] = (recordsQuery.data?.records ?? []) as JobRecord[]

  async function showDetail(record: JobRecord) {
    try {
      if (job.type === 'AGENT') {
        const detail = await automationApi.getAgentDetail(String(record.id))
        toast.success('Agent 对话详情已加载', { description: `${(detail.data.data ?? []).length} 条消息` })
      } else {
        await automationApi.getWorkflowDetail(String(record.id))
        toast.success('Workflow 节点详情已加载')
      }
    } catch (cause) {
      toast.error(readableError(cause, '详情加载失败'))
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full max-w-2xl overflow-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><ClockCounterClockwise size={16} /> 执行记录</SheetTitle>
          <SheetDescription>目标 {job.bizId} · {job.type}</SheetDescription>
        </SheetHeader>
        {recordsQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : recordsQuery.error ? (
          <ErrorState error={recordsQuery.error} onRetry={() => void recordsQuery.refetch()} />
        ) : records.length === 0 ? (
          <EmptyState title="暂无执行记录" description="手动触发一次任务后此处将出现记录。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>记录 ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>错误</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={String(record.id ?? index)}>
                  <TableCell className="font-mono text-xs">{String(record.id ?? '—')}</TableCell>
                  <TableCell><Badge variant={record.status === 'SUCCESS' ? 'default' : 'outline'}>{record.status ?? '—'}</Badge></TableCell>
                  <TableCell className="max-w-40 truncate text-xs text-destructive">{record.error ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => void showDetail(record)}>查看</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SheetContent>
    </Sheet>
  )
}
