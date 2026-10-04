import { ArrowSquareOut, ChatCircleDots, Clock } from '@phosphor-icons/react'
import type { AgentDefinitionVO } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

function dateTime(value?: string) {
  if (!value) return '时间未知'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function AgentCard({ agent }: { agent: AgentDefinitionVO }) {
  const chatPath = `/chat/${agent.id}`
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
          <div className="flex gap-1">
            <Dialog>
              <DialogTrigger asChild><Button variant="ghost" size="sm">详情<ArrowSquareOut size={15} /></Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{agent.name}</DialogTitle><DialogDescription>{agent.agentCode}</DialogDescription></DialogHeader>
                <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
                  <Detail label="类型" value={agent.agentType === 'A2A' ? 'A2A 智能体' : '自定义智能体'} />
                  <Detail label="模型配置 ID" value={agent.modelConfigId || '未配置'} />
                  <Detail label="工具" value={`${agent.tool?.length || 0} 个`} />
                  <Detail label="技能" value={`${agent.skill?.length || 0} 个`} />
                  <Detail label="MCP" value={`${agent.mcp?.length || 0} 个`} />
                  <Detail label="子 Agent" value={`${agent.subAgent?.length || 0} 个`} />
                  <Detail label="工作流" value={`${agent.workflow?.length || 0} 个`} />
                  <Detail label="最大迭代" value={String(agent.maxIterations ?? '未配置')} />
                </dl>
              </DialogContent>
            </Dialog>
            <Button asChild size="sm"><a href={chatPath}>对话<ChatCircleDots size={15} /></a></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="mb-1 text-xs text-muted-foreground">{label}</dt><dd className="break-all font-medium">{value}</dd></div>
}
