import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import { createAgent, getAgent, getA2aConfig, pageAgents, saveA2aConfig, updateAgent } from '@/api/agents'
import { hooks, modelConfigs, mcpServers, prompts, sensitiveWords, skills, tools } from '@/api/resources'
import type { AgentA2A, AgentDefinitionVO, KvMap, WellKnownAgentConfig, NacosAgentConfig, ToolVO } from '@/types'
import { A2aType, ToolChoiceStrategy } from '@/types'
import { MultiSelectField, type SelectOption } from './multi-select-field'

interface EditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 编辑的 Agent id；null 为新建 */
  agentId: string | null
  /** 复制来源的 VO：新建时预填 */
  cloneFrom?: AgentDefinitionVO | null
  onSaved: () => void
}

type FormState = Partial<
  Omit<AgentDefinitionVO, 'modelParamsOverride' | 'structuredOutputSchema' | 'memoryCompressionConfig'>
> & {
  // 提交前以字符串编辑的 JSON 字段
  modelParamsOverrideText: string
  structuredOutputSchemaText: string
  memoryCompressionConfigText: string
}

function emptyForm(): FormState {
  return {
    agentType: 'CUSTOM',
    name: '',
    agentCode: '',
    description: '',
    modelConfigId: '',
    modelParamsOverrideText: '',
    skill: [],
    workflow: [],
    tool: [],
    mcp: [],
    mcpBindings: [],
    hook: [],
    subAgent: [],
    toolChoiceStrategy: ToolChoiceStrategy.AUTO,
    specificToolName: '',
    systemPromptTemplateId: '',
    followTemplate: false,
    systemPrompt: '',
    sensitiveWordConfigId: '',
    sensitiveFilterEnabled: false,
    maxIterations: 10,
    enablePlanning: false,
    maxSubtasks: 5,
    requirePlanConfirmation: false,
    enableMemory: false,
    enableMemoryCompression: false,
    showToolProcess: true,
    memoryCompressionConfigText: '',
    structuredOutputEnabled: false,
    structuredOutputSchemaText: '',
    structuredOutputReminder: 'PROMPT',
    version: 'v1',
    tag: '',
    enabled: true,
  }
}

function formFromVo(vo: AgentDefinitionVO): FormState {
  const form = emptyForm()
  return {
    ...form,
    ...vo,
    modelParamsOverrideText: vo.modelParamsOverride ? JSON.stringify(vo.modelParamsOverride, null, 2) : '',
    structuredOutputSchemaText: vo.structuredOutputSchema ? JSON.stringify(vo.structuredOutputSchema, null, 2) : '',
    memoryCompressionConfigText: vo.memoryCompressionConfig ? JSON.stringify(vo.memoryCompressionConfig, null, 2) : '',
  }
}

/** 提交适配器：保留后端中与本次表单无关的兼容字段（知识库/ragConfig），不意外清空。 */
function buildPayload(form: FormState, original: AgentDefinitionVO | null): Partial<AgentDefinitionVO> {
  function parseJson(text: string, fallback: Record<string, unknown> | null) {
    const trimmed = text.trim()
    if (!trimmed) return null
    try {
      return JSON.parse(trimmed) as Record<string, unknown>
    } catch {
      return fallback
    }
  }

  const payload: Record<string, unknown> = {
    ...form,
    modelParamsOverride: parseJson(form.modelParamsOverrideText, original?.modelParamsOverride ?? null),
    structuredOutputSchema: parseJson(form.structuredOutputSchemaText, original?.structuredOutputSchema ?? null),
    memoryCompressionConfig: parseJson(form.memoryCompressionConfigText, original?.memoryCompressionConfig ?? null),
    tag: form.tag || null,
    // 兼容字段原样透传：后端仍持有这些字段时不得被表单清空
    knowledgeBase: original?.knowledgeBase ?? [],
    ragConfig: original?.ragConfig ?? null,
  }
  if (original?.id) payload.id = original.id
  return payload as Partial<AgentDefinitionVO>
}

export function buildToolSelectorOptions(tools: Array<Pick<ToolVO, 'id' | 'name' | 'toolId'>>): SelectOption[] {
  return tools.map((tool) => ({ label: tool.name, value: String(tool.id), description: tool.toolId }))
}

