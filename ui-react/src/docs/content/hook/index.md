# 钩子管理

钩子（Hook）是智能体执行流程中的切面扩展点，用于在关键节点插入自定义逻辑。行业实践通常在「调用前后、推理前后、工具调用前后、发生错误时」等时机挂载钩子，实现日志、鉴权、限流、审计或业务定制，而不侵入主流程代码。

## 功能概述

- 支持内置钩子和自定义钩子两种类型
- 内置钩子随系统启动自动注册，仅可启用/禁用
- 自定义钩子通过编写 Java 代码实现在线创建
- 智能体可关联多个钩子并调整执行顺序

## 核心概念

### 钩子类型

| 类型 | 说明 | 可执行操作 |
|------|------|-----------|
| **内置（BUILTIN）** | 系统预置的钩子，随启动自动注册 | 查看详情、启用/禁用 |
| **自定义（CUSTOM）** | 用户编写的钩子代码 | 查看详情、编辑、启用/禁用、删除 |

### 钩子触发时机

钩子在智能体执行流程的以下时机触发：

| 时机 | 事件类型 | 可修改 | 描述 |
|------|----------|--------|------|
| **调用前** | `PreCallEvent` | ✅ | 智能体开始处理请求之前（可修改输入消息） |
| **调用后** | `PostCallEvent` | ✅ | 智能体完成请求处理之后（可修改最终消息） |
| **推理前** | `PreReasoningEvent` | ✅ | 模型推理之前（可修改输入消息） |
| **推理后** | `PostReasoningEvent` | ✅ | 模型推理之后（可修改推理结果） |
| **推理流式期间** | `ReasoningChunkEvent` | ❌ | 流式推理的每个块（仅通知） |
| **工具执行前** | `PreActingEvent` | ✅ | 工具执行之前（可修改工具参数） |
| **工具执行后** | `PostActingEvent` | ✅ | 工具执行之后（可修改工具结果） |
| **工具流式期间** | `ActingChunkEvent` | ❌ | 工具执行进度块（仅通知） |
| **摘要生成前** | `PreSummaryEvent` | ✅ | 达到最大迭代次数时，摘要生成之前 |
| **摘要生成后** | `PostSummaryEvent` | ✅ | 摘要生成之后（可修改摘要结果） |
| **摘要流式期间** | `SummaryChunkEvent` | ❌ | 流式摘要的每个块（仅通知） |
| **错误时** | `ErrorEvent` | ❌ | 执行过程中发生错误时（仅通知） |

### 自定义钩子代码模板

自定义钩子需实现 `Hook` 接口。AgentScope Java 使用统一事件模型，所有钩子都通过 `onEvent(HookEvent)` 方法处理事件，具有类型安全和优先级排序特性。

#### 基础钩子模板

```java
import io.agentscope.core.hook.Hook;
import io.agentscope.core.hook.HookEvent;
import io.agentscope.core.hook.PreCallEvent;
import io.agentscope.core.hook.PostCallEvent;
import reactor.core.publisher.Mono;

@Component
public class CustomHook implements Hook {
    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        // 对不同事件类型进行模式匹配处理
        if (event instanceof PreCallEvent) {
            // 调用前逻辑
            System.out.println("智能体启动: " + event.getAgent().getName());
        } else if (event instanceof PostCallEvent) {
            // 调用后逻辑
            System.out.println("智能体完成: " + event.getAgent().getName());
        }
        // 必须返回事件，不要丢弃
        return Mono.just(event);
    }
}
```

#### 带优先级的钩子

```java
public class HighPriorityHook implements Hook {
    @Override
    public int priority() {
        return 10;  // 数字越小优先级越高（默认为 100）
    }

    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        // 此钩子在优先级 > 10 的钩子之前执行
        return Mono.just(event);
    }
}
```

#### 可修改事件的钩子示例

```java
import io.agentscope.core.hook.PreReasoningEvent;
import io.agentscope.core.message.Msg;
import io.agentscope.core.message.MsgRole;
import io.agentscope.core.message.TextBlock;
import java.util.ArrayList;
import java.util.List;

@Component
public class PromptEnhancingHook implements Hook {
    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        if (event instanceof PreReasoningEvent e) {
            // 在推理前向消息列表开头添加系统提示
            List<Msg> messages = new ArrayList<>(e.getInputMessages());
            messages.add(0, Msg.builder()
                    .role(MsgRole.SYSTEM)
                    .content(List.of(TextBlock.builder().text("逐步思考。").build()))
                    .build());
            e.setInputMessages(messages);  // 修改事件
            return Mono.just(event);
        }
        return Mono.just(event);
    }
}
```

