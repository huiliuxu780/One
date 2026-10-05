# Apboa Next React 迁移基线

更新日期：2026-10-05

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
| Agent 配置 | `components/agent/` | 自定义 Agent 与 A2A 创建编辑、模型、工具、技能、MCP、Hook、子 Agent、工作流、记忆、调度、统计、版本 | Agent、A2A、job、statistics API | 待迁移 |
| 聊天会话 | `views/Chat/`、`components/chat/` | 会话 CRUD、消息树、刷新恢复 | chatSession API | 待迁移 |
| AG-UI 流 | `api/agui/agent-client.ts` | 文本、推理、工具、状态补丁、停止、重连 | Runtime AG-UI、SSE | 待迁移 |
| 交互消息 | markdown VEP/APIP、Plan、SubAgent | 图表、表单、确认、任务计划、子 Agent 事件 | AG-UI 事件 | 待迁移 |
| 工作空间 | `components/workspace/` | 上传、下载、批量下载、预览、树操作 | workspace、attach API | 待迁移 |
| Models | `views/Model/` | 供应商、模型配置、扩展参数 | model API | 待迁移 |
| Skills | `views/Skill/` | 列表、导入、编辑器、文件树、关联工具、SkillHub | skill、skillHub API | 待迁移 |
| Tools | `views/Tool/` | CRUD、代码编辑、调试 | tool API | 待迁移 |
| MCP | `views/Mcp/` | CRUD、激活、调试、工具治理 | mcp API | 待迁移 |
| Hook | `views/Hook/` | CRUD、优先级、代码编辑 | hook API | 待迁移 |
| Prompt | `views/Prompt/` | CRUD、模板编辑 | prompt API | 待迁移 |
| 敏感词 | `views/Sensitive/` | CRUD、词条编辑 | sensitive API | 待迁移 |
| 自动化 | `views/Automation/` | 列表、Cron 编辑、目标输入、手动运行、记录 | automation API | 待迁移 |
| 工作流 | `views/Workflow/` | React Flow 画布、节点面板、校验、保存、发布、运行调试、版本 | workflow、workflowResources API | 待迁移 |
| 工作台 | `views/Dashboard/` | 面板运行、数据集、设计器、历史版本 | dashboard API | 待迁移 |
| API 服务 | `views/ApiService/` | API、应用、日志 | apiService API、runner-gateway | 待迁移 |
| 运维与设置 | `views/Ops/`、`views/Settings/` | 账号、系统参数、API Key、节点监控、存储 | account、params、sk、heartbeat、storage API | 待迁移，租户页排除 |
| 审查 | `views/Review/` | Agent 与工作流审查 | 对应业务 API | 待迁移 |

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
