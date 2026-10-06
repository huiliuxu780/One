# Apboa Next React 迁移基线

更新日期：2026-10-06

剩余工作包、协议约束、真实后端验收矩阵和上线门槛见 [REMAINING_SPEC.md](./REMAINING_SPEC.md)。

## 已核实事实

- Fork `https://github.com/huiliuxu780/One.git` 在开始工作时为空，没有分支或提交。
- 上游已确认为 `https://github.com/huxuehao/apboa-next.git`，基线为 `upstream/master` 的 `9c3dba4ae980bf26123dae891f8e66f8ca886ce7`。
- 当前开发分支为 `codex/react-migration`，旧前端完整保留在 `ui/`，新前端位于 `ui-react/`。
- 仓库内没有 `AGENTS.md` 文件。会话中用户提供的规范继续生效。
- 旧前端约 129,596 行 TypeScript、Vue 与 SCSS，包含 42 个页面和 418 个组件文件。
- 旧前端基线 `vue-tsc --build` 与 `vite build --mode main` 均通过。
- 旧前端生产构建存在多个大分块，主包约 1.64 MB，SubAgent 相关分块约 1.87 MB，工作台渲染分块约 1.14 MB，迁移时必须按路由和重型渲染器拆包。
- 后端版本为 Java 21、Spring Boot 3.4.9、AgentScope 1.0.12。
- 初始化数据中的默认租户 ID 为 `1`，编码为 `default`。后端在 JWT 中保留租户上下文，并由 MyBatis-Plus 注入租户过滤。
- 本地 RAG 有 `NoOpVectorStore` 回退实现。将 `VECTOR_STORE_TYPE` 设为非已注册值可避免创建向量数据库连接，普通 Agent 仍需通过真实后端回归验证。

## 明确排除范围

以下内容不迁入 React 导航，也不作为开发环境依赖：

- 知识库列表、新建、编辑与文档管理
- Agent 表单中的知识库绑定
- 工作流知识库节点及知识库选择器
- 本地 RAG 管理与检索测试界面
- 组织切换、发现组织、加入申请、审批和组织管理界面
- 独立 Agent Team 系统

后端租户上下文、登录鉴权、角色权限、数据隔离不会移除。子 Agent、Agent-as-Tool 和 A2A 保留。

## 功能迁移清单

