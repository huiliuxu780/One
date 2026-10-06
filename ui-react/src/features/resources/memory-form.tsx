import { useEffect, useState } from 'react'
import { longTermMemories } from '@/api/resources'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import type { LongTermMemoryConfig } from '@/types'

type MemoryType = LongTermMemoryConfig['memoryType']
type MemoryMode = 'AGENT_CONTROL' | 'STATIC_CONTROL' | 'BOTH'

export interface MemoryDraft {
  configName: string
  memoryType: MemoryType
  memoryMode: MemoryMode
  apiBaseUrl: string
  apiKey: string
  apiType: 'platform' | 'self-hosted'
  timeout: number
  memoryLibraryId: string
  projectId: string
  topK: number
  minScore: number
}

const defaultUrl: Record<MemoryType, string> = { MEM0: 'https://api.mem0.ai', REME: 'https://api.reme.ai', BAILIAN: '' }

export function memoryDraftFrom(entity?: LongTermMemoryConfig | null): MemoryDraft {
  const type = entity?.memoryType ?? 'MEM0'
  const config = entity?.config ?? {}
  return {
    configName: entity?.configName ?? '',
    memoryType: type,
    memoryMode: (config.memoryMode as MemoryMode) ?? 'BOTH',
    apiBaseUrl: String(config.apiBaseUrl ?? defaultUrl[type]),
    apiKey: '',
    apiType: config.apiType === 'self-hosted' ? 'self-hosted' : 'platform',
    timeout: Number(config.timeout ?? 30),
    memoryLibraryId: String(config.memoryLibraryId ?? ''),
    projectId: String(config.projectId ?? ''),
    topK: Number(config.topK ?? 5),
    minScore: Number(config.minScore ?? 0.5),
  }
}

export function memoryPayload(draft: MemoryDraft, editing?: LongTermMemoryConfig | null): Partial<LongTermMemoryConfig> {
  const sameType = editing?.memoryType === draft.memoryType
  const previous = sameType ? editing?.config ?? {} : {}
  const config: Record<string, unknown> = { memoryMode: draft.memoryMode }
  if (draft.memoryType === 'MEM0') {
    config.apiBaseUrl = draft.apiBaseUrl.trim()
    config.apiType = draft.apiType
  } else if (draft.memoryType === 'REME') {
    config.apiBaseUrl = draft.apiBaseUrl.trim()
    config.timeout = draft.timeout
  } else {
    config.memoryLibraryId = draft.memoryLibraryId.trim()
    config.projectId = draft.projectId.trim()
    config.topK = draft.topK
    config.minScore = draft.minScore
  }
  if (draft.memoryType !== 'REME') {
    const key = draft.apiKey.trim() || String(previous.apiKey ?? '')
    if (key) config.apiKey = key
  }
  return { id: editing?.id, configName: draft.configName.trim(), memoryType: draft.memoryType, enabled: editing?.enabled ?? true, config }
}

