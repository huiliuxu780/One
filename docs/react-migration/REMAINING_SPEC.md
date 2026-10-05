# Apboa Next React 剩余迁移任务 Spec

状态：主体已实施，剩余验收项追踪中

更新日期：2026-10-06

目标分支：`codex/react-migration`
上游基线：`9c3dba4ae980bf26123dae891f8e66f8ca886ce7`
主体实现截至：`28c7244`（后续使用手册迁移与文档提交继续前移）

## 1. 文档目的

本文定义当前 React 第一阶段之后的全部剩余迁移工作、接口约束、验收标准、上线门槛和已知阻塞。它是实施与验收依据，不是进度声明。

事实基线：React 工程、统一样式基础、路由、请求封装、固定默认租户登录、权限守卫、Agent 只读列表/详情和 ECS 开发环境已经可运行。除这些明确完成项外，旧 Vue 中保留且未被排除的功能仍视为待迁移。

## 2. 目标与非目标

### 2.1 目标

1. 将保留范围内的 Vue 页面、Pinia 状态和组合式逻辑迁移为 React + TypeScript。
2. UI 使用项目内持有的 shadcn/ui 组件；工作流画布使用 React Flow。
3. 保持现有 Java/Spring Boot/AgentScope 后端及 HTTP、SSE、WebSocket、工作流持久化协议兼容。
4. 固定使用默认租户 `tenantId=1`，隐藏多租户操作，但不绕过鉴权、角色检查或租户数据隔离。
5. 保留子 Agent、Agent-as-Tool、A2A、人工确认、计划、交互组件、文件和自动化能力。
6. 新旧前端并行验证，完成真实后端全量验收后再切换默认入口。

### 2.2 明确不做

- 不迁移知识库列表、配置、文档管理、本地 RAG 管理和检索测试。
- Agent 编辑器不显示或写入知识库绑定；工作流不提供知识库节点和知识库选择器。
- 不部署 pgvector、Milvus、Qdrant、Weaviate、Elasticsearch 等向量服务。
- 不提供组织切换、组织发现、租户申请、审批、成员或租户管理界面。
- 不新增独立 Agent Team 系统。
- 不重写后端协议，不把 React Flow 数据格式直接持久化到数据库。
- 不使用静态业务数据伪装已接通功能。

### 2.3 后端保留项

- JWT、刷新令牌、默认租户上下文、角色权限和 MyBatis 租户过滤必须继续生效。
- 上游数据库中的知识库表可为兼容性保留，但 React 不得暴露入口，Runtime 使用 `VECTOR_STORE_TYPE=none`。
- 仅在前端无法兼容现有契约、发现后端缺陷或部署必需时修改后端；每项修改需包含原因和回归测试。

## 3. 全局工程约束

### 3.1 前端架构

- 路由：React Router，页面按路由懒加载；重型编辑器、图表、Markdown 和 React Flow 必须独立分包。
- 服务端状态：统一查询缓存、失效和错误处理，不允许每个页面各自实现重复请求状态机。
- 本地状态：Zustand 仅保存跨页面客户端状态；会话流状态与资源表单状态按领域拆分。
- 表单：统一 schema 校验、脏状态提示、提交防重、后端字段错误映射。
- 编辑器：复用 CodeMirror 6 的纯 TypeScript 能力，禁止移植 Vue 包装组件。
- 图表：使用 ECharts 的 React 接入层或直接实例封装，按需加载。
- Markdown：支持代码块、表格、Mermaid、附件链接和现有 VEP/UIP/APIP 交互协议；渲染前必须做 XSS 清理。
- UI：补齐 shadcn/ui 的 Form、Select、Tabs、Table、Pagination、Toast、Tooltip、Popover、Sheet、Dropdown、Checkbox、Switch、Textarea、Command、AlertDialog 等基础组件。
- 所有正式路由必须具备 loading、empty、error、permission-denied 和 retry 状态。

### 3.2 API 与协议

