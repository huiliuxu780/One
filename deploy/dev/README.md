# ECS 开发部署

该编排针对 4 vCPU、8GB 内存、40GB 磁盘的单机开发环境，不等同于上游生产拓扑。

## 约束

- 只映射 Nginx 的网页端口。
- MySQL、Redis、Console、Runtime、Proxy 和 WebSocket 仅通过 Docker 网络访问。
- `VECTOR_STORE_TYPE=none` 使用后端已有的 `NoOpVectorStore`，不启动 pgvector。
- 单机不启动 runner-file。共享工作空间使用同一个 Docker volume。
- runner-gateway 暂不启动，等 API 服务页面迁移时使用独立 profile 验收。
- Compose 依赖预先构建好的 Java JAR 与 `ui-react/dist`，避免每个镜像重复执行 Maven 和 Node 构建。

## 资源上限

| 服务 | 内存上限 |
| --- | ---: |
| MySQL | 768 MB |
| Redis | 256 MB |
| Console | 1280 MB |
| Runtime | 2304 MB |
| Proxy | 1024 MB |
| WebSocket | 384 MB |
| Nginx | 128 MB |

容器上限合计约 6GB，给宿主机、页缓存和突发构建留出余量。上线后仍需以真实负载测量为准。

## 启动

编排只消费预先构建的产物：

```bash
mvn -B -DskipTests package
pnpm --dir ui-react install --frozen-lockfile
pnpm --dir ui-react build
```

复制 `.env.example` 为 `.env`，用随机值替换所有 `replace-me`，并将文件权限设为 `0600`。不要提交 `.env`。MySQL 首次初始化脚本会给业务账号补充 Flyway 所需的单表只读权限，不使用 root 账号运行 Java 服务。

```bash
cd deploy/dev
docker compose --env-file .env build --pull=false
docker compose --env-file .env up -d
docker compose --env-file .env ps
```

## 访问

默认只监听 ECS 回环地址，避免在没有 TLS 时通过公网明文发送登录口令。在本机建立 SSH 隧道：

```bash
ssh -N -L 18080:127.0.0.1:80 -i /path/to/ecs.pem root@ECS_PUBLIC_IP
```

随后访问 `http://127.0.0.1:18080/react/`。配置域名、TLS 和公网反向代理后，再按需调整 `PUBLIC_BIND_ADDRESS`；不要把 MySQL、Redis 或 Java 内部端口映射到公网。

## 回滚

新 React 前端与旧 Vue 源码并存。停止新入口不会影响数据卷：

```bash
cd deploy/dev
docker compose --env-file .env stop frontend
```

如需回退镜像，先切回已验证的 Git 提交并重新构建应用镜像，再执行 `docker compose up -d`。不要删除 `mysql_data`、`redis_data` 或 `app_data` 数据卷。

## React 开发态服务

宿主机无需安装 Node。以下服务加入 `backend` 网络，在容器内安装依赖并启动 Vite，代理目标指向 compose 服务名，可直接对真实后端联调：

```bash
cd deploy/dev
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ui-react-dev.yml up -d ui-react-dev
```

首次启动会在容器内执行 `pnpm install`（源码目录即挂载目录，依赖写入 `ui-react/node_modules`）。访问方式同上，通过 SSH 隧道转发 `127.0.0.1:3031` 后打开 `http://127.0.0.1:3031/`。停止服务：

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ui-react-dev.yml stop ui-react-dev
```

端到端测试（Playwright）针对该开发服务执行，凭据只经环境变量注入：

```bash
cd ui-react
pnpm exec playwright install chromium
APBOA_E2E_BASE_URL=http://127.0.0.1:3031 APBOA_E2E_USERNAME=... APBOA_E2E_PASSWORD=... pnpm test:e2e
```