export function MemoryFormDialog({ editing, open, onOpenChange, onSaved }: {
  editing: LongTermMemoryConfig | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<MemoryDraft>(() => memoryDraftFrom(editing))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setDraft(memoryDraftFrom(editing))
  }, [editing, open])

  function set<K extends keyof MemoryDraft>(key: K, value: MemoryDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  async function submit() {
    if (!draft.configName.trim()) return toast.error('请填写配置名称')
    if (draft.memoryType === 'REME' && (!Number.isFinite(draft.timeout) || draft.timeout < 5 || draft.timeout > 300)) return toast.error('请求超时应为 5–300 秒')
    if (draft.memoryType === 'BAILIAN' && (!Number.isFinite(draft.topK) || draft.topK < 1 || draft.topK > 100 || !Number.isFinite(draft.minScore) || draft.minScore < 0 || draft.minScore > 1)) return toast.error('请检查 TopK 和最低匹配分数')
    setBusy(true)
    try {
      const payload = memoryPayload(draft, editing)
      if (editing?.id) await longTermMemories.update(payload)
      else await longTermMemories.save(payload)
      toast.success(editing ? '已保存修改' : '创建成功')
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存长期记忆配置失败'))
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{editing ? '编辑长期记忆配置' : '新增长期记忆配置'}</DialogTitle><DialogDescription>按记忆服务类型填写连接信息。密钥留空时保留原值。</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="配置名称" wide><Input value={draft.configName} onChange={(event) => set('configName', event.target.value)} /></Field>
        <Field label="记忆类型"><Select value={draft.memoryType} onValueChange={(value) => setDraft({ ...memoryDraftFrom(), configName: draft.configName, memoryType: value as MemoryType, apiBaseUrl: defaultUrl[value as MemoryType] })}><SelectTrigger aria-label="记忆类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="MEM0">Mem0 长期记忆</SelectItem><SelectItem value="REME">ReMe 长期记忆</SelectItem><SelectItem value="BAILIAN">百炼记忆库</SelectItem></SelectContent></Select></Field>
        <Field label="记忆控制模式"><Select value={draft.memoryMode} onValueChange={(value) => set('memoryMode', value as MemoryMode)}><SelectTrigger aria-label="记忆控制模式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AGENT_CONTROL">Agent 自主控制</SelectItem><SelectItem value="STATIC_CONTROL">系统自动管理</SelectItem><SelectItem value="BOTH">两者结合</SelectItem></SelectContent></Select></Field>
        {draft.memoryType === 'MEM0' ? <>
          <Field label="服务地址" wide><Input value={draft.apiBaseUrl} onChange={(event) => set('apiBaseUrl', event.target.value)} placeholder="https://api.mem0.ai" /></Field>
          <Field label="部署类型"><Select value={draft.apiType} onValueChange={(value) => set('apiType', value as MemoryDraft['apiType'])}><SelectTrigger aria-label="部署类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="platform">Platform Mem0</SelectItem><SelectItem value="self-hosted">自建 Mem0</SelectItem></SelectContent></Select></Field>
          <Field label="API 密钥"><Input type="password" autoComplete="new-password" value={draft.apiKey} onChange={(event) => set('apiKey', event.target.value)} placeholder={editing ? '留空不修改' : 'Platform Mem0 必需'} /></Field>
        </> : null}
        {draft.memoryType === 'REME' ? <>
          <Field label="服务地址"><Input value={draft.apiBaseUrl} onChange={(event) => set('apiBaseUrl', event.target.value)} placeholder="https://api.reme.ai" /></Field>
          <Field label="请求超时（秒）"><Input type="number" min={5} max={300} value={draft.timeout} onChange={(event) => set('timeout', Number(event.target.value))} /></Field>
        </> : null}
        {draft.memoryType === 'BAILIAN' ? <>
          <Field label="API 密钥"><Input type="password" autoComplete="new-password" value={draft.apiKey} onChange={(event) => set('apiKey', event.target.value)} placeholder={editing ? '留空不修改' : '阿里云 API Key'} /></Field>
          <Field label="记忆库 ID"><Input value={draft.memoryLibraryId} onChange={(event) => set('memoryLibraryId', event.target.value)} /></Field>
          <Field label="项目 ID"><Input value={draft.projectId} onChange={(event) => set('projectId', event.target.value)} /></Field>
          <Field label="TopK"><Input type="number" min={1} max={100} value={draft.topK} onChange={(event) => set('topK', Number(event.target.value))} /></Field>
          <Field label="最低匹配分数"><Input type="number" min={0} max={1} step={0.1} value={draft.minScore} onChange={(event) => set('minScore', Number(event.target.value))} /></Field>
        </> : null}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? '保存中…' : '保存'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <label className={wide ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}><span className="text-sm font-medium">{label}</span>{children}</label>
}
