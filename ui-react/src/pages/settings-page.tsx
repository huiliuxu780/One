import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/sonner'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/states'
import { readableError } from '@/lib/utils'
import { accounts, secretKeys, storageProtocols, systemParams } from '@/api/settings'
import type { AccountVO, Params, SecretKeyVO, StorageProtocol } from '@/types'

export function SettingsPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">设置</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">账号管理、API Key、系统参数与系统介绍。</p>
      <Tabs defaultValue="accounts">
        <TabsList>
          <TabsTrigger value="accounts">账号管理</TabsTrigger>
          <TabsTrigger value="apikeys">API Key</TabsTrigger>
          <TabsTrigger value="params">系统参数</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="apikeys"><ApiKeysTab /></TabsContent>
        <TabsContent value="params"><ParamsTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function AccountsTab() {
  const [keyword, setKeyword] = useState('')
  const listQuery = useQuery({
    queryKey: ['list', 'account', keyword],
    queryFn: async () => (await accounts.list({ keyword: keyword || undefined })).data.data,
  })
  const [resetTarget, setResetTarget] = useState<AccountVO | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const rows: AccountVO[] = listQuery.data ?? []

  async function toggle(row: AccountVO, enabled: boolean) {
    try {
      await accounts.toggleEnabled(String(row.id), enabled)
      toast.success('已更新')
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '操作失败'))
    }
  }

  async function resetPassword() {
    if (!resetTarget) return
    setBusy(true)
    try {
      await accounts.changePassword(String(resetTarget.id), newPassword)
      toast.success('密码已重置')
      setResetTarget(null)
      setNewPassword('')
    } catch (cause) {
      toast.error(readableError(cause, '重置失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 w-64">
          <div className="relative">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索账号" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </div>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无账号" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>昵称</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell className="font-mono text-xs">{row.username}</TableCell>
                  <TableCell>{row.nickname}</TableCell>
                  <TableCell>{row.email || '—'}</TableCell>
                  <TableCell>{row.tenantRole ? <Badge variant="outline">{row.tenantRole}</Badge> : '—'}</TableCell>
                  <TableCell><Switch checked={Boolean(row.enabled)} onCheckedChange={(checked) => void toggle(row, checked)} aria-label={`启用 ${row.username}`} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setResetTarget(row)}>重置密码</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>重置密码 · {resetTarget?.username}</DialogTitle>
              <DialogDescription>新密码经 md5 后提交，明文不落日志。</DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="reset-password">新密码</Label>
              <Input id="reset-password" type="password" className="mt-1.5" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResetTarget(null)}>取消</Button>
              <Button onClick={() => void resetPassword()} disabled={busy || newPassword.length < 6}>{busy ? '提交中…' : '确认重置'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function ApiKeysTab() {
  const listQuery = useQuery({ queryKey: ['list', 'sk'], queryFn: async () => (await secretKeys.list()).data.data })
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<SecretKeyVO | null>(null)
  const [editName, setEditName] = useState('')

  const rows: SecretKeyVO[] = listQuery.data ?? []

  async function create() {
    if (!name.trim()) return
    setBusy(true)
    try {
      const response = await secretKeys.create({ name: name.trim() })
      toast.success('已创建', { description: '完整密钥仅本次返回，请立即保存（不会再次显示）' })
      if (response.data.data?.value) toast.info(`密钥：${response.data.data.value}`)
      setName('')
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '创建失败'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(key: SecretKeyVO) {
    try {
      await secretKeys.remove([String(key.id)])
      toast.success('已删除')
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    }
  }

  async function rename() {
    if (!editing) return
    try {
      await secretKeys.update({ id: editing.id, name: editName })
      toast.success('已更新')
      setEditing(null)
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '更新失败'))
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex gap-2">
          <Input className="w-64" placeholder="新密钥名称" value={name} onChange={(event) => setName(event.target.value)} />
          <Button onClick={() => void create()} disabled={busy || !name.trim()}>
            <Plus size={14} /> 创建密钥
          </Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={3} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无 API Key" description="创建一个密钥用于 API 访问。" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>密钥（已脱敏）</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((key) => (
                <TableRow key={String(key.id)}>
                  <TableCell>{key.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{key.value}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(key); setEditName(key.name) }}>改名</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(key)}><Trash size={13} /> 删除</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>修改密钥名称</DialogTitle>
              <DialogDescription>仅允许更新名称；密钥值不可修改。</DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="sk-name">名称</Label>
              <Input id="sk-name" className="mt-1.5" value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
              <Button onClick={() => void rename()}>保存</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

function ParamsTab() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<Params | null>(null)
  const [creating, setCreating] = useState(false)
  const listQuery = useQuery({
    queryKey: ['list', 'params', keyword, page],
    queryFn: async () => (await systemParams.page({ page, size: 10, keyword: keyword || undefined })).data.data,
  })

  const rows: Params[] = listQuery.data?.records ?? []

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex gap-2">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索参数" value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} />
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus size={14} /> 新建参数
          </Button>
        </div>
        {listQuery.isLoading ? (
          <TableSkeleton rows={4} />
        ) : listQuery.error ? (
          <ErrorState error={listQuery.error} onRetry={() => void listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title="暂无系统参数" />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>键</TableHead>
                  <TableHead>值</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={String(row.id)}>
                    <TableCell>{row.paramName}</TableCell>
                    <TableCell className="font-mono text-xs">{row.paramKey}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs">{row.paramValue}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(row)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                          try {
                            await systemParams.remove([String(row.id)])
                            toast.success('已删除')
                            void listQuery.refetch()
                          } catch (cause) {
                            toast.error(readableError(cause, '删除失败'))
                          }
                        }}>
                          删除
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {listQuery.data && listQuery.data.total > listQuery.data.size ? (
              <Pagination page={page} size={listQuery.data.size} total={listQuery.data.total} onPageChange={setPage} />
            ) : null}
          </>
        )}

        <ParamFormDialog
          open={creating || Boolean(editing)}
          onOpenChange={(open) => { if (!open) { setCreating(false); setEditing(null) } }}
          editing={editing}
          onSaved={() => { void listQuery.refetch(); setCreating(false); setEditing(null) }}
        />
      </CardContent>
    </Card>
  )
}

function ParamFormDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Params | null
  onSaved: () => void
}) {
  const [values, setValues] = useState({
    paramName: editing?.paramName ?? '',
    paramKey: editing?.paramKey ?? '',
    paramValue: editing?.paramValue ?? '',
  })
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      if (editing) await systemParams.update({ id: editing.id, ...values })
      else await systemParams.save(values)
      toast.success('已保存')
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑参数' : '新建参数'}</DialogTitle>
          <DialogDescription>修改系统参数可能影响服务行为，请谨慎操作。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="param-name">名称</Label>
            <Input id="param-name" className="mt-1.5" value={values.paramName} onChange={(event) => setValues((v) => ({ ...v, paramName: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="param-key">键</Label>
            <Input id="param-key" className="mt-1.5 font-mono" value={values.paramKey} onChange={(event) => setValues((v) => ({ ...v, paramKey: event.target.value }))} />
          </div>
          <div>
            <Label htmlFor="param-value">值</Label>
            <Input id="param-value" className="mt-1.5 font-mono" value={values.paramValue} onChange={(event) => setValues((v) => ({ ...v, paramValue: event.target.value }))} />
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
