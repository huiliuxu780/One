// 视觉验证用轻量 mock：实现试点页所需的最小 console 接口（信封 {code,success,data,msg}）。
// 不属于项目代码；监听 3060（vite services 代理的 console 目标）。
import { createServer } from 'node:http'

const ok = (data) => JSON.stringify({ code: 200, success: true, data, msg: 'ok' })
const page = (records, total = records.length, size = 24) => ({ records, total, size, current: 1, pages: 1 })

const agents = [
  { id: 1, agentType: 'CUSTOM', name: '客服助手 · 小一', agentCode: 'AGT-0042', description: '处理售前售后咨询，接入订单与物流知识库，复杂问题自动转人工并附会话摘要。', enabled: true, tag: '客服', subAgent: ['2', '3'], updatedAt: '2026-10-05T14:32:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
  { id: 2, agentType: 'CUSTOM', name: 'SQL 分析师', agentCode: 'AGT-0057', description: '按自然语言生成并执行只读查询，输出图表与结论，自动校验数据集权限。', enabled: true, tag: '数据分析', subAgent: [], updatedAt: '2026-10-04T09:15:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
  { id: 3, agentType: 'CUSTOM', name: '合同审查', agentCode: 'AGT-0063', description: '抽取采购合同关键条款，标注风险点并给出修订建议，输出审查意见书。', enabled: true, tag: '法务合规', subAgent: ['4', '5', '6'], updatedAt: '2026-09-28T17:40:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
  { id: 4, agentType: 'CUSTOM', name: '运维值班助手', agentCode: 'AGT-0071', description: '聚合告警信息，生成初步排查建议与变更摘要，值班交接一键归档。', enabled: false, tag: '运维', subAgent: [], updatedAt: '2026-09-21T11:02:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
  { id: 5, agentType: 'CUSTOM', name: '内容审校', agentCode: 'AGT-0088', description: '审校公众号稿件，检查错别字、术语一致性与合规表述，保留修改痕迹。', enabled: true, tag: '内容', subAgent: [], updatedAt: '2026-09-18T20:26:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
  { id: 6, agentType: 'A2A', name: '面试助理', agentCode: 'AGT-0094', description: '根据简历生成提问提纲，记录面试要点并产出结构化评价草稿。', enabled: false, tag: '人事', subAgent: [], updatedAt: '2026-09-12T10:08:00', skill: [], workflow: [], tool: [], mcp: [], mcpBindings: [], hook: [], knowledgeBase: [], modelConfigId: '1', modelParamsOverride: null, ragConfig: null, toolChoiceStrategy: 'AUTO', specificToolName: '', systemPromptTemplateId: '', followTemplate: false, systemPrompt: '', sensitiveWordConfigId: '', sensitiveFilterEnabled: false, maxIterations: 8 },
]

const dashboards = [
  { id: 1, name: '运营日报', remark: '会话量、转人工率与延误单，每日 08:00 推送值班群', version: 'v3', isDefault: true, enabled: true, config: { version: 1, panels: [] } },
  { id: 2, name: '客服质量周报', remark: '按坐席统计解决率与平均轮次，周一生成', version: 'v2', isDefault: false, enabled: true, config: { version: 1, panels: [] } },
  { id: 3, name: '模型成本月报', remark: '分模型 token 消耗与费用，含环比', version: 'v1', isDefault: false, enabled: false, config: { version: 1, panels: [] } },
]

const datasets = [
  { id: 1, name: 'delay_orders_7d', type: 'SQL', shared: true, enabled: true, sqlText: 'SELECT node, COUNT(*) AS c FROM logistics WHERE delayed = 1 GROUP BY node', remark: '延误单按节点聚合' },
  { id: 2, name: 'session_quality', type: 'SQL', shared: false, enabled: true, sqlText: 'SELECT agent, resolved_rate FROM chat_quality WHERE week = CURRENT', remark: '会话解决率' },
  { id: 3, name: 'model_cost', type: 'HTTP', shared: false, enabled: false, httpConfig: { url: 'https://billing.internal/monthly' }, remark: '模型费用环比' },
]

const sessions = [
  { id: 101, userId: '1', agentId: '1', currentMessageId: 'm4', title: '订单 8842 的物流异常咨询', isPinned: false, pinTime: null, messageTable: null, createdAt: '2026-10-06T14:31:00', updatedAt: '2026-10-06T14:33:00' },
  { id: 102, userId: '1', agentId: '1', currentMessageId: null, title: '退款流程与时效说明', isPinned: false, pinTime: null, messageTable: null, createdAt: '2026-10-06T11:07:00', updatedAt: '2026-10-06T11:09:00' },
  { id: 103, userId: '1', agentId: '2', currentMessageId: null, title: 'Q3 客服会话质量摘要', isPinned: false, pinTime: null, messageTable: null, createdAt: '2026-10-06T09:41:00', updatedAt: '2026-10-06T09:44:00' },
  { id: 104, userId: '1', agentId: '3', currentMessageId: null, title: '采购合同风险点初筛', isPinned: false, pinTime: null, messageTable: null, createdAt: '2026-10-05T18:44:00', updatedAt: '2026-10-05T18:50:00' },
]

const messages = [
  { id: 'm1', sessionId: 101, role: 'user', content: '订单 8842 客户催了两次，查一下物流卡在哪里，给客户一个可以回复的说法。', parentId: null, path: 'm1', depth: 1, createdAt: '2026-10-06T14:31:00' },
  { id: 'm2', sessionId: 101, role: 'assistant', content: '订单 8842 卡在杭州转运中心，已滞留 46 小时，超出我们承诺的 24 小时转运时效。可以直接这样回复客户：\n\n1. 承认延误并致歉，说明包裹目前在杭州转运中心加急处理；\n2. 给出新的预计送达时间：10 月 8 日前；\n3. 按话术库「延误补偿」口径附 10 元无门槛券，无需客户主动索要。\n\n若客户今天 18:00 前再次催促，建议直接转人工，避免二次延误投诉。', parentId: 'm1', path: 'm1/m2', depth: 2, createdAt: '2026-10-06T14:31:40' },
  { id: 'm3', sessionId: 101, role: 'user', content: '把最近七天同类延误的订单也拉出来，看看是不是杭州线路的普遍问题。', parentId: 'm2', path: 'm1/m2/m3', depth: 3, createdAt: '2026-10-06T14:32:10' },
  { id: 'm4', sessionId: 101, role: 'assistant', content: '是普遍问题，不是个案。最近七天 37 单延误里 29 单经过杭州转运中心，平均滞留 39 小时；其余 8 单分散在 5 个节点，均低于 12 小时。\n\n建议把杭州线路的承运商预警阈值从 24 小时调到 18 小时，并在今日值班交接里标注；需要的话我可以起草给承运商的工单。', parentId: 'm3', path: 'm1/m2/m3/m4', depth: 4, createdAt: '2026-10-06T14:33:02' },
]

const loginResponse = {
  accessToken: 'mock-access-token',
  accessTokenTTL: '2099-01-01T00:00:00Z',
  refreshToken: 'mock-refresh-token',
  refreshTokenTTL: '2099-01-01T00:00:00Z',
  needSelectTenant: false,
  blocked: false,
  userDetail: { id: '1', name: '林悦', username: 'admin', email: 'admin@apboa.local', tenantId: '1', tenantCode: 'default', tenantRole: 'TENANT_OWNER', tenantName: '林悦的工作空间' },
}

const wfConfig = {
  nodes: [
    { id: 'n_start', type: 'START', name: '开始', position: { x: 80, y: 160 }, config: {} },
    { id: 'n_agent', type: 'AGENT', name: '客服助手 · 小一', position: { x: 360, y: 140 }, config: { agentId: '1' } },
    { id: 'n_end', type: 'END', name: '结束', position: { x: 640, y: 160 }, config: {} },
  ],
  edges: [
    { id: 'e1', source: 'n_start', target: 'n_agent' },
    { id: 'e2', source: 'n_agent', target: 'n_end' },
  ],
  viewport: { x: 40, y: 40, zoom: 1 },
  metadata: { schemaVersion: '1', updatedAt: '2026-10-05T10:00:00' },
}

const workflows = [
  { id: 1, name: '延误工单自动起草', remark: '物流延误超阈值时起草承运商工单并通知值班', routeId: 'route-delay', status: 'PUBLISHED', version: 'v2', enabled: true, config: wfConfig, locked: 0, updatedAt: '2026-10-05T10:00:00' },
  { id: 2, name: '值班交接摘要', remark: '每日 18:00 聚合告警与变更生成交接摘要', routeId: 'route-handover', status: 'DRAFT', version: 'v1', enabled: false, config: wfConfig, locked: 0, updatedAt: '2026-09-30T18:02:00' },
  { id: 3, name: '合同风险升级', remark: '审查发现高风险条款时升级法务并建任务', routeId: 'route-legal', status: 'PUBLISHED', version: 'v4', enabled: true, config: wfConfig, locked: 0, updatedAt: '2026-09-27T09:12:00' },
]

const routes = [
  ['POST', /^\/auth\/login$/, () => loginResponse],
  ['POST', /^\/auth\/logout$/, () => true],
  ['GET', /^\/agent\/definition\/page$/, () => page(agents)],
  ['GET', /^\/agent\/definition\/get\/tags$/, () => ['客服', '数据分析', '法务合规', '运维', '内容', '人事']],
  ['GET', /^\/dashboard\/page$/, () => page(dashboards, 3, 10)],
  ['GET', /^\/dashboard\/dataset\/page$/, () => page(datasets, 3, 10)],
  ['GET', /^\/agent\/chat\/session\/list$/, () => sessions],
  ['GET', /^\/agent\/chat\/session\/page$/, () => page(sessions, 4, 10)],
  ['GET', /^\/agent\/chat\/session\/\d+\/messages\/current$/, () => messages],
  ['GET', /^\/agent\/chat\/session\/\d+\/messages\/paged$/, () => ({ messages, hasMore: false, nextBeforeDepth: null })],
  ['GET', /^\/agent\/chat\/session\/\d+\/messages\/tree$/, () => messages],
  ['GET', /^\/workflow\/page$/, () => page(workflows, 3, 10)],
  ['GET', /^\/workflow\/\d+$/, () => ({ workflow: workflows[0], resources: {} })],
  ['POST', /^\/workflow\/\d+\/validate$/, () => ({ valid: true, errors: [], warnings: [] })],
]

createServer((req, res) => {
  console.log(req.method, req.url); const path = (req.url ?? "/").split('?')[0].replace(/^\/api/, '')
  const hit = routes.find(([method, re]) => method === req.method && re.test(path))
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.end(ok(hit ? hit[2]() : null))
}).listen(3060, '127.0.0.1', () => console.log('mock-api on 3060'))
