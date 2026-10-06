# React 前端功能对齐矩阵（FRONTEND_PARITY_AUDIT）

更新日期：2026-10-06
基线：分支 `codex/react-migration`，Vue 源码保留在 `ui/`，React 位于 `ui-react/`。

## 目的与使用方式

本文是"旧 Vue 中所有保留范围内可达的前端功能在 React 中真实可用"的逐项核对矩阵，不是进度声明。每项必须处于以下状态之一：

- **已验证**：React 真实实现，且有真实后端/浏览器验证证据（见 MIGRATION.md 各节或本文备注）。
- **已迁移未验证**：React 已实现真实接口，等待本轮浏览器/后端回归。
- **明确排除**：用户明确不迁移（知识库、本地 RAG、多租户组织管理、独立 Agent Team）。
- **旧版假功能**：旧 Vue 无后端支撑的静态假功能，React 按诚实方式处理。
- **缺失**：React 尚无等价实现，是待办缺口。
- **死代码**：旧 Vue 存在代码但经调用链证明不可达，不迁移。

## 1. 平台与外壳

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `layout/`、`components/layout/` | 侧栏导航、用户菜单、退出 | 无/`auth` | `app-shell.tsx` | 已迁移未验证 | 左侧导航已确认可纵向滚动；部署后的“账号设置”菜单已跳到 `/react/settings?tab=accounts`。菜单按能力隐藏，后端权限为最终边界；退出登录本轮未重测 |
| `pages/Login.vue` | 登录、Token 刷新 | `/api/auth/login`、refresh | `login-page.tsx`、`client.ts` | 已验证 | 登录响应必须含默认租户 `tenantId=1`；401 单飞刷新有 MSW 单测 |
| 路由守卫 | 未登录跳登录 | — | `protected-route.tsx` | 已验证 | 登录后进入应用（Vue 登录后固定跳 dashboard，不回跳深链；React 行为一致） |
| 403/404/500 | 错误页 | — | `error-pages.tsx` | 已验证 | 404 文案已去除"尚未迁移"过时表述 |
| — | — | — | `/register` → `auth-availability-page.tsx` | 已验证 | 生产深链显示默认组织关闭自助注册；Vue 页面原为无后端接口的虚假占位 |
| — | — | — | `/forgot-password` → `auth-availability-page.tsx` | 已验证 | 生产深链明确要求管理员重置；不再模拟验证码成功 |
| `views/ChatCluster/` | ChatKey 分享入口 | ChatKey API | `communication-page.tsx` | 已验证 | key 换临时令牌后进入对话 |
| `src/doc/`、`/web/doc` | 使用手册 | 静态 MD | `docs-page.tsx` | 已验证 | 13 个非知识库章节；知识库章节按排除范围删除 |

