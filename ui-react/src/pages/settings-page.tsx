import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, Plus, Trash } from '@phosphor-icons/react'
import { md5 } from 'js-md5'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
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
import { accounts, secretKeys, systemParams } from '@/api/settings'
import type { AccountVO, Params, SecretKeyVO } from '@/types'
import { useAuthStore } from '@/features/auth/auth-store'
import { roleSatisfies } from '@/features/auth/permissions'

const accountRoleLabels: Record<string, string> = {
  TENANT_OWNER: '拥有者',
  TENANT_ADMIN: '管理员',
  TENANT_EDITOR: '编辑者',
  TENANT_VIEWER: '查看者',
}

export function filterAccounts(rows: AccountVO[], keyword: string): AccountVO[] {
  const value = keyword.trim().toLowerCase()
  if (!value) return rows
  return rows.filter((row) => [row.nickname, row.username, row.email].some((field) => field?.toLowerCase().includes(value)))
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = ['accounts', 'apikeys', 'params', 'intro'].includes(searchParams.get('tab') || '') ? searchParams.get('tab')! : 'accounts'
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">设置</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">账号管理、API Key、系统参数与系统介绍。</p>
      <Tabs value={tab} onValueChange={(value) => setSearchParams(value === 'accounts' ? {} : { tab: value }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="accounts">账号管理</TabsTrigger>
          <TabsTrigger value="apikeys">API Key</TabsTrigger>
          <TabsTrigger value="params">系统参数</TabsTrigger>
          <TabsTrigger value="intro">系统介绍</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="apikeys"><ApiKeysTab /></TabsContent>
        <TabsContent value="params"><ParamsTab /></TabsContent>
        <TabsContent value="intro"><SystemIntroTab /></TabsContent>
      </Tabs>
    </div>
  )
}

function AccountsTab() {
  const currentUser = useAuthStore((state) => state.user)
  const canManage = roleSatisfies(currentUser?.tenantRole, 'TENANT_ADMIN')
  const [keyword, setKeyword] = useState('')
  const listQuery = useQuery({
    queryKey: ['list', 'account'],
    queryFn: async () => (await accounts.list({})).data.data,
  })
  const [resetTarget, setResetTarget] = useState<AccountVO | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createValues, setCreateValues] = useState({ nickname: '', username: '', email: '', password: '' })
  const [removeTarget, setRemoveTarget] = useState<AccountVO | null>(null)
  const [toggleTarget, setToggleTarget] = useState<{ account: AccountVO; enabled: boolean } | null>(null)

  const rows = filterAccounts(listQuery.data ?? [], keyword)

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
      await accounts.changePassword(String(resetTarget.id), md5(newPassword))
      toast.success('密码已重置')
      setResetTarget(null)
      setNewPassword('')
    } catch (cause) {
      toast.error(readableError(cause, '重置失败'))
    } finally {
      setBusy(false)
    }
  }

  async function createAccount() {
    setBusy(true)
    try {
      await accounts.create({ ...createValues, password: md5(createValues.password) })
      toast.success('账号已创建')
      setCreating(false)
      setCreateValues({ nickname: '', username: '', email: '', password: '' })
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '创建失败'))
    } finally {
      setBusy(false)
    }
  }

  async function removeAccount() {
    if (!removeTarget) return
    setBusy(true)
    try {
      await accounts.remove([String(removeTarget.id)])
      toast.success('账号已删除')
      setRemoveTarget(null)
      void listQuery.refetch()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="relative w-64">
            <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="搜索账号" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
          </div>
          {canManage ? <Button onClick={() => setCreating(true)}><Plus size={14} /> 新建账号</Button> : null}
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
                  <TableCell>{row.tenantRole ? <Badge variant="outline">{accountRoleLabels[row.tenantRole] ?? row.tenantRole}</Badge> : '—'}</TableCell>
                  <TableCell><Switch checked={Boolean(row.enabled)} disabled={!canManage || String(row.id) === String(currentUser?.id)} onCheckedChange={(checked) => setToggleTarget({ account: row, enabled: checked })} aria-label={`启用 ${row.username}`} /></TableCell>
                  <TableCell className="text-right">
                    {canManage ? <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setResetTarget(row)}>重置密码</Button>
                      <Button variant="ghost" size="sm" className="text-destructive" disabled={String(row.id) === String(currentUser?.id)} onClick={() => setRemoveTarget(row)}><Trash size={13} /> 删除</Button>
                    </div> : '—'}
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

        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>新建账号</DialogTitle>
              <DialogDescription>账号直接加入当前默认组织；不开放组织创建或申请入口。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div><Label htmlFor="account-nickname">昵称</Label><Input id="account-nickname" value={createValues.nickname} onChange={(event) => setCreateValues((value) => ({ ...value, nickname: event.target.value }))} /></div>
              <div><Label htmlFor="account-username">账号</Label><Input id="account-username" autoComplete="off" value={createValues.username} onChange={(event) => setCreateValues((value) => ({ ...value, username: event.target.value }))} /></div>
              <div><Label htmlFor="account-email">邮箱</Label><Input id="account-email" type="email" value={createValues.email} onChange={(event) => setCreateValues((value) => ({ ...value, email: event.target.value }))} /></div>
              <div><Label htmlFor="account-password">初始密码</Label><Input id="account-password" type="password" autoComplete="new-password" value={createValues.password} onChange={(event) => setCreateValues((value) => ({ ...value, password: event.target.value }))} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setCreating(false)}>取消</Button><Button disabled={busy || !createValues.nickname.trim() || !createValues.username.trim() || !createValues.email.includes('@') || createValues.password.length < 6} onClick={() => void createAccount()}>{busy ? '创建中…' : '创建'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={Boolean(removeTarget)} onOpenChange={(open) => !open && setRemoveTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>删除账号</AlertDialogTitle><AlertDialogDescription>将永久删除“{removeTarget?.nickname || removeTarget?.username}”。管理员账号和当前登录账号受后端及前端双重保护。</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={() => void removeAccount()}>确认删除</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(toggleTarget)} onOpenChange={(open) => !open && setToggleTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>确认{toggleTarget?.enabled ? '启用' : '禁用'}账号</AlertDialogTitle><AlertDialogDescription>{toggleTarget?.enabled ? '启用后该账号可重新登录默认组织。' : '禁用后该账号将无法继续登录，请确认没有正在执行的任务。'}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>取消</AlertDialogCancel><AlertDialogAction onClick={async () => { if (!toggleTarget) return; await toggle(toggleTarget.account, toggleTarget.enabled); setToggleTarget(null) }}>确认</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}

function SystemIntroTab() {
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div><h2 className="text-lg font-semibold">Apboa Next</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">面向智能体创建、对话、资源管理、自动化、API 服务与工作流编排的开发平台。当前控制台采用 React、TypeScript、Vite、shadcn/ui 与 React Flow，后端继续复用 Java、Spring Boot 和 AgentScope。</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[['智能体与对话', '支持子 Agent、Agent-as-Tool、A2A、流式消息、工具确认与文件交互。'], ['资源管理', '统一管理模型、技能、工具、MCP、Hook、提示词、敏感词和记忆配置。'], ['编排与运行', '提供自动化任务、API 服务、看板和工作流设计、发布、运行及调试。']].map(([title, description]) => <div key={title} className="rounded-xl border border-border p-4"><div className="font-medium">{title}</div><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></div>)}
        </div>
        <div className="rounded-lg bg-muted/50 p-4 text-sm leading-6 text-muted-foreground">当前部署固定使用默认组织，组织切换、申请、审批和组织管理入口已隐藏；知识库与本地 RAG 不在本版本范围内。后端租户上下文、权限检查和登录鉴权仍保留。</div>
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
    if (!window.confirm(`确认删除 API Key“${key.name}”？使用该密钥的客户端将立即失效。`)) return
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
                          if (!window.confirm(`确认删除系统参数“${row.paramName}（${row.paramKey}）”？依赖该参数的功能可能立即失效。`)) return
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