- 继续使用 `/api`、`/api/runtime`、`/api/ws`，不得在组件内写死服务地址。
- Runtime/AG-UI 请求必须发送 `X-Apboa-Thread-Id`。
- 保持现有 `ApiResponse`、分页字段、长整型 ID 字符串化和日期格式。
- Token 刷新只允许一个并发刷新请求；失败时清理会话并返回登录页。
- SSE 必须支持跨 chunk UTF-8、多个 `data:` 行、尾部残片、未知事件透传和 AbortController。
- WebSocket 必须带认证、指数退避重连、手动断开抑制重连和最大重试上限。
- Workflow 保存前将 React Flow `Node`/`Edge` 转为现有 `WorkflowDefinition`；加载时执行反向转换，禁止持久化 React Flow 私有字段。

### 3.3 安全与数据

- 模型、服务器、数据库、Redis、MCP 和第三方服务凭据不得进入源码、前端 bundle、日志、测试快照或提交。
- 密码字段只在提交时存在于表单内存，不回显后端密文。
- 下载文件必须校验文件名和 Content-Type；预览未知格式时禁止执行脚本。
- Markdown、Mermaid、工具输出、HTML 卡片和图表配置均视为不可信输入。
- 删除、强制删除、发布、回滚、启停任务等动作必须有明确确认和处理中状态。

### 3.4 质量门槛

- 每个阶段通过 `tsc -b`、Vite production build、相关单元/组件测试和真实后端冒烟测试。
- 测试可使用 MSW/fixture 验证错误分支，但正式运行代码不得回退到模拟数据。
- 新增领域逻辑的关键 reducer、协议解析器和转换器必须有单元测试。
- 关键用户流程使用 Playwright 对真实开发后端执行端到端测试。
- Console 中不得出现未处理 Promise、React key、受控组件或 hydration 警告。

## 4. 剩余工作包

### RM-01 平台基础完善

范围：在迁移更多页面前补齐共用能力。

接口参考：`auth.ts`、`account.ts`、`stores/modules/account.ts`。

任务：

- 建立统一 query/mutation、分页、筛选、批量选择和缓存失效封装。
- 建立全局 Toast、Error Boundary、403/404/500 页面和请求关联 ID 展示。
- 补齐 shadcn/ui 基础组件与统一表单布局、密度、颜色、焦点和键盘操作。
- 增加 Vitest、React Testing Library、MSW、Playwright 基础配置。
- 建立功能权限与角色权限映射；菜单隐藏不能替代路由和后端权限检查。
- 完成个人资料、修改密码、退出登录、刷新令牌失败恢复。
- 增加构建产物体积阈值和 source map 发布策略。
- 提供 React 开发态接入 dev compose 真实后端的执行环境：代理目标环境变量化，并提供加入 backend 网络的独立开发服务编排；宿主机不依赖 Node。

验收：

- 刷新任意受保护路由后会话可恢复；过期 token 可刷新一次且不会并发风暴。
- 非默认租户响应被拒绝；所有请求仍带后端签发的租户上下文。
- 共用表格/表单在键盘操作、错误提示和窄屏下可用。

### RM-02 Agent 完整管理

Vue 参考：`views/Agent/`、`components/agent/`。

接口参考：`agent.ts`、`agentA2a.ts`、`agentChatKey.ts`、`agentStatistics.ts`、`job.ts`。

任务：

- Agent 新建、编辑、复制、启用/停用、批量删除、依赖占用提示。
- 基础字段：类型、名称、代码、描述、标签、文件类型、版本和高级参数。
- 模型、提示词、工具、技能、MCP、Hook、敏感词、子 Agent、Agent-as-Tool、工作流、长期记忆、代码执行环境和 Studio 选择器。
- 明确移除知识库/RAG 表单区；提交适配器不得意外清空后端中与本次表单无关的兼容字段。
- A2A 的基础、高级、Nacos、well-known 配置及连通性错误展示。
- Agent Chat Key、API 文档、配置架构图、历史版本、调度和统计页签。
- 所有长整型 ID 保持字符串，编辑回显与提交前后做 payload 对比测试。

