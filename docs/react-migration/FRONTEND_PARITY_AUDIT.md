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
| `layout/`、`components/layout/` | 侧栏导航、用户菜单、退出 | 无/`auth` | `app-shell.tsx` | 已验证 | 菜单按能力隐藏；后端权限为最终边界 |
| `pages/Login.vue` | 登录、Token 刷新 | `/api/auth/login`、refresh | `login-page.tsx`、`client.ts` | 已验证 | 登录响应必须含默认租户 `tenantId=1`；401 单飞刷新有 MSW 单测 |
| 路由守卫 | 未登录跳登录 | — | `protected-route.tsx` | 已验证 | 登录后进入应用（Vue 登录后固定跳 dashboard，不回跳深链；React 行为一致） |
| 403/404/500 | 错误页 | — | `error-pages.tsx` | 已验证 | 404 文案已去除"尚未迁移"过时表述 |
| — | — | — | `/register` → `auth-availability-page.tsx` | 已迁移未验证 | Vue 页面为虚假占位（无后端注册接口）；React 明确说明默认组织关闭自助注册 |
| — | — | — | `/forgot-password` → `auth-availability-page.tsx` | 已迁移未验证 | Vue 页面为虚假占位（验证码+成功提示无接口）；React 明确说明需管理员重置 |
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
| API 文档、统计、调度 | 页签查看 | statistics/job API | `agent-editor.tsx` | 已迁移未验证 | 本轮未重查弹窗矩阵 |
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
| @mention 工作空间文件 | `@` 插入文件标签 | `GET /api/runtime/workspace/files?sessionId=` | `features/chat/mention*` | 已迁移未验证 | 标签协议 `<workspace-file>路径</workspace-file>`；文件树扁平化取文件节点 |
| @mention Agent 工具 | `@` 插入工具标签 | `GET /api/agent/definition/{id}/enabled/tools` | 同上 | 已迁移未验证 | 标签内容 = `toolId` |
| @mention Agent 技能 | `@` 插入技能标签 | `GET /api/agent/definition/{id}/enabled/skills` | 同上 | 已迁移未验证 | 标签内容 = 技能包 `name`；展示 alias；含 2 个内置技能（交互/视觉增强） |
| 下拉交互 | 搜索过滤、↑↓/Enter/Esc 键盘、分类分组 | 无（前端过滤） | `mention-dropdown.tsx` | 已迁移未验证 | Vue 为主页+文件夹二级页；React 为平铺分组，键盘行为一致 |
| 标签插入/删除 | 光标处插入协议标签；Backspace 整块删除 | 无 | `chat-page.tsx` | 已迁移未验证 | React 用 textarea 呈现协议原文（所见即发送）；Vue contenteditable 渲染 chip。协议文本逐字节一致；IME 由 textarea 原生处理 |
| 消息标签渲染 | 用户消息还原标签徽标 | 无 | `tagged-text.tsx` | 已迁移未验证 | 等价 Vue `TaggedContentRenderer`；文本段纯文本+标签 chip；未注册标签退化纯文本 |
| 消息内文件标签点击预览 | 打开文件预览弹层 | workspace download | 无 | **缺失** | Vue `WorkspaceFileTag` 点击预览；React 当前为静态 chip |
| 附件点击预览 | MediaPreview 弹层 | attach download | 无（列表页预览除外） | **缺失** | 聊天附件条点击预览未迁移 |
| 上下文压缩指示 | 圆环+分级变色+tooltip | AG-UI state | `ContextBadge`（简化） | 已迁移未验证 | 百分比与压缩中状态已有；分级变色/tooltip 简化 |
| 大文件分片上传 | — | `/api/attach/chunk-upload` | 无 | **死代码** | 证据：`ui/src/chunkfile/index.ts` 完整实现但全仓库零引用；`uploadChunk`（`ui/src/api/attach.ts:66-76`）仅被该死代码调用；聊天附件实际走单文件 `/api/attach/upload`。不迁移 |
| `views/ChatHistory/` | 历史会话/消息树/分支切换/编辑当前消息 | session page/messages | `chat-history-page.tsx` | 已验证 | — |
| `views/ChatHistory/:agentId` | 按智能体过滤 | pageSessions `agentId` | `chat-history-page.tsx` | 已迁移未验证 | 本轮接通；顶部显示过滤条 |

## 4. 工作空间

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `components/workspace/` | 上传（单/批/压缩包）、树、删除、清空 | workspace API | `workspace-page.tsx` | 已验证 | 容量与后端一致；LICENSE 下载 SHA-256 校验通过 |
| 下载 | 单/批/全部 | download/batch/all | `workspace-page.tsx` | 已验证 | — |
| 预览 | 文本/图片/音视频/PDF | download | `workspace-page.tsx` | 已迁移未验证 | 多类型预览矩阵待验收（MIGRATION.md 遗留项） |

