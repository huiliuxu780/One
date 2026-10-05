import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Download, FilePlus, Folder, MagnifyingGlass, Trash, Upload } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/components/ui/sonner'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as workspaceApi from '@/api/workspace'
import { pageSessions } from '@/api/chatSession'
import type { ChatSessionVO, WorkspaceFileNode } from '@/types'
import { useBatchSelection } from '@/features/data/paged'
import { useQueryClient } from '@tanstack/react-query'

/** 工作空间：按会话维度的文件管理（RM-04）。单机共享 volume 场景。 */
export function WorkspacePage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [sessionId, setSessionId] = useState<string>('')
  const [uploading, setUploading] = useState(false)
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

  const uploadMutation = useMutation({
    mutationFn: async (files: File[]) => {
      if (files.length === 1) await workspaceApi.upload(sessionId, files[0])
      else await workspaceApi.uploadBatch(sessionId, files)
    },
    onSuccess: (_data, files) => {
      toast.success(`已上传 ${files.length} 个文件`)
      refresh()
    },
    onError: (cause) => toast.error(readableError(cause, '上传失败')),
    onSettled: () => setUploading(false),
  })

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
          <h1 className="text-xl font-semibold tracking-tight">工作空间</h1>
          <p className="mt-1 text-sm text-muted-foreground">按会话管理文件：上传（单/批/压缩包）、下载、删除与容量展示。</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sessionId || undefined} onValueChange={setSessionId}>
            <SelectTrigger className="w-72" aria-label="选择会话">
              <SelectValue placeholder="选择会话…" />
            </SelectTrigger>
            <SelectContent>
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
                  setUploading(true)
                  uploadMutation.mutate(files)
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
                          <Button variant="ghost" size="sm" onClick={() => void downloadOne(node)}>下载</Button>
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
    </div>
  )
}