验收：

- 在空数据库创建普通 Agent，编辑后字段不丢失，可删除且占用检查有效。
- 不配置知识库、不启动向量库时，Agent 创建、编辑、详情和运行准备接口均成功。
- 配置一个子 Agent、一个 Agent-as-Tool 和一个 A2A Agent，保存后重新打开数据一致。
- 无权限角色不能通过直接 URL 或手工请求执行管理动作。

### RM-03 会话与聊天核心

Vue 参考：`views/Chat/`、`views/ChatHistory/`、`views/ChatCluster/`、`views/Communication/`、`components/chat/`。

接口参考：`chatSession.ts`、`api/agui/*`、`workspace.ts`、`attach.ts`、Vue `src/websocket/manager/` 与 `src/ws/WsService.ts`（WebSocket 封装）。

任务：

- 会话创建、切换、置顶、取消置顶、重命名、删除、列表分页和按 Agent 筛选。
- 当前消息链加载、向上分页、重新生成分支、历史分支切换和当前消息编辑。
- 将 AG-UI 客户端改写为与 React 生命周期无关的协议层，并以 reducer/store 消费事件。
- 支持 RUN、TEXT、REASONING、TOOL_CALL、STATE、MESSAGES、ACTIVITY、CUSTOM、RAW 和回放完成事件。
- 流式文本和推理增量渲染；工具参数分片拼接、结果、错误和耗时展示。
- 子 Agent 调用卡片、嵌套调用、事件时间线、终态保护和刷新后恢复。
- 停止执行：前端 abort + 后端 stop；轮询直到 `COMPLETED`，区分 `STOPPING`。
- 断流重连：运行状态查询、reconnect 回放、`REPLAY_CAUGHT_UP` 去重和最大重试。
- HITL：刷新恢复 pending 工具、逐项允许/拒绝、resume 续流和 memoryActive。
- 任务计划、确认状态、记忆压缩、图表、交互表单及 VEP/UIP/APIP 卡片。
- 输入框支持附件、mention、快捷键、发送防重和运行中状态。

验收：

- 使用真实云模型完成一轮文本流式聊天，刷新页面后历史与当前分支一致。
- 在推理中停止，后端状态最终为 `COMPLETED`，刷新后不再显示运行中。
- 人为断开网络后可重连，已显示事件不重复，缺失事件能回放。
- 至少验证一次工具确认允许、拒绝和刷新后继续。
- 至少验证一次子 Agent 和 Agent-as-Tool 调用，父子 trace、状态和结果正确。
- 所有失败场景显示可操作错误，不把空输出标记为成功。

### RM-04 文件、附件与工作空间

Vue 参考：`components/workspace/`。

接口参考：`workspace.ts`、`attach.ts`。

任务：

- 单文件、多文件和压缩包上传；进度、取消、大小与扩展名校验。
- 工作空间树、目录展开、刷新、删除、清空、容量和文件存在检查。
- 单文件、批量和全部下载；文本、代码、图片、音视频、PDF 等安全预览。
- 聊天附件与消息引用关联，刷新后可恢复并下载。
- 单机共享 volume 场景验收；多节点 runner-file 保持待启用，不在本阶段默认部署。

验收：

- 上传、预览、下载内容校验值一致；非法类型和超限文件被明确拒绝。
- 删除或清空有确认，失败不会提前从 UI 移除。
- Workspace 容量与后端返回一致，不使用浏览器估算代替。

### RM-05 Models、Skills、Tools、MCP、Hook 与提示资源

接口参考：`model.ts`、`skill.ts`、`skillHub.ts`、`tool.ts`、`mcp.ts`、`hook.ts`、`prompt.ts`、`sensitive.ts`、`longTermMemory.ts`、`codeExecutionConfig.ts`、`studio.ts`。

