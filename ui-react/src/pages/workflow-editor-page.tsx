import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeMouseHandler,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Bug, ClockCounterClockwise, FloppyDisk, Play, Plus, ShieldCheck, Trash } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/sonner'
import { ErrorState, PageLoading } from '@/components/states'
import { readableError } from '@/lib/utils'
import * as workflowApi from '@/api/workflows'
import { nodeMetadata } from '@/api/workflows'
import { pageWorkflowResources } from '@/api/workflowResources'
import { mcpServers, modelConfigs, skills, tools } from '@/api/resources'
import type { McpServerVO, McpToolVO, ModelConfigVO, NodeMetadata, SkillPackageVO, ToolVO, VariableType, WorkflowInputConfig, WorkflowManagedResource, WorkflowNodeExecution, WorkflowNodeRunResult, WorkflowRun, WorkflowRunResult, WorkflowVariable, WorkflowVersion, WorkflowValidationResult } from '@/types'
import { fromBackendDefinition, toBackendDefinition, toBackendNode } from '@/features/workflow/protocol'
import { cloneWorkflowNodeDefaults, workflowNodeSchemaMap, workflowNodeSchemas } from '@/features/workflow/node-schemas'
import { MultiSelectField, type SelectOption } from '@/features/agents/multi-select-field'
import { mcpInputConfigs, toolInputConfigs } from '@/features/workflow/resource-bindings'
import { validateWorkflowConnection } from '@/features/workflow/edge-rules'
import { layoutWorkflowNodes } from '@/features/workflow/layout'
import { buildWorkflowRunRequest, defaultRunValue, initialRunParamValues, initialRunVariables, parseWorkflowRunRequest, type WorkflowStartParam } from '@/features/workflow/run-inputs'
import { sessionStorageAdapter } from '@/lib/storage'

// 知识库节点不在节点库中（明确排除）；旧含 KNOWLEDGE 节点的流程加载后只读提示。

function WorkflowCanvasNode({ data, selected }: { data: Record<string, unknown>; selected?: boolean }) {
  const type = String(data.type ?? '')
  return (
    <div className={`w-44 rounded-lg border bg-card px-3 py-2 shadow-card ${selected ? 'border-primary ring-2 ring-ring' : 'border-border'}`}>
      {type !== 'START' ? <Handle id="input" type="target" position={Position.Left} className="!size-2.5 !border-background !bg-primary" /> : null}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{String(data.name ?? '节点')}</span>
        <Badge variant="outline" className="shrink-0 text-[10px]">{String(data.type ?? '')}</Badge>
      </div>
      {type !== 'END' ? <Handle id="output" type="source" position={Position.Right} className="!size-2.5 !border-background !bg-primary" /> : null}
    </div>
  )
}

const nodeTypes = { workflow: WorkflowCanvasNode }

type FlowSnapshot = { nodes: Node[]; edges: Edge[]; variables: WorkflowVariable[] }

function cloneSnapshot(nodes: Node[], edges: Edge[], variables: WorkflowVariable[]): FlowSnapshot {
  return structuredClone({ nodes, edges, variables })
}

const systemWorkflowVariables: WorkflowVariable[] = [
  { id: 'sys_1', name: 'tenantId', type: 'Long', source: 'system', description: '当前租户 ID' },
  { id: 'sys_2', name: 'tenantCode', type: 'String', source: 'system', description: '当前租户编号' },
  { id: 'sys_3', name: 'userId', type: 'Long', source: 'system', description: '当前用户 ID' },
  { id: 'sys_4', name: 'userName', type: 'String', source: 'system', description: '当前用户名称' },
]

const workflowVariableTypes: VariableType[] = ['String', 'Long', 'Integer', 'Float', 'Double', 'Boolean', 'Array', 'Object']

function validationItem(item: WorkflowValidationResult['errors'][number]) {
  return typeof item === 'string' ? { message: item } : item
}

