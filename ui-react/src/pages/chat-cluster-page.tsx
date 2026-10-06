import { useQuery } from '@tanstack/react-query'
import { MagnifyingGlass, Robot } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState, PageLoading } from '@/components/states'
import { pageAgents } from '@/api/agents'
import type { AgentDefinitionVO } from '@/types'
import { useState } from 'react'

/**
 * 对话广场：聚合展示全部可用智能体（Vue 原版为骨架屏占位，此处落地其声明的功能意图）。
 */
export function ChatClusterPage() {
  const [keyword, setKeyword] = useState('')
  const agentsQuery = useQuery({
    queryKey: ['list', 'agent', 'cluster'],
    queryFn: async () => (await pageAgents({ page: 1, size: 100, enabled: true })).data.data.records,
  })

  const agents: AgentDefinitionVO[] = (agentsQuery.data ?? []).filter((agent) => agent.name.includes(keyword))

  return (
    <div className="px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold leading-tight">对话广场</h1>
          <p className="mt-1 text-sm text-muted-foreground">聚合展示全部可用智能体，点击进入对话。</p>
        </div>
        <div className="relative w-64">
          <MagnifyingGlass size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8" placeholder="搜索智能体" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
      </div>

      {agentsQuery.isLoading ? (
        <PageLoading label="智能体加载中…" />
      ) : agents.length === 0 ? (
        <EmptyState title="暂无可用智能体" description="先在“智能体”页创建并启用一个智能体。" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => (
            <a
              key={String(agent.id)}
              href={`/chat?agent=${agent.id}`}
              className="group rounded-lg border border-border bg-card p-5 shadow-card transition-[border,transform] hover:border-primary/40 hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Robot size={20} />
                </span>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{agent.name}</div>
                  <div className="truncate font-mono text-xs text-muted-foreground">{agent.agentCode}</div>
                </div>
                {agent.tag ? <Badge variant="outline" className="ml-auto shrink-0">{agent.tag}</Badge> : null}
              </div>
              <p className="mt-3 line-clamp-2 min-h-10 text-sm text-muted-foreground">{agent.description || '暂无描述'}</p>
              <div className="mt-3 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">开始对话 →</div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