任务：

- Models：供应商配置、模型 CRUD、扩展参数、上下文窗口和最大 token 提示。
- Skills：列表、分类、别名、Agent 占用、工具关联、本地/Git/ZIP 导入、文件树、CodeMirror 编辑、上传下载、同步和 SkillHub。
- Tools：内置/自定义工具 CRUD、代码编辑、参数 schema、人工确认开关和真实调试。
- MCP：Server CRUD、激活、同步工具、全局启用/确认、工具治理和真实调试。
- Hook：CRUD、类型、类路径/代码、优先级和占用检查。
- Prompt、敏感词、长期记忆、代码执行环境和 Studio 的 CRUD、分类及占用检查。
- 所有密钥字段使用“留空不修改”语义，后端密文不回显。

验收：

- 每个资源至少完成创建、读取、更新、依赖占用阻止删除和删除闭环。
- Skill 文件树在刷新后保持一致；下载包可重新导入。
- 自定义 Tool 与 MCP 调试必须调用真实后端并展示原始错误，不返回假成功。
- 资源被 Agent 引用时，删除策略与 Vue/后端现有行为一致。

### RM-06 自动化与执行记录

Vue 参考：`views/Automation/`、`components/automation/`。

接口参考：`automation.ts`、`job.ts`。

任务：

- Agent/Workflow 自动化任务列表、分页、搜索和类型筛选。
- Cron 构建器、目标选择、Workflow 输入映射、创建与编辑。
- 启用、禁用、启动、停止、手动触发和删除确认。
- 执行记录分页、运行状态、错误、Agent 对话详情和 Workflow 节点详情。
- 刷新时运行状态恢复，避免重复触发。

验收：

- 创建一项短周期测试任务并实际触发；执行记录、开始结束时间和详情一致。
- 禁用后不再产生新记录；手动触发只产生一次执行。
- Agent 与 Workflow 两类目标各验证一次成功和一次失败。

### RM-07 React Flow 工作流

Vue 参考：`views/Workflow/`、`components/workflow/`、`config/workflow/`。

接口参考：`workflow.ts`、`workflowResources.ts`。

任务：

- 工作流列表、搜索、复制、锁定、占用检查、删除和强制删除。
- React Flow 画布：节点库、拖放、连线、选择、缩放、MiniMap、背景、快捷键、上下文菜单和视口恢复。
- 配置、输入绑定、输出选择、变量、前后节点、条件分支和快速输入。
- 支持现有非知识库节点：Start、End、NoOp、Agent、Tool、MCP、Code、HTTP、IF/Else、Intent、Loop、Iterate、常量、变量聚合、字符串/列表/序列化、DB、Cache、MQ、Email、飞书、钉钉、企微等实际后端 metadata 返回的节点。
- 知识库节点不出现在节点库；加载旧含知识库节点的流程时只读提示“不受新前端支持”，禁止静默删除或覆盖。
- Datasource、Cache、MQ、Channel 等工作流资源 CRUD，密码留空不修改。
- 保存、服务端校验、错误定位、发布说明、版本列表、删除版本。
- 单节点调试、整图 debug-run、正式 run、运行 Dock、节点日志和执行详情。
- `toBackendDefinition` 与 `fromBackendDefinition` 作为唯一协议转换边界，并做 fixture round-trip 测试。

验收：

- 选取至少三个上游真实工作流 fixture，执行加载→无修改保存→JSON 结构对比，业务字段不丢失、不新增 React Flow 私有字段。
- 创建包含分支、循环、Agent、Tool、HTTP 和资源节点的流程，校验、发布和运行成功。
- 单节点调试与整图运行的输入输出、错误节点定位和日志正确。
- 加载含知识库节点的旧流程不会崩溃，也不会在未确认时改写原数据。

### RM-08 Dashboard、API Service、Review 与保留设置

接口参考：`apiService.ts`、`dashboard.ts`、`heartbeat.ts`、`params.ts`、`sk.ts`、`storageProtocol.ts`、`account.ts`。