## 2. Agent 管理

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Agent/index.vue` | 列表、搜索、过滤、分页 | `/api/agent/definition/page`、`/get/tags` | `agents-page.tsx` | 已验证 | — |
| `components/agent/` | 新建/编辑/复制/删除/启停 | definition CRUD + used-with-agent | `agents-page.tsx`、`features/agents/` | 已验证 | 占用检查删除；`knowledgeBase`/`ragConfig` 兼容字段透传不写入 |
| Agent 编辑器页签 | 模型/提示词/工具技能MCP/Hook/敏感词/子Agent/工作流/高级 | 对应资源 API | `agent-editor.tsx` | 已验证 | 子 Agent 真实委派已通过；外部 A2A 待凭据 |
| A2A 配置 | WellKnown/Nacos/连通性 | `/api/agentA2a` | `agent-editor.tsx` | 已迁移未验证 | 外部端点验收受凭据限制 |
| Chat Key | 生成/刷新分享 key | `/api/agent/chat-key/{id}` | `agents-page.tsx` | 已验证 | — |
| API 文档、统计、调度 | 页签查看 | statistics/job API | `agent-editor.tsx` | 已验证 | 真实 Agent 详情中 API/Chat Key 请求体、12 个会话/24 条消息统计、会话历史和 Quartz 调度表单均已加载；控制台 0 错误 |
| 知识库绑定 | 表单选择 | knowledge API | 无 | 明确排除 | Spec 2.2；提交适配器不清空后端兼容字段 |

## 3. 聊天

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Chat/` | 会话列表、置顶、重命名、删除 | `chatSession` API | `chat-page.tsx`、`chat-store.ts` | 已验证 | — |
| AG-UI 流 | 流式文本/推理/工具/状态补丁/停止/重连 | `runtime/agui/run/{code}` SSE | `chat-runtime.ts`、`agent-client.ts` | 已验证 | SSE 解析器与 Vue 一致；停止、刷新恢复、reconnect 回放通过 |
| HITL | 工具确认允许/拒绝/刷新恢复 | resume | `chat-page.tsx` | 已验证 | 双分支均实测 |
| 子 Agent | 委派/事件时间线 | AG-UI 事件 | `chat-page.tsx` | 已验证 | 父子 trace 渲染 SUCCESS 事件 |
| 附件 | 上传/删除/文档解析/大小类型校验 | `/api/attach/upload`、`parse-text` | `chat-page.tsx` | 已验证 | React 额外做 30MB 前端校验；Vue 前端无大小校验 |
| 附件前缀协议 | 发送含附件消息 | `{"files":[...]}@==##::::##==@` + `fileIds` | `chat-page.tsx` `messageWithFiles` | 已验证 | 分隔符与 Vue `FILE_SEP` 一致 |
| @mention 工作空间文件 | `@` 插入文件标签 | `GET /api/runtime/workspace/files?sessionId=` | `features/chat/mention*` | 已验证 | 真实工作空间上传 README 后，`@` 下拉选择、协议标签发送、消息徽标和点击预览均通过 |
| @mention Agent 工具 | `@` 插入工具标签 | `GET /api/agent/definition/{id}/enabled/tools` | 同上 | 已验证 | 标签内容 = `toolId`；数据源、插入与协议解析已有单测和真实下拉回归 |
| @mention Agent 技能 | `@` 插入技能标签 | `GET /api/agent/definition/{id}/enabled/skills` | 同上 | 已验证 | 标签内容 = 技能包 `name`；展示 alias；含 2 个内置技能；真实模型已解析技能内容 |
| 下拉交互 | 搜索过滤、↑↓/Enter/Esc 键盘、分类分组 | 无（前端过滤） | `mention-dropdown.tsx` | 已验证 | Vue 为主页+文件夹二级页；React 为平铺分组；键盘行为由组件测试覆盖，真实文件点击选择通过 |
| 标签插入/删除 | 光标处插入协议标签；Backspace 整块删除 | 无 | `chat-page.tsx` | 已验证 | React 用 textarea 呈现协议原文（所见即发送）；协议文本逐字节一致；整块删除与 IME 行为有测试 |
| 消息标签渲染 | 用户消息还原标签徽标 | 无 | `tagged-text.tsx` | 已验证 | 等价 Vue `TaggedContentRenderer`；未注册标签退化纯文本；真实消息渲染通过 |
| 消息内文件标签点击预览 | 打开文件预览弹层 | workspace download | `file-preview-dialog.tsx`、`tagged-text.tsx` | 已验证 | 真实工作空间 README 经消息标签点击后下载 Blob，并在弹层显示文本；支持图片、PDF、音视频，未知格式诚实提示下载 |
| 附件点击预览 | MediaPreview 弹层 | attach download | `file-preview-dialog.tsx`、`chat-page.tsx`、`chat-history-page.tsx` | 已验证 | 输入区、已发送消息、历史消息三处均用真实附件 ID 下载并预览；README 上传→解析→发送→历史恢复全链路通过 |
| 上下文压缩指示 | 圆环+分级变色+tooltip | AG-UI state | `ContextUsageIndicator` | 已验证 | 对齐 Vue 绿/黄/橙/红四档水位、压缩中琥珀色脉冲与旋转图标；tooltip 完整展示 Token、消息、上限和触发因素，阈值与文案有单测 |
| 大文件分片上传 | — | `/api/attach/chunk-upload` | 无 | **死代码** | 证据：`ui/src/chunkfile/index.ts` 完整实现但全仓库零引用；`uploadChunk`（`ui/src/api/attach.ts:66-76`）仅被该死代码调用；聊天附件实际走单文件 `/api/attach/upload`。不迁移 |
| `views/ChatHistory/` | 历史会话/消息树/分支切换/编辑当前消息 | session page/messages | `chat-history-page.tsx` | 已验证 | — |
| `views/ChatHistory/:agentId` | 按智能体过滤 | pageSessions `agentId` | `chat-history-page.tsx` | 已验证 | Vue 原路径 `/chat/history/:agentId` 与 React 别名 `/chat-history/:agentId` 均转为查询参数；生产显示过滤条 |