| 领域 | 原 Vue 入口 | React 目标 | 接口依赖 | 当前状态 |
| --- | --- | --- | --- | --- |
| 应用外壳 | `layout/`、`components/layout/` | 侧栏、路由、用户菜单、状态页 | 无 | 第一版已完成 |
| 登录与权限 | `pages/Login.vue`、account store | 固定租户登录、Token 刷新、路由守卫、角色权限 | `/api/auth/*`、`/api/account/*` | 第一版已完成 |
| Agent 列表 | `views/Agent/index.vue` | 查询、类型/标签过滤、详情、分页 | `/api/agent/definition/*` | 首屏真实接口已完成 |
| Agent 配置 | `components/agent/` | 自定义 Agent 与 A2A 创建编辑、模型、工具、技能、MCP、Hook、子 Agent、工作流、记忆、调度、统计、版本 | Agent、A2A、job、statistics API | 已实现；子 Agent 真实委派成功，外部 A2A 端点待凭据验收 |
| 聊天会话 | `views/Chat/`、`components/chat/` | 会话 CRUD、消息树、刷新恢复 | chatSession API | 已实现；真实会话与历史已验证 |
| AG-UI 流 | `api/agui/agent-client.ts` | 文本、推理、工具、状态补丁、停止、重连 | Runtime AG-UI、SSE | 已实现；真实流式、主动停止、刷新恢复与 reconnect 回放已通过，强制传输层断网未单独压测 |
| 交互消息 | markdown VEP/APIP、Plan、SubAgent | 图表、表单、确认、任务计划、子 Agent 事件 | AG-UI 事件 | 已实现与单测；HITL 允许/拒绝/刷新恢复及子 Agent 真实委派已通过 |
| 工作空间 | `components/workspace/` | 上传、下载、批量下载、预览、树操作 | workspace、attach API | 已实现；单文件上传/列表/下载校验/删除已实测，多类型预览矩阵待验收 |
| Models | `views/Model/` | 供应商、模型配置、扩展参数 | model API | 已实现，DashScope 两模型连通性已验证 |
| Skills | `views/Skill/` | 列表、导入、编辑器、文件树、关联工具、SkillHub | skill、skillHub API | 已实现 |
| Tools | `views/Tool/` | CRUD、代码编辑、调试 | tool API | 已实现；外部依赖工具待凭据验收 |
| MCP | `views/Mcp/` | CRUD、激活、调试、工具治理 | mcp API | 已实现；第三方 MCP 待凭据验收 |
| Hook | `views/Hook/` | CRUD、优先级、代码编辑 | hook API | 已实现 |
| Prompt | `views/Prompt/` | CRUD、模板编辑 | prompt API | 已实现 |
| 敏感词 | `views/Sensitive/` | CRUD、词条编辑 | sensitive API | 已实现 |
| 自动化 | `views/Automation/` | 列表、Cron 编辑、目标输入、手动运行、记录 | automation API | 已实现；Agent 与 Workflow 手动触发均已成功，失败记录受现有后端 schema 限制 |
| 工作流 | `views/Workflow/` | React Flow 画布、节点面板、校验、保存、发布、运行调试、版本 | workflow、workflowResources API | 已实现；回声流程发布/运行通过，高级节点全矩阵待验收 |
| 工作台 | `views/Dashboard/` | 面板运行、数据集、设计器、历史版本 | dashboard API | 已实现 |
| API 服务 | `views/ApiService/` | API、应用、日志 | apiService API、runner-gateway | 已实现；真实上线/调用/日志/下线已验证 |
| 运维与设置 | `views/Ops/`、`views/Settings/` | 账号、系统参数、API Key、节点监控、存储 | account、params、sk、heartbeat、storage API | 已实现，租户操作页已排除 |
| 审查 | `views/Review/` | Agent 与工作流审查 | 对应业务 API | 诚实空态：后端无审查 API，旧 Vue 为静态假数据 |
| 使用手册 | `src/doc/`、`doc.html` | React Markdown 帮助中心、目录、表格与代码块 | 静态 Markdown | 已迁移；旧 `/web/doc` 重定向到 `/react/docs`，知识库章节按排除范围删除 |

## 协议与复用规则

- `ui/src/types/` 中不依赖 Vue 运行时的类型已复制到 `ui-react/src/types/` 作为迁移起点。
- Workflow 的 `WorkflowDefinition`、节点、连线、变量与绑定结构保持原字段，不改变后端持久化 JSON。
- 画布层仅把 React Flow 的 `Node`、`Edge` 转换为现有 `WorkflowNodeDefinition`、`WorkflowEdgeDefinition`。
- AG-UI 的事件名、RunAgentInput、JSON Patch、断流重连和 Thread ID 头保持原协议。
- HTTP 请求继续使用 `/api`、`/api/runtime`、`/api/ws` 三条代理路径；Runtime 请求继续发送 `X-Apboa-Thread-Id`。
- Token 存储键保持与 Vue 前端兼容，便于并行测试和回滚。

## 实施顺序

1. React 工程、shadcn/ui 令牌、路由、请求层、登录、固定租户和 Agent 列表。
2. Agent 创建编辑与 A2A 配置，去除知识库字段但保留其余能力。
3. 会话与 AG-UI 核心链路，包含停止、恢复、重连、工具确认、子 Agent、计划和文件。
4. Models、Skills、Tools、MCP、Hook、Prompt、敏感词及其他资源管理。
5. 自动化、执行记录、工作台、API 服务、审查、运维和保留设置。
6. React Flow 工作流编辑器及全节点协议转换。
7. 全量真实后端验收、入口切换和旧 Vue 回滚验证。

## ECS 审计

- 地址：`8.160.183.108`
- 系统：Ubuntu 22.04.5 LTS，x86_64
- 资源：4 vCPU、7.3 GiB 内存、无 Swap、40 GiB 根盘，审计时可用 35 GiB
- 审计时仅 SSH 22 端口监听，没有已有业务服务或容器
- 已安装 Docker Engine 29.8.2 与 Docker Compose 5.6.0

