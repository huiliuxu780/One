import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/sonner'
import { readableError } from '@/lib/utils'
import {
  codeExecutionConfigs,
  hooks,
  longTermMemories,
  modelConfigs,
  modelProviders,
  prompts,
  sensitiveWords,
  studios,
  tools,
} from '@/api/resources'
import type { CodeExecutionConfig, HookConfigVO, LongTermMemoryConfig, ModelConfigVO, ModelProviderVO, SensitiveWordConfigVO, StudioConfig, SystemPromptTemplateVO, ToolVO } from '@/types'
import { AuthType, CodeLanguage, HookType, ModelProviderType, ModelType, SensitiveWordAction, ToolType } from '@/types'
import type { ColumnDef, FieldDef, ResourceDef } from './types'
import { ToolDebugDialog } from './tool-debug-dialog'

function enabledColumn<T extends { enabled?: boolean }>(): ColumnDef<T> {
  return {
    header: '启用',
    kind: 'enabled',
  }
}

function usedColumn<T extends { used?: string[] }>(): ColumnDef<T> {
  return {
    header: '占用',
    render: (row) =>
      row.used?.length ? <Badge variant="outline">被 {row.used.length} 处引用</Badge> : <span className="text-xs text-muted-foreground">未占用</span>,
  }
}

/** Hook 的 VO（HookConfig + used），含 name/hookType/priority 等字段。 */
type HookRow = HookConfigVO

const toolCodeTemplate = `import java.util.*;
import com.hxh.apboa.engine.tool.dynamices.IDynamicAgentTool;
import com.hxh.apboa.engine.agui.AgentContext;
import org.springframework.stereotype.Component;

@Component
public class CustomTool implements IDynamicAgentTool {
    @Override
    public Object execute(AgentContext context, Map<String, Object> params) {
        Map<String, Object> result = new HashMap<>();
        // 在这里读取 params 并实现工具逻辑
        return result;
    }
}`

const hookCodeTemplate = `import io.agentscope.core.hook.Hook;
import io.agentscope.core.hook.HookEvent;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

@Component
public class CustomHook implements Hook {
    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        return Mono.just(event);
    }
}`

export const toolDef: ResourceDef<ToolVO> = {
  key: 'tool',
  title: '工具',
  description: '内置与自定义工具；自定义工具支持代码编辑与参数 Schema。',
  api: { ...tools, usedWith: tools.usedWithAgent },
  searchPlaceholder: '按工具名称搜索',
  columns: [
    { header: '名称', field: 'name' },
    { header: 'toolId', field: 'toolId', className: 'font-mono text-xs' },
    { header: '分类', field: 'category' },
    { header: '类型', render: (row) => <Badge variant={row.toolType === ToolType.BUILTIN ? 'secondary' : 'outline'}>{row.toolType}</Badge> },
    { header: '需确认', render: (row) => <Badge variant={row.needConfirm ? 'default' : 'secondary'}>{row.needConfirm ? '需要' : '无需'}</Badge> },
    usedColumn<ToolVO>(),
    enabledColumn<ToolVO>(),
  ],
  filters: [
    { name: 'toolType', label: '工具类型', type: 'select', enumFrom: Object.values(ToolType) },
    { name: 'category', label: '分类', type: 'text' },
  ],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'toolId', label: '工具 ID', type: 'text', required: true, placeholder: '调用时使用的唯一标识' },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'category', label: '分类', type: 'text', required: true },
    { name: 'toolType', label: '工具类型', type: 'select', enumFrom: Object.values(ToolType), defaultValue: ToolType.CUSTOM },
    {
      name: 'language',
      label: '语言',
      type: 'select',
      enumFrom: [CodeLanguage.JAVA],
      defaultValue: CodeLanguage.JAVA,
      description: '当前后端只注册了 JAVA/Groovy 动态工具加载器。',
    },
    { name: 'needConfirm', label: '调用前需人工确认', type: 'switch' },
    { name: 'version', label: '版本号', type: 'text', required: true, defaultValue: '1.0.0' },
    { name: 'inputSchema', label: '输入参数', type: 'tool-schema', wide: true, defaultValue: [] },
    { name: 'classPath', label: '类路径（内置工具）', type: 'text' },
    { name: 'code', label: '工具代码', type: 'textarea', wide: true, defaultValue: toolCodeTemplate },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
  rowActions: [{ label: '调试', renderDialog: (row, onClose) => <ToolDebugDialog tool={row} onClose={onClose} /> }],
}