## 4. 工作空间

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `components/workspace/` | 上传（单/批/压缩包）、树、删除、清空 | workspace API | `workspace-page.tsx` | 已验证 | 容量与后端一致；LICENSE 下载 SHA-256 校验通过 |
| 下载 | 单/批/全部 | download/batch/all | `workspace-page.tsx` | 已验证 | — |
| 预览 | 文本/图片/音视频/PDF | download | `workspace-page.tsx`、`file-preview-dialog.tsx` | 已验证 | 真实 README 文本预览通过；媒体/PDF 分支沿用同一 Blob URL 预览器，构建与类型检查覆盖 |

## 5. 资源管理（Models/Skills/Tools/MCP/Hook/Prompt/Sensitive/Memory/CodeExec/Studio）

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Model/` | 供应商/模型 CRUD、连通性测试、密钥留空不修改 | model API | `model-page.tsx` | 已迁移未验证 | DashScope OpenAI 兼容模式两模型曾连接成功；补齐供应商类型选择与默认 URL、模型类型枚举选择、Vue 新建默认参数及鉴权模式的条件校验。本轮再补必填数值、Vue 数值范围和 Seed 数字输入的提交前校验；保存行为待回归 |
| `/model/:providerId/config` 深链 | 打开供应商下的模型配置 | — | `?providerId=` | 已验证 | 旧重定向误入供应商页签已修复；部署后的页面确认显示该供应商下两条真实模型，本地新建表单预选该供应商；模型保存仍属上一行未验证范围 |
| `views/Skill/` | 新建/导入（本地/Git/ZIP）/文件树编辑/工具关联/下载/同步/分类筛选/启停 | skill API | `skill-page.tsx`、`skill-hub-sheet.tsx` | 已迁移未验证 | 真实后端当前技能列表为空，未形成文件树和启停的真实操作回归。后续审计修复表单重开旧值、空名称提交、Git Token 草稿清理；文件管理增加子目录新建/上传、未保存切换与离开提示、扩展名和 500 KB 限制、鉴权下载与同步状态；SkillHub 补来源/分类/排序筛选，浏览器用真实市场数据验证分类从混合结果缩为开发编程结果。工具关联原把业务 `toolId` 提交给后端 `List<Long>`，现改为记录 `id`。再核对后端发现普通 `PUT /api/skill` 会先删除所有工具关联，故 React 编辑和启停现先取最新详情并带 `tools` 更新；Vue 启停路径也存在同类潜在缺陷。工具关联保存、元数据编辑和启停尚待真实数据回归，已有协议测试 |
| `/skill/new` 深链 | 打开新建弹窗 | — | `?action=new` | 已验证 | 生产深链打开新建技能弹窗；Vue 是整页+弹窗，React 等价为弹窗 |
| `/skill/hub` 深链 | 打开 SkillHub | — | `?hub=1` | 已验证 | 生产深链打开真实 SkillHub 列表；React 为 Sheet，搜索/导入一致 |
| `/skill/:id/edit` 深链 | 打开指定技能编辑 | `/api/skill/{id}`、`/tree` | `?edit=ID` → 文件管理 Sheet | 已验证 | Vue 为整页文件树+Monaco；React 为文件树+CodeMirror Sheet，无效 ID 显示后端明确错误而非静默空壳 |
| `views/Tool/` | CRUD、代码编辑、调试、分类/类型筛选、启停 | tool API | `resource-pages.tsx` | 已迁移未验证 | 调试和分类筛选已在真实 Tool 验证，本地启停往返并恢复原状态。本轮补齐输入参数结构化编辑、排序、版本号与代码模板；部署后的真实 Tool 编辑表单已加载 Schema 和版本号，新增/编辑提交尚待真实后端回归 |
| `views/Mcp/` | CRUD、激活、同步、工具治理、调试、协议筛选、启停 | mcp API | `mcp-page.tsx` | 已迁移未验证 | 补齐分页搜索、协议筛选与引用提醒后的启停；按 HTTP/SSE、STDIO 协议配置 URL/查询参数/Header 或命令/参数/环境变量/工作目录/编码，并补自动降级失败次数、打开时重置状态及编辑时敏感值留空保留。继续核对后端 DTO 发现工具治理原提交 `toolName` 而后端需要 `List<Long>` 工具记录 ID，调试原提交 `serverId/toolName/arguments` 而后端需要 `toolId/input`；现已改正，按 JSON Schema 呈现调试表单、必填和类型校验、原始失败信息，补工具搜索及自动降级只读限制，组件测试覆盖。浏览器只验证过 Server 表单切换和重开，真实工具治理/调试仍待验收。Vue 把 timeout 标为毫秒、默认 30000；后端三个客户端均用 `Duration.ofSeconds(timeout)`，React 因此以秒标注并默认 30，属于源实现矛盾而非照搬差异 |
| `/mcp/:serverId/tools` 深链 | 打开指定 Server 工具治理 | `/api/mcp/server/{id}`、`/tools` | `?tools=ID` | 已验证 | 生产深链已回归；无效 ID 显示后端明确错误（Vue 静默空态） |
| `views/Hook/`、`views/Prompt/`、`views/Sensitive/` 等 | CRUD/占用检查/筛选/启停 | 对应 API | `resource-pages.tsx` | 已迁移未验证 | 已加占用二次确认和详情加载；本轮补齐 Vue 必填字段、敏感词替换文本校验和多值输入。本地浏览器确认 `alpha,beta` 成为两枚独立词项且未提交；部署后 Hook/Prompt/Sensitive 各自对未占用演示记录启停往返成功并恢复原状态，逐资源保存待回归 |
| 长期记忆配置 | MEM0/ReMe/百炼专属字段、记忆控制模式、保存 | long-term-memory API | `memory-form.tsx` | 已迁移未验证 | 旧 React 仅提供原始 JSON，现按 Vue 协议构建 `config`；真实后端已打开现有 MEM0 编辑表单并验证密钥不回显，三个类型的字段和序列化单测通过，保存及外部连接未验证 |
| 代码执行配置与 Studio | 配置 CRUD、占用检查及 Agent 选择 | code-execution/studio API | `resource-pages.tsx` | 已迁移未验证 | 对照 Vue 表单字段、默认值和接口路径做静态核对；React 代码执行页额外开放了 Vue 隐藏的目录/自动上传字段。真实保存、引用阻止删除及 Agent 使用未回归 |
| `views/Mcp/`、`views/Skill/`、`views/Workflow/`、`views/Automation/` | 列表搜索、类型筛选 | 各分页 API | 对应 React 页 | 已迁移未验证 | 审计发现若搜索词未并入 `usePagedList` 查询键，请求不会触发；已修正 MCP/Skill/Workflow/Automation，工作流真实列表从四条缩至一条；其余待回归 |
| 密钥字段 | 留空不修改语义 | — | 各表单 | 已验证 | 后端密文不回显；模型供应商新建 CONFIG 鉴权需填 API Key，编辑时可留空保留原值 |

## 6. 自动化

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Automation/` | 列表、CRUD、启停、手动触发、记录、搜索与类型筛选 | `/api/runtime/job/*` | `automation-page.tsx` | 已迁移未验证 | Agent/Workflow 两类真实触发先前通过；本轮修复类型筛选，真实后端由两条缩为一条；失败审计受后端 schema 限制 |
| `/automation/new` 深链 | 打开新建表单 | — | `?action=new` | 已验证 | 生产深链打开 Agent/Workflow 目标表单；Vue 为整页，React 为弹窗 |
| `/automation/:id/edit` 深链 | 加载任务编辑 | `/api/runtime/job/{id}` | `?edit=ID` | 已验证 | 无效 ID 显示“任务不存在或已被删除” |
| `/automation/:id/records` 深链 | 打开执行记录 | job/{id}、job/records | `?records=ID` | 已验证 | 无效 ID 诚实提示任务不存在；真实 Agent/Workflow 记录已在主页面验收 |