上游默认 Compose 不适合直接使用：它暴露 MySQL、Redis、Console、Runtime、Proxy 与 WebSocket 端口，且 Java 容器默认内存限额合计超过物理内存。开发部署将只暴露网页端口，内部服务放在专用 Docker 网络；禁用 pgvector，单机模式不运行 runner-file，API gateway 作为保留功能的按需 profile。

## 验证门槛

- 每个迁移阶段必须通过 TypeScript 类型检查和生产构建。
- 不用静态成功数据替代 API，未迁移入口明确禁用。
- 登录响应必须包含默认租户 ID `1`，否则拒绝进入应用。
- 聊天验收必须覆盖 SSE、WebSocket、刷新恢复、主动停止和断流重连。
- 工作流保存前后 JSON 需做结构对比，不允许前端私自更改持久化协议。
- ECS 验收需记录空闲与典型执行时 CPU、内存、磁盘数据。

## 2026-10-05 开发环境实测

- Maven 38 个模块在 ECS 以 Java 21 完成 `-DskipTests package`，耗时 4 分 22 秒；该结果证明可编译，不代表测试通过。
- React 生产构建已经由 Nginx 提供，页面通过 SSH 隧道实测返回 HTTP 200，并完成浏览器渲染检查。
- MySQL 与 Redis 健康；Console、Runtime、Proxy、WebSocket 均持续运行且重启计数为 0。Flyway 已成功迁移到 V6。
- 真实登录返回 `code=200`、默认租户 `tenantId=1`；携带登录 token 的 Agent 分页请求返回 `code=200`、当前记录数 0。
- MySQL、Redis 和四个 Java 服务没有宿主机端口映射。开发网页入口默认仅监听 `127.0.0.1:80`，通过 SSH 隧道访问。
- 空闲采样时主机已用内存 2201 MiB、可用 5012 MiB、无 Swap；容器内存约为 Nginx 14 MiB、MySQL 384 MiB、Redis 10 MiB、Runtime 428 MiB、Proxy 295 MiB、Console 448 MiB、WebSocket 182 MiB。
- 构建后根盘使用 11 GiB/40 GiB，剩余 27 GiB；Docker 镜像 4.1 GB，构建缓存 2.6 GB。缓存暂时保留以加速下一阶段构建。
- 典型 Agent 执行资源数据尚未采集：当前数据库没有 Agent/模型配置，也没有提供云模型 API 凭据。不能用登录或列表请求冒充 Agent 执行负载。
- 公网 80 探测的 TCP 连接被云侧接收，但 ECS 网卡没有收到对应入站包；没有阿里云控制台权限，无法核对安全组/云防火墙规则。鉴于当前也没有域名和 TLS，本阶段不开放明文公网登录。

## 2026-10-05 RM-01 平台基础完成

依据 REMAINING_SPEC.md 的 RM-01 工作包实施，全部验证在本机 Docker 内的 node:22-alpine 工具链完成（宿主机无 Node）。

已完成：

- 统一数据层：`@tanstack/react-query` 接入（重试策略区分 4xx/5xx/网络）、`usePagedList`（分页+筛选+keepPreviousData）、`useBatchSelection`、按资源失效助手。
- 请求层增强：每个请求注入 `X-Request-Id`（优先采用后端回显），错误统一为携带 `status/code/requestId` 的 `ApiClientError`；401 单飞刷新保持原语义并由 MSW 单测覆盖（并发 401 仅一次刷新、刷新失败清理会话并跳转登录）。
- shadcn/ui 补齐：Form、Select、Tabs、Table、Pagination、Toaster(sonner)、Tooltip、Popover、Sheet、DropdownMenu、Checkbox、Switch、Textarea、Command(cmdk)、AlertDialog、Label、ScrollArea。
- 全局：ErrorBoundary、sonner Toaster、TooltipProvider、403/404/500 页面（500 展示请求关联 ID）、路由级 loading/空态/错误态组件；`*` 路由改为 404，未迁移入口仍以"迁移中"禁用态呈现。
- 权限：`Capability → TenantRole` 映射与 `roleSatisfies`；`ProtectedRoute` 支持 capability 守卫（403），导航项按能力隐藏；后端权限检查仍为最终边界。
- 会话功能：个人资料页（updateProfile）、修改密码页（md5 后提交，与 Vue 行为一致）、用户菜单接线、`updateUser` 状态同步。
- 测试与构建：Vitest(jsdom)+RTL+MSW 基础设施、Playwright 配置与真实后端冒烟用例（凭据经环境变量注入，不入库）、`pnpm size:check` 体积阈值脚本、生产默认无 source map（`VITE_SOURCEMAP=hidden` 可发布符号）。
- 开发环境：vite 代理目标环境变量化（`VITE_DEV_CONSOLE/RUNTIME/WS_TARGET`），新增 `deploy/dev/docker-compose.ui-react-dev.yml` 开发态服务，宿主机零 Node 依赖。