export const hookDef: ResourceDef<HookRow> = {
  key: 'hook',
  title: 'Hook',
  description: 'Agent 生命周期钩子：类路径或内联代码。',
  api: { ...hooks, usedWith: hooks.usedWithAgent },
  columns: [
    { header: '名称', field: 'name' },
    { header: '类型', field: 'hookType' as never },
    { header: '描述', render: (row) => <span className="line-clamp-1 text-muted-foreground">{row.description}</span> },
    { header: '优先级', field: 'priority' as never },
    usedColumn<HookRow>(),
    enabledColumn<HookRow>(),
  ],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'hookType', label: '类型', type: 'select', enumFrom: Object.values(HookType), defaultValue: HookType.CUSTOM },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'classPath', label: '类路径', type: 'text' },
    { name: 'code', label: '代码', type: 'textarea', wide: true, required: true, defaultValue: hookCodeTemplate },
    { name: 'priority', label: '优先级', type: 'number', defaultValue: 0 },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const promptDef: ResourceDef<SystemPromptTemplateVO> = {
  key: 'prompt',
  title: '提示词模板',
  api: { ...prompts, usedWith: prompts.usedWithAgent },
  searchPlaceholder: '按模板名称搜索',
  columns: [
    { header: '名称', field: 'name' },
    { header: '分类', field: 'category' },
    { header: '引用次数', field: 'usageCount' },
    usedColumn<SystemPromptTemplateVO>(),
    enabledColumn<SystemPromptTemplateVO>(),
  ],
  filters: [{ name: 'category', label: '分类', type: 'text' }],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'category', label: '分类', type: 'text', required: true },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'content', label: '模板内容', type: 'textarea', wide: true, required: true },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const sensitiveDef: ResourceDef<SensitiveWordConfigVO> = {
  key: 'sensitive',
  title: '敏感词配置',
  api: { ...sensitiveWords, usedWith: sensitiveWords.usedWithAgent },
  columns: [
    { header: '名称', field: 'name' },
    { header: '分类', field: 'category' },
    { header: '命中动作', render: (row) => <Badge variant="outline">{row.action}</Badge> },
    { header: '词条数', render: (row) => String(row.words?.length ?? 0) },
    usedColumn<SensitiveWordConfigVO>(),
    enabledColumn<SensitiveWordConfigVO>(),
  ],
  filters: [{ name: 'category', label: '分类', type: 'text' }],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'category', label: '分类', type: 'text', required: true },
    { name: 'action', label: '命中动作', type: 'select', enumFrom: Object.values(SensitiveWordAction), defaultValue: SensitiveWordAction.BLOCK },
    { name: 'replacement', label: '替换文本', type: 'text', placeholder: 'action=REPLACE 时生效' },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'words', label: '敏感词', type: 'tags', wide: true, required: true, placeholder: '输入后按逗号或回车添加' },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const modelProviderDef: ResourceDef<ModelProviderVO> = {
  key: 'model-provider',
  title: '模型供应商',
  description: '供应商连接信息；API Key 只在提交时传输，不回显。',
  api: { ...modelProviders, usedWith: modelProviders.usedWithModel },
  filters: [{ name: 'type', label: '供应商类型', type: 'select', options: [
    { label: 'DashScope', value: 'DASH_SCOPE' },
    { label: 'OpenAI', value: 'OPEN_AI' },
    { label: 'Ollama', value: 'OLLAMA' },
    { label: 'Anthropic', value: 'ANTHROPIC' },
    { label: 'Gemini', value: 'GEMINI' },
    { label: 'OrcaRouter', value: 'ORCA_ROUTER' },
  ] }],
  columns: [
    { header: '名称', field: 'name' },
    { header: '类型', field: 'type' },
    { header: 'Base URL', field: 'baseUrl', className: 'max-w-64 truncate font-mono text-xs' },
    { header: '鉴权', render: (row) => <Badge variant="outline">{row.authType}</Badge> },
    enabledColumn<ModelProviderVO>(),
  ],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'type', label: '类型', type: 'select', required: true, options: [
      { label: 'DashScope', value: ModelProviderType.DASH_SCOPE },
      { label: 'OpenAI', value: ModelProviderType.OPEN_AI },
      { label: 'Anthropic', value: ModelProviderType.ANTHROPIC },
      { label: 'Gemini', value: ModelProviderType.GEMINI },
      { label: 'Ollama', value: ModelProviderType.OLLAMA },
      { label: 'OrcaRouter', value: ModelProviderType.ORCA_ROUTER },
    ] },
    { name: 'baseUrl', label: 'Base URL', type: 'text', required: true },
    { name: 'authType', label: '鉴权方式', type: 'select', enumFrom: Object.values(AuthType), defaultValue: AuthType.CONFIG },
    { name: 'apiKey', label: 'API Key', type: 'password', wide: true, secret: true },
    { name: 'envVarName', label: '环境变量名', type: 'text', placeholder: 'authType=ENV 时读取该环境变量' },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const modelConfigDef: ResourceDef<ModelConfigVO> = {
  key: 'model-config',
  title: '模型配置',
  description: '可选模型与推理参数；上下文窗口与最大输出将用于前端提示。',
  api: { ...modelConfigs, usedWith: modelConfigs.usedWithAgent },
  searchPlaceholder: '按模型名称搜索',
  columns: [
    { header: '名称', field: 'name' },
    { header: 'modelId', field: 'modelId', className: 'font-mono text-xs' },
    { header: '类型', render: (row) => <div className="flex gap-1">{row.modelType?.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}</div> },
    { header: '上下文', field: 'contextWindow' },
    { header: '流式', render: (row) => <Badge variant={row.streaming ? 'default' : 'secondary'}>{row.streaming ? '流式' : '非流式'}</Badge> },
    usedColumn<ModelConfigVO>(),
    enabledColumn<ModelConfigVO>(),
  ],
  form: [
    { name: 'name', label: '名称', type: 'text', required: true },
    { name: 'modelId', label: '模型 ID', type: 'text', required: true, placeholder: '如 qwen-max / gpt-4o' },
    {
      name: 'providerId',
      label: '供应商',
      type: 'select',
      required: true,
      options: [],
      description: '保存前请先在“供应商”页签创建供应商。',
    },
    { name: 'modelType', label: '模型类型', type: 'tags', required: true, defaultValue: [ModelType.CHAT], options: [
      { label: '文本模型', value: ModelType.CHAT },
      { label: '图像模型', value: ModelType.IMAGE },
      { label: '音频模型', value: ModelType.AUDIO },
      { label: '视频模型', value: ModelType.VIDEO },
    ] },
    { name: 'contextWindow', label: '上下文窗口 (tokens)', type: 'number', required: true, defaultValue: 200000, min: 1, max: 1000000, integer: true },
    { name: 'maxTokens', label: '最大输出 (tokens)', type: 'number', required: true, defaultValue: 8192, min: 1, max: 1000000, integer: true },
    { name: 'temperature', label: 'Temperature', type: 'number', required: true, defaultValue: 0.7, min: 0, max: 2 },
    { name: 'topP', label: 'Top P', type: 'number', required: true, defaultValue: 0.9, min: 0, max: 1 },
    { name: 'topK', label: 'Top K', type: 'number', required: true, defaultValue: 50, min: 1, max: 1000, integer: true },
    { name: 'repeatPenalty', label: '重复惩罚', type: 'number', required: true, defaultValue: 1, min: 0, max: 2 },
    { name: 'seed', label: 'Seed', type: 'number', integer: true },
    { name: 'streaming', label: '支持流式', type: 'switch', defaultValue: true },
    { name: 'thinking', label: '支持思考模式', type: 'switch' },
    { name: 'extendConfig', label: '扩展参数 (JSON)', type: 'json', wide: true },
    { name: 'description', label: '描述', type: 'textarea', wide: true, required: true },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
  rowActions: [{ label: '连通性', action: async (row) => {
    try {
      const response = await modelConfigs.check(String(row.id))
      const result = response.data.data
      if (result?.success) toast.success(result.message || '模型连接成功')
      else toast.error(result?.message || '模型连接失败')
    } catch (cause) {
      toast.error(readableError(cause, '模型连通性检查失败'))
    }
  } }],
}

export const memoryDef: ResourceDef<LongTermMemoryConfig> = {
  key: 'long-term-memory',
  title: '长期记忆配置',
  api: { ...longTermMemories, usedWith: longTermMemories.usedWithAgent },
  nonPaged: true,
  columns: [
    { header: '名称', field: 'configName' },
    { header: '记忆类型', field: 'memoryType' },
    enabledColumn<LongTermMemoryConfig>(),
  ],
  form: [
    { name: 'configName', label: '配置名称', type: 'text', required: true },
    {
      name: 'memoryType',
      label: '记忆类型',
      type: 'select',
      required: true,
      options: [
        { label: 'MEM0', value: 'MEM0' },
        { label: 'REME', value: 'REME' },
        { label: 'BAILIAN', value: 'BAILIAN' },
      ],
    },
    { name: 'config', label: '连接配置 (JSON)', type: 'json', wide: true, secret: true, placeholder: '{"endpoint":"...","apiKey":"..."}' },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const codeExecutionDef: ResourceDef<CodeExecutionConfig> = {
  key: 'code-execution',
  title: '代码执行环境',
  api: { ...codeExecutionConfigs, usedWith: codeExecutionConfigs.usedWithAgent },
  nonPaged: true,
  columns: [
    { header: '名称', field: 'configName' },
    { header: '工作目录', field: 'workDir' },
    { header: 'Shell', render: (row) => <Badge variant={row.enableShell ? 'default' : 'secondary'}>{row.enableShell ? '启用' : '关闭'}</Badge> },
    enabledColumn<CodeExecutionConfig>(),
  ],
  form: [
    { name: 'configName', label: '配置名称', type: 'text', required: true },
    { name: 'workDir', label: '工作目录', type: 'text', defaultValue: '.apboa/workspace' },
    { name: 'uploadDir', label: '脚本上传目录', type: 'text', defaultValue: '.apboa/skills' },
    { name: 'autoUpload', label: '自动上传 Skill 文件', type: 'switch' },
    { name: 'enableShell', label: '启用 Shell 工具', type: 'switch', defaultValue: true },
    { name: 'enableRead', label: '启用读取文件工具', type: 'switch' },
    { name: 'enableWrite', label: '启用写入文件工具', type: 'switch' },
    { name: 'command', label: '允许执行的命令', type: 'tags', wide: true, defaultValue: ['python3', 'python', 'node', 'bash', 'sh'] },
    { name: 'enabled', label: '启用', type: 'switch', defaultValue: true },
  ],
}

export const studioDef: ResourceDef<StudioConfig> = {
  key: 'studio',
  title: 'Studio 配置',
  api: { ...studios, usedWith: studios.usedWithAgent },
  nonPaged: true,
  columns: [
    { header: '地址', field: 'url', className: 'font-mono text-xs' },
    { header: '项目', field: 'project' },
  ],
  form: [
    { name: 'url', label: 'Studio 地址', type: 'text', required: true },
    { name: 'project', label: '项目', type: 'text', required: true },
  ],
}

/** 模型配置页需要把供应商列表注入选择框。 */
export async function providerOptions() {
  try {
    const response = await modelProviders.page({ page: 1, size: 100 })
    return response.data.data.records.map((provider) => ({ label: provider.name, value: String(provider.id) }))
  } catch (cause) {
    toast.error(readableError(cause, '供应商列表加载失败'))
    return []
  }
}

export function withProviderOptions(
  def: ResourceDef<ModelConfigVO>,
  options: { label: string; value: string }[],
  providerId?: string | null,
): ResourceDef<ModelConfigVO> {
  return {
    ...def,
    form: def.form.map((field) => (field.name === 'providerId' ? { ...field, options } : field)),
    filters: [
      ...(def.filters ?? []).filter((field) => field.name !== 'providerId'),
      { name: 'providerId', label: '供应商', type: 'select', options },
    ],
    initialFilters: providerId ? { providerId } : undefined,
  }
}
