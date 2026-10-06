import { ChatCircleDots, Clock } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { AgentDefinitionVO } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function dateTime(value?: string) {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AgentCard({ agent }: { agent: AgentDefinitionVO }) {
  const chatPath = `/chat?agentId=${encodeURIComponent(String(agent.id))}`
  return (
    <Card className="group flex min-h-52 flex-col rounded-b-none transition-[border-color] hover:border-primary/40">
      <CardHeader className="flex-row items-center gap-2.5 pb-0">
        <div className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-muted"><img src={`${import.meta.env.BASE_URL}agent.png`} alt="" className="size-5 object-contain" /></div>
        <span className="truncate font-mono text-[10.5px] text-muted-foreground">{agent.agentCode}</span>
        <span className="text-[10.5px] text-muted-foreground">{agent.agentType === 'A2A' ? 'A2A' : '自定义'}</span>
        <span className={`stat ml-auto ${agent.enabled ? '' : 'off'}`}><i />{agent.enabled ? '已启用' : '已停用'}</span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="truncate font-display text-[16px] font-bold" title={agent.name}>{agent.name}</div>
        <p className="mt-2 line-clamp-2 min-h-10 text-[12.5px] leading-5 text-muted-foreground">{agent.description || '暂无描述'}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">{agent.tag ? <span className="tag">{agent.tag}</span> : null}{agent.subAgent?.length ? <span className="tag">子 Agent {agent.subAgent.length}</span> : null}</div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-muted-foreground"><Clock size={13} />{dateTime(agent.updatedAt)}</span>
          <Button asChild variant="outline" size="sm" className="border-primary bg-transparent text-primary hover:bg-primary/10"><Link to={chatPath}>对话<ChatCircleDots size={15} /></Link></Button>
        </div>
      </CardContent>
    </Card>
  )
}