验证结果：`tsc -b` 通过；Vitest 11/11 通过；生产构建通过且路由分包生效；`size:check` 全部在阈值内（entry 183KB / react vendor 350KB）。真实后端冒烟：dev 容器经 backend 网络代理 `/api`，静态页 HTTP 200，`/api/auth/login` 抵达真实 Console 并返回业务码。

阻塞：部署实例的 admin 密码已与 `db_init.sql`/README 默认值不一致（无修改记录）。需要用户提供开发环境测试账号，或确认重置为文档默认值后，才能完成"会话恢复、token 刷新"的真实验收。

## 2026-10-05 RM-02 ~ RM-08 主体迁移完成

同日在 RM-01 基础上完成剩余工作包的主体迁移（提交 73a4e00、28b30b8 及其后）：

- RM-02 Agent：列表（搜索/类型/标签/分页/复制/占用检查删除）+ 多页签编辑器（基础/模型/提示词/工具技能MCP/Hook/敏感词/子Agent/工作流/高级/A2A WellKnown 与 Nacos），`knowledgeBase`/`ragConfig` 兼容字段提交时原样透传。
- RM-03 聊天：AG-UI 协议层按 Vue 版原样移植（SSE 跨 chunk UTF-8、多 data: 行、尾部残片、未知事件透传、reconnect 回放与 REPLAY_CAUGHT_UP、HITL resume、stop 轮询至终态），修复原实现刷新失败时 waiter 永久挂起的缺陷；会话列表（置顶/重命名/删除）+ 消息链渲染 + 工具卡片 + HITL 逐项允许/拒绝（memoryActive）+ 安全 Markdown 渲染（纯 React 元素，无 HTML 注入面）。
- RM-04 工作空间：容量（后端返回）、单/批/压缩包上传、单/批/全量下载、删除与清空确认。
- RM-05 资源：模型（配置+供应商，密钥留空不修改）、工具、技能（本地/Git/ZIP 导入、文件树 + CodeMirror 6 编辑、工具关联、打包下载、同步）、MCP（激活/同步/全局启用与确认治理/真实调试展示原始错误）、Hook、提示词、敏感词、长期记忆、代码执行、Studio，全部走统一 CRUD 引擎并带占用检查删除。
- RM-06 自动化：Cron 任务 CRUD、启动/停止/切换/手动触发、执行记录与 Agent/Workflow 详情入口。
- RM-07 工作流：`toBackendDefinition`/`fromBackendDefinition` 唯一协议边界 + 3 份 fixture round-trip 与 React Flow 私有字段剥离测试；React Flow 画布（metadata 节点库、连线、节点配置面板、保存、校验、发布、版本、调试/正式运行）；含旧知识库节点的流程加载后原样保留并明确提示，不静默改写。
- RM-08 设置与运维：账号管理、API Key（创建时一次性展示完整值）、系统参数 CRUD；执行节点/WebSocket 节点监控（15s 轮询）、存储协议连通性验证。

真实后端契约冒烟（admin 会话）：agent/workflow/model/tool/skill/mcp/hook/prompt/sensitive/params/sk/heartbeat/account/chat-session 共 16 个模块端点全部返回 `code=200`，runtime 的 `workflow/node-metadata` 与 `agui/active-runs` 均为 HTTP 200。

