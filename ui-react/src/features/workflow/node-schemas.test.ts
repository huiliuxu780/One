import { describe, expect, it } from 'vitest'
import { cloneWorkflowNodeDefaults, workflowNodeSchemaMap, workflowNodeSchemas } from './node-schemas'

describe('workflow node schema parity', () => {
  it('keeps every non-knowledge Vue node type available in React', () => {
    expect(workflowNodeSchemas).toHaveLength(35)
    for (const type of ['NO_OPERATION', 'INTENT_RECOGNITION', 'TOOL_EXECUTE', 'MCP_CALL', 'CONSTANT', 'EMAIL_SEND', 'WECOM_SEND', 'DINGTALK_SEND', 'FEISHU_SEND']) {
      expect(workflowNodeSchemaMap[type], type).toBeDefined()
    }
    expect(workflowNodeSchemaMap.KNOWLEDGE_RETRIEVE).toBeUndefined()
  })

  it('creates independent protocol defaults including inputs and node-bound outputs', () => {
    const first = cloneWorkflowNodeDefaults('AGENT', 'agent-1')
    const second = cloneWorkflowNodeDefaults('AGENT', 'agent-2')
    expect(first.inputConfigs[0]).toMatchObject({ name: 'input', sourceType: 'NODE_OUTPUT' })
    expect(first.outputConfigs.map((item) => item.fromNodeId)).toEqual(['agent-1', 'agent-1', 'agent-1'])
    expect(second.outputConfigs.map((item) => item.fromNodeId)).toEqual(['agent-2', 'agent-2', 'agent-2'])
    first.config.maxIterations = 99
    expect(second.config.maxIterations).toBe(5)
  })

  it('includes resource selectors and required business fields in defaults', () => {
    expect(cloneWorkflowNodeDefaults('DB_SELECT', 'db').config).toMatchObject({ datasourceId: '', sql: '', params: [] })
    expect(cloneWorkflowNodeDefaults('CACHE_SET', 'cache').config).toMatchObject({ cacheId: '', key: '', value: '', expire: 0 })
    expect(cloneWorkflowNodeDefaults('DINGTALK_SEND', 'channel').config).toMatchObject({ channelId: '', isAtAll: false })
  })
})