export function WorkflowEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [configText, setConfigText] = useState('{}')
  const [configDirty, setConfigDirty] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [runsOpen, setRunsOpen] = useState(false)
  const [runResult, setRunResult] = useState<WorkflowRunResult | null>(null)
  const [runInputs, setRunInputs] = useState('{}')
  const [runInputSource, setRunInputSource] = useState<'structured' | 'advanced'>('structured')
  const [runParamValues, setRunParamValues] = useState<Record<string, unknown>>({})
  const [runVariablesText, setRunVariablesText] = useState('{}')
  const [nodeRunInputs, setNodeRunInputs] = useState('{}')
  const [nodeRunResult, setNodeRunResult] = useState<WorkflowNodeRunResult | null>(null)
  const [runDialogMode, setRunDialogMode] = useState<'debug' | 'run' | null>(null)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishRemark, setPublishRemark] = useState('')
  const [dirty, setDirty] = useState(false)
  const [validationResult, setValidationResult] = useState<WorkflowValidationResult | null>(null)
  const [validationOpen, setValidationOpen] = useState(false)
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [workflowVariables, setWorkflowVariables] = useState<WorkflowVariable[]>([])
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null)
  const [, setHistoryRevision] = useState(0)
  const [subWorkflowStack, setSubWorkflowStack] = useState<Array<{ loopNodeId: string; parentNodes: Node[]; parentEdges: Edge[] }>>([])
  const [lockState, setLockState] = useState<'checking' | 'owned' | 'readonly'>('checking')
  const lockOwnedRef = useRef(false)
  const lockWorkflowIdRef = useRef('')
  const flowRef = useRef<ReactFlowInstance<Node, Edge> | null>(null)
  const undoStackRef = useRef<FlowSnapshot[]>([])
  const redoStackRef = useRef<FlowSnapshot[]>([])
  const historyGroupRef = useRef<{ key: string; at: number } | null>(null)
  const dragHistoryCapturedRef = useRef(false)

  const detailQuery = useQuery({
    queryKey: ['detail', 'workflow', String(id)],
    queryFn: async () => (await workflowApi.getWorkflow(String(id))).data.data,
    enabled: Boolean(id),
  })
  const metadataQuery = useQuery({ queryKey: ['list', 'workflow-node-metadata'], queryFn: async () => (await nodeMetadata()).data.data })
  const metadata: NodeMetadata[] = metadataQuery.data ?? []
  const metadataByType = useMemo(() => Object.fromEntries(metadata.map((item) => [item.type, item])), [metadata])
  const resourceQueries = {
    datasource: useQuery({ queryKey: ['list', 'workflow-resource-options', 'datasource'], queryFn: async () => (await pageWorkflowResources('datasource', { page: 1, size: 100, enabled: true })).data.data.records }),
    cache: useQuery({ queryKey: ['list', 'workflow-resource-options', 'cache'], queryFn: async () => (await pageWorkflowResources('cache', { page: 1, size: 100, enabled: true })).data.data.records }),
    mq: useQuery({ queryKey: ['list', 'workflow-resource-options', 'mq'], queryFn: async () => (await pageWorkflowResources('mq', { page: 1, size: 100, enabled: true })).data.data.records }),
    channel: useQuery({ queryKey: ['list', 'workflow-resource-options', 'channel'], queryFn: async () => (await pageWorkflowResources('channel', { page: 1, size: 100, enabled: true })).data.data.records }),
    model: useQuery({ queryKey: ['list', 'workflow-resource-options', 'model'], queryFn: async () => (await modelConfigs.page({ page: 1, size: 1000, enabled: true })).data.data.records }),
    tool: useQuery({ queryKey: ['list', 'workflow-resource-options', 'tool'], queryFn: async () => (await tools.page({ page: 1, size: 1000, enabled: true })).data.data.records }),
    skill: useQuery({ queryKey: ['list', 'workflow-resource-options', 'skill'], queryFn: async () => (await skills.page({ page: 1, size: 1000, enabled: true })).data.data.records }),
    mcp: useQuery({ queryKey: ['list', 'workflow-resource-options', 'mcp'], queryFn: async () => (await mcpServers.page({ page: 1, size: 1000, enabled: true })).data.data.records }),
  }

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
    setWorkflowVariables(detail.workflow.config.variables ?? [])
    undoStackRef.current = []
    redoStackRef.current = []
    setHistoryRevision((value) => value + 1)
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailQuery.data])

  useEffect(() => {
    const workflowId = String(id ?? '')
    if (!workflowId || !detailQuery.data) return
    if (lockWorkflowIdRef.current && lockWorkflowIdRef.current !== workflowId && lockOwnedRef.current) {
      void workflowApi.setWorkflowLock(lockWorkflowIdRef.current, 0).catch(() => undefined)
      lockOwnedRef.current = false
    }
    lockWorkflowIdRef.current = workflowId
    let disposed = false
    setLockState('checking')
    workflowApi.setWorkflowLock(workflowId, 1).then((response) => {
      const owned = Boolean(response.data.data)
      if (lockWorkflowIdRef.current !== workflowId) return
      lockOwnedRef.current = owned
      if (disposed) return
      setLockState(owned ? 'owned' : 'readonly')
      if (!owned) toast.warning('该工作流正由其他账号编辑，当前以只读模式打开。')
    }).catch((cause) => {
      if (!disposed) {
        setLockState('readonly')
        toast.error(readableError(cause, '无法取得工作流编辑锁，已进入只读模式'))
      }
    })
    return () => { disposed = true }
  }, [Boolean(detailQuery.data), id])

  useEffect(() => {
    const release = () => {
      const workflowId = lockWorkflowIdRef.current
      if (!workflowId || !lockOwnedRef.current) return
      lockOwnedRef.current = false
      const token = sessionStorageAdapter.getAccessToken()
      void fetch(`/api/workflow/${encodeURIComponent(workflowId)}/lock/0`, {
        method: 'PUT',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        keepalive: true,
      }).catch(() => undefined)
    }
    window.addEventListener('pagehide', release)
    return () => {
      window.removeEventListener('pagehide', release)
      release()
    }
  }, [])

  const selectedNode = useMemo(() => nodes.find((node) => node.id === selectedId) ?? null, [nodes, selectedId])
  const legacyKnowledgeReadOnly = useMemo(
    () => nodes.some((node) => String(node.data.type ?? '').toUpperCase().includes('KNOWLEDGE')),
    [nodes],
  )
  const readOnly = legacyKnowledgeReadOnly || lockState !== 'owned'
  const navigationBlocker = useBlocker(dirty && !readOnly)

  const recordHistory = useCallback((group = 'change') => {
    const now = Date.now()
    const previousGroup = historyGroupRef.current
    if (previousGroup?.key === group && now - previousGroup.at < 600) {
      historyGroupRef.current = { key: group, at: now }
      return
    }
    undoStackRef.current = [...undoStackRef.current.slice(-49), cloneSnapshot(nodes, edges, workflowVariables)]
    redoStackRef.current = []
    historyGroupRef.current = { key: group, at: now }
    setHistoryRevision((value) => value + 1)
  }, [edges, nodes, workflowVariables])

  const restoreSnapshot = useCallback((snapshot: FlowSnapshot) => {
    setNodes(snapshot.nodes)
    setEdges(snapshot.edges)
    setWorkflowVariables(snapshot.variables)
    setSelectedId(null)
    setConfigText('{}')
    setConfigDirty(false)
    setContextMenu(null)
    setDirty(true)
  }, [setEdges, setNodes])

  function undo() {
    const snapshot = undoStackRef.current.pop()
    if (!snapshot) return
    redoStackRef.current.push(cloneSnapshot(nodes, edges, workflowVariables))
    historyGroupRef.current = null
    restoreSnapshot(snapshot)
    setHistoryRevision((value) => value + 1)
  }

  function redo() {
    const snapshot = redoStackRef.current.pop()
    if (!snapshot) return
    undoStackRef.current.push(cloneSnapshot(nodes, edges, workflowVariables))
    historyGroupRef.current = null
    restoreSnapshot(snapshot)
    setHistoryRevision((value) => value + 1)
  }

  const startParams = useMemo<WorkflowStartParam[]>(() => {
    const start = nodes.find((node) => String(node.data.type) === 'START')
    const params = (start?.data.config as Record<string, unknown> | undefined)?.params
    return Array.isArray(params) ? params as WorkflowStartParam[] : []
  }, [nodes])

  function openRunDialog(mode: 'debug' | 'run') {
    const values = initialRunParamValues(startParams)
    const variables = initialRunVariables(workflowVariables)
    setRunParamValues(values)
    setRunVariablesText(JSON.stringify(variables, null, 2))
    setRunInputs(JSON.stringify(buildWorkflowRunRequest(startParams, values, JSON.stringify(variables)), null, 2))
    setRunInputSource('structured')
    setRunDialogMode(mode)
  }

  function updateRunParam(name: string, value: unknown) {
    const next = { ...runParamValues, [name]: value }
    setRunParamValues(next)
    try {
      setRunInputs(JSON.stringify(buildWorkflowRunRequest(startParams, next, runVariablesText), null, 2))
    } catch {
      // 输入尚未完成时保留编辑值，提交时给出精确字段错误。
    }
    setRunInputSource('structured')
  }

  function updateRunVariables(value: string) {
    setRunVariablesText(value)
    try { setRunInputs(JSON.stringify(buildWorkflowRunRequest(startParams, runParamValues, value), null, 2)) } catch { /* 提交时校验 */ }
    setRunInputSource('structured')
  }

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty || readOnly) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, readOnly])

  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    const structural = changes.some((change) => ['add', 'remove', 'replace'].includes(change.type))
    const dragging = changes.some((change) => change.type === 'position' && change.dragging)
    if (structural) recordHistory('canvas-structure')
    if (dragging && !dragHistoryCapturedRef.current) {
      recordHistory('node-drag')
      dragHistoryCapturedRef.current = true
    }
    if (!dragging && changes.some((change) => change.type === 'position')) dragHistoryCapturedRef.current = false
    if (structural || changes.some((change) => change.type === 'position')) setDirty(true)
    onNodesChange(changes)
  }, [onNodesChange, recordHistory])

  const handleEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    if (changes.some((change) => ['add', 'remove', 'replace'].includes(change.type))) {
      recordHistory('edge-change')
      setDirty(true)
    }
    onEdgesChange(changes)
  }, [onEdgesChange, recordHistory])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly) return
      const result = validateWorkflowConnection(connection, nodes, edges)
      if (!result.ok) {
        toast.warning(result.reason)
        return
      }
      recordHistory('edge-connect')
      setDirty(true)
      setEdges((existing) => addEdge({ ...connection, id: `e_${connection.source}_${connection.target}_${Date.now()}` }, existing))
    },
    [edges, nodes, readOnly, recordHistory, setEdges],
  )

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedId(node.id)
    setConfigText(JSON.stringify((node.data.config as Record<string, unknown>) ?? {}, null, 2))
    setConfigDirty(false)
  }, [])

  function applyConfig() {
    if (!selectedNode || readOnly) return
    try {
      const parsed = JSON.parse(configText) as Record<string, unknown>
      recordHistory('advanced-config')
      setNodes((existing) => existing.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, config: parsed } } : node)))
      setConfigDirty(false)
      setDirty(true)
      toast.success('节点配置已应用到画布（尚未保存到服务端）')
    } catch {
      toast.error('配置不是合法 JSON')
    }
  }

  function updateConfigField(key: string, value: unknown) {
    updateConfigPatch({ [key]: value })
  }

  function updateConfigPatch(patch: Record<string, unknown>) {
    if (!selectedNode || readOnly) return
    recordHistory(`config-${selectedNode.id}`)
    const nodeId = selectedNode.id
    let nextConfig: Record<string, unknown> = {}
    setNodes((existing) => existing.map((node) => {
      if (node.id !== nodeId) return node
      nextConfig = { ...((node.data.config as Record<string, unknown>) ?? {}), ...patch }
      return { ...node, data: { ...node.data, config: nextConfig } }
    }))
    setConfigText(JSON.stringify({ ...((selectedNode.data.config as Record<string, unknown>) ?? {}), ...patch }, null, 2))
    setConfigDirty(false)
    setDirty(true)
  }

  function updateNodeData(key: string, value: unknown) {
    if (!selectedNode || readOnly) return
    recordHistory(`node-data-${selectedNode.id}`)
    setNodes((existing) => existing.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, [key]: value } } : node)))
    setDirty(true)
  }

  function removeNode(nodeId: string) {
    if (readOnly) return
    recordHistory('remove-node')
    setNodes((existing) => existing.filter((node) => node.id !== nodeId))
    setEdges((existing) => existing.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedId(null)
    setConfigText('{}')
    setDirty(true)
  }

  function removeSelectedNode() {
    if (!selectedNode) return
    removeNode(selectedNode.id)
  }

  function addNode(type: string) {
    if (readOnly || type.toUpperCase().includes('KNOWLEDGE')) return
    const schema = workflowNodeSchemaMap[type]
    const meta = metadataByType[type]
    const nodeId = `node_${type.toLowerCase()}_${Date.now()}`
    const defaults = cloneWorkflowNodeDefaults(type, nodeId)
    const newNode: Node = {
      id: nodeId,
      type: 'workflow',
      position: { x: 120 + Math.random() * 300, y: 120 + Math.random() * 200 },
      data: { type, name: schema?.title ?? meta?.title ?? type, ...defaults },
    }
    recordHistory('add-node')
    setNodes((existing) => [...existing, newNode])
    setSelectedId(newNode.id)
    setConfigText(JSON.stringify(defaults.config, null, 2))
    setDirty(true)
  }

  function enterSubWorkflow() {
    if (!selectedNode || String(selectedNode.data.type) !== 'LOOP' || readOnly) return
    const config = (selectedNode.data.config as Record<string, unknown>) ?? {}
    const definition = {
      nodes: Array.isArray(config.subNodes) ? config.subNodes : [],
      edges: Array.isArray(config.subEdges) ? config.subEdges : [],
    }
    const child = fromBackendDefinition(definition as never)
    setSubWorkflowStack((stack) => [...stack, { loopNodeId: selectedNode.id, parentNodes: nodes, parentEdges: edges }])
    setNodes(child.nodes)
    setEdges(child.edges)
    setSelectedId(null)
    setConfigText('{}')
    undoStackRef.current = []
    redoStackRef.current = []
    setHistoryRevision((value) => value + 1)
  }

  function exitSubWorkflow() {
    const subWorkflowContext = subWorkflowStack.at(-1)
    if (!subWorkflowContext) return
    const child = toBackendDefinition(nodes, edges)
    const restored = subWorkflowContext.parentNodes.map((node) => {
      if (node.id !== subWorkflowContext.loopNodeId) return node
      return { ...node, data: { ...node.data, config: { ...((node.data.config as Record<string, unknown>) ?? {}), subNodes: child.nodes, subEdges: child.edges } } }
    })
    const loopNode = restored.find((node) => node.id === subWorkflowContext.loopNodeId) ?? null
    setNodes(restored)
    setEdges(subWorkflowContext.parentEdges)
    setSelectedId(loopNode?.id ?? null)
    setConfigText(JSON.stringify((loopNode?.data.config as Record<string, unknown>) ?? {}, null, 2))
    setSubWorkflowStack((stack) => stack.slice(0, -1))
    undoStackRef.current = []
    redoStackRef.current = []
    setHistoryRevision((value) => value + 1)
    setDirty(true)
  }

  function autoLayout() {
    if (readOnly || !nodes.length) return
    recordHistory('layout')
    setNodes(layoutWorkflowNodes(nodes, edges))
    setDirty(true)
    window.setTimeout(() => void flowRef.current?.fitView({ padding: 0.2, duration: 250 }), 0)
  }

  function clearCanvas() {
    if (readOnly || !nodes.length || !window.confirm('确认清空画布中的全部节点和连线？可使用“撤销”恢复。')) return
    recordHistory('clear-canvas')
    setNodes([])
    setEdges([])
    setSelectedId(null)
    setDirty(true)
  }

  function focusNode(nodeId: string) {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) return
    setSelectedId(node.id)
    setConfigText(JSON.stringify((node.data.config as Record<string, unknown>) ?? {}, null, 2))
    setConfigDirty(false)
    setValidationOpen(false)
    window.setTimeout(() => void flowRef.current?.fitView({ nodes: [{ id: node.id }], padding: 1.6, duration: 250 }), 0)
  }

  function duplicateNode(nodeId: string) {
    if (readOnly) return
    const source = nodes.find((node) => node.id === nodeId)
    if (!source) return
    recordHistory('duplicate-node')
    const copy = structuredClone(source)
    copy.id = `${source.id}_copy_${Date.now()}`
    copy.position = { x: source.position.x + 36, y: source.position.y + 36 }
    copy.selected = false
    copy.data = { ...copy.data, name: `${String(copy.data.name ?? '节点')} 副本` }
    setNodes((existing) => [...existing, copy])
    setContextMenu(null)
    setSelectedId(copy.id)
    setConfigText(JSON.stringify((copy.data.config as Record<string, unknown>) ?? {}, null, 2))
    setDirty(true)
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      let nodesToSave = nodes
      if (configDirty && selectedNode) {
        let parsed: unknown
        try { parsed = JSON.parse(configText) } catch { throw new Error('高级 JSON 配置格式不正确，请修正后再保存') }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('高级 JSON 配置必须是对象')
        nodesToSave = nodes.map((node) => node.id === selectedNode.id ? { ...node, data: { ...node.data, config: parsed as Record<string, unknown> } } : node)
      }
      const definition = toBackendDefinition(nodesToSave, edges, workflowVariables, detailQuery.data?.workflow.config?.viewport)
      return workflowApi.updateWorkflow({ id, name: detailQuery.data?.workflow.name, config: definition })
    },
    onSuccess: () => {
      toast.success('已保存')
      setDirty(false)
      setConfigDirty(false)
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
      setValidationResult(result)
      setValidationOpen(true)
      const valid = (result as { valid?: boolean }).valid
      const errors = (result as { errors?: Array<{ message?: string }> }).errors
      if (valid) toast.success('校验通过')
      else toast.error('校验未通过', { description: (errors ?? []).map((error) => error.message).join('；').slice(0, 200) })
    },
    onError: (cause) => toast.error(readableError(cause, '校验失败')),
  })

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync()
      return (await workflowApi.publishWorkflow(String(id), publishRemark.trim())).data.data
    },
    onSuccess: () => { toast.success('已发布新版本'); setPublishOpen(false); setPublishRemark('') },
    onError: (cause) => toast.error(readableError(cause, '发布失败')),
  })

  const runMutation = useMutation({
    mutationFn: async (mode: 'debug' | 'run') => {
      const request = runInputSource === 'advanced' ? parseWorkflowRunRequest(runInputs) : buildWorkflowRunRequest(startParams, runParamValues, runVariablesText)
      return mode === 'debug' ? (await workflowApi.debugRun(String(id), request)).data.data : (await workflowApi.formalRun(String(id), request)).data.data
    },
    onSuccess: (result: WorkflowRunResult) => {
      setRunResult(result)
      setRunDialogMode(null)
      toast.success('执行完成')
    },
    onError: (cause) => {
      toast.error('执行失败（原始错误见结果）', { description: readableError(cause, '') })
      setRunResult(null)
    },
  })

  const nodeRunMutation = useMutation({
    mutationFn: async (nodeId?: string) => {
      const node = nodes.find((item) => item.id === nodeId) ?? selectedNode
      if (!node) throw new Error('请先选择节点')
      const inputs = parseInputObject(nodeRunInputs)
      return (await workflowApi.debugNode({
        node: toBackendNode(node) as unknown as Record<string, unknown>,
        inputs,
      })).data.data
    },
    onSuccess: (result) => {
      setNodeRunResult(result)
      toast.success(result.status === 'SUCCESS' ? '节点调试成功' : '节点调试已返回')
    },
    onError: (cause) => toast.error(readableError(cause, '节点调试失败')),
  })

  if (detailQuery.isLoading) return <PageLoading label="工作流加载中…" />
  if (detailQuery.error) return <ErrorState error={detailQuery.error} onRetry={() => void detailQuery.refetch()} />

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => subWorkflowStack.length ? exitSubWorkflow() : navigate('/workflow')}>
          <ArrowLeft size={14} /> {subWorkflowStack.length ? '返回上级流程' : '返回'}
        </Button>
        <span className="font-semibold">{detailQuery.data?.workflow.name}</span>
        {subWorkflowStack.length ? <Badge variant="outline">循环子流程 · 第 {subWorkflowStack.length} 层</Badge> : null}
        <Badge variant="secondary" className="ml-1">{detailQuery.data?.workflow.version ?? '草稿'}</Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={readOnly || !undoStackRef.current.length || Boolean(subWorkflowStack.length)}>撤销</Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={readOnly || !redoStackRef.current.length || Boolean(subWorkflowStack.length)}>重做</Button>
          <Button variant="ghost" size="sm" onClick={autoLayout} disabled={readOnly || !nodes.length}>整理布局</Button>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearCanvas} disabled={readOnly || !nodes.length}>清空</Button>
          <Button variant="outline" size="sm" onClick={() => setVariablesOpen(true)} disabled={Boolean(subWorkflowStack.length)}>变量</Button>
          <Button variant="outline" size="sm" onClick={() => setVersionsOpen(true)}>版本</Button>
          <Button variant="outline" size="sm" onClick={() => setRunsOpen(true)}><ClockCounterClockwise size={14} /> 运行记录</Button>
          {lockState === 'checking' ? <Badge variant="outline">正在取得编辑锁…</Badge> : lockState === 'readonly' ? <Badge variant="outline">只读</Badge> : null}
          <Button variant="outline" size="sm" onClick={() => validateMutation.mutate()} disabled={readOnly || Boolean(subWorkflowStack.length) || validateMutation.isPending}>
            <ShieldCheck size={14} /> 校验
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)} disabled={readOnly || Boolean(subWorkflowStack.length) || publishMutation.isPending}>
            发布
          </Button>
          <Button variant="outline" size="sm" onClick={() => openRunDialog('debug')} disabled={readOnly || Boolean(subWorkflowStack.length) || runMutation.isPending}>
            <Bug size={14} /> 调试运行
          </Button>
          <Button variant="outline" size="sm" onClick={() => openRunDialog('run')} disabled={readOnly || Boolean(subWorkflowStack.length) || runMutation.isPending}>
            <Play size={14} /> 正式运行
          </Button>
          <Button size="sm" onClick={() => saveMutation.mutate()} disabled={readOnly || Boolean(subWorkflowStack.length) || saveMutation.isPending}>
            <FloppyDisk size={14} /> {saveMutation.isPending ? '保存中…' : '保存'}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 节点库 */}
        <aside className="w-48 shrink-0 overflow-auto border-r border-border p-2">
          <div className="mb-1 px-1 text-[11px] font-medium text-muted-foreground">完整节点库</div>
          {workflowNodeSchemas.map((item) => (
            <button
              key={item.type}
              className="w-full rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => addNode(item.type)}
            >
              {item.title}
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
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={(event, node) => {
              event.preventDefault()
              setSelectedId(node.id)
              setConfigText(JSON.stringify((node.data.config as Record<string, unknown>) ?? {}, null, 2))
              setConfigDirty(false)
              setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
            }}
            onPaneClick={() => { setSelectedId(null); setContextMenu(null) }}
            onInit={(instance) => { flowRef.current = instance }}
            nodesDraggable={!readOnly}
            nodesConnectable={!readOnly}
            edgesReconnectable={!readOnly}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable />
          </ReactFlow>
          {contextMenu ? <div className="fixed z-50 w-44 rounded-lg border border-border bg-popover p-1 text-sm shadow-dialog" style={{ left: contextMenu.x, top: contextMenu.y }}>
            <button className="w-full rounded px-3 py-2 text-left hover:bg-muted" onClick={() => { focusNode(contextMenu.nodeId); setContextMenu(null) }}>编辑配置</button>
            <button className="w-full rounded px-3 py-2 text-left hover:bg-muted" onClick={() => duplicateNode(contextMenu.nodeId)}>复制节点</button>
            <button className="w-full rounded px-3 py-2 text-left hover:bg-muted" onClick={() => { void flowRef.current?.fitView({ nodes: [{ id: contextMenu.nodeId }], padding: 1.6, duration: 250 }); setContextMenu(null) }}>适配到节点</button>
            <button className="w-full rounded px-3 py-2 text-left hover:bg-muted" onClick={() => { nodeRunMutation.mutate(contextMenu.nodeId); setContextMenu(null) }}>运行此节点</button>
            <button className="w-full rounded px-3 py-2 text-left text-destructive hover:bg-muted" onClick={() => { removeNode(contextMenu.nodeId); setContextMenu(null) }}>删除节点</button>
          </div> : null}
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
                disabled={readOnly}
                className="mb-2"
                value={String(selectedNode.data.name ?? '')}
                placeholder="节点名称"
                onChange={(event) => {
                  const name = event.target.value
                  setNodes((existing) => existing.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, name } } : node)))
                  recordHistory(`node-name-${selectedNode.id}`)
                  setDirty(true)
                }}
              />
              {String(selectedNode.data.type) === 'LOOP' ? <div className="mb-3 rounded-lg border border-border p-2"><p className="mb-2 text-xs text-muted-foreground">循环体使用与主流程相同的节点和连线协议，返回主流程时写回 subNodes / subEdges。</p><Button type="button" className="w-full" variant="outline" size="sm" disabled={readOnly} onClick={enterSubWorkflow}>编辑循环子流程</Button></div> : null}
              <StructuredConfigEditor
                nodeType={String(selectedNode.data.type)}
                nodeId={selectedNode.id}
                nodes={nodes}
                edges={edges}
                config={(selectedNode.data.config as Record<string, unknown>) ?? {}}
                defaults={workflowNodeSchemaMap[String(selectedNode.data.type)]?.defaultConfig ?? metadataByType[String(selectedNode.data.type)]?.defaultConfig ?? {}}
                disabled={readOnly}
                resources={{
                  datasource: resourceQueries.datasource.data ?? [],
                  cache: resourceQueries.cache.data ?? [],
                  mq: resourceQueries.mq.data ?? [],
                  channel: resourceQueries.channel.data ?? [],
                  model: resourceQueries.model.data ?? [],
                  tool: resourceQueries.tool.data ?? [],
                  skill: resourceQueries.skill.data ?? [],
                  mcp: resourceQueries.mcp.data ?? [],
                }}
                onChange={updateConfigField}
                onPatch={updateConfigPatch}
                onInputConfigsChange={(value) => updateNodeData('inputConfigs', value)}
                onOutputConfigsChange={(value) => updateNodeData('outputConfigs', value)}
              />
              <InputConfigEditor
                value={(selectedNode.data.inputConfigs as WorkflowInputConfig[] | undefined) ?? []}
                nodes={nodes}
                selectedNodeId={selectedNode.id}
                disabled={readOnly}
                onChange={(value) => updateNodeData('inputConfigs', value)}
              />
              <OutputConfigDisplay value={(selectedNode.data.outputConfigs as Array<{ name: string; type?: string; description?: string }> | undefined) ?? []} />
              <details className="mt-3 rounded-lg border border-border p-2">
                <summary className="cursor-pointer text-xs font-medium text-muted-foreground">高级 JSON 配置</summary>
                <Textarea disabled={readOnly} className="mt-2 min-h-48 font-mono text-xs" value={configText} onChange={(event) => { setConfigText(event.target.value); setConfigDirty(true); setDirty(true) }} />
                <Button className="mt-2 w-full" size="sm" onClick={applyConfig} disabled={readOnly || !configDirty}>应用 JSON</Button>
              </details>
              <div className="mt-4 rounded-lg border border-border p-3">
                <Label className="text-xs">单节点调试输入（JSON）</Label>
                <Textarea className="mt-2 min-h-24 font-mono text-xs" value={nodeRunInputs} onChange={(event) => setNodeRunInputs(event.target.value)} />
                <Button className="mt-2 w-full" variant="outline" size="sm" onClick={() => nodeRunMutation.mutate()} disabled={readOnly || nodeRunMutation.isPending}><Bug size={14} /> {nodeRunMutation.isPending ? '调试中…' : '调试当前节点'}</Button>
              </div>
              <Button className="mt-3 w-full text-destructive" variant="ghost" size="sm" onClick={removeSelectedNode} disabled={readOnly}><Trash size={14} /> 删除节点</Button>
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

      <Sheet open={validationOpen} onOpenChange={setValidationOpen}>
        <SheetContent side="right" className="w-full overflow-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>校验结果</SheetTitle><SheetDescription>{validationResult ? `${validationResult.errors.length} 个错误 · ${validationResult.warnings?.length ?? 0} 个提醒` : '尚未执行校验'}</SheetDescription></SheetHeader>
          {validationResult?.valid && !validationResult.warnings?.length ? <div className="m-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700">校验通过：当前流程结构与配置可用于发布或调试。</div> : null}
          {validationResult ? <div className="space-y-5 p-4">
            {[{ title: '必须修复', items: validationResult.errors, tone: 'text-destructive' }, { title: '建议关注', items: validationResult.warnings ?? [], tone: 'text-amber-600' }].map((section) => section.items.length ? <section key={section.title}><h3 className={`mb-2 text-sm font-semibold ${section.tone}`}>{section.title}</h3><div className="space-y-2">{section.items.map((raw, index) => { const item = validationItem(raw); return <button key={`${section.title}-${index}`} type="button" className="w-full rounded-lg border border-border p-3 text-left hover:bg-muted" onClick={() => item.nodeId && focusNode(item.nodeId)}><div className="text-sm font-medium">{item.nodeId ? String(nodes.find((node) => node.id === item.nodeId)?.data.name ?? item.nodeId) : '工作流'}</div><div className="mt-1 text-xs text-muted-foreground">{item.field ? `${item.field}：` : ''}{item.message || '配置需要检查'}</div></button> })}</div></section> : null)}
          </div> : null}
        </SheetContent>
      </Sheet>

      <Sheet open={runsOpen} onOpenChange={setRunsOpen}>
        <SheetContent side="right" className="w-full overflow-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>运行记录</SheetTitle>
            <SheetDescription>来自后端的真实工作流运行及节点执行日志。</SheetDescription>
          </SheetHeader>
          <RunHistory workflowId={String(id)} />
        </SheetContent>
      </Sheet>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>发布工作流</DialogTitle><DialogDescription>保存当前草稿并生成不可变版本。发布说明会随版本保留。</DialogDescription></DialogHeader>
          <div><Label>发布说明</Label><Textarea className="mt-2" value={publishRemark} placeholder="说明本次节点或配置变化" onChange={(event) => setPublishRemark(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPublishOpen(false)}>取消</Button><Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>{publishMutation.isPending ? '发布中…' : '确认发布'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={variablesOpen} onOpenChange={setVariablesOpen}>
        <DialogContent className="max-h-[85dvh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>工作流变量</DialogTitle><DialogDescription>系统变量只读；自定义变量随工作流定义保存，并可用于节点输入绑定和运行输入。</DialogDescription></DialogHeader>
          <div className="space-y-2">
            {systemWorkflowVariables.map((variable) => <div key={variable.id} className="grid grid-cols-[minmax(0,1fr)_120px] gap-2 rounded-lg bg-muted px-3 py-2 text-sm"><div><div className="font-medium">{variable.name}</div><div className="text-xs text-muted-foreground">{variable.description}</div></div><Badge variant="outline" className="self-center justify-self-end">{variable.type}</Badge></div>)}
            {workflowVariables.length ? <div className="pt-2 text-xs font-medium text-muted-foreground">自定义变量</div> : null}
            {workflowVariables.map((variable, index) => <div key={variable.id} className="grid grid-cols-[minmax(0,1fr)_130px_36px] gap-2"><Input aria-label={`变量 ${index + 1} 名称`} value={variable.name} disabled={readOnly} placeholder="变量名" onChange={(event) => { recordHistory('workflow-variables'); setWorkflowVariables((items) => items.map((item) => item.id === variable.id ? { ...item, name: event.target.value } : item)); setDirty(true) }} /><Select value={variable.type} disabled={readOnly} onValueChange={(type) => { recordHistory('workflow-variables'); setWorkflowVariables((items) => items.map((item) => item.id === variable.id ? { ...item, type: type as VariableType } : item)); setDirty(true) }}><SelectTrigger aria-label={`变量 ${index + 1} 类型`}><SelectValue /></SelectTrigger><SelectContent>{workflowVariableTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={readOnly} aria-label={`删除变量 ${variable.name || index + 1}`} onClick={() => { recordHistory('workflow-variables-delete'); setWorkflowVariables((items) => items.filter((item) => item.id !== variable.id)); setDirty(true) }}><Trash size={13} /></Button></div>)}
            <Button type="button" variant="outline" className="w-full" disabled={readOnly} onClick={() => { recordHistory('workflow-variables-add'); setWorkflowVariables((items) => [...items, { id: `cust_${Date.now()}`, name: '', type: 'String', source: 'custom' }]); setDirty(true) }}><Plus size={14} /> 添加变量</Button>
          </div>
          <DialogFooter><Button onClick={() => { const names = workflowVariables.map((item) => item.name.trim()); if (names.some((name) => !name)) { toast.error('变量名不能为空'); return } if (new Set(names).size !== names.length || names.some((name) => systemWorkflowVariables.some((system) => system.name === name))) { toast.error('变量名不能重复或覆盖系统变量'); return } setVariablesOpen(false) }}>完成</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(runDialogMode)} onOpenChange={(open) => !open && setRunDialogMode(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{runDialogMode === 'debug' ? '调试运行' : '正式运行'}</DialogTitle><DialogDescription>按 Java DTO 提交 params 与 variables；不会再发送后端忽略的 inputs 字段。</DialogDescription></DialogHeader>
          {startParams.length ? <div className="space-y-3"><Label>开始节点参数</Label>{startParams.filter((param) => param.name).map((param) => { const name = String(param.name); const type = param.type || 'String'; const value = runParamValues[name] ?? defaultRunValue(type, param.value); return <div key={name}><Label className="text-xs">{name} · {type}{param.required ? ' · 必填' : ''}</Label>{type === 'Boolean' ? <div className="mt-1"><Switch checked={Boolean(value)} onCheckedChange={(checked) => updateRunParam(name, checked)} /></div> : type === 'Array' || type === 'Object' ? <Textarea className="mt-1 min-h-20 font-mono text-xs" value={String(value)} onChange={(event) => updateRunParam(name, event.target.value)} /> : <Input className="mt-1" type={['Integer', 'Float', 'Double'].includes(type) ? 'number' : 'text'} value={String(value)} onChange={(event) => updateRunParam(name, event.target.value)} />}</div> })}</div> : <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">开始节点没有声明参数。</p>}
          {workflowVariables.length ? <div><Label>自定义变量（JSON 对象）</Label><Textarea className="mt-2 min-h-28 font-mono text-xs" value={runVariablesText} onChange={(event) => updateRunVariables(event.target.value)} /></div> : null}
          <details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">高级请求 JSON</summary><Textarea aria-label="运行输入（JSON 对象）" className="mt-2 min-h-44 font-mono text-xs" value={runInputs} onChange={(event) => { setRunInputs(event.target.value); setRunInputSource('advanced') }} /><p className="mt-1 text-xs text-muted-foreground">格式：{'{ "params": [{ "name": "...", "value": ... }], "variables": {} }'}</p></details>
          <DialogFooter><Button variant="outline" onClick={() => setRunDialogMode(null)}>取消</Button><Button onClick={() => runDialogMode && runMutation.mutate(runDialogMode)} disabled={runMutation.isPending}>{runMutation.isPending ? '执行中…' : '开始执行'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={navigationBlocker.state === 'blocked'} onOpenChange={(open) => { if (!open) navigationBlocker.reset?.() }}>
        <DialogContent>
          <DialogHeader><DialogTitle>有未保存的工作流修改</DialogTitle><DialogDescription>离开后，本次节点、连线或配置变更将丢失。</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => navigationBlocker.reset?.()}>继续编辑</Button><Button variant="destructive" onClick={() => navigationBlocker.proceed?.()}>放弃修改并离开</Button></DialogFooter>
        </DialogContent>
      </Dialog>

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
      {nodeRunResult ? (
        <Sheet open onOpenChange={() => setNodeRunResult(null)}>
          <SheetContent side="bottom" className="h-[55dvh] overflow-auto">
            <SheetHeader><SheetTitle>节点调试结果</SheetTitle><SheetDescription>状态：{nodeRunResult.status} · 耗时：{nodeRunResult.duration ?? '-'} ms</SheetDescription></SheetHeader>
            <pre className="max-h-[38dvh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(nodeRunResult, null, 2)}</pre>
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
              if (!window.confirm(`确认删除版本 ${version.version}？该操作不可撤销。`)) return
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

type ResourceOptions = {
  datasource: WorkflowManagedResource[]
  cache: WorkflowManagedResource[]
  mq: WorkflowManagedResource[]
  channel: WorkflowManagedResource[]
  model: ModelConfigVO[]
  tool: ToolVO[]
  skill: SkillPackageVO[]
  mcp: McpServerVO[]
}

type ManagedResourceKind = 'datasource' | 'cache' | 'mq' | 'channel'

const resourceFieldKinds: Record<string, ManagedResourceKind> = {
  datasourceId: 'datasource',
  cacheId: 'cache',
  mqId: 'mq',
  channelId: 'channel',
}

const multilineFieldPattern = /(prompt|template|code|script|sql|expression|body|content|schema|headers|mapping|condition)/i
const stringListFields = new Set(['toRecipients', 'ccRecipients', 'mentionMobiles', 'mentionUsers', 'atMobiles', 'atUserIds', 'retryStatusCodes', 'delimiters'])
const conditionSymbols = ['EQ', 'NE', 'GT', 'LT', 'GE', 'LE', 'CONTAINS', 'NOT_CONTAINS', 'IS_ALL', 'STARTS_WITH', 'ENDS_WITH', 'EQUALS', 'NOT_EQUALS', 'IS_TRUE', 'IS_FALSE', 'EXPRESSION']
const commonEnumOptions: Record<string, string[]> = {
  formatterType: ['STRING', 'JACKSON', 'VELOCITY'],
  templateType: ['STRING', 'VELOCITY'],
  evaluatorType: ['GROOVY'],
  direction: ['ASC', 'DESC'],
}
const nodeEnumOptions: Record<string, Record<string, string[]>> = {
  ITERATE: { language: ['JAVA'] }, CODE: { language: ['JAVA'] },
  NON_EMPTY_SELECT: { strategy: ['FIRST', 'LAST'] },
  MATCH_RESULT: { matchType: ['EQUALS', 'CONTAINS'] },
  STRING_SPLIT: { mode: ['SIMPLE', 'REGEX', 'FIXED_LENGTH', 'LINE_BREAK', 'KEY_VALUE', 'MULTIPLE_DELIMITERS'], keyValueOutputFormat: ['COLON_SEPARATED', 'EQUALS_SEPARATED', 'JSON_OBJECT', 'MAP_ENTRY', 'CUSTOM'] },
  SERIALIZE: { mode: ['COMPACT', 'PRETTY'], format: ['JSON', 'XML', 'YAML', 'BASE64', 'URL_ENCODED'] },
  UNSERIALIZE: { format: ['JSON', 'XML', 'YAML', 'BASE64', 'URL_ENCODED'] },
  VARIABLE_AGG: { strategy: ['ARRAY', 'MAP', 'STRING'] },
  LIST_FILTER: { mode: ['SIMPLE', 'EXPRESSION'], simpleSymbol: conditionSymbols },
}

function StructuredConfigEditor({ nodeType, nodeId, nodes, edges, config, defaults, disabled, resources, onChange, onPatch, onInputConfigsChange, onOutputConfigsChange }: {
  nodeType: string
  nodeId: string
  nodes: Node[]
  edges: Edge[]
  config: Record<string, unknown>
  defaults: Record<string, unknown>
  disabled: boolean
  resources: ResourceOptions
  onChange: (key: string, value: unknown) => void
  onPatch: (patch: Record<string, unknown>) => void
  onInputConfigsChange: (value: WorkflowInputConfig[]) => void
  onOutputConfigsChange: (value: Array<{ name: string; fromNodeId?: string; type?: string; description?: string }>) => void
}) {
  const keys = Array.from(new Set([...Object.keys(defaults), ...Object.keys(config)]))
  if (!keys.length) return <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">此节点没有可配置参数。</p>
  return (
    <div className="space-y-3">
      {keys.map((key) => {
        const value = config[key] ?? defaults[key]
        const resourceKind = resourceFieldKinds[key]
        if (['toolName', 'mcpServerName', 'mcpToolName'].includes(key)) return null
        if (nodeType === 'START' && key === 'params') {
          return <StartParamsField key={key} value={value} disabled={disabled} onChange={(next) => {
            onChange(key, next)
            onOutputConfigsChange(next.filter((item) => item.name.trim()).map((item) => ({ name: item.name.trim(), fromNodeId: nodeId, type: item.type, description: item.description })))
          }} />
        }
        if (nodeType.startsWith('DB_') && key === 'params') {
          return <DbParamsField key={key} value={value} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (stringListFields.has(key)) {
          return <StringListField key={key} label={key} value={value} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        const enumOptions = nodeEnumOptions[nodeType]?.[key] ?? commonEnumOptions[key]
        if (enumOptions) {
          return <SingleOptionSelect key={key} label={key} value={value} disabled={disabled} placeholder={`选择 ${key}`} options={enumOptions.map((item) => ({ label: item, value: item }))} onChange={(next) => onChange(key, next)} />
        }
        if (nodeType === 'IF_ELSE' && key === 'branches') {
          return <ConditionBranchesField key={key} value={value} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (nodeType === 'MATCH_RESULT' && key === 'matches') {
          return <MatchRoutesField key={key} value={value} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (nodeType === 'INTENT_RECOGNITION' && key === 'intents') {
          return <IntentRoutesField key={key} value={value} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (nodeType === 'HTTP_EXTERNAL' && key === 'request') {
          return <HttpRequestField key={key} value={value} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (['defaultNextNodeId', 'elseNextNodeId'].includes(key)) {
          return <DownstreamNodeSelect key={key} label={key === 'elseNextNodeId' ? 'ELSE 路由' : '默认路由'} value={value} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(next) => onChange(key, next)} />
        }
        if (key === 'modelConfigId') {
          return <SingleOptionSelect key={key} label="模型配置" value={value} disabled={disabled} placeholder="选择模型" options={resources.model.map((model) => ({ label: `${model.name} (${model.modelId})`, value: String(model.id) }))} onChange={(next) => onChange(key, next)} />
        }
        if (key === 'toolId') {
          const options = resources.tool.map((tool) => ({ label: tool.name, value: String(tool.id), description: tool.description }))
          return <SingleOptionSelect key={key} label="工具" value={value} disabled={disabled} placeholder="选择工具" options={options} onChange={(next) => {
            const tool = resources.tool.find((item) => String(item.id) === next)
            onPatch({ toolId: next, toolName: tool?.name ?? '' })
            onInputConfigsChange(toolInputConfigs(tool?.inputSchema))
          }} />
        }
        if (key === 'mcpServerId') {
          return <SingleOptionSelect key={key} label="MCP 服务" value={value} disabled={disabled} placeholder="选择 MCP 服务" options={resources.mcp.map((server) => ({ label: server.name, value: String(server.id), description: server.description }))} onChange={(next) => {
            const server = resources.mcp.find((item) => String(item.id) === next)
            onPatch({ mcpServerId: next, mcpServerName: server?.name ?? '', mcpToolId: '', mcpToolName: '' })
            onInputConfigsChange([])
          }} />
        }
        if (key === 'mcpToolId') {
          return <McpToolSelector key={key} serverId={String(config.mcpServerId ?? '')} value={value} disabled={disabled} onChange={(tool) => {
            onPatch({ mcpToolId: tool ? String(tool.id) : '', mcpToolName: tool?.toolName ?? '' })
            onInputConfigsChange(mcpInputConfigs(tool?.inputSchema))
          }} />
        }
        if (key === 'skillPackageIds') {
          return <MultiOptionSelect key={key} label="技能包" value={value} disabled={disabled} options={resources.skill.map((skill) => ({ label: skill.alias || skill.name, value: String(skill.id), description: skill.description }))} onChange={(next) => onChange(key, next)} />
        }
        if (key === 'toolIds') {
          return <MultiOptionSelect key={key} label="工具能力" value={value} disabled={disabled} options={resources.tool.map((tool) => ({ label: tool.name, value: String(tool.id), description: tool.description }))} onChange={(next) => onChange(key, next)} />
        }
        if (key === 'mcps') {
          const selected = Array.isArray(value) ? value.map((item) => String((item as { mcpServerId?: unknown }).mcpServerId ?? '')).filter(Boolean) : []
          return <MultiOptionSelect key={key} label="MCP 能力" value={selected} disabled={disabled} options={resources.mcp.map((server) => ({ label: server.name, value: String(server.id), description: server.description }))} onChange={(next) => onChange(key, next.map((mcpServerId) => ({ mcpServerId, exposureMode: 'ALL_GLOBAL', mcpToolIds: [] })))} />
        }
        return (
          <div key={key}>
            <Label className="mb-1.5 block text-xs">{key}</Label>
            {resourceKind ? (
              <Select value={value === undefined || value === null ? '' : String(value)} onValueChange={(next) => onChange(key, next)} disabled={disabled}>
                <SelectTrigger><SelectValue placeholder={`选择${resourceKind}`} /></SelectTrigger>
                <SelectContent>
                  {resources[resourceKind].map((resource) => resource.id ? <SelectItem key={resource.id} value={String(resource.id)}>{resource.name || resource.id}</SelectItem> : null)}
                </SelectContent>
              </Select>
            ) : typeof value === 'boolean' ? (
              <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"><Switch checked={value} disabled={disabled} onCheckedChange={(next) => onChange(key, next)} /> {value ? '开启' : '关闭'}</label>
            ) : typeof value === 'number' ? (
              <Input type="number" value={value} disabled={disabled} onChange={(event) => onChange(key, Number(event.target.value))} />
            ) : value !== null && typeof value === 'object' ? (
              <JsonValueField value={value} disabled={disabled} onChange={(next) => onChange(key, next)} />
            ) : multilineFieldPattern.test(key) ? (
              <Textarea className="min-h-24 font-mono text-xs" value={value == null ? '' : String(value)} disabled={disabled} onChange={(event) => onChange(key, event.target.value)} />
            ) : (
              <Input value={value == null ? '' : String(value)} disabled={disabled} onChange={(event) => onChange(key, event.target.value)} />
            )}
          </div>
        )
      })}
    </div>
  )
}

type StartParam = { position?: string; name: string; value?: string; type: string; required?: boolean; description?: string }
const workflowValueTypes = ['String', 'Long', 'Integer', 'Float', 'Double', 'Boolean', 'Array', 'Object']

function StartParamsField({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: StartParam[]) => void }) {
  const params = Array.isArray(value) ? value as StartParam[] : []
  const patch = (index: number, next: Partial<StartParam>) => onChange(params.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return <div className="space-y-2"><Label className="text-xs">请求参数</Label>{params.map((item, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-2"><div className="grid grid-cols-[minmax(0,1fr)_110px_28px] gap-2"><Input aria-label={`参数 ${index + 1} 名称`} value={item.name || ''} disabled={disabled} placeholder="参数名" onChange={(event) => patch(index, { name: event.target.value })} /><Select value={item.type || 'String'} disabled={disabled} onValueChange={(type) => patch(index, { type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{workflowValueTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除参数 ${index + 1}`} onClick={() => onChange(params.filter((_, itemIndex) => itemIndex !== index))}><Trash size={13} /></Button></div><div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><Input value={item.value || ''} disabled={disabled} placeholder="默认值" onChange={(event) => patch(index, { value: event.target.value })} /><label className="flex items-center gap-2 rounded-md border px-2 text-xs"><Switch checked={Boolean(item.required)} disabled={disabled} onCheckedChange={(required) => patch(index, { required })} />必填</label></div><Input value={item.description || ''} disabled={disabled} placeholder="参数说明（可选）" onChange={(event) => patch(index, { description: event.target.value })} /></div>)}<Button type="button" className="w-full" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...params, { position: 'QUERY', name: '', value: '', type: 'String', required: false, description: '' }])}><Plus size={13} /> 添加请求参数</Button></div>
}

type DbParam = { value?: string; type?: string }
const dbParamTypes = ['STRING', 'INTEGER', 'INT', 'LONG', 'DOUBLE', 'FLOAT', 'BOOLEAN', 'BOOL']

function DbParamsField({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: DbParam[]) => void }) {
  const params = Array.isArray(value) ? value as DbParam[] : []
  const patch = (index: number, next: Partial<DbParam>) => onChange(params.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return <div className="space-y-2"><Label className="text-xs">SQL 参数绑定</Label>{params.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_110px_28px] gap-2"><Input aria-label={`SQL 参数 ${index + 1}`} value={item.value || ''} disabled={disabled} placeholder="参数值，支持 ${变量}" onChange={(event) => patch(index, { value: event.target.value })} /><Select value={item.type || 'STRING'} disabled={disabled} onValueChange={(type) => patch(index, { type })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{dbParamTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除 SQL 参数 ${index + 1}`} onClick={() => onChange(params.filter((_, itemIndex) => itemIndex !== index))}><Trash size={12} /></Button></div>)}<Button type="button" className="w-full" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...params, { value: '', type: 'STRING' }])}><Plus size={12} /> 添加 SQL 参数</Button></div>
}

function StringListField({ label, value, disabled, onChange }: { label: string; value: unknown; disabled: boolean; onChange: (value: string[]) => void }) {
  const items = Array.isArray(value) ? value.map(String) : []
  return <div className="space-y-2"><div className="flex items-center justify-between"><Label className="text-xs">{label}</Label><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...items, ''])}><Plus size={12} />添加</Button></div>{items.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_28px] gap-2"><Input aria-label={`${label} ${index + 1}`} value={item} disabled={disabled} onChange={(event) => onChange(items.map((current, itemIndex) => itemIndex === index ? event.target.value : current))} /><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除 ${label} ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash size={12} /></Button></div>)}</div>
}

function downstreamNodes(nodeId: string, nodes: Node[], edges: Edge[]) {
  const ids = new Set(edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target))
  return nodes.filter((node) => ids.has(node.id))
}

function DownstreamNodeSelect({ label, value, nodeId, nodes, edges, disabled, onChange }: { label: string; value: unknown; nodeId: string; nodes: Node[]; edges: Edge[]; disabled: boolean; onChange: (value: string) => void }) {
  const options = downstreamNodes(nodeId, nodes, edges)
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Select value={value ? String(value) : 'none'} disabled={disabled} onValueChange={(next) => onChange(next === 'none' ? '' : next)}>
        <SelectTrigger><SelectValue placeholder="选择已连接的下游节点" /></SelectTrigger>
        <SelectContent><SelectItem value="none">未设置</SelectItem>{options.map((node) => <SelectItem key={node.id} value={node.id}>{String(node.data.name || node.id)}</SelectItem>)}</SelectContent>
      </Select>
      {!options.length ? <p className="mt-1 text-[11px] text-muted-foreground">请先从当前节点连接下游节点。</p> : null}
    </div>
  )
}

type ConditionBranch = { scope?: string; inputIsNullUse?: boolean; symbol?: string; conditionExpression?: string; compareTo?: Record<string, unknown>; nextNodeId?: string }

function ConditionBranchesField({ value, nodeId, nodes, edges, disabled, onChange }: { value: unknown; nodeId: string; nodes: Node[]; edges: Edge[]; disabled: boolean; onChange: (value: ConditionBranch[]) => void }) {
  const branches = Array.isArray(value) ? value as ConditionBranch[] : []
  const patch = (index: number, next: Partial<ConditionBranch>) => onChange(branches.map((branch, itemIndex) => itemIndex === index ? { ...branch, ...next } : branch))
  return (
    <div className="space-y-2">
      <Label className="text-xs">条件分支</Label>
      {branches.map((branch, index) => {
        const compareTo = branch.compareTo && typeof branch.compareTo === 'object' ? branch.compareTo : { type: 'CONSTANT', value: '' }
        return <div key={index} className="space-y-2 rounded-lg border border-border p-2">
          <div className="flex items-center gap-2"><Badge variant="outline">{index === 0 ? 'IF' : 'ELSE IF'}</Badge>{index > 0 ? <Button type="button" variant="ghost" size="icon" className="ml-auto text-destructive" disabled={disabled} aria-label={`删除条件 ${index + 1}`} onClick={() => onChange(branches.filter((_, itemIndex) => itemIndex !== index))}><Trash size={13} /></Button> : null}</div>
          <Select value={branch.symbol || 'EQ'} disabled={disabled} onValueChange={(symbol) => patch(index, { symbol })}><SelectTrigger aria-label={`条件 ${index + 1} 运算符`}><SelectValue /></SelectTrigger><SelectContent>{conditionSymbols.map((symbol) => <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>)}</SelectContent></Select>
          {branch.symbol === 'EXPRESSION' ? <Textarea value={branch.conditionExpression || ''} disabled={disabled} placeholder="Groovy 条件表达式" onChange={(event) => patch(index, { conditionExpression: event.target.value })} /> : <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2"><Select value={String(compareTo.type || 'CONSTANT')} disabled={disabled} onValueChange={(type) => patch(index, { compareTo: { ...compareTo, type } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONSTANT">常量</SelectItem><SelectItem value="VARIABLE">节点输出</SelectItem></SelectContent></Select><Input value={String(compareTo.value ?? '')} disabled={disabled} placeholder={compareTo.type === 'VARIABLE' ? '输出字段名' : '比较值'} onChange={(event) => patch(index, { compareTo: { ...compareTo, value: event.target.value } })} /></div>}
          <div className="grid grid-cols-2 gap-2"><Select value={branch.scope || 'SELF'} disabled={disabled} onValueChange={(scope) => patch(index, { scope })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="SELF">值本身</SelectItem><SelectItem value="LENGTH">长度</SelectItem></SelectContent></Select><label className="flex items-center gap-2 rounded-md border px-2 text-[11px]"><Switch checked={Boolean(branch.inputIsNullUse)} disabled={disabled} onCheckedChange={(inputIsNullUse) => patch(index, { inputIsNullUse })} />空值视为 True</label></div>
          <DownstreamNodeSelect label="跳转到" value={branch.nextNodeId} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(nextNodeId) => patch(index, { nextNodeId })} />
        </div>
      })}
      <Button type="button" className="w-full" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...branches, { scope: 'SELF', inputIsNullUse: false, symbol: 'EQ', compareTo: { type: 'CONSTANT', value: '' }, conditionExpression: '' }])}><Plus size={13} /> 添加 ELSE IF</Button>
    </div>
  )
}

type MatchRoute = { matchValue: string; nextNodeId: string }

function MatchRoutesField({ value, nodeId, nodes, edges, disabled, onChange }: { value: unknown; nodeId: string; nodes: Node[]; edges: Edge[]; disabled: boolean; onChange: (value: MatchRoute[]) => void }) {
  const items = Array.isArray(value) ? value as MatchRoute[] : []
  const patch = (index: number, next: Partial<MatchRoute>) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return <div className="space-y-2"><Label className="text-xs">匹配路由</Label>{items.map((item, index) => <div key={index} className="space-y-2 rounded-lg border border-border p-2"><div className="flex gap-2"><Input value={item.matchValue || ''} disabled={disabled} placeholder="匹配值" onChange={(event) => patch(index, { matchValue: event.target.value })} /><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除匹配项 ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash size={13} /></Button></div><DownstreamNodeSelect label="跳转到" value={item.nextNodeId} nodeId={nodeId} nodes={nodes} edges={edges} disabled={disabled} onChange={(nextNodeId) => patch(index, { nextNodeId })} /></div>)}<Button type="button" className="w-full" variant="outline" size="sm" disabled={disabled} onClick={() => onChange([...items, { matchValue: '', nextNodeId: '' }])}><Plus size={13} /> 添加匹配项</Button></div>
}

type IntentRoute = { name: string; description: string; nextNodeId: string }

function IntentRoutesField({ value, nodeId, nodes, edges, disabled, onChange }: { value: unknown; nodeId: string; nodes: Node[]; edges: Edge[]; disabled: boolean; onChange: (value: IntentRoute[]) => void }) {
  const stored = Array.isArray(value) ? value as IntentRoute[] : []
  const connected = downstreamNodes(nodeId, nodes, edges)
  const items = connected.map((node) => stored.find((item) => item.nextNodeId === node.id) ?? { name: '', description: '', nextNodeId: node.id })
  const patch = (index: number, next: Partial<IntentRoute>) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return <div className="space-y-2"><Label className="text-xs">意图路由</Label>{items.length ? items.map((item, index) => <div key={item.nextNodeId} className="space-y-2 rounded-lg border border-border p-2"><div className="text-xs font-medium">{String(connected[index]?.data.name || item.nextNodeId)}</div><Input value={item.name || ''} disabled={disabled} placeholder="意图名称，如：退款咨询" onChange={(event) => patch(index, { name: event.target.value })} /><Input value={item.description || ''} disabled={disabled} placeholder="意图描述" onChange={(event) => patch(index, { description: event.target.value })} /></div>) : <p className="text-xs text-muted-foreground">请先连接下游节点，再配置每条意图。</p>}</div>
}

type KeyValueItem = { key?: string; value?: string }

function KeyValueList({ label, value, disabled, onChange }: { label: string; value: unknown; disabled: boolean; onChange: (value: KeyValueItem[]) => void }) {
  const items = Array.isArray(value) ? value as KeyValueItem[] : []
  const patch = (index: number, next: Partial<KeyValueItem>) => onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return <div className="space-y-2"><div className="flex items-center justify-between"><Label className="text-xs">{label}</Label><Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...items, { key: '', value: '' }])}><Plus size={12} />添加</Button></div>{items.map((item, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px] gap-2"><Input aria-label={`${label} ${index + 1} 键`} value={item.key || ''} disabled={disabled} placeholder="Key" onChange={(event) => patch(index, { key: event.target.value })} /><Input aria-label={`${label} ${index + 1} 值`} value={item.value || ''} disabled={disabled} placeholder="Value" onChange={(event) => patch(index, { value: event.target.value })} /><Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除 ${label} ${index + 1}`} onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}><Trash size={12} /></Button></div>)}</div>
}

function HttpRequestField({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: Record<string, unknown>) => void }) {
  const request = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
  const patch = (next: Record<string, unknown>) => onChange({ ...request, ...next })
  const method = String(request.method || 'GET')
  return <div className="space-y-3 rounded-lg border border-border p-3"><Label className="text-xs">HTTP 请求</Label><div className="grid grid-cols-[100px_minmax(0,1fr)] gap-2"><Select value={method} disabled={disabled} onValueChange={(next) => patch({ method: next })}><SelectTrigger aria-label="HTTP 方法"><SelectValue /></SelectTrigger><SelectContent>{['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Input aria-label="请求 URL" value={String(request.url || '')} disabled={disabled} placeholder="https://api.example.com/users/${id}" onChange={(event) => patch({ url: event.target.value })} /></div><div><Label className="mb-1.5 block text-xs">Content-Type</Label><Select value={String(request.contentType || 'JSON')} disabled={disabled} onValueChange={(contentType) => patch({ contentType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['JSON', 'FORM_URLENCODED', 'FORM_DATA', 'XML', 'TEXT_PLAIN', 'OCTET_STREAM'].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><KeyValueList label="Headers" value={request.headers} disabled={disabled} onChange={(headers) => patch({ headers })} /><KeyValueList label="Query Params" value={request.queryParams} disabled={disabled} onChange={(queryParams) => patch({ queryParams })} />{!['GET', 'HEAD'].includes(method) ? <div><Label className="mb-1.5 block text-xs">Body</Label><Textarea className="min-h-32 font-mono text-xs" value={String(request.body ?? '')} disabled={disabled} placeholder="支持 ${输入名} 模板语法" onChange={(event) => patch({ body: event.target.value })} /></div> : null}</div>
}

function SingleOptionSelect({ label, value, disabled, placeholder, options, onChange }: { label: string; value: unknown; disabled: boolean; placeholder: string; options: SelectOption[]; onChange: (value: string) => void }) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <Select value={value == null ? '' : String(value)} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
      {!options.length ? <p className="mt-1 text-[11px] text-muted-foreground">暂无可用项，请先在资源管理中配置并启用。</p> : null}
    </div>
  )
}

function MultiOptionSelect({ label, value, disabled, options, onChange }: { label: string; value: unknown; disabled: boolean; options: SelectOption[]; onChange: (value: string[]) => void }) {
  const selected = Array.isArray(value) ? value.map(String) : []
  return (
    <div>
      <Label className="mb-1.5 block text-xs">{label}</Label>
      <fieldset disabled={disabled}>
        <MultiSelectField options={options} value={selected} onChange={onChange} placeholder={`选择${label}`} />
      </fieldset>
      {!options.length ? <p className="mt-1 text-[11px] text-muted-foreground">暂无可用项，请先在资源管理中配置并启用。</p> : null}
    </div>
  )
}

function McpToolSelector({ serverId, value, disabled, onChange }: { serverId: string; value: unknown; disabled: boolean; onChange: (tool: McpToolVO | null) => void }) {
  const toolsQuery = useQuery({
    queryKey: ['list', 'workflow-mcp-tools', serverId],
    queryFn: async () => (await mcpServers.tools(serverId)).data.data,
    enabled: Boolean(serverId),
  })
  const toolList = (toolsQuery.data ?? []).filter((tool) => tool.enabled && !tool.missing)
  return (
    <div>
      <Label className="mb-1.5 block text-xs">MCP 工具</Label>
      <Select value={value == null ? '' : String(value)} onValueChange={(next) => onChange(toolList.find((tool) => String(tool.id) === next) ?? null)} disabled={disabled || !serverId || toolsQuery.isLoading}>
        <SelectTrigger><SelectValue placeholder={!serverId ? '请先选择 MCP 服务' : toolsQuery.isLoading ? '工具加载中…' : '选择 MCP 工具'} /></SelectTrigger>
        <SelectContent>{toolList.map((tool) => <SelectItem key={tool.id} value={String(tool.id)}>{tool.toolName}</SelectItem>)}</SelectContent>
      </Select>
      {toolsQuery.error ? <p className="mt-1 text-[11px] text-destructive">MCP 工具加载失败</p> : null}
    </div>
  )
}

function InputConfigEditor({ value, nodes, selectedNodeId, disabled, onChange }: {
  value: WorkflowInputConfig[]
  nodes: Node[]
  selectedNodeId: string
  disabled: boolean
  onChange: (value: WorkflowInputConfig[]) => void
}) {
  const patch = (index: number, next: Partial<WorkflowInputConfig>) => onChange(value.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item))
  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">输入映射</Label>
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange([...value, { name: `input${value.length + 1}`, sourceType: 'CONSTANT', value: '', type: 'String' }])}><Plus size={13} /> 添加</Button>
      </div>
      {value.length === 0 ? <p className="text-xs text-muted-foreground">暂无输入映射。</p> : value.map((item, index) => (
        <div key={`${item.name}-${index}`} className="space-y-2 rounded-md bg-muted/50 p-2">
          <div className="grid grid-cols-[minmax(0,1fr)_130px_28px] gap-2">
            <Input aria-label={`输入 ${index + 1} 名称`} value={item.name} disabled={disabled} placeholder="输入名称" onChange={(event) => patch(index, { name: event.target.value })} />
            <Select value={item.sourceType} disabled={disabled} onValueChange={(sourceType) => patch(index, { sourceType: sourceType as WorkflowInputConfig['sourceType'] })}><SelectTrigger aria-label={`输入 ${index + 1} 来源`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="CONSTANT">常量</SelectItem><SelectItem value="VARIABLE">变量</SelectItem><SelectItem value="NODE_OUTPUT">节点输出</SelectItem><SelectItem value="EXPRESSION">表达式</SelectItem></SelectContent></Select>
            <Button type="button" variant="ghost" size="icon" className="text-destructive" disabled={disabled} aria-label={`删除输入 ${index + 1}`} onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}><Trash size={13} /></Button>
          </div>
          {item.sourceType === 'CONSTANT' ? <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-2"><Select value={item.type ?? 'String'} disabled={disabled} onValueChange={(type) => patch(index, { type: type as WorkflowInputConfig['type'] })}><SelectTrigger aria-label={`输入 ${index + 1} 类型`}><SelectValue /></SelectTrigger><SelectContent>{['String', 'Long', 'Integer', 'Float', 'Double', 'Boolean', 'Array', 'Object'].map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select><Input aria-label={`输入 ${index + 1} 常量值`} value={item.value == null ? '' : typeof item.value === 'string' ? item.value : JSON.stringify(item.value)} disabled={disabled} placeholder="常量值" onChange={(event) => patch(index, { value: event.target.value })} /></div> : null}
          {item.sourceType === 'VARIABLE' ? <Input aria-label={`输入 ${index + 1} 变量名`} value={item.variableName ?? ''} disabled={disabled} placeholder="全局变量名" onChange={(event) => patch(index, { variableName: event.target.value })} /> : null}
          {item.sourceType === 'NODE_OUTPUT' ? <div className="grid grid-cols-2 gap-2"><Select value={item.nodeId ?? ''} disabled={disabled} onValueChange={(nodeId) => patch(index, { nodeId })}><SelectTrigger aria-label={`输入 ${index + 1} 来源节点`}><SelectValue placeholder="选择上游节点" /></SelectTrigger><SelectContent>{nodes.filter((node) => node.id !== selectedNodeId).map((node) => <SelectItem key={node.id} value={node.id}>{String(node.data.name || node.id)}</SelectItem>)}</SelectContent></Select><Input aria-label={`输入 ${index + 1} 输出名`} value={item.outputName ?? 'output'} disabled={disabled} placeholder="输出名" onChange={(event) => patch(index, { outputName: event.target.value })} /></div> : null}
          {item.sourceType === 'EXPRESSION' ? <Textarea aria-label={`输入 ${index + 1} 表达式`} className="min-h-20 font-mono text-xs" value={item.expression ?? ''} disabled={disabled} placeholder="表达式" onChange={(event) => patch(index, { expression: event.target.value })} /> : null}
        </div>
      ))}
    </div>
  )
}

function OutputConfigDisplay({ value }: { value: Array<{ name: string; type?: string; description?: string }> }) {
  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <Label className="text-xs">节点输出</Label>
      {value.length ? <div className="mt-2 space-y-1">{value.map((item) => <div key={item.name} className="flex items-center gap-2 text-xs"><code className="rounded bg-muted px-1.5 py-0.5">{item.name}</code><span className="text-muted-foreground">{item.type || 'Object'}{item.description ? ` · ${item.description}` : ''}</span></div>)}</div> : <p className="mt-2 text-xs text-muted-foreground">此节点没有声明输出。</p>}
    </div>
  )
}

function JsonValueField({ value, disabled, onChange }: { value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const serialized = JSON.stringify(value, null, 2)
  const [text, setText] = useState(serialized)
  useEffect(() => setText(serialized), [serialized])
  return (
    <Textarea
      className="min-h-24 font-mono text-xs"
      value={text}
      disabled={disabled}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        try {
          onChange(JSON.parse(text))
        } catch {
          toast.error('字段 JSON 格式不正确')
          setText(serialized)
        }
      }}
    />
  )
}

function RunHistory({ workflowId }: { workflowId: string }) {
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null)
  const runsQuery = useQuery({
    queryKey: ['list', 'workflow-runs', workflowId],
    queryFn: async () => (await workflowApi.pageRuns({ page: 1, size: 30, workflowId })).data.data,
  })
  const nodesQuery = useQuery({
    queryKey: ['list', 'workflow-run-nodes', selectedRun?.id],
    queryFn: async () => (await workflowApi.runNodes(String(selectedRun?.id))).data.data,
    enabled: Boolean(selectedRun?.id),
  })
  const runs: WorkflowRun[] = runsQuery.data?.records ?? []
  const executions: WorkflowNodeExecution[] = nodesQuery.data ?? []

  if (runsQuery.isLoading) return <PageLoading />
  if (runsQuery.error) return <ErrorState error={runsQuery.error} onRetry={() => void runsQuery.refetch()} />
  if (!runs.length) return <p className="p-4 text-sm text-muted-foreground">暂无运行记录。</p>
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-2">
        {runs.map((run) => (
          <button key={run.id} className={`w-full rounded-lg border p-3 text-left text-xs ${selectedRun?.id === run.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted'}`} onClick={() => setSelectedRun(run)}>
            <div className="flex items-center justify-between gap-2"><span className="font-mono">{run.version || String(run.id).slice(-8)}</span><Badge className={run.status === 'FAIL' ? 'bg-destructive/10 text-destructive' : undefined} variant={run.status === 'SUCCESS' ? 'success' : 'secondary'}>{run.status}</Badge></div>
            <div className="mt-1 text-muted-foreground">{formatRunTime(run.createdAt, run.startTime)}</div>
          </button>
        ))}
      </div>
      <div className="min-w-0">
        {!selectedRun ? <p className="text-sm text-muted-foreground">选择一条记录查看节点执行日志。</p> : nodesQuery.isLoading ? <PageLoading /> : nodesQuery.error ? <ErrorState error={nodesQuery.error} onRetry={() => void nodesQuery.refetch()} /> : (
          <div className="space-y-2">
            <div className="rounded-lg bg-muted p-3 text-xs"><div className="font-medium">运行 {selectedRun.id}</div>{selectedRun.error ? <p className="mt-1 text-destructive">{selectedRun.error}</p> : null}<pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono">输出：{JSON.stringify(selectedRun.outputs ?? null, null, 2)}</pre></div>
            {executions.length ? executions.map((execution) => <details key={execution.id} className="rounded-lg border border-border p-3 text-xs"><summary className="flex cursor-pointer items-center gap-2"><span className="font-medium">{execution.nodeTitle || execution.nodeId}</span><Badge className={`ml-auto ${execution.status === 'FAIL' ? 'bg-destructive/10 text-destructive' : ''}`} variant={execution.status === 'SUCCESS' ? 'success' : 'secondary'}>{execution.status}</Badge></summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap font-mono">{JSON.stringify({ inputs: safeJson(execution.inputs), processData: safeJson(execution.processData), outputs: safeJson(execution.outputs), error: execution.error }, null, 2)}</pre></details>) : <p className="text-sm text-muted-foreground">该运行没有节点日志。</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function safeJson(value?: string) {
  if (!value) return value
  try { return JSON.parse(value) as unknown } catch { return value }
}

function formatRunTime(createdAt?: string, startTime?: number) {
  if (createdAt) return createdAt
  if (startTime) return new Date(startTime).toLocaleString()
  return '-'
}

export function parseInputObject(value: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    throw new Error('运行输入必须是合法 JSON')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('运行输入必须是 JSON 对象')
  return parsed as Record<string, unknown>
}
