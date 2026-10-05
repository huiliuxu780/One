# React 前端开发与部署

当前管理台使用 React + TypeScript + Vite。Java 21、Spring Boot 与 AgentScope 后端保持不变；开发环境不启用本地 RAG，也不需要向量数据库。

## 环境要求

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Node.js | 22.12+ | 本地前端开发与构建 |
| pnpm | 9.4.0 | 前端依赖管理 |
| JDK | 21+ | 后端构建 |
| Docker Engine | 20.10+ | ECS 容器运行 |
| Docker Compose | v2 | 开发环境编排 |

运行时保留 MySQL、Redis、Console、Runtime、Proxy 和 WebSocket；API 服务验收时才启用内部 Gateway。MySQL、Redis 和 Java 服务端口不应暴露到公网。

## 本地 React + ECS 后端

先建立仅绑定本机的 SSH 隧道：

```bash
ssh -N -L 18080:127.0.0.1:80 <ECS_USER>@<ECS_HOST>
```

然后在 `ui-react` 中启动 Vite：

```bash
VITE_DEV_PROXY_MODE=nginx pnpm dev
```

Vite 会保留 `/api`、`/api/runtime` 和 `/api/ws` 路径，通过隧道交给 ECS Nginx 路由。浏览器访问本地 Vite 地址即可获得热更新，同时使用 ECS 的真实后端。

## 质量门禁

提交前运行：

```bash
pnpm type-check
pnpm test -- --run
pnpm build
pnpm size:check
```

生产构建产物位于 `ui-react/dist`。不要把环境变量、模型密钥、服务器私钥或数据库凭据写入源码、构建产物或日志。

## ECS 开发部署

开发编排位于 `deploy/dev/docker-compose.yml`。先复制并填写服务器本地的 `.env`，该文件已从版本控制排除。首次部署前应检查端口、磁盘、内存以及现有 Docker 资源，避免覆盖同机应用。

```bash
cd deploy/dev
docker compose --env-file .env build --pull=false
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

网页入口默认只绑定 ECS 的 `127.0.0.1:80`，通过 SSH 隧道访问 `http://127.0.0.1:18080/react/`。如需启用内部 API Gateway：

```bash
docker compose --env-file .env --profile gateway up -d gateway
```

## 静态资源与回滚

前端滚动更新时，应在新镜像中保留上一版 `assets/` 文件，避免已经打开的页面继续请求旧哈希 chunk 时出现 404。切换前给当前镜像打回滚标签，切换后验证 React 入口、API、SSE 和 WebSocket。

回滚只替换应用镜像，不删除 MySQL、Redis 或应用数据卷。仓库还保留独立 Vue 回滚镜像，用于新入口故障时恢复旧管理台。

## 资源边界

4 核 8GB 机器能否承载开发环境必须以实际采样为准，不能只凭规格判断。构建尽量在开发机完成，ECS 负责运行和联调；同时为操作系统、数据库和构建过程保留内存与磁盘余量。