随后补完剩余页面：对话广场（Vue 原版为骨架屏占位，按其声明的"聚合展示可用智能体"意图落地）、会话历史（分页消息链 + 分支切换 + 当前消息编辑）、Communication（ChatKey 免登录分享入口，key 换取令牌后进入对话）、工作台 Dashboard（看板 CRUD/默认项/启停 + 数据集 CRUD 与真实执行，错误原文直接展示）、API 服务（应用/API CRUD、上下线、访问日志详情）、审查页（后端无审查 API 且旧版为静态假数据，按 Spec 2.2 做诚实空态，不做伪装）。



## 2026-10-05 云模型接入与流式对话验收

阻塞项 1（云模型凭据）已由用户提供：阿里云 DashScope `qwen3.8-flash` / `qwen3.8-max`。

- 凭据经 ECS `0600` 文件注入配置过程，未进入源码、bundle 或提交；存储采用产品自身的供应商配置（`authType=CONFIG`，列表接口对 value 脱敏）。
- 供应商与模型配置：DashScope 原生端点对 qwen3.8 返回 400（url error），改用 **OpenAI 兼容模式**（`type=OPEN_AI`，baseUrl `https://dashscope.aliyuncs.com/compatible-mode/v1`）后连通性检查两个模型均"连接成功"。
- 真实 AG-UI 流式对话验收：创建会话（threadId=sessionId）→ `runtime/agui/run/{agentCode}` SSE。事件序列完整：`REPLAY_CAUGHT_UP → RUN_STARTED → REASONING_MESSAGE_START/CONTENT/END（7 个思考增量）→ TEXT_MESSAGE_START/CONTENT(5)/END → RUN_FINISHED`；SSE data 为双层 JSON 编码，与 Vue 版解析器（字符串再解一层）一致。助手最终回复："我是一个简洁友好的中文助手，随时为你解答问题、处理任务！"
- 已创建可直接对话的测试 Agent：`chat_flash_test`（对话测试（qwen3.8-flash））；qwen3.8-max 配置就绪，可在 Agent 编辑器中切换。
- qwen3.8-max、API 服务、停止、刷新重连、HITL 双分支和子 Agent 真实调用均已于 2026-10-06 通过；强制传输层断网仍未单独做故障注入。


## 2026-10-05 全量部署与演示数据

- 最新 React 构建已部署至 dev 前端容器（`/react/`，包含全部已完成页面），SSH 隧道 80 端口即可访问。
- 通过真实 API 造演示数据：Agent×2（qwen3.8-flash/max）、自定义工具（JAVASCRIPT）、提示词模板、敏感词配置、Hook、长期记忆/代码执行/Studio 各一条、看板 + HTTP 数据集、网关应用 + API（绑定工作流、未上线）、自动化任务（禁用态，避免计划外模型调用）。
- 工作流"演示工作流（回声）"（START→AGENT→END，AGENT 绑定 qwen3.8-flash）已发布至 v4：校验通过、debug-run 三节点全部 SUCCESS，END 通过 inputConfigs 绑定 AGENT 的 `output` 变量。排障记录：END 的 JACKSON 格式化器要求模板为合法 JSON；模板变量需通过节点 inputConfigs 以 `NODE_OUTPUT` 方式绑定，仅写字面 `${var}` 不会被替换。
- 已知待办：审查页为诚实空态（后端无审查 API）；Communication 的 ChatKey 换令牌、Agent 解析与深链页面已通过。

## 2026-10-06 网关、容量与回滚实测