## 操作指南

### 创建自定义钩子

1. 在钩子管理页面点击 **添加新钩子** 卡片
2. 填写表单：
   - **名称**：钩子名称
   - **描述**：钩子功能说明
   - **代码**：编写 Java 钩子代码（使用代码编辑器）
3. 点击确认提交

### 查看详情

点击卡片右上角菜单 → **查看**，查看钩子完整信息，包括：

- 关联的智能体列表
- 钩子类型（内置/自定义）
- 代码内容（自定义钩子）
- 启用状态

### 编辑钩子

仅自定义钩子支持编辑。点击卡片右上角菜单 → **编辑**，修改名称、描述或代码。

:::warning
修改钩子代码后，关联智能体将自动重新注册。
:::

### 启用/禁用

点击卡片右上角菜单 → **启用/禁用**，切换钩子的启用状态。

- 禁用的钩子不会参与智能体执行流程
- 若钩子正在被智能体引用，禁用时系统会弹出二次确认提示，显示引用的智能体名称

:::warning
禁用被智能体引用的钩子时，系统会显示「该钩子正在被 [xxx] 智能体引用，禁用后可能会影响上述智能体的正常使用」。
:::

### 删除钩子

仅自定义钩子支持删除。点击卡片右上角菜单 → **删除**。

- 若钩子正在被智能体引用，系统会弹出二次确认框，显示引用的智能体名称
- 若无引用，弹出常规删除确认框
- 删除操作不可恢复

:::warning
删除被智能体引用的钩子时，请确认引用方不再需要该钩子，否则可能导致智能体行为异常。
:::

### 搜索与筛选

- **类型筛选**：页面顶部分段控制器切换全部/内置/自定义
- **名称搜索**：输入关键词后回车搜索

## 在智能体中使用

在智能体配置的「工具与能力」步骤中：

1. 在 **钩子配置** 区域，按类型折叠面板浏览可用钩子
2. 勾选需要关联的钩子（Checkbox 多选）
3. 已选钩子显示在下方列表中，支持 **拖拽排序** 调整执行顺序

![钩子配置占位](images/hook-agent-config.png)

## 最佳实践

### 执行顺序

- 钩子按优先级（`priority()` 返回值）升序执行，数字越小越先执行
- 建议将前置校验类钩子（如鉴权、限流）设置高优先级（小数值）
- 日志和审计类钩子可设置较低优先级（大数值）
- 在可视化配置中支持拖拽排序，最终会转换为优先级数值

### 编写自定义钩子

- **避免阻塞**：钩子代码应无阻塞操作，使用响应式编程模型，避免影响主流程性能
- **正确处理事件**：必须使用 `Mono.just(event)` 返回事件（修改后或原事件），不要返回空或丢弃事件
- **错误处理**：应使用 `Mono.error()` 传播错误，而非直接抛出异常
- **类型匹配**：使用 `instanceof` 进行事件类型匹配，确保只处理关心的时机
- **修改约束**：仅当事件类型标记为“可修改”时，才能调用 setter 方法修改事件内容

### 监控工具执行示例

```java
import io.agentscope.core.hook.PostActingEvent;
import io.agentscope.core.hook.PreActingEvent;
import io.agentscope.core.message.TextBlock;

public class ToolMonitorHook implements Hook {
    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        if (event instanceof PreActingEvent e) {
            System.out.println("调用工具: " + e.getToolUse().getName());
            System.out.println("参数: " + e.getToolUse().getInput());
        } else if (event instanceof PostActingEvent e) {
            String resultText = e.getToolResult().getOutput().stream()
                    .filter(block -> block instanceof TextBlock)
                    .map(block -> ((TextBlock) block).getText())
                    .findFirst()
                    .orElse("");
            System.out.println("工具结果: " + resultText);
        }
        return Mono.just(event);
    }
}
```

### 错误监控示例

```java
import io.agentscope.core.hook.ErrorEvent;

public class ErrorHandlingHook implements Hook {
    @Override
    public <T extends HookEvent> Mono<T> onEvent(T event) {
        if (event instanceof ErrorEvent e) {
            System.err.println("智能体错误: " + e.getAgent().getName());
            System.err.println("错误消息: " + e.getError().getMessage());
            // ErrorEvent 不可修改，仅用于通知
        }
        return Mono.just(event);
    }
}
```

## 内置 JSONL 跟踪导出器