## 7. 工作流

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Workflow/` | 列表、搜索、复制、锁定、删除、强制删除 | workflow API | `workflow-page.tsx` | 已迁移未验证 | 分页搜索在部署后从四条真实记录缩为一条；复制/锁定/删除等写操作待逐项回归 |
| `/workflow/new` 深链 | 创建进入编辑器 | workflowSave | `?create=1` → 创建一次 → `/workflow/{id}/edit` | 已迁移未验证 | Vue 打开未保存草稿画布（保存时才创建、无防重）；React 架构要求先建后编，深链严格防重复创建。行为差异已在备注声明 |
| `/workflow/:id` 深链 | 打开编辑器 | — | 重定向 `/workflow/{id}/edit` | 已验证 | 生产深链完成重定向；不存在 ID 保持在编辑器加载/错误链路，不伪造内容 |
| `components/workflow/` | React Flow 画布、节点配置、校验、保存、发布、版本、调试 | workflow/workflowResources API | `workflow-editor-page.tsx` | 已验证 | toBackendDefinition round-trip 单测；回声流程发布/运行通过 |
| 高级节点矩阵 | 分支/循环/DB/MQ/Channel 运行 | — | 同上 | 已迁移未验证 | 高级节点成功矩阵缺失（REMAINING_SPEC §8.5） |
| 知识库节点 | — | — | 只读提示不改写 | 明确排除 | 加载旧流程不静默改写 |
| `views/WorkflowResources/` | Datasource/Cache/MQ/Channel CRUD | workflowResources API | `workflow-resources-page.tsx` | 已迁移未验证 | 密码留空不修改；本轮纠正编辑弹窗连接检查误测“已保存配置”，现发送当前表单，列表检查仍测已保存配置，API 路径有单测。四类资源真实连接/保存仍待验收 |

## 8. 工作台与 API 服务

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Dashboard/` | 看板 CRUD/默认项/启停、数据集真实执行、设计器、历史版本 | dashboard API | `dashboard-page.tsx` | 已验证 | 错误原文直接展示 |
| `/dashboard/design`、`/dashboard/dataset-manage` 深链 | 打开设计器/数据集 | — | 重定向 Dashboard/`?tab=datasets` | 已验证 | 对照 Vue 路由源码回归；另补 `/dataset-manage` 兼容别名。React 设计器在工作台内打开，数据集落对应页签 |
| `views/ApiService/` | 应用/API CRUD、上下线、日志 | `/api/gateway/*` | `api-service-page.tsx` | 已验证 | 真实上线/调用/日志/下线通过 |
| `/api-service/new` 深链 | 打开新建 API | — | `?tab=apis&action=new` | 已验证 | 回归发现动作处理后清空 query 会卸载 API 页签，已修复为保留 `tab=apis`；弹窗实际可见且不提前创建数据 |
| `/api-service/:id/edit` 深链 | 加载 API 编辑 | `/api/gateway/api/{id}` | `?tab=apis&edit=ID` | 已验证 | 修复后保持 API 页签；无效 ID 显示后端明确错误 |
| `/api-service/logs`、`/apps` 深链 | 打开对应页签 | — | `?tab=logs`/`?tab=apps` | 已验证 | 生产日志页显示真实 200 调用记录，应用页显示真实应用列表 |
| `views/Review/` | Agent/Workflow 审查 | 无审查 API | `review-page.tsx` | 旧版假功能 | 诚实空态，不伪装 |

