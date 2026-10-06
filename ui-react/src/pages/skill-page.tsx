import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { ArrowClockwise, Download, FilePlus, FolderPlus, MagnifyingGlass, Plus, Trash, Upload } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { CodeEditor } from '@/components/editor/code-editor'
import { readableError } from '@/lib/utils'
import { skills, tools } from '@/api/resources'
import type { McpServerVO, SkillFileTreeNode, SkillPackageVO, ToolVO } from '@/types'
import { usePagedList } from '@/features/data/paged'
import { SkillHubSheet } from '@/features/skills/skill-hub-sheet'

export function SkillPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const paged = usePagedList<SkillPackageVO>({
    resource: 'skill',
    fetcher: async (params) => (await skills.page(params)).data.data,
  })
  const [editing, setEditing] = useState<SkillPackageVO | null>(null)
  const [editingOpen, setEditingOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [treeSkill, setTreeSkill] = useState<SkillPackageVO | null>(null)
  const [toolsSkill, setToolsSkill] = useState<SkillPackageVO | null>(null)
  const [busy, setBusy] = useState(false)
  const [pendingDisable, setPendingDisable] = useState<{ skill: SkillPackageVO; usageCount: number } | null>(null)
  // 旧 Vue 深链 /skill/new、/skill/hub、/skill/:id/edit 由 router 转成本页 query；动作只执行一次。
  const deepLinkHandled = useRef(false)

  useEffect(() => {
    if (deepLinkHandled.current) return
    const action = searchParams.get('action')
    const hub = searchParams.get('hub')
    const edit = searchParams.get('edit')
    if (!action && !hub && !edit) return
    deepLinkHandled.current = true
    const clear = () => setSearchParams({}, { replace: true })
    if (action === 'new') {
      setEditing(null)
      setEditingOpen(true)
      clear()
    } else if (hub) {
      setHubOpen(true)
      clear()
    } else if (edit) {
      skills.detail(edit).then((response) => {
        if (!response.data.data) throw new Error('技能不存在或已被删除')
        setTreeSkill(response.data.data)
      }).catch((cause) => toast.error(readableError(cause, '技能加载失败'))).finally(clear)
    }
  }, [searchParams, setSearchParams])

  const rows = paged.data?.records ?? []

  async function removeSkill(row: SkillPackageVO) {
    if (!window.confirm(`确认删除技能“${row.name}”？该操作不可撤销。`)) return
    setBusy(true)
    try {
      const used = await skills.usedWithAgent([String(row.id)])
      if (used.data.data?.length) throw new Error(`仍被 ${used.data.data.length} 处引用`)
      await skills.remove([String(row.id)])
      toast.success('已删除')
      void paged.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    } finally {
      setBusy(false)
    }
  }

  async function setSkillEnabled(skill: SkillPackageVO, enabled: boolean) {
    setBusy(true)
    try {
      await skills.update({ id: skill.id, enabled })
      toast.success(enabled ? '已启用' : '已停用')
      setPendingDisable(null)
      void paged.refetch()
    } catch (cause) {
      toast.error(readableError(cause, enabled ? '启用失败' : '停用失败'))
    } finally {
      setBusy(false)
    }
  }

  async function requestSkillEnabled(skill: SkillPackageVO, enabled: boolean) {
    if (!enabled) {
      try {
        const used = (await skills.usedWithAgent([String(skill.id)])).data.data
        if (used?.length) {
          setPendingDisable({ skill, usageCount: used.length })
          return
        }
      } catch (cause) {
        toast.error(readableError(cause, '无法检查技能占用'))
        return
      }
    }
    await setSkillEnabled(skill, enabled)
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">技能</h1>
          <p className="mt-1 text-sm text-muted-foreground">技能包管理：本地/Git/ZIP 导入、文件树编辑、工具关联与打包下载。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setHubOpen(true)}>SkillHub</Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={14} /> 导入
          </Button>
          <Button onClick={() => { setEditing(null); setEditingOpen(true) }}>
            <Plus size={14} /> 新建技能
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="w-64 pl-8" placeholder="按名称搜索" value={search} onChange={(event) => { setSearch(event.target.value); paged.setFilter('name', event.target.value || undefined) }} />
            </div>
            <Input className="w-44" aria-label="分类" placeholder="分类" value={category} onChange={(event) => { setCategory(event.target.value); paged.setFilter('category', event.target.value || undefined) }} />
          </div>

          {paged.isLoading ? (
            <TableSkeleton rows={4} />
          ) : paged.error ? (
            <ErrorState error={paged.error} onRetry={() => void paged.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="暂无技能" description="通过导入或新建创建技能包。" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>别名</TableHead>
                  <TableHead>分类</TableHead>
                  <TableHead>关联工具</TableHead>
                  <TableHead>占用</TableHead>
                  <TableHead>启用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((skill) => (
                  <TableRow key={String(skill.id)}>
                    <TableCell className="font-medium">{skill.name}</TableCell>
                    <TableCell>{skill.alias || '—'}</TableCell>
                    <TableCell>{skill.category || '—'}</TableCell>
                    <TableCell>{skill.tools?.length ?? 0} 个</TableCell>
                    <TableCell>{skill.used?.length ? <Badge variant="outline">被 {skill.used.length} 处引用</Badge> : '—'}</TableCell>
                    <TableCell><Switch checked={Boolean(skill.enabled)} disabled={busy} onCheckedChange={(enabled) => void requestSkillEnabled(skill, enabled)} aria-label={`${skill.name}启用开关`} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setTreeSkill(skill)}>文件</Button>
                        <Button variant="ghost" size="sm" onClick={() => setToolsSkill(skill)}>工具</Button>
                        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void removeSkill(skill)} className="text-destructive">删除</Button>
                        <Button variant="ghost" size="sm" onClick={async () => { try { setEditing((await skills.detail(String(skill.id))).data.data); setEditingOpen(true) } catch (cause) { toast.error(readableError(cause, '加载技能详情失败')) } }}>编辑</Button>
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

      <SkillFormDialog open={editingOpen} onOpenChange={setEditingOpen} editing={editing} onSaved={() => void paged.refetch()} />
      <AlertDialog open={pendingDisable != null} onOpenChange={(open) => !open && setPendingDisable(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>确认停用技能</AlertDialogTitle><AlertDialogDescription>该技能仍被 {pendingDisable?.usageCount} 处引用，停用后相关 Agent 可能无法正常使用。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => pendingDisable && void setSkillEnabled(pendingDisable.skill, false)}>确认停用</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => void paged.refetch()} />
      {hubOpen ? <SkillHubSheet onClose={() => setHubOpen(false)} onImported={() => void paged.refetch()} /> : null}
      {treeSkill ? <SkillFilesDialog skill={treeSkill} onClose={() => setTreeSkill(null)} /> : null}
      {toolsSkill ? <SkillToolsDialog skill={toolsSkill} onClose={() => setToolsSkill(null)} /> : null}
    </div>
  )
}

function SkillFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: SkillPackageVO | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    name: editing?.name ?? '',
    alias: editing?.alias ?? '',
    category: editing?.category ?? '',
    description: editing?.description ?? '',
    enabled: editing?.enabled ?? true,
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setValues({ name: editing?.name ?? '', alias: editing?.alias ?? '', category: editing?.category ?? '', description: editing?.description ?? '', enabled: editing?.enabled ?? true })
  }, [open, editing])

  async function submit() {
    if (!values.name.trim()) { toast.error('请填写技能包名称'); return }
    setBusy(true)
    try {
      const payload = { ...values, name: values.name.trim(), alias: values.alias.trim(), category: values.category.trim() }
      if (editing) await skills.update({ id: editing.id, ...payload } as Partial<SkillPackageVO>)
      else await skills.save(payload as Partial<SkillPackageVO>)
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
          <DialogTitle>{editing ? '编辑技能' : '新建技能'}</DialogTitle>
          <DialogDescription>新建后可在“文件”中管理技能文件树。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div>
            <Label htmlFor="skill-name">名称</Label>
            <Input id="skill-name" className="mt-1.5" value={values.name} onChange={(event) => setValues((v) => ({ ...v, name: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="skill-alias">别名</Label>
            <Input id="skill-alias" className="mt-1.5" value={values.alias} onChange={(event) => setValues((v) => ({ ...v, alias: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="skill-category">分类</Label>
            <Input id="skill-category" className="mt-1.5" value={values.category} onChange={(event) => setValues((v) => ({ ...v, category: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="skill-desc">描述</Label>
            <Textarea id="skill-desc" className="mt-1.5" value={values.description} onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))} />
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

function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (open: boolean) => void; onImported: () => void }) {
  const [mode, setMode] = useState<'local' | 'git' | 'upload'>('local')
  const [config, setConfig] = useState<{ path: string; repoUrl: string; branch: string; token: string; category: string; cover: boolean }>({
    path: '', repoUrl: '', branch: '', token: '', category: '', cover: false,
  })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) {
      setMode('local')
      setConfig({ path: '', repoUrl: '', branch: '', token: '', category: '', cover: false })
      setFile(null)
    }
  }, [open])

  async function submit() {
    if (mode === 'local' && !config.path.trim()) { toast.error('请填写服务器目录路径'); return }
    if (mode === 'git' && !config.repoUrl.trim()) { toast.error('请填写仓库地址'); return }
    setBusy(true)
    try {
      let result
      if (mode === 'local') result = await skills.importLocal({ path: config.path, category: config.category, cover: config.cover })
      else if (mode === 'git') result = await skills.importGit({ repoUrl: config.repoUrl, branch: config.branch, token: config.token || undefined, category: config.category, cover: config.cover })
      else {
        if (!file) { toast.error('请选择 ZIP 文件'); return }
        const formData = new FormData()
        formData.append('file', file)
        formData.append('category', config.category)
        formData.append('cover', String(config.cover))
        result = await skills.importUpload(formData)
      }
      const summary = result.data.data
      toast.success(`导入完成：${summary.importedCount} 导入 / ${summary.skippedCount} 跳过 / 共 ${summary.totalCount}`)
      onOpenChange(false)
      onImported()
    } catch (cause) {
      toast.error(readableError(cause, '导入失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>导入技能</DialogTitle>
          <DialogDescription>支持服务器本地目录、Git 仓库与 ZIP 上传；token 只在提交时传输。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
            <SelectTrigger aria-label="导入方式"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="local">服务器本地目录</SelectItem>
              <SelectItem value="git">Git 仓库</SelectItem>
              <SelectItem value="upload">ZIP 上传</SelectItem>
            </SelectContent>
          </Select>
          {mode === 'local' ? (
            <div>
              <Label htmlFor="skill-path">服务器目录路径</Label>
              <Input id="skill-path" className="mt-1.5" value={config.path} onChange={(event) => setConfig((c) => ({ ...c, path: event.target.value }))} placeholder="/data/skills/my-skill" />
            </div>
          ) : null}
          {mode === 'git' ? (
            <>
              <div>
                <Label htmlFor="skill-repo">仓库地址</Label>
                <Input id="skill-repo" className="mt-1.5" value={config.repoUrl} onChange={(event) => setConfig((c) => ({ ...c, repoUrl: event.target.value }))} placeholder="https://github.com/..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="skill-branch">分支</Label>
                  <Input id="skill-branch" className="mt-1.5" value={config.branch} onChange={(event) => setConfig((c) => ({ ...c, branch: event.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="skill-token">访问 Token（可选）</Label>
                  <Input id="skill-token" type="password" className="mt-1.5" value={config.token} onChange={(event) => setConfig((c) => ({ ...c, token: event.target.value }))} />
                </div>
              </div>
            </>
          ) : null}
          {mode === 'upload' ? (
            <div>
              <Label htmlFor="skill-zip">ZIP 文件</Label>
              <Input id="skill-zip" type="file" accept=".zip" className="mt-1.5" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="skill-import-category">分类</Label>
            <Input id="skill-import-category" className="mt-1.5" value={config.category} onChange={(event) => setConfig((c) => ({ ...c, category: event.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={config.cover} onCheckedChange={(checked) => setConfig((c) => ({ ...c, cover: Boolean(checked) }))} /> 覆盖同名技能
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void submit()} disabled={busy}>{busy ? '导入中…' : '开始导入'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SkillToolsDialog({ skill, onClose }: { skill: SkillPackageVO; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: ['detail', 'skill', String(skill.id)],
    queryFn: async () => (await skills.detail(String(skill.id))).data.data,
  })
  const toolsQuery = useQuery({
    queryKey: ['list', 'tool', 'options'],
    queryFn: async () => (await tools.page({ page: 1, size: 1000, enabled: true })).data.data.records,
  })
  const [selected, setSelected] = useState<string[]>((skill.tools ?? []).map(String))
  const [busy, setBusy] = useState(false)
  const initialized = useRef(false)
  useEffect(() => {
    if (detailQuery.data && !initialized.current) {
      setSelected((detailQuery.data.tools ?? []).map(String))
      initialized.current = true
    }
  }, [detailQuery.data])
  const allTools: ToolVO[] = toolsQuery.data ?? []

  async function submit() {
    setBusy(true)
    try {
      await skills.updateTools(String(skill.id), selected)
      toast.success('工具关联已更新')
      onClose()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{skill.name} · 关联工具</DialogTitle>
          <DialogDescription>勾选该技能包含的工具。</DialogDescription>
        </DialogHeader>
        {toolsQuery.error || detailQuery.error ? <ErrorState error={toolsQuery.error || detailQuery.error} onRetry={() => { void toolsQuery.refetch(); void detailQuery.refetch() }} /> : null}
        <div className="max-h-72 space-y-1 overflow-auto">
          {allTools.map((tool) => (
            <label key={String(tool.id)} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
              <Checkbox
                checked={selected.includes(String(tool.id))}
                onCheckedChange={(checked) => setSelected((previous) => (checked ? [...previous, String(tool.id)] : previous.filter((id) => id !== String(tool.id))))}
              />
              <span>{tool.name}</span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">{tool.toolId}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={() => void submit()} disabled={busy || toolsQuery.isLoading || detailQuery.isLoading || Boolean(toolsQuery.error || detailQuery.error)}>{busy ? '保存中…' : '保存'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function SkillFilesDialog({ skill, onClose }: { skill: SkillPackageVO; onClose: () => void }) {
  const treeQuery = useQuery({
    queryKey: ['detail', 'skill-tree', String(skill.id)],
    queryFn: async () => (await skills.tree(String(skill.id))).data.data,
  })
  const extensionsQuery = useQuery({
    queryKey: ['list', 'skill-allowed-extensions'],
    queryFn: async () => (await skills.allowedExtensions()).data.data,
  })
  const [current, setCurrent] = useState<SkillFileTreeNode | null>(null)
  const [content, setContent] = useState('')
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState<'file' | 'directory' | null>(null)
  const [parentPath, setParentPath] = useState('')
  const [newName, setNewName] = useState('')
  const [needsSync, setNeedsSync] = useState(false)
  const uploadInput = useRef<HTMLInputElement>(null)
  const uploadParentPath = useRef('')

  function flatten(nodes: SkillFileTreeNode[]): SkillFileTreeNode[] {
    return nodes.flatMap((node) => [node, ...(node.children ? flatten(node.children) : [])])
  }

  const nodes = treeQuery.data ?? []

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name.replace(/[\\/]/g, '_')
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  async function downloadFile(node: SkillFileTreeNode) {
    try {
      const response = await skills.downloadFile(String(skill.id), node.path)
      downloadBlob(response.data, node.name)
    } catch (cause) {
      toast.error(readableError(cause, '文件下载失败'))
    }
  }

  async function downloadZip() {
    try {
      const response = await skills.downloadZip(String(skill.id))
      downloadBlob(response.data, `${skill.name || 'skill'}.zip`)
    } catch (cause) {
      toast.error(readableError(cause, '技能包下载失败'))
    }
  }

  function requestClose() {
    if (dirty && !window.confirm('当前文件有未保存的修改，确定要放弃并离开吗？')) return
    if (!dirty && needsSync && !window.confirm('技能文件有更改尚未同步到运行节点，确定要离开吗？')) return
    onClose()
  }

  function startCreate(kind: 'file' | 'directory', parent = '') {
    setParentPath(parent)
    setNewName('')
    setCreating(kind)
  }

  function startUpload(parent = '') {
    uploadParentPath.current = parent
    uploadInput.current?.click()
  }

  async function uploadFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      await skills.uploadFile(String(skill.id), uploadParentPath.current, file)
      toast.success('文件已上传')
      setNeedsSync(true)
      void treeQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '文件上传失败'))
    } finally {
      setBusy(false)
      if (uploadInput.current) uploadInput.current.value = ''
    }
  }

  async function openFile(node: SkillFileTreeNode) {
    if (node.directory) return
    if (current?.path === node.path) return
    if (dirty && !window.confirm('当前文件有未保存的修改，确定要放弃并切换文件吗？')) return
    const extension = node.extension?.toLowerCase()
    if (extensionsQuery.isLoading) { toast.error('正在加载可编辑文件类型，请稍后重试'); return }
    if (extensionsQuery.error) { toast.error('无法读取可编辑文件类型，请重试'); return }
    if (extension && !extensionsQuery.data?.includes(extension)) {
      if (window.confirm(`文件类型 .${extension} 不支持在线预览，是否下载到本地？`)) await downloadFile(node)
      return
    }
    if (node.fileSize > 500 * 1024) {
      if (window.confirm('文件超过 500 KB，不支持在线编辑，是否下载到本地？')) await downloadFile(node)
      return
    }
    try {
      const response = await skills.fileContent(String(skill.id), node.path)
      setCurrent(node)
      setContent(response.data.data ?? '')
      setDirty(false)
    } catch (cause) {
      toast.error(readableError(cause, '读取文件失败'))
    }
  }

  async function saveFile() {
    if (!current) return
    setBusy(true)
    try {
      if (current.fileId) await skills.updateDbFile(current.fileId, content)
      else await skills.writeFile(String(skill.id), current.path, content)
      toast.success('文件已保存')
      setDirty(false)
      setNeedsSync(true)
      void treeQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  async function createNode() {
    if (!creating || !newName.trim()) return
    if (creating === 'file') {
      if (extensionsQuery.isLoading || extensionsQuery.error || !extensionsQuery.data) {
        toast.error('无法读取可创建文件类型，请稍后重试')
        return
      }
      const extension = newName.trim().split('.').pop()?.toLowerCase()
      if (extension && newName.includes('.') && !extensionsQuery.data.includes(extension)) {
        toast.error(`不允许的文件类型：.${extension}`)
        return
      }
    }
    setBusy(true)
    try {
      if (creating === 'file') await skills.createFile(String(skill.id), { parentPath, fileName: newName.trim(), content: '' })
      else await skills.createDirectory(String(skill.id), { parentPath, dirName: newName.trim() })
      toast.success('已创建')
      setNeedsSync(true)
      setCreating(null)
      setNewName('')
      void treeQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '创建失败'))
    } finally {
      setBusy(false)
    }
  }

  async function deleteNode(node: SkillFileTreeNode) {
    if (!window.confirm(`确认删除${node.directory ? '目录及其内容' : '文件'}“${node.path}”？该操作不可撤销。`)) return
    setBusy(true)
    try {
      if (node.fileId) await skills.deleteDbFile(node.fileId)
      else await skills.deleteFsNode(String(skill.id), { path: node.path, directory: node.directory })
      if (current?.path === node.path || node.directory && current?.path.startsWith(`${node.path}/`)) {
        setCurrent(null)
        setContent('')
        setDirty(false)
      }
      toast.success('已删除')
      setNeedsSync(true)
      void treeQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    } finally {
      setBusy(false)
    }
  }

  async function syncTo() {
    if (dirty) { toast.error('请先保存当前文件，再同步到运行节点'); return }
    setBusy(true)
    try {
      await skills.syncToFile(String(skill.id))
      toast.success('已同步到文件系统')
      setNeedsSync(false)
    } catch (cause) {
      toast.error(readableError(cause, '同步失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && requestClose()}>
      <SheetContent side="right" className="w-full max-w-3xl sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{skill.name} · 文件管理</SheetTitle>
          <SheetDescription>点击文件编辑内容；下载与同步针对真实文件系统。</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 gap-4">
          <div className="w-64 shrink-0 overflow-auto rounded-lg border border-border p-2">
            <div className="mb-2 flex gap-1">
              <Button variant="outline" size="sm" onClick={() => startCreate('file')}><FilePlus size={13} /> 文件</Button>
              <Button variant="outline" size="sm" onClick={() => startCreate('directory')}><FolderPlus size={13} /> 目录</Button>
              <Button variant="outline" size="sm" aria-label="上传文件到根目录" onClick={() => startUpload()}><Upload size={13} /></Button>
            </div>
            <input ref={uploadInput} className="hidden" type="file" aria-label="上传技能文件" onChange={(event) => void uploadFile(event.target.files?.[0])} />
            {creating ? (
              <div className="mb-2 space-y-1">
                <div className="truncate text-xs text-muted-foreground">父目录：{parentPath || '(根目录)'}</div>
                <div className="flex gap-1">
                <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={creating === 'file' ? 'SKILL.md' : 'examples'} className="h-8 text-xs" />
                <Button size="sm" disabled={busy} onClick={() => void createNode()}>建</Button>
                </div>
              </div>
            ) : null}
            {treeQuery.isLoading ? (
              <TableSkeleton rows={3} />
            ) : treeQuery.error ? (
              <ErrorState error={treeQuery.error} onRetry={() => void treeQuery.refetch()} />
            ) : (
              <div className="space-y-0.5">
                {flatten(nodes).map((node) => (
                  <div key={node.path} className="group flex items-center gap-1 rounded px-1.5 py-1 text-xs hover:bg-muted" style={{ paddingLeft: node.path.split('/').length * 10 }}>
                    <button className="flex-1 truncate text-left" onClick={() => void openFile(node)}>
                      {node.directory ? '📁' : '📄'} {node.name}
                    </button>
                    {node.directory ? <>
                      <button className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`在 ${node.name} 中新建文件`} onClick={() => startCreate('file', node.path)}><FilePlus size={12} /></button>
                      <button className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`在 ${node.name} 中新建目录`} onClick={() => startCreate('directory', node.path)}><FolderPlus size={12} /></button>
                      <button className="opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`上传文件到 ${node.name}`} onClick={() => startUpload(node.path)}><Upload size={12} /></button>
                    </> : null}
                    <button className="opacity-0 group-hover:opacity-100" aria-label={`删除 ${node.name}`} onClick={() => void deleteNode(node)}>
                      <Trash size={12} className="text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 space-y-1 border-t border-border pt-3">
              <Button variant="outline" size="sm" className="w-full justify-start" onClick={() => void downloadZip()}>
                <Download size={13} /> 下载整包
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={busy} onClick={() => void syncTo()}>
                <ArrowClockwise size={13} /> 同步到文件系统{needsSync ? ' · 待同步' : ''}
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            {current ? (
              <>
                <div className="mb-2 flex items-center gap-2">
                  <span className="truncate font-mono text-xs">{current.path}</span>
                  {dirty ? <Badge variant="outline">未保存</Badge> : null}
                  <Button size="sm" className="ml-auto" disabled={busy || !dirty} onClick={() => void saveFile()}>保存</Button>
                </div>
                <CodeEditor
                  key={current.path}
                  className="min-h-0 flex-1 overflow-auto rounded-lg border border-border text-xs"
                  value={content}
                  fileName={current.name}
                  onChange={(value) => { setContent(value); setDirty(true) }}
                />
              </>
            ) : (
              <EmptyState title="未选择文件" description="从左侧文件树选择要编辑的文件。" />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
