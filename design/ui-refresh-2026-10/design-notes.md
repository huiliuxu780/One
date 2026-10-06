# Apboa Next 控制台 · 设计说明（轮次 01）

## 意图与档位
- 意图：优化 UI（视觉语言系统性重定），流程与功能沿用现状。
- 档位：**升级**（重新决定字体关系、色彩比例、密度、组件样子；保留页面结构与全局导航）。
- 阶段：方向已选定（02 纸墨编辑），本轮交付 HTML 原型；尚未进入项目代码。

## 选定方向：纸墨编辑
- 北极星：让一个长时间使用的 AI 智能体工作台，读起来像一份被认真排印的刊物——安静、可扫读、有纸的温度，重点只有一处朱色。
- 参考：ui.oiloil.org/works/cards/live（绎卡）；取证 shots/ref/page.png。
- 品牌资产处置：原品牌蓝 #1769e0 让位于朱色 #b23a2c（用户以参考页背书）；Logo 字形保留，改以墨线方章呈现。

## 规范（proto.css 为源头，落地时映射到 ui-react/src/styles.css）
- 表面：纸 #f2efe9 / 沉底 #eae6dd / 卡片 #fcfbf8。
- 墨色三级：#26231e / #57534a / #8a857a；线：#ded8cb / #cbc4b4。
- 重点：朱 #b23a2c、深朱 #8f2d22、朱底 #f3e3de；状态绿 #567d5e、琥珀 #9a6b2f。
- 圆角三档：6 / 5 / 4；阴影仅浮层一处。
- 字族三层：宋体衬线（标题、卡名、大数字）／苹方无衬线（正文 12.5–13.5）／等宽（编码、计数、时间、键值右侧）。
- 组件语言：发丝线表格与分隔、圆点+文字状态、`#` 前缀文字标签、下划线式 Tab、墨线方章 Logo、⌘ 提示进主按钮。

## 代表页与状态
- agents.html：卡片网格（列表型表面）。
- chat.html：会话转录（重度界面）；状态 idle / done / running / error，用 `?state=` 切换。
- dashboard.html：表格 + 指标卡（数据型表面）。
- 结构沿用现状：全局侧栏导航、聊天页 260px 会话栏 + 会话区 + 底部输入、工作台 Tab + 表格。

## 未做与原因
- Workflow 编辑器（xyflow 画布）单独一轮处理，画布网格与节点样式需专项设计。
- 深色模式：本轮不做；token 已按"表面/墨色/线/重点"分层，后续加 dark 组只需换值。
- 移动端：桌面工作台产品，仅保证 ≥1024px 不破版。

## 验收重点
- 中文衬线标题在多行与窄栏下的换行；等宽数字对齐；发丝线在 200% 下不断线。
- 朱色只出现在：主按钮、激活导航、选中态、下划线 Tab、错误与警示——逐页清点不越界。

## 实施记录（轮次 01 落地）
- 落地范围：styles.css token 全量换装；共享组件（button/card/badge/table/tabs/input/textarea/select/switch/dialog/sheet/alert-dialog/tooltip/command/pagination）；外壳（侧栏 216px、墨圆头像、topbar 面包屑+等宽日期、导航遮罩）；硬编码色板清零（emerald/amber/violet/cyan/indigo/slate → success/warning/neutral 语义）；试点页 agents / dashboard / chat / login。
- 新增全产品语汇：.stat 圆点+文字、.tag # 前缀文字（styles.css）。
- 验证：type-check 通过；vitest 38 文件 121 测试全过；真实渲染截图 shots/v2-{agent,dashboard,chat,login}/page.png（mock API 支撑，mock-api.mjs 在任务目录、不入库）。

## 独立评审一轮（存量润色口径，不打分）与处理
- 越界色全改：侧栏头像改墨圆、卡片"对话"改描边、机器人 tile 改纸底、开关 ON 改绿、禁用发送改沉底。
- 可观察瑕疵修：侧栏末项裁切加渐隐遮罩、textarea 原生 resize 角标去除、会话列与侧栏表面分级。
- 结构对齐规范：补 topbar（面包屑+等宽日期）、表格 Tab 通栏发丝线+朱色激活下划线、工作台面板顶空带改工具行、默认行隐藏"设为默认"。
- 可删文字照删：登录页栈自述/变更日志/默认组织模式、品牌下 React workspace、agents 大写 kicker、工作台 sub 后半句。
- 规范补件登记：switch ON=绿 #567d5e（状态语汇延伸）；按钮 disabled=沉底底+次要字；登录页模式（纸面品牌墙+衬线主标题+等宽元信息）。
- 未采纳：无（本轮评审无与用户锁定项冲突的提议）。

## 遗留
- 聊天历史会话视图的真实截图未取得（截图工具的点击步骤在该页不稳定）；会话表面沿用既有气泡标记+新 token，风险可控。
- Workflow 编辑器（xyflow）专项一轮、深色模式、移动端：未做，见上节原因。

## 全量扫尾（加速轮）
- 其余页面机械扫尾：rounded-xl/2xl → rounded-lg；页标题 text-2xl/xl font-semibold → font-display 26/22px bold；text-lg/base font-semibold 补 font-display。覆盖 settings/workflow/model/mcp/skills 等全部存量页。
- 关键修复：styles.css 的 `* { border-color: var(--border) }` 原在层外，Tailwind v4 中层外规则压过 @layer utilities 的全部 border-color 工具类（导致 Tab 朱色下划线、卡片 hover 边、输入 focus 边失效）。已移入 @layer base。证据：shots/crop-tabs-2x.png 修复前后对比。
- 补截：shots/v2-{workflow,settings,model}/page.png（空态/列表表面均合规）。
- Workflow 编辑器（xyflow 画布/节点/检查器）专项由独立子 Agent 并行处理，文件范围限 pages/workflow-editor-page.tsx 与 features/workflow/。

## 收尾（加速轮完成）
- Workflow 编辑器专项（独立子 Agent）完成：画布发丝点阵+纸底、节点白纸卡+等宽类型标+圆点状态、双栏沉底、检查器面板卡与等宽键值、上下文菜单浮层规格；顺带修复 Tailwind v4 下失效的 `!size-2.5` 前置叹号死类（Handle）。证据 shots/v2-wf-editor/page.png。
- 共享层补件（子 Agent 上报后由主 Agent 落地）：.stat.warn 琥珀点；dropdown 菜单圆角统一 rounded-md；.react-flow__attribution a 收墨三级；Dialog/Sheet Description 12.5px。
- 工作流列表状态改圆点+文字（已发布/草稿/锁定）。
- 编辑器顶栏流程名 truncate 防折行。
- 终检：type-check 通过；vitest 38 文件 121 测试全过。验证环境（vite 3032 + mock 3060）已停止。
