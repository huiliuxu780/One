import { EmptyState } from '@/components/states'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

/**
 * 审查（RM-08）：Vue 原版为写死的静态演示数据，且后端不存在审查 API。
 * 按 Spec 2.2“不使用静态业务数据伪装已接通功能”，此处为诚实空态。
 * 待后端提供审查工作流后接入。
 */
export function ReviewPage() {
  return (
    <div className="px-6 py-6">
      <h1 className="text-xl font-semibold tracking-tight">审查</h1>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">Agent 与 Workflow 的内容审查工作台。</p>
      <Tabs defaultValue="agent">
        <TabsList>
          <TabsTrigger value="agent">智能体审查</TabsTrigger>
          <TabsTrigger value="workflow">工作流审查</TabsTrigger>
        </TabsList>
        <TabsContent value="agent">
          <EmptyState
            title="审查功能待后端接入"
            description="当前后端未提供审查 API（旧 Vue 页面为静态演示数据，不构成可迁移功能）。后端就绪后此页将接入真实审查流程。"
          />
        </TabsContent>
        <TabsContent value="workflow">
          <EmptyState
            title="审查功能待后端接入"
            description="当前后端未提供工作流审查 API。就绪前不做任何静态数据伪装。"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
