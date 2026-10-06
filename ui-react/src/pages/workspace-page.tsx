import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FilePlus, Folder, MagnifyingGlass, Trash, Upload } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as workspaceApi from '@/api/workspace'
import { pageSessions } from '@/api/chatSession'
import type { ChatSessionVO, WorkspaceFileNode } from '@/types'
import { useBatchSelection } from '@/features/data/paged'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'

/** 工作空间：按会话维度的文件管理（RM-04）。单机共享 volume 场景。 */
export function WorkspacePage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sessionId, setSessionId] = useState<string>(() => searchParams.get('sessionId') ?? '')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Array<{ name: string; percent: number; state: 'pending' | 'uploading' | 'done' | 'error' }>>([])
  const uploadAbortRef = useRef<AbortController | null>(null)
  const [preview, setPreview] = useState<{ node: WorkspaceFileNode; url?: string; text?: string; unsupported?: boolean } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const sessionsQuery = useQuery({
    queryKey: ['list', 'chat-session', 'workspace-select'],
    queryFn: async () => (await pageSessions({ page: 1, size: 100 })).data.data.records,
  })
  const sessions: ChatSessionVO[] = sessionsQuery.data ?? []

  const filesQuery = useQuery({
    queryKey: ['list', 'workspace', sessionId],
    queryFn: async () => (await workspaceApi.listFiles(sessionId)).data.data,
    enabled: Boolean(sessionId),
  })
  const capacityQuery = useQuery({
    queryKey: ['detail', 'workspace-capacity', sessionId],
    queryFn: async () => (await workspaceApi.getCapacity(sessionId)).data.data,
    enabled: Boolean(sessionId),
  })

  const nodes = filesQuery.data ?? []
  const nodesWithUsage = useMemo(
    () => nodes.map((node) => ({ ...node, used: Boolean(node.path) })),
    [nodes],
  )
  const selection = useBatchSelection(nodesWithUsage.map((node) => node.path))

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['list', 'workspace', sessionId] })
    void queryClient.invalidateQueries({ queryKey: ['detail', 'workspace-capacity', sessionId] })
  }

  useEffect(() => () => uploadAbortRef.current?.abort(), [])

  useEffect(() => {
    const previewUrl = preview?.url
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [preview?.url])

  async function uploadFiles(files: File[]) {
    const maxSingle = 30 * 1024 * 1024
    const valid = files.filter((file) => {
      if (!file.name.trim() || file.size === 0) {
        toast.error(`${file.name || '未命名文件'}：不允许上传空文件`)
        return false
      }
      if (file.size > maxSingle) {
        toast.error(`${file.name}：超过后端单文件上限 30MB`)
        return false
      }
      return true
    })
    if (!valid.length) return
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setUploading(true)
    setUploadProgress(valid.map((file) => ({ name: file.name, percent: 0, state: 'pending' })))
    let completed = 0
    try {
      // 单文件串行上传可提供每个文件的真实进度，也能在当前文件结束前取消。
      for (const file of valid) {
        if (controller.signal.aborted) break
        setUploadProgress((items) => items.map((item) => item.name === file.name ? { ...item, state: 'uploading' } : item))
        try {
          await workspaceApi.upload(sessionId, file, (percent) => {
            setUploadProgress((items) => items.map((item) => item.name === file.name ? { ...item, percent } : item))
          }, controller.signal)
          completed++
          setUploadProgress((items) => items.map((item) => item.name === file.name ? { ...item, percent: 100, state: 'done' } : item))
        } catch (cause) {
          if (controller.signal.aborted) break
          setUploadProgress((items) => items.map((item) => item.name === file.name ? { ...item, state: 'error' } : item))
          toast.error(`${file.name}：${readableError(cause, '上传失败')}`)
        }
      }
      if (completed) {
        toast.success(`已上传 ${completed} 个文件`)
        refresh()
      }
    } finally {
      uploadAbortRef.current = null
      setUploading(false)
    }
  }

  async function previewFile(node: WorkspaceFileNode) {
    try {
      const response = await workspaceApi.downloadFile(sessionId, node.path)
      const blob = response.data as Blob
      const extension = (node.extension || node.name.split('.').pop() || '').toLowerCase()
      if (['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'csv', 'log', 'py', 'js', 'ts', 'tsx', 'java', 'sql'].includes(extension)) {
        setPreview({ node, text: await blob.text() })
        return
      }
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf'].includes(extension)) {
        setPreview({ node, url: URL.createObjectURL(blob) })
        return
      }
      setPreview({ node, unsupported: true })
    } catch (cause) {
      toast.error(readableError(cause, '预览失败'))
    }
  }

  async function saveBlobDownload(blob: unknown, filename: string) {
    const url = URL.createObjectURL(blob as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function downloadOne(node: WorkspaceFileNode) {
    try {
      const response = await workspaceApi.downloadFile(sessionId, node.path)
      await saveBlobDownload(response.data, node.name)
    } catch (cause) {
      toast.error(readableError(cause, '下载失败'))
    }
  }

  async function downloadSelected() {
    try {
      const response = await workspaceApi.downloadBatch(sessionId, selection.selected)
      await saveBlobDownload(response.data, 'workspace-files.zip')
      selection.clear()
    } catch (cause) {
      toast.error(readableError(cause, '批量下载失败'))
    }
  }

  async function removeOne(node: WorkspaceFileNode) {
    if (!window.confirm(`确认从当前会话工作空间删除${node.directory ? '目录及其内容' : '文件'}“${node.path}”？该操作不可恢复。`)) return
    try {
      await workspaceApi.deleteFile(sessionId, node.path)
      toast.success('已删除')
      refresh()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    }
  }

  const capacity = capacityQuery.data
  const filtered = search ? nodes.filter((node) => node.path.includes(search)) : nodes

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">工作空间</h1>
          <p className="mt-1 text-sm text-muted-foreground">按会话管理文件：上传（单/批/压缩包）、下载、删除与容量展示。</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-72" aria-label="选择会话">
              <SelectValue placeholder="选择会话…" />
            </SelectTrigger>
            <SelectContent>
              {sessionId && !sessions.some((session) => String(session.id) === sessionId) ? <SelectItem value={sessionId}>会话 {sessionId}</SelectItem> : null}
              {sessions.map((session) => (
                <SelectItem key={String(session.id)} value={String(session.id)}>
                  {session.title || `会话 ${String(session.id).slice(-6)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              disabled={!sessionId || uploading}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? [])
                if (files.length) {
                  void uploadFiles(files)
                }
                event.target.value = ''
              }}
            />
            <Button asChild variant="outline" disabled={!sessionId || uploading}>
              <span>
                <Upload size={14} /> {uploading ? '上传中…' : '上传'}
              </span>
            </Button>
          </label>
        </div>
      </div>

      {capacity ? (
        <div className="mb-4 text-sm text-muted-foreground">
          容量：{capacity.usedReadable ?? ''} / {capacity.maxReadable ?? ''}（以后端返回为准）
        </div>
      ) : null}

      {uploadProgress.length ? (
        <div className="mb-4 rounded-lg border border-border bg-card p-3">
          <div className="mb-2 flex items-center justify-between text-sm font-medium"><span>上传队列</span>{uploading ? <Button size="sm" variant="outline" onClick={() => uploadAbortRef.current?.abort()}>取消上传</Button> : <Button size="sm" variant="ghost" onClick={() => setUploadProgress([])}>清除记录</Button>}</div>
          <div className="space-y-2">{uploadProgress.map((item, index) => <div key={`${item.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_120px_52px] items-center gap-2 text-xs"><span className="truncate">{item.name}</span><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className={`h-full ${item.state === 'error' ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${item.percent}%` }} /></div><span className="text-right text-muted-foreground">{item.state === 'error' ? '失败' : item.state === 'pending' ? '等待' : `${item.percent}%`}</span></div>)}</div>
        </div>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-8" placeholder="按路径过滤" value={search} onChange={(event) => setSearch(event.target.value)} disabled={!sessionId} />
            </div>
            {selection.someSelected ? (
              <Button variant="outline" size="sm" onClick={() => void downloadSelected()}>
                <Download size={13} /> 下载选中 ({selection.selected.length})
              </Button>
            ) : null}
            {sessionId ? (
              <>
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const response = await workspaceApi.downloadAll(sessionId)
                    await saveBlobDownload(response.data, 'workspace-all.zip')
                  } catch (cause) {
                    toast.error(readableError(cause, '下载失败'))
                  }
                }}>
                  <Download size={13} /> 全部下载
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmClear(true)}>
                  <Trash size={13} /> 清空工作空间
                </Button>
              </>
            ) : null}
          </div>

          {!sessionId ? (
            <EmptyState title="选择会话" description="工作空间按会话组织；先选择一个会话查看其文件。" />
          ) : filesQuery.isLoading ? (
            <TableSkeleton rows={5} />
          ) : filesQuery.error ? (
            <ErrorState error={filesQuery.error} onRetry={refresh} />
          ) : filtered.length === 0 ? (
            <EmptyState title="工作空间为空" description="通过上方按钮上传文件或压缩包。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={selection.allSelected} onCheckedChange={() => selection.toggleAll()} aria-label="全选" />
                  </TableHead>
                  <TableHead>路径</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((node) => (
                  <TableRow key={node.path} data-state={selection.isSelected(node.path) ? 'selected' : undefined}>
                    <TableCell>
                      <Checkbox checked={selection.isSelected(node.path)} onCheckedChange={() => selection.toggle(node.path)} aria-label={`选择 ${node.path}`} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {node.directory ? <Folder size={13} className="mr-1 inline" /> : <FilePlus size={13} className="mr-1 inline" />}
                      {node.path}
                    </TableCell>
                    <TableCell>{node.directory ? '目录' : node.extension || '文件'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!node.directory ? (
                          <><Button variant="ghost" size="sm" onClick={() => void previewFile(node)}>预览</Button><Button variant="ghost" size="sm" onClick={() => void downloadOne(node)}>下载</Button></>
                        ) : null}
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void removeOne(node)}>删除</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清空工作空间</AlertDialogTitle>
            <AlertDialogDescription>将删除该会话工作空间中的全部文件，操作不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              try {
                await workspaceApi.clearWorkspace(sessionId)
                toast.success('已清空')
                refresh()
              } catch (cause) {
                toast.error(readableError(cause, '清空失败'))
              } finally {
                setConfirmClear(false)
              }
            }}>
              确认清空
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null) }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>{preview?.node.name}</DialogTitle><DialogDescription>{preview?.node.path}</DialogDescription></DialogHeader>
          {preview?.text !== undefined ? <pre className="max-h-[70dvh] overflow-auto rounded-lg bg-muted p-4 whitespace-pre-wrap font-mono text-xs">{preview.text}</pre> : null}
          {preview?.url && preview.node.extension?.toLowerCase() === 'pdf' ? <iframe title={preview.node.name} src={preview.url} className="h-[70dvh] w-full rounded-lg border" /> : null}
          {preview?.url && preview.node.extension?.toLowerCase() !== 'pdf' ? <img src={preview.url} alt={preview.node.name} className="max-h-[70dvh] w-full object-contain" /> : null}
          {preview?.unsupported ? <EmptyState title="此格式不支持内嵌预览" description="可使用下载按钮在本地应用中打开。" /> : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
