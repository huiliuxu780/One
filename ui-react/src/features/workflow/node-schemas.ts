import type { WorkflowInputConfig, WorkflowOutputConfig } from '@/types'

export interface WorkflowNodeSchema {
  type: string
  title: string
  group: string
  description: string
  defaultConfig: Record<string, unknown>
  inputConfigs: WorkflowInputConfig[]
  outputConfigs: WorkflowOutputConfig[]
}

const input = (name = 'input', type = 'String'): WorkflowInputConfig[] => [{ name, sourceType: 'NODE_OUTPUT', type: type as WorkflowInputConfig['type'] }]
const output = (type = 'Object'): WorkflowOutputConfig[] => [{ name: 'output', type, description: '节点默认输出' }]
const schema = (type: string, title: string, group: string, description: string, defaultConfig: Record<string, unknown>, inputConfigs = input(), outputConfigs = output()): WorkflowNodeSchema => ({ type, title, group, description, defaultConfig, inputConfigs, outputConfigs })

const javaCode = `package com.hxh.apboa.node.code.load;

import com.hxh.apboa.node.code.CodeExecutor;
import java.util.Map;

public class CodeExecute implements CodeExecutor {
    @Override
    public Object execute(Map<String, Object> inputs) throws Exception {
        return null;
    }
}`

const iterateCode = `package com.hxh.apboa.node.iterate.load;

import com.hxh.apboa.node.iterate.IteratorExecutor;

public class DataProcess implements IteratorExecutor {
    @Override
    public Object doIterate(Object item, Integer index) {
        return item;
    }
}`

/**
 * 迁自 Vue `config/workflow/nodeSchemas.ts` 的纯协议数据。
 * 后端 metadata 只覆盖运行时已注册节点的一部分，不能单独作为前端节点库。
 */