function defaultWellKnown(agentName: string): WellKnownAgentConfig {
  return { agentName, baseUrl: '', relativeCardPath: '/.well-known/agent-card.json', authHeaders: [] }
}

function defaultNacos(agentName: string): NacosAgentConfig {
  return { agentName, nacosProperties: [{ key: 'serverAddr', value: '', evn: false }, { key: 'username', value: '', evn: false }, { key: 'password', value: '', evn: false }] }
}

export function validateA2aConfig(a2a: AgentA2A | null): string | null {
  if (!a2a) return '请先初始化 A2A 配置'
  if (!a2a.a2aConfig.agentName?.trim()) return 'A2A Agent 名称不能为空'
  if (a2a.a2aType === A2aType.WELLKNOWN) {
    const config = a2a.a2aConfig as WellKnownAgentConfig
    try {
      const url = new URL(config.baseUrl)
      if (!['http:', 'https:'].includes(url.protocol)) return 'Base URL 必须使用 HTTP 或 HTTPS'
    } catch {
      return '请输入有效的 Base URL'
    }
    if (!config.relativeCardPath?.trim()) return 'Agent Card 路径不能为空'
    if ((config.authHeaders ?? []).some((item) => !item.key?.trim())) return '认证头名称不能为空'
  } else {
    const properties = (a2a.a2aConfig as NacosAgentConfig).nacosProperties ?? []
    const serverAddr = properties.find((item) => item.key === 'serverAddr')
    if (!serverAddr?.value?.trim()) return 'Nacos serverAddr 不能为空'
    if (properties.some((item) => !item.key?.trim())) return 'Nacos 属性名不能为空'
  }
  return null
}

function useSelectorOptions(open: boolean) {
  const models = useQuery({ queryKey: ['list', 'model-config', 'selector'], queryFn: async () => (await modelConfigs.page({ page: 1, size: 200 })).data.data.records, enabled: open })
  const toolList = useQuery({ queryKey: ['list', 'tool', 'selector'], queryFn: async () => (await tools.page({ page: 1, size: 500 })).data.data.records, enabled: open })
  const skillList = useQuery({ queryKey: ['list', 'skill', 'selector'], queryFn: async () => (await skills.page({ page: 1, size: 500 })).data.data.records, enabled: open })
  const mcpList = useQuery({ queryKey: ['list', 'mcp', 'selector'], queryFn: async () => (await mcpServers.page({ page: 1, size: 200 })).data.data.records, enabled: open })
  const hookList = useQuery({ queryKey: ['list', 'hook', 'selector'], queryFn: async () => (await hooks.page({ page: 1, size: 200 })).data.data.records, enabled: open })
  const promptList = useQuery({ queryKey: ['list', 'prompt', 'selector'], queryFn: async () => (await prompts.page({ page: 1, size: 200 })).data.data.records, enabled: open })
  const sensitiveList = useQuery({ queryKey: ['list', 'sensitive', 'selector'], queryFn: async () => (await sensitiveWords.page({ page: 1, size: 200 })).data.data.records, enabled: open })

  const modelOptions: SelectOption[] = (models.data ?? []).map((model) => ({ label: `${model.name} (${model.modelId})`, value: String(model.id) }))
  // AgentDefinitionVO.tool is a list of database Long ids. toolId is the
  // runtime invocation name and must never be submitted in this field.
  const toolOptions = buildToolSelectorOptions(toolList.data ?? [])
  const skillOptions: SelectOption[] = (skillList.data ?? []).map((skill) => ({ label: skill.alias || skill.name, value: String(skill.id) }))
  const mcpOptions: SelectOption[] = (mcpList.data ?? []).map((server) => ({ label: server.name, value: String(server.id) }))
  const hookOptions: SelectOption[] = (hookList.data ?? []).map((hook) => ({ label: hook.name, value: String(hook.id) }))
  const promptOptions: SelectOption[] = (promptList.data ?? []).map((template) => ({ label: template.name, value: String(template.id) }))
  const sensitiveOptions: SelectOption[] = (sensitiveList.data ?? []).map((config) => ({ label: config.name, value: String(config.id) }))

  return {
    modelOptions,
    toolOptions,
    skillOptions,
    mcpOptions,
    hookOptions,
    promptOptions,
    sensitiveOptions,
    loading: models.isLoading || toolList.isLoading || skillList.isLoading || mcpList.isLoading,
  }
}

