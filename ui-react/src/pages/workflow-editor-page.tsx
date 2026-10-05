import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Bug, FloppyDisk, Play, ShieldCheck } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { ErrorState, PageLoading } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as workflowApi from '@/api/workflows'
import { nodeMetadata } from '@/api/workflows'
import type { NodeMetadata, WorkflowRunResult, WorkflowVersion, WorkflowValidationResult } from '@/types'
import { fromBackendDefinition, toBackendDefinition } from '@/features/workflow/protocol'

const NODE_PALETTE = ['START', 'END', 'AGENT', 'TOOL', 'MCP', 'CODE', 'HTTP', 'IF_ELSE', 'INTENT', 'LOOP', 'ITERATE', 'DB', 'CACHE', 'MQ', 'CHANNEL', 'CONSTANT', 'VARIABLE_AGG', 'SERIALIZE']
// 知识库节点不在节点库中（明确排除）；旧含 KNOWLEDGE 节点的流程加载后只读提示。

function WorkflowCanvasNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  return (
    <div className={`w-44 rounded-lg border bg-card px-3 py-2 shadow-card ${selected ? 'border-primary ring-2 ring-ring' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{String(data.name ?? '节点')}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">{String(data.type ?? '')}</Badge>
      </div>
    </div>
  )
}

const nodeTypes = { workflow: WorkflowCanvasNode }

export function WorkflowEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [configText, setConfigText] = useState('{}')
  const [configDirty, setConfigDirty] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [runResult, setRunResult] = useState<WorkflowRunResult | null>(null)
  const [runInputs, setRunInputs] = useState('{}')

  const detailQuery = useQuery({
    queryKey: ['detail', 'workflow', String(id)],
    queryFn: async () => (await workflowApi.getWorkflow(String(id))).data.data,
    enabled: Boolean(id),
  })
  const metadataQuery = useQuery({ queryKey: ['list', 'workflow-node-metadata'], queryFn: async () => (await nodeMetadata()).data.data })
  const metadata: NodeMetadata[] = metadataQuery.data ?? []
  const supportedMetadata = metadata.filter((item) => !item.type.toUpperCase().includes('KNOWLEDGE'))

  useEffect(() => {
    const detail = detailQuery.data
    if (!detail?.workflow.config) return
    const hasKnowledgeNode = (detail.workflow.config.nodes ?? []).some((node) => node.type === 'KNOWLEDGE')
    if (hasKnowledgeNode) {
      toast.warning('该流程包含旧知识库节点，新前端不支持其配置；保存时将原样保留，不会静默删除。')
    }
    const { nodes: flowNodes, edges: flowEdges } = fromBackendDefinition(detail.workflow.config)
    setNodes(flowNodes)
    setEdges(flowEdges)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId])
  const legacyReadOnly = useMemo(
    () => nodes.some((node) => String(node.data.type ?? '').toUpperCase().includes('KNOWLEDGE')),
    [nodes],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (legacyReadOnly) return
      setEdges((existing) => addEdge({ ...connection, id: `e_${connection.source}_${connection.target}_${Date.now()}` }, existing))
    },
    [legacyReadOnly, setEdges],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedId(node.id)
    setConfigText(JSON.stringify((node.data.config as Record<string, unknown>) ?? {}, null, 2))
    setConfigDirty(false)
  }, [])

  function applyConfig() {
    if (!selectedNode || legacyReadOnly) return
    try {
      const parsed = JSON.parse(configText) as Record<string, unknown>
      setNodes((existing) => existing.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, config: parsed } } : node)))
      setConfigDirty(false)
      toast.success('节点配置已应用到画布（尚未保存到服务端）')
    } catch {
      toast.error('配置不是合法 JSON')
    }
  }

  function addNode(type: string) {
    if (legacyReadOnly || type.toUpperCase().includes('KNOWLEDGE')) return
    const meta = supportedMetadata.find((item) => item.type === type)
    const newNode: Node = {
      id: `node_${type.toLowerCase()}_${Date.now()}`,
      type: 'workflow',
      position: { x: 120 + Math.random() * 300, y: 120 + Math.random() * 200 },
      data: { type, name: meta?.title ?? type, config: {} },
    }
    setNodes((existing) => [...existing, newNode])
    setSelectedId(newNode.id)
    setConfigText('{}')
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const definition = toBackendDefinition(nodes, edges, detailQuery.data?.workflow.config?.variables, detailQuery.data?.workflow.config?.viewport)
      return workflowApi.updateWorkflow({ id, name: detailQuery.data?.workflow.name, config: definition })
    },
    onSuccess: () => {
      toast.success('已保存')
      void detailQuery.refetch()
    },
    onError: (cause) => toast.error(readableError(cause, '保存失败')),
  })

  const validateMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync()
      return (await workflowApi.validateWorkflow(String(id))).data.data
    },
    onSuccess: (result: WorkflowValidationResult) => {
      const valid = (result as { valid?: boolean }).valid
      const errors = (result as { errors?: Array<{ message?: string }> }).errors
      if (valid) toast.success('校验通过')
      else toast.error('校验未通过', { description: (errors ?? []).map((error) => error.message).join('；').slice(0, 200) })
    },
    onError: (cause) => toast.error(readableError(cause, '校验失败')),
  })

  const publishMutation = useMutation({
    mutationFn: async () => (await workflowApi.publishWorkflow(String(id), 'React 前端发布')).data.data,
    onSuccess: () => toast.success('已发布新版本'),
    onError: (cause) => toast.error(readableError(cause, '发布失败')),
  })

  const runMutation = useMutation({
    mutationFn: async (mode: 'debug' | 'run') => {
      const inputs = JSON.parse(runInputs) as Record<string, unknown>
      return mode === 'debug' ? (await workflowApi.debugRun(String(id), { inputs } as never)).data.data : (await workflowApi.formalRun(String(id), { inputs } as never)).data.data
    },
    onSuccess: (result: WorkflowRunResult) => {
      setRunResult(result)
      toast.success('执行完成')
    },
    onError: (cause) => {
      toast.error('执行失败（原始错误见结果）', { description: readableError(cause, '') })
      setRunResult(null)
    },
  })

  if (detailQuery.isLoading) return <PageLoading label="工作流加载中…" />
  if (detailQuery.error) return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/workflow')}>
          <ArrowLeft size={14} /> 返回
        </Button>
        <span className="font-semibold">{detailQuery.data?.workflow.name}</span>
        <Badge variant="secondary" className="ml-1">{detailQuery.data?.workflow.version ?? '草稿'}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>版本</Button>
          <Button variant="outline" size="sm" onClick={() => validateMutation.mutate()} disabled={legacyReadOnly || validateMutation.isPending}>
            <ShieldCheck size={14} /> 校验
          </Button>
          <Button variant="outline" size="sm" onClick={() => publishMutation.mutate()} disabled={legacyReadOnly || publishMutation.isPending}>
            发布
          </Button>
          <Button variant="outline" size="sm" onClick={() => runMutation.mutate('debug')} disabled={legacyReadOnly || runMutation.isPending}>
            <Bug size={14} /> 调试运行
          </Button>
          <Button variant="outline" size="sm" onClick={() => runMutation.mutate('run')} disabled={legacyReadOnly || runMutation.isPending}>
            <Play size={14} /> 正式运行
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={legacyReadOnly || saveMutation.isPending}>
            <FloppyDisk size={14} /> {saveMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 节点库 */}
        <aside className="w-48 shrink-0 overflow-auto border-r border-border p-2">
          <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">节点库（后端 metadata）</div>
          {(supportedMetadata.length
            ? supportedMetadata.map((item) => ({ type: item.type, label: item.title }))
            : NODE_PALETTE.map((type) => ({ type, label: type }))
          ).map((item) => (
            <button
              key={item.type}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => addNode(item.type)}
            >
              {item.label}
            </button>
          ))}
          <p className="mt-2 px-1 text-[10px] text-muted-foreground">知识库节点不提供；含旧知识库节点的流程仅可查看。</p>
        </aside>

        {/* 画布 */}
        <div className="min-w-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodesDraggable={!legacyReadOnly}
            nodesConnectable={!legacyReadOnly}
            edgesReconnectable={!legacyReadOnly}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable />
          </ReactFlow>
        </div>

        {/* 选中节点配置 */}
        <aside className="w-80 shrink-0 overflow-auto border-l border-border p-3">
          {selectedNode ? (
            <>
              <div className="mb-2 flex items-center justify-between">
                <Label>节点配置 · {String(selectedNode.data.type)}</Label>
                {configDirty ? <Badge variant="outline">未应用</Badge> : null}
              </div>
              <Input
                disabled={legacyReadOnly}
                className="mb-2"
                value={String(selectedNode.data.name ?? '')}
                placeholder="节点名称"
                onChange={(event) => {
                  const name = event.target.value
                  setNodes((existing) => existing.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, name } } : node)))
                }}
              />
              <Textarea disabled={legacyReadOnly} className="min-h-64 font-mono text-xs" value={configText} onChange={(event) => { setConfigText(event.target.value); setConfigDirty(true) }} />
              <Button className="mt-2 w-full" size="sm" onClick={applyConfig} disabled={legacyReadOnly || !configDirty}>
                应用配置
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">点击画布中的节点编辑配置；从节点库添加新节点。</p>
          )}
        </aside>
      </div>

      <Sheet open={versionsOpen} onOpenChange={setVersionsOpen}>
        <SheetContent side="right" className="overflow-auto">
          <SheetHeader>
            <SheetTitle>版本列表</SheetTitle>
            <SheetDescription>已发布版本可查看与删除。</SheetDescription>
          </SheetHeader>
          <VersionList workflowId={String(id)} />
        </SheetContent>
      </Sheet>

      {runResult ? (
        <Sheet open onOpenChange={() => setRunResult(null)}>
          <SheetContent side="bottom" className="h-[60dvh] overflow-auto">
            <SheetHeader>
              <SheetTitle>运行结果</SheetTitle>
              <SheetDescription>包含节点执行日志与最终输出。</SheetDescription>
            </SheetHeader>
            <pre className="max-h-[40dvh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(runResult, null, 2)}</pre>
          </SheetContent>
        </Sheet>
      ) : null}
    </div>
  )
}

function VersionList({ workflowId }: { workflowId: string }) {
  const versionsQuery = useQuery({
    queryKey: ['list', 'workflow-versions', workflowId],
    queryFn: async () => (await workflowApi.listVersions(workflowId)).data.data,
  })
  const versions: WorkflowVersion[] = versionsQuery.data ?? []
  if (versionsQuery.isLoading) return <PageLoading />
  if (versions.length === 0) return <p className="px-4 text-sm text-muted-foreground">暂无已发布版本。</p>
  return (
    <div className="space-y-2 p-3">
      {versions.map((version) => (
        <div key={version.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <span className="font-mono text-xs">{version.version}</span>
          <span className="text-xs text-muted-foreground">{version.createdAt ?? ''}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-destructive"
            onClick={async () => {
              try {
                await workflowApi.removeVersion(workflowId, version.version)
                toast.success('版本已删除')
                void versionsQuery.refetch()
              } catch (cause) {
                toast.error(readableError(cause, '删除版本失败'))
              }
            }}
          >
            删除
          </Button>
        </div>
      ))}
    </div>
  )
}