export const workflowNodeSchemas: WorkflowNodeSchema[] = [
  schema('START', '开始', 'basic', '工作流入口，定义请求参数。', { params: [] }, [], []),
  schema('END', '结束', 'basic', '按模板生成最终响应。', { responseTemplate: '${input}', formatterType: 'STRING' }),
  schema('NO_OPERATION', '空操作', 'basic', '不执行操作，仅桥接节点。', {}, [], []),
  schema('IF_ELSE', '条件分支', 'logic', '按顺序评估多个条件分支。', { evaluatorType: 'GROOVY', branches: [{ scope: 'SELF', inputIsNullUse: false, symbol: 'EQ', compareTo: { type: 'CONSTANT', value: '' }, conditionExpression: '', nextNodeId: '' }], elseNextNodeId: '' }),
  schema('ITERATE', '迭代处理', 'logic', '对集合输入逐项执行代码。', { language: 'JAVA', iterateCode }, input(), output('Array')),
  schema('LOOP', '循环节点', 'logic', '按次数或数据源执行子工作流。', { loopVariable: 'loopIndex', maxIterations: 1000, terminationExpression: '', iterateDataSource: '', itemVariable: 'item', entryNodeId: '', subNodes: [], subEdges: [] }),
  schema('NON_EMPTY_SELECT', '非空选择', 'logic', '选择第一个或最后一个非空输入。', { strategy: 'FIRST' }),
  schema('MATCH_RESULT', '结果匹配', 'logic', '按匹配值选择后续节点。', { matches: [], matchType: 'EQUALS', caseSensitive: true, defaultNextNodeId: '' }),
  schema('CACHE_FETCH', '读取缓存', 'cache', '读取 Redis 键值。', { formatterType: 'STRING', cacheId: '', key: '' }),
  schema('CACHE_SET', '写入缓存', 'cache', '写入 Redis 键值。', { formatterType: 'STRING', cacheId: '', key: '', value: '', expire: 0 }, input(), output('Boolean')),
  schema('CACHE_REMOVE', '删除缓存', 'cache', '删除 Redis 键。', { formatterType: 'STRING', cacheId: '', key: '' }),
  schema('CACHE_REFRESH', '刷新缓存', 'cache', '刷新 Redis 键过期时间。', { formatterType: 'STRING', cacheId: '', key: '', expire: 0 }, input(), output('Boolean')),
  ...(['DB_SELECT', 'DB_INSERT', 'DB_UPDATE', 'DB_DELETE'] as const).map((type) => schema(type, { DB_SELECT: '数据库查询', DB_INSERT: '数据库插入', DB_UPDATE: '数据库更新', DB_DELETE: '数据库删除' }[type], 'data', '执行参数化 SQL。', { datasourceId: '', sql: '', params: [], formatterType: 'STRING' })),
  schema('MQ_PUSH', '发送消息', 'message', '向消息队列推送消息。', { mqId: '', topicOrQueue: '', key: '', message: '', messageTemplate: '', templateType: 'STRING' }, input(), output('Boolean')),
  schema('AGENT', '智能体', 'integration', '发起阻塞式 Agent 调用。', { modelConfigId: '', modelParamsOverrideEnabled: false, modelParamsOverride: {}, formatterType: 'STRING', systemPrompt: '', userPrompt: '', skillPackageIds: [], toolIds: [], mcps: [], maxIterations: 5, structuredOutputEnabled: false, structuredOutput: {} }, input(), [{ name: 'output', type: 'Object', description: 'Agent 默认输出' }, { name: 'text', type: 'String', description: 'Agent 文本输出' }, { name: 'structured', type: 'Object', description: 'Agent 结构化输出' }]),
  schema('INTENT_RECOGNITION', '意图识别', 'integration', '使用模型识别意图并路由。', { modelConfigId: '', modelParamsOverrideEnabled: false, modelParamsOverride: {}, systemPromptExtension: '', intents: [], defaultNextNodeId: '' }, input(), [{ name: 'intent', type: 'String', description: '匹配到的意图名称' }]),
  schema('TOOL_EXECUTE', '工具执行', 'integration', '调用平台工具。', { toolId: '', toolName: '' }),
  schema('MCP_CALL', 'MCP 调用', 'integration', '调用 MCP 服务工具。', { mcpServerId: '', mcpToolId: '', mcpServerName: '', mcpToolName: '' }),
  schema('HTTP_EXTERNAL', 'HTTP 请求', 'integration', '调用外部 HTTP API。', { formatterType: 'STRING', connectTimeout: 10, readTimeout: 30, writeTimeout: 30, maxRetries: 3, retryStatusCodes: [], followRedirects: true, syncExecute: true, bodyToObject: true, request: { method: 'GET', contentType: 'JSON', pathParams: [], queryParams: [], headers: [], body: '' } }),
  schema('CODE', '代码执行', 'integration', '执行 Java 或 JavaScript 代码。', { language: 'JAVA', codeSource: javaCode }),
  schema('STRING_SPLIT', '字符串分割', 'transform', '按规则拆分字符串。', { mode: 'SIMPLE', delimiter: ',', delimiters: [], trimParts: true, removeEmpty: true, limit: -1, maxResults: -1, processingResult: true, keyValueDelimiter: '=', keyValueOutputFormat: 'COLON_SEPARATED' }, input(), output('Array')),
  schema('STRING_TEMPLATE', '字符串模板', 'transform', '渲染字符串模板。', { templateType: 'STRING', template: '' }, input(), output('String')),
  schema('SERIALIZE', '序列化', 'transform', '序列化对象。', { mode: 'COMPACT', format: 'JSON', excludeNulls: false, excludeEmptyStrings: false, encoding: 'UTF-8' }, input(), output('String')),
  schema('UNSERIALIZE', '反序列化', 'transform', '反序列化内容。', { format: 'JSON', excludeNulls: false, encoding: 'UTF-8' }),
  schema('LIST_FILTER', '列表过滤', 'list', '过滤列表元素。', { mode: 'SIMPLE', evaluatorType: 'GROOVY', itemIsNullUse: false, condition: '', compareTo: '', simpleSymbol: 'EQ' }, input(), output('Array')),
  schema('LIST_SORT', '列表排序', 'list', '对列表排序。', { evaluatorType: 'GROOVY', condition: '', direction: 'ASC', nullFirst: false, strictMode: false }, input(), output('Array')),
  schema('VARIABLE_AGG', '聚合操作', 'variable', '聚合多个输入。', { strategy: 'MAP', excludeNull: false, splicingSymbol: '' }),
  schema('CONSTANT', '定义常量', 'variable', '用表达式计算常量。', { evaluatorType: 'GROOVY', expression: '' }),
  schema('EMAIL_SEND', '发送邮件', 'channel', '通过 SMTP 渠道发送邮件。', { channelId: '', formatterType: 'STRING', toRecipients: [], ccRecipients: [], subject: '', content: '', contentTemplate: '', syncExecute: true }, input(), output('Boolean')),
  schema('WECOM_SEND', '企微消息', 'channel', '发送企业微信机器人消息。', { channelId: '', formatterType: 'STRING', content: '', contentTemplate: '', mentionMobiles: [], mentionUsers: [], syncExecute: true }, input(), output('Boolean')),
  schema('DINGTALK_SEND', '钉钉消息', 'channel', '发送钉钉机器人消息。', { channelId: '', formatterType: 'STRING', content: '', contentTemplate: '', atMobiles: [], atUserIds: [], isAtAll: false, syncExecute: true }, input(), output('Boolean')),
  schema('FEISHU_SEND', '飞书消息', 'channel', '发送飞书机器人消息。', { channelId: '', formatterType: 'STRING', subject: '', content: '', contentTemplate: '', syncExecute: true }, input(), output('Boolean')),
]

export const workflowNodeSchemaMap = Object.fromEntries(workflowNodeSchemas.map((item) => [item.type, item])) as Record<string, WorkflowNodeSchema>

export function cloneWorkflowNodeDefaults(type: string, nodeId: string) {
  const item = workflowNodeSchemaMap[type]
  if (!item) return { config: {}, inputConfigs: [], outputConfigs: [] }
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  return {
    config: copy(item.defaultConfig),
    inputConfigs: copy(item.inputConfigs),
    outputConfigs: copy(item.outputConfigs).map((outputConfig) => ({ ...outputConfig, fromNodeId: nodeId })),
  }
}
