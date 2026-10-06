import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
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
import * as agentsApi from '@/api/agents'
import * as chatSessionApi from '@/api/chatSession'
import * as workflowApi from '@/api/workflows'
import type { ChatMessageVO, JobInfo, WorkflowNodeExecution } from '@/types'
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
  // 旧 Vue 深链 /automation/new、/:id/edit、/:id/records 由 router 转成本页 query。
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandled = useRef(false)

  useEffect(() => {
    if (deepLinkHandled.current) return
    const action = searchParams.get('action')
    const edit = searchParams.get('edit')
    const records = searchParams.get('records')
    if (!action && !edit && !records) return
    deepLinkHandled.current = true
    const clear = () => setSearchParams({}, { replace: true })
    if (action === 'new') {
      setEditing(null)
      setEditorOpen(true)
      clear()
      return
    }
    const target = edit ?? records
    if (!target) return
    automationApi.getJobById(target).then((response) => {
      if (!response.data.data) throw new Error('任务不存在或已被删除')
      if (edit) { setEditing(response.data.data); setEditorOpen(true) }
      else setRecordsJob(response.data.data)
    }).catch((cause) => toast.error(readableError(cause, '任务加载失败'))).finally(clear)
  }, [searchParams, setSearchParams])

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
                        <Button variant="ghost" size="sm" className="text-destructive" disabled={busy} onClick={() => {
                          if (!window.confirm(`确认删除目标为“${job.bizId}”的自动化任务？执行记录不会用于恢复该任务。`)) return
                          void action('删除', job, automationApi.deleteJob)
                        }}>
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
  const [values, setValues] = useState({ type: 'AGENT', bizId: '', cron: '0 */5 * * * ?', input: '' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let input = ''
    if (editing?.dataMap) {
      try {
        const data = JSON.parse(editing.dataMap) as { userPrompt?: string; input?: string; params?: Record<string, unknown> }
        input = editing.type === 'AGENT'
          ? (data.userPrompt ?? data.input ?? '')
          : JSON.stringify(data.params ?? {}, null, 2)
      } catch {
        input = editing.dataMap
      }
    }
    setValues({
      type: editing?.type ?? 'AGENT',
      bizId: editing?.bizId ?? '',
      cron: editing?.cron ?? '0 */5 * * * ?',
      input,
    })
  }, [editing, open])

  const targetsQuery = useQuery({
    queryKey: ['automation-targets', values.type],
    enabled: open,
    queryFn: async () => {
      if (values.type === 'AGENT') {
        const response = await agentsApi.pageAgents({ page: 1, size: 200 })
        return (response.data.data.records ?? []).map((item) => ({ id: String(item.id), name: item.name }))
      }
      const response = await workflowApi.pageWorkflows({ page: 1, size: 200 })
      return (response.data.data.records ?? []).map((item) => ({ id: String(item.id), name: item.name }))
    },
  })

  async function submit() {
    if (!values.bizId) {
      toast.error('请选择执行目标')
      return
    }
    setBusy(true)
    try {
      const target = targetsQuery.data?.find((item) => item.id === values.bizId)
      let params: Record<string, unknown> = {}
      if (values.type === 'WORKFLOW' && values.input.trim()) {
        const parsed = JSON.parse(values.input) as unknown
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Workflow 输入必须是 JSON 对象')
        params = parsed as Record<string, unknown>
      }
      const wrapper = values.type === 'AGENT'
        ? { jobName: target?.name ?? values.bizId, bizName: target?.name ?? values.bizId, type: values.type, bizId: values.bizId, userPrompt: values.input }
        : { jobName: target?.name ?? values.bizId, bizName: target?.name ?? values.bizId, type: values.type, bizId: values.bizId, params }
      const payload: JobInfo = {
        ...(editing ?? {} as JobInfo),
        type: values.type,
        bizId: values.bizId,
        cron: values.cron,
        dataMap: JSON.stringify(wrapper),
        jobClass: values.type === 'AGENT'
          ? 'com.hxh.apboa.scheduler.scheduler.AgentScheduler'
          : 'com.hxh.apboa.scheduler.scheduler.WorkflowScheduler',
        enabled: editing?.enabled ?? false,
      }
      if (editing) await automationApi.updateJob(payload)
      else await automationApi.addJob(payload)
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
            <Select value={values.type} onValueChange={(value) => setValues((v) => ({ ...v, type: value, bizId: '', input: value === 'WORKFLOW' ? '{}' : '' }))}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AGENT">Agent</SelectItem>
                <SelectItem value="WORKFLOW">Workflow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>执行目标</Label>
            <Select value={values.bizId || ''} onValueChange={(bizId) => setValues((v) => ({ ...v, bizId }))}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder={targetsQuery.isLoading ? '加载中…' : '选择目标'} /></SelectTrigger>
              <SelectContent>
                {(targetsQuery.data ?? []).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="job-cron">Cron 表达式</Label>
            <Input id="job-cron" className="mt-1.5 font-mono" value={values.cron} onChange={(event) => setValues((v) => ({ ...v, cron: event.target.value }))} placeholder="0 */5 * * * ?" />
            <p className="mt-1 text-xs text-muted-foreground">秒 分 时 日 月 周（Quartz）</p>
          </div>
          <div>
            <Label htmlFor="job-input">{values.type === 'AGENT' ? '定时发送的消息' : '工作流输入 (JSON 对象)'}</Label>
            <Textarea id="job-input" className="mt-1.5 font-mono" value={values.input} onChange={(event) => setValues((v) => ({ ...v, input: event.target.value }))} placeholder={values.type === 'AGENT' ? '请输入给 Agent 的消息' : '{}'} />
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
  jobId?: string | number
  recordId?: string | number
  createTime?: string
}

type RecordDetail =
  | { kind: 'AGENT'; recordId: string; messages: ChatMessageVO[] }
  | { kind: 'WORKFLOW'; recordId: string; nodes: WorkflowNodeExecution[] }

function RecordsSheet({ job, onClose }: { job: JobInfo; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [detail, setDetail] = useState<RecordDetail | null>(null)
  const [detailBusy, setDetailBusy] = useState(false)
  const recordsQuery = useQuery({
    queryKey: ['list', 'job-records', String(job.id), page],
    queryFn: async () => (await automationApi.getRecords(String(job.id), page, 20)).data.data,
  })
  const records: JobRecord[] = (recordsQuery.data?.records ?? []) as JobRecord[]

  async function showDetail(record: JobRecord) {
    if (!record.recordId) {
      toast.error('运行记录缺少关联 ID')
      return
    }
    const recordId = String(record.recordId)
    setDetailBusy(true)
    try {
      if (job.type === 'AGENT') {
        const response = await chatSessionApi.getCurrentMessages(recordId)
        setDetail({ kind: 'AGENT', recordId, messages: response.data.data ?? [] })
      } else {
        const response = await workflowApi.runNodes(recordId)
        setDetail({ kind: 'WORKFLOW', recordId, nodes: response.data.data ?? [] })
      }
    } catch (cause) {
      toast.error(readableError(cause, '详情加载失败'))
    } finally {
      setDetailBusy(false)
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
                <TableHead>执行时间</TableHead>
                <TableHead className="text-right">详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={String(record.recordId ?? index)}>
                  <TableCell className="font-mono text-xs">{String(record.recordId ?? '—')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{record.createTime ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" disabled={detailBusy} onClick={() => void showDetail(record)}>查看</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
          <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
            <DialogHeader>
              <DialogTitle>{detail?.kind === 'AGENT' ? 'Agent 对话详情' : 'Workflow 节点详情'}</DialogTitle>
              <DialogDescription>关联记录 {detail?.recordId}</DialogDescription>
            </DialogHeader>
            {detail?.kind === 'AGENT' ? (
              detail.messages.length === 0 ? <p className="text-sm text-muted-foreground">暂无消息。</p> : (
                <div className="space-y-3">
                  {detail.messages.map((message) => (
                    <div key={String(message.id)} className="rounded-md border p-3">
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                        <Badge variant="outline">{message.role}</Badge>
                        <span>{message.createdAt}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    </div>
                  ))}
                </div>
              )
            ) : detail?.kind === 'WORKFLOW' ? (
              detail.nodes.length === 0 ? <p className="text-sm text-muted-foreground">暂无节点执行记录。</p> : (
                <div className="space-y-3">
                  {detail.nodes.map((node) => (
                    <div key={String(node.id)} className="rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{node.nodeTitle || node.nodeId}</span>
                        <Badge variant="outline">{node.nodeType}</Badge>
                        <Badge variant={node.status === 'SUCCESS' ? 'default' : 'secondary'}>{node.status}</Badge>
                      </div>
                      {node.error ? <p className="mt-2 text-sm text-destructive">{node.error}</p> : null}
                      {node.outputs ? <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">{node.outputs}</pre> : null}
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}
