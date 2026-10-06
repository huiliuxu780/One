/** Agent API 文档静态端点清单（迁移自 Vue AgentConfigApiDoc.vue，内容不变）。 */
export interface ApiDocEndpoint {
  id: string
  method: string
  path: string
  desc: string
  note: string | null
  params: Array<{ name: string; type: string; required: boolean; desc: string }>
  bodyExample: string | null
  responseExample: string | null
}

export const agentEndpoints: ApiDocEndpoint[] = [
  {
    id: 'create-session',
    method: 'POST',
    path: '/api/agent/chat/session',
    desc: '创建新会话',
    note: '创建一个新的对话会话，系统会自动插入根消息并设置 current_message_id。',
    params: [
      { name: 'agentId', type: 'string', required: true, desc: '智能体ID' },
      { name: 'title', type: 'string', required: false, desc: '会话标题，默认"新对话"' }
    ],
    bodyExample: '{\n  "agentId": "123456",\n  "title": "测试对话"\n}',
    responseExample: '{\n  "code": 200,\n  "success": true,\n  "data": {\n    "id": "789",\n    "userId": "1",\n    "agentId": "123456",\n    "title": "测试对话",\n    "isPinned": false\n  }\n}'
  },
  {
    id: 'append-message',
    method: 'POST',
    path: '/api/agent/chat/session/{sessionId}/message',
    desc: '追加消息',
    note: '在当前对话的 current_message_id 后追加新消息，并更新游标。',
    params: [
      { name: 'sessionId', type: 'Long (路径参数)', required: true, desc: '会话ID' },
      { name: 'role', type: 'string', required: true, desc: '消息角色：user / assistant' },
      { name: 'content', type: 'string', required: true, desc: '消息内容' }
    ],
    bodyExample: '{\n  "role": "user",\n  "content": "你好，请帮我分析一下数据"\n}',
    responseExample: '{\n  "code": 200,\n  "success": true,\n  "data": {\n    "id": "10",\n    "sessionId": "789",\n    "role": "user",\n    "content": "你好，请帮我分析一下数据",\n    "depth": 1\n  }\n}'
  },
  {
    id: 'regenerate',
    method: 'POST',
    path: '/api/agent/chat/session/{sessionId}/regenerate',
    desc: '重新生成（新分支）',
    note: '以当前消息为父节点创建新分支消息，适用于重新生成回复的场景。',
    params: [
      { name: 'sessionId', type: 'Long (路径参数)', required: true, desc: '会话ID' },
      { name: 'role', type: 'string', required: true, desc: '消息角色' },
      { name: 'content', type: 'string', required: true, desc: '重新生成的内容' }
    ],
    bodyExample: '{\n  "role": "assistant",\n  "content": "这是重新生成的回复"\n}',
    responseExample: null
  },
  {
    id: 'switch-branch',
    method: 'PUT',
    path: '/api/agent/chat/session/{sessionId}/current?messageId=xxx',
    desc: '切换历史分支',
    note: '仅更新 current_message_id 指针，切换到历史对话分支。不会创建新消息。',
    params: [
      { name: 'sessionId', type: 'Long (路径参数)', required: true, desc: '会话ID' },
      { name: 'messageId', type: 'Integer (查询参数)', required: true, desc: '目标消息ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'current-messages',
    method: 'GET',
    path: '/api/agent/chat/session/{sessionId}/messages/current',
    desc: '获取当前完整对话',
    note: '根据 current_message_id 回溯路径，返回完整的消息链，按深度升序排列。',
    params: [
      { name: 'sessionId', type: 'Long (路径参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: '{\n  "code": 200,\n  "success": true,\n  "data": [\n    { "id": "1", "role": "system", "content": "", "depth": 0 },\n    { "id": "2", "role": "user", "content": "你好", "depth": 1 },\n    { "id": "3", "role": "assistant", "content": "你好！", "depth": 2 }\n  ]\n}'
  },
  {
    id: 'list-sessions',
    method: 'GET',
    path: '/api/agent/chat/session/list',
    desc: '会话列表',
    note: '获取当前用户的会话列表，可按 agentId 筛选，按置顶和更新时间倒序排列。',
    params: [
      { name: 'agentId', type: 'Long (查询参数)', required: false, desc: '按智能体ID筛选' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'page-sessions',
    method: 'GET',
    path: '/api/agent/chat/session/page',
    desc: '分页查询会话',
    note: '支持分页查询，可按 isPinned 筛选置顶会话。',
    params: [
      { name: 'agentId', type: 'Long (查询参数)', required: false, desc: '按智能体ID筛选' },
      { name: 'isPinned', type: 'Boolean (查询参数)', required: false, desc: '按置顶状态筛选' },
      { name: 'current', type: 'Integer (查询参数)', required: false, desc: '页码' },
      { name: 'size', type: 'Integer (查询参数)', required: false, desc: '每页条数' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'session-detail',
    method: 'GET',
    path: '/api/agent/chat/session/{id}',
    desc: '会话详情',
    note: '获取指定会话的详细信息。',
    params: [
      { name: 'id', type: 'Long (路径参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'pin-session',
    method: 'PUT',
    path: '/api/agent/chat/session/{id}/pin',
    desc: '置顶会话',
    note: '将指定会话设为置顶状态。',
    params: [
      { name: 'id', type: 'Long (路径参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'unpin-session',
    method: 'PUT',
    path: '/api/agent/chat/session/{id}/unpin',
    desc: '取消置顶会话',
    note: '取消指定会话的置顶状态。',
    params: [
      { name: 'id', type: 'Long (路径参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'update-title',
    method: 'PUT',
    path: '/api/agent/chat/session/{id}/title?title=xxx',
    desc: '更新会话标题',
    note: '修改指定会话的标题。',
    params: [
      { name: 'id', type: 'Long (路径参数)', required: true, desc: '会话ID' },
      { name: 'title', type: 'String (查询参数)', required: true, desc: '新标题' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'delete-session',
    method: 'DELETE',
    path: '/api/agent/chat/session/{id}',
    desc: '删除会话',
    note: '物理删除会话及其所有消息，操作不可逆。',
    params: [
      { name: 'id', type: 'Long (路径参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'upload-file',
    method: 'POST',
    path: '/api/attach/upload',
    desc: '上传多模态文件',
    note: '文件类型仅支持图片、音频、视频，大小受系统参数限制（默认 5MB）',
    params: [
      { name: 'file', type: 'File (表单字段)', required: true, desc: '上传的文件' }
    ],
    bodyExample: null,
    responseExample: null
  }
]

export const workspaceEndpoints: ApiDocEndpoint[] = [
  {
    id: 'ws-upload',
    method: 'POST',
    path: '/api/runtime/workspace/upload',
    desc: '上传单个文件',
    note: '上传单个文件到工作空间，使用 multipart/form-data 格式提交。',
    params: [
      { name: 'sessionId', type: 'string (表单字段)', required: true, desc: '会话ID' },
      { name: 'file', type: 'File (表单字段)', required: true, desc: '上传的文件' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-upload-batch',
    method: 'POST',
    path: '/api/runtime/workspace/upload/batch',
    desc: '批量上传文件',
    note: '上传多个文件到工作空间，使用 multipart/form-data 格式提交。',
    params: [
      { name: 'sessionId', type: 'string (表单字段)', required: true, desc: '会话ID' },
      { name: 'files', type: 'File[] (表单字段)', required: true, desc: '上传的文件列表' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-upload-archive',
    method: 'POST',
    path: '/api/runtime/workspace/upload/archive',
    desc: '上传压缩包并解压',
    note: '上传压缩包文件到工作空间，系统会自动解压到工作空间目录中。',
    params: [
      { name: 'sessionId', type: 'string (表单字段)', required: true, desc: '会话ID' },
      { name: 'file', type: 'File (表单字段)', required: true, desc: '上传的压缩包文件' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-list-files',
    method: 'GET',
    path: '/api/runtime/workspace/files',
    desc: '获取文件树',
    note: '获取工作空间的文件树结构，返回树形的文件节点列表。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-download',
    method: 'GET',
    path: '/api/runtime/workspace/download',
    desc: '下载单个文件',
    note: '下载工作空间中的指定文件，返回文件流。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' },
      { name: 'fileName', type: 'string (查询参数)', required: true, desc: '文件名' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-download-batch',
    method: 'POST',
    path: '/api/runtime/workspace/download/batch',
    desc: '批量下载文件',
    note: '将指定的多个文件打包成 ZIP 后下载，请求体为文件路径数组。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' },
      { name: 'body', type: 'string[] (请求体)', required: true, desc: '要下载的文件路径列表' }
    ],
    bodyExample: '[\n  "src/main.java",\n  "config/application.yml"\n]',
    responseExample: null
  },
  {
    id: 'ws-download-all',
    method: 'GET',
    path: '/api/runtime/workspace/download/all',
    desc: '下载整个工作空间',
    note: '将工作空间中的所有文件打包成 ZIP 后下载。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-delete-file',
    method: 'DELETE',
    path: '/api/runtime/workspace/file',
    desc: '删除单个文件',
    note: '删除工作空间中指定的文件，操作不可逆。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' },
      { name: 'filePath', type: 'string (查询参数)', required: true, desc: '文件路径' }
    ],
    bodyExample: null,
    responseExample: null
  },
  {
    id: 'ws-clear',
    method: 'DELETE',
    path: '/api/runtime/workspace/clear',
    desc: '清空工作空间',
    note: '清空工作空间下的所有文件，操作不可逆。',
    params: [
      { name: 'sessionId', type: 'string (查询参数)', required: true, desc: '会话ID' }
    ],
    bodyExample: null,
    responseExample: null
  }
]