## 5. 资源管理（Models/Skills/Tools/MCP/Hook/Prompt/Sensitive/Memory/CodeExec/Studio）

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Model/` | 供应商/模型 CRUD、连通性测试、密钥留空不修改 | model API | `model-page.tsx` | 已验证 | DashScope OpenAI 兼容模式两模型连接成功 |
| `/model/:providerId/config` 深链 | 打开供应商配置 | — | `?tab=provider&providerId=` | 已迁移未验证 | 本轮接通 query 读取 |
| `views/Skill/` | 新建/导入（本地/Git/ZIP）/文件树编辑/工具关联/下载/同步 | skill API | `skill-page.tsx` | 已验证 | — |
| `/skill/new` 深链 | 打开新建弹窗 | — | `?action=new` | 已迁移未验证 | Vue 是整页+弹窗→replace 到编辑页；React 等价为新建弹窗（React 无独立编辑页） |
| `/skill/hub` 深链 | 打开 SkillHub | — | `?hub=1` | 已迁移未验证 | Vue 为独立整页；React 为 Sheet，搜索/导入一致 |
| `/skill/:id/edit` 深链 | 打开指定技能编辑 | `/api/skill/{id}`、`/tree` | `?edit=ID` → 文件管理 Sheet | 已迁移未验证 | Vue 为整页文件树+Monaco；React 为文件树+CodeMirror Sheet，无效 ID toast 明确报错（Vue 静默空壳） |
| `views/Tool/` | CRUD、代码编辑、调试 | tool API | `resource-pages.tsx` | 已验证 | 工具绑定提交数据库 ID（契约修复后） |
| `views/Mcp/` | CRUD、激活、同步、工具治理、调试 | mcp API | `mcp-page.tsx` | 已验证 | 调试展示原始错误 |
| `/mcp/:serverId/tools` 深链 | 打开指定 Server 工具治理 | `/api/mcp/server/{id}`、`/tools` | `?tools=ID` | 已迁移未验证 | 无效 ID toast 明确报错（Vue 静默空态） |
| `views/Hook/`、`views/Prompt/`、`views/Sensitive/` 等 | CRUD/占用检查 | 对应 API | `resource-pages.tsx` | 已验证 | 统一 CRUD 引擎 |
| 密钥字段 | 留空不修改语义 | — | 各表单 | 已验证 | 后端密文不回显 |

## 6. 自动化

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Automation/` | 列表、CRUD、启停、手动触发、记录 | `/api/runtime/job/*` | `automation-page.tsx` | 已验证 | Agent/Workflow 两类真实触发均通过；失败审计受后端 schema 限制 |
| `/automation/new` 深链 | 打开新建表单 | — | `?action=new` | 已迁移未验证 | Vue 为整页表单；React 为弹窗 |
| `/automation/:id/edit` 深链 | 加载任务编辑 | `/api/runtime/job/{id}` | `?edit=ID` | 已迁移未验证 | 200+空 data → "任务不存在" toast（与 Vue 语义一致） |
| `/automation/:id/records` 深链 | 打开执行记录 | job/{id}、job/records | `?records=ID` | 已迁移未验证 | — |