- 会话分页接口已修复空标题查询触发的 510，真实返回 4 条会话，React 历史页刷新后正常渲染。
- 启动内部 `gateway` profile，将演示应用与 `POST /v1/ask` 上线；从 Gateway 容器内携平台令牌调用，返回 HTTP 200 和真实工作流文本，管理页生成一条 200 访问日志。
- API 下线后同路径返回 404；验收后应用和 API 已恢复为原始离线状态，避免计划外模型调用。
- 单次真实工作流调用后：主机内存 7522 MiB，已用 3451 MiB，可用 3761 MiB，无 Swap；Gateway 446.5 MiB，Runtime 545.2 MiB，Console 415.2 MiB，MySQL 419.6 MiB。根盘 40 GiB 已用 16 GiB，可用 22 GiB。这仅证明当前开发负载可运行，不是并发容量保证。
- 宿主机仅公网监听 SSH 22；网页仅绑定 `127.0.0.1:80`，MySQL、Redis 和 Java 服务未发布宿主机端口。
- 完成 React→Vue→React 实际切换：Vue `/web/` 与登录接口返回 200，恢复后 React `/react/` 返回 200。切换前后 Agent 2 条、Workflow 1 条、会话 4 条，共享应用数据卷未替换。
- qwen3.8-max 完成真实 AG-UI SSE 调用，事件包含回放追平、运行、推理、文本和终态，最终文本与指令一致。
- Communication 用真实 ChatKey 换取临时令牌，正确解析回 Agent，对外深链页返回 200；ChatKey 本身未写入日志或文档。
- 工作空间使用仓库 `LICENSE` 完成真实上传、列表、下载 SHA-256 一致性、容量变化和删除回零验收。
- Agent 自动化产生真实会话及预期助手文本；Workflow 自动化产生真实 run，Start/Agent/End 三节点均 `SUCCESS`。同时修复了 React 记录页调用不存在端点、错用返回字段、任务参数封装不符合 `AgentJobWrapper`，以及后端 Quartz 启停状态不一致的问题。
- 工作流纯文本输出曾以非法 JSON 写入 `workflow_run.outputs`，导致运行详情 510。写入端已改为 `JsonNode`，类型处理器对历史纯文本增加兼容读取。
- 修复版本已在 ECS 重新完成 35/35 Maven 模块构建并部署。历史 Workflow 记录可以兼容读取；新触发记录 `2107163354759081985` 的 Start/Agent/End 均为 `SUCCESS`，文本输出可正常读取。Workflow 自动化的启动和停止分别持久化为“已启用”和“已禁用”；验收后 Agent/Workflow 两项任务均保持禁用。
- React 自动化页已用生产构建复验：两类真实任务列表、Agent 消息详情、Workflow 节点详情和真实 Agent 目标下拉均可用。当前浏览器控制台只有部署切换瞬间旧页面请求已删除 chunk 的两条历史错误；服务器已将上一版哈希资源合并进当前镜像并验证旧 chunk 返回 200，部署文档同步加入保留上一版资源的步骤。
- 部署后容器重启计数均为 0；主机内存 7522 MiB，已用 3391 MiB、可用 3822 MiB，无 Swap；根盘已用 19 GiB/40 GiB。磁盘相较前一次增加主要来自首次 Maven 依赖缓存与新镜像，未执行全局 Docker prune，避免删除同机其他资源。
- 本机 Vite `127.0.0.1:3031` 与 ECS 隧道 `127.0.0.1:18080` 均返回 HTTP 200：当前开发模式确实是 React/Vite 在 Mac 本地运行、请求经 SSH 隧道到 ECS 后端；生产构建同时运行在 ECS Nginx 中供对照。
- 真实浏览器在模型推理中执行“停止”，后端进入终态；刷新后不再显示运行中。另一次运行中刷新页面后显示“重连回放中”，历史推理与后续增量恢复，未出现重复消息。
- HITL 使用内置时间工具验证：刷新后 pending 确认仍存在；“允许”后工具真实执行并返回时间，“拒绝”后工具不执行且模型明确报告未获授权。`chat_flash_test` 委派 `chat_max_test` 时渲染 `SUCCESS` 子 Agent 事件，并返回约定文本。
- 修复 Agent 工具绑定误提交运行时代码而非数据库长整型 ID 的契约错误，并修复工具编辑时后端 `language=null` 被提交为空字符串的问题。新建工具只提供后端已注册的 Java 动态加载器；无法执行的 JavaScript 演示工具已停用。
- 旧 Vue 的独立使用手册子应用已迁移为 React `/react/docs`；13 个非知识库章节、GFM 表格与代码块可访问，知识库章节与向量数据库部署说明按明确排除范围删除，旧 `/web/doc` 入口保留重定向。