## 9. 设置与运维

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `components/settings/` 账号 | 列表、新建、启用切换、重置密码（MD5）、删除 | `/api/account/*`、`/api/auth/admin/create-account` | `settings-page.tsx` | 已迁移未验证 | 新建加入当前默认租户（后端从 token 注入）；前端禁止删除当前账号，后端另有管理员保护 |
| `/settings/account` 等深链 | 打开对应页签 | — | `?tab=` 重定向 | 已验证 | 生产矩阵覆盖 account/system-params/api-keys/system-intro |
| `/settings/tenant*` 深链 | 组织管理 | — | 重定向回设置 | 明确排除 | 多租户操作页排除 |
| API Key | 创建一次性展示完整值 | `/api/sk/*` | `settings-page.tsx` | 已验证 | — |
| 系统参数 | CRUD | `/api/params/*` | `settings-page.tsx` | 已验证 | — |
| 系统介绍 | 查看 | 静态 | `SystemIntroTab` | 已验证 | 生产深链打开；内容适配单默认租户、无知识库/本地 RAG 的真实范围 |
| 个人资料/修改密码 | 查看/更新 | account API | `profile-page.tsx`、`change-password-page.tsx` | 已验证 | MD5 后提交与 Vue 一致 |
| `views/Ops/` 节点监控 | 执行节点/WS 节点 15s 轮询 | heartbeat API | `ops-page.tsx` | 已验证 | — |
| `/ops/monitor`、`/ops/storage` 深链 | 打开页签 | — | `?tab=` 重定向 | 已验证 | 生产矩阵分别落执行节点与存储配置页签 |
| 存储配置 | 新增/编辑/删除/协议配置（S3/FTP/LOCAL）/设为唯一启用 | `/api/storage/*` | `ops-page.tsx` StorageTab | 已验证 | 真实创建并启用 LOCAL 配置；目录指向共享卷后，Console 上传→Runtime 解析链路通过。默认目录改为 `.apboa/storage`，避免容器私有 `/home`。secret 留空保留后端值 |
| `FileManager.vue` 附件 | 分页/单个下载/删除 | `/api/attach/page`、download、delete | `ops-page.tsx` FilesTab | 已验证 | 真实 README 列表与单文件下载成功，下载反馈与后端 DOWNLOAD 日志一致；删除日志已有真实记录。Vue 同步 revokeObjectURL，React 延迟 10s 回收更稳妥 |
| 批量下载 | 多选打包下载 | `/api/attach/batchDownload` | `ops-page.tsx` | 已验证（React 增强） | 真实勾选 README 后按钮启用并完成请求，无错误反馈或控制台错误；**Vue 中该 API 无任何 UI 调用**，React 补充真实接口入口 |
| `FileLog.vue` | 日志分页/类型过滤 | `/api/attach/log/page` | `ops-page.tsx` FileLogsTab | 已验证 | 真实后端展示 README 的上传、下载、删除记录及操作人/时间 |
| 大文件分片上传 | — | chunk-upload | 无 | 死代码 | 见 §3 |