AgentScope Java 提供了内置的 JSONL 导出器，用于本地调试和离线排障，可导出完整的 prompt、消息、工具输入及错误堆栈。

```java
import io.agentscope.core.hook.recorder.JsonlTraceExporter;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

public class JsonlTraceExample {
    public void run(Model model, Toolkit toolkit) throws IOException {
        try (JsonlTraceExporter exporter =
                JsonlTraceExporter.builder(Path.of("logs", "agentscope-trace.jsonl"))
                        .includeReasoningChunks(true)  // 可选：包含推理流式块
                        .includeActingChunks(true)     // 可选：包含工具流式块
                        .build()) {
            ReActAgent agent = ReActAgent.builder()
                    .name("Assistant")
                    .model(model)
                    .toolkit(toolkit)
                    .hooks(List.of(exporter))
                    .build();
            // 在 exporter 关闭前使用 agent
        }
    }
}
```

:::warning
JSONL 跟踪导出器会将完整 prompt、消息、工具输入及错误堆栈写入本地文件。这些记录可能包含敏感用户数据、凭据或其他机密信息，因此**只能在受信任的环境中启用**，并应将输出文件按敏感数据处理。
:::


## 查看详情

点击卡片右上角菜单 → **查看**，查看钩子完整信息，详情弹窗展示以下字段：

| 字段 | 说明 |
|------|------|
| **关联智能体** | 引用此钩子的智能体列表 |
| **类型** | 内置（BUILTIN）或自定义（CUSTOM） |
| **名称** | 钩子名称 |
| **描述** | 钩子功能说明 |
| **类路径** | 钩子的 Java 类路径（如 `com.hxh.apboa.engine.hook.xxx`） |
| **优先级** | 执行优先级数值，数字越小优先级越高 |
| **状态** | 启用 / 禁用 |
| **钩子内容** | 自定义钩子的完整 Java 代码（以代码块形式展示） |


## 权限说明

| 操作 | 所需角色 |
|------|----------|
| 查看钩子列表与详情 | 所有租户成员 |
| 创建、编辑、删除自定义钩子 | 租户编辑者、租户管理员、租户所有者 |
| 启用/禁用钩子 | 租户编辑者、租户管理员、租户所有者 |


## 常见问题

### 自定义钩子代码保存后不生效？

- 修改钩子代码后，关联的智能体会自动重新注册，无需手动操作
- 如果仍不生效，检查代码是否存在编译错误（如缺少 import、语法错误等）
- 确认钩子已处于启用状态

### 钩子的优先级如何设置？

- 在代码中通过 `priority()` 方法返回优先级数值，默认为 100
- 数字越小优先级越高，越先执行
- 建议：鉴权类钩子设为 10，日志类钩子设为 200
- 在智能体配置中支持拖拽排序，系统会自动转换为优先级数值

### 钩子和工具是什么关系？

- 钩子是执行流程的切面扩展点，在特定时机（如调用前后、推理前后、工具执行前后）触发
- 工具是智能体的执行能力，提供具体的功能实现
- 钩子可以在工具执行前后拦截和修改工具调用参数与结果
- 例如：通过 `PreActingEvent` 可以在工具执行前修改参数，通过 `PostActingEvent` 可以修改工具返回结果

### 内置钩子和自定义钩子有什么区别？

- **内置钩子**：随系统启动自动注册，不可编辑和删除，仅可启用/禁用
- **自定义钩子**：用户通过在线编写 Java 代码创建，支持完整 CRUD
- 筛选为「内置」类型时，新增卡片自动隐藏

### 钩子代码中如何获取智能体信息？

- 所有事件对象都提供 `getAgent()` 方法，可获取当前执行的智能体实例
- 通过 `event.getAgent().getName()` 获取智能体名称
- 通过 `event.getAgent().getDefinition()` 获取智能体定义配置

### 删除钩子提示"正在被智能体引用"？

- 进入钩子详情，查看关联的智能体列表
- 在相关智能体的配置中解除钩子关联
- 然后重新执行删除操作
- 也可以在二次确认框中直接确认删除，但需确保引用方可以容忍钩子缺失

### 钩子执行出错会影响智能体正常运行吗？

- 钩子中应使用 `Mono.error()` 传播错误，而非直接抛出异常
- 如果钩子抛出未捕获的异常，可能会导致智能体执行流程中断
- 建议为关键钩子添加完善的异常处理逻辑，确保错误可控
- 可配合 `ErrorEvent` 类型的钩子来监控智能体运行错误