## 2026-10-06 深链动作、@mention 与运维补齐（c211d01）

对 0963f2d 之后真实缺口的修复与补齐，全程未沿用"实现已完成"的结论，逐项核实：

- 账号管理：管理员创建账号（`/api/auth/admin/create-account`，加入当前默认租户）、删除账号（前端禁止删除当前账号，后端管理员保护保留）；管理员重置密码修复为 MD5 后提交（此前明文提交 change-password 契约错误）。
- 设置新增"系统介绍"页签，内容如实描述单默认租户、无知识库/本地 RAG 的范围。
- 运维页补齐：存储配置 CRUD、S3/FTP/LOCAL 协议参数、设为唯一启用配置（修正旧 UI 将 `validSuccess` 误标为连通性测试的语义）、全局附件列表/下载/批量下载/删除、附件操作日志。`ProtocolConfigDialog` 按 `id-protocol` key 重挂载，切换目标不再残留旧表单 state；secret 字段不回显、留空保留后端值；Blob 下载延迟撤销 objectURL。
- 聊天普通 Markdown 升级为 ReactMarkdown + remark-gfm，保留 Mermaid/VEP/UIP/APIP 协议块；javascript: URL 剥离。
- 旧 Vue 深链全部重定向且页面真实执行原动作：skill new/hub/edit、MCP 工具治理、automation new/edit/records、api-service new/edit、workflow new（创建一次并防重复）、chat history 按 agentId 过滤、dashboard/model/settings/ops/review 子页签。
- 聊天输入框迁移 @mention：三类真实数据源（工作空间文件树、`enabled/tools`、`enabled/skills` + 2 个内置技能），协议与 Vue 逐字节一致（`<workspace-file>路径</workspace-file>`、`<agent-tool>toolId</agent-tool>`、`<agent-skill>包名</agent-skill>` 内嵌 content）；Backspace 整块删除、IME 组合期不触发；用户消息经 TaggedText 还原标签徽标。
- 部署修复：ECS 前端镜像只打包预构建 dist，git pull 不会更新产物，本轮已在 node:22-alpine 容器内重建 dist 再构建镜像；nginx 为 `/react/index.html` 增加 `no-cache, must-revalidate`，否则部署后浏览器继续使用旧入口。

验证：`tsc -b`、Vitest 45/45（新增 mention 协议、GFM/URL 安全、路由兼容矩阵测试）、生产构建、size:check、`git diff --check` 全部通过。真实后端（本地 Vite→隧道→ECS）验证登录、`/automation/new` 深链弹窗、SkillHub、@mention 端到端（插入协议标签→发送→模型真实解析技能内容回复→标签徽标渲染）、存储配置 CRUD 闭环（创建/协议配置/删除）、控制台 0 错误、刷新恢复。ECS 生产构建复验登录、深链弹窗、SSE 真实对话（回复"部署验证"）、@mention 下拉。资源采样：容器 restarts 均 0，主机内存已用 3420MB/可用 3792MB，磁盘 19G/40G。React→0963f2d 基线镜像→React 的回滚演练完成，`rollback-83d96f0-pre` 镜像保留。

该轮结束时记录的缺口为：消息内文件标签点击预览与聊天附件点击预览尚未迁移；高级工作流节点成功矩阵、外部 A2A/第三方集成验收仍受凭据与场景限制；Chrome 之外浏览器兼容未测。前两个前端缺口已在下一节闭合。

## 2026-10-06 附件、工作空间预览与共享存储闭环