## 10. 明确排除项核对

| 排除项 | React 核对结果 |
| --- | --- |
| 知识库列表/配置/文档管理 | 无路由、无入口、无表单字段 |
| 本地 RAG 管理与检索测试 | 无；Runtime 使用 `VECTOR_STORE_TYPE=none` |
| 组织切换/发现/申请/审批/管理 | 无入口；`/settings/tenant*` 深链重定向回设置页并说明 |
| 独立 Agent Team 系统 | 未新建 |
| 后端租户上下文/鉴权/隔离 | 保留，前端固定默认租户但不绕过 |

## 11. 待办（按优先级）

1. 继续逐页检查保存协议、表单字段、页面内动作和旧深链。已发现并修复的筛选、启停和资源表单缺口仍需覆盖各资源的真实浏览器回归，不能据此宣布全部迁移完毕。特别是 Tool/模型/长期记忆写入、工作流资源四类连接、账号管理和无现有数据的 Skill/MCP。
2. 高级工作流节点成功运行矩阵、外部 A2A/第三方 MCP 集成凭据验收（REMAINING_SPEC §8）仍缺证据。
3. 非 Chromium 浏览器兼容性与并发容量仍未形成证据，不能从单浏览器、单用户开发验收外推。
4. MCP 服务配置现已按后端秒数单位输入，Vue 页面默认值 30000 若照原样提交会被后端解释成 30000 秒。上线前应确认现存 MCP 数据是否受该旧默认值影响；当前 ECS 列表为空，无存量记录可验。

## 12. 本轮部署与回归记录