任务：

- Dashboard：列表、默认项、启停、设计器、个人配置、历史版本、数据集与真实查询。
- API Service：App、API 编辑、上下线、分类、访问日志和详情。
- Review：Agent 与 Workflow 审查页面及权限。
- Ops：执行节点/WebSocket 节点监控、存储协议配置与连通性验证。
- Settings：个人账号、账号管理、API Key、系统参数、系统介绍。
- 明确不迁移 Tenant、TenantDiscovery、审批和成员管理入口。
- API Service 验收前按 profile 增加 runner-gateway，并保持其内部端口不公开。

验收：

- Dashboard 数据集执行真实查询，错误与超时可见。
- API 上线后通过网关真实调用并生成访问日志；下线后拒绝访问。
- 存储协议验证调用真实后端；密钥不回显、不写日志。
- 菜单、路由和直接 API 三层权限行为一致。

### RM-09 清理、切换与回滚

任务：

- 删除所有“迁移中”占位入口，只保留已完成路由和明确排除项。
- 搜索 React 源码，确认不存在 knowledge、RAG、tenant switch/join/approval/admin 的可访问入口或表单字段。
- 运行完整类型检查、测试、构建、依赖审计和 bundle 分析。
- 建立不可变版本镜像和镜像清单，记录 Git SHA、镜像 digest、数据库迁移版本。
- 在切换前构建并验证旧 Vue 回滚镜像，或保留上一个可运行不可变镜像。仅保留 Vue 源码不算可执行回滚。
- 新旧前端并行真实回归；通过后将根路径切到 React，保留限定时间的回滚入口。
- 记录空闲、聊天、工具调用、自动化和工作流典型负载下的 CPU、内存、磁盘和响应时间。
- 配置域名与 TLS 后才开放公网登录；安全组仅开放 22 和 HTTPS 所需端口，SSH 限制可信来源。

验收：

- 根路径、深链接刷新、静态资源缓存、SSE 和 WebSocket 代理全部正常。
- 执行一次 React→旧 Vue→React 的实际回滚演练，数据库和上传文件不丢失。
- MySQL、Redis、Console、Runtime、Proxy、WebSocket 内部端口在公网不可达。
- 不凭估算宣称 4C8G 足够；报告包含真实采样和失败阈值。

## 5. 实施顺序与依赖

| Gate | 工作包 | 前置条件 | 放行标准 |
| --- | --- | --- | --- |
| G1 | RM-01 平台基础 | 当前 React 基线 | 共用组件、测试与错误处理可复用 |
| G2 | RM-02 Agent 管理 | G1、资源只读选择 API | 普通/子 Agent/A2A 保存回显通过 |
| G3 | RM-03 + RM-04 聊天和文件 | G2、真实模型配置 | 流式、停止、重连、HITL、子 Agent、文件通过 |
| G4 | RM-05 资源管理 | G1，可与 G3 部分并行 | 各资源 CRUD、调试和依赖检查通过 |
| G5 | RM-06 自动化 | G2、G3、工作流运行 API | 两类任务真实执行与记录通过 |
| G6 | RM-07 工作流 | G1、G4 | 协议 round-trip、发布、调试、运行通过 |
| G7 | RM-08 其余功能 | G4、G6，按领域依赖 | Dashboard、Gateway、Ops、Settings 通过 |
| G8 | RM-09 切换 | G1-G7 全部通过 | 全量回归、容量数据、回滚演练通过 |

不得以页面数量平均拆分阶段。聊天协议和工作流转换属于高风险核心，应独立提交、独立测试、独立验收。

## 6. 真实后端验收矩阵

