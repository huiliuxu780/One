import { ChatCircleDots, Clock } from '@phosphor-icons/react'
import { Link } from 'react-router-dom'
import type { AgentDefinitionVO } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

function dateTime(value?: string) {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AgentCard({ agent }: { agent: AgentDefinitionVO }) {
  const chatPath = `/chat?agentId=${encodeURIComponent(String(agent.id))}`
  return (
    <Card className="group flex min-h-52 flex-col transition-[border,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-card-hover">
      <CardHeader className="flex-row items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-50"><img src={`${import.meta.env.BASE_URL}agent.png`} alt="" className="size-8 object-contain" /></div>
        <div className="min-w-0 flex-1"><div className="truncate font-semibold" title={agent.name}>{agent.name}</div><div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{agent.agentCode}</div></div>
        <Badge variant={agent.enabled ? 'success' : 'outline'}>{agent.enabled ? '已启用' : '已停用'}</Badge>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{agent.description || '暂无描述'}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Badge variant="secondary">{agent.agentType === 'A2A' ? 'A2A' : '自定义'}</Badge>{agent.tag ? <Badge variant="outline">{agent.tag}</Badge> : null}{agent.subAgent?.length ? <Badge variant="outline">{agent.subAgent.length} 个子 Agent</Badge> : null}</div>
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock size={13} />{dateTime(agent.updatedAt)}</span>
          <Button asChild size="sm"><Link to={chatPath}>对话<ChatCircleDots size={15} /></Link></Button>
        </div>
      </CardContent>
    </Card>
  )
}