- 2026-10-06：`603b7d5` 已推送到 `origin/codex/react-migration`；ECS `/root/ONE` 与 `/opt/apboa-next` 均快进到该提交。
- `ui-react/dist/` 从本地构建同步，保留旧哈希资源；只重建并重启 Compose `frontend`，Console/Runtime、数据库和数据卷未重建。前端镜像 ID 为 `sha256:e36cc4c15a5e9fa27c00afc8a1e9a8640232c8b7ea1160fed1f70920cff35c9d`，更新前镜像标记为 `apboa-dev-frontend:rollback-ba9def8-pre-603b7d5`，旧静态产物保存在 `ui-react/dist.pre-603b7d5/`。
- SSH 隧道 `/react/` 返回 HTTP 200；浏览器在部署后的页面验证 Tool 编辑表单、账号设置菜单、Workflow 搜索，以及 Hook/Prompt/Sensitive 启停往返并恢复原状态。浏览器错误日志为空。
- 本地检查：31 个测试文件共 102 项通过；TypeScript 与生产构建通过；全部静态产物在既定体积阈值内。
- 2026-10-06：后续修复提交 `5ad1f77` 已推送；ECS `/root/ONE` 与 `/opt/apboa-next` 均快进到该提交。同步本地构建产物，只重建并重启 `frontend`；当前镜像 ID `sha256:c555744f9d157e461ab2c17f7d94e063e54409dac400a8e01c7db398ea6d4250`，更新前镜像标记为 `apboa-dev-frontend:rollback-603b7d5-pre-5ad1f77`，旧静态产物保存在 `ui-react/dist.pre-5ad1f77/`。SSH 隧道 `/react/` 返回 HTTP 200，浏览器在部署后的 MCP 新建表单确认秒数、阈值与结构化字段，在真实模型编辑表单确认数值项；浏览器错误日志为空。MCP 仍无真实 Server 数据，未验证创建/激活/同步。该批次本地 32 个测试文件共 106 项通过，类型检查、生产构建和体积检查通过。
- 2026-10-06：Skill 修复提交 `bae5e95` 已推送并在 ECS 两处仓库部署；只重建 `frontend`。该批次前端镜像 ID `sha256:aa46ee11a39068c45302c0e6b91fc36d4e37593b85c992758b46854f3415b236`，回滚镜像 `apboa-dev-frontend:rollback-5ad1f77-pre-bae5e95`，旧产物 `ui-react/dist.pre-bae5e95/`。SSH 隧道 `/react/` 返回 HTTP 200，部署后刷新页面可见 SkillHub 全部筛选；本地 Vite 通过真实后端验证分类筛选和新建/导入表单重开复位，未提交数据。文件树子目录创建、未保存保护及工具记录 ID 提交有组件测试，真实技能列表为空，尚无真实文件操作和关联保存回归。33 个测试文件共 109 项通过，类型检查、生产构建、体积检查通过；部署页面浏览器错误日志为空。
- 2026-10-06：Skill 关联保护和 MCP 工具协议修复提交 `507d532` 已推送并在 ECS 两处仓库部署；只重建 `frontend`。运行镜像 ID `sha256:b11846afca6f34ed5b8dee0f9fc98becb71aac77bc2cdcb6340589b0fee9d213`，回滚镜像 `apboa-dev-frontend:rollback-bae5e95-pre-507d532`，旧产物 `ui-react/dist.pre-507d532/`。`/react/` 与新版 MCP 资源均返回 HTTP 200，Frontend/Console/Runtime 容器运行；本地 Vite `127.0.0.1:3031` 和 SSH 隧道 `127.0.0.1:18080` 在监听。34 个测试文件共 113 项通过，类型检查、生产构建和体积检查通过。浏览器自动化在本次部署后出现 CDP 超时，未取得新版 MCP 页面级回归证据；不能把 HTTP 200 写成浏览器验收。

## 13. 结论口径

**当前不能严谨地宣布全部迁移完毕。**此前“没有已知前端缺口”的结论已被 Tool 调试、供应商深链、资源筛选、启停和长期记忆配置的后续审计推翻。当前代码已修复这些已发现的问题，其中部分已用本地 Vite、ECS 真实后端及部署后的前端验证，但尚未完成全部页面操作的逐项回归。部署状态应核对运行镜像和 Git SHA，不能仅凭本文推断。高级工作流节点、外部 A2A/第三方 MCP、非 Chromium 兼容性及并发容量仍缺少完整验收证据。状态必须按上表逐项更新，不能从路由可渲染或旧文档结论外推。