| 场景 | 必须验证的证据 |
| --- | --- |
| 登录 | 默认租户 ID、角色、刷新 token、退出后 token 失效 |
| Agent | 创建/编辑/删除前后数据库/API 回显；无知识库配置仍可运行 |
| 聊天 | SSE 原始事件序列、最终消息、会话记录一致 |
| 停止 | stop 响应、状态轮询终态、刷新后 UI 状态 |
| 重连 | 断流点、回放事件 ID、无重复/无丢失 |
| HITL | pending、决策 payload、resume 后续事件 |
| 子 Agent | run/event trace、父子 invocation、终态 |
| 文件 | 上传与下载校验值、容量变化、权限错误 |
| Tool/MCP | 请求参数、真实执行结果、失败原文和确认链路 |
| 自动化 | 调度触发时间、唯一执行记录、详情 |
| Workflow | 保存 JSON diff、校验、版本、节点日志、最终结果 |
| 权限 | 菜单、直接路由、直接 API 的 403 行为 |
| 部署 | 监听端口、容器重启数、资源采样、SSE/WS 代理 |

日志和截图中的 access token、refresh token、密码、模型 key、MCP key、Cookie 必须脱敏。

## 7. 分阶段提交规则

- 每个提交只覆盖一个可验证能力，提交后 React 可构建、已有功能不回退。
- 协议转换、状态机和 UI 分开提交，便于回滚和审查。
- 后端变更单独提交，并在提交说明中写明“前端无法解决的原因”。
- 数据库迁移必须向前兼容，不修改已经发布成功的 migration checksum。
- 不提交 `.env`、构建产物、测试账户密码、真实 token 或服务器专用文件。

## 8. 当前阻塞与所需输入

以下为当前输入与阻塞状态：

1. 已解决：开发专用云模型已经由产品供应商配置注入，凭据未进入代码、日志或提交。
2. 若需公网访问：域名、DNS 控制权和 TLS 方案。没有 TLS 时继续使用 SSH 隧道。
3. API Service 的内部 Gateway 已启动并通过上线、调用、日志、下线验收；公网入口仍受域名、TLS 和对外限流策略阻塞。
4. 第三方 MCP、邮件、飞书、钉钉、企微等功能若要求全量验收，需要相应开发测试凭据；没有凭据时只能完成接口与失败路径验收，不能宣称集成成功。
5. 协议层已有三份 fixture 完成 round-trip 单测；分支、循环、数据库、MQ 和第三方 Channel 等高级节点仍缺真实成功运行矩阵，不能因单测而判定 G6 全量通过。
6. 已解决：旧 Vue 文档子应用已迁移到 React `/react/docs`；旧 `/web/doc` 保留重定向，知识库章节按本项目明确排除范围不迁移。
7. Agent 与 Workflow 自动化成功路径、详情读取及 Quartz 启停持久化已经真实通过；失败路径仍缺可审计记录，因为现有 `job_record` 只保存 `jobId`、`recordId`、`createTime`，且调度器仅在业务成功后写入关联。补齐失败审计需要后端 schema/migration 和调度执行模型扩展，不能由前端伪造状态或错误字段。

## 9. 完成定义

只有同时满足以下条件，才能宣布 Vue→React 迁移完成：

- 本文 G1-G8 全部通过，未完成入口为 0。
- 明确排除项在 React 导航、路由和配置表单中不可访问。
- 原系统所有其他功能均有 React 实现及真实后端验收证据。
- Agent 聊天、停止、重连、HITL、子 Agent、工具、文件、自动化和工作流均执行过真实成功与失败用例。
- React Flow 保存协议经 round-trip 和真实运行验证。
- ECS 容量报告来自实际负载；公网入口具备 TLS；内部端口未暴露。
- 已完成可执行回滚演练并记录恢复步骤和数据完整性结果。

当前不能宣布“所有外部场景全量验收完成”：可执行回滚、内部 Gateway、两类自动化成功路径、停止、刷新重连、HITL 双分支和子 Agent 真实调用已通过；仍缺自动化失败审计 schema、高级工作流节点成功矩阵、外部 A2A/第三方集成凭据、强制网络故障注入以及公网域名/TLS。