## 7. 工作流

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Workflow/` | 列表、复制、锁定、删除、强制删除 | workflow API | `workflow-page.tsx` | 已验证 | — |
| `/workflow/new` 深链 | 创建进入编辑器 | workflowSave | `?create=1` → 创建一次 → `/workflow/{id}/edit` | 已迁移未验证 | Vue 打开未保存草稿画布（保存时才创建、无防重）；React 架构要求先建后编，深链严格防重复创建。行为差异已在备注声明 |
| `/workflow/:id` 深链 | 打开编辑器 | — | 重定向 `/workflow/{id}/edit` | 已迁移未验证 | — |
| `components/workflow/` | React Flow 画布、节点配置、校验、保存、发布、版本、调试 | workflow/workflowResources API | `workflow-editor-page.tsx` | 已验证 | toBackendDefinition round-trip 单测；回声流程发布/运行通过 |
| 高级节点矩阵 | 分支/循环/DB/MQ/Channel 运行 | — | 同上 | 已迁移未验证 | 高级节点成功矩阵缺失（REMAINING_SPEC §8.5） |
| 知识库节点 | — | — | 只读提示不改写 | 明确排除 | 加载旧流程不静默改写 |
| `views/WorkflowResources/` | Datasource/Cache/MQ/Channel CRUD | workflowResources API | `workflow-resources-page.tsx` | 已迁移未验证 | 密码留空不修改 |

## 8. 工作台与 API 服务

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `views/Dashboard/` | 看板 CRUD/默认项/启停、数据集真实执行、设计器、历史版本 | dashboard API | `dashboard-page.tsx` | 已验证 | 错误原文直接展示 |
| `/dashboard/design`、`/dataset-manage` 深链 | 打开设计器/数据集 | — | 重定向 `?tab=datasets` | 已迁移未验证 | React 无独立设计器路由，落数据集页签 |
| `views/ApiService/` | 应用/API CRUD、上下线、日志 | `/api/gateway/*` | `api-service-page.tsx` | 已验证 | 真实上线/调用/日志/下线通过 |
| `/api-service/new` 深链 | 打开新建 API | — | `?tab=apis&action=new` | 已迁移未验证 | Vue 打开时不创建任何数据；React 仅打开弹窗 |
| `/api-service/:id/edit` 深链 | 加载 API 编辑 | `/api/gateway/api/{id}` | `?tab=apis&edit=ID` | 已迁移未验证 | 无效 ID toast（Vue 语义一致） |
| `/api-service/logs`、`/apps` 深链 | 打开对应页签 | — | `?tab=logs`/`?tab=apps` | 已迁移未验证 | — |
| `views/Review/` | Agent/Workflow 审查 | 无审查 API | `review-page.tsx` | 旧版假功能 | 诚实空态，不伪装 |

## 9. 设置与运维

| Vue 入口 | 用户操作 | Vue 接口 | React 目标 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- |
| `components/settings/` 账号 | 列表、新建、启用切换、重置密码（MD5）、删除 | `/api/account/*`、`/api/auth/admin/create-account` | `settings-page.tsx` | 已迁移未验证 | 新建加入当前默认租户（后端从 token 注入）；前端禁止删除当前账号，后端另有管理员保护 |
| `/settings/account` 等深链 | 打开对应页签 | — | `?tab=` 重定向 | 已迁移未验证 | 含 system-params/api-keys/system-intro |
| `/settings/tenant*` 深链 | 组织管理 | — | 重定向回设置 | 明确排除 | 多租户操作页排除 |
| API Key | 创建一次性展示完整值 | `/api/sk/*` | `settings-page.tsx` | 已验证 | — |
| 系统参数 | CRUD | `/api/params/*` | `settings-page.tsx` | 已验证 | — |
| 系统介绍 | 查看 | 静态 | `SystemIntroTab` | 已迁移未验证 | 内容适配单默认租户、无知识库/本地 RAG 的真实范围 |
| 个人资料/修改密码 | 查看/更新 | account API | `profile-page.tsx`、`change-password-page.tsx` | 已验证 | MD5 后提交与 Vue 一致 |
| `views/Ops/` 节点监控 | 执行节点/WS 节点 15s 轮询 | heartbeat API | `ops-page.tsx` | 已验证 | — |
| `/ops/monitor`、`/ops/storage` 深链 | 打开页签 | — | `?tab=` 重定向 | 已迁移未验证 | — |
| 存储配置 | 新增/编辑/删除/协议配置（S3/FTP/LOCAL）/设为唯一启用 | `/api/storage/*` | `ops-page.tsx` StorageTab | 已迁移未验证 | 旧 UI 曾把 `validSuccess` 误标"连通性测试"，已修正为"设为唯一启用"；协议切换清空 protocolConfig 在表单中有明确提示；ProtocolConfigDialog 按 `id-protocol` key 重挂载，切换目标不残留旧 state；password 字段不回显、留空保留原值 |
| `FileManager.vue` 附件 | 分页/单个下载/删除 | `/api/attach/page`、download、delete | `ops-page.tsx` FilesTab | 已迁移未验证 | Vue 下载即 revokeObjectURL；React 延迟 10s 回收更稳妥 |
| 批量下载 | 多选打包下载 | `/api/attach/batchDownload` | `ops-page.tsx` | 已迁移未验证（React 增强） | **Vue 中该 API 无任何 UI 调用**（仅 `ui/src/api/attach.ts:92` 封装）；React 补充真实接口入口 |
| `FileLog.vue` | 日志分页/类型过滤 | `/api/attach/log/page` | `ops-page.tsx` FileLogsTab | 已迁移未验证 | — |
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

1. 消息内 workspace-file 标签点击预览、聊天附件点击预览弹层（缺失）。
2. 高级工作流节点成功运行矩阵、外部 A2A/第三方 MCP 集成凭据验收（REMAINING_SPEC §8）。
3. 本轮新增功能（账号 CRUD、存储 CRUD、附件管理、深链动作、@mention）的真实后端与浏览器回归。
4. 生产构建、bundle 体积检查、ECS 部署与回滚演练。

## 12. 结论口径

在 §11 全部闭合之前，不允许使用"全部前端功能迁移完毕"的表述。当前准确表述为：**保留范围内主体功能已迁移并经真实后端验证；本轮补齐的深链动作、@mention、账号/存储/附件管理与 Markdown GFM 已实现并通过单测与类型检查，等待真实后端回归；存在 2 个已声明的小缺口与若干依赖凭据的集成验收项。**
