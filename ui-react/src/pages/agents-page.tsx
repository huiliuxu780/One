import { useCallback, useEffect, useState } from 'react'
import { DotsThreeOutline, MagnifyingGlass, PencilSimple, Plus, Robot, Trash, Copy } from '@phosphor-icons/react'
import { listAgentTags, pageAgents, removeAgents, usedWithAgent } from '@/api/agents'
import { AgentCard } from '@/features/agents/agent-card'
import { AgentEditor } from '@/features/agents/agent-editor'
import { AgentDetails } from '@/features/agents/agent-details'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/sonner'
import type { AgentDefinitionVO, PageResult } from '@/types'
import { readableError } from '@/lib/utils'

const EMPTY_PAGE: PageResult<AgentDefinitionVO> = { records: [], total: 0, size: 24, current: 1, pages: 0 }

export function AgentsPage() {
  const [result, setResult] = useState(EMPTY_PAGE)
  const [tags, setTags] = useState<string[]>([])
  const [keyword, setKeyword] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [selectedType, setSelectedType] = useState<'' | 'CUSTOM' | 'A2A'>('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [cloneFrom, setCloneFrom] = useState<AgentDefinitionVO | null>(null)
  const [detailsAgent, setDetailsAgent] = useState<AgentDefinitionVO | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await pageAgents({ page, size: 24, name: keyword || undefined, tag: selectedTag || undefined, agentType: selectedType || undefined })
      setResult(response.data.data)
    } catch (cause) {
      setError(readableError(cause, '智能体加载失败'))
    } finally {
      setLoading(false)
    }
  }, [keyword, selectedTag, selectedType, page])

  useEffect(() => { listAgentTags().then((response) => setTags(response.data.data)).catch(() => setTags([])) }, [])
  useEffect(() => { const timer = window.setTimeout(load, 250); return () => window.clearTimeout(timer) }, [load])

  function openCreate() {
    setEditingId(null)
    setCloneFrom(null)
    setEditorOpen(true)
  }

  function openEdit(agent: AgentDefinitionVO) {
    setEditingId(String(agent.id))
    setCloneFrom(null)
    setEditorOpen(true)
  }

  function openClone(agent: AgentDefinitionVO) {
    setEditingId(null)
    setCloneFrom(agent)
    setEditorOpen(true)
  }

  async function handleDelete(agents: AgentDefinitionVO[]) {
    const label = agents.length === 1 ? `智能体“${agents[0]?.name || agents[0]?.agentCode || agents[0]?.id}”` : `${agents.length} 个智能体`
    if (!window.confirm(`确认删除${label}？该操作不可撤销。`)) return
    const ids = agents.map((agent) => String(agent.id))
    try {
      const used = await usedWithAgent(ids)
      if (used.data.data?.length) {
        toast.error(`无法删除：仍被 ${used.data.data.length} 处引用（如子 Agent 或工作流）`, { description: JSON.stringify(used.data.data).slice(0, 200) })
        return
      }
      await removeAgents(ids)
      toast.success(`已删除 ${ids.length} 个智能体`)
      void load()
    } catch (cause) {
      toast.error(readableError(cause, '删除失败'))
    }
  }

  return (
    <main className="min-h-[100dvh] px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1440px]">
        <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-primary"><Robot size={18} weight="duotone" />Agent workspace</div><h1 className="text-2xl font-semibold tracking-tight">智能体</h1><p className="mt-1 text-sm text-muted-foreground">管理自定义智能体、A2A 智能体和子 Agent 关系。</p></div>
          <Button onClick={openCreate}><Plus size={17} weight="bold" />新建智能体</Button>
        </header>

        <section className="flex flex-col gap-3 py-5 lg:flex-row lg:items-center">
          <div className="relative w-full max-w-md"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17} /><Input value={keyword} onChange={(event) => { setKeyword(event.target.value); setPage(1) }} placeholder="搜索名称" className="pl-10" aria-label="搜索智能体" /></div>
          <div className="flex flex-wrap gap-2">
            <FilterButton active={!selectedType} onClick={() => { setSelectedType(''); setPage(1) }}>全部类型</FilterButton>
            <FilterButton active={selectedType === 'CUSTOM'} onClick={() => { setSelectedType('CUSTOM'); setPage(1) }}>自定义</FilterButton>
            <FilterButton active={selectedType === 'A2A'} onClick={() => { setSelectedType('A2A'); setPage(1) }}>A2A</FilterButton>
          </div>
          {tags.length ? <select value={selectedTag} onChange={(event) => { setSelectedTag(event.target.value); setPage(1) }} className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"><option value="">全部标签</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select> : null}
          <span className="ml-auto text-xs text-muted-foreground">共 {result.total} 个</span>
        </section>

        {error ? <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5"><p className="text-sm font-medium text-destructive">{error}</p><Button variant="outline" size="sm" onClick={() => void load()} className="mt-3">重试</Button></div> : null}
        {!error && loading ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><LoadingCard /><LoadingCard /><LoadingCard /></div> : null}
        {!error && !loading && result.records.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {result.records.map((agent) => (
              <div key={String(agent.id)} className="space-y-2">
                <AgentCard agent={agent} />
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setDetailsAgent(agent)}><DotsThreeOutline size={13} /> 详情</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(agent)}><PencilSimple size={13} /> 编辑</Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openClone(agent)}><Copy size={13} /> 复制</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => void handleDelete([agent])}><Trash size={13} /> 删除</Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!error && !loading && !result.records.length ? <div className="grid min-h-72 place-items-center rounded-xl border border-dashed border-border bg-card/55 p-8 text-center"><div><div className="mx-auto mb-4 grid size-12 place-items-center rounded-xl bg-muted text-muted-foreground"><Robot size={25} /></div><h2 className="font-semibold">没有匹配的智能体</h2><p className="mt-1 text-sm text-muted-foreground">调整搜索条件，或新建第一个智能体。</p></div></div> : null}
        {result.total > result.size ? (
          <div className="pt-4">
            <Pagination page={page} size={result.size} total={result.total} onPageChange={setPage} pageSizeOptions={[24, 48]} />
          </div>
        ) : null}
      </div>

      <AgentEditor open={editorOpen} onOpenChange={setEditorOpen} agentId={editingId} cloneFrom={cloneFrom} onSaved={() => void load()} />
      {detailsAgent ? <AgentDetails agent={detailsAgent} onClose={() => setDetailsAgent(null)} /> : null}
    </main>
  )
}

function FilterButton({ active, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return <button className={active ? 'h-9 rounded-lg bg-slate-900 px-3 text-sm text-white' : 'h-9 rounded-lg border border-border bg-background px-3 text-sm text-muted-foreground hover:bg-muted'} {...props} />
}

function LoadingCard() {
  return <div className="rounded-xl border border-border bg-card p-5"><div className="flex gap-3"><Skeleton className="size-11" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div><Skeleton className="mt-6 h-10 w-full" /><Skeleton className="mt-6 h-8 w-2/3" /></div>
}