- 补齐统一 `FilePreviewDialog`：文本/代码直接读取，图片、PDF、音频、视频使用 Blob URL，未知格式诚实提示下载；关闭或切换文件时回收 URL，并防止异步加载竞态覆盖新预览。
- 聊天输入区、已发送用户消息、会话历史三处附件均可点击预览；附件前缀的序列化/解析抽成共享协议模块，避免 Chat 与 ChatHistory 各自解释同一持久化格式。
- `<workspace-file>` 消息徽标改为可交互，按当前会话调用真实 workspace download；工具与技能徽标保持非交互，避免制造不存在的详情行为。
- 真实后端闭环：创建并启用 LOCAL 存储配置，上传仓库 README，完成服务端文本解析、输入区预览、带附件发送、模型回复、历史消息恢复预览；随后把同一文件上传到会话工作空间，经 `@` 下拉插入标签、发送并点击标签完成预览。
- 首次实测失败不是前端上传缺陷：LOCAL 目录 `/home` 是每个容器私有目录，Console 可写但 Runtime 无法读取。当前开发数据改到 `/app/.apboa/storage`；代码默认改为相对路径 `.apboa/storage`，在 Compose 的 `/app` 工作目录下落入各服务共享的 `app_data:/app/.apboa`。
- 浏览器回归发现并修复 shadcn/Radix Select 从 `undefined` 切换到字符串导致的受控/非受控警告；对工作空间、工作流资源、Agent 模型、自动化目标、API 应用和 UIP 表单中的可选 Select 统一保持受控值。新开干净页面复验 warning/error 为 0。
- 验证：Vitest 14 文件/49 测试通过，`tsc -b + vite build` 通过，`size:check` 通过（React vendor 465.8 KiB/500 KiB 门槛）；ECS 使用 Maven 3.9 + Java 21 对 `runner-console`、`runner-runtime` 及全部依赖共 33 个 Reactor 模块完成 `-DskipTests package`，全部 `SUCCESS`。这里的 `skipTests` 仅证明后端可完整打包，不能替代 Java 单元测试。
- 部署：提交 `7bb9406` 已推送并同步到 `/root/ONE`、`/opt/apboa-next`；Mac 构建产物同步到 ECS 后重建前端镜像，随后用新打包 JAR 重建并滚动替换 Console/Runtime。MySQL、Redis 与数据卷未重启或清理。`/react/` 返回 200，入口带 `Cache-Control: no-cache, must-revalidate`；新浏览器标签页重新加载后登录态、真实会话列表、附件预览和 workspace-file 标签预览均通过，控制台 warning/error 为 0。回滚镜像 `apboa-dev-frontend:rollback-e7d7f19-preview`、`apboa-dev-console:rollback-e7d7f19-storage` 与 `apboa-dev-runtime:rollback-e7d7f19-storage` 已保留。
- 后端发布核验：Console、Runtime 均在 Java 21 下报告 `Application Successfully Started`，Flyway 校验 6 个迁移且数据库已是最新版本；两个新容器重启计数均为 0。Runtime 在 Console 尚未启动完时出现一次短暂心跳拒绝，之后 Console 已正常提供接口；这不是持续故障。
- 部署后采样：8 个容器重启计数均为 0；主机 7522 MiB 内存中已用 3417 MiB、可用 3795 MiB，无 Swap；根盘 40 GiB 已用 19 GiB（51%）。仅 SSH 22 公网监听，网页仍绑定 `127.0.0.1:80`。

到此 `FRONTEND_PARITY_AUDIT.md` 中已知的两个 React 前端代码缺口均闭合。仍未闭合的是外部/运行场景证据：高级工作流节点成功矩阵、外部 A2A/第三方 MCP、非 Chromium 兼容性和并发容量；这些不能被表述为已验收。

### 生产深链复核补充

- 逐条对照 Vue `router/constants.ts`、`modules/biz.ts`、`modules/common.ts`，在生产环境回归 24 个认证、资源、自动化、工作流、Dashboard、API 服务、设置与运维深链；控制台错误为 0。
- 回归发现审计表所列 `/chat-history/:agentId` 与 `/dataset-manage` 未注册（Vue 原路径分别是 `/chat/history/:agentId`、`/dashboard/dataset-manage`）。原路径一直可用，同时补上两个兼容别名，防止 React 菜单命名和交接文档产生的地址落到 404。
- 根路径从 React 自定义的 Agent 首页改回 Vue 原有的 Dashboard 首页，恢复信息结构一致性。
- 发现 `/api-service/new` 虽能重定向，但动作处理后清空全部 query 会切回 apps 页签并卸载创建弹窗；已改为仅清除动作参数并保留 `tab=apis`，本地真实后端复验弹窗、API 列表和表单均可见。