export function AgentEditor({ open, onOpenChange, agentId, cloneFrom, onSaved }: EditorProps) {
  const [form, setForm] = useState<FormState>(emptyForm)
  const [original, setOriginal] = useState<AgentDefinitionVO | null>(null)
  const [a2a, setA2a] = useState<AgentA2A | null>(null)
  const [subAgentOptions, setSubAgentOptions] = useState<SelectOption[]>([])
  const [workflowOptions, setWorkflowOptions] = useState<SelectOption[]>([])
  const [busy, setBusy] = useState(false)

  const selectors = useSelectorOptions(open)

  // 子 Agent 候选 = 其他 Agent 列表
  useEffect(() => {
    if (!open) return
    let cancelled = false
    void pageAgents({ page: 1, size: 500 })
      .then((response) => {
        if (cancelled) return
        setSubAgentOptions(
          response.data.data.records
            .filter((row) => !agentId || String(row.id) !== agentId)
            .map((row) => ({ label: row.name, value: String(row.id), description: row.agentCode })),
        )
      })
      .catch(() => {
        /* 选择器加载失败不阻塞表单 */
      })
    return () => {
      cancelled = true
    }
  }, [open, agentId])

  // 工作流候选（RM-07 前仅展示，占位接口失败不阻塞）
  useEffect(() => {
    if (!open) return
    let cancelled = false
    import('@/api/workflows').then(async ({ pageWorkflows }) => {
      try {
        const response = await pageWorkflows({ page: 1, size: 200 })
        if (cancelled) return
        setWorkflowOptions(response.data.data.records.map((row) => ({ label: row.name ?? row.routeId ?? String(row.id), value: String(row.id) })))
      } catch {
        /* 工作流服务未就绪时忽略 */
      }
    }).catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function load() {
      if (agentId) {
        try {
          const response = await getAgent(agentId)
          if (cancelled) return
          const vo = response.data.data
          setOriginal(vo)
          setForm(formFromVo(vo))
          if (vo.agentType === 'A2A') {
            try {
              const a2aResponse = await getA2aConfig(agentId)
              if (!cancelled) setA2a(a2aResponse.data.data)
            } catch {
              if (!cancelled) setA2a(null)
            }
          } else {
            setA2a(null)
          }
        } catch (cause) {
          toast.error(readableError(cause, '加载 Agent 失败'))
          onOpenChange(false)
        }
      } else if (cloneFrom) {
        setOriginal(null)
        setForm({ ...formFromVo(cloneFrom), name: `${cloneFrom.name}-copy`, agentCode: `${cloneFrom.agentCode}-copy`, version: 'v1' })
        setA2a(null)
      } else {
        setOriginal(null)
        setForm(emptyForm())
        setA2a(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, agentId, cloneFrom, onOpenChange])

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }))
  }, [])

  const jsonInvalid = useMemo(() => [form.modelParamsOverrideText, form.structuredOutputSchemaText, form.memoryCompressionConfigText].some((text) => {
    const trimmed = text.trim()
    if (!trimmed) return false
    try {
      JSON.parse(trimmed)
      return false
    } catch {
      return true
    }
  }), [form.modelParamsOverrideText, form.structuredOutputSchemaText, form.memoryCompressionConfigText])

  async function submit() {
    if (!form.name?.trim() || !form.agentCode?.trim()) {
      toast.error('名称与 Agent 代码为必填项')
      return
    }
    if (jsonInvalid) {
      toast.error('存在不合法的 JSON 字段，请检查高级配置')
      return
    }
    if (form.agentType === 'A2A') {
      const message = validateA2aConfig(a2a)
      if (message) {
        toast.error(message)
        return
      }
    }
    setBusy(true)
    try {
      const payload = buildPayload(form, original)
      let savedAgentId = agentId
      if (agentId && original) await updateAgent(payload)
      else {
        const response = await createAgent(payload)
        savedAgentId = String(response.data.data.id)
      }
      if (form.agentType === 'A2A' && a2a) {
        await saveA2aConfig({ ...a2a, agentDefinitionId: savedAgentId ?? undefined, a2aType: a2a.a2aType ?? A2aType.WELLKNOWN })
      }
      toast.success('已保存')
      onOpenChange(false)
      onSaved()
    } catch (cause) {
      toast.error(readableError(cause, '保存失败'))
    } finally {
      setBusy(false)
    }
  }

  function renderMulti(label: string, key: keyof FormState, options: SelectOption[], loading: boolean) {
    return (
      <div>
        <Label>{label}</Label>
        <div className="mt-1.5">
          <MultiSelectField options={options} value={(form[key] as string[]) ?? []} onChange={(next) => set(key, next as never)} loading={loading} />
        </div>
      </div>
    )
  }

  function renderText(label: string, key: keyof FormState, placeholder?: string) {
    return (
      <div>
        <Label htmlFor={`agent-${key}`}>{label}</Label>
        <Input id={`agent-${key}`} className="mt-1.5" value={String(form[key] ?? '')} placeholder={placeholder} onChange={(event) => set(key, event.target.value as never)} />
      </div>
    )
  }

  function renderNumber(label: string, key: keyof FormState) {
    return (
      <div>
        <Label htmlFor={`agent-${key}`}>{label}</Label>
        <Input id={`agent-${key}`} className="mt-1.5" type="number" value={String(form[key] ?? '')} onChange={(event) => set(key, (event.target.value === '' ? undefined : Number(event.target.value)) as never)} />
      </div>
    )
  }

  function renderSwitch(label: string, key: keyof FormState) {
    return (
      <label className="flex items-center gap-2 py-2 text-sm">
        <Switch checked={Boolean(form[key])} onCheckedChange={(checked) => set(key, checked as never)} aria-label={label} />
        {label}
      </label>
    )
  }

  function renderJson(label: string, key: 'modelParamsOverrideText' | 'structuredOutputSchemaText' | 'memoryCompressionConfigText', placeholder?: string) {
    return (
      <div>
        <Label htmlFor={`agent-${key}`}>{label} (JSON)</Label>
        <Textarea id={`agent-${key}`} className="mt-1.5 min-h-24 font-mono text-xs" value={form[key]} placeholder={placeholder} onChange={(event) => set(key, event.target.value as never)} />
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle>{agentId ? '编辑 Agent' : cloneFrom ? '复制 Agent' : '新建 Agent'}</DialogTitle>
          <DialogDescription>知识库与 RAG 字段不在本前端支持范围内；提交时将原样保留后端既有值。</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic">
          <TabsList className="flex-wrap">
            <TabsTrigger value="basic">基础</TabsTrigger>
            <TabsTrigger value="model">模型</TabsTrigger>
            <TabsTrigger value="prompt">提示词</TabsTrigger>
            <TabsTrigger value="resources">工具 / 技能 / MCP</TabsTrigger>
            <TabsTrigger value="subagent">子 Agent / 工作流</TabsTrigger>
            <TabsTrigger value="advanced">高级</TabsTrigger>
            {form.agentType === 'A2A' ? <TabsTrigger value="a2a">A2A</TabsTrigger> : null}
          </TabsList>

          <TabsContent value="basic" className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Agent 类型</Label>
              <Select value={form.agentType} onValueChange={(value) => set('agentType', value as 'CUSTOM' | 'A2A')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CUSTOM">CUSTOM（本平台 Agent）</SelectItem>
                  <SelectItem value="A2A">A2A（外部协议 Agent）</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderText('名称 *', 'name')}
            {renderText('Agent 代码 *', 'agentCode', '唯一标识')}
            {renderText('版本', 'version')}
            <div>
              <Label htmlFor="agent-tag">标签</Label>
              <Input id="agent-tag" className="mt-1.5" value={form.tag ?? ''} onChange={(event) => set('tag', event.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="agent-desc">描述</Label>
              <Textarea id="agent-desc" className="mt-1.5" value={form.description} onChange={(event) => set('description', event.target.value)} />
            </div>
            {renderSwitch('启用', 'enabled')}
          </TabsContent>

          <TabsContent value="model" className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>模型配置 *</Label>
              <div className="mt-1.5">
                <Select value={form.modelConfigId || ''} onValueChange={(value) => set('modelConfigId', value)}>
                  <SelectTrigger><SelectValue placeholder={selectors.loading ? '加载中…' : '选择模型'} /></SelectTrigger>
                  <SelectContent>
                    {selectors.modelOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {renderJson('模型参数覆盖', 'modelParamsOverrideText', '{"temperature":0.7}')}
          </TabsContent>

          <TabsContent value="prompt" className="grid gap-4">
            <div>
              <Label>提示词模板</Label>
              <div className="mt-1.5">
                <MultiSelectField options={selectors.promptOptions} value={form.systemPromptTemplateId ? [form.systemPromptTemplateId] : []} onChange={(next) => set('systemPromptTemplateId', next.at(-1) ?? '')} placeholder="选择模板（可留空直接编辑下方提示词）" />
              </div>
            </div>
            {renderSwitch('跟随模板更新', 'followTemplate')}
            <div>
              <Label htmlFor="agent-systemPrompt">系统提示词</Label>
              <Textarea id="agent-systemPrompt" className="mt-1.5 min-h-40" value={form.systemPrompt} onChange={(event) => set('systemPrompt', event.target.value)} />
            </div>
          </TabsContent>

          <TabsContent value="resources" className="grid gap-4 sm:grid-cols-2">
            {renderMulti('工具', 'tool', selectors.toolOptions, selectors.loading)}
            {renderMulti('技能', 'skill', selectors.skillOptions, selectors.loading)}
            {renderMulti('MCP Server', 'mcp', selectors.mcpOptions, selectors.loading)}
            {renderMulti('Hook', 'hook', selectors.hookOptions, selectors.loading)}
            <div>
              <Label>工具选择策略</Label>
              <Select value={form.toolChoiceStrategy} onValueChange={(value) => set('toolChoiceStrategy', value as ToolChoiceStrategy)}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.values(ToolChoiceStrategy).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.toolChoiceStrategy === ToolChoiceStrategy.SPECIFIC ? renderText('指定工具名', 'specificToolName') : null}
            <div>
              <Label>敏感词配置</Label>
              <div className="mt-1.5">
                <MultiSelectField options={selectors.sensitiveOptions} value={form.sensitiveWordConfigId ? [form.sensitiveWordConfigId] : []} onChange={(next) => set('sensitiveWordConfigId', next.at(-1) ?? '')} placeholder="选择敏感词配置（可留空）" />
              </div>
            </div>
            {renderSwitch('启用敏感词过滤', 'sensitiveFilterEnabled')}
          </TabsContent>

          <TabsContent value="subagent" className="grid gap-4">
            {renderMulti('子 Agent（含 Agent-as-Tool 引用）', 'subAgent', subAgentOptions, false)}
            {renderMulti('工作流', 'workflow', workflowOptions, false)}
          </TabsContent>

          <TabsContent value="advanced" className="grid gap-4 sm:grid-cols-2">
            {renderNumber('最大迭代次数', 'maxIterations')}
            {renderNumber('最大子任务数', 'maxSubtasks')}
            {renderSwitch('启用任务计划', 'enablePlanning')}
            {renderSwitch('计划需人工确认', 'requirePlanConfirmation')}
            {renderSwitch('启用长期记忆', 'enableMemory')}
            {renderSwitch('启用记忆压缩', 'enableMemoryCompression')}
            {renderSwitch('展示工具执行过程', 'showToolProcess')}
            {renderSwitch('启用结构化输出', 'structuredOutputEnabled')}
            <div>
              <Label>结构化输出提醒方式</Label>
              <Select value={form.structuredOutputReminder} onValueChange={(value) => set('structuredOutputReminder', value as 'PROMPT' | 'TOOL_CHOICE')}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMPT">PROMPT</SelectItem>
                  <SelectItem value="TOOL_CHOICE">TOOL_CHOICE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {renderJson('结构化输出 Schema', 'structuredOutputSchemaText', '{"type":"object",...}')}
            {renderJson('记忆压缩配置', 'memoryCompressionConfigText')}
          </TabsContent>

          {form.agentType === 'A2A' ? (
            <TabsContent value="a2a" className="grid gap-4">
              {!a2a ? (
                <div className="sm:col-span-2">
                  <Button
                    variant="outline"
                    onClick={() =>
                      setA2a({
                        agentDefinitionId: agentId ?? undefined,
                        a2aType: A2aType.WELLKNOWN,
                        a2aConfig: defaultWellKnown(form.agentCode ?? ''),
                      })
                    }
                  >
                    初始化 A2A 配置
                  </Button>
                </div>
              ) : (
                <A2aForm a2a={a2a} onChange={setA2a} />
              )}
            </TabsContent>
          ) : null}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KvMapEditor({ rows, onChange }: { rows: KvMap[]; onChange: (next: KvMap[]) => void }) {
  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={index} className="flex gap-2">
          <Input
            placeholder="key"
            value={row.key ?? ''}
            onChange={(event) => onChange(rows.map((item, i) => (i === index ? { ...item, key: event.target.value } : item)))}
          />
          <Input
            placeholder="value"
            value={row.value ?? ''}
            onChange={(event) => onChange(rows.map((item, i) => (i === index ? { ...item, value: event.target.value } : item)))}
          />
          <label className="flex shrink-0 items-center gap-1 text-xs">
            <Switch checked={Boolean(row.evn)} onCheckedChange={(checked) => onChange(rows.map((item, i) => (i === index ? { ...item, evn: checked } : item)))} aria-label="来自环境变量" /> env
          </label>
          <Button variant="ghost" size="sm" className="shrink-0 text-destructive" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            删
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange([...rows, { key: '', value: '', evn: false }])}>
        添加一项
      </Button>
    </div>
  )
}

function A2aForm({ a2a, onChange }: { a2a: AgentA2A; onChange: (next: AgentA2A) => void }) {
  function updateConfig(patch: Partial<WellKnownAgentConfig> & Partial<NacosAgentConfig>) {
    onChange({ ...a2a, a2aConfig: { ...a2a.a2aConfig, ...patch } as WellKnownAgentConfig & NacosAgentConfig })
  }

  return (
    <div className="grid w-full gap-4">
      <div>
        <Label>A2A 类型</Label>
        <Select value={a2a.a2aType} onValueChange={(value) => {
          const a2aType = value as A2aType
          const agentName = a2a.a2aConfig.agentName ?? ''
          onChange({ ...a2a, a2aType, a2aConfig: a2aType === A2aType.WELLKNOWN ? defaultWellKnown(agentName) : defaultNacos(agentName) })
        }}>
          <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={A2aType.WELLKNOWN}>WellKnown（直连）</SelectItem>
            <SelectItem value={A2aType.NACOS}>Nacos 注册</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="a2a-name">Agent 名称</Label>
        <Input id="a2a-name" className="mt-1.5" value={a2a.a2aConfig.agentName ?? ''} onChange={(event) => updateConfig({ agentName: event.target.value })} />
      </div>
      {a2a.a2aType === A2aType.WELLKNOWN ? (
        <>
          <div>
            <Label htmlFor="a2a-baseurl">Base URL</Label>
            <Input id="a2a-baseurl" className="mt-1.5" value={(a2a.a2aConfig as WellKnownAgentConfig).baseUrl ?? ''} onChange={(event) => updateConfig({ baseUrl: event.target.value })} placeholder="https://peer.example.com" />
          </div>
          <div>
            <Label htmlFor="a2a-card">Agent Card 路径</Label>
            <Input id="a2a-card" className="mt-1.5 font-mono" value={(a2a.a2aConfig as WellKnownAgentConfig).relativeCardPath ?? ''} onChange={(event) => updateConfig({ relativeCardPath: event.target.value })} />
          </div>
          <div>
            <Label>认证头（Key-Value）</Label>
            <div className="mt-1.5">
              <KvMapEditor rows={(a2a.a2aConfig as WellKnownAgentConfig).authHeaders ?? []} onChange={(rows) => updateConfig({ authHeaders: rows })} />
            </div>
          </div>
        </>
      ) : (
        <div>
          <Label>Nacos 属性（Key-Value）</Label>
          <div className="mt-1.5">
            <KvMapEditor rows={(a2a.a2aConfig as NacosAgentConfig).nacosProperties ?? []} onChange={(rows) => updateConfig({ nacosProperties: rows })} />
          </div>
        </div>
      )}
    </div>
  )
}
