# 开发模式与访问拓扑

更新日期：2026-10-05

本文定义三种使用方式：**直接访问 ECS 已部署前端**、**本地 Vite + ECS 后端（目标开发模式）**、**ECS 侧零本地 Node 的开发容器**，以及无 GitHub 凭据时的代码同步方法。

## 1. 当前真实拓扑（ECS 单机全栈）

```text
本地浏览器
   ↓ SSH 隧道（需自行建立，见下）
ECS Nginx（127.0.0.1:80，容器内）
   ├─ /react/        React 静态构建
   ├─ /api/runtime/  → runtime:3061
   ├─ /api/ws/       → websocket:3064
   └─ /api/          → console:3060
                        MySQL / Redis 仅 Docker 内部网络
```

- 前端只监听 ECS 回环地址；无 TLS 前不开放公网明文登录（Spec 第 8 节）。
- 公网 80 端口被云安全组拦截，因此**必须走 SSH 隧道**。

访问已部署前端：

```bash
ssh -N -L 18080:127.0.0.1:80 root@8.160.183.108
# 浏览器打开 http://127.0.0.1:18080/react/
```

## 2. 目标开发模式：本地 Vite + ECS 后端

### 方式 A（推荐）：单隧道经 ECS Nginx，保留 /api 原路径

```bash
# 终端 1：隧道（Nginx 已按最长前缀匹配 /api/runtime、/api/ws、/api）
ssh -N -L 18080:127.0.0.1:80 root@8.160.183.108

# 终端 2：本地 Vite，nginx 代理模式不做路径改写
cd ui-react
VITE_DEV_PROXY_MODE=nginx pnpm dev
# 打开 http://localhost:3031
```

`VITE_DEV_PROXY_MODE=nginx` 时 Vite 将 `/api`（含 SSE 与 WebSocket 升级）原样转发到 `VITE_DEV_NGINX_TARGET`（默认 `http://127.0.0.1:18080`），由 ECS Nginx 负责剥离前缀与路由。

### 方式 B：三服务直连隧道

```bash
ssh -N -L 3060:127.0.0.1:3060 -L 3061:127.0.0.1:3061 -L 3064:127.0.0.1:3064 root@8.160.183.108
cd ui-react && pnpm dev   # 默认 services 模式，Vite 剥离 /api 后直连三服务
```

可用 `VITE_DEV_CONSOLE_TARGET` / `VITE_DEV_RUNTIME_TARGET` / `VITE_DEV_WS_TARGET` 覆盖三个目标地址。

## 3. 代码同步（无 GitHub 凭据时）

ECS 上的工作副本为 `/root/ONE`（分支 `codex/react-migration`）。在 Mac 上直接经 SSH 拉取：

```bash
cd ~/ONE
git remote add ecs root@8.160.183.108:/root/ONE   # 已存在则跳过
git fetch ecs
git checkout -B codex/react-migration ecs/codex/react-migration
```

或使用随仓库生成的 bundle（`/root/one-migration.bundle`，含完整历史）：

```bash
scp root@8.160.183.108:/root/one-migration.bundle .
git fetch one-migration.bundle codex/react-migration:codex/react-migration
```

## 4. 本地工具链

- Node ≥ 22.12，pnpm 9.4.0（`package.json` 的 `packageManager` 字段指定）。
- 若 corepack 缓存损坏（报缺少 `pnpm.cjs`）：

```bash
rm -rf "$HOME/.cache/node/corepack"
corepack enable && corepack prepare pnpm@9.4.0 --activate
# 或直接：npm i -g pnpm@9.4.0
```

- `pnpm install && pnpm dev`；质量门槛：`pnpm type-check && pnpm test && pnpm build && pnpm size:check`。

## 5. ECS 侧开发容器（本地零 Node）

```bash
cd deploy/dev
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ui-react-dev.yml up -d ui-react-dev
# SSH 隧道转发 3031 后打开 http://127.0.0.1:3031（HMR 直连 ECS 后端）
```

## 6. 可执行回滚镜像

旧 Vue 前端已构建为不可变镜像并验证可运行（仅保留源码不构成可执行回滚，见 Spec RM-09）：

- `apboa-vue-rollback:20261005`：Vue 构建产物 + 上游 Nginx 配置。
- `apboa-vue-rollback:20261005-exec`：在其上补启动入口（上游 `nginx.conf` 的 `${RUNTIME_HOST}` 等占位符不会被官方 entrypoint 替换，且写死 `apboa-console` 主机名；入口脚本以 sed 精确替换，保留 nginx 自身变量）。

验证记录：容器加入 dev 网络后 `/web/` 返回 200（标题「Apboa Next智能体平台」），经其 Nginx 代理的 `/api/auth/login` 返回 `code=200` 与真实令牌。

```bash
docker run -d --name vue-rollback --network apboa-dev_backend \
  -p 127.0.0.1:18081:80 apboa-vue-rollback:20261005-exec
# 访问 http://127.0.0.1:18081/web/
# 默认指向 dev 网络服务名；可用 RUNTIME_HOST/RUNTIME_PORT/WEBSOCKET_HOST/
# WEBSOCKET_PORT/CONSOLE_HOST 覆盖
```

回滚演练（React → Vue → React）与容量采样属 G8 上线阶段，需在切换窗口执行并记录。
